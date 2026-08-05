'use client';

import React, { useState, useEffect, useRef } from 'react';
import { useAuth0 } from '@/lib/auth0-client';
import TermsOfServiceModal from './TermsOfServiceModal';
import { useAuthenticatedApi } from '@/lib/services/authService';
import { useTOS } from '@/contexts/TOSContext';

/**
 * TOSGuard - Protects authenticated routes and ensures users have accepted Terms of Service
 * Shows TOS modal for new users who haven't accepted yet
 * NOTE: This component should ONLY wrap authenticated routes (/dashboard, /editor/*)
 * Public routes like the landing page should NOT be wrapped with TOSGuard
 */
const TOSGuard = ({ children }) => {
  const { isAuthenticated, isLoading, user, loginWithRedirect } = useAuth0();
  const { makeAuthenticatedRequest } = useAuthenticatedApi();
  const { markTosVerified } = useTOS();
  const [, setTosStatus] = useState(null);
  const [showTosModal, setShowTosModal] = useState(false);
  const [isCheckingTos, setIsCheckingTos] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Initializing...');
  const [tosError, setTosError] = useState('');
  const [authStartTime] = useState(Date.now());
  const isRedirectingRef = useRef(false);

  useEffect(() => {
    const checkTosStatus = async () => {
      const elapsedTime = Date.now() - authStartTime;

      // NEVER redirect to login while Auth0 SDK is still loading.
      // The SDK needs time to process callback params or check the session.
      // Redirecting during this window causes an infinite login loop.
      if (isLoading) {
        console.log('[TOSGuard] Waiting for auth to finish loading...');
        setLoadingMessage(elapsedTime > 10000
          ? 'Authentication check taking longer than expected...'
          : 'Checking authentication...');
        return;
      }

      // If not authenticated and we haven't already started a redirect, send to login.
      // The ref guard prevents calling loginWithRedirect multiple times if state
      // updates trigger re-renders before the redirect completes.
      if (!isAuthenticated) {
        if (isRedirectingRef.current) {
          console.log('[TOSGuard] Already redirecting to login, skipping duplicate');
          return;
        }
        console.log('[TOSGuard] User not authenticated on protected route, redirecting to login');
        setLoadingMessage('Redirecting to login...');
        isRedirectingRef.current = true;
        loginWithRedirect({
          appState: { returnTo: window.location.pathname }
        });
        return;
      }

      // Wait for user object to be available (with timeout)
      if (!user?.sub) {
        console.log('[TOSGuard] User object not available yet, waiting...');
        setLoadingMessage('Loading user profile...');

        // Timeout after 5 seconds of waiting for user object
        if (elapsedTime > 5000 && !isLoading) {
          console.error('[TOSGuard] User object timeout after 5s - may be an Auth0 issue');
          setLoadingMessage('Having trouble loading user data. Please refresh if this persists.');

          // Never expose a protected route without a complete identity.
          if (elapsedTime > 8000) {
            console.error('[TOSGuard] User profile unavailable; access remains blocked');
            setTosError('We could not verify your account. Refresh the page or sign in again.');
            return;
          }
        }

        // Keep checking - don't set isCheckingTos to false yet
        // The useEffect will re-run when user becomes available
        return;
      }

      console.log('[TOSGuard] Starting TOS status check for user:', user.sub);
      setTosError('');
      setLoadingMessage('Verifying account...');

      try {
        console.log('[TOSGuard] Calling API: /api/auth/tos-status');
        setLoadingMessage('Checking account status...');
        const data = await makeAuthenticatedRequest('/api/auth/tos-status');
        console.log('[TOSGuard] API response:', data);

        if (data.success) {
          setTosStatus(data);

          // Only cache if user has actually accepted TOS
          if (data.tosAccepted) {
            console.log('[TOSGuard] User has accepted TOS, caching acceptance');
            markTosVerified();
            setTosError('');
          } else {
            // Show TOS modal if user hasn't accepted
            console.log('[TOSGuard] User has NOT accepted TOS, showing modal');
            setShowTosModal(true);
          }
        } else {
          // API returned success: false - fail secure and show modal
          console.warn('[TOSGuard] API returned success: false, showing modal to be safe');
          setShowTosModal(true);
        }
      } catch (error) {
        // CRITICAL FIX: On error, show TOS modal (fail-secure approach)
        // This prevents users from bypassing TOS if there's an API error
        console.error('[TOSGuard] Error checking TOS status:', error);
        console.warn('[TOSGuard] Showing TOS modal due to error (fail-secure)');

        setTosError('We could not verify your Terms acceptance. Please retry.');
        setShowTosModal(false);
      } finally {
        setIsCheckingTos(false);
      }
    };

    checkTosStatus();
    // makeAuthenticatedRequest and loginWithRedirect are stable and should not trigger re-runs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isLoading, user?.sub]);

  const handleAcceptTos = async (tosVersion, researchConsent = false) => {
    setTosError('');
    try {
      console.log('[TOSGuard] User accepting TOS:', { tosVersion, researchConsent, userId: user?.sub });
      const data = await makeAuthenticatedRequest('/api/auth/accept-tos', {
        method: 'POST',
        body: JSON.stringify({ tosVersion, researchConsent }),
      });
      console.log('[TOSGuard] TOS acceptance response:', data);

      if (data.success) {
        setTosError('');
        console.log('[TOSGuard] TOS acceptance successful, updating state and cache');
        setTosStatus({
          tosAccepted: true,
          tosVersionAccepted: tosVersion,
          tosAcceptedAt: new Date().toISOString(),
        });
        markTosVerified();
        setShowTosModal(false);
        console.log('[TOSGuard] TOS modal closed, user can now access application');
      } else {
        throw new Error(data.error || 'Failed to accept TOS');
      }
    } catch (error) {
      console.error('[TOSGuard] Error accepting TOS:', error);
      setTosError('There was an error accepting the Terms of Service. Please try again.');
      throw error;
    }
  };

  const handleDeclineTos = () => {
    // If user declines, we can either:
    // 1. Log them out
    // 2. Show a message explaining they must accept to continue
    // For now, we'll keep the modal open (they must accept to use the service)
    setTosError('You must accept the Terms of Service to continue.');
  };

  // Show loading state while checking TOS
  if (isCheckingTos) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-700 font-medium">{loadingMessage}</p>
          <p className="text-gray-500 text-sm mt-2">Please wait...</p>
        </div>
      </div>
    );
  }

  // A verification outage must not expose the protected application or offer
  // an acceptance form whose server state could not be established.
  if (tosError && !showTosModal) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-slate-50 px-4">
        <section
          role="alert"
          className="w-full max-w-md rounded-xl border border-red-200 bg-white p-6 text-center shadow-sm"
        >
          <h1 className="text-xl font-semibold text-gray-900">Account verification unavailable</h1>
          <p className="mt-2 text-sm text-gray-700">{tosError}</p>
          <button
            type="button"
            onClick={() => window.location.reload()}
            className="mt-5 rounded-lg bg-blue-600 px-5 py-2 font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2"
          >
            Retry verification
          </button>
        </section>
      </main>
    );
  }

  // If TOS not accepted, show modal (blocking)
  if (showTosModal) {
    return (
      <>
        {tosError && (
          <div role="alert" aria-live="assertive" className="fixed left-1/2 top-4 z-[110] w-[calc(100%-2rem)] max-w-xl -translate-x-1/2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800 shadow-lg">
            {tosError}
          </div>
        )}
        {/* Show TOS modal on top */}
        <TermsOfServiceModal
          isOpen={true}
          onAccept={handleAcceptTos}
          onDecline={handleDeclineTos}
          userName={user?.name || user?.email}
        />
      </>
    );
  }

  // TOS accepted, render children normally
  return <>{children}</>;
};

export default TOSGuard;
