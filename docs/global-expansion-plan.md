# Global Common Law Expansion Plan

**Created**: 2026-03-10
**Status**: Research Complete, Ready for Implementation
**Scope**: Every meaningful common law jurisdiction worldwide

---

## Executive Summary

This plan expands the affidavit-maker tool from 64 jurisdictions (51 US + 13 CA) to **~195+ jurisdictions** across **30+ countries** spanning 6 continents. Each country gets its own subdomain (e.g., `uk.discover.legal`, `au.discover.legal`).

### Current State
- **US**: 50 states + DC (51 jurisdictions) on `make.discover.legal`
- **Canada**: 10 provinces + 3 territories (13 jurisdictions) on `ca.discover.legal`

### Target State
| Region | Countries | Jurisdictions | Subdomains |
|--------|-----------|---------------|------------|
| North America (existing) | US, CA | 64 | make., ca. |
| UK & Ireland | UK, IE | 4 | uk., ie. |
| Oceania | AU, NZ | 9 | au., nz. |
| South Asia | IN, PK, BD, LK | 23 | in., pk., bd., lk. |
| Africa | ZA, NG, KE, GH, UG, TZ, ZM, ZW, BW, MW, NA | 23 | sa., ng., ke., gh., ug., tz., zm., zw., bw., mw., na. |
| SE Asia | SG, HK, MY | 4 | sg., hk., my. |
| Caribbean | JM, TT, BB, BS, BM, GY, BZ, AG, DM, GD, KN, VC | 12 | jm., tt., bb., bs., bm., gy., bz., ag., dm., gd., kn., vc. |
| Pacific | FJ, PG | 2 | fj., pg. |
| Mediterranean | CY | 1 | cy. |
| **TOTAL** | **~32 countries** | **~142 new** | **~30 new subdomains** |

---

## Architecture Changes (Pre-requisite for All Countries)

### 1. Multi-Country Detection (`routes/chat.js`)

```javascript
// Replace binary US/CA detection with universal country detection
const JURISDICTION_COUNTRY_MAP = {
  // UK
  ENG: 'UK', SCO: 'UK', NIR: 'UK',
  // Ireland
  IRL: 'IE',
  // Australia
  NSW: 'AU', VIC: 'AU', QLD: 'AU', WA_AU: 'AU', SA_AU: 'AU',
  TAS: 'AU', ACT: 'AU', NT_AU: 'AU',
  // New Zealand
  NZ: 'NZ',
  // India (prefixed to avoid US state collisions)
  IN_DL: 'IN', IN_MH: 'IN', IN_KA: 'IN', IN_TN: 'IN', IN_GJ: 'IN',
  IN_UP: 'IN', IN_WB: 'IN', IN_TS: 'IN', IN_RJ: 'IN', IN_KL: 'IN',
  IN_PB: 'IN', IN_HR: 'IN', IN_MP: 'IN', IN_BR: 'IN', IN_OD: 'IN', IN_AP: 'IN',
  // Pakistan
  PK_PB: 'PK', PK_SD: 'PK', PK_KP: 'PK', PK_BA: 'PK', PK_IS: 'PK',
  // Bangladesh, Sri Lanka
  BD: 'BD', LK: 'LK',
  // Africa
  ZA: 'ZA', // South Africa (single jurisdiction)
  LA_NG: 'NG', FC: 'NG', RV: 'NG', // Nigeria (12 states)
  KE: 'KE', GH: 'GH', UG: 'UG', TZ: 'TZ', ZM: 'ZM',
  ZW: 'ZW', BW: 'BW', MW: 'MW', NA_NM: 'NA',
  // SE Asia
  SG: 'SG', HK: 'HK', MY: 'MY',
  // Caribbean
  JM: 'JM', TT: 'TT', BB: 'BB', BS: 'BS', BM: 'BM',
  // Pacific
  FJ: 'FJ', PG: 'PG',
  // Mediterranean
  CY: 'CY',
};

const SUBDOMAIN_COUNTRY_MAP = {
  'uk': 'UK', 'ie': 'IE', 'au': 'AU', 'nz': 'NZ',
  'in': 'IN', 'pk': 'PK', 'bd': 'BD', 'lk': 'LK',
  'sa': 'ZA', 'ng': 'NG', 'ke': 'KE', 'gh': 'GH',
  'ug': 'UG', 'tz': 'TZ', 'zm': 'ZM', 'zw': 'ZW',
  'bw': 'BW', 'mw': 'MW', 'na': 'NA',
  'sg': 'SG', 'hk': 'HK', 'my': 'MY',
  'jm': 'JM', 'tt': 'TT', 'bb': 'BB', 'bs': 'BS', 'bm': 'BM',
  'fj': 'FJ', 'pg': 'PG', 'cy': 'CY',
};

const DEFAULT_JURISDICTION = {
  US: 'TX', CA: 'ON', UK: 'ENG', IE: 'IRL', AU: 'NSW', NZ: 'NZ',
  IN: 'IN_DL', PK: 'PK_IS', BD: 'BD', LK: 'LK',
  ZA: 'ZA', NG: 'LA_NG', KE: 'KE', GH: 'GH',
  SG: 'SG', HK: 'HK', MY: 'MY',
  JM: 'JM', TT: 'TT', FJ: 'FJ',
};
```

