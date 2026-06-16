/**
 * BuyCoinsModal — purchase a coin package with Stripe.
 *
 *  Step 1 "select" — package grid (Starter…Business).
 *  Step 2 "pay"    — Stripe PaymentElement for the chosen package.
 *  Step 3 "success"— confirmation; coins arrive via webhook shortly after.
 *
 * Money rule: the employer's BALANCE is shown in coins only. The package PRICE
 * is real money the employer pays, so it is shown in ₪ here (and only here).
 */
import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { Coins, X, Check, Sparkles, Loader2, ArrowRight, ShieldCheck } from 'lucide-react';
import { stripePromise } from '../lib/stripe';
import { color, radius, space, styles, font } from '../design-system';
import { getCoinPackages, createPaymentIntent } from '../services/payments';

const agorotToIls = (agorot) => Math.round(agorot / 100);

const stripeAppearance = {
  theme: 'night',
  variables: {
    colorPrimary: color.primary,
    colorBackground: color.surface3,
    colorText: color.textPrimary,
    colorDanger: color.danger,
    fontFamily: "'Heebo', system-ui, sans-serif",
    borderRadius: '12px',
  },
};

// ── Inner Stripe form (lives inside <Elements>, so it can use the hooks) ──────
function CheckoutForm({ purchase, onSuccess, onBack }) {
  const stripe = useStripe();
  const elements = useElements();
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const handlePay = async (e) => {
    e.preventDefault();
    if (!stripe || !elements) return;
    setSubmitting(true);
    setError(null);

    const { error: stripeError, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: 'if_required', // stay in-app; no full-page redirect
    });

    if (stripeError) {
      setError(stripeError.message ?? 'התשלום נכשל. נסו שוב.');
      setSubmitting(false);
      return;
    }
    if (paymentIntent && (paymentIntent.status === 'succeeded' || paymentIntent.status === 'processing')) {
      onSuccess();
      return;
    }
    setError('התשלום לא הושלם. נסו שוב.');
    setSubmitting(false);
  };

  return (
    <form onSubmit={handlePay} style={{ display: 'flex', flexDirection: 'column', gap: space(4) }}>
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: space(3), background: color.surface2, borderRadius: radius.input,
      }}>
        <span style={{ color: color.textSecondary, fontSize: 14 }}>
          {purchase.coins} מטבעות · {purchase.packageName}
        </span>
        <span style={{ color: color.textPrimary, fontWeight: 700, fontSize: 16 }}>
          ₪{agorotToIls(purchase.amount)}
        </span>
      </div>

      <PaymentElement options={{ layout: 'tabs' }} />

      {error && (
        <div style={{ color: color.danger, fontSize: 13, fontWeight: 500 }}>{error}</div>
      )}

      <motion.button
        type="submit" whileTap={{ scale: 0.98 }} disabled={!stripe || submitting}
        style={{ ...styles.buttonPrimary, opacity: !stripe || submitting ? 0.6 : 1 }}
      >
        {submitting
          ? <Loader2 size={18} color="#fff" style={{ animation: 'spin 0.7s linear infinite' }} />
          : <><ShieldCheck size={18} color="#fff" strokeWidth={2.2} /> שלם ₪{agorotToIls(purchase.amount)}</>}
      </motion.button>

      <button type="button" onClick={onBack} disabled={submitting}
        style={{ ...styles.buttonSecondary, height: 44, opacity: submitting ? 0.5 : 1 }}>
        חזרה לחבילות
      </button>
    </form>
  );
}

