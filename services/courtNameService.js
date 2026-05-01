// services/courtNameService.js - Court Name Formatting Service
const logger = require('../utils/logger');

class CourtNameService {
  constructor() {
    // Texas District Court mappings for major counties
    this.texasDistrictMapping = {
      'Travis': ['53rd', '126th', '200th', '201st', '250th', '345th', '419th', '459th'],
      'Dallas': ['255th', '256th', '257th', '258th', '301st', '302nd', '303rd', '304th', '305th', '330th'],
      'Harris': ['245th', '246th', '247th', '257th', '280th', '308th', '309th', '310th', '311th', '312th', '313th', '314th', '315th'],
      'Bexar': ['57th', '73rd', '131st', '224th', '225th', '226th', '285th', '288th', '289th', '290th'],
      'Tarrant': ['231st', '323rd', '324th', '325th', '348th', '352nd', '360th', '393rd'],
      'Collin': ['199th', '296th', '366th', '380th', '401st', '417th', '429th', '470th'],
      'Denton': ['211th', '362nd', '431st', '442nd'],
      'El Paso': ['34th', '41st', '65th', '120th', '171st', '205th', '243rd', '327th', '384th', '388th', '409th', '448th'],
      'Fort Bend': ['240th', '268th', '328th', '400th', '434th', '458th', '505th'],
      'Hidalgo': ['92nd', '93rd', '139th', '206th', '275th', '332nd', '370th', '389th', '398th', '430th', '449th'],
      'Montgomery': ['9th', '221st', '284th', '359th', '410th', '435th', '457th', '506th'],
      'Williamson': ['26th', '277th', '368th', '395th', '425th'],
    };

    // Utah Judicial District mappings
    this.utahDistrictMapping = {
      'Box Elder': 'First',
      'Cache': 'First',
      'Rich': 'First',
      'Davis': 'Second',
      'Morgan': 'Second',
      'Weber': 'Second',
      'Salt Lake': 'Third',
      'Tooele': 'Third',
      'Utah': 'Fourth',
      'Juab': 'Fourth',
      'Millard': 'Fourth',
      'Wasatch': 'Fourth',
      'Beaver': 'Fifth',
      'Iron': 'Fifth',
      'Washington': 'Fifth',
      'Kane': 'Sixth',
      'Garfield': 'Sixth',
      'Piute': 'Sixth',
      'Sevier': 'Sixth',
      'Wayne': 'Sixth',
      'Carbon': 'Seventh',
      'Emery': 'Seventh',
      'Grand': 'Seventh',
      'San Juan': 'Seventh',
      'Daggett': 'Eighth',
      'Duchesne': 'Eighth',
      'Uintah': 'Eighth'
    };

    // Arizona counties (all use Superior Court)
    this.arizonaCounties = [
      'Apache', 'Cochise', 'Coconino', 'Gila', 'Graham', 'Greenlee',
      'La Paz', 'Maricopa', 'Mohave', 'Navajo', 'Pima', 'Pinal',
      'Santa Cruz', 'Yavapai', 'Yuma'
    ];
  }

  /**
   * Get default court name format for a state/county
   * @param {string} state - State code (e.g., TX, UT, AZ, ENG, IN_DL)
   * @param {string} county - County name (may be null for international)
   * @param {string} judicialDistrict - Optional specific district number
   * @param {Object} metadata - Optional jurisdiction metadata with courtSystem
   * @returns {string|null} Formatted court name
   */
  getDefaultCourtName(state, county, judicialDistrict = null, metadata = null) {
    // 1. Check metadata first (works for all 110 jurisdictions)
    if (metadata?.courtSystem) {
      return this.getCourtFromMetadata(state, county, metadata);
    }

    if (!state || !county) return null;

    // 2. Fall back to existing hardcoded TX/UT/AZ logic
    switch (state.toUpperCase()) {
      case 'TX':
        return this.getTexasCourtName(county, judicialDistrict);
      case 'UT':
        return this.getUtahCourtName(county, judicialDistrict);
      case 'AZ':
        return this.getArizonaCourtName(county);
      default:
        logger.warn('Unknown state for court name and no metadata provided', { state });
        return null;
    }
  }

  /**
   * Determine whether a jurisdiction code represents a US state (or DC)
   * US codes are exactly 2 uppercase letters (e.g., TX, CA, DC).
   * International codes contain underscores or are 3+ characters (e.g., ENG, IN_DL, LA_NG).
   * @param {string} stateCode - Jurisdiction code
   * @returns {boolean}
   */
  isUSJurisdiction(stateCode) {
    if (!stateCode) return false;
    return /^[A-Z]{2}$/.test(stateCode.toUpperCase());
  }

