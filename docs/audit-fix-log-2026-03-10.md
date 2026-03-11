# Template Audit Fix Log — March 10, 2026

## Audit Scope
~110 jurisdictions across 11 countries. 7 parallel research agents verified every metadata.json and divorce-metadata.json against current statutes, court websites, and legal practitioner sources.

## Fix Tracking

### CRITICAL FIXES

| # | Jurisdiction | File | Issue | Old Value | New Value | Status |
|---|-------------|------|-------|-----------|-----------|--------|
| C1 | Maryland | divorce-metadata.json | Fault grounds eliminated Oct 1, 2023 (HB 380) | 5 fault grounds listed | Removed all fault grounds; added irreconcilable differences | APPLIED |
| C2 | Colorado | divorce-metadata.json | Residency says "no minimum" | stateMonths: 0 | stateDays: 91 (domicile) | APPLIED |
| C3 | Colorado | divorce-metadata.json | Waiting period startsFrom | filing_date | service_date | APPLIED |
| C4 | DC | divorce-metadata.json | Missing 2024 ground (D.C. Code §16-904(a)) | Only mutual consent + 6-mo separation | Added "no longer wish to remain married" ground | APPLIED |
| C5 | BC | divorce-metadata.json | Certificate of Divorce section | s.13 | s.12(7) | APPLIED |
| C6 | Alberta | divorce-metadata.json | Certificate of Divorce section | s.13 | s.12(7) | APPLIED |
| C7 | Quebec | divorce-metadata.json | Certificate of Divorce section | s.13 | s.12(7) | APPLIED |
| C8 | Manitoba | divorce-metadata.json | Certificate of Divorce section | s.13 | s.12(7) | APPLIED |
| C9 | Nova Scotia | divorce-metadata.json | Certificate of Divorce section | s.13 | s.12(7) | APPLIED |
| C10 | Saskatchewan | divorce-metadata.json | Certificate of Divorce section | s.13 | s.12(7) | APPLIED |
| C11 | Manitoba | metadata.json + divorce-metadata.json | Property act renamed June 2025 | Marital Property Act, CCSM c. M45 | Family Property Act, CCSM c. F25 | APPLIED |
| C12 | Alberta | metadata.json + divorce-metadata.json | Citation format wrong | SA 2020, c. F-4.7 | RSA 2000, c. F-4.7 | APPLIED |
| C13 | Singapore | divorce-metadata.json | Mutual agreement statute citation | s.95(3)(f) | s.95A | APPLIED |
| C14 | Hong Kong | divorce-metadata.json | Missing mutual agreement ground (July 2024) | Not present | Added mutual_agreement ground | APPLIED |

### HIGH FIXES

| # | Jurisdiction | File | Issue | Old Value | New Value | Status |
|---|-------------|------|-------|-----------|-----------|--------|
| H1 | Scotland | divorce-metadata.json | Ordinary filing fee outdated | GBP 151 | GBP 185 (Nov 2024 increase) | APPLIED |
| H2 | Scotland | divorce-metadata.json | Simplified fee outdated | approx. 128 | GBP 151 (Nov 2024 increase) | APPLIED |
| H3 | Texas | divorce-metadata.json | Child support income cap outdated | $9,200/month | $11,700/month (Sept 2025) | APPLIED |
| H4 | Utah | divorce-metadata.json | Waiting period missing children distinction | 30 days all cases | 30 days no children / 90 days with children | APPLIED |
| H5 | Mississippi | divorce-metadata.json | Filing fee drastically wrong | $52 | $148-$158 | APPLIED |
| H6 | Vermont | divorce-metadata.json | Filing fee wrong | $295 | $78.50 (stipulated) / $262 (contested) | APPLIED |
| H7 | Karnataka | metadata.json + divorce-metadata.json | Stamp paper wrong | INR 100 | INR 20 | APPLIED |
| H8 | Bihar | metadata.json + divorce-metadata.json | Stamp paper wrong | INR 50 | INR 100 | APPLIED |
| H9 | Rajasthan | metadata.json + divorce-metadata.json | Stamp paper wrong | INR 50 | INR 20 | APPLIED |
| H10 | Andhra Pradesh | metadata.json + divorce-metadata.json | Stamp paper wrong | INR 20 | INR 10 | APPLIED |
| H11 | Haryana | metadata.json + divorce-metadata.json | Stamp paper wrong | INR 15 | INR 10 | APPLIED |

### MEDIUM FIXES

