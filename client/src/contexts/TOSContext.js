import React, { createContext, useContext, useState, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';

const TOSContext = createContext();

/**
 * @returns {{ tosVerified: boolean, isCheckingTos: boolean, markTosVerified: () => void }}
 */
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

    // SECURITY: Only use sessionStorage (tab-scoped, set after server confirmation).
    // localStorage was removed — users could manually set the key to bypass TOS.
    const tosVerifiedThisSession = sessionStorage.getItem(`tos_verified_${user?.sub}`);

    if (tosVerifiedThisSession === 'true') {
      setTosVerified(true);
      setIsCheckingTos(false);
    } else {
      // TOS not cached - still checking
      setIsCheckingTos(true);
    }
  }, [isAuthenticated, user]);

  // Method to mark TOS as verified (called by TOSGuard after successful check)
  const markTosVerified = () => {
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
