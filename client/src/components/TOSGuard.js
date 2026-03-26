import React, { useState, useEffect } from 'react';
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

  useEffect(() => {
    const checkTosStatus = async () => {
      const elapsedTime = Date.now() - authStartTime;

      // Wait for auth to finish loading
      if (isLoading) {
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

      // If not authenticated, redirect to login (since TOSGuard only wraps protected routes)
      if (!isAuthenticated) {
        setLoadingMessage('Redirecting to login...');
        loginWithRedirect({
          appState: { returnTo: window.location.pathname }
        });
        return;
      }

      // Wait for user object to be available (with timeout)
      if (!user?.sub) {
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

      setLoadingMessage('Verifying account...');

      // SECURITY: Only use session-scoped cache (sessionStorage) to skip re-verification
      // within the same browser tab. localStorage was removed because users could manually
      // set the key to bypass TOS. The server is always checked on fresh page loads.
      const tosVerifiedThisSession = sessionStorage.getItem(`tos_verified_${user?.sub}`);
      if (tosVerifiedThisSession === 'true') {
        markTosVerified();
        setIsCheckingTos(false);
        return;
      }

      try {
        setLoadingMessage('Checking account status...');
        const data = await makeAuthenticatedRequest('/api/auth/tos-status');

        if (data.success) {
          setTosStatus(data);

          // Only cache if user has actually accepted TOS
          if (data.tosAccepted) {
            // Cache only in sessionStorage (tab-scoped) after server confirmation
            sessionStorage.setItem(`tos_verified_${user?.sub}`, 'true');
            markTosVerified();
          } else {
            // Show TOS modal if user hasn't accepted
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
          // Auth initialization error, will retry on next render
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
      const data = await makeAuthenticatedRequest('/api/auth/accept-tos', {
        method: 'POST',
        body: JSON.stringify({ tosVersion, researchConsent }),
      });

      if (data.success) {
        setTosStatus({
          tosAccepted: true,
          tosVersionAccepted: tosVersion,
          tosAcceptedAt: new Date().toISOString(),
        });
        // Cache in sessionStorage only (server verified the acceptance above)
        if (user?.sub) {
          sessionStorage.setItem(`tos_verified_${user.sub}`, 'true');
        }
        markTosVerified();
        setShowTosModal(false);
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
