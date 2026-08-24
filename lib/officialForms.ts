/**
 * Official court-forms pages published by each jurisdiction's own
 * judiciary (or government), for the "file on the official forms" links.
 *
 * POSITIONING: discover.legal helps people organize their story and
 * prepare drafts; where a state/province publishes official forms, THOSE
 * are the filing vehicle and we link to them. Only pages on an official
 * court/government domain belong here — never legal-aid nonprofits or
 * commercial sites. Jurisdictions whose courts publish no statewide
 * forms page simply have no entry (the UI omits the link): currently
 * LA (forms are per judicial district) and NU (forms live only inside
 * the Rules of Court PDFs).
 *
 * Every URL verified 2026-08-24 (fetch or, where the court runs a bot
 * wall, search-confirmed canonical). Court sites reorganize often —
 * re-verify whenever touching this file.
 */

export type OfficialForms = {
  /** Human name of the official destination, shown as the link text. */
  name: string;
  url: string;
};

const OFFICIAL_FORMS: Record<string, OfficialForms> = {
  // ── United States ──────────────────────────────────────────────────
  AL: { name: 'Alabama Judicial System — Forms', url: 'https://judicial.alabama.gov/library/Forms' },
  AK: { name: 'Alaska Court System — Forms', url: 'https://courts.alaska.gov/forms/index.htm' },
  AZ: { name: 'Arizona Judicial Branch — Self-Service Center', url: 'https://www.azcourts.gov/selfservicecenter' },
  AR: { name: 'Arkansas Judiciary — Court Forms', url: 'https://arcourts.gov/forms-and-publications/court-forms' },
  CA: { name: 'California Courts — Court Forms', url: 'https://courts.ca.gov/forms-rules/court-forms' },
  CO: { name: 'Colorado Judicial Branch — Self-Help Forms', url: 'https://www.coloradojudicial.gov/self-help-forms' },
  CT: { name: 'Connecticut Judicial Branch — Official Court Webforms', url: 'https://www.jud.ct.gov/webforms/' },
  DE: { name: 'Delaware Courts — Forms', url: 'https://courts.delaware.gov/forms/' },
  DC: { name: 'DC Courts — Forms', url: 'https://www.dccourts.gov/court-resources/search-forms' },
  FL: { name: 'Florida Courts — Family Law Forms', url: 'https://www.flcourts.gov/Services/family-courts/domestic-relations-court-resources/family-law-forms' },
  GA: { name: 'Georgia Courts — Forms and Records', url: 'https://georgiacourts.gov/forms-and-records/' },
  HI: { name: 'Hawaiʻi State Judiciary — Court Forms', url: 'https://www.courts.state.hi.us/self-help/courts/forms/court_forms' },
  ID: { name: 'Idaho Court Assistance Office — Forms', url: 'https://courtselfhelp.idaho.gov/forms' },
  IL: { name: 'Illinois Courts — Approved Statewide Forms', url: 'https://www.illinoiscourts.gov/documents-and-forms/approved-forms/' },
  IN: { name: 'Indiana Judicial Branch — Self-Service Legal Center', url: 'https://www.in.gov/courts/selfservice/' },
  IA: { name: 'Iowa Judicial Branch — Court Forms', url: 'https://www.iowacourts.gov/for-the-public/court-forms' },
  KS: { name: 'Kansas Judicial Branch — Find Court Forms', url: 'https://self-help.kscourts.gov/FindCourtForms' },
  KY: { name: 'Kentucky Court of Justice — Legal Forms', url: 'https://www.kycourts.gov/Legal-Forms/Pages/default.aspx' },
  ME: { name: 'Maine Judicial Branch — Forms', url: 'https://www.courts.maine.gov/forms/' },
  MD: { name: 'Maryland Courts — Court Forms', url: 'https://www.mdcourts.gov/courtforms' },
  MA: { name: 'Massachusetts Court System — Court Forms', url: 'https://www.mass.gov/topics/court-forms' },
  MI: { name: 'Michigan Courts — Index of Court Forms (SCAO)', url: 'https://www.courts.michigan.gov/SCAO-forms/michigan-court-forms/' },
  MN: { name: 'Minnesota Judicial Branch — Forms & Instructions', url: 'https://mncourts.gov/getforms' },
  MS: { name: 'Mississippi Courts — Forms', url: 'https://courts.ms.gov/research/forms.php' },
  MO: { name: 'Missouri Courts — Court Forms', url: 'https://www.courts.mo.gov/page.jsp?id=103116' },
  MT: { name: 'Montana Judicial Branch — Forms', url: 'https://courts.mt.gov/forms/' },
  NE: { name: 'Nebraska Judicial Branch — Self-Help', url: 'https://nebraskajudicial.gov/self-help' },
  NV: { name: 'Nevada Courts — Self-Help Center', url: 'https://selfhelp.nvcourts.gov/' },
  NH: { name: 'New Hampshire Judicial Branch — Forms and Fees', url: 'https://www.courts.nh.gov/resources/forms-and-fees' },
  NJ: { name: 'New Jersey Courts — Forms', url: 'https://www.njcourts.gov/self-help/forms' },
  NM: { name: 'New Mexico Courts — Forms & Files Library', url: 'https://nmcourts.gov/forms-library/' },
  NY: { name: 'New York Courts — Statewide Forms', url: 'https://www.nycourts.gov/statewide-forms' },
  NC: { name: 'North Carolina Judicial Branch — Forms', url: 'https://www.nccourts.gov/documents/forms' },
  ND: { name: 'North Dakota Courts — Legal Self Help Center', url: 'https://www.ndcourts.gov/legal-self-help' },
  OH: { name: 'Supreme Court of Ohio — Forms', url: 'https://www.supremecourt.ohio.gov/forms/all-forms/' },
  OK: { name: 'Oklahoma Courts (OSCN) — AOC Forms', url: 'https://www.oscn.net/static/forms/start.asp' },
  OR: { name: 'Oregon Judicial Department — Forms Center', url: 'https://www.courts.oregon.gov/forms/Pages/default.aspx' },
  PA: { name: 'Pennsylvania Courts — Forms', url: 'https://www.pacourts.us/forms' },
  RI: { name: 'Rhode Island Judiciary — Forms', url: 'https://www.courts.ri.gov/Pages/forms.aspx' },
  SC: { name: 'South Carolina Judicial Branch — Court Forms', url: 'https://www.sccourts.org/court-forms/' },
  SD: { name: 'South Dakota UJS — Forms', url: 'https://ujs.sd.gov/form-file-search/' },
  TN: { name: 'Tennessee Courts — Self-Help Forms', url: 'https://www.tncourts.gov/programs/self-help-center/forms' },
  TX: { name: 'Texas Judicial Branch — Forms', url: 'https://www.txcourts.gov/rules-forms/forms/' },
  UT: { name: 'Utah Courts — Forms', url: 'https://www.utcourts.gov/en/self-help/forms.html' },
  VT: { name: 'Vermont Judiciary — Court Forms', url: 'https://www.vtcourts.gov/court-forms' },
  VA: { name: "Virginia's Judicial System — Forms", url: 'https://www.vacourts.gov/forms/home' },
  WA: { name: 'Washington Courts — Court Forms', url: 'https://www.courts.wa.gov/forms/' },
  WV: { name: 'West Virginia Judiciary — Court Forms', url: 'https://www.courtswv.gov/public-resources/court-forms' },
  WI: { name: 'Wisconsin Court System — Circuit Court Forms', url: 'https://www.wicourts.gov/forms1/circuit/index.htm' },
  WY: { name: 'Wyoming Judicial Branch — Self-Help Forms', url: 'https://www.wyocourts.gov/self-help-forms/' },

  // ── Canada ─────────────────────────────────────────────────────────
  ON: { name: 'Ontario Court Forms', url: 'https://ontariocourtforms.on.ca/en/' },
  BC: { name: 'Government of British Columbia — Court Forms', url: 'https://www2.gov.bc.ca/gov/content/justice/courthouse-services/documents-forms-records/court-forms' },
  AB: { name: "Court of King's Bench of Alberta — Family Law Forms", url: 'https://www.albertacourts.ca/kb/areas-of-law/family/family-law-forms' },
  MB: { name: "Manitoba — Court of King's Bench Forms", url: 'https://web2.gov.mb.ca/laws/rules/forms_e.php' },
  SK: { name: "Saskatchewan Courts — King's Bench Rules & Forms", url: 'https://sasklawcourts.ca/kings-bench/rules-practice-directives/' },
  QC: { name: 'Gouvernement du Québec — Justice Forms and Models', url: 'https://www.quebec.ca/en/justice-and-civil-status/judicial-system/forms-models' },
  NS: { name: 'Courts of Nova Scotia — Family Division Forms', url: 'https://www.courts.ns.ca/operations/forms-documents/family-division-practice-memorandum-forms' },
  NB: { name: "New Brunswick Court of King's Bench — Family Court Forms", url: 'https://www.courtsnb-coursnb.ca/content/cour/en/kings-bench/content/family-division/court-forms.html' },
  NL: { name: 'Supreme Court of Newfoundland and Labrador — Family Forms', url: 'https://www.court.nl.ca/supreme/rules-practice-notes-and-forms/family/general/' },
  PE: { name: 'Courts of Prince Edward Island — Forms', url: 'https://www.courts.pe.ca/forms' },
  YT: { name: 'Yukon Courts — Supreme Court Rules & Forms', url: 'https://www.yukoncourts.ca/en/supreme-court/rules-forms' },
  NT: { name: 'Northwest Territories Courts — Forms', url: 'https://www.nwtcourts.ca/en/forms/' },
};

/**
 * The official forms page for a jurisdiction, or null when its courts
 * publish none (or we have not verified one).
 */
export function officialFormsLink(state: string): OfficialForms | null {
  const code = typeof state === 'string' ? state.trim().toUpperCase() : '';
  return OFFICIAL_FORMS[code] ?? null;
}
