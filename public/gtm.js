// Skip Google Analytics during pre-rendering (react-snap, SSR, etc.) so the snapshotted
// HTML doesn't include GA state and prerender doesn't double-count pageviews.
if (typeof window !== 'undefined' && !/ReactSnap|Prerender|HeadlessChrome/.test(navigator.userAgent)) {
  window.dataLayer = window.dataLayer || [];
  function gtag(){dataLayer.push(arguments);}

  (function initializeGoogleAnalytics() {
    const maxAttempts = 50;
    let attempts = 0;

    function tryInitialize() {
      attempts++;

      if (window.google_tag_manager || (window.dataLayer && window.dataLayer.push !== Array.prototype.push)) {
        gtag('js', new Date());
        gtag('config', 'G-LZE32YYQ9P', {
          'debug_mode': window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
        });
      } else if (attempts < maxAttempts) {
        setTimeout(tryInitialize, 100);
      }
    }

    tryInitialize();
  })();
}
