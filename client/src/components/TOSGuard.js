import React, { useState, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import TermsOfServiceModal from './TermsOfServiceModal';
import { useAuthenticatedApi } from '../services/authService';

/**
 * TOSGuard - Protects routes and ensures users have accepted Terms of Service
 * Shows TOS modal for new users who haven't accepted yet
 */
const TOSGuard = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth0();
  const { makeAuthenticatedRequest } = useAuthenticatedApi();
  const [, setTosStatus] = useState(null);
  const [showTosModal, setShowTosModal] = useState(false);
  const [isCheckingTos, setIsCheckingTos] = useState(true);

  useEffect(() => {
    const checkTosStatus = async () => {
      // Wait for auth to finish loading
      if (isLoading) {
        console.log('[TOSGuard] Waiting for auth to finish loading...');
        // Keep isCheckingTos true while loading
        return;
      }

      // If not authenticated, no need to check TOS
      if (!isAuthenticated) {
        console.log('[TOSGuard] User not authenticated, skipping TOS check');
        setIsCheckingTos(false);
        return;
      }

      // Wait for user object to be available
      if (!user?.sub) {
        console.log('[TOSGuard] User object not available yet, waiting...');
        // Keep checking - don't set isCheckingTos to false yet
        // The useEffect will re-run when user becomes available
        return;
      }

      console.log('[TOSGuard] Starting TOS status check for user:', user.sub);

      // Check if we've already verified TOS acceptance this session
      const tosAcceptedThisSession = sessionStorage.getItem(`tos_accepted_${user?.sub}`);
      if (tosAcceptedThisSession === 'true') {
        console.log('[TOSGuard] TOS already accepted this session (cached)');
        setIsCheckingTos(false);
        return;
      }

      try {
        console.log('[TOSGuard] Calling API: /api/auth/tos-status');
        const data = await makeAuthenticatedRequest('/api/auth/tos-status');
        console.log('[TOSGuard] API response:', data);

        if (data.success) {
          setTosStatus(data);

          // Only cache if user has actually accepted TOS
          if (data.tosAccepted) {
            console.log('[TOSGuard] User has accepted TOS, caching acceptance');
            sessionStorage.setItem(`tos_accepted_${user?.sub}`, 'true');
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
    // makeAuthenticatedRequest is stable and should not trigger re-runs
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
        // Cache the acceptance in sessionStorage
        if (user?.sub) {
          sessionStorage.setItem(`tos_accepted_${user.sub}`, 'true');
          console.log('[TOSGuard] TOS acceptance cached in sessionStorage');
        }
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>
          <p className="text-gray-600">Loading...</p>
        </div>
      </div>
    );
  }

  // If not authenticated, just render children (landing page, etc.)
  if (!isAuthenticated) {
    return <>{children}</>;
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
