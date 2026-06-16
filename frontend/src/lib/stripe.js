/**
 * Stripe.js singleton. loadStripe is called once and the promise reused so the
 * SDK script is injected a single time across the whole app.
 */
import { loadStripe } from '@stripe/stripe-js';

const KEY = import.meta.env.VITE_STRIPE_PUBLISHABLE_KEY;

if (!KEY) {
  console.warn(
    '[Jesta] VITE_STRIPE_PUBLISHABLE_KEY not set — coin purchases & Pro upgrade ' +
    'will be disabled. Copy frontend/.env.local.example → .env.local and fill it in.',
  );
}

// Resolves to null when no key is configured, so callers can guard gracefully.
export const stripePromise = KEY ? loadStripe(KEY) : Promise.resolve(null);
