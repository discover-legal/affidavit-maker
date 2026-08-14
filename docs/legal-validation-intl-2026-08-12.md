# International Jurisdiction Legal Validation — 2026-08-12

Automated validation of the legal claims encoded in all 46 international
divorce templates (12 Nigerian states, 16 Indian states, 8 Australian
states/territories, England & Wales, Scotland, Northern Ireland, Ireland,
Ghana, Kenya, South Africa, Hong Kong, New Zealand, Singapore) — the
jurisdictions behind the ENABLE_INTERNATIONAL flag. Ten research passes
verified six claims per jurisdiction — residency/jurisdiction, waiting
period, court, instrument terminology, grounds, and citations — against
primary sources (national legislation databases, court websites, official
form guides). Same methodology as the 64-jurisdiction NA pass
(legal-validation-2026-08-12.md). Every WRONG verdict carries a source URL;
every WRONG was fixed in the same change set unless noted below. Full
per-claim verdicts: legal-validation-intl-2026-08-12.verdicts.json.

**Verdicts: 276 claims checked — 220 confirmed, 56 wrong (fixed), 0 uncertain.**

Standout findings (all fixed):
- **Ghana** rendered a Decree Nisi → Decree Absolute process that does not
  exist — MCA 1971 s.37 makes every Ghanaian decree final from judgment. The
  decree template produced a fictitious instrument.
- **Kenya** captioned petitions to the High Court; the Marriage Act 2014 s.2
  defines the divorce court as a resident magistrate's court.
- **Singapore** still styled parties Plaintiff/Defendant and "Divorce Suit
  No." — post-Oct-2024 practice is Applicant/Respondent, "FC/OA" numbers,
  and the interim judgment is made final as a "Final Judgment".
- **England & Wales** cited the repealed MCA 1973 s.5 for jurisdiction
  (correct: DMPA 1973 s.5(2)) and hung the 20-week/6-week structure on a
  nonexistent "DDSA 2020 s.1(5)" (correct: MCA 1973 s.1(5)/(4)(b) as
  substituted).
- **Scotland** claimed 40 days' residence confers divorce jurisdiction — the
  40 days is only the sheriffdom venue limb; jurisdiction needs domicile or
  a year's habitual residence.
- **India (all mutual-consent paths)**: petitions defaulted to an adversarial
  "A VERSUS B" caption, but HMA s.13B/SMA s.28 petitions are presented
  jointly — captions now render Petitioner No. 1 / Petitioner No. 2.
- **Nigeria (all 12 states)**: the restitution-of-conjugal-rights ground
  omitted the statutory one-year non-compliance element (MCA s.15(2)(g)).
- **Australia (NSW/QLD/VIC)**: legalCitations still cited the Family Law
  Rules 2004, repealed 1 Sept 2021 (now FCFCOA (Family Law) Rules 2021);
  VIC/NSW described the 12-month separation as complete "before hearing"
  when s.48(2) requires it before filing.

## Defects found and fixed