### 2. CORS / CSRF / CSP Updates (3 files must stay in sync)

All new subdomains must be added to:
- `server.js` -> `getAllowedOrigins()`
- `middleware/csrfProtection.js` -> both prod and dev lists
- `middleware/validation.js` -> `connectSrc` CSP directive

### 3. Template Metadata Schema Extensions

```json
{
  "countryCode": "UK",
  "jurisdictionCode": "ENG",
  "currency": "GBP",
  "paperSize": "A4",
  "evidenceDefault": "statement_of_truth",
  "personalLawSystem": false,
  "stampPaperRequired": false,
  "nationalIdField": null,
  "emergencyNumber": "999",
  "dvHotline": "0808 2000 247",
  "witnessType": "solicitor",
  "features": {
    "statementOfTruth": true,
    "swornAffidavit": true,
    "notaryBlock": false,
    "commissionerForOaths": true,
    "justiceOfThePeace": false,
    "deponentRelation": false
  }
}
```

### 4. PDF Service Changes

- A4 paper size support (210mm x 297mm) for all non-US/CA jurisdictions
- Currency symbol rendering (GBP, EUR, AUD, NZD, INR, ZAR, etc.)

### 5. Per-Jurisdiction File Pattern (7 files each)

```
templates/states/{jurisdiction}/
  metadata.json
  divorce-metadata.json
  AffidavitTemplate.js
  DivorcePetitionTemplate.js
  DivorceDecreeTemplate.js
services/agents/{XX}DivorceOrchestrator.js
services/agents/prompts/{xx}Divorce/index.js
```

---

## Country-by-Country Implementation Plans

Each plan is designed so a parallel swarm can execute it independently.

---

## WAVE 1: Tier-1 Countries (HIGH priority, highest impact)

### PLAN 1: United Kingdom (uk.)

**Subdomain**: `uk.discover.legal`
**Jurisdictions**: 3 (ENG, SCO, NIR)
**Estimated Files**: 21 template files + 6 orchestrator/prompt files = 27

| Jurisdiction | Code | Directory Name |
|---|---|---|
| England & Wales | ENG | `uk_england` |
| Scotland | SCO | `uk_scotland` |
| Northern Ireland | NIR | `uk_northern_ireland` |

**Key Legal Framework**:
- **ENG**: Divorce, Dissolution and Separation Act 2020 (no-fault since April 2022). CPR statements of truth replace affidavits for most civil proceedings. Oaths Act 1978.
- **SCO**: Divorce (Scotland) Act 1976 + Family Law (Scotland) Act 2006. Still fault-based (4 facts). Affidavits remain primary. Distinct terminology (pursuer/defender, confirmation not probate, interdict not injunction).
- **NIR**: Matrimonial Causes (NI) Order 1978. Still fault-based (5 facts, including 2-year filing bar). Only UK jurisdiction without no-fault divorce.

**Matter Type Mapping**:
| US Matter | ENG | SCO | NIR |
|---|---|---|---|
| custody | Child Arrangements Order | Residence/Contact Order | Residence/Contact Order |
| dvro | Non-Molestation Order | Non-Harassment Order/Interdict | Non-Molestation Order |
| small_claims | Small Claims Track (GBP 10K) | Simple Procedure (GBP 5K) | Small Claims (GBP 5K) |
| probate | Grant of Probate | Confirmation | Grant of Probate |
| emancipation | EXCLUDE | EXCLUDE | EXCLUDE |

