# Jurisdiction Legal Validation — 2026-08-12

Automated validation of the legal claims encoded in all 64 active divorce
petition templates (50 US states + DC + 13 Canadian provinces/territories).
Eight research passes verified six claims per jurisdiction — residency,
waiting period, trial court, instrument terminology, no-fault grounds, and
lead statute citation — against official sources (state legislatures, court
self-help sites, laws-lois.justice.gc.ca). Every WRONG verdict carries a
source URL; every WRONG below was fixed in the same change set unless noted.

**Verdicts: 384 claims checked — 309 confirmed, 66 wrong (fixed), 9 uncertain.**

## Defects found and fixed

| Jurisdiction | Claim | Finding | Source |
|---|---|---|---|
| AB | citation | Divorce Act, R.S.C. 1985, c. 3 (2nd Supp.); Alberta Rules of Court, Alta Reg 124/2010 | https://laws-lois.justice.gc.ca/eng/acts/d-3.4/page-1.html |
| AK | waitingPeriod | At least 30 days after FILING before the decree can be signed (Alaska Court System; dissolution hearings ≥30 days after petition filed) — not 30 days after service, and AS 25.24.090 is not the authority. | https://courts.alaska.gov/shc/family/start.htm |
| AK | grounds | 'Incompatibility of temperament' — AS 25.24.050(5)(C); 'irreconcilable breakdown' is not a statutory Alaska ground. | https://codes.findlaw.com/ak/title-25-marital-and-domestic-relations/ak-st-sect-25-24-050.html |
| AK | citation | statuteCitations is empty; the only in-text authority, AS 25.24.090, is titled 'Use of spouse's residence' (lets plaintiff rely on the other spouse's AK residence) and supports neither the residency-duration nor waiti... | https://codes.findlaw.com/ak/title-25-marital-and-domestic-relations/ak-st-sect-25-24-090.html |
| AL | grounds | Statutory no-fault wording: 'complete incompatibility of temperament' (Ala. Code §30-2-1(a)(7)) or 'irretrievable breakdown of the marriage' (§30-2-1(a)(9)); 'irreconcilable breakdown' is not an Alabama formulation. | https://codes.findlaw.com/al/title-30-marital-and-domestic-relations/al-code-sect-30-2-1/ |
| AR | grounds | Arkansas recognizes NO irreconcilable-differences/breakdown ground; the only no-fault ground is living separate and apart for 18 continuous months, Ark. Code §9-12-301(b)(5). | https://law.justia.com/codes/arkansas/title-9/subtitle-2/chapter-12/subchapter-3/section-9-12-301/ |
| BC | citation | Divorce Act, R.S.C. 1985, c. 3 (2nd Supp.); Supreme Court Family Rules, B.C. Reg. 169/2009 | https://www.canlii.org/en/bc/laws/regu/bc-reg-169-2009/latest/bc-reg-169-2009.html |
| CA | grounds | 'Irreconcilable differences, which have caused the irremediable breakdown of the marriage' (Fam. Code §2310(a)); 'irreconcilable breakdown' is a non-statutory hybrid. | https://leginfo.legislature.ca.gov/faces/codes_displaySection.xhtml?lawCode=FAM&sectionNum=2310 |
| CO | grounds | 'The marriage is irretrievably broken' — C.R.S. §14-10-106(1)(a)(II); 'irreconcilable breakdown' is not the Colorado formulation. | https://colorado.public.law/statutes/crs_14-10-106 |
| CT | waitingPeriod | P.A. 23-46 rewrote §46b-67: the court may proceed on the complaint from the second day following the return date (agreed/uncontested judgments need no 90-day wait); only a CONTESTED trial may not commence until 90 day... | https://codes.findlaw.com/ct/title-46b-family-law/ct-gen-st-sect-46b-67.html |
| CT | grounds | 'The marriage has broken down irretrievably' — Conn. Gen. Stat. §46b-40(c)(1); 'irreconcilable breakdown' is not the statutory wording. | https://codes.findlaw.com/ct/title-46b-family-law/ct-gen-st-sect-46b-40.html |
| DC | waitingPeriod | 0 days is right, but the description's 'mutual consent or living separate and apart for six or more months' requirement no longer exists — eliminated effective Jan 26, 2024; a divorce is granted upon assertion by one ... | https://code.dccouncil.gov/us/dc/council/code/sections/16-904 |
| DC | grounds | DC's ground is the assertion by one or both parties that they no longer wish to remain married (D.C. Code §16-904(a), eff. Jan 26, 2024); 'irreconcilable breakdown' is not a DC ground. | https://code.dccouncil.gov/us/dc/council/code/sections/16-904 |
| DE | waitingPeriod | No fixed post-filing cooling-off, but 13 Del. C. §1507(e) bars any divorce ruling until the parties have been separated 6 months ('separation' per §1503 = living separate and apart 6+ months immediately preceding the ... | https://delcode.delaware.gov/title13/c015/index.html |
| DE | grounds | Delaware's sole ground: the marriage is irretrievably broken and reconciliation is improbable, with breakdown characterized by separation (voluntary, respondent's misconduct, mental illness, or incompatibility) — 13 D... | https://delcode.delaware.gov/title13/c015/index.html |
| HI | residency | HRS §580-1 requires either party to have been domiciled or physically present in Hawaii for a continuous period of at least six months (statutory text: next preceding the application; case law allows the 6 months to b... | https://law.justia.com/codes/hawaii/title-31/chapter-580/section-580-1/ |
| HI | grounds | HRS §580-41(1): 'The marriage is irretrievably broken' (other grounds are separation-based); 'irreconcilable breakdown/differences' is not Hawaii's statutory formulation. | https://www.womenslaw.org/laws/hi/statutes/580-41-divorce |
| IA | residency | 1 year Iowa residency unless respondent is an Iowa resident served by personal service â Iowa Code Â§598.6, not Â§598.5 (Â§598.5 is 'Contents of petition') | https://www.legis.iowa.gov/docs/code/598.6.pdf |
| IA | grounds | Breakdown of the marriage relationship to the extent that the legitimate objects of matrimony have been destroyed and there remains no reasonable likelihood that the marriage can be preserved (Iowa Code Â§598.5(1)(g),... | https://www.legis.iowa.gov/docs/code/598.17.pdf |
| ID | terminology | Idaho's initiating document is a 'Petition for Divorce' with Petitioner/Respondent (Idaho Court Assistance Office official forms), not 'Complaint for Divorce' with Plaintiff/Defendant. | https://courtselfhelp.idaho.gov/Forms/divorce |
| ID | grounds | The no-fault ground is 'irreconcilable differences' — Idaho Code §32-603(8), not §32-603(7) (subsection (7) is permanent insanity); groundsText should say 'irreconcilable differences' (defined at §32-616), not 'irreco... | https://legislature.idaho.gov/statutesrules/idstat/Title32/T32CH6/SECT32-603/ |
| IN | grounds | Irretrievable breakdown of the marriage (IC 31-15-2-3(1)) â statutory term is 'irretrievable', not 'irreconcilable breakdown' | https://law.justia.com/codes/indiana/title-31/article-15/chapter-2/ |
| KS | grounds | The parties are incompatible (K.S.A. 23-2701(a)(1)) â Kansas grounds are incompatibility, failure to perform a material marital duty, or incompatibility by reason of mental illness | https://ksrevisor.gov/statutes/chapters/ch23/023_027_0001.html |
| KY | waitingPeriod | No decree until the parties have lived apart for 60 days; 'living apart' includes living under the same roof without sexual cohabitation (KRS 403.170(1)) â trigger is separation, not the filing date | https://www.womenslaw.org/laws/ky/statutes/403170-marriage-irretrievable-breakdown |
| KY | grounds | The marriage is irretrievably broken (KRS 403.170) â Kentucky's sole ground | https://www.womenslaw.org/laws/ky/statutes/403170-marriage-irretrievable-breakdown |
| LA | residency | One spouse must be domiciled in Louisiana (La. C.C.P. art. 10(A)(7)); 6 months' residence in a parish creates a REBUTTABLE PRESUMPTION of domicile (La. C.C.P. art. 10(B)) â cite Code of Civil Procedure art. 10, not ... | https://law.justia.com/codes/louisiana/code-of-civil-procedure/article-10/ |
| LA | grounds | Living separate and apart for the statutory period â La. Civ. Code arts. 102 / 103(1) (periods in art. 103.1); 'irreconcilable breakdown' is not a Louisiana ground | https://divorce.law/louisiana/ |
| MB | court | Court of King's Bench of Manitoba (Family Division) | https://www.manitobacourts.mb.ca/court-of-queens-bench/court-proceedings/family-law/rule-70/ |
| MB | citation | Divorce Act, R.S.C. 1985, c. 3 (2nd Supp.); The Court of King's Bench Act, C.C.S.M. c. C280 | https://laws-lois.justice.gc.ca/eng/acts/d-3.4/page-1.html |
| MD | grounds | Irreconcilable differences based on the reasons stated by the complainant (Fam. Law Â§7-103(a)(2), post-Oct-2023 law) | https://mgaleg.maryland.gov/mgawebsite/Laws/StatuteText?article=gfl&section=7-103 |
| ME | waitingPeriod | 60-day minimum before the final hearing (Maine Judicial Branch states it runs from filing of the divorce paperwork; several sources describe 60 days after service) â and it is NOT codified at 19-A Â§902: Â§902 is th... | https://www.courts.maine.gov/courts/family/divorce-separation/index.html |
| ME | grounds | Irreconcilable marital differences (19-A M.R.S. Â§902(1)(H)) | https://legislature.maine.gov/statutes/19-A/title19-Asec902.html |
| MT | waitingPeriod | No decree until 21 days after the date of service — MCA 40-4-105(3) (response due within 21 days of service). MCA 40-4-107 is the irretrievable-breakdown findings section (30-60 day continuance if one party denies bre... | https://mca.legmt.gov/bills/mca/title_0400/chapter_0040/part_0010/section_0050/0400-0040-0010-0050.html |
| NB | citation | Divorce Act, R.S.C. 1985, c. 3 (2nd Supp.); Marital Property Act, R.S.N.B. 2012, c. 107 | https://laws-lois.justice.gc.ca/eng/acts/d-3.4/page-1.html |
| NE | waitingPeriod | No hearing/trial (and no decree) until 60 days after perfection of service of process — Neb. Rev. Stat. 42-363 (jurisdictional). 42-372, which the template cites, governs decree finality and appeals, not the waiting p... | https://nebraskalegislature.gov/laws/statutes.php?statute=42-363 |
| NJ | residency | 1 year bona fide NJ residence for ALL grounds including irreconcilable differences; only adultery is exempt from the 1-yr duration (N.J.S.A. 2A:34-10). Template description and jurisdictionSection wrongly assert 18 mo... | https://law.justia.com/codes/new-jersey/title-2a/section-2a-34-10/ |
| NL | court | Supreme Court of Newfoundland and Labrador (Family Division, or General Division depending on location) | https://www.court.nl.ca/supreme/faq/family-q17/ |
| NL | terminology | Originating Application (Family Law), Form F4.03A (or Joint Originating Application F4.04A) | https://www.court.nl.ca/supreme/family-division/info-common-legal-issues/divorce-and-separation/ |
| NL | citation | Divorce Act, R.S.C. 1985, c. 3 (2nd Supp.); Family Law Act, R.S.N.L. 1990, c. F-2 | https://laws-lois.justice.gc.ca/eng/acts/d-3.4/page-1.html |
| NM | grounds | Incompatibility — NMSA 1978 §40-4-1(A) (defined §40-4-2: discord/conflict of personalities destroying legitimate ends of marriage); 'irreconcilable breakdown' is not NM's statutory ground | https://www.divorcenet.com/states/new_mexico/nm_faq02 |
| NS | citation | Divorce Act, R.S.C. 1985, c. 3 (2nd Supp.); Matrimonial Property Act, R.S.N.S. 1989, c. 275 | https://laws-lois.justice.gc.ca/eng/acts/d-3.4/page-1.html |
| NT | terminology | Petition for Divorce (or Joint Petition for Divorce) | https://www.nwtcourts.ca/en/forms/ |
| NT | citation | Divorce Act, R.S.C. 1985, c. 3 (2nd Supp.); Family Law Act, S.N.W.T. 1997, c. 18 | https://www.justice.gov.nt.ca/en/files/legislation/family-law/family-law.a.pdf |
| NU | terminology | Petition for Divorce (or Joint Petition for Divorce), per Nunavut Divorce Rules R-015-2021 | https://www.nunavutcourts.ca/index.php/forms/category/145-divorce-forms |
| NU | citation | Divorce Act, R.S.C. 1985, c. 3 (2nd Supp.); Family Law Act, S.N.W.T. (Nu) 1997, c. 18 (consolidated as C.S.Nu. c. F-30) | https://www.canlii.org/en/nu/laws/stat/csnu-c-f-30/latest/csnu-c-f-30.html |
| NV | grounds | Incompatibility — NRS 125.010(3); 'irreconcilable breakdown' is not a Nevada statutory ground | https://law.justia.com/codes/nevada/chapter-125/statute-125-010/ |
| OH | residency | Only the PLAINTIFF's residency counts: plaintiff must be an Ohio resident at least 6 months before filing (R.C. 3105.03); the 90-day county residency is a venue basis under Civ.R. 3(C) for the plaintiff, not a defenda... | https://codes.ohio.gov/ohio-revised-code/section-3105.03 |
| OK | residency | State residency (6 months) may be satisfied by petitioner OR respondent (43 O.S. § 102); the 30-day county rule is a VENUE provision in 43 O.S. § 103, and filing in the county where respondent resides is an alternative | https://law.justia.com/codes/oklahoma/title-43/section-43-103/ |
| OK | grounds | Oklahoma's no-fault ground is incompatibility (43 O.S. § 101); 'irreconcilable breakdown' is not a statutory ground | https://law.justia.com/codes/oklahoma/title-43/section-43-101/ |
| ON | citation | Divorce Act, R.S.C. 1985, c. 3 (2nd Supp.); Family Law Rules, O. Reg. 114/99 | https://laws-lois.justice.gc.ca/eng/acts/d-3.4/page-1.html |
| PE | court | Supreme Court of Prince Edward Island | https://www.courts.pe.ca/supreme-court |
| PE | citation | Divorce Act, R.S.C. 1985, c. 3 (2nd Supp.); Family Law Act, R.S.P.E.I. 1988, c. F-2.1 | https://www.canlii.org/en/pe/laws/stat/rspei-1988-c-f-2.1/latest/rspei-1988-c-f-2.1.html |
| QC | citation | Divorce Act, R.S.C. 1985, c. 3 (2nd Supp.); Code of Civil Procedure, CQLR c. C-25.01 | https://laws-lois.justice.gc.ca/eng/acts/d-3.4/page-1.html |
| RI | waitingPeriod | 3 months after trial and decision before final judgment (§ 15-5-23); for the living-separate-and-apart (3-year) ground the exception is 20 days after entry of decision (§ 15-5-3(b)), not 21 | https://webserver.rilegislature.gov/Statutes/TITLE15/15-5/15-5-3.htm |
| SC | grounds | SC does not recognize irreconcilable differences/'irreconcilable breakdown'; the only no-fault ground is living separate and apart without cohabitation for 1 year, S.C. Code § 20-3-10(5) | https://www.scstatehouse.gov/code/t20c003.php |
| SK | citation | Divorce Act, R.S.C. 1985, c. 3 (2nd Supp.); The Family Property Act, S.S. 1997, c. F-6.3 | https://laws-lois.justice.gc.ca/eng/acts/d-3.4/page-1.html |
| TN | terminology | Complaint for Divorce (TN Supreme Court approved forms use 'Verified Complaint for Divorce') | https://divorce.law/guides/divorce-papers/tennessee/ |
| TN | grounds | Irreconcilable differences is Tenn. Code Ann. § 36-4-101(a)(14), not (a)(13); (a)(13) is abandonment/refusal to provide | https://codes.findlaw.com/tn/title-36-domestic-relations/tn-code-sect-36-4-101/ |
| VA | terminology | COMPLAINT FOR DIVORCE | https://www.fairfaxcounty.gov/circuit/civil-case-information/divorce |
| VA | grounds | Cite Va. Code § 20-91(A)(9)(a) for the 1-year separation ground; (9)(b) merely validates prior decrees/retroactivity | https://law.lis.virginia.gov/vacode/title20/section20-91/ |
| VT | waitingPeriod | Vermont has a 90-day (3-month) nisi period: the decree becomes absolute 3 months after entry unless the court sets an earlier date (15 V.S.A. § 554); additionally no final hearing until a party has resided in VT 1 yea... | https://legislature.vermont.gov/statutes/section/15/011/00554 |
| VT | grounds | 'The parties have lived separate and apart for six consecutive months and the resumption of marital relations is not reasonably probable' — 15 V.S.A. § 551(7) | https://codes.findlaw.com/vt/title-15-domestic-relations/vt-st-tit-15-sect-551.html |
| WA | residency | Substance is right (no durational requirement — petitioner must be a WA resident, or armed-forces member stationed in WA, or married to one), but the governing statute is RCW 26.09.030; RCW 26.09.020 is 'Petition—Cont... | https://app.leg.wa.gov/rcw/default.aspx?cite=26.09.030 |
| WV | citation | W. Va. Code § 48-5-101 et seq. — every WV citation in the template is prefixed 'Va. Code', which denotes the Virginia Code | https://code.wvlegislature.gov/48-5-105/ |
| YT | terminology | Statement of Claim (Family Law â Divorce), Form 91A under Supreme Court Rule 63 | https://yukon.ca/en/legal-and-social-supports/family-law/file-divorce |
| YT | citation | Divorce Act, R.S.C. 1985, c. 3 (2nd Supp.); Family Property and Support Act, R.S.Y. 2002, c. 83 | https://laws-lois.justice.gc.ca/eng/acts/d-3.4/page-1.html |

## Uncertain — needs human legal review

| Jurisdiction | Claim | Note |
|---|---|---|
| IN | citation | statuteCitations array is empty â nothing to validate. Inline cites in template text (IC 31-15-2-6, 31-15-2-10, 31-15-2-3(1)) all verified correct. |
| KY | citation | statuteCitations array is empty â nothing to validate. Inline cites KRS 403.140 and 403.170 verified correct. |
| MO | citation | statuteCitations array is EMPTY — nothing to verify. In-text cites RSMo 452.305 and 452.320 are correct; template comments should be populated to match other states. |
| NC | citation | First cite § 50-1 exists in Ch. 50 Art. 1 but its text could not be retrieved (ncleg 403, FindLaw 404); substantive cites 50-6/50-8/50-3 used in rendered text are correct |
| NH | citation | statuteCitations array empty — nothing to verify; inline RSA 458:5 and 458:7-a are correct |
| NJ | citation | statuteCitations array empty — nothing to verify; inline 2A:34-2(i) correct; 2A:34-10 is the right section but template pairs it with wrong 18-month text |
| NM | waitingPeriod | Secondary sources say courts wait 30 days after service before hearings, but it functions as the respondent's 30-day answer window and doesn't apply to joint petitions; could not confirm a statutory 'mandatory cooling-off before final de... |
| NV | citation | statuteCitations array is empty — nothing to verify; inline NRS 125.020 correct, inline NRS 125.010(2) subsection wrong for incompatibility |
| TN | citation | statuteCitations array is empty — nothing to verify. Inline cites TCA 36-4-104 (residency) and 36-4-101(b) (waiting) are correct; grounds cite (a)(13) is wrong per grounds finding. |

## Notes

- The recurring "grounds" findings against `groundsText` refer to the base-class
  `getGroundsText()` fallback helper. Empirical rendering across all 64 jurisdictions
  confirms NO state prints that generic sentence into an actual document — every
  rendered grounds section uses the state's statutory formulation. Rendered-text
  defects (NJ 18-month residency, NV/ID subsection swaps, HI grounds phrase, TN/VA/
  IA/LA/MT/NE/AK/CT/RI/MD/WA/OK/OH/DC/DE cites and descriptions, Canadian court
  names/instruments/citations) were fixed at the source.
- Full per-claim verdicts with sources: see the JSON files referenced in the
  validation commit message.
- International templates (~46, behind ENABLE_INTERNATIONAL=false) were NOT validated.
