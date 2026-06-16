/**
 * Jesta coins & payments API helpers — thin wrappers over the shared axios
 * instance. Each returns the unwrapped response `data`.
 *
 * Money note: the wallet `balance` is in COINS (1 coin = ₪1 internal value,
 * never shown as ₪). Package prices come back in AGOROT (2500 = ₪25).
 */
import api from './axiosInstance';

// ── Coins ──────────────────────────────────────────────────────────────────

/** Active coin packages (Starter…Business). Prices in agorot. */
export async function getCoinPackages() {
  const { data } = await api.get('/coins/packages');
  return data;
}

/** Wallet summary: { balance, isPro, proExpiresAt, subscriptionStatus }. */
export async function getWallet() {
  const { data } = await api.get('/coins/wallet');
  return data;
}

/** Coin ledger (most recent first). */
export async function getCoinTransactions() {
  const { data } = await api.get('/coins/transactions');
  return data;
}

// ── Referrals ──────────────────────────────────────────────────────────────

/** Own referral code + stats: { code, totalReferred, paidCount, coinsEarned }. */
export async function getReferralInfo() {
  const { data } = await api.get('/coins/referral');
  return data;
}

/** Link a friend's referral code (before posting the first job). */
export async function applyReferralCode(code) {
  const { data } = await api.post('/coins/referral/apply', { code });
  return data;
}

// ── Stripe payments ──────────────────────────────────────────────────────────

/**
 * Create a PaymentIntent for a coin package.
 * Returns { clientSecret, paymentIntentId, amount, coins, packageName }.
 * @param {string} packageId
 */
export async function createPaymentIntent(packageId) {
  const { data } = await api.post('/payments/create-payment-intent', { packageId });
  return data;
}

/**
 * Start the ₪199/month Pro subscription.
 * Returns { subscriptionId, clientSecret, status }.
 */
export async function createSubscription() {
  const { data } = await api.post('/payments/create-subscription');
  return data;
}

/** Cancel Pro at the end of the current billing period. */
export async function cancelSubscription() {
  const { data } = await api.post('/payments/cancel-subscription');
  return data;
}
