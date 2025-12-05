// Skip Google Analytics during pre-rendering (react-snap, SSR, etc.)
// The navigator.userAgent check detects pre-rendering bots
if (typeof window !== 'undefined' && !/ReactSnap|Prerender|HeadlessChrome/.test(navigator.userAgent)) {
  // Initialize dataLayer and gtag function
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}

  // Debug logging helper
  function debugLog(message, data) {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.log('[GA Debug]', message, data || '');
    }
  }

  // Wait for the gtag.js library to fully load before initializing
  // This prevents race conditions where gtag() is called before the library is ready
  (function initializeGoogleAnalytics() {
    const maxAttempts = 50; // Try for up to 5 seconds (50 * 100ms)
    let attempts = 0;

    function tryInitialize() {
      attempts++;

      // Check if the gtag.js library has loaded by checking for the gtag command queue processor
      if (window.google_tag_manager || (window.dataLayer && window.dataLayer.push !== Array.prototype.push)) {
        debugLog('Google Analytics library loaded, initializing...', {
          hostname: window.location.hostname,
          attempts: attempts
        });

        // Initialize Google Analytics
        gtag('js', new Date());
        gtag('config', 'G-LZE32YYQ9P', {
          'debug_mode': window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        });

        debugLog('Google Analytics initialized successfully', {
          measurementId: 'G-LZE32YYQ9P',
          environment: window.location.hostname === 'localhost' ? 'development' : 'production'
        });
      } else if (attempts < maxAttempts) {
        // Library not ready yet, try again
        debugLog('Waiting for Google Analytics library...', { attempt: attempts });
        setTimeout(tryInitialize, 100);
      } else {
        // Failed to load after max attempts
        console.error('[GA Error] Google Analytics library failed to load after', attempts, 'attempts');
        console.error('[GA Error] Please check:');
        console.error('  1. Network connectivity');
        console.error('  2. Ad blockers or privacy extensions');
        console.error('  3. Content Security Policy settings');
      }
    }

    // Start trying to initialize
    tryInitialize();
  })();
}