  /**
   * Build a court name from metadata.json courtSystem data.
   * Prefers familyDivision (family law context) over trialCourt.
   * For US states appends ", {County} County"; for international returns court name as-is.
   * @param {string} stateCode - Jurisdiction code
   * @param {string} county - County name (may be null/undefined for international)
   * @param {Object} metadata - Jurisdiction metadata containing courtSystem
   * @returns {string} Formatted court name
   */
  getCourtFromMetadata(stateCode, county, metadata) {
    const courtSystem = metadata.courtSystem;
    const courtName = courtSystem.familyDivision || courtSystem.trialCourt;

    if (!courtName) {
      return null;
    }

    const isUS = this.isUSJurisdiction(stateCode);

    if (isUS && county) {
      const normalizedCounty = this.normalizeCountyName(county);
      return `${courtName}, ${normalizedCounty} County`;
    }

    // International or no county — return court name as-is
    return courtName;
  }

  /**
   * Get Texas district court name
   * @param {string} county - County name
   * @param {string} district - Optional specific district number
   * @returns {string} Formatted court name
   */
  getTexasCourtName(county, district = null) {
    const normalizedCounty = this.normalizeCountyName(county);
    
    // Get available districts for this county
    const districts = this.texasDistrictMapping[normalizedCounty];
    
    if (districts && districts.length > 0) {
      // Use provided district or default to first
      const districtNum = district || districts[0];
      return `${districtNum} District Court, ${normalizedCounty} County, Texas`;
    }

    // Fallback for counties not in mapping
    if (district) {
      return `${district} District Court, ${normalizedCounty} County, Texas`;
    }
    
    return `District Court, ${normalizedCounty} County, Texas`;
  }

  /**
   * Get Utah district court name
   * @param {string} county - County name
   * @param {string} district - Optional specific district
   * @returns {string} Formatted court name
   */
  getUtahCourtName(county, district = null) {
    const normalizedCounty = this.normalizeCountyName(county);
    
    // Get judicial district for this county
    const judicialDistrict = district || this.utahDistrictMapping[normalizedCounty];
    
    if (judicialDistrict) {
      return `District Court, ${judicialDistrict} District, ${normalizedCounty} County, State of Utah`;
    }

    // Fallback
    return `District Court, ${normalizedCounty} County, State of Utah`;
  }

  /**
   * Get Arizona superior court name
   * @param {string} county - County name
   * @returns {string} Formatted court name
   */
  getArizonaCourtName(county) {
    const normalizedCounty = this.normalizeCountyName(county);
    return `Superior Court of Arizona in and for the County of ${normalizedCounty}`;
  }

  /**
   * Get all available district courts for a Texas county
   * @param {string} county - County name
   * @returns {Array<string>} Array of district court names
   */
  getTexasDistrictOptions(county) {
    const normalizedCounty = this.normalizeCountyName(county);
    const districts = this.texasDistrictMapping[normalizedCounty];
    
    if (!districts || districts.length === 0) {
      return [`District Court, ${normalizedCounty} County, Texas`];
    }

    return districts.map(dist => 
      `${dist} District Court, ${normalizedCounty} County, Texas`
    );
  }

  /**
   * Validate and normalize court name
   * @param {string} courtName - User-provided court name
   * @param {string} state - State code
   * @param {string} county - County name
   * @param {Object} metadata - Optional jurisdiction metadata with courtSystem
   * @returns {Object} Validation result with normalized court name
   */
  validateCourtName(courtName, state, county, metadata = null) {
    if (!courtName) {
      return {
        isValid: false,
        normalized: null,
        suggestion: this.getDefaultCourtName(state, county, null, metadata)
      };
    }

    const normalized = courtName.trim();

    // If we have metadata, validate against its courtSystem
    if (metadata?.courtSystem) {
      const expected = metadata.courtSystem.familyDivision || metadata.courtSystem.trialCourt;
      if (expected && normalized.toLowerCase().includes(expected.toLowerCase())) {
        return {
          isValid: true,
          normalized,
          confidence: 'high'
        };
      }
    }

    // Check if it matches expected format for state — hardcoded patterns
    const patterns = {
      'TX': /district court/i,
      'UT': /district court/i,
      'AZ': /superior court/i,
      'CA': /superior court/i,
      'FL': /circuit court/i,
      'IL': /circuit court/i,
      'NY': /supreme court/i,
      'OH': /court of common pleas/i,
      'PA': /court of common pleas/i,
      'GA': /superior court/i,
      'NJ': /superior court/i,
      'VA': /circuit court/i,
      'WA': /superior court/i,
      'CO': /district court/i,
      'MS': /chancery court/i,
      'SC': /family court/i,
      'DE': /family court/i,
      'HI': /family court/i,
      'RI': /family court/i,
      'DC': /superior court/i,
    };

    const pattern = patterns[state?.toUpperCase()];
    if (pattern && pattern.test(normalized)) {
      return {
        isValid: true,
        normalized,
        confidence: 'high'
      };
    }

    // Generic court-name patterns for broader validation
    const genericCourtPatterns = [
      /circuit court/i,
      /district court/i,
      /superior court/i,
      /family court/i,
      /court of common pleas/i,
      /chancery court/i,
      /supreme court/i,
    ];

    if (genericCourtPatterns.some(p => p.test(normalized))) {
      return {
        isValid: true,
        normalized,
        confidence: 'medium'
      };
    }

    // Try to fix common issues for Texas
    if (state?.toUpperCase() === 'TX') {
      if (/^\d+(st|nd|rd|th)\s*district/i.test(normalized)) {
        const fixed = `${normalized}, ${this.normalizeCountyName(county)} County, Texas`;
        return {
          isValid: true,
          normalized: fixed,
          wasFixed: true,
          confidence: 'medium'
        };
      }
    }

    return {
      isValid: true,
      normalized,
      warning: 'Format may not match state convention',
      confidence: 'low',
      suggestion: this.getDefaultCourtName(state, county, null, metadata)
    };
  }