| Jurisdiction | Claim | Finding | Source |
|---|---|---|---|
| Andhra Pradesh (IN) | court | Family Court, Vijayawada (NTR district) or Family Court, Visakhapatnam — there is no 'Family Court, Amaravati'. Amaravati is the seat of the AP High Court only; the capital-region villages fall under the Guntur/Palnadu district... | https://districts.ecourts.gov.in/ap |
| Andhra Pradesh (IN) | citation | legalCitations should read 'Divorce Act, 1869' — the Indian Divorce (Amendment) Act 2001 (Act 51 of 2001, w.e.f. 3-10-2001) substituted 'Divorce Act' for 'Indian Divorce Act' in the short title; India Code's official text is he... | https://www.indiacode.nic.in/bitstream/123456789/2280/1/A1869-04.pdf |
| Delhi (IN) | terminology | A mutual-consent petition under HMA s.13B(1)/SMA s.28(1) is presented 'by both the parties together' — it is a JOINT petition captioned with both spouses as Petitioner No. 1 and Petitioner No. 2 (no 'VERSUS', no Respondent). Th... | https://www.indiacode.nic.in/bitstream/123456789/15480/1/special_marriage_act.pdf |
| Delhi (IN) | grounds | (1) Presumed death under the Special Marriage Act is s.27(1)(h), not s.27(1)(g) — clause (g) was the leprosy ground (since omitted by the Personal Laws (Amendment) Act 2019); the SMA's own s.27A refers to the presumed-death gro... | https://www.indiacode.nic.in/bitstream/123456789/15480/1/special_marriage_act.pdf |
| Delhi (IN) | citation | The statute governing Christian divorce is 'The Divorce Act, 1869' — the Indian Divorce (Amendment) Act 2001 (in force 3 Oct 2001) omitted the word 'Indian' from the short title in s.1. legalCitations and the template header sh... | https://www.indiacode.nic.in/bitstream/123456789/2280/1/A1869-04.pdf |
| England & Wales (UK) | residency | Jurisdiction is governed by the Domicile and Matrimonial Proceedings Act 1973, s.5(2) (as amended by the Jurisdiction and Judgments (Family) (Amendment etc.) (EU Exit) Regulations 2019): the court has jurisdiction if, among oth... | https://www.legislation.gov.uk/ukpga/1973/45/section/5 |
| England & Wales (UK) | waitingPeriod | 20-week period: Matrimonial Causes Act 1973, s.1(5) (as substituted by DDSA 2020, s.1). 6-week conditional-to-final period: MCA 1973, s.1(4)(b) (as substituted). Days=140 and the 20-week + 6-week structure are accurate. | https://www.legislation.gov.uk/ukpga/1973/18/section/1 |
| England & Wales (UK) | grounds | Sole ground: Matrimonial Causes Act 1973, s.1(1) (as substituted by the Divorce, Dissolution and Separation Act 2020, s.1) — either or both parties may apply for a divorce order on the ground that the marriage has broken down i... | https://www.legislation.gov.uk/ukpga/1973/18/section/1 |
| England & Wales (UK) | citation | Relief should seek a final order 'pursuant to section 1 of the Matrimonial Causes Act 1973 (as substituted by the Divorce, Dissolution and Separation Act 2020)'; the statement of truth in family proceedings is governed by Famil... | https://www.legislation.gov.uk/ukpga/1973/18/section/1 |
| FCT Abuja (NG) | grounds | MCA s.15(2)(g) requires that the other party has, for a period of not less than one year, failed to comply with a decree of restitution of conjugal rights made under the Act; the restitution entry and rendered petition text omi... | https://lawsofnigeria.placng.org/laws/M7.pdf |
| Ghana | waitingPeriod | No mandatory waiting period after filing. The petitioner must inform the court of all reconciliation efforts (MCA s.8(1)), and the court MAY adjourn proceedings to attempt reconciliation where a reasonable possibility appears (... | https://judicial.gov.gh/jsweb/acts/matrimonialcausesact.pdf |
| Ghana | terminology | Under MCA 1971 s.37 a decree of divorce is final and takes effect from the date the court gives judgment. There is no Decree Nisi / Decree Absolute stage in Ghana; the court grants a single decree of dissolution. | https://judicial.gov.gh/jsweb/acts/matrimonialcausesact.pdf |
| Ghana | grounds | MCA s.1(2): the sole ground for divorce is that the marriage has broken down beyond reconciliation, shown under s.2(1) by one or more of SIX facts: (a) adultery + intolerability; (b) unreasonable behaviour; (c) desertion for 2 ... | https://judicial.gov.gh/jsweb/acts/matrimonialcausesact.pdf |
| Ghana | citation | Cite spousal maintenance to MCA 1971 s.19 (financial provision for spouse; s.20 is property settlement); cite the sole ground to s.1(2) using the statutory phrase 'broken down beyond reconciliation'; cite Islamic marriage to th... | https://judicial.gov.gh/jsweb/acts/matrimonialcausesact.pdf |
| Hong Kong | residency | Matrimonial Causes Ordinance (Cap. 179), s.3: the court has jurisdiction if (a) either party was domiciled in Hong Kong at the date of the petition or application; (b) either party was habitually resident in Hong Kong throughou... | https://www.judiciary.hk/en/court_services_facilities/divorce.html |
| Hong Kong | court | Caption should read 'IN THE DISTRICT COURT OF THE HONG KONG SPECIAL ADMINISTRATIVE REGION / MATRIMONIAL CAUSES / NUMBER FCMC [number] OF [year]' (the Family Court being a division of the District Court; filings go to the Family... | https://www.paynevelasco.com/wp-content/uploads/2018/12/FCMC010889_2014-13-04-2021.pdf |
| Hong Kong | terminology | Form 2 = Petition; Form 2B = Statement as to Arrangements for Children (Form 2D for joint applications); Form 2C = Joint Application; Form 2E = notice of intention to make a joint application; Form 4 = Acknowledgment of Service... | https://www.judiciary.hk/en/court_services_facilities/divorce.html |
| Hong Kong | citation | Property adjustment relief should cite MPPO (Cap 192) s.6 (and s.6A for orders for sale); s.7 should be cited only for the matters the court is to have regard to. | https://www.hugillandip.com/2019/01/family-focus-week-101-on-division-of-assets-in-divorce-proceedings/ |
| Imo (NG) | grounds | MCA s.15(2)(g) requires failure to comply with a decree of restitution of conjugal rights 'for a period of not less than one year'; the 'Restitution Failure — Failed restitution' entry and the template's rendered text 'Restitut... | https://lawsofnigeria.placng.org/laws/M7.pdf |
| Ireland | residency | Family Law (Divorce) Act 1996, s.39(1)(a) (domicile in the State on the date of institution) and s.39(1)(b) (ordinary residence in the State throughout the one year ending on that date). Cite s.39(1)(a)-(b) or simply s.39(1), n... | https://www.irishstatutebook.ie/eli/1996/act/33/enacted/en/print.html |
| Ireland | waitingPeriod | No mandatory post-filing waiting period; the spouses must have lived apart for at least 2 of the 3 years immediately preceding the DATE OF INSTITUTION OF THE PROCEEDINGS (Family Law (Divorce) Act 1996, s.5(1)(a) as amended), no... | https://www.irishstatutebook.ie/eli/1996/act/33/enacted/en/print.html |
| Ireland | grounds | Family Law (Divorce) Act 1996, s.5(1)(a), as amended by the Family Law Act 2019, s.3(1)(a) (No. 37 of 2019, commenced 1 December 2019). There is no s.9 in the Family Law Act 2019. | https://www.irishstatutebook.ie/eli/2019/act/37/enacted/en/html |
| Ireland | citation | Property adjustment orders: FLDA 1996 s.14. Financial compensation orders: s.16. Periodical payments and lump sums: s.13. Pension adjustment: s.17. Custody/access on divorce: FLDA 1996 s.5(2), directing orders under s.11 of the... | https://www.irishstatutebook.ie/eli/1996/act/33/enacted/en/print.html |
| Karnataka (IN) | terminology | Mutual-consent petitions under HMA s.13B(1)/SMA s.28(1) are presented 'by both the parties together' and captioned with both spouses as Petitioner No. 1 and Petitioner No. 2 — no 'VERSUS', no Respondent. Adversarial Petitioner/... | https://www.indiacode.nic.in/bitstream/123456789/15480/1/special_marriage_act.pdf |
| Kenya | residency | The Marriage Act 2014 contains no express residency requirement for divorce petitions. Jurisdiction follows the Act's definition of 'court' (s.2: a resident magistrate's court), and petitions are in practice filed at the magist... | https://new.kenyalaw.org/akn/ke/act/2014/4/eng@2022-12-31 |
| Kenya | waitingPeriod | No statutory waiting period. Conciliation under the Marriage Act 2014 is voluntary/discretionary and marriage-type specific: s.64 (Christian, optional church reconciliation), s.66(4) (civil, court may refer to a conciliatory pr... | https://new.kenyalaw.org/akn/ke/act/2014/4/eng@2022-12-31 |
| Kenya | court | Divorce petitions under the Marriage Act 2014 are filed in the magistrates' courts - caption e.g. 'IN THE CHIEF MAGISTRATE'S COURT AT [STATION], DIVORCE CAUSE NO. ___' ('court' = resident magistrate's court, Marriage Act 2014 s... | https://new.kenyalaw.org/akn/ke/act/2014/4/eng@2022-12-31 |
| Kenya | grounds | s.66(2) civil-marriage grounds: (a) adultery; (b) cruelty; (c) exceptional depravity; (d) desertion for at least three years; (e) irretrievable breakdown. There is no overarching breakdown requirement; s.66(6) deems irretrievab... | https://new.kenyalaw.org/akn/ke/act/2014/4/eng@2022-12-31 |
| Kenya | citation | Cite conciliation to ss.64, 66(4) and 68 (none mandatory); drop the s.65 residency recital; cite the three-year-bar litigation as National Assembly of Kenya v Kina & another, Civil Appeal 166 of 2019, [2022] KECA 548 (10 June 2... | https://new.kenyalaw.org/akn/ke/judgment/keca/2022/548/eng@2022-06-10 |
| Kerala (IN) | citation | legalCitations should read 'Divorce Act, 1869' — the Indian Divorce (Amendment) Act 2001 (Act 51 of 2001, w.e.f. 3-10-2001) renamed the 'Indian Divorce Act'; India Code's official text is headed 'THE DIVORCE ACT, 1869'. Same fi... | https://www.indiacode.nic.in/bitstream/123456789/2280/1/A1869-04.pdf |
| Lagos (NG) | grounds | MCA s.15(2)(g): 'that the other party to the marriage has, for a period of not less than one year, failed to comply with a decree of restitution of conjugal rights made under this Act.' The restitution entry and the template's ... | https://lawsofnigeria.placng.org/laws/M7.pdf |
| Maharashtra (IN) | terminology | Mutual-consent petitions under HMA s.13B(1)/SMA s.28(1) are joint petitions presented 'by both the parties together', captioned Petitioner No. 1 / Petitioner No. 2 — no 'VERSUS', no Respondent. Petitioner-versus-Respondent styl... | https://www.indiacode.nic.in/bitstream/123456789/15480/1/special_marriage_act.pdf |
| Maharashtra (IN) | grounds | Presumed death under the Special Marriage Act is s.27(1)(h), not s.27(1)(g). Clause (g) was the leprosy ground (omitted by the Personal Laws (Amendment) Act 2019); SMA s.27A itself identifies presumed death as 'clause (h) of su... | https://www.indiacode.nic.in/bitstream/123456789/15480/1/special_marriage_act.pdf |
| Maharashtra (IN) | citation | Cite 'The Divorce Act, 1869' — the Indian Divorce (Amendment) Act 2001 removed 'Indian' from the short title; India Code's official text is 'THE DIVORCE ACT, 1869'. The legalCitations entry and the template's header comment bot... | https://www.indiacode.nic.in/bitstream/123456789/2280/1/A1869-04.pdf |
| New South Wales (AU) | waitingPeriod | The 12-month separation must be complete before the application is FILED (Family Law Act 1975 (Cth) s.48(2)); FCFCOA requires separation of 12 months and 1 day before filing. No waiting period after filing; the divorce order ta... | https://web.archive.org/web/20260609203620/https://www.fcfcoa.gov.au/fl/divorce/apply |
| New South Wales (AU) | citation | Replace 'Family Law Rules 2004 (Cth)' with 'Federal Circuit and Family Court of Australia (Family Law) Rules 2021 (Cth)' in divorce-metadata.json legalCitations and in the template header comments — the 2004 Rules are repealed. | https://www.legislation.gov.au/F2003B00392/latest |
| New Zealand | residency | Either spouse must be domiciled in New Zealand at the time the application is filed - Family Proceedings Act 1980, s.37 (not s.38). | https://communitylaw.org.nz/community-law-manual/chapter-12-relationships-and-break-ups/divorce-getting-a-dissolution-order/requirements-for-getting-a-dissolution/ |
| New Zealand | waitingPeriod | Family Proceedings Act 1980, s.42: an order made by a Registrar takes effect as a final order 1 month after it is made (so waitingPeriod.days should be ~30 for the standard route); an order made by a Family Court Judge at the h... | https://communitylaw.org.nz/community-law-manual/chapter-11-relationships-and-break-ups/divorce-getting-a-dissolution-order/the-dissolution-order-how-it-gets-made-and-when-it-takes-effect/ |
| New Zealand | citation | In the template: cite Family Proceedings Act 1980 s.37 for the domicile requirement and s.42 for when a dissolution order takes effect (Registrar-made orders final after 1 month). | https://communitylaw.org.nz/community-law-manual/chapter-11-relationships-and-break-ups/divorce-getting-a-dissolution-order/the-dissolution-order-how-it-gets-made-and-when-it-takes-effect/ |
| Northern Ireland (UK) | residency | Jurisdiction: Matrimonial Causes (Northern Ireland) Order 1978, Article 49 (as amended post-EU-exit) — including either party domiciled in Northern Ireland, the applicant habitually resident there for at least one year (six mon... | https://www.legislation.gov.uk/nisi/1978/1045/article/49 |
| Northern Ireland (UK) | grounds | Art.3(2)(a): 'since the date of the marriage, the respondent has committed adultery' — adultery simpliciter, following the Scottish formulation; no requirement that the petitioner finds it intolerable to live with the respondent. | https://www.legislation.gov.uk/nisi/1978/1045/article/3 |
| Ogun (NG) | grounds | MCA s.15(2)(g) requires failure to comply with a restitution-of-conjugal-rights decree 'for a period of not less than one year'; the 'Restitution Failure — Failed restitution' entry and the rendered text 'Restitution failure (M... | https://lawsofnigeria.placng.org/laws/M7.pdf |
| Oyo (NG) | grounds | MCA s.15(2)(g) requires failure to comply with a restitution-of-conjugal-rights decree 'for a period of not less than one year'; the 'Restitution Failure — Failed restitution' entry and the rendered text 'Failure to comply with... | https://lawsofnigeria.placng.org/laws/M7.pdf |
| Punjab (IN) | court | Default court should be a Family Court in a Punjab district — e.g. 'Family Court, Ludhiana' (Punjab's largest city; four family courts per The Tribune, https://www.tribuneindia.com/news/city-gets-one-more-family-court-28009), o... | https://chandigarhdistrict.nic.in/courts/ |
| Queensland (AU) | citation | Replace 'Family Law Rules 2004 (Cth)' with 'Federal Circuit and Family Court of Australia (Family Law) Rules 2021 (Cth)' in divorce-metadata.json legalCitations and the template header comment — the 2004 Rules are repealed. | https://www.legislation.gov.au/F2003B00392/latest |
| Rivers (NG) | grounds | MCA s.15(2)(g): 'that the other party to the marriage has, for a period of not less than one year, failed to comply with a decree of restitution of conjugal rights made under this Act.' The restitution entry and the template's ... | https://lawsofnigeria.placng.org/laws/M7.pdf |
| Scotland (UK) | residency | Sheriff court divorce jurisdiction (DMPA 1973, s.8(2)): (a) either party is domiciled in Scotland on the date the action is begun or was habitually resident in Scotland throughout the one year ending with that date, AND (b) eit... | https://www.legislation.gov.uk/ukpga/1973/45/section/8 |
| Scotland (UK) | terminology | Simplified ('do it yourself') divorce application forms: sheriff court Form F31 (1-year separation with consent, s.1(2)(d)) and Form F33 (2-year separation, s.1(2)(e)); Court of Session Forms SPA and SPB. Not F26/F28. | https://www.scotcourts.gov.uk/media/ehunf4vn/form-f31.doc |
| Singapore | waitingPeriod | s.94 3-year bar as stated; and: after the Interim Judgment, the divorce may not be made final before 3 months from its grant (Women's Charter 1961, s.99(1), court may shorten); parties then extract the Final Judgment (3 months ... | https://sso.agc.gov.sg/Act/WC1961?ProvIds=pr93-,pr94-,pr95-,pr95A-,pr99- |
| Singapore | terminology | Parties: Applicant / Respondent (plaintiff/defendant only for pre-15-Oct-2024 filings); case number: 'No. FC/OA [number]/[year]'; judgments: Interim Judgment then Final Judgment. | https://www.judiciary.gov.sg/docs/default-source/news-and-resources-docs/fjr-2024/fjcpd-2024-appendix-a-volume-1.pdf?sfvrsn=50b23d7f_1 |
| Singapore | citation | Cite: Administration of Muslim Law Act 1966; Guardianship of Infants Act 1934; and replace the nonexistent 'Family Justice (Maintenance and Child Welfare) Rules 2024' with the actual FJR 2024 instruments (principally the Family... | https://www.judiciary.gov.sg/family/family-justice-rules-2024/applicable-family-justice-rules |
| South Africa | grounds | Both statutory grounds are no-fault: s.4 irretrievable breakdown - with s.4(2) expressly listing one year's separation, adultery + irreconcilability, and habitual-criminal imprisonment as facts the court may accept as proof (wi... | https://commons.laws.africa/akn/za/act/1979/70/eng@1996-11-22.pdf |
| South Africa | citation | Cite the Constitutional Court redistribution judgment as EB (born S) v ER (born B) N.O. and Others; KG v Minister of Home Affairs and Others [2023] ZACC 32; 2024 (2) SA 1 (CC) (10 October 2023), not 'RB v JB 2023'. | https://www.saflii.org/za/cases/ZACC/2023/32.html |
| Tamil Nadu (IN) | terminology | Mutual-consent petitions under HMA s.13B(1)/SMA s.28(1) are joint petitions presented 'by both the parties together', captioned Petitioner No. 1 / Petitioner No. 2 without 'VERSUS' or a Respondent; in Chennai practice they are ... | https://www.indiacode.nic.in/bitstream/123456789/15480/1/special_marriage_act.pdf |
| Victoria (AU) | waitingPeriod | The 12-month separation must be complete before the application is FILED (FLA 1975 (Cth) s.48(2): 'immediately preceding the date of the filing of the application'). No post-filing waiting period; the divorce order takes effect... | https://www.legislation.gov.au/C2004A00275/2025-06-10/2025-06-10/text/original/epub/OEBPS/document_1/document_1.html |
| Victoria (AU) | citation | Replace 'Family Law Rules 2004 (Cth)' with 'Federal Circuit and Family Court of Australia (Family Law) Rules 2021 (Cth)' (in force since 1 September 2021; the 2004 Rules are repealed). In the template header, cite the Oaths and... | https://www.legislation.gov.au/F2021L01197/2023-01-01/2023-01-01/text/original/epub/OEBPS/document_1/document_1.html |

## Interview prompts corrected too

The AI-interview orchestrator prompts (`services/agents/prompts/*Divorce/`)
carried the same stale law and were swept for every defect class fixed in the
templates: Ghana's fictional decree-nisi process and mandatory reconciliation,
Kenya's High Court forum and grounds letters, Singapore's Plaintiff/Defendant
styling and repealed Cap numbers, New Mexico's nonexistent cooling-off,
Nevada's repealed NRS 125B schedule, the repealed Family Law Rules 2004 (AU),
the Indian Divorce Act rename and stamp-paper overstatement, Hong Kong's
missing substantial-connection limb and form misassignments, New Zealand's
s.37/s.42 pinpoints, South Africa's s.4(2) facts, the Nigerian restitution
one-year element, and New Hampshire's swapped RSA 458:7 paragraphs and
pre-2019 alimony statute.

## Notes — flagged but not graded WRONG (ALL ADDRESSED in the 2026-08-14 follow-up)

Cross-cutting observations recorded in the verdicts JSON that did not flip a
verdict. Every item below was subsequently fixed in the follow-up pass
completed 2026-08-14 (India: s.13(1A) + wife-only s.13(2) grounds added to all
16 states, DMMA wife-only caveat, location-aware default courts, real docket
labels (HMA No./M.C. No./Petition No./O.P. No.), Maharashtra stamp duty
corrected to the INR 500 2024 ordinance; Nigeria: s.2(3) any-state
jurisdiction, s.30(2) bar exceptions, s.57 child gate in all 12, s.16(2)(a)
presumption pinpoint, compact grounds fleshed out to full statutory elements;
Australia: divorce-order-only ORDERS SOUGHT with a separate-Initiating-
Application note, "(DIVISION 2)" captions for the 7 FCFCOA states,
Proof-of-Separation marked conditional; UK/Ireland: England fee £628,
Scotland interim-gender-recognition ground + SHERIFFDOM heading, Ireland
requiredForms, NI Art.26A; Kenya: "Divorce Cause No." styling). The original
observations, for the record:
- India: HMA s.13(1A) and the wife-only s.13(2) grounds are absent from the
  factory states' metadata (present in Delhi's bespoke set); DMMA grounds are
  wife-only, which the Muslim triage note doesn't say; local docket
  conventions differ from the generic "Case No." (HMA No. in Delhi, M.C. No.
  in Bengaluru, O.P. No. in Chennai); hardcoded single-city default courts
  don't fit filers elsewhere in each state; tamil_nadu metadata lacks a
  legalCitations array.
- Nigeria: MCA s.2(3) lets a Nigeria-domiciled petitioner file in ANY state's
  High Court (templates describe residence-based venue practice); the s.30(2)
  exceptions to the two-year bar and the s.57 child-arrangements gate on
  decree absolute are omitted from the summaries; the 7-year
  presumption-of-death yardstick technically lives in s.16(2)(a).
- Australia: the real Application for Divorce seeks only the divorce order —
  the templates' ORDERS SOUGHT bundle property/parenting/maintenance relief
  that belongs in a separate Initiating Application; the FCFCOA caption on
  real forms includes "(Division 2)"; "Affidavit — Proof of Separation" is
  only needed for separation under one roof.
- Kenya: decree nisi/absolute survives as court practice though the Act is
  silent (MTM v SNM [2024] KEHC 8241).
- Stamp paper (India): affidavits sworn for immediate court filing are
  stamp-duty-exempt (Indian Stamp Act Sch. I Art. 4 Exemption (b)) — the
  factory warning was reworded; Maharashtra's "30-Oct-2024 circular" claim
  remains unverified.
- The 46 international templates remain behind ENABLE_INTERNATIONAL=false in
  production.
