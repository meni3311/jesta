/**
 * CoinBalance — header widget for employers.
 *
 *  • A pill showing the live coin balance; tapping it opens BuyCoinsModal.
 *  • A crown button to upgrade to Pro (hidden once the employer is Pro).
 *
 * Self-contained: loads the wallet via useCoins and owns both modals. Drop it
 * into the dashboard header. Pass `onProChange` to let the parent refresh the
 * session when Pro is activated.
 */
import { useState } from 'react';
import { motion } from 'framer-motion';
import { Coins, Plus, Crown } from 'lucide-react';
import { color, radius, space } from '../design-system';
import { useCoins } from '../hooks/useCoins';
import BuyCoinsModal from './BuyCoinsModal';
import ProUpgradeModal from './ProUpgradeModal';

export default function CoinBalance({ initialBalance = 0, initialIsPro = false, onProChange }) {
  const { balance, isPro, loading, refresh } = useCoins();
  const [buyOpen, setBuyOpen] = useState(false);
  const [proOpen, setProOpen] = useState(false);

  // Show the session value until the wallet fetch resolves (no flicker to 0).
  const shownBalance = loading ? initialBalance : balance;
  const shownIsPro = loading ? initialIsPro : isPro;

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', gap: space(2) }}>
        {/* Balance pill → buy coins */}
        <motion.button
          whileTap={{ scale: 0.95 }} onClick={() => setBuyOpen(true)}
          style={{
            display: 'flex', alignItems: 'center', gap: 6,
            height: 36, padding: '0 10px 0 8px',
            borderRadius: radius.chip,
            background: color.surface2,
            border: `1px solid ${color.borderSubtle}`,
            cursor: 'pointer',
          }}
          aria-label="קניית מטבעות"
        >
          <Coins size={15} color={color.primaryText} strokeWidth={2.2} />
          <span style={{ fontSize: 14, fontWeight: 700, color: color.textPrimary, minWidth: 14, textAlign: 'center' }}>
            {shownBalance}
          </span>
          <span style={{
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            width: 18, height: 18, borderRadius: radius.chip,
            background: color.primarySoft,
          }}>
            <Plus size={12} color={color.primaryText} strokeWidth={2.6} />
          </span>
        </motion.button>

        {/* Upgrade to Pro (hidden when already Pro) */}
        {!shownIsPro && (
          <motion.button
            whileTap={{ scale: 0.92 }} onClick={() => setProOpen(true)}
            style={{
              width: 36, height: 36, borderRadius: radius.chip,
              background: color.primarySoft,
              border: `1px solid ${color.primary}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              cursor: 'pointer', flexShrink: 0,
            }}
            aria-label="שדרוג ל-Pro"
          >
            <Crown size={16} color={color.primaryText} strokeWidth={2.2} />
          </motion.button>
        )}
      </div>

      <BuyCoinsModal
        open={buyOpen}
        onClose={() => setBuyOpen(false)}
        onPurchased={() => { setTimeout(refresh, 1500); }}
      />
      <ProUpgradeModal
        open={proOpen}
        onClose={() => setProOpen(false)}
        onUpgraded={() => { setTimeout(() => { refresh(); onProChange?.(); }, 1500); }}
      />
    </>
  );
}
