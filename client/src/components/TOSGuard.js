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
  const { isAuthenticated, isLoading, user, loginWithRedirect } = useAuth0();
  const { makeAuthenticatedRequest } = useAuthenticatedApi();
  const { markTosVerified } = useTOS();
  const [, setTosStatus] = useState(null);
  const [showTosModal, setShowTosModal] = useState(false);
  const [isCheckingTos, setIsCheckingTos] = useState(true);
  const [loadingMessage, setLoadingMessage] = useState('Initializing...');
  const [authStartTime] = useState(Date.now());
  const isRedirecting = useRef(false);

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
        if (isRedirecting.current) {
          return; // Already redirecting, don't call loginWithRedirect again
        }
        console.log('[TOSGuard] User not authenticated on protected route, redirecting to login');
        setLoadingMessage('Redirecting to login...');
        isRedirecting.current = true;
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
  }, [isAuthenticated, isLoading, user?.sub]);

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
