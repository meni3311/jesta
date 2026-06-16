import {
  Injectable, Logger, ForbiddenException, NotFoundException,
  BadRequestException,
} from '@nestjs/common';
import Stripe from 'stripe';
import { PrismaService } from '../prisma/prisma.service';
import { StripeService } from '../stripe/stripe.service';
import { CoinsService } from '../coins/coins.service';

/** Map a Stripe subscription status onto our SubscriptionStatus enum. */
function mapStatus(s: Stripe.Subscription.Status): string {
  switch (s) {
    case 'active':              return 'ACTIVE';
    case 'trialing':            return 'TRIALING';
    case 'past_due':            return 'PAST_DUE';
    case 'unpaid':              return 'UNPAID';
    case 'canceled':            return 'CANCELED';
    case 'incomplete':          return 'INCOMPLETE';
    case 'incomplete_expired':  return 'INCOMPLETE';
    default:                    return 'INCOMPLETE';
  }
}

/** Statuses that grant Pro access. */
const PRO_ACTIVE_STATUSES: Stripe.Subscription.Status[] = ['active', 'trialing'];

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly stripe: StripeService,
    private readonly coins: CoinsService,
  ) {}

  // ── Stripe customer lifecycle ────────────────────────────────────────────
  /** Get (or lazily create + persist) the employer's Stripe customer id. */
  private async ensureStripeCustomer(userId: string): Promise<string> {
    const user = await this.prisma.db.user.findUnique({
      where: { id: userId },
      select: { id: true, email: true, fullName: true, role: true, stripeCustomerId: true },
    });
    if (!user) throw new NotFoundException('User not found');
    if (user.role !== 'EMPLOYER') {
      throw new ForbiddenException('תשלומים זמינים למעסיקים בלבד');
    }
    if (user.stripeCustomerId) return user.stripeCustomerId;

    const customerId = await this.stripe.createCustomer({
      email: user.email,
      name: user.fullName,
      userId: user.id,
    });
    await this.prisma.db.user.update({
      where: { id: userId },
      data: { stripeCustomerId: customerId },
    });
    return customerId;
  }

  // ── Coin purchase ─────────────────────────────────────────────────────────
  /**
   * Create a PaymentIntent for a coin package. Returns the client secret the
   * frontend confirms with Stripe.js. Coins are credited only by the webhook.
   */
  async createPaymentIntent(userId: string, packageId: string) {
    const pkg = await this.coins.getPackageById(packageId);
    const customerId = await this.ensureStripeCustomer(userId);

    const intent = await this.stripe.createPaymentIntent({
      amountAgorot: pkg.priceIls,
      customerId,
      userId,
      packageId: pkg.id,
      coins: pkg.coins,
    });

    return {
      clientSecret: intent.client_secret,
      paymentIntentId: intent.id,
      amount: pkg.priceIls,        // agorot
      coins: pkg.coins,
      packageName: pkg.name,
    };
  }

  // ── Pro subscription ────────────────────────────────────────────────────
  /** Create a ₪199/month Pro subscription and return its first client secret. */
  async createSubscription(userId: string) {
    const user = await this.prisma.db.user.findUnique({
      where: { id: userId },
      select: { isPro: true, stripeSubscriptionId: true, subscriptionStatus: true },
    });
    if (user?.stripeSubscriptionId &&
        (user.subscriptionStatus === 'ACTIVE' || user.subscriptionStatus === 'TRIALING')) {
      throw new BadRequestException('כבר יש לך מנוי Pro פעיל');
    }

    const customerId = await this.ensureStripeCustomer(userId);
    const subscription = await this.stripe.createProSubscription({ customerId, userId });

    // Persist the (incomplete) subscription id immediately so the webhook can
    // reconcile it even if the client never returns.
    await this.prisma.db.user.update({
      where: { id: userId },
      data: {
        stripeSubscriptionId: subscription.id,
        subscriptionStatus: mapStatus(subscription.status),
      },
    });

    const invoice = subscription.latest_invoice as Stripe.Invoice | null;
    const pi = invoice?.payment_intent as Stripe.PaymentIntent | null;

    return {
      subscriptionId: subscription.id,
      clientSecret: pi?.client_secret ?? null,
      status: subscription.status,
    };
  }

  /** Cancel the employer's Pro subscription at period end. */
  async cancelSubscription(userId: string) {
    const user = await this.prisma.db.user.findUnique({
      where: { id: userId },
      select: { stripeSubscriptionId: true },
    });
    if (!user?.stripeSubscriptionId) {
      throw new BadRequestException('אין מנוי פעיל לביטול');
    }
    const sub = await this.stripe.cancelSubscription(user.stripeSubscriptionId);
    return { ok: true, cancelAtPeriodEnd: sub.cancel_at_period_end };
  }

  // ── Webhook dispatch ──────────────────────────────────────────────────────
  /** Verify + handle a raw Stripe webhook request. */
  async handleWebhook(rawBody: Buffer, signature: string) {
    let event: Stripe.Event;
    try {
      event = this.stripe.constructWebhookEvent(rawBody, signature);
    } catch (err: any) {
      this.logger.warn(`Webhook signature verification failed: ${err.message}`);
      throw new BadRequestException(`Webhook Error: ${err.message}`);
    }

    this.logger.log(`Stripe webhook: ${event.type}`);

    switch (event.type) {
      case 'payment_intent.succeeded':
        await this.onPaymentIntentSucceeded(event.data.object as Stripe.PaymentIntent);
        break;

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.onSubscriptionUpsert(event.data.object as Stripe.Subscription);
        break;

      case 'customer.subscription.deleted':
        await this.onSubscriptionDeleted(event.data.object as Stripe.Subscription);
        break;

      default:
        // Unhandled events are acknowledged so Stripe stops retrying them.
        break;
    }

    return { received: true };
  }

  // ── Webhook handlers ──────────────────────────────────────────────────────
  private async onPaymentIntentSucceeded(pi: Stripe.PaymentIntent) {
    // Only coin-purchase intents credit coins. Subscription invoice PIs are
    // handled via subscription events instead.
    if (pi.metadata?.kind !== 'coin_purchase') return;

    const userId = pi.metadata.jestaUserId;
    const coins = Number(pi.metadata.coins);
    const packageId = pi.metadata.packageId ?? null;

    if (!userId || !Number.isFinite(coins) || coins <= 0) {
      this.logger.warn(`coin_purchase PI ${pi.id} missing/invalid metadata — skipping`);
      return;
    }

    await this.coins.creditPurchase({
      userId,
      coins,
      packageId,
      stripePaymentIntentId: pi.id,
      description: `רכישת ${coins} מטבעות (${pi.metadata.packageName ?? 'חבילה'})`,
    });
  }

  private async resolveUserId(sub: Stripe.Subscription): Promise<string | null> {
    const fromMeta = sub.metadata?.jestaUserId;
    if (fromMeta) return fromMeta;

    const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer?.id;
    if (!customerId) return null;
    const user = await this.prisma.db.user.findFirst({
      where: { stripeCustomerId: customerId },
      select: { id: true },
    });
    return user?.id ?? null;
  }

  private async onSubscriptionUpsert(sub: Stripe.Subscription) {
    const userId = await this.resolveUserId(sub);
    if (!userId) {
      this.logger.warn(`subscription ${sub.id}: could not resolve Jesta user`);
      return;
    }

    const isActive = PRO_ACTIVE_STATUSES.includes(sub.status);
    const periodEnd = sub.current_period_end
      ? new Date(sub.current_period_end * 1000)
      : null;

    await this.prisma.db.user.update({
      where: { id: userId },
      data: {
        isPro: isActive,
        stripeSubscriptionId: sub.id,
        subscriptionStatus: mapStatus(sub.status),
        proExpiresAt: isActive ? periodEnd : null,
      },
    });
    this.logger.log(
      `Pro ${isActive ? 'ACTIVE' : 'INACTIVE'} for user ${userId} (sub ${sub.id}, ${sub.status})`,
    );
  }

  private async onSubscriptionDeleted(sub: Stripe.Subscription) {
    const userId = await this.resolveUserId(sub);
    if (!userId) return;

    await this.prisma.db.user.update({
      where: { id: userId },
      data: {
        isPro: false,
        subscriptionStatus: 'CANCELED',
        proExpiresAt: null,
        stripeSubscriptionId: null,
      },
    });
    this.logger.log(`Pro CANCELED for user ${userId} (sub ${sub.id})`);
  }
}