**Special Considerations**:
- ENG needs dual-mode templates: statement of truth (default) + sworn affidavit (when court directs)
- SCO uses entirely different legal terminology — dedicated prompts essential
- All three use A4 paper, GBP currency

---

### PLAN 2: Republic of Ireland (ie.)

**Subdomain**: `ie.discover.legal`
**Jurisdictions**: 1 (IRL)
**Estimated Files**: 7

**Key Legal Framework**:
- Family Law (Divorce) Act 1996, as amended by Family Law Act 2019
- 2 years separation out of previous 3 years (reduced from 4 of 5)
- Sworn affidavits (no statement of truth system)
- Jurat requires identification of deponent by commissioner
- EUR currency

**Special Considerations**:
- Small claims limit only EUR 2,000 (consumer claims only)
- DV: Domestic Violence Act 2018 (Safety Order, Barring Order, etc.)
- Emancipation: EXCLUDE

---

### PLAN 3: Australia (au.)

**Subdomain**: `au.discover.legal`
**Jurisdictions**: 8 (NSW, VIC, QLD, WA_AU, SA_AU, TAS, ACT, NT_AU)
**Estimated Files**: 56 template + 16 orchestrator/prompt = 72

| Jurisdiction | Code | Directory Name |
|---|---|---|
| New South Wales | NSW | `au_new_south_wales` |
| Victoria | VIC | `au_victoria` |
| Queensland | QLD | `au_queensland` |
| Western Australia | WA_AU | `au_western_australia` |
| South Australia | SA_AU | `au_south_australia` |
| Tasmania | TAS | `au_tasmania` |
| Australian Capital Territory | ACT | `au_act` |
| Northern Territory | NT_AU | `au_northern_territory` |

**Key Legal Framework**:
- Divorce is FEDERAL: Family Law Act 1975 (Cth), no-fault, 12-month separation
- WA exception: Family Court of Western Australia (own forms/rules)
- Affidavit law varies by state (Oaths Act 1900 NSW, Oaths Act 1867 QLD, etc.)
- DV orders vary by state (ADVO NSW, FVIO VIC, DVO QLD, FVRO WA, etc.)
- Small claims vary (NSW $20K, VIC $10K, QLD $25K, TAS $5K, etc.)

**Matters to EXCLUDE**: emancipation, legal_separation (no formal process in AU)

**Special Considerations**:
- Divorce metadata is nearly identical across all 8 (federal law) — use shared base
- Affidavit metadata varies per state — each needs own metadata.json
- Emergency number: 000 (not 911)
- DV hotline: 1800 RESPECT (1800 737 732)
- AUD currency, A4 paper

---

### PLAN 4: New Zealand (nz.)

**Subdomain**: `nz.discover.legal`
**Jurisdictions**: 1 (NZ)
**Estimated Files**: 7

**Key Legal Framework**:
- Family Proceedings Act 1980 — no-fault, 2-year separation (notably longer than AU/CA)
- Oaths and Declarations Act 1957
- Care of Children Act 2004 (custody = "day-to-day care" and "contact")
- Family Violence Act 2018 (replaced DV Act 1995)
- NZD currency, A4 paper, emergency: 111

**Matters to EXCLUDE**: emancipation, legal_separation

---

### PLAN 5: Singapore (sg.)

**Subdomain**: `sg.discover.legal`
**Jurisdictions**: 1 (SG)
**Estimated Files**: 7