// ── Modal ─────────────────────────────────────────────────────────────────────
export default function BuyCoinsModal({ open, onClose, onPurchased }) {
  const [step, setStep] = useState('select');     // select | pay | success
  const [packages, setPackages] = useState([]);
  const [loadingPkgs, setLoadingPkgs] = useState(true);
  const [purchase, setPurchase] = useState(null); // { clientSecret, amount, coins, packageName }
  const [busyId, setBusyId] = useState(null);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!open) return;
    setStep('select'); setError(null); setPurchase(null);
    setLoadingPkgs(true);
    getCoinPackages()
      .then((list) => setPackages(list))
      .catch(() => setError('טעינת החבילות נכשלה'))
      .finally(() => setLoadingPkgs(false));
  }, [open]);

  const handleSelect = useCallback(async (pkg) => {
    setBusyId(pkg.id); setError(null);
    try {
      const info = await createPaymentIntent(pkg.id);
      if (!info.clientSecret) throw new Error('no client secret');
      setPurchase(info);
      setStep('pay');
    } catch (err) {
      setError(err.message?.includes('Stripe') || err.status === 500
        ? 'התשלומים אינם זמינים כרגע. ודאו שמפתחות Stripe מוגדרים.'
        : (err.message ?? 'יצירת התשלום נכשלה'));
    } finally {
      setBusyId(null);
    }
  }, []);

  const handleSuccess = useCallback(() => {
    setStep('success');
    onPurchased?.();   // refresh wallet (coins land via webhook moments later)
  }, [onPurchased]);

  if (!open) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        onClick={onClose}
        style={{
          position: 'fixed', inset: 0, zIndex: 1000,
          background: 'rgba(0,0,0,0.6)', backdropFilter: 'blur(2px)',
          display: 'flex', alignItems: 'flex-end', justifyContent: 'center',
        }}
      >
        <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        <motion.div
          dir="rtl"
          initial={{ y: '100%' }} animate={{ y: 0 }} exit={{ y: '100%' }}
          transition={{ type: 'spring', damping: 30, stiffness: 300 }}
          onClick={(e) => e.stopPropagation()}
          style={{
            ...styles.sheet, width: '100%', maxWidth: 480,
            maxHeight: '92vh', overflowY: 'auto', padding: space(5),
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: space(4) }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: space(2) }}>
              <div style={{ ...styles.iconBox(36), background: color.primarySoft }}>
                <Coins size={18} color={color.primaryText} strokeWidth={2.2} />
              </div>
              <div style={{ fontSize: 18, ...font.heading }}>
                {step === 'success' ? 'התשלום התקבל' : 'קניית מטבעות'}
              </div>
            </div>
            <button onClick={onClose} style={styles.iconButton}>
              <X size={18} color={color.textSecondary} />
            </button>
          </div>

          {error && (
            <div style={{
              color: color.danger, fontSize: 13, fontWeight: 500,
              background: color.dangerSoft, padding: space(3), borderRadius: radius.input,
              marginBottom: space(3),
            }}>{error}</div>
          )}

          {/* Step: select package */}
          {step === 'select' && (
            <>
              <p style={{ ...font.body, marginTop: 0, marginBottom: space(4) }}>
                מטבעות משמשים לחיוב על ג׳סטות שמתאיישות. בחרו חבילה:
              </p>
              {loadingPkgs ? (
                <div style={{ display: 'flex', justifyContent: 'center', padding: space(8) }}>
                  <Loader2 size={24} color={color.primaryText} style={{ animation: 'spin 0.7s linear infinite' }} />
                </div>
              ) : (
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: space(3) }}>
                  {packages.map((pkg) => {
                    const perCoin = (pkg.priceIls / 100 / pkg.coins);
                    const best = pkg.name === 'Pro Pack';
                    return (
                      <motion.button
                        key={pkg.id} whileTap={{ scale: 0.97 }}
                        onClick={() => handleSelect(pkg)} disabled={busyId !== null}
                        style={{
                          ...styles.card, position: 'relative', cursor: 'pointer',
                          padding: space(4), textAlign: 'right',
                          border: `1px solid ${best ? color.primary : color.borderSubtle}`,
                          display: 'flex', flexDirection: 'column', gap: space(1),
                          opacity: busyId !== null && busyId !== pkg.id ? 0.5 : 1,
                        }}
                      >
                        {best && (
                          <span style={{
                            position: 'absolute', top: -10, insetInlineStart: 12,
                            fontSize: 9, fontWeight: 700, letterSpacing: '0.06em',
                            color: '#fff', background: color.primary,
                            borderRadius: radius.chip, padding: '2px 8px',
                            display: 'flex', alignItems: 'center', gap: 3,
                          }}><Sparkles size={9} /> הכי משתלם</span>
                        )}
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <Coins size={16} color={color.primaryText} strokeWidth={2.2} />
                          <span style={{ fontSize: 22, fontWeight: 800, color: color.textPrimary }}>
                            {pkg.coins}
                          </span>
                          <span style={{ fontSize: 12, color: color.textSecondary }}>מטבעות</span>
                        </div>
                        <div style={{ fontSize: 11, color: color.textMuted }}>{pkg.name}</div>
                        <div style={{
                          marginTop: space(2), display: 'flex',
                          alignItems: 'center', justifyContent: 'space-between',
                        }}>
                          <span style={{ fontSize: 18, fontWeight: 700, color: color.primaryText }}>
                            ₪{agorotToIls(pkg.priceIls)}
                          </span>
                          {busyId === pkg.id
                            ? <Loader2 size={16} color={color.primaryText} style={{ animation: 'spin 0.7s linear infinite' }} />
                            : <ArrowRight size={16} color={color.textMuted} style={{ transform: 'scaleX(-1)' }} />}
                        </div>
                        <div style={{ fontSize: 10, color: color.textMuted }}>
                          ₪{perCoin.toFixed(2)} למטבע
                        </div>
                      </motion.button>
                    );
                  })}
                </div>
              )}
            </>
          )}

          {/* Step: pay */}
          {step === 'pay' && purchase?.clientSecret && (
            <Elements stripe={stripePromise} options={{ clientSecret: purchase.clientSecret, appearance: stripeAppearance }}>
              <CheckoutForm
                purchase={purchase}
                onSuccess={handleSuccess}
                onBack={() => { setStep('select'); setPurchase(null); }}
              />
            </Elements>
          )}

          {/* Step: success */}
          {step === 'success' && (
            <div style={{ textAlign: 'center', padding: `${space(6)}px 0` }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%', margin: '0 auto',
                background: color.successSoft, display: 'flex',
                alignItems: 'center', justifyContent: 'center',
              }}>
                <Check size={32} color={color.success} strokeWidth={2.5} />
              </div>
              <div style={{ fontSize: 18, ...font.heading, marginTop: space(4) }}>
                התשלום התקבל בהצלחה
              </div>
              <p style={{ ...font.body, marginTop: space(2) }}>
                {purchase?.coins} מטבעות יתווספו ליתרה שלך תוך כמה רגעים.
              </p>
              <motion.button whileTap={{ scale: 0.98 }} onClick={onClose}
                style={{ ...styles.buttonPrimary, marginTop: space(4) }}>
                מעולה, סגור
              </motion.button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
