# Divorce Package Research Document

**Created**: 2026-02-02
**Purpose**: Comprehensive research on divorce form requirements for all 7 supported states
**Status**: Research Phase Complete

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Texas Divorce Requirements](#texas-divorce-requirements)
3. [Utah Divorce Requirements](#utah-divorce-requirements)
4. [Arizona Divorce Requirements](#arizona-divorce-requirements)
5. [California Divorce Requirements](#california-divorce-requirements)
6. [Florida Divorce Requirements](#florida-divorce-requirements)
7. [Illinois Divorce Requirements](#illinois-divorce-requirements)
8. [New York Divorce Requirements](#new-york-divorce-requirements)
9. [Cross-State Comparison](#cross-state-comparison)
10. [Document Types Summary](#document-types-summary)
11. [Implementation Notes](#implementation-notes)

---

## Executive Summary

This document captures the research findings for implementing divorce packages across the 7 currently supported states. Each state has unique form requirements, waiting periods, and procedural rules that must be accurately reflected in the template system.

### Key Findings

| State | Residency Req | Waiting Period | Filing Fee | Complexity |
|-------|---------------|----------------|------------|------------|
| Texas | 6 mo state / 90 days county | 60 days | ~$300-350 | Medium |
| Utah | 3 mo county | 30 days | $325 | Medium |
| Arizona | 90 days state | 60 days | ~$350 | Medium |
| California | 6 mo state / 3 mo county | 6 months | ~$435-450 | High |
| Florida | 6 mo state | None (simplified) | ~$409 | Low-Medium |
| Illinois | 90 days state | None | ~$289-388 | Medium |
| New York | 1-2 years (varies) | None | ~$335+ | High |

### Document Types Per State

Each divorce package typically includes:
1. **Petition for Divorce/Dissolution** - Initiates the case
2. **Summons** - Notifies respondent of proceedings
3. **Financial Disclosure** - Assets, debts, income
4. **Settlement/Decree** - Final orders
5. **Supporting Affidavits** - Various sworn statements

---

## Texas Divorce Requirements

### Official Sources
- Texas Courts: https://www.txcourts.gov
- Texas Law Help: https://texaslawhelp.org
- Texas State Law Library: https://guides.sll.texas.gov/divorce

### Residency Requirements
- At least one spouse must have lived in Texas for **6 months**
- Must have lived in the county of filing for at least **90 days**
- Strictly enforced - court must have jurisdiction

### Waiting Period
- **60 days** from filing before divorce can be finalized
- Exceptions for family violence (protective order or conviction)
- Count starts day after filing (don't count filing day)

### Form Sets

Texas organizes divorce forms into standardized sets:

#### Set A - Uncontested, No Children, No Real Property
| Form Number | Form Name | Purpose |
|-------------|-----------|---------|
| - | Affidavit of Indigency | Fee waiver request |
| - | Original Petition for Divorce | Initiates divorce case |
| - | Waiver of Service | Spouse waives formal service |
| - | Final Decree of Divorce | Court's final orders |
| - | Certificate of Last Known Address | Required filing |
| - | Notice of Change of Address | Required filing |
| - | Affidavit of Military Status | SCRA compliance |

#### Set B - With Minor Children
| Form Number | Form Name | Purpose |
|-------------|-----------|---------|
| FM-DivB-100 | Original Petition for Divorce [SET B] | Initiates case with children |
| - | Respondent's Waiver of Service | Waives formal service |
| - | Final Decree of Divorce | Court's final orders |
| - | Standing Order | Automatic restraining orders |

#### Set C - With Children and Existing Court Orders
| Form Number | Form Name | Purpose |
|-------------|-----------|---------|
| FM-DivC-100 | Original Petition for Divorce [Set C] | Modifies existing orders |
| FM-DivC-103 | Respondent's Waiver of Service [SET C] | Waives formal service |
| FM-DivC-201 | Final Decree of Divorce [SET C] | Court's final orders |

#### Set D - Same-Sex Marriage, No Children
| Form Number | Form Name | Purpose |
|-------------|-----------|---------|
| FM-DivAD-102 | Respondent's Original Answer [SET A/D] | Response to petition |
| FM-DivAD-103 | Waiver of Service Only [SET A/D] | Waives formal service |
| FM-DivD-201 | Final Decree of Divorce [SET D] | Court's final orders |

### Required Fields for Texas Divorce
- Petitioner full legal name
- Respondent full legal name
- Date of marriage
- Date of separation
- County of residence
- Grounds for divorce (insupportability - no-fault)
- Property division terms
- If children: custody, support, visitation terms

### Key Texas-Specific Rules
- Uses "CAUSE NO." instead of "CASE NO."
- Civil Case Information Sheet required
- Bureau of Vital Statistics Form required
- Waiver of Service must be notarized
- Waiver must be signed at least 1 day after petition filed
- Some counties require Standing Orders with petition

### Legal Citations
- Texas Family Code § 6.001 et seq. (Dissolution of Marriage)
- Texas Government Code § 312.011 (Affidavit requirements)
- Approved by Supreme Court of Texas, Misc. Docket No. 13-9085

---

## Utah Divorce Requirements

### Official Sources
- Utah Courts: https://www.utcourts.gov
- Utah Legal Services: https://www.utahlegalservices.org

### Residency Requirements
- Must reside in the county for at least **3 months** before filing
- File in the district court in your county of residence

### Waiting Period
- **30 days** between filing and finalization
- Court may waive for extraordinary circumstances

### Grounds for Divorce
- Irreconcilable differences
- Living separate and apart for 3 years under judicial decree

### Required Forms

| Form Name | Purpose |
|-----------|---------|
| Utah Courts Cover Sheet for Civil Actions | Case initiation |
| Certificate of Divorce, Dissolution, or Annulment | Health Department form |
| Verified Petition for Divorce | Main divorce petition |
| Acceptance of Service, Appearance, Consent, and Waiver | Waives formal service |
| Child Support Obligation Worksheets | If children involved |
| Affidavit of Income Verification | Income disclosure |
| Decree of Divorce | Final court order |

### Response Deadlines
- If served in Utah: **21 days** to respond
- If served outside Utah: **30 days** to respond

### Required Classes (With Children)
- Both parents must complete required parenting classes
- Divorce Education class required

### Filing Fee
- $325 standard filing fee
- Fee waiver available for low-income

### Key Utah-Specific Rules
- Utah Code § 46-1-6.5 prescribes specific jurat format
- Sentence case headers (not all caps)
- Title case for venue formatting
- Specific notary instruction required

### Legal Citations
- Utah Code Title 81, Chapter 4 (Dissolution of Marriage)
- Utah Code § 46-1-6.5 (Notarial Acts)
- URCP Rule 56(c)(4) (Competency requirements)

---

## Arizona Divorce Requirements

### Official Sources
- Arizona Courts Self-Service Center: https://www.azcourts.gov/selfservicecenter
- Arizona Court Help: https://azcourthelp.org

### Residency Requirements
- At least one spouse must have lived in Arizona for **90 days**
- File in Superior Court in county of residence

### Waiting Period
- **60 days** from service before finalization
- Countdown begins when respondent is served

### Response Deadlines
- In-state: **20 days** to file response (exclusive of service date)
- Out-of-state: **30 days** to file response
- Default can be entered after 24/34 days respectively

### Required Forms (Without Children)

| Form Number | Form Name | Purpose |
|-------------|-----------|---------|
| DRDA10F | Petition for Dissolution (No Children) | Initiates case |
| DR11f | Summons | Notifies respondent |
| DR14f | Preliminary Injunction | Automatic restraining orders |
| DR16f | Notice Regarding Creditors | Creditor notification |
| DRD16f | Notice of Right to Convert Health Insurance | COBRA notice |
| - | Domestic Relations Cover Sheet | Case information |

### Required Forms (With Minor Children)

| Form Number | Form Name | Purpose |
|-------------|-----------|---------|
| DRDC15f | Petition for Dissolution with Children | Initiates case |
| DR11f | Summons | Notifies respondent |
| DR14f | Preliminary Injunction | Automatic restraining orders |
| DR12f | Order and Notice to Attend PIP Class | Parent education |
| DRCVG11f | Parenting Plan | Custody arrangement |
| DRCVG13f | Affidavit Regarding Minor Children | UCCJEA declaration |

### Additional Forms

| Form Number | Form Name | Purpose |
|-------------|-----------|---------|
| DRDC10p | Procedures for filing with children | Instructions |
| DRSDS10f-c | Family Department/Sensitive Data Cover | Data protection |
| DRCVG12h | Parenting Plan Information | Guidance |
| DRSM12h | Spousal Maintenance Worksheet | Alimony calculation |

### Key Arizona-Specific Rules
- Preliminary Injunction required with ALL divorce filings
- Injunction applies to petitioner upon filing
- Injunction applies to respondent upon service
- Petition must be notarized (free at Clerk's office)
- Covenant marriage divorces require attorney

### Legal Citations
- Arizona Revised Statutes § 25 (Dissolution of Marriage)
- Arizona Rules of Family Law Procedure

---

## California Divorce Requirements

### Official Sources
- California Courts Self-Help: https://selfhelp.courts.ca.gov
- Judicial Council Forms: https://courts.ca.gov

### Residency Requirements
- Must be California resident for **6 months**
- Must be county resident for **3 months**

### Waiting Period
- **6 months** (longest of all states)
- Cannot finalize before 6 months from service date

### Core Forms

| Form Number | Form Name | Purpose |
|-------------|-----------|---------|
| FL-100 | Petition—Marriage/Domestic Partnership | Initiates divorce |
| FL-110 | Summons (Family Law) | Notifies respondent, contains restraining orders |
| FL-115 | Proof of Service of Summons | Proves service was completed |
| FL-120 | Response—Marriage/Domestic Partnership | Respondent's response |

### Financial Disclosure Forms (Mandatory)

| Form Number | Form Name | Purpose |
|-------------|-----------|---------|
| FL-140 | Declaration of Disclosure | Certifies disclosure complete |
| FL-141 | Declaration Regarding Service of Disclosure | Proves disclosure served |
| FL-142 | Schedule of Assets and Debts | Property inventory |
| FL-150 | Income and Expense Declaration | Financial status |

### Child-Related Forms

| Form Number | Form Name | Purpose |
|-------------|-----------|---------|
| FL-105 | UCCJEA Declaration | Jurisdiction for child custody |
| FL-311 | Child Custody and Visitation Order | Custody terms |
| FL-342 | Child Support Information and Order | Support terms |

### Additional Forms

| Form Number | Form Name | Purpose |
|-------------|-----------|---------|
| FL-117 | Notice and Acknowledgment of Receipt | Service by mail |
| FL-157 | Marital Standard of Living | For long-term marriages (10+ years) |
| FL-160 | Property Declaration | Additional property details |
| FL-170 | Declaration for Default or Uncontested Dissolution | Final declaration |
| FL-180 | Judgment | Final divorce judgment |

### Response Deadline
- **30 days** from service to file FL-120 Response

### Key California-Specific Rules
- Standard Family Law Restraining Orders on second page of Summons
- Mandatory financial disclosure (FL-140 through FL-150)
- Some counties require additional local forms
- Cannot serve your own papers
- Service options: process server, sheriff, mail with acknowledgment

### Filing Fee
- Approximately $435-450 (varies by county)

### Legal Citations
- California Family Code
- California Code of Civil Procedure § 2015.5 (Declarations under penalty of perjury)

---

## Florida Divorce Requirements

### Official Sources
- Florida Courts: https://www.flcourts.gov
- Florida Family Law Forms

### Residency Requirements
- You or spouse must have lived in Florida for **6 months**
- Can be proven by: FL driver's license, FL ID, voter registration (issued 6+ months prior), or testimony/affidavit

### Waiting Period
- **None** for simplified dissolution
- Regular dissolution: varies

### Simplified Dissolution Eligibility
Must meet ALL criteria:
- Both agree marriage cannot be saved
- No minor or dependent children
- Wife is not pregnant
- Property/debt division agreed upon
- Neither seeking alimony
- Both willing to waive financial disclosure rights
- Both willing to give up trial/appeal rights
- Both can appear together at courthouse

### Petition Forms (12.901 Series)

| Form Number | Form Name | Use Case |
|-------------|-----------|----------|
| 12.901(a) | Joint Petition for Simplified Dissolution | Both spouses file together |
| 12.901(b)(1) | Petition with Minor Children | Has children |
| 12.901(b)(2) | Petition with Property, No Children | Property but no kids |
| 12.901(b)(3) | Petition No Property, No Children | Simple case |

### Financial Forms (12.902 Series)

| Form Number | Form Name | Use Case |
|-------------|-----------|----------|
| 12.902(b) | Financial Affidavit (Short) | Income under $50,000/year |
| 12.902(c) | Financial Affidavit (Long) | Income $50,000+ or complex |
| 12.902(d) | UCCJEA Affidavit | Has minor children |
| 12.902(f)(1) | Marital Settlement Agreement (Children) | Settlement with kids |
| 12.902(f)(2) | Marital Settlement Agreement (No Children) | Settlement, no kids |
| 12.902(f)(3) | Marital Settlement Agreement (No Property) | Simple settlement |
| 12.902(i) | Affidavit of Corroborating Witness | Proves residency |
| 12.902(j) | Notice of Social Security Number | SSN disclosure |

### Other Required Forms

| Form Number | Form Name | Purpose |
|-------------|-----------|---------|
| 12.903(a) | Answer, Waiver, and Request for Copy | Agreed response |
| 12.900(h) | Notice of Related Cases | Case coordination |
| 12.915 | Designation of Mailing/E-mail Address | Contact information |
| 12.932 | Certificate of Compliance with Disclosure | Proves disclosure |
| 12.990(a) | Final Judgment of Simplified Dissolution | Final order |
| 12.995(a) | Parenting Plan | Custody arrangement |

### Filing Fees
- Miami-Dade: $409
- Average across state: ~$410

### Key Florida-Specific Rules
- Simplified dissolution: both parties must appear in person
- Must present valid Florida photo ID with signature
- Final hearing approximately 30 days after filing (simplified)
- Rule 12.285 mandatory disclosure (waived for simplified)

### Legal Citations
- Florida Statutes Chapter 61 (Dissolution of Marriage)
- Florida Family Law Rules of Procedure

---

## Illinois Divorce Requirements

### Official Sources
- Illinois Courts: https://www.illinoiscourts.gov
- Illinois Legal Aid Online: https://www.illinoislegalaid.org
- IL Court Help: 833-411-1121

### Residency Requirements
- One or both spouses must be Illinois resident for **90 days**
- OR stationed in Illinois while in armed services for 90 days
- Residency can be established before filing OR before judgment

### Waiting Period
- **None** specified (can proceed when ready)
- But must meet residency requirement before judgment

### Venue (Where to File)
- County where you reside, OR
- County where spouse resides
- Other county requires written Motion and hearing

### Required Forms (No Children)

| Form Name | Purpose |
|-----------|---------|
| Petition for Divorce (No Children) | Initiates case |
| Judgment of Dissolution of Marriage/Civil Union | Final order |
| Certification Agreement (No Children) | Settlement terms |
| Divorce Summons | Notifies respondent |
| Motion for Default | If no response |
| Order for Default | Court grants default |
| Certificate of Dissolution (IDPH Form) | Vital statistics |
| Divorce Appearance | Enters appearance |
| Agreement as to Assets and Debts | Property division |
| Financial Affidavit | Required per 750 ILCS 5/501(a)(1) |

### Required Forms (With Children)

| Form Name | Purpose |
|-----------|---------|
| Petition for Divorce (With Children) | Initiates case |
| Additional Children - Petition | More than 4 children |
| Other Information About Children | Child details |
| Parenting Plan | Custody arrangement |
| Additional Parenting Time | Complex schedules |
| Judgment for Dissolution (With Children) | Final order |
| Additional Children - Judgment | More than 4 children |
| Case Management Order for Child Custody | Procedural order |
| Joint Affidavit Regarding Separation | Separation attestation |

### Key Illinois-Specific Rules
- Statewide Approved Standardized Forms required
- All Illinois Circuit Courts must accept these forms
- Certificate of Dissolution filed with IL Dept of Public Health
- Financial Affidavit mandatory per statute
- ILAO provides free guided interview for form completion

### Filing Fees
- Varies by county: approximately $289-388

### Legal Citations
- 750 ILCS 5 (Illinois Marriage and Dissolution of Marriage Act)
- 750 ILCS 5/501(a)(1) (Financial Affidavit requirement)
- 750 ILCS 5/707 (Certificate of Dissolution requirement)

---

## New York Divorce Requirements

### Official Sources
- NY Courts: https://www.nycourts.gov
- Uncontested Divorce Forms: https://ww2.nycourts.gov/divorce

### Residency Requirements (One of the following)
1. Either spouse lived in NY for **2 continuous years** before filing
2. Cause of divorce happened in NY AND both currently live in state
3. Either spouse lived in NY for **1 continuous year** AND:
   - Married in New York, OR
   - Lived as married couple in NY, OR
   - Cause of divorce happened in NY

### Waiting Period
- **None** (once requirements met and papers processed)

### No-Fault Ground
- Marriage "irretrievably broken" for at least **6 months**
- Stated under oath in paperwork

### Joint Filing Option (New as of January 2025)
- Couples can now file jointly for uncontested divorce
- Separate packets for with/without children under 21

### Required Forms (UD Series)

| Form Number | Form Name | Purpose |
|-------------|-----------|---------|
| UD-1/UD-1a | Summons with Notice | Initiates case |
| - | Notice of Automatic Orders | Restraining orders |
| - | Notice of Health Care Coverage | Insurance notice |
| UD-2 | Verified Complaint | States grounds and requests |
| UD-3 | Affidavit of Service | Proves service |
| UD-4 | Sworn Statement (Barriers to Remarriage) | Religious ceremony requirement |
| UD-4a | Affidavit of Service (UD-4) | Service proof for UD-4 |
| UD-5 | Affirmation of Regularity | Procedural compliance |
| UD-6 | Affidavit of Plaintiff | Plaintiff's sworn statement |
| UD-7 | Affidavit of Defendant | Defendant's agreement |

### Support Calculation Forms

| Form Number | Form Name | Purpose |
|-------------|-----------|---------|
| UD-8(1) | Annual Income Worksheet | Income calculation |
| UD-8(2) | Maintenance Guidelines Worksheet | Spousal support |
| UD-8(3) | Child Support Worksheet | Child support calculation |
| UD-8a | Support Collection Unit Information | Enforcement setup |
| UD-8b | Qualified Medical Child Support Order | Health insurance |

### Final Judgment Forms

| Form Number | Form Name | Purpose |
|-------------|-----------|---------|
| UD-9 | Note of Issue | Requests court assignment |
| UD-10 | Findings of Fact/Conclusions of Law | Court findings |
| UD-11 | Judgment of Divorce | Final divorce order |
| UD-12 | Part 130 Certification | Attorney fee certification |
| UD-13 | Request for Judicial Intervention (RJI) | Assigns judge |
| UD-14 | Notice of Entry | Notification of judgment |
| UD-15 | Affidavit of Service by Mail (JOD) | Service of judgment |
| UCS-111 | Divorce and Child Support Summary | Court reporting |
| UCS-840M | Addendum for RJI | Additional RJI info |
| DOH 2168 | Certificate of Dissolution | Vital statistics |

### Special Requirements
- If married in religious ceremony: UD-4 must be served
- Children under 21: Child Support Standards Chart must be served
- Maintenance Guidelines: Income cap $228,000 for guidelines

### Filing Fees
- Minimum $335 (index number + judicial request)
- Fee waiver available

### Key New York-Specific Rules
- Most complex form set of all 7 states
- Forms updated January 2026
- Joint filing now available
- Courts strongly recommend legal counsel even for uncontested
- All forms available free at nycourts.gov

### Legal Citations
- New York Domestic Relations Law
- CPLR (Civil Practice Law and Rules)

---

## Cross-State Comparison

### Residency Requirements

| State | Residency | County Requirement |
|-------|-----------|-------------------|
| TX | 6 months | 90 days |
| UT | N/A | 3 months |
| AZ | 90 days | None |
| CA | 6 months | 3 months |
| FL | 6 months | None |
| IL | 90 days | None |
| NY | 1-2 years | None |

### Waiting Periods

| State | Waiting Period | Notes |
|-------|---------------|-------|
| TX | 60 days | From filing |
| UT | 30 days | Can be waived |
| AZ | 60 days | From service |
| CA | 6 months | Longest wait |
| FL | None | For simplified |
| IL | None | Must meet residency |
| NY | None | Once papers complete |

### Simplified/Uncontested Options

| State | Simplified Available | Key Requirements |
|-------|---------------------|------------------|
| TX | Yes (Set A) | No children, no real property |
| UT | Yes | Agreement on all issues |
| AZ | Yes (Consent Decree) | No children variant |
| CA | No (all require 6mo wait) | Default if no response |
| FL | Yes (12.901(a)) | Most restrictive eligibility |
| IL | Yes (Joint Simplified) | Agreement, no children |
| NY | Yes (Joint Filing) | New as of 2025 |

### Form Complexity

| State | Total Forms | Complexity Rating |
|-------|-------------|-------------------|
| TX | 7-10 | Medium |
| UT | 6-8 | Medium |
| AZ | 5-8 | Medium |
| CA | 10-15+ | High |
| FL | 8-12 | Medium |
| IL | 8-12 | Medium |
| NY | 15-20+ | Very High |

---

## Document Types Summary

### Core Document Types Needed

1. **Petition/Complaint**
   - Initiates divorce proceedings
   - States grounds, requests relief
   - State-specific variations

2. **Summons**
   - Formal notice to respondent
   - Often includes automatic orders
   - Service requirements vary

3. **Financial Disclosure**
   - Income and expenses
   - Assets and debts
   - Mandatory in most states

4. **Response/Answer**
   - Respondent's reply
   - Waiver alternative if agreed

5. **Settlement Agreement**
   - Property division terms
   - Support terms
   - Custody terms (if applicable)

6. **Parenting Plan** (if children)
   - Custody arrangement
   - Visitation schedule
   - Decision-making authority

7. **Final Decree/Judgment**
   - Court's final orders
   - Incorporates settlement
   - Ends marriage

8. **Supporting Affidavits**
   - Residency
   - Military status
   - Corroborating witness
   - Jurisdiction (UCCJEA)

### Package Variants by Situation

| Situation | Documents Needed | Complexity |
|-----------|-----------------|------------|
| No children, no property | Petition, Summons, Waiver, Decree | Simple |
| No children, with property | Above + Financial Disclosure, Settlement | Medium |
| With children, agreed | All above + Parenting Plan, Support Worksheets | Medium-High |
| Contested | All above + Response, Discovery, Trial docs | High |

---

## Implementation Notes

### Template Class Hierarchy

```
BaseDivorceTemplate (abstract)
├── BasePetitionTemplate
│   └── [State]PetitionTemplate (7 implementations)
├── BaseFinancialDisclosureTemplate
│   └── [State]FinancialDisclosureTemplate
├── BaseDecreeTemplate
│   └── [State]DecreeTemplate
├── BaseParentingPlanTemplate
│   └── [State]ParentingPlanTemplate
└── BaseSettlementTemplate
    └── [State]SettlementTemplate
```

### Metadata Structure Needed

```json
{
  "stateCode": "TX",
  "stateName": "Texas",
  "documentTypes": ["petition", "decree", "financial", "parenting", "settlement"],
  "version": "1.0",
  "residencyRequirements": {
    "stateMonths": 6,
    "countyDays": 90
  },
  "waitingPeriod": {
    "days": 60,
    "exceptions": ["family_violence"]
  },
  "formSets": {
    "noChildren": ["Set A", "Set D"],
    "withChildren": ["Set B", "Set C"]
  },
  "requiredFields": {
    "petition": ["petitionerName", "respondentName", "marriageDate", "separationDate"],
    "financial": ["income", "expenses", "assets", "debts"],
    "parenting": ["childNames", "custodyType", "visitationSchedule"]
  },
  "legalCitations": [
    {"code": "Texas Family Code § 6.001", "description": "Dissolution of Marriage"}
  ]
}
```

### Key Considerations

1. **Form Number Tracking**
   - Many states use specific form numbers
   - Must display correct form number in header
   - Version dates may change

2. **State-Specific Language**
   - "CAUSE NO." (TX) vs "CASE NO." (others)
   - "Dissolution" (AZ, CA) vs "Divorce" (TX, NY)
   - Venue formatting varies

3. **Notarization Requirements**
   - TX: Waiver must be notarized
   - AZ: Petition must be notarized
   - Varies by document type and state

4. **Service Requirements**
   - Personal service vs mail
   - Sheriff vs process server
   - Acknowledgment requirements

5. **Financial Disclosure**
   - Mandatory in most states
   - Short vs long forms (FL)
   - Waiver options (FL simplified)

6. **Child-Related Requirements**
   - UCCJEA declarations
   - Parenting classes (UT, AZ)
   - Support calculations
   - Parenting plan formats

---

## Sources

### Texas
- https://guides.sll.texas.gov/divorce
- https://www.txcourts.gov
- https://texaslawhelp.org

### Utah
- https://www.utcourts.gov
- https://www.utahlegalservices.org

### Arizona
- https://www.azcourts.gov/selfservicecenter
- https://azcourthelp.org

### California
- https://selfhelp.courts.ca.gov
- https://courts.ca.gov

### Florida
- https://www.flcourts.gov
- Florida Family Law Forms

### Illinois
- https://www.illinoiscourts.gov
- https://www.illinoislegalaid.org

### New York
- https://www.nycourts.gov
- https://ww2.nycourts.gov/divorce

---

**Document Version**: 1.0
**Last Updated**: 2026-02-02
**Next Steps**: Create base template classes and state-specific implementations
