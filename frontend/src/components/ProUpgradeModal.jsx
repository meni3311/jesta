/**
 * ProUpgradeModal — subscribe to Jesta Pro (₪199/month) via Stripe.
 *
 *  Step "intro"  — benefits + price.
 *  Step "pay"    — Stripe PaymentElement for the first invoice.
 *  Step "success"— confirmation; Pro flips on via webhook moments later.
 */
import { useState, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import {
  Crown, X, Check, Loader2, Users, ShieldCheck, Zap, Send, UserPlus,
} from 'lucide-react';
import { stripePromise } from '../lib/stripe';
import { color, radius, space, styles, font } from '../design-system';
import { createSubscription } from '../services/payments';

const PRO_PRICE_ILS = 199;

const PRO_FEATURES = [
  { icon: Users,       text: 'בחירת מועמדים — ראו את כל הנרשמים ובחרו' },
  { icon: ShieldCheck, text: 'ג׳סטה מבוטחת — מחליף אוטומטי בזמן אי-הגעה' },
  { icon: Zap,         text: 'ג׳סטת חירום — שכר מוגדל ופרסום דחוף' },
  { icon: Send,        text: 'הצעות אישיות — גיוס ישיר של עובדים' },
  { icon: UserPlus,    text: 'פרסום מרובה-עובדים בקישור הזמנה' },
];

function SubscribeForm({ onSuccess, onBack }) {
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
      redirect: 'if_required',
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
    setError('המנוי לא הופעל. נסו שוב.');
    setSubmitting(false);
  };

  return (
    <form onSubmit={handlePay} style={{ display: 'flex', flexDirection: 'column', gap: space(4) }}>
      <PaymentElement options={{ layout: 'tabs' }} />
      {error && <div style={{ color: color.danger, fontSize: 13, fontWeight: 500 }}>{error}</div>}
      <motion.button type="submit" whileTap={{ scale: 0.98 }} disabled={!stripe || submitting}
        style={{ ...styles.buttonPrimary, opacity: !stripe || submitting ? 0.6 : 1 }}>
        {submitting
          ? <Loader2 size={18} color="#fff" style={{ animation: 'spin 0.7s linear infinite' }} />
          : <><Crown size={18} color="#fff" strokeWidth={2.2} /> הפעל Pro · ₪{PRO_PRICE_ILS}/חודש</>}
      </motion.button>
      <button type="button" onClick={onBack} disabled={submitting}
        style={{ ...styles.buttonSecondary, height: 44, opacity: submitting ? 0.5 : 1 }}>
        חזרה
      </button>
    </form>
  );
}

