import React, { useState, useEffect } from 'react';
import { useAuth0 } from '@auth0/auth0-react';
import TermsOfServiceModal from './TermsOfServiceModal';
import { authFetch } from '../services/authService';

/**
 * TOSGuard - Protects routes and ensures users have accepted Terms of Service
 * Shows TOS modal for new users who haven't accepted yet
 */
const TOSGuard = ({ children }) => {
  const { isAuthenticated, isLoading, user } = useAuth0();
  const [tosStatus, setTosStatus] = useState(null);
  const [showTosModal, setShowTosModal] = useState(false);
  const [isCheckingTos, setIsCheckingTos] = useState(true);

  useEffect(() => {
    const checkTosStatus = async () => {
      // Only check if user is authenticated
      if (!isAuthenticated || isLoading) {
        setIsCheckingTos(false);
        return;
      }

      try {
        const response = await authFetch('/api/auth/tos-status');
        const data = await response.json();

        if (data.success) {
          setTosStatus(data);

          // Show TOS modal if user hasn't accepted
          if (!data.tosAccepted) {
            setShowTosModal(true);
          }
        }
      } catch (error) {
        console.error('Error checking TOS status:', error);
        // On error, default to showing TOS modal for safety
        setShowTosModal(true);
      } finally {
        setIsCheckingTos(false);
      }
    };

    checkTosStatus();
  }, [isAuthenticated, isLoading]);

  const handleAcceptTos = async (tosVersion) => {
    try {
      const response = await authFetch('/api/auth/accept-tos', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tosVersion }),
      });

      const data = await response.json();

      if (data.success) {
        setTosStatus({
          tosAccepted: true,
          tosVersionAccepted: tosVersion,
          tosAcceptedAt: new Date().toISOString(),
        });
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
    alert('You must accept the Terms of Service to use Affidavit Maker.');
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
