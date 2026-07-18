'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth0 } from '@/lib/auth0-client';

const TOSContext = createContext();

export const useTOS = () => {
  const context = useContext(TOSContext);
  if (!context) {
    throw new Error('useTOS must be used within a TOSProvider');
  }
  return context;
};

/**
 * TOSProvider - Manages Terms of Service verification state across the app
 * This allows other components (like DocumentContext) to wait for TOS verification
 * before making API calls
 */
export const TOSProvider = ({ children }) => {
  const { isAuthenticated, user } = useAuth0();
  const [tosVerified, setTosVerified] = useState(false);
  const [isCheckingTos, setIsCheckingTos] = useState(true);

  useEffect(() => {
    // Reset TOS verified state when authentication changes
    if (!isAuthenticated || !user) {
      setTosVerified(false);
      setIsCheckingTos(true);
      return;
    }

    // Browser storage is never an authority for a legal acceptance record.
    // TOSGuard verifies the database-backed current version on every app load.
    setTosVerified(false);
    setIsCheckingTos(true);
  }, [isAuthenticated, user]);

  // Method to mark TOS as verified (called by TOSGuard after successful check)
  const markTosVerified = () => {
    console.log('[TOSContext] Marking TOS as verified');
    setTosVerified(true);
    setIsCheckingTos(false);
  };

  const value = {
    tosVerified,
    isCheckingTos,
    markTosVerified,
  };

  return <TOSContext.Provider value={value}>{children}</TOSContext.Provider>;
};
