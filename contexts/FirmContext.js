'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth0 } from '@/lib/auth0-client';

/**
 * FirmContext - exposes whether this deployment runs in firm mode (connected
 * to a law firm's BigLaw platform) and the firm's display name.
 *
 * Defaults to { firmMode: false } so non-firm deployments — and any component
 * rendered outside the provider — behave exactly like the pure self-rep
 * product: zero firm UI, zero firm API calls.
 */
const DEFAULT_FIRM_STATE = { firmMode: false, firmName: '', loading: false };

const FirmContext = createContext(DEFAULT_FIRM_STATE);

export const useFirm = () => useContext(FirmContext);

export const FirmProvider = ({ children }) => {
  const { isAuthenticated } = useAuth0();
  const [firmMode, setFirmMode] = useState(false);
  const [firmName, setFirmName] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // /api/firm/config is auth-gated; wait for a session before asking.
    if (!isAuthenticated) {
      setFirmMode(false);
      setFirmName('');
      setLoading(false);
      return;
    }

    let cancelled = false;
    setLoading(true);

    const loadConfig = async () => {
      try {
        const response = await fetch('/api/firm/config', { credentials: 'same-origin' });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (cancelled) return;
        setFirmMode(Boolean(data?.data?.firmMode));
        setFirmName(data?.data?.firmName || '');
      } catch (error) {
        // Firm features are an enhancement — on any failure, render as a
        // plain self-rep deployment.
        console.error('[FirmContext] Failed to load firm config:', error);
        if (!cancelled) {
          setFirmMode(false);
          setFirmName('');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadConfig();
    return () => { cancelled = true; };
  }, [isAuthenticated]);

  const value = { firmMode, firmName, loading };

  return <FirmContext.Provider value={value}>{children}</FirmContext.Provider>;
};