  /**
   * Extract district number from court name
   * @param {string} courtName - Court name
   * @returns {string|null} District number
   */
  extractDistrictNumber(courtName) {
    const match = courtName.match(/(\d+)(st|nd|rd|th)\s*district/i);
    return match ? match[1] + match[2] : null;
  }

  /**
   * Infer county from city name (common mappings)
   * @param {string} city - City name
   * @param {string} state - State code
   * @returns {string|null} County name
   */
  inferCountyFromCity(city, state) {
    const cityToCounty = {
      'TX': {
        'austin': 'Travis',
        'dallas': 'Dallas',
        'houston': 'Harris',
        'san antonio': 'Bexar',
        'fort worth': 'Tarrant',
        'el paso': 'El Paso',
        'arlington': 'Tarrant',
        'corpus christi': 'Nueces',
        'plano': 'Collin',
        'irving': 'Dallas',
        'lubbock': 'Lubbock',
        'garland': 'Dallas',
        'frisco': 'Collin',
        'mckinney': 'Collin',
        'sugar land': 'Fort Bend',
        'round rock': 'Williamson',
        'denton': 'Denton',
      },
      'UT': {
        'salt lake city': 'Salt Lake',
        'west valley city': 'Salt Lake',
        'provo': 'Utah',
        'west jordan': 'Salt Lake',
        'orem': 'Utah',
        'sandy': 'Salt Lake',
        'ogden': 'Weber',
        'st george': 'Washington',
        'layton': 'Davis',
        'taylorsville': 'Salt Lake',
        'logan': 'Cache',
      },
      'AZ': {
        'phoenix': 'Maricopa',
        'tucson': 'Pima',
        'mesa': 'Maricopa',
        'chandler': 'Maricopa',
        'scottsdale': 'Maricopa',
        'glendale': 'Maricopa',
        'gilbert': 'Maricopa',
        'tempe': 'Maricopa',
        'peoria': 'Maricopa',
        'surprise': 'Maricopa',
        'flagstaff': 'Coconino',
        'yuma': 'Yuma',
      }
    };

    const normalizedCity = city.toLowerCase().trim();
    const stateMap = cityToCounty[state?.toUpperCase()];
    
    return stateMap?.[normalizedCity] || null;
  }

  /**
   * Normalize county name (capitalize properly)
   * @param {string} county - County name
   * @returns {string} Normalized county name
   */
  normalizeCountyName(county) {
    if (!county) return '';
    
    return county
      .trim()
      .split(' ')
      .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
      .join(' ')
      .replace(/\scounty$/i, ''); // Remove "County" suffix if present
  }

  /**
   * Get court type description (for user help)
   * @param {string} state - State code
   * @param {Object} metadata - Optional jurisdiction metadata with courtSystem and stateName
   * @returns {string} Description
   */
  getCourtTypeDescription(state, metadata = null) {
    // Metadata-driven description for any jurisdiction
    if (metadata?.courtSystem) {
      const court = metadata.courtSystem.familyDivision || metadata.courtSystem.trialCourt;
      const name = metadata.stateName || state;
      return `Family law cases in ${name} are heard in the ${court}.`;
    }

    // Hardcoded fallbacks for TX/UT/AZ
    const descriptions = {
      'TX': 'Texas family law cases are typically heard in District Courts. Each county has one or more numbered district courts.',
      'UT': 'Utah family law cases are heard in District Courts, organized by judicial district.',
      'AZ': 'Arizona family law cases are heard in the Superior Court of the county where you reside.'
    };

    return descriptions[state?.toUpperCase()] || '';
  }
}

module.exports = new CourtNameService();
