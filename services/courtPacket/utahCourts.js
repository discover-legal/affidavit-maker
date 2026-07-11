// services/courtPacket/utahCourts.js
/**
 * Utah district-court lookup for the filing-packet cover sheet.
 *
 * Utah's trial courts of general jurisdiction are the District Courts,
 * organized into eight judicial districts covering all 29 counties.
 *
 * SOURCE: county → judicial-district membership is stable public data,
 * codified at Utah Code § 78A-1-102 ("Judicial districts") and listed on
 * the Utah State Courts site (https://www.utcourts.gov). Encoded here
 * as of 2026-07-11.
 *
 * STREET ADDRESSES: deliberately NOT included. Courthouse addresses could
 * not be fetched from utcourts.gov in this environment (outbound egress to
 * www.utcourts.gov is blocked by policy), and fabricating an address on a
 * court document would be worse than omitting it. Instead every lookup
 * returns `locatorUrl` pointing at the official court-locations page, and
 * the cover sheet renders "Find the address and hours: <locatorUrl>".
 * If addresses are added later, populate `addressLines` per county and
 * lookupCourt will pass them through unchanged.
 */

const LOCATOR_URL = 'https://www.utcourts.gov/en/locations.html';

// Ordinal names for districts 1–8 (Utah has exactly eight).
const DISTRICT_ORDINALS = [
  'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth',
];

/**
 * All 29 Utah counties → judicial district number.
 * Utah Code § 78A-1-102.
 */
const COUNTY_TO_DISTRICT = {
  // First District
  'box elder': 1,
  'cache': 1,
  'rich': 1,
  // Second District
  'davis': 2,
  'morgan': 2,
  'weber': 2,
  // Third District
  'salt lake': 3,
  'summit': 3,
  'tooele': 3,
  // Fourth District
  'juab': 4,
  'millard': 4,
  'utah': 4,
  'wasatch': 4,
  // Fifth District
  'beaver': 5,
  'iron': 5,
  'washington': 5,
  // Sixth District
  'garfield': 6,
  'kane': 6,
  'piute': 6,
  'sanpete': 6,
  'sevier': 6,
  'wayne': 6,
  // Seventh District
  'carbon': 7,
  'emery': 7,
  'grand': 7,
  'san juan': 7,
  // Eighth District
  'daggett': 8,
  'duchesne': 8,
  'uintah': 8,
};

/**
 * Normalize a user-supplied county string for lookup: trim, lowercase,
 * collapse whitespace, and strip a trailing "county".
 */
function normalizeCounty(county) {
  if (typeof county !== 'string') return '';
  return county
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/\s+county$/i, '')
    .trim();
}

/** Title-case a normalized county name ("salt lake" → "Salt Lake"). */
function displayCounty(normalized) {
  return normalized.replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Look up the Utah district court for a county.
 *
 * @param {string} county - County name ("Salt Lake", "salt lake county", …)
 * @returns {{ district: number, courtName: string, county: string,
 *             addressLines?: string[], locatorUrl: string } | null}
 *          null when the county is not a recognized Utah county.
 */
function lookupCourt(county) {
  const key = normalizeCounty(county);
  const district = COUNTY_TO_DISTRICT[key];
  if (!district) return null;

  const name = displayCounty(key);
  const result = {
    district,
    county: name,
    courtName: `${DISTRICT_ORDINALS[district - 1]} District Court — ${name} County`,
    locatorUrl: LOCATOR_URL,
  };
  // addressLines intentionally absent — see the header comment. Callers must
  // fall back to `locatorUrl` when the field is missing.
  return result;
}

module.exports = {
  lookupCourt,
  normalizeCounty,
  COUNTY_TO_DISTRICT,
  LOCATOR_URL,
};
