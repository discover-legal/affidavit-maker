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
        return;
      }

      // If not authenticated, no need to check TOS
      if (!isAuthenticated) {
        setIsCheckingTos(false);
        return;
      }

      // Wait for user object to be available
      if (!user?.sub) {
        setIsCheckingTos(false);
        return;
      }

      // Check if we've already verified TOS acceptance this session
      const tosAcceptedThisSession = sessionStorage.getItem(`tos_accepted_${user?.sub}`);
      if (tosAcceptedThisSession === 'true') {
        setIsCheckingTos(false);
        return;
      }

      try {
        const data = await makeAuthenticatedRequest('/api/auth/tos-status');

        if (data.success) {
          setTosStatus(data);

          // Only cache if user has actually accepted TOS
          if (data.tosAccepted) {
            sessionStorage.setItem(`tos_accepted_${user?.sub}`, 'true');
          } else {
            // Show TOS modal if user hasn't accepted
            setShowTosModal(true);
          }
        }
      } catch (error) {
        // Don't log authentication errors - they're expected during auth state transitions
        if (!error.message?.includes('not authenticated')) {
          console.error('Error checking TOS status:', error);
        }
        // On error, don't show modal - allow user to continue
        // They'll see it next time they log in
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
        // Cache the acceptance in sessionStorage
        if (user?.sub) {
          sessionStorage.setItem(`tos_accepted_${user.sub}`, 'true');
        }
        setShowTosModal(false);
      } else {
        throw new Error(data.error || 'Failed to accept TOS');
      }
    } catch (error) {
      console.error('Error accepting TOS:', error);
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
