// client/src/hooks/useCountyValidation.js - React hook for county validation

import { useState, useCallback } from 'react';
import { useAuth0 } from '@auth0/auth0-react';

const API_BASE = process.env.REACT_APP_API_URL || 'http://localhost:3001';

export const useCountyValidation = () => {
  const { getAccessTokenSilently, isAuthenticated } = useAuth0();
  const [validationCache, setValidationCache] = useState(new Map());

  const validateCounty = useCallback(async (county, state) => {
    // Check cache first
    const cacheKey = `${state}_${county?.toLowerCase()?.trim()}`;
    if (validationCache.has(cacheKey)) {
      return validationCache.get(cacheKey);
    }

    if (!county || !state || county.trim() === '') {
      const emptyResult = {
        isValid: true,
        county: county,
        normalizedCounty: county,
        confidence: 1.0,
        source: 'empty_allowed',
        reasoning: 'Empty county is allowed'
      };
      
      setValidationCache(prev => new Map(prev.set(cacheKey, emptyResult)));
      return emptyResult;
    }

    try {
      let headers = { 'Content-Type': 'application/json' };
      
      if (isAuthenticated) {
        try {
          const token = await getAccessTokenSilently({
            authorizationParams: { audience: process.env.REACT_APP_AUTH0_AUDIENCE }
          });
          headers['Authorization'] = `Bearer ${token}`;
        } catch (authError) {
          console.warn('Auth failed for county validation, continuing without auth');
        }
      }

      const response = await fetch(`${API_BASE}/api/validate/county`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ 
          county: county.trim(), 
          state: state 
        })
      });

      const data = await response.json();
      
      if (data.success) {
        // Cache the result
        setValidationCache(prev => new Map(prev.set(cacheKey, data.validation)));
        return data.validation;
      } else {
        throw new Error(data.error || 'Validation failed');
      }
    } catch (error) {
      console.error('County validation error:', error);
      
      const errorResult = {
        isValid: false,
        county: county,
        normalizedCounty: county,
        confidence: 0.5,
        reasoning: 'Unable to validate county - service unavailable',
        source: 'error',
        error: error.message
      };
      
      return errorResult;
    }
  }, [isAuthenticated, getAccessTokenSilently, validationCache]);

  const getCountiesForState = useCallback(async (state) => {
    if (!['TX', 'UT', 'AZ'].includes(state)) {
      return [];
    }

    try {
      const response = await fetch(`${API_BASE}/api/counties/${state}`);
      const data = await response.json();
      
      if (data.success) {
        return data.counties;
      } else {
        console.error('Failed to load counties:', data.error);
        return [];
      }
    } catch (error) {
      console.error('Error loading counties:', error);
      return [];
    }
  }, []);

  const validateMultipleCounties = useCallback(async (counties, state) => {
    if (!Array.isArray(counties) || counties.length === 0) {
      return [];
    }

    try {
      let headers = { 'Content-Type': 'application/json' };
      
      if (isAuthenticated) {
        try {
          const token = await getAccessTokenSilently({
            authorizationParams: { audience: process.env.REACT_APP_AUTH0_AUDIENCE }
          });
          headers['Authorization'] = `Bearer ${token}`;
        } catch (authError) {
          console.warn('Auth failed for batch county validation');
        }
      }

      const response = await fetch(`${API_BASE}/api/validate/counties/batch`, {
        method: 'POST',
        headers,
        body: JSON.stringify({ 
          counties: counties.slice(0, 10), // Limit to 10
          state: state 
        })
      });

      const data = await response.json();
      
      if (data.success) {
        // Cache all results
        data.validations.forEach(validation => {
          const cacheKey = `${state}_${validation.county?.toLowerCase()?.trim()}`;
          setValidationCache(prev => new Map(prev.set(cacheKey, validation)));
        });
        
        return data.validations;
      } else {
        throw new Error(data.error || 'Batch validation failed');
      }
    } catch (error) {
      console.error('Batch county validation error:', error);
      return counties.map(county => ({
        county,
        isValid: false,
        confidence: 0.5,
        reasoning: 'Batch validation failed',
        source: 'error'
      }));
    }
  }, [isAuthenticated, getAccessTokenSilently]);

  // Clear cache when it gets too large
  const clearCache = useCallback(() => {
    setValidationCache(new Map());
  }, []);

  return {
    validateCounty,
    getCountiesForState,
    validateMultipleCounties,
    clearCache,
    cacheSize: validationCache.size
  };
};