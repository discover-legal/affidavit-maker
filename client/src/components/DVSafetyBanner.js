import React, { useState, useEffect } from 'react';
import { X, AlertTriangle } from 'lucide-react';

const DISMISS_KEY = 'dv_safety_banner_dismissed';

/**
 * DV hotline directory keyed by country code.
 * Each entry has a display name, raw number (for tel: href), and formatted display string.
 */
const DV_HOTLINES = {
  US: { name: 'National Domestic Violence Hotline', number: '1-800-799-7233', display: '1-800-799-7233' },
  CA: { name: 'Assaulted Women\'s Helpline', number: '1-866-863-0511', display: '1-866-863-0511' },
  UK: { name: 'National Domestic Abuse Helpline', number: '0808-2000-247', display: '0808 2000 247' },
  IE: { name: 'Women\'s Aid', number: '1800-341-900', display: '1800 341 900' },
  AU: { name: '1800RESPECT', number: '1800-737-732', display: '1800 737 732' },
  NZ: { name: 'Women\'s Refuge', number: '0800-733-843', display: '0800 733 843' },
  SG: { name: 'AWARE Helpline', number: '1800-774-5935', display: '1800 774 5935' },
  HK: { name: 'Harmony House', number: '2522-0434', display: '2522 0434' },
  ZA: { name: 'GBV Command Centre', number: '0800-428-428', display: '0800 428 428' },
  KE: { name: 'FIDA Kenya', number: '0800-720-990', display: '0800 720 990' },
  GH: { name: 'DOVVSU', number: '055-1000-900', display: '055 1000 900' },
  NG: { name: 'NAPTIP Helpline', number: '0800-7273-2255', display: '0800 7273 2255' },
  IN: { name: 'Women Helpline', number: '181', display: '181' },
};

/**
 * Maps a jurisdiction code (state/province/territory) to its country code.
 * Mirrors the backend JURISDICTION_COUNTRY map in routes/chat.js.
 * Falls back to 'US' when the jurisdiction is unrecognized.
 */
function getCountryFromJurisdiction(jurisdiction) {
  if (!jurisdiction) return 'US';

  const code = jurisdiction.toUpperCase();

  // Canadian provinces and territories
  const CA_CODES = new Set([
    'ON', 'BC', 'AB', 'QC', 'MB', 'NB', 'NL', 'NS', 'PE', 'SK', 'NT', 'YT', 'NU',
  ]);
  if (CA_CODES.has(code)) return 'CA';

  // UK
  if (['ENG', 'SCO', 'NIR'].includes(code)) return 'UK';

  // Ireland
  if (code === 'IRL') return 'IE';

  // Australia (some use _AU suffix to avoid collision with US WA, CA NT)
  const AU_CODES = new Set(['NSW', 'VIC', 'QLD', 'WA_AU', 'SA_AU', 'TAS', 'ACT', 'NT_AU']);
  if (AU_CODES.has(code)) return 'AU';

  // New Zealand
  if (code === 'NZ') return 'NZ';

  // India (IN_ prefix)
  if (code.startsWith('IN_')) return 'IN';

  // Nigeria (suffixed codes)
  const NG_CODES = new Set(['LA_NG', 'FC', 'RV', 'CR', 'ED', 'DT', 'OY', 'OG', 'AN', 'EN', 'IM', 'AB_NG']);
  if (NG_CODES.has(code)) return 'NG';

  // Direct single-code matches
  const DIRECT = {
    ZA: 'ZA', KE: 'KE', GH: 'GH', SG: 'SG', HK: 'HK',
  };
  if (DIRECT[code]) return DIRECT[code];

  // Default: US (covers all 50 US states + DC)
  return 'US';
}

// NOTE: To pass the jurisdiction to this component, the parent (EditorView.js)
// should thread `currentDocument.state` as a `jurisdiction` prop on <DVSafetyBanner>.
// Example change needed in EditorView.js (NOT done here per instructions):
//   <DVSafetyBanner
//     documentType={currentDocument.documentType}
//     matterTypeCode={currentDocument.matterTypeCode}
//     jurisdiction={currentDocument.state}
//   />

const DVSafetyBanner = ({ documentType, matterTypeCode, jurisdiction }) => {
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    try {
      if (sessionStorage.getItem(DISMISS_KEY) === 'true') {
        setDismissed(true);
      }
    } catch (_) {
      // Ignore storage errors
    }
  }, []);

  const isDVRO =
    documentType === 'dvro' ||
    matterTypeCode === 'dvro' ||
    matterTypeCode === 'domestic_violence' ||
    (typeof documentType === 'string' && documentType.includes('dvro'));

  if (!isDVRO || dismissed) {
    return null;
  }

  const handleDismiss = () => {
    setDismissed(true);
    try {
      sessionStorage.setItem(DISMISS_KEY, 'true');
    } catch (_) {
      // Ignore storage errors
    }
  };

  const country = getCountryFromJurisdiction(jurisdiction);
  const hotline = DV_HOTLINES[country] || DV_HOTLINES.US;

  return (
    <div
      role="alert"
      className="bg-amber-50 border border-amber-300 rounded-lg px-4 py-3 mx-4 mt-3 flex items-start gap-3"
    >
      <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" aria-hidden="true" />
      <p className="text-sm text-amber-900 flex-1">
        <span className="font-semibold">Safety Notice:</span> If you are in immediate danger, call emergency services.
        If you are on a shared device, consider using a trusted friend&#39;s device or a public computer.
        Your browsing history may show visits to this site.
        {' '}{hotline.name}:{' '}
        <a
          href={`tel:${hotline.number}`}
          className="font-semibold underline hover:text-amber-700"
          aria-label={`Call ${hotline.name} at ${hotline.display}`}
        >
          {hotline.display}
        </a>.
      </p>
      <button
        onClick={handleDismiss}
        aria-label="Dismiss safety notice"
        className="flex-shrink-0 p-1 text-amber-600 hover:text-amber-800 rounded hover:bg-amber-100 transition-colors"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
};

export default DVSafetyBanner;
