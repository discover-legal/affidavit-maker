/**
 * Instrument (document) titles for the divorce profile.
 *
 * Resolution order in build.ts:
 *   1. INSTRUMENT_OVERRIDES[code]           — jurisdictions whose metadata
 *      carries no usable title (or a form-numbered one like "Form 8 —
 *      Application (General)");
 *   2. divorce-metadata.terminology.petition / petitionTitle and
 *      decree / decreeTitle;
 *   3. requiredForms.basic[0].name for the petition (the first listed
 *      basic form is the initiating instrument in every file that has one);
 *   4. INSTRUMENT_DEFAULTS[country], then INSTRUMENT_FALLBACK.
 *
 * The answer instrument is never in the metadata; it comes from the
 * override or the country default.
 */

export interface InstrumentNames {
  petition?: string;
  decree?: string;
  answer?: string;
}

export const INSTRUMENT_OVERRIDES: Readonly<Record<string, InstrumentNames>> = {
  // Canada — sources: requiredForms in each divorce-metadata.json
  ON: { petition: 'Application (General)', decree: 'Divorce Order', answer: 'Answer' }, // Forms 8 / 25A / 10
  AB: { petition: 'Statement of Claim for Divorce', decree: 'Divorce Order', answer: 'Statement of Defence' },
  BC: { petition: 'Notice of Family Claim', decree: 'Divorce Order', answer: 'Response to Family Claim' }, // F3 / F52 / F8
  QC: { petition: 'Originating Application', decree: 'Divorce Judgment', answer: 'Answer' },
  PE: { petition: 'Petition for Divorce', decree: 'Divorce Order', answer: 'Answer' },
  NL: { petition: 'Petition for Divorce', decree: 'Divorce Order', answer: 'Answer' },
  // United States
  TX: { petition: 'Original Petition for Divorce', decree: 'Final Decree of Divorce', answer: 'Original Answer' },
  UT: { petition: 'Verified Petition for Divorce', decree: 'Decree of Divorce', answer: 'Answer' },
  NY: { petition: 'Verified Complaint for Divorce', decree: 'Judgment of Divorce', answer: 'Verified Answer' },
  CA: { petition: 'Petition for Dissolution of Marriage', decree: 'Judgment of Dissolution of Marriage', answer: 'Response' }, // FL-100 / FL-180 / FL-120
  FL: { petition: 'Petition for Dissolution of Marriage', decree: 'Final Judgment of Dissolution of Marriage', answer: 'Answer' },
  GA: { petition: 'Complaint for Divorce', decree: 'Final Judgment and Decree of Divorce', answer: 'Answer' },
  // United Kingdom & Ireland
  ENG: { petition: 'Application for a Divorce Order', decree: 'Final Order', answer: 'Acknowledgment of Service' }, // Form D8 / D36 / D10
  SCO: { petition: 'Initial Writ', decree: 'Decree of Divorce', answer: 'Notice of Intention to Defend' },
  NIR: { petition: 'Divorce Petition', decree: 'Decree Absolute', answer: 'Acknowledgment of Service' },
  IRL: { petition: 'Family Law Civil Bill', decree: 'Decree of Divorce', answer: 'Appearance and Defence' },
};

export const INSTRUMENT_DEFAULTS: Readonly<Record<string, Required<InstrumentNames>>> = {
  US: { petition: 'Petition for Divorce', decree: 'Final Decree of Divorce', answer: 'Answer' },
  CA: { petition: 'Petition for Divorce', decree: 'Divorce Order', answer: 'Answer' },
  UK: { petition: 'Application for a Divorce Order', decree: 'Final Order', answer: 'Acknowledgment of Service' },
  IE: { petition: 'Family Law Civil Bill', decree: 'Decree of Divorce', answer: 'Defence' },
  AU: { petition: 'Application for Divorce', decree: 'Divorce Order', answer: 'Response to Divorce' },
  NZ: { petition: 'Application for Dissolution of Marriage', decree: 'Order Dissolving Marriage', answer: 'Notice of Defence' },
  SG: { petition: 'Originating Application for Divorce', decree: 'Final Judgment', answer: 'Defence' },
  HK: { petition: 'Petition for Divorce', decree: 'Decree Absolute', answer: 'Answer' },
  ZA: { petition: 'Combined Summons', decree: 'Decree of Divorce', answer: 'Plea' },
  KE: { petition: 'Petition for Divorce', decree: 'Decree Absolute', answer: 'Answer' },
  GH: { petition: 'Petition for Divorce', decree: 'Decree of Divorce', answer: 'Answer' },
  NG: { petition: 'Petition for Dissolution of Marriage', decree: 'Decree Absolute', answer: 'Answer' },
  IN: { petition: 'Petition for Divorce', decree: 'Decree of Divorce', answer: 'Written Statement' },
};

export const INSTRUMENT_FALLBACK: Required<InstrumentNames> = {
  petition: 'Petition for Divorce',
  decree: 'Decree of Divorce',
  answer: 'Answer',
};
