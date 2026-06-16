import { Injectable, Logger, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

/**
 * Thin wrapper around the Stripe SDK. Centralizes client construction, the
 * customer lifecycle, PaymentIntent / Subscription creation and webhook
 * signature verification so the rest of the app never touches `stripe`
 * directly.
 *
 * Currency: all amounts are ILS minor units (AGOROT). 2500 = ₪25.00.
 */
@Injectable()
export class StripeService {
  private readonly logger = new Logger(StripeService.name);
  private readonly stripe: Stripe | null;
  private readonly webhookSecret: string;

  /** Monthly Pro subscription price, in agorot (₪199.00). */
  static readonly PRO_PRICE_AGOROT = 19900;
  static readonly CURRENCY = 'ils';

  constructor(private readonly config: ConfigService) {
    const key = this.config.get<string>('STRIPE_SECRET_KEY');
    this.webhookSecret = this.config.get<string>('STRIPE_WEBHOOK_SECRET') ?? '';

    if (!key) {
      this.logger.warn(
        'STRIPE_SECRET_KEY missing — payments are disabled until it is set in backend/.env',
      );
      this.stripe = null;
    } else {
      this.stripe = new Stripe(key, { apiVersion: '2024-06-20' });
    }
  }

  /** True when Stripe is configured and ready to take payments. */
  get enabled(): boolean {
    return this.stripe !== null;
  }

  private client(): Stripe {
    if (!this.stripe) {
      throw new InternalServerErrorException(
        'Stripe is not configured (STRIPE_SECRET_KEY missing)',
      );
    }
    return this.stripe;
  }

  // ── Customers ────────────────────────────────────────────────────────────
  /** Create a Stripe Customer for an employer and return its id. */
  async createCustomer(params: {
    email: string;
    name?: string;
    userId: string;
  }): Promise<string> {
    const customer = await this.client().customers.create({
      email: params.email,
      name: params.name,
      metadata: { jestaUserId: params.userId },
    });
    return customer.id;
  }

  // ── One-time coin purchases ──────────────────────────────────────────────
  /**
   * Create a PaymentIntent for a coin-package purchase. The coins are credited
   * only later, by the `payment_intent.succeeded` webhook — never here.
   */
  async createPaymentIntent(params: {
    amountAgorot: number;
    customerId: string;
    userId: string;
    packageId: string;
    coins: number;
  }): Promise<Stripe.PaymentIntent> {
    return this.client().paymentIntents.create({
      amount: params.amountAgorot,
      currency: StripeService.CURRENCY,
      customer: params.customerId,
      // Lets the webhook credit the right wallet without trusting the client.
      metadata: {
        jestaUserId: params.userId,
        packageId: params.packageId,
        coins: String(params.coins),
        kind: 'coin_purchase',
      },
      automatic_payment_methods: { enabled: true },
    });
  }

  // ── Pro subscription ─────────────────────────────────────────────────────
  /**
   * Create a ₪199/month Pro subscription using an inline price_data block, so
   * no pre-created Stripe Price is required. Returns the subscription with the
   * first invoice's PaymentIntent expanded for client-side confirmation.
   */
  async createProSubscription(params: {
    customerId: string;
    userId: string;
  }): Promise<Stripe.Subscription> {
    // Stripe's subscription Item.PriceData type does not include product_data,
    // so we create an inline price at the top-level prices API first.
    const price = await this.client().prices.create({
      currency: StripeService.CURRENCY,
      unit_amount: StripeService.PRO_PRICE_AGOROT,
      recurring: { interval: 'month' },
      product_data: { name: 'Jesta Pro — מנוי חודשי' },
    });

    return this.client().subscriptions.create({
      customer: params.customerId,
      items: [{ price: price.id }],
      metadata: { jestaUserId: params.userId, kind: 'pro_subscription' },
      payment_behavior: 'default_incomplete',
      payment_settings: { save_default_payment_method: 'on_subscription' },
      expand: ['latest_invoice.payment_intent'],
    });
  }

  /** Cancel a Pro subscription at period end (keeps access until it lapses). */
  async cancelSubscription(subscriptionId: string): Promise<Stripe.Subscription> {
    return this.client().subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
    });
  }

  // ── Webhooks ─────────────────────────────────────────────────────────────
  /**
   * Verify the Stripe-Signature header against the raw request body and return
   * the typed event. Throws if the signature is invalid — the caller turns
   * that into a 400 so Stripe retries.
   */
  constructWebhookEvent(rawBody: Buffer, signature: string): Stripe.Event {
    if (!this.webhookSecret) {
      throw new InternalServerErrorException(
        'STRIPE_WEBHOOK_SECRET missing — cannot verify webhook signatures',
      );
    }
    return this.client().webhooks.constructEvent(
      rawBody,
      signature,
      this.webhookSecret,
    );
  }
}
