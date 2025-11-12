// client/src/services/authService.js
import { useAuth0 } from '@auth0/auth0-react';
import { useCallback } from 'react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';

// Custom hook for authenticated API calls
export const useAuthenticatedApi = () => {
  const { getAccessTokenSilently, loginWithRedirect, isAuthenticated } = useAuth0();

  // Memoize the request function with stable dependencies
  // isAuthenticated is read from closure at runtime, not needed as dependency
  // to avoid unnecessary re-creation when auth state changes
  const makeAuthenticatedRequest = useCallback(async (url, options = {}) => {
    if (!isAuthenticated) {
      throw new Error('User not authenticated');
    }

    try {
      const token = await getAccessTokenSilently({
        audience: process.env.REACT_APP_AUTH0_AUDIENCE,
        scope: 'openid profile email'
      });

      const response = await fetch(`${API_BASE}${url}`, {
        ...options,
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`,
          ...options.headers
        }
      });

      if (response.status === 401) {
        // Token expired or invalid, redirect to login
        loginWithRedirect();
        throw new Error('Authentication required');
      }

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
      }

      return await response.json();
    } catch (error) {
      if (error.error === 'login_required') {
        loginWithRedirect();
      }
      throw error;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [getAccessTokenSilently, loginWithRedirect]);

  return { makeAuthenticatedRequest };
};

// Error boundary for Auth0 errors
export const handleAuthError = (error, loginWithRedirect) => {
  console.error('Auth error:', error);
  
  if (error.error === 'login_required' || 
      error.error === 'consent_required' || 
      error.message?.includes('login_required')) {
    loginWithRedirect();
    return;
  }
  
  // Handle other auth errors
  if (error.error_description) {
    console.error('Auth0 Error:', error.error_description);
  }
};