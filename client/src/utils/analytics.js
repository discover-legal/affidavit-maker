/**
 * Google Analytics utility functions
 * Provides helper methods for tracking page views and events
 */

const GA_MEASUREMENT_ID = 'G-LZE32YYQ9P';

/**
 * Check if we're in development environment
 */
const isDevelopment = () => {
  return (
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.hostname === '' ||
    process.env.NODE_ENV === 'development'
  );
};

/**
 * Debug logging helper - only logs in development
 */
const debugLog = () => {};

/**
 * Check if gtag is available and log warnings if not
 */
const isGtagAvailable = () => {
  const available = typeof window.gtag === 'function';

  if (!available) {
    console.warn('[GA Warning] gtag is not available. Analytics tracking will not work.');
    console.warn('[GA Warning] Possible causes:');
    console.warn('  1. Google Analytics script blocked by ad blocker');
    console.warn('  2. Script failed to load due to network issues');
    console.warn('  3. Content Security Policy blocking the script');

    // Check if dataLayer exists but gtag doesn't
    if (window.dataLayer) {
      console.warn('[GA Warning] dataLayer exists but gtag function is missing');
    }
  }

  return available;
};

/**
 * Track a page view in Google Analytics
 * @param {string} path - The page path (e.g., '/dashboard', '/editor/123')
 * @param {string} title - The page title (optional)
 */
export const trackPageView = (path, title) => {
  if (!isGtagAvailable()) {
    return;
  }

  try {
    const pageTitle = title || document.title;

    debugLog('Tracking page view', {
      path,
      title: pageTitle,
      environment: isDevelopment() ? 'development' : 'production'
    });

    window.gtag('config', GA_MEASUREMENT_ID, {
      page_path: path,
      page_title: pageTitle,
    });

    debugLog('Page view tracked successfully');
  } catch (error) {
    console.error('[GA Error] Failed to track page view:', error);
    console.error('[GA Error] Path:', path);
  }
};

/**
 * Track a custom event in Google Analytics
 * @param {string} eventName - The name of the event
 * @param {object} eventParams - Additional parameters for the event
 */
export const trackEvent = (eventName, eventParams = {}) => {
  if (!isGtagAvailable()) {
    return;
  }

  try {
    debugLog('Tracking event', {
      eventName,
      params: eventParams,
      environment: isDevelopment() ? 'development' : 'production'
    });

    window.gtag('event', eventName, eventParams);

    debugLog('Event tracked successfully');
  } catch (error) {
    console.error('[GA Error] Failed to track event:', error);
    console.error('[GA Error] Event name:', eventName);
    console.error('[GA Error] Event params:', eventParams);
  }
};

/**
 * Track a custom exception/error
 * @param {string} description - Description of the error
 * @param {boolean} fatal - Whether the error was fatal
 */
export const trackException = (description, fatal = false) => {
  if (!isGtagAvailable()) {
    return;
  }

  try {
    debugLog('Tracking exception', {
      description,
      fatal,
      environment: isDevelopment() ? 'development' : 'production'
    });

    window.gtag('event', 'exception', {
      description,
      fatal,
    });

    debugLog('Exception tracked successfully');
  } catch (error) {
    console.error('[GA Error] Failed to track exception:', error);
    console.error('[GA Error] Exception description:', description);
  }
};

/**
 * Get the current GA status for debugging
 */
export const getAnalyticsStatus = () => {
  const status = {
    gtagAvailable: typeof window.gtag === 'function',
    dataLayerExists: !!window.dataLayer,
    dataLayerLength: window.dataLayer?.length || 0,
    environment: isDevelopment() ? 'development' : 'production',
    hostname: window.location.hostname,
    measurementId: GA_MEASUREMENT_ID
  };

  return status;
};