**Key Legal Framework**:
- Women's Charter (Cap 353) — irretrievable breakdown, 5 facts, 3-year minimum marriage
- Dual system: civil (Women's Charter) + Syariah (AMLA) for Muslims
- Tool covers civil track only
- Family Justice Courts (established 2014)
- SGD currency, A4 paper

---

### PLAN 6: Hong Kong (hk.)

**Subdomain**: `hk.discover.legal`
**Jurisdictions**: 1 (HK)
**Estimated Files**: 7

**Key Legal Framework**:
- Matrimonial Causes Ordinance (Cap 179) — irretrievable breakdown, 5 facts
- Oaths and Declarations Ordinance (Cap 11)
- Common law maintained post-1997 under "one country, two systems"
- HKD currency, A4 paper

---

### PLAN 7: South Africa (sa.)

**Subdomain**: `sa.discover.legal`
**Jurisdictions**: 1 unified (ZA), 9 provinces as filing locations
**Estimated Files**: 7

**Key Legal Framework**:
- Divorce Act 70 of 1979 — irretrievable breakdown (no-fault)
- Justices of the Peace and Commissioners of Oaths Act 16 of 1963
- Children's Act 38 of 2005 (care, contact, guardianship — not "custody")
- Domestic Violence Act 116 of 1998
- Recognition of Customary Marriages Act 120 of 1998
- ZAR currency, A4 paper
- DV hotline: GBV Command Centre 0800-428-428

---

### PLAN 8: Nigeria (ng.)

**Subdomain**: `ng.discover.legal`
**Jurisdictions**: 12 common-law-primary states
**Estimated Files**: 84

| State | Code | Directory |
|---|---|---|
| Lagos | LA_NG | `ng_lagos` |
| FCT Abuja | FC | `ng_fct` |
| Rivers | RV | `ng_rivers` |
| Cross River | CR | `ng_cross_river` |
| Edo | ED | `ng_edo` |
| Delta | DT | `ng_delta` |
| Oyo | OY | `ng_oyo` |
| Ogun | OG | `ng_ogun` |
| Anambra | AN | `ng_anambra` |
| Enugu | EN | `ng_enugu` |
| Imo | IM | `ng_imo` |
| Abia | AB_NG | `ng_abia` |

**Key Legal Framework**:
- Matrimonial Causes Act 1970 (statutory marriages only)
- Evidence Act 2011 (affidavits)
- 2-year minimum marriage before petition
- Fault-based with irretrievable breakdown (8 facts)
- VAPP Act 2015 (DV — FCT only; state-level varies)
- NGN currency, A4 paper

---

### PLAN 9: Kenya (ke.)

**Subdomain**: `ke.discover.legal`
**Jurisdictions**: 1 (KE)
**Estimated Files**: 7

**Key Legal Framework**:
- Marriage Act 2014 — fault-based + irretrievable breakdown
- 3-year minimum marriage before petition
- Oaths and Statutory Declarations Act (Cap 15)
- Protection Against Domestic Violence Act 2015
- KES currency, A4 paper

---

### PLAN 10: Ghana (gh.)

**Subdomain**: `gh.discover.legal`
**Jurisdictions**: 1 (GH)
**Estimated Files**: 7

**Key Legal Framework**:
- Matrimonial Causes Act 1971 (Act 367) — irretrievable breakdown, 5 facts
- 2-year minimum marriage
- Oaths Act 1972
- Domestic Violence Act 2007 (Act 732)
- GHS currency, A4 paper

---

### PLAN 11: India (in.)

**Subdomain**: `in.discover.legal`
**Jurisdictions**: 16 states/UTs
**Estimated Files**: ~160 (personal law tracks multiply complexity)

| State/UT | Code | Directory |
|---|---|---|
| Delhi | IN_DL | `in_delhi` |
| Maharashtra | IN_MH | `in_maharashtra` |
| Karnataka | IN_KA | `in_karnataka` |
| Tamil Nadu | IN_TN | `in_tamil_nadu` |
| Gujarat | IN_GJ | `in_gujarat` |
| Uttar Pradesh | IN_UP | `in_uttar_pradesh` |
| West Bengal | IN_WB | `in_west_bengal` |
| Telangana | IN_TS | `in_telangana` |
| Rajasthan | IN_RJ | `in_rajasthan` |
| Kerala | IN_KL | `in_kerala` |
| Punjab | IN_PB | `in_punjab` |
| Haryana | IN_HR | `in_haryana` |
| Madhya Pradesh | IN_MP | `in_madhya_pradesh` |
| Bihar | IN_BR | `in_bihar` |
| Odisha | IN_OD | `in_odisha` |
| Andhra Pradesh | IN_AP | `in_andhra_pradesh` |

**CRITICAL: Personal Law System**
India requires a personal law track selector during triage:
- Hindu (HMA 1955) — Hindus, Buddhists, Jains, Sikhs
- Muslim (DMMA 1939 + Muslim personal law)
- Christian (Indian Divorce Act 1869)
- Parsi (PMDA 1936)
- Special Marriage Act 1954 (civil/inter-religious)

**Architecture Impact**: Divorce prompts need 5 variants per jurisdiction (one per personal law track). Affidavit templates are uniform. Stamp paper values vary by state.

**Key Legal Framework**:
- Indian Oaths Act 1969 (affidavits)
- PWDVA 2005 (DV protection)
- INR currency, A4 paper
- DV hotline: 181 (Women Helpline)

---

## WAVE 2: Tier-2 Countries (MEDIUM priority)

### PLAN 12: Jamaica (jm.) — 1 jurisdiction, 7 files
- Matrimonial Causes Act, Property (Rights of Spouses) Act 2004, Domestic Violence Act

### PLAN 13: Trinidad & Tobago (tt.) — 1 jurisdiction, 7 files
- Matrimonial Proceedings and Property Act, Domestic Violence Act 1999

### PLAN 14: Malaysia (my.) — 1 jurisdiction (civil track), 7 files
- Law Reform (Marriage and Divorce) Act 1976 (non-Muslims only)
- Dual system: civil courts (non-Muslim) + Syariah courts (Muslim)

### PLAN 15: Fiji (fj.) — 1 jurisdiction, 7 files
- Family Law Act 2003 (modeled on Australia's FLA 1975), no-fault, 12-month separation

### PLAN 16: Pakistan (pk.) — 5 jurisdictions, 35 files
- Muslim Family Laws Ordinance 1961 (MFLO), DMMA 1939
- Talaq (90-day reconciliation via Union Council), Khula, Faskh

### PLAN 17: Uganda (ug.) — 1 jurisdiction, 7 files
- Divorce Act (Cap 249), Domestic Violence Act 2010

### PLAN 18: Tanzania (tz.) — 1 jurisdiction, 7 files
- Law of Marriage Act 1971, mandatory Marriage Conciliation Board

### PLAN 19: Zambia (zm.) — 1 jurisdiction, 7 files
- Matrimonial Causes Act 2007 (modern), Anti-Gender Based Violence Act 2011

### PLAN 20: Zimbabwe (zw.) — 1 jurisdiction, 7 files
- Matrimonial Causes Act 1985, Domestic Violence Act 2006

### PLAN 21: Botswana (bw.) — 1 jurisdiction, 7 files
- Matrimonial Causes Act 1973, Domestic Violence Act 2008

### PLAN 22: Malawi (mw.) — 1 jurisdiction, 7 files
- Marriage, Divorce and Family Relations Act 2015 (modern), Prevention of DV Act 2006

### PLAN 23: Namibia (na.) — 1 jurisdiction, 7 files
- Common law + pre-independence SA statutes; Dissolution of Marriages Act 2024 (pending)

### PLAN 24: Barbados (bb.) — 1 jurisdiction, 7 files
- Family Law Act Cap 214 (comprehensive, no-fault, 12-month separation)

### PLAN 25: Bahamas (bs.) — 1 jurisdiction, 7 files
- Matrimonial Causes Act Cap 125 (fault-based)

### PLAN 26: Bermuda (bm.) — 1 jurisdiction, 7 files
- Matrimonial Causes Act 1974 + No-Fault Amendment 2022

### PLAN 27: Cyprus (cy.) — 1 jurisdiction, 7 files
- Marriage Law 2003, mixed common law + continental

### PLAN 28: Bangladesh (bd.) — 1 jurisdiction, 7 files
- MFLO 1961, DMMA 1939, Family Courts Ordinance 1985
- NOTE: No Hindu divorce law exists in Bangladesh

### PLAN 29: Sri Lanka (lk.) — 1 jurisdiction, 7 files (but needs personal law variants)
- Mixed: Roman-Dutch (general), Kandyan, Tesawalamai, Muslim (MMDA 1951)

### PLAN 30: Papua New Guinea (pg.) — 1 jurisdiction, 7 files
- Matrimonial Causes Act 1963, fault-based

---

## WAVE 3: Tier-3 Countries (LOW priority — smaller populations)

### PLAN 31-36: ECSC Caribbean Bundle
Antigua & Barbuda (AG), Dominica (DM), Grenada (GD), St Kitts & Nevis (KN), St Vincent (VC), Guyana (GY), Belize (BZ) — 7 jurisdictions, 49 files total

These share the Eastern Caribbean Supreme Court and significant legislative overlap. A `BaseECSCTemplate` can minimize per-jurisdiction code.

---

## Excluded Jurisdictions (with rationale)

| Country | Reason |
|---|---|
| Myanmar | Political instability, disrupted judiciary |
| Brunei | Syariah dominant, politically sensitive |
| Malta | Civil law system (not common law for family) |
| Rwanda | Civil law system (German/Belgian origin) |
| Mauritius | Civil law family system (Code Civil) |
| Seychelles | Civil law family system, population 100K |
| Cameroon | Common law only in 2 of 10 regions, instability |
| Lesotho | No comprehensive divorce statute, population 2.3M |
| Eswatini | Population 1.2M, limited legal tech |
| Gambia | Population 2.5M, Sharia for personal law |
| Sierra Leone | Limited court infrastructure |
| Liberia | Limited legal tech, population 5.3M |
| Tuvalu | Population 11K |
| Nauru | Population 12.5K |
| Kiribati | Population 120K |
| Marshall Islands | US-influenced (not British CL) |
| Palau | US-influenced, population 18K |
| Micronesia | US-influenced, population 105K |
| St Lucia | Mixed French civil + English CL |
| Gibraltar | Population 34K, mirrors UK law |

---

## Implementation Phasing for Parallel Swarms

### Phase A: Architecture Foundation (must complete first)
**Single swarm, blocking**
1. Extend `detectCountry()` to universal country detection
2. Add all subdomains to CORS/CSRF/CSP (3 files)
3. Extend template metadata schema (countryCode, currency, paperSize, etc.)
4. Add A4 paper support to PDF service
5. Add currency formatting support
6. Extend catalog.js with all jurisdiction arrays
7. Update triage prompt with country-specific safety hotlines

### Phase B: Wave 1 Countries (11 parallel swarms)
Each swarm is independent — can run simultaneously:

| Swarm | Country | Jurisdictions | Files | Complexity |
|---|---|---|---|---|
| B1 | UK | 3 | 27 | HIGH (3 different legal systems) |
| B2 | Ireland | 1 | 7 | LOW |
| B3 | Australia | 8 | 72 | MEDIUM (federal divorce + state variation) |
| B4 | New Zealand | 1 | 7 | LOW |
| B5 | Singapore | 1 | 7 | LOW |
| B6 | Hong Kong | 1 | 7 | LOW |
| B7 | South Africa | 1 | 7 | LOW |
| B8 | Nigeria | 12 | 84 | MEDIUM (12 states) |
| B9 | Kenya | 1 | 7 | LOW |
| B10 | Ghana | 1 | 7 | LOW |
| B11 | India | 16 | 160 | VERY HIGH (personal law tracks) |

### Phase C: Wave 2 Countries (18 parallel swarms)
Each independent:

| Swarm | Country | Files | Complexity |
|---|---|---|---|
| C1 | Jamaica | 7 | LOW |
| C2 | Trinidad & Tobago | 7 | LOW |
| C3 | Malaysia | 7 | LOW (civil track) |
| C4 | Fiji | 7 | LOW |
| C5 | Pakistan | 35 | MEDIUM |
| C6 | Uganda | 7 | LOW |
| C7 | Tanzania | 7 | LOW |
| C8 | Zambia | 7 | LOW |
| C9 | Zimbabwe | 7 | LOW |
| C10 | Botswana | 7 | LOW |
| C11 | Malawi | 7 | LOW |
| C12 | Namibia | 7 | LOW |
| C13 | Barbados | 7 | LOW |
| C14 | Bahamas | 7 | LOW |
| C15 | Bermuda | 7 | LOW |
| C16 | Cyprus | 7 | LOW |
| C17 | Bangladesh | 7 | LOW |
| C18 | Sri Lanka | 7 | MEDIUM (personal law) |

### Phase D: Wave 3 — ECSC Caribbean Bundle (1 swarm)
| Swarm | Countries | Files |
|---|---|---|
| D1 | AG, DM, GD, KN, VC, GY, BZ | 49 |

---

## Total File Estimates

| Phase | Countries | New Jurisdictions | New Files (est.) |
|---|---|---|---|
| A (Architecture) | - | 0 | ~15 modified |
| B (Wave 1) | 11 | 46 | ~392 |
| C (Wave 2) | 18 | 24 | ~147 |
| D (Wave 3) | 7 | 7 | ~49 |
| **TOTAL** | **36** | **77** | **~588 new + 15 modified** |

(Excluding India's personal law track variants which could add ~80 more prompt files)

---

## Key Cross-Cutting Concerns

### 1. Paper Size
- US/CA: Letter (8.5" x 11")
- All others: A4 (210mm x 297mm)

### 2. Witness/Oath Types
| Country | Primary Witness |
|---|---|
| US | Notary Public |
| CA | Commissioner for Taking Oaths |
| UK (ENG) | Statement of Truth (no witness) / Solicitor for affidavits |
| UK (SCO/NIR) | Solicitor / Commissioner for Oaths |
| IE | Commissioner for Oaths (must identify deponent) |
| AU | Justice of the Peace / Australian Legal Practitioner |
| NZ | Solicitor of the High Court / JP |
| IN | Oath Commissioner / Notary Public (on stamp paper) |
| ZA | Commissioner of Oaths |
| NG | Commissioner for Oaths |
| SG/HK | Commissioner for Oaths |

### 3. Matters to EXCLUDE by Country
| Matter | Countries Where Excluded |
|---|---|
| emancipation | ALL non-US (does not exist outside US) |
| legal_separation | AU, NZ (no formal process) |

### 4. Personal Law Systems (adds triage complexity)
| Country | Personal Law Tracks |
|---|---|
| India | Hindu, Muslim, Christian, Parsi, Special Marriage Act |
| Sri Lanka | General (Roman-Dutch), Kandyan, Tesawalamai, Muslim |
| Pakistan | Muslim (primary), Christian, Hindu (since 2017) |
| Bangladesh | Muslim (primary), Hindu (NO divorce available) |
| Malaysia | Civil (non-Muslim) vs Syariah (Muslim) |
| Singapore | Civil (Women's Charter) vs Syariah (AMLA) |
| Nigeria | Statutory vs Customary vs Sharia |

### 5. Emergency Numbers & DV Hotlines
| Country | Emergency | DV Hotline |
|---|---|---|
| US | 911 | 1-800-799-7233 |
| CA | 911 | 1-800-363-9010 |
| UK | 999 | 0808 2000 247 |
| IE | 999/112 | 1800 341 900 |
| AU | 000 | 1800 737 732 |
| NZ | 111 | 0800 733 843 |
| IN | 112 | 181 |
| PK | 15 | 0800-22-444 |
| ZA | 10111 | 0800-428-428 |
| NG | 112 | 0800-0000-9999 |
| KE | 999 | +254-20-2726927 |
| GH | 999 | 0800-111-222 |
| SG | 999 | 1800-777-0000 |
| HK | 999 | 2522 0434 |

---

## Swarm Deployment Command Reference

To deploy any country swarm independently:

```bash
# Architecture foundation (run first, blocking)
npx @claude-flow/cli@latest swarm init --topology hierarchical --max-agents 8 --strategy specialized

# Then deploy country swarms in parallel (example for Wave 1):
# Each is an independent Agent with subagent_type "coder"
# with all research data embedded in the prompt
```

Each swarm should:
1. Create the directory structure under `templates/states/{country}_{jurisdiction}/`
2. Generate metadata.json with jurisdiction-specific legal data
3. Generate divorce-metadata.json with divorce law specifics
4. Create AffidavitTemplate.js extending BaseAffidavitTemplate
5. Create DivorcePetitionTemplate.js extending BaseDivorcePetitionTemplate
6. Create DivorceDecreeTemplate.js extending BaseDivorceDecreeTemplate
7. Create {XX}DivorceOrchestrator.js extending BaseDivorceOrchestrator
8. Create prompts/{xx}Divorce/index.js with jurisdiction-specific interview phases
9. Add jurisdiction to catalog.js arrays
10. Add orchestrator import to routes/chat.js
11. Write tests in `__tests__/templates/states/{jurisdiction}/`

---

## Legislation Quick Reference Index

Full legislation details for each country are in the research agent outputs:
- UK & Ireland: `tasks/a5a2db764a8e3d2ef.output`
- Australia & NZ: `tasks/ab49215455829de7a.output`
- India, Pakistan, Bangladesh, Sri Lanka: `tasks/a5bea04f1c3103de1.output`
- Africa (SA, NG, KE, GH + 7 more): `tasks/ae43d6ab68efeb801.output`
- Caribbean, Pacific, SE Asia: `tasks/af59867cc068b65fe.output`
