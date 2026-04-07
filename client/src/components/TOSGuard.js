import React, { useState, useEffect, useRef } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import TermsOfServiceModal from './TermsOfServiceModal';
import { useAuthenticatedApi } from '../services/authService';
import { useTOS } from '../contexts/TOSContext';

/**
 * TOSGuard - Protects authenticated routes and ensures users have accepted Terms of Service
 * Shows TOS modal for new users who haven't accepted yet
 * NOTE: This component should ONLY wrap authenticated routes (/dashboard, /editor/*)
 * Public routes like the landing page should NOT be wrapped with TOSGuard
 */
const TOSGuard = ({ children }) => {
  const { isAuthenticated, isLoading, user, loginWithRedirect, error: authError } = useAuth0();
  const { makeAuthenticatedRequest } = useAuthenticatedApi();
  const { markTosVerified } = useTOS();
  const [, setTosStatus] = useState(null);
  const [showTosModal, setShowTosModal] = useState(false);
  const [isCheckingTos, setIsCheckingTos] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Initializing...');
  const [authStartTime] = useState(Date.now());
  const redirectingRef = useRef(false);

  useEffect(() => {
    const checkTosStatus = async () => {
      const elapsedTime = Date.now() - authStartTime;

      // Wait for auth to finish loading
      if (isLoading) {
        console.log('[TOSGuard] Waiting for auth to finish loading...');
        setLoadingMessage('Checking authentication...');

        // Timeout after 10 seconds of waiting for Auth0
        if (elapsedTime > 10000) {
          console.error('[TOSGuard] Auth0 loading timeout - forcing check anyway');
          setLoadingMessage('Authentication check taking longer than expected...');
          // Don't return - continue to check even if isLoading is stuck
        } else {
          return;
        }
      }

      // If Auth0 returned an error (e.g. callback failed), don't loop — show it
      if (authError) {
        console.error('[TOSGuard] Auth0 error:', authError.message);
        setLoadingMessage(`Login error: ${authError.message}. Please try refreshing.`);
        setIsCheckingTos(false);
        return;
      }

      // If not authenticated, redirect to login (since TOSGuard only wraps protected routes)
      if (!isAuthenticated) {
        // Guard: if Auth0 callback is still being processed (code/state in URL),
        // don't redirect — Auth0Provider hasn't finished exchanging the code yet
        const params = new URLSearchParams(window.location.search);
        if (params.has('code') && params.has('state')) {
          console.log('[TOSGuard] Auth0 callback in progress, waiting...');
          setLoadingMessage('Completing login...');
          return;
        }

        // Guard: prevent multiple simultaneous loginWithRedirect calls
        if (redirectingRef.current) {
          console.log('[TOSGuard] Login redirect already in progress, skipping');
          return;
        }

        console.log('[TOSGuard] User not authenticated on protected route, redirecting to login');
        setLoadingMessage('Redirecting to login...');
        redirectingRef.current = true;
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

          // After 8 seconds total, give up and allow access (fail-open for UX)
          if (elapsedTime > 8000) {
            console.error('[TOSGuard] Giving up after 8s - allowing access');
            setIsCheckingTos(false);
            return;
          }
        }

        // Keep checking - don't set isCheckingTos to false yet
        // The useEffect will re-run when user becomes available
        return;
      }

      console.log('[TOSGuard] Starting TOS status check for user:', user.sub);
      setLoadingMessage('Verifying account...');

      // Check if we've already verified TOS acceptance (try localStorage first, then sessionStorage)
      const tosAcceptedPersistent = localStorage.getItem(`tos_accepted_${user?.sub}`);
      const tosAcceptedThisSession = sessionStorage.getItem(`tos_accepted_${user?.sub}`);
      if (tosAcceptedPersistent === 'true' || tosAcceptedThisSession === 'true') {
        console.log('[TOSGuard] TOS already accepted (cached)');
        markTosVerified();
        setIsCheckingTos(false);
        return;
      }

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
            // Cache in both localStorage (persistent) and sessionStorage (backward compat)
            localStorage.setItem(`tos_accepted_${user?.sub}`, 'true');
            sessionStorage.setItem(`tos_accepted_${user?.sub}`, 'true');
            markTosVerified();
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

        // Don't show modal for transient auth errors during initialization
        if (error.message?.includes('not authenticated') ||
            error.message?.includes('login_required')) {
          console.log('[TOSGuard] Auth initialization error, will retry on next render');
        } else {
          // For all other errors, show the modal to be safe
          setShowTosModal(true);
        }
      } finally {
        setIsCheckingTos(false);
      }
    };

    checkTosStatus();
    // makeAuthenticatedRequest and loginWithRedirect are stable and should not trigger re-runs
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, isLoading, user?.sub, authError]);

  const handleAcceptTos = async (tosVersion, researchConsent = false) => {
    try {
      console.log('[TOSGuard] User accepting TOS:', { tosVersion, researchConsent, userId: user?.sub });
      const data = await makeAuthenticatedRequest('/api/auth/accept-tos', {
        method: 'POST',
        body: JSON.stringify({ tosVersion, researchConsent }),
      });
      console.log('[TOSGuard] TOS acceptance response:', data);

      if (data.success) {
        console.log('[TOSGuard] TOS acceptance successful, updating state and cache');
        setTosStatus({
          tosAccepted: true,
          tosVersionAccepted: tosVersion,
          tosAcceptedAt: new Date().toISOString(),
        });
        // Cache the acceptance in both localStorage (persistent) and sessionStorage
        if (user?.sub) {
          localStorage.setItem(`tos_accepted_${user.sub}`, 'true');
          sessionStorage.setItem(`tos_accepted_${user.sub}`, 'true');
          console.log('[TOSGuard] TOS acceptance cached in localStorage and sessionStorage');
        }
        markTosVerified();
        setShowTosModal(false);
        console.log('[TOSGuard] TOS modal closed, user can now access application');
      } else {
        throw new Error(data.error || 'Failed to accept TOS');
      }
    } catch (error) {
      console.error('[TOSGuard] Error accepting TOS:', error);
      alert('There was an error accepting the Terms of Service. Please try again.');
      throw error;
    }
  };

  const handleDeclineTos = () => {
    // If user declines, we can either:
    // 1. Log them out
    // 2. Show a message explaining they must accept to continue
    // For now, we'll keep the modal open (they must accept to use the service)
    alert('You must accept the Terms of Service to use Discover.Legal.');
  };

  // Show error state if Auth0 failed (prevents login loop)
  if (authError && !isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-blue-50 to-indigo-50">
        <div className="text-center max-w-md">
          <p className="text-red-600 font-medium mb-2">Authentication error</p>
          <p className="text-gray-600 text-sm mb-4">{authError.message}</p>
          <button
            onClick={() => { redirectingRef.current = false; loginWithRedirect(); }}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Try logging in again
          </button>
        </div>
      </div>
    );
  }

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

  // If TOS not accepted, show modal (blocking)
  if (showTosModal) {
    return (
      <>
        {/* Render children in background but blurred */}
        <div className="filter blur-sm pointer-events-none">
          {children}
        </div>

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
