/**
 * Google Analytics utility functions
 * Provides helper methods for tracking page views and events
 */

/**
 * Track a page view in Google Analytics
 * @param {string} path - The page path (e.g., '/dashboard', '/editor/123')
 * @param {string} title - The page title (optional)
 */
export const trackPageView = (path, title) => {
  // Check if gtag is available (it's loaded from the script in index.html)
  if (typeof window.gtag === 'function') {
    window.gtag('config', 'G-LZE32YYQ9P', {
      page_path: path,
      page_title: title || document.title,
    });
  }
};

/**
 * Track a custom event in Google Analytics
 * @param {string} eventName - The name of the event
 * @param {object} eventParams - Additional parameters for the event
 */
export const trackEvent = (eventName, eventParams = {}) => {
  if (typeof window.gtag === 'function') {
    window.gtag('event', eventName, eventParams);
  }
};

/**
 * Track a custom exception/error
 * @param {string} description - Description of the error
 * @param {boolean} fatal - Whether the error was fatal
 */
export const trackException = (description, fatal = false) => {
  if (typeof window.gtag === 'function') {
    window.gtag('event', 'exception', {
      description,
      fatal,
    });
  }
};
