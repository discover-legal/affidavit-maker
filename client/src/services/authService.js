// client/src/services/authService.js
import { useAuth0 } from '@auth0/auth0-react';
import { useCallback } from 'react';

// Use relative URLs in production (empty string), localhost in development
const API_BASE = process.env.REACT_APP_API_URL !== undefined
  ? process.env.REACT_APP_API_URL
  : 'http://localhost:3001';

// Custom hook for authenticated API calls
export const useAuthenticatedApi = () => {
  const { getAccessTokenSilently, loginWithRedirect } = useAuth0();

  // Memoize the request function with current auth state
  const makeAuthenticatedRequest = useCallback(async (url, options = {}) => {
    // Note: We skip the isAuthenticated check here because Auth0 state updates
    // can lag behind the actual authentication. Instead, we rely on
    // getAccessTokenSilently to fail if the user isn't actually authenticated.
    // This prevents race conditions during the auth initialization flow.

    const makeRequest = async (retryCount = 0) => {
      try {
        // Add timeout to token retrieval with retry logic
        const tokenPromise = getAccessTokenSilently({
          audience: process.env.REACT_APP_AUTH0_AUDIENCE,
          scope: 'openid profile email',
          timeoutInSeconds: 10 // 10 second timeout for token retrieval
        });

        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Token retrieval timeout')), 12000);
        });

        const token = await Promise.race([tokenPromise, timeoutPromise]);

        const response = await fetch(`${API_BASE}${url}`, {
          ...options,
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`,
            ...options.headers
          }
        });

        if (response.status === 401) {
          // Token expired or invalid — only redirect if this isn't the first attempt
          // (first attempt may fail during Auth0 initialization before tokens are ready)
          if (retryCount > 0) {
            loginWithRedirect();
          }
          throw new Error('Authentication required');
        }

        if (!response.ok) {
          const errorData = await response.json().catch(() => ({}));
          throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
        }

        return await response.json();
      } catch (error) {
        // Retry once if token retrieval times out, fails, or returns 401 on first attempt
        // (401 on first attempt can happen during Auth0 initialization)
        if (retryCount === 0 &&
            (error.message === 'Token retrieval timeout' ||
             error.message === 'Authentication required' ||
             error.error === 'timeout' ||
             error.message?.includes('timeout'))) {
          console.warn('[authService] Request failed, retrying...', error.message);
          await new Promise(resolve => setTimeout(resolve, 1000)); // Wait 1s before retry
          return makeRequest(1); // Retry once
        }

        if (error.error === 'login_required') {
          loginWithRedirect();
        }
        throw error;
      }
    };

    return makeRequest();
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