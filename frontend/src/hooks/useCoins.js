/**
 * useCoins — loads & refreshes the employer's coin wallet (balance + Pro state)
 * and exposes a `refresh()` the modals call after a purchase/upgrade.
 */
import { useState, useEffect, useCallback } from 'react';
import { getWallet } from '../services/payments';

export function useCoins() {
  const [wallet, setWallet] = useState(null);   // { balance, isPro, proExpiresAt, subscriptionStatus }
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const refresh = useCallback(async () => {
    try {
      const data = await getWallet();
      setWallet(data);
      setError(null);
      return data;
    } catch (err) {
      setError(err);
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { refresh(); }, [refresh]);

  return {
    wallet,
    balance: wallet?.balance ?? 0,
    isPro: !!wallet?.isPro,
    loading,
    error,
    refresh,
  };
}

export default useCoins;
