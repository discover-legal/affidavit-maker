/**
 * Jurisdictions rendered on A4 paper.
 *
 * Copied from `A4_JURISDICTIONS` in services/pdfService.js (the v1 PDF
 * builder). That module exports only its class, so the set cannot be
 * imported without instantiating v1; keep the two in step by hand. A
 * jurisdiction is also A4 when its metadata declares `paperSize: "A4"`.
 */
export const A4_JURISDICTIONS: ReadonlySet<string> = new Set([
  'ENG', 'SCO', 'NIR', 'IRL',
  'NSW', 'VIC', 'QLD', 'WA_AU', 'SA_AU', 'TAS', 'ACT', 'NT_AU',
  'NZ', 'SG', 'HK',
  'ZA', 'KE', 'GH',
  'LA_NG', 'FC', 'RV', 'CR', 'ED', 'DT', 'OY', 'OG', 'AN', 'EN', 'IM', 'AB_NG',
  'IN_DL', 'IN_MH', 'IN_KA', 'IN_TN', 'IN_GJ', 'IN_UP', 'IN_WB', 'IN_TS',
  'IN_RJ', 'IN_KL', 'IN_PB', 'IN_HR', 'IN_MP', 'IN_BR', 'IN_OD', 'IN_AP',
]);