| # | Jurisdiction | File | Issue | Old Value | New Value | Status |
|---|-------------|------|-------|-----------|-----------|--------|
| M1 | Ohio | divorce-metadata.json | Filing fee range too low | $150-$350 | $250-$475 | APPLIED |
| M2 | Kentucky | divorce-metadata.json | Filing fee range too low | $113-$150 | $185-$250 | APPLIED |
| M3 | Utah | divorce-metadata.json | stateMonths incorrect | 0 | 3 (90 days, same as county) | APPLIED |
| M4 | New York | divorce-metadata.json | Maintenance income cap outdated | $228,000 | $241,000 (March 2026 CPI adjustment) | APPLIED |
| M5 | Montana | divorce-metadata.json | Waiting period off by 1 day | 20 days | 21 days | APPLIED |
| M6 | Kansas | divorce-metadata.json | Filing fee outdated | $176 | $195 | APPLIED |
| M7 | Nebraska | divorce-metadata.json | Filing fee outdated | $158 | $164 (July 2025) | APPLIED |
| M8 | Ontario | divorce-metadata.json | Filing fee outdated | $202 | $224 | APPLIED |
| M9 | Nova Scotia | divorce-metadata.json | Filing fee outdated | $246 | $291.55 | APPLIED |
| M10 | Quebec | divorce-metadata.json | Filing fee range wrong | $105-$200 | $108-$325 | APPLIED |
| M11 | Louisiana | divorce-metadata.json | Filing fee range too narrow | $200-$450 | $200-$600 | APPLIED |
| M12 | New Mexico | divorce-metadata.json | Filing fee range too high | $137-$200 | $132-$162 | APPLIED |

### LOW FIXES

| # | Jurisdiction | File | Issue | Old Value | New Value | Status |
|---|-------------|------|-------|-----------|-----------|--------|
| L1 | New Zealand | metadata.json | Ashley's Law date off by 1 day | 17 October 2025 | 18 October 2025 | APPLIED |

### PASS 2 FIXES (Verification Agent, March 10)

| # | Jurisdiction | File | Issue | Old Value | New Value | Status |
|---|-------------|------|-------|-----------|-----------|--------|
| P1 | Utah | divorce-metadata.json | daysWithMinorChildren still 90 despite 2018 law | daysWithMinorChildren: 90 | Removed field; description updated | APPLIED |
| P2 | Nevada | divorce-metadata.json | Child support basis mislabeled | income_shares | percentage_of_income (NRS 125B.070) | APPLIED |
| P3 | Mississippi | divorce-metadata.json | Child support basis mislabeled | income_shares | percentage_of_income (Miss. Code §43-19-101) | APPLIED |
| P4 | Alabama | divorce-metadata.json | Adultery shares citation with incompatibility | §30-2-1(a)(2) | §30-2-1(a)(1) | APPLIED |
| P5 | California | divorce-metadata.json | Exceptions says "NO exceptions" | exceptions: [] | Added AB 1179 (2024) court waiver | APPLIED |
| P6 | New York | divorce-metadata.json | Total fee doesn't match breakdown | $335+ | $305+ ($210 index + $95 RJI) | APPLIED |

### NOT APPLIED (Scope too large / Enhancement)

| # | Issue | Reason |
|---|-------|--------|
| N1 | Arkansas covenant marriage | Addition of new content section, not a factual correction |
| N2 | India 14 states wife's additional grounds (s.13(2)) | Structural addition across 14 files — flagged for next sprint |
| N3 | India PWDVA 2005 reference | Enhancement, not error — flagged for next sprint |
| N4 | England 6-week gap precision (43 days) | Very minor — "6-week gap" is conventional phrasing |
| N5 | Canada DV hotlines in prompts | Enhancement — flagged for next sprint |

## Sources
All corrections verified against official government sources, court websites, statute databases (CanLII, Justia, state legislatures), and legal practitioner publications. See individual agent audit reports for full source lists.

## Verified Clean Jurisdictions (~70)
AZ, CA, FL, IL, MA, MI, NC, NJ, PA, WA, IN, TN, MO, MN, GA, WI, SC, OR, OK, CT, NV, IA, WV, HI, ME, NH, RI, DE, AK, ND, SD, WY, NB, NL, PE, NT, YT, NU, NIR, IRL, 8x AU (NSW, VIC, QLD, WA_AU, SA_AU, TAS, ACT, NT_AU), SA, KE, GH, 12x NG, IN_DL, IN_MH, IN_WB, IN_GJ, IN_UP, IN_TS, IN_PB, IN_TN, IN_KL, IN_MP, IN_OD