export default function ProUpgradeModal({ open, onClose, onUpgraded }) {
  const [step, setStep] = useState('intro');   // intro | pay | success
  const [clientSecret, setClientSecret] = useState(null);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState(null);

  const start = useCallback(async () => {
    setStarting(true); setError(null);
    try {
      const sub = await createSubscription();
      if (!sub.clientSecret) throw new Error('no client secret');
      setClientSecret(sub.clientSecret);
      setStep('pay');
    } catch (err) {
      setError(
        err.status === 400 ? (err.message ?? 'כבר יש לך מנוי פעיל')
        : (err.status === 500 || /Stripe/.test(err.message ?? ''))
          ? 'התשלומים אינם זמינים כרגע. ודאו שמפתחות Stripe מוגדרים.'
          : (err.message ?? 'התחלת המנוי נכשלה'),
      );
    } finally {
      setStarting(false);
    }
  }, []);

  const handleSuccess = useCallback(() => {
    setStep('success');
    onUpgraded?.();
  }, [onUpgraded]);

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
          style={{ ...styles.sheet, width: '100%', maxWidth: 480, maxHeight: '92vh', overflowY: 'auto', padding: space(5) }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: space(4) }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: space(2) }}>
              <div style={{ ...styles.iconBox(36), background: color.primarySoft }}>
                <Crown size={18} color={color.primaryText} strokeWidth={2.2} />
              </div>
              <div style={{ fontSize: 18, ...font.heading }}>
                {step === 'success' ? 'ברוכים הבאים ל-Pro' : 'שדרוג ל-Jesta Pro'}
              </div>
            </div>
            <button onClick={onClose} style={styles.iconButton}>
              <X size={18} color={color.textSecondary} />
            </button>
          </div>

          {error && (
            <div style={{
              color: color.danger, fontSize: 13, fontWeight: 500,
              background: color.dangerSoft, padding: space(3), borderRadius: radius.input, marginBottom: space(3),
            }}>{error}</div>
          )}

          {step === 'intro' && (
            <>
              <div style={{
                display: 'flex', alignItems: 'baseline', gap: 6,
                marginBottom: space(4),
              }}>
                <span style={{ fontSize: 34, fontWeight: 800, color: color.textPrimary }}>₪{PRO_PRICE_ILS}</span>
                <span style={{ fontSize: 14, color: color.textSecondary }}>/ חודש · בטל בכל עת</span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: space(3), marginBottom: space(4) }}>
                {PRO_FEATURES.map(({ icon: Icon, text }, i) => (
                  <div key={i} style={{ display: 'flex', alignItems: 'center', gap: space(3) }}>
                    <div style={{ ...styles.iconBox(32), background: color.primarySoft }}>
                      <Icon size={15} color={color.primaryText} strokeWidth={2.2} />
                    </div>
                    <span style={{ fontSize: 14, color: color.textPrimary }}>{text}</span>
                  </div>
                ))}
              </div>

              <div style={{
                display: 'flex', alignItems: 'center', gap: 8,
                padding: space(3), background: color.successSoft,
                borderRadius: radius.input, marginBottom: space(4),
              }}>
                <Check size={15} color={color.success} strokeWidth={2.4} />
                <span style={{ fontSize: 13, color: color.textSecondary }}>
                  חיוב מוזל: 18 מטבעות לג׳סטה שמתאיישת (במקום 20) · פרסום ללא הגבלה
                </span>
              </div>

              <motion.button whileTap={{ scale: 0.98 }} onClick={start} disabled={starting}
                style={{ ...styles.buttonPrimary, opacity: starting ? 0.6 : 1 }}>
                {starting
                  ? <Loader2 size={18} color="#fff" style={{ animation: 'spin 0.7s linear infinite' }} />
                  : <><Crown size={18} color="#fff" strokeWidth={2.2} /> המשך לתשלום</>}
              </motion.button>
            </>
          )}

          {step === 'pay' && clientSecret && (
            <Elements stripe={stripePromise} options={{
              clientSecret,
              appearance: {
                theme: 'night',
                variables: {
                  colorPrimary: color.primary, colorBackground: color.surface3,
                  colorText: color.textPrimary, borderRadius: '12px',
                  fontFamily: "'Heebo', system-ui, sans-serif",
                },
              },
            }}>
              <SubscribeForm onSuccess={handleSuccess} onBack={() => setStep('intro')} />
            </Elements>
          )}

          {step === 'success' && (
            <div style={{ textAlign: 'center', padding: `${space(6)}px 0` }}>
              <div style={{
                width: 64, height: 64, borderRadius: '50%', margin: '0 auto',
                background: color.primarySoft, display: 'flex', alignItems: 'center', justifyContent: 'center',
              }}>
                <Crown size={32} color={color.primaryText} strokeWidth={2.2} />
              </div>
              <div style={{ fontSize: 18, ...font.heading, marginTop: space(4) }}>החשבון שודרג ל-Pro</div>
              <p style={{ ...font.body, marginTop: space(2) }}>
                כל יכולות ה-Pro נפתחו. המנוי יתחדש מדי חודש עד לביטול.
              </p>
              <motion.button whileTap={{ scale: 0.98 }} onClick={onClose}
                style={{ ...styles.buttonPrimary, marginTop: space(4) }}>
                בואו נתחיל
              </motion.button>
            </div>
          )}
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
