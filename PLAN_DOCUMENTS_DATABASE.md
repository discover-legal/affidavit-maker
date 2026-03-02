# Plan: Complete Civil & Family Law Document Database
**Created**: 2026-02-27
**Branch**: `claude/plan-documents-database-pwuBX`
**Purpose**: Comprehensive roadmap for building a full document database covering all civil and family law matters across all supported states, reusing the existing storytelling/fact engine and drafting paradigms.

---

## Table of Contents

1. [Executive Summary](#executive-summary)
2. [Design Principles](#design-principles)
3. [Complete Document Catalog](#complete-document-catalog)
4. [Database Schema](#database-schema)
5. [Template Architecture](#template-architecture)
6. [Fact Engine & Storytelling Per Matter](#fact-engine--storytelling-per-matter)
7. [Interview Orchestration](#interview-orchestration)
8. [State Rollout Strategy](#state-rollout-strategy)
9. [Implementation Phases](#implementation-phases)
10. [API Design](#api-design)
11. [Pricing Strategy](#pricing-strategy)
12. [Risk & Legal Considerations](#risk--legal-considerations)

---

## Executive Summary

The system already has a powerful foundation:
- **7-state template engine** with auto-discovery
- **Conversational fact extraction** — users tell their story, AI extracts legally-relevant facts
- **Fact validation** — local + LLM validation with professional rewrites
- **Cases table** (migration 012) grouping documents under one legal matter
- **Divorce orchestrators** proving the multi-document pattern works

This plan extends that foundation to cover the full universe of documents an SRL (Self-Represented Litigant) needs across **two practice areas** (Family Law, Civil Law), **11 matter types**, **~85 document types**, and eventually **all 50 states + DC**.

The central design constraint: **the storytelling engine must remain the front door**. SRLs do not fill out forms — they tell their story in plain language, and the system translates that into legally-structured documents. Every new matter type plugs into the same conversation → facts → document pipeline.

---

## Design Principles

### 1. Story-First, Always
Every matter type begins with "Tell me what happened." The AI interviewer guides the user through their narrative in phases. It never presents a form. Facts are extracted from the conversation, validated, and mapped to document fields — not the other way around.

### 2. Reuse the Fact Engine
The `enhancedFactValidationService`, `factNormalizer`, and `ResilientOpenAIService` are matter-agnostic. New matter types only need:
- A system prompt telling the AI what role it plays and what to ask about
- A fact category mapping (what categories are relevant to this matter)
- An interview phase config (what topics to cover in what order)

### 3. Cases as the Unit of Work
The `cases` table (migration 012) is the anchor. One case = one legal matter. Multiple documents live inside it. The orchestrator reads case-level data (parties, court, children) and pre-fills it into every document — the user never re-enters the same information.

### 4. Template Inheritance for New Document Shapes
The `BaseAffidavitTemplate` handles declarations/affidavits perfectly. Non-affidavit documents (complaints, petitions, motions, orders) need new base classes that share the same venue/caption/signature infrastructure but have different body structures. All base classes extend a common `BaseDocument` ancestor.

### 5. State-First Metadata
Legal requirements differ by state. Every document type carries a `state_document_support` record per state that records: form number, legal citations, required/optional fields, and whether it's been attorney-reviewed. This makes it impossible to accidentally generate a non-compliant document.

### 6. Progressive Disclosure (Document Packages)
An SRL filing for divorce doesn't want to think about 8 separate documents. They want to answer questions and get everything they need. The orchestrator drives a "package" interview and generates all required documents at the end. Individual documents can still be created standalone for users who know exactly what they need.

---

## Complete Document Catalog

### Practice Area: Family Law

---

#### Matter: `divorce` — Divorce / Dissolution of Marriage

| Code | Document Name | Type | Notes |
|------|--------------|------|-------|
| `divorce_petition` | Petition for Dissolution of Marriage | Pleading | Initiating document |
| `divorce_response` | Response to Petition for Dissolution | Pleading | Respondent's answer |
| `summons` | Summons (Family Law) | Notice | Required in most states |
| `waiver_of_service` | Waiver / Acceptance of Service | Affidavit | Uncontested only |
| `financial_disclosure` | Income & Expense Declaration | Declaration | Both parties |
| `asset_debt_schedule` | Schedule of Assets and Debts | Declaration | Both parties |
| `parenting_plan` | Parenting Plan / Custody & Visitation Schedule | Order | If children |
| `child_support_worksheet` | Child Support Calculation Worksheet | Worksheet | If children |
| `prove_up_affidavit` | Affidavit in Support of Default Judgment | Affidavit | Uncontested |
| `military_status_affidavit` | Military Status Affidavit | Affidavit | Required by SCRA |
| `indigency_affidavit` | Affidavit of Indigency / Fee Waiver | Affidavit | Low-income filers |
| `cert_last_known_address` | Certificate of Last Known Address | Affidavit | Service by publication |
| `divorce_decree` | Final Decree of Dissolution | Order | Final judgment |
| `proposed_judgment` | Proposed Judgment (Marital Settlement Agreement) | Order | Settlement-based |
| `qDRO_instructions` | QDRO Instructions / Retirement Account Division Notes | Notice | Retirement assets |

**Already built (TX)**: `divorce_petition`, `divorce_decree`, `waiver_of_service`, `cert_last_known_address`, `military_status_affidavit`, `prove_up_affidavit`, `indigency_affidavit`

---

#### Matter: `legal_separation` — Legal Separation

| Code | Document Name | Type |
|------|--------------|------|
| `separation_petition` | Petition for Legal Separation | Pleading |
| `separation_response` | Response to Separation Petition | Pleading |
| `separation_agreement` | Separation Agreement | Contract |
| `separation_decree` | Decree of Legal Separation | Order |

---

#### Matter: `annulment` — Annulment / Nullity of Marriage

| Code | Document Name | Type |
|------|--------------|------|
| `nullity_petition` | Petition for Nullity of Marriage | Pleading |
| `nullity_declaration` | Declaration Re: Grounds for Nullity | Declaration |
| `nullity_judgment` | Judgment of Nullity | Order |

---

#### Matter: `custody` — Child Custody (Unmarried / Post-Divorce)

| Code | Document Name | Type | Notes |
|------|--------------|------|-------|
| `custody_petition` | Petition to Establish Custody and Visitation | Pleading | Initial filing |
| `custody_response` | Response to Custody Petition | Pleading | |
| `temp_custody_order_request` | Request for Temporary Custody Order | Motion | Emergency |
| `temp_custody_declaration` | Declaration in Support of Temporary Orders | Declaration | |
| `parenting_plan` | Proposed Parenting Plan | Order | |
| `relocation_request` | Notice of Intent to Relocate | Notice | |
| `relocation_objection` | Objection to Relocation | Motion | |
| `custody_modification` | Motion to Modify Custody Order | Motion | Post-judgment |
| `custody_mod_declaration` | Declaration Re: Change in Circumstances | Declaration | |
| `custody_order` | Child Custody Order | Order | Final |
| `visitation_order` | Visitation Order | Order | |

---

#### Matter: `child_support` — Child Support

| Code | Document Name | Type |
|------|--------------|------|
| `support_petition` | Petition to Establish Child Support | Pleading |
| `support_response` | Response to Child Support Petition | Pleading |
| `income_declaration` | Declaration of Income and Expenses | Declaration |
| `support_worksheet` | Child Support Calculation Worksheet | Worksheet |
| `support_modification` | Motion to Modify Child Support | Motion |
| `support_mod_declaration` | Declaration Re: Changed Circumstances | Declaration |
| `support_enforcement` | Motion to Enforce Child Support Order | Motion |
| `arrears_declaration` | Declaration Re: Unpaid Child Support Arrears | Declaration |
| `support_order` | Child Support Order | Order |
| `wage_assignment` | Wage Assignment / Income Withholding Order | Order |

---

#### Matter: `paternity` — Paternity / Parentage

| Code | Document Name | Type |
|------|--------------|------|
| `parentage_petition` | Petition to Establish Parentage | Pleading |
| `voluntary_declaration` | Voluntary Declaration of Paternity/Parentage | Declaration |
| `genetic_testing_request` | Request for Genetic Testing | Motion |
| `parentage_declaration` | Declaration Re: Parentage | Declaration |
| `disestablishment_petition` | Petition to Disestablish Paternity | Pleading |
| `parentage_order` | Order Establishing Parentage | Order |

---

#### Matter: `domestic_violence` — Domestic Violence / Restraining Orders

| Code | Document Name | Type | Notes |
|------|--------------|------|-------|
| `dvro_petition` | Request for Domestic Violence Restraining Order | Pleading | Emergency TRO |
| `dvro_declaration` | Declaration Re: Domestic Violence | Declaration | Detailed narrative |
| `dvro_response` | Response to DV Restraining Order | Pleading | Respondent |
| `dvro_child_custody` | Temporary Child Custody / Visitation (DVRO) | Order | |
| `dvro_final` | Domestic Violence Restraining Order After Hearing | Order | Final |
| `dvro_renewal` | Request for Renewal of Restraining Order | Motion | |
| `dvro_termination` | Request to Terminate Restraining Order | Motion | |

---

#### Matter: `guardianship_minor` — Guardianship of a Minor

| Code | Document Name | Type |
|------|--------------|------|
| `guardianship_petition` | Petition for Appointment of Guardian of Minor | Pleading |
| `guardian_declaration` | Declaration in Support of Guardianship | Declaration |
| `guardian_consent` | Consent of Proposed Guardian | Declaration |
| `parent_consent` | Consent of Parent to Guardianship | Declaration |
| `minor_declaration` | Declaration of Minor (if 14+) | Declaration |
| `letters_guardianship` | Letters of Guardianship (Proposed) | Order |
| `guardianship_order` | Order Appointing Guardian | Order |
| `guardianship_termination` | Petition to Terminate Guardianship | Pleading |
| `annual_report` | Annual Guardian Report | Declaration |

---

#### Matter: `adoption` — Stepparent / Relative Adoption

| Code | Document Name | Type |
|------|--------------|------|
| `adoption_petition` | Petition for Adoption | Pleading |
| `adoption_consent` | Consent to Adoption (biological parent) | Declaration |
| `adoption_declaration` | Declaration in Support of Adoption | Declaration |
| `termination_parental_rights` | Petition for Termination of Parental Rights | Pleading |
| `adoption_decree` | Decree of Adoption | Order |

---

#### Matter: `emancipation` — Emancipation of Minor

| Code | Document Name | Type |
|------|--------------|------|
| `emancipation_petition` | Petition for Declaration of Emancipation | Pleading |
| `emancipation_declaration` | Declaration of Minor's Circumstances | Declaration |
| `emancipation_decree` | Declaration of Emancipation | Order |

---

### Practice Area: Civil Law

---

#### Matter: `small_claims` — Small Claims Court

| Code | Document Name | Type | Notes |
|------|--------------|------|-------|
| `small_claims_complaint` | Small Claims Complaint / Claim Form | Pleading | Plaintiff |
| `demand_letter` | Pre-Litigation Demand Letter | Letter | Before filing |
| `small_claims_answer` | Defendant's Answer to Small Claims | Pleading | Defendant |
| `small_claims_counterclaim` | Defendant's Counterclaim | Pleading | Defendant |
| `small_claims_declaration` | Declaration in Support of Claim | Declaration | Supports complaint |
| `continuance_request` | Request for Continuance | Motion | |
| `default_vacate_motion` | Motion to Vacate Default Judgment | Motion | Post-judgment |
| `default_vacate_declaration` | Declaration in Support of Motion to Vacate | Declaration | |

---

#### Matter: `landlord_tenant` — Landlord-Tenant

| Code | Document Name | Type | Notes |
|------|--------------|------|-------|
| `ud_answer` | Answer to Unlawful Detainer / Eviction Complaint | Pleading | Tenant |
| `habitability_declaration` | Declaration Re: Habitability Defects | Declaration | Tenant |
| `rent_payment_declaration` | Declaration Re: Rent Payment History | Declaration | Tenant |
| `retaliation_declaration` | Declaration Re: Retaliatory Eviction | Declaration | Tenant |
| `security_deposit_demand` | Demand Letter for Return of Security Deposit | Letter | Tenant |
| `ud_motion_quash` | Motion to Quash Service of Summons | Motion | Tenant |
| `ud_continuance_motion` | Motion for Continuance of Trial | Motion | Tenant |
| `ud_complaint` | Unlawful Detainer Complaint | Pleading | Landlord |
| `notice_declaration` | Declaration Re: Service of Notice | Declaration | Landlord |
| `rent_ledger_declaration` | Declaration Re: Rent Ledger / Unpaid Rent | Declaration | Landlord |
| `ud_judgment` | Proposed Judgment for Possession | Order | Landlord |
| `habitability_counter_declaration` | Declaration Re: Repairs Made | Declaration | Landlord |

---

#### Matter: `debt_defense` — Collections / Debt Defense

| Code | Document Name | Type |
|------|--------------|------|
| `debt_answer` | Answer to Debt Collection Complaint | Pleading |
| `sol_motion_dismiss` | Motion to Dismiss (Statute of Limitations) | Motion |
| `sol_declaration` | Declaration in Support of SOL Motion | Declaration |
| `validation_demand` | Debt Validation Demand Letter | Letter |
| `exemption_claim` | Claim of Exemption (Wage Garnishment) | Motion |
| `exemption_hearing_request` | Request for Hearing on Exemption | Motion |
| `exemption_declaration` | Declaration in Support of Exemption Claim | Declaration |
| `general_denial` | General Denial (California-specific) | Pleading |

---

#### Matter: `civil_harassment` — Civil Harassment / Protective Orders

| Code | Document Name | Type |
|------|--------------|------|
| `ch_petition` | Petition for Civil Harassment Restraining Order | Pleading |
| `ch_declaration` | Declaration Re: Civil Harassment | Declaration |
| `ch_response` | Response to Civil Harassment Petition | Pleading |
| `ch_response_declaration` | Declaration in Response to Petition | Declaration |
| `ch_tro_proposed` | Temporary Restraining Order (Proposed) | Order |
| `ch_final_order` | Civil Harassment Restraining Order After Hearing | Order |
| `ch_renewal` | Request for Renewal of Restraining Order | Motion |

---

#### Matter: `name_change` — Name Change

| Code | Document Name | Type |
|------|--------------|------|
| `name_petition` | Petition for Change of Name | Pleading |
| `name_declaration` | Declaration in Support of Name Change | Declaration |
| `name_osc` | Order to Show Cause Re: Name Change | Order |
| `publication_affidavit` | Affidavit of Publication | Affidavit |
| `name_decree` | Decree Changing Name | Order |
| `minor_name_petition` | Petition for Change of Name (Minor) | Pleading |
| `minor_parent_consent` | Consent of Parent to Name Change | Declaration |

---

#### Matter: `general_civil` — General Civil Litigation

| Code | Document Name | Type |
|------|--------------|------|
| `civil_complaint` | Civil Complaint | Pleading |
| `civil_answer` | Answer to Civil Complaint | Pleading |
| `cross_complaint` | Cross-Complaint | Pleading |
| `motion_summary_judgment` | Motion for Summary Judgment | Motion |
| `msj_declaration` | Declaration in Support of MSJ | Declaration |
| `opposition_motion` | Opposition to Motion | Motion |
| `opposition_declaration` | Declaration in Support of Opposition | Declaration |
| `general_declaration` | General Declaration | Declaration |
| `request_dismissal` | Request for Dismissal | Motion |
| `proof_service` | Proof of Service | Affidavit |
| `subpoena_declaration` | Declaration Re: Need for Subpoena | Declaration |

---

#### Matter: `probate_small_estate` — Probate / Small Estate

| Code | Document Name | Type |
|------|--------------|------|
| `small_estate_affidavit` | Small Estate Affidavit / Affidavit of Heirship | Affidavit |
| `summary_petition` | Petition for Summary Administration | Pleading |
| `inventory_affidavit` | Inventory and Appraisal Affidavit | Affidavit |
| `heirship_affidavit` | Affidavit of Heirship | Affidavit |
| `successor_affidavit` | Affidavit of Successor | Affidavit |

---

### Document Type Summary

| Practice Area | Matter Types | Document Types |
|--------------|-------------|---------------|
| Family Law | 9 | ~55 |
| Civil Law | 7 | ~50 |
| **Total** | **16** | **~105** |

**Already built (TX)**: ~10 document types
**Net new**: ~95 document types

---

## Database Schema

### New Tables (Migration 013)

```sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 013: Document type catalog and matter type infrastructure
-- ─────────────────────────────────────────────────────────────────────────────

-- Master catalog of legal matter types
CREATE TABLE IF NOT EXISTS matter_types (
  id            SERIAL PRIMARY KEY,
  code          VARCHAR(50) UNIQUE NOT NULL,      -- 'divorce', 'custody', 'small_claims'
  practice_area VARCHAR(20) NOT NULL,              -- 'family', 'civil'
  category      VARCHAR(50),                       -- 'dissolution', 'custody_support', 'property'
  display_name  VARCHAR(200) NOT NULL,
  short_name    VARCHAR(100),                      -- Used in UI chips
  description   TEXT,
  tagline       TEXT,                              -- SRL-facing one-liner: "Get help ending your marriage"
  is_active     BOOLEAN DEFAULT true,
  is_packaged   BOOLEAN DEFAULT true,              -- Has a multi-doc interview package
  sort_order    INTEGER DEFAULT 0,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- Master catalog of all document types, scoped to matter type
CREATE TABLE IF NOT EXISTS document_type_catalog (
  id                    SERIAL PRIMARY KEY,
  matter_type_code      VARCHAR(50) NOT NULL REFERENCES matter_types(code),
  code                  VARCHAR(100) NOT NULL,      -- 'divorce_petition', 'ud_answer'
  display_name          VARCHAR(200) NOT NULL,
  short_name            VARCHAR(100),
  description           TEXT,
  base_template_class   VARCHAR(50) NOT NULL,       -- 'affidavit','pleading','motion','order','notice','letter','worksheet'
  is_initiating         BOOLEAN DEFAULT false,      -- Is this the first doc filed in a matter?
  typical_filer         VARCHAR(20),               -- 'plaintiff','defendant','petitioner','respondent','either'
  typical_sequence      INTEGER DEFAULT 0,          -- Order within a package (1, 2, 3...)
  requires_prior_docs   JSONB DEFAULT '[]',         -- Codes of docs that should precede this
  fact_categories       JSONB DEFAULT '[]',         -- Relevant fact categories for this doc
  required_fields       JSONB DEFAULT '[]',         -- Field names needed from case data
  optional_fields       JSONB DEFAULT '[]',
  is_active             BOOLEAN DEFAULT true,
  UNIQUE(matter_type_code, code)
);

-- Per-state support matrix: which states support which documents
CREATE TABLE IF NOT EXISTS state_document_support (
  id                  SERIAL PRIMARY KEY,
  state_code          CHAR(2) NOT NULL,
  matter_type_code    VARCHAR(50) NOT NULL REFERENCES matter_types(code),
  document_type_code  VARCHAR(100) NOT NULL,
  is_supported        BOOLEAN DEFAULT false,
  is_verified         BOOLEAN DEFAULT false,       -- Has been attorney-reviewed
  template_version    VARCHAR(20) DEFAULT '1.0',
  official_form_code  VARCHAR(100),               -- e.g., 'FL-100', 'UD-100'
  official_form_url   TEXT,
  legal_citations     JSONB DEFAULT '[]',          -- [{code, description}]
  state_specific_fields JSONB DEFAULT '{}',       -- Extra fields needed in this state
  notes               TEXT,
  effective_date      DATE,
  last_reviewed_at    DATE,
  reviewed_by         VARCHAR(200),               -- Attorney name/bar number
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW(),
  UNIQUE(state_code, matter_type_code, document_type_code)
);

-- Interview phase configuration per matter type
-- Drives the conversational interview for each matter
CREATE TABLE IF NOT EXISTS interview_phase_configs (
  id               SERIAL PRIMARY KEY,
  matter_type_code VARCHAR(50) NOT NULL REFERENCES matter_types(code),
  phase_code       VARCHAR(50) NOT NULL,          -- 'INTAKE', 'GROUNDS', 'FINANCES'
  phase_order      INTEGER NOT NULL,
  display_name     VARCHAR(100),                  -- Shown in UI progress indicator
  description      TEXT,                          -- What gets collected in this phase
  system_prompt    TEXT NOT NULL,                 -- AI instructions for this phase
  required_fact_categories JSONB DEFAULT '[]',    -- Categories that must be populated
  min_facts        INTEGER DEFAULT 0,             -- Minimum facts before advancing
  is_optional      BOOLEAN DEFAULT false,
  condition        JSONB DEFAULT NULL,            -- e.g., {"field":"has_children","value":true}
  next_phase_code  VARCHAR(50),                   -- Can be null (last phase)
  created_at       TIMESTAMP DEFAULT NOW(),
  UNIQUE(matter_type_code, phase_code)
);

-- Document generation queue for packages
-- Tracks which docs in a package have been generated
CREATE TABLE IF NOT EXISTS case_document_queue (
  id                  SERIAL PRIMARY KEY,
  case_id             INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  document_type_code  VARCHAR(100) NOT NULL,
  matter_type_code    VARCHAR(50) NOT NULL,
  document_id         INTEGER REFERENCES documents(id) ON DELETE SET NULL,
  status              VARCHAR(30) DEFAULT 'pending',  -- 'pending','generating','done','skipped'
  generation_order    INTEGER DEFAULT 0,
  is_required         BOOLEAN DEFAULT true,
  skip_reason         TEXT,
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);

-- RLS
ALTER TABLE matter_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_type_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE state_document_support ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_phase_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_document_queue ENABLE ROW LEVEL SECURITY;

-- Catalog tables: read-only for all (no user_id needed)
CREATE POLICY matter_types_read ON matter_types FOR SELECT USING (true);
CREATE POLICY doc_catalog_read ON document_type_catalog FOR SELECT USING (true);
CREATE POLICY state_support_read ON state_document_support FOR SELECT USING (true);
CREATE POLICY interview_config_read ON interview_phase_configs FOR SELECT USING (true);

-- Queue: user-scoped via case
CREATE POLICY queue_user_isolation ON case_document_queue
  USING (
    case_id IN (
      SELECT id FROM cases
      WHERE user_id = current_setting('app.current_user_id', true)::integer
    )
  );
```

### Extend `cases` Table (Migration 013 continued)

```sql
-- Add matter_type_code to cases for clean querying
ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS matter_type_code VARCHAR(50) REFERENCES matter_types(code),
  ADD COLUMN IF NOT EXISTS interview_phase VARCHAR(50) DEFAULT 'INTAKE',
  ADD COLUMN IF NOT EXISTS interview_data JSONB DEFAULT '{}';
  -- Note: interview_data stores all structured facts collected across phases
  -- (party details, financial data, property lists, etc.)
  -- It complements case_metadata (free-form) with structured, validated fields

CREATE INDEX IF NOT EXISTS idx_cases_matter_type ON cases(matter_type_code);
CREATE INDEX IF NOT EXISTS idx_queue_case ON case_document_queue(case_id);
CREATE INDEX IF NOT EXISTS idx_state_support_lookup
  ON state_document_support(state_code, matter_type_code, document_type_code);
```

### Seed Data (Migration 013 — Matter Types)

```sql
-- ── FAMILY LAW MATTER TYPES ──────────────────────────────────────────────────
INSERT INTO matter_types (code, practice_area, category, display_name, short_name, tagline, sort_order) VALUES
  ('divorce',          'family', 'dissolution', 'Divorce / Dissolution of Marriage', 'Divorce',          'End your marriage and divide your assets fairly',              10),
  ('legal_separation', 'family', 'dissolution', 'Legal Separation',                  'Separation',       'Separate legally while remaining married',                     20),
  ('annulment',        'family', 'dissolution', 'Annulment / Nullity of Marriage',   'Annulment',        'Legally void a marriage that should never have existed',        30),
  ('custody',          'family', 'custody',     'Child Custody & Visitation',        'Custody',          'Establish or modify who your children live with',              40),
  ('child_support',    'family', 'custody',     'Child Support',                     'Child Support',    'Establish, modify, or enforce child support payments',         50),
  ('paternity',        'family', 'parentage',   'Paternity / Parentage',             'Paternity',        'Legally establish who is a child''s parent',                   60),
  ('domestic_violence','family', 'protection',  'Domestic Violence Restraining Order','DV Order',        'Get legal protection from an abusive person',                  70),
  ('guardianship_minor','family','guardianship','Guardianship of a Minor',           'Guardianship',     'Become the legal guardian of a child who needs you',           80),
  ('adoption',         'family', 'adoption',    'Stepparent / Relative Adoption',   'Adoption',         'Legally adopt a child you are already raising',                90),
  ('emancipation',     'family', 'emancipation','Emancipation of a Minor',           'Emancipation',     'Become legally independent before turning 18',                100)
ON CONFLICT (code) DO NOTHING;

-- ── CIVIL LAW MATTER TYPES ───────────────────────────────────────────────────
INSERT INTO matter_types (code, practice_area, category, display_name, short_name, tagline, sort_order) VALUES
  ('small_claims',      'civil', 'money',      'Small Claims Court',                'Small Claims',     'Sue someone for money without a lawyer',                       110),
  ('landlord_tenant',   'civil', 'housing',    'Landlord-Tenant Dispute',           'Eviction/Tenant',  'Fight an eviction or recover your security deposit',           120),
  ('debt_defense',      'civil', 'money',      'Debt / Collection Defense',         'Debt Defense',     'Defend yourself against a debt collection lawsuit',            130),
  ('civil_harassment',  'civil', 'protection', 'Civil Harassment Restraining Order','Harassment Order', 'Get a court order to stop harassment by a non-family member',  140),
  ('name_change',       'civil', 'identity',   'Name Change',                       'Name Change',      'Legally change your name or your child''s name',               150),
  ('general_civil',     'civil', 'litigation', 'General Civil Litigation',          'Civil Case',       'File or defend a civil lawsuit',                               160),
  ('probate_small_estate','civil','probate',   'Probate / Small Estate',            'Small Estate',     'Transfer a loved one''s property without full probate',        170)
ON CONFLICT (code) DO NOTHING;
```

---

## Template Architecture

### Current Hierarchy

```
BaseAffidavitTemplate   (handles: declaration, affidavit, jurat, signature)
  └── [state]/AffidavitTemplate  (state-specific overrides)
```

### Expanded Hierarchy

```
BaseDocument  (NEW — common ancestor for all document types)
  ├── sections: venue, case_caption, title, body, signature, footer
  ├── generateVenue(), generateCaseCaption(), generateSignatureBlock()
  ├── generateHTML(), generateFullText(), validateData()
  │
  ├── BaseAffidavitTemplate  (existing — numbered facts, jurat, notary)
  │     └── [state]/AffidavitTemplate
  │
  ├── BasePleadingTemplate  (NEW — Complaints, Petitions, Answers)
  │     ├── sections: venue, caption, title, introduction, body_paragraphs, prayer, signature, verification
  │     ├── generatePrayer()  — "WHEREFORE, Petitioner respectfully requests..."
  │     ├── generateVerification()  — "I declare under penalty of perjury..."
  │     └── [state]/[matter]/PleadingTemplate
  │
  ├── BaseMotionTemplate  (NEW — Motions, Requests for Orders)
  │     ├── sections: venue, caption, title, introduction, facts, legal_argument, prayer, signature
  │     ├── generateLegalArgument()  — placeholder, filled by matter-specific subclass
  │     └── [state]/[matter]/MotionTemplate
  │
  ├── BaseOrderTemplate  (NEW — Final Orders, Decrees, Judgments)
  │     ├── sections: venue, caption, title, findings, orders, judge_signature
  │     ├── Note: SRLs generate "proposed" orders; judge fills in dates and signs
  │     └── [state]/[matter]/OrderTemplate
  │
  ├── BaseDeclarationTemplate  (NEW — Declarations, not sworn affidavits)
  │     ├── Like BaseAffidavitTemplate but penalty-of-perjury declaration instead of notary
  │     ├── Used in CA/AZ/other states that accept unsworn declarations
  │     └── [state]/[matter]/DeclarationTemplate
  │
  └── BaseNoticeTemplate  (NEW — Notices, Summons, Letters)
        ├── sections: header, to, from, subject, body, signature
        └── [state]/[matter]/NoticeTemplate
```

### New File Layout

```
templates/
├── core/
│   ├── BaseDocument.js             (NEW — common ancestor)
│   ├── BaseAffidavitTemplate.js    (existing, refactor to extend BaseDocument)
│   ├── BasePleadingTemplate.js     (NEW)
│   ├── BaseMotionTemplate.js       (NEW)
│   ├── BaseOrderTemplate.js        (NEW)
│   ├── BaseDeclarationTemplate.js  (NEW)
│   ├── BaseNoticeTemplate.js       (NEW)
│   ├── TemplateRegistry.js         (existing)
│   └── TemplateLoader.js           (existing, update to auto-discover all base types)
│
└── states/
    ├── texas/
    │   ├── AffidavitTemplate.js        (existing)
    │   ├── metadata.json               (existing, expand documentTypes)
    │   ├── divorce/
    │   │   ├── DivorcePackageTemplate.js  (orchestrates all divorce docs)
    │   │   ├── PetitionTemplate.js
    │   │   ├── DecreeTemplate.js
    │   │   └── ...
    │   ├── custody/
    │   │   ├── CustodyPetitionTemplate.js
    │   │   ├── ParentingPlanTemplate.js
    │   │   └── ...
    │   ├── small_claims/
    │   │   ├── ComplaintTemplate.js
    │   │   └── ...
    │   └── name_change/
    │       ├── PetitionTemplate.js
    │       └── ...
    ├── california/
    │   └── [same structure, CA-specific forms FL-100 etc.]
    └── [other states...]
```

### Template Class Boilerplate: `BasePleadingTemplate`

```javascript
// templates/core/BasePleadingTemplate.js
class BasePleadingTemplate extends BaseDocument {
  constructor(stateCode, stateName) {
    super(stateCode, stateName);
    this.templateType = 'pleading';
    this.sections = {
      venue: true,
      caseCaption: true,
      title: true,
      introduction: true,   // "COMES NOW Petitioner..."
      bodyParagraphs: true,  // Numbered ¶1, ¶2 ... from facts
      prayer: true,          // "WHEREFORE, Petitioner prays..."
      verificationBlock: true, // "I declare under penalty of perjury..."
      signatureBlock: true,
      certificateOfService: false
    };
  }

  generateIntroduction(data) {
    return `COMES NOW ${data.petitionerName}, Petitioner, and respectfully states as follows:`;
  }

  generatePrayer(reliefRequested = []) {
    const items = reliefRequested.map((r, i) => `  ${i + 1}. ${r}`).join('\n');
    return `WHEREFORE, Petitioner respectfully prays that this Court:\n${items}\n  and for such other and further relief as the Court deems just and proper.`;
  }

  generateVerification(petitionerName, state) {
    return [
      `I, ${petitionerName}, declare under penalty of perjury under the laws of the`,
      `State of ${state} that the foregoing is true and correct to the best of`,
      `my knowledge and belief.`
    ].join(' ');
  }

  generateCertificateOfService(data) {
    return [
      'CERTIFICATE OF SERVICE',
      `I hereby certify that on _________________, a true and correct copy of the`,
      `foregoing was served upon ${data.respondentName || 'Respondent'} by:`,
      `[ ] Personal Service   [ ] First Class Mail   [ ] Email: ________________`,
      `_________________________________`,
      `${data.petitionerName}`,
      `Petitioner, Pro Se`
    ].join('\n');
  }
}
```

---

## Fact Engine & Storytelling Per Matter

The existing fact engine extracts facts from plain-language conversation. For each new matter type, we need a **fact category mapping** that tells the LLM what dimensions of a story are relevant.

### Universal Fact Categories (already exist)

```
financial    — money, income, debts, assets, expenses
property     — real estate, vehicles, personal property
relational   — parent/child relationships, family history
temporal     — dates, timelines, durations
witness      — observations, things seen or heard
communication — emails, texts, verbal statements
```

### New Matter-Specific Fact Categories

```javascript
// To be added to factNormalizer.js FACT_CATEGORIES

const MATTER_FACT_CATEGORIES = {
  // Family Law
  divorce: [
    'financial',       // Income, debts, assets, retirement accounts
    'property',        // Marital home, vehicles, bank accounts
    'relational',      // Marriage date, separation date, grounds
    'temporal',        // Key dates (marriage, separation, filing)
    'children',        // NEW — child names, ages, current living situation
    'misconduct',      // NEW — domestic violence, adultery (grounds states)
    'agreement'        // NEW — what the parties have already agreed on
  ],

  custody: [
    'relational',
    'temporal',
    'children',        // Child needs, school, medical, activities
    'parenting_history', // NEW — who has been primary caregiver
    'safety',          // NEW — substance abuse, domestic violence, neglect
    'proposed_schedule', // NEW — desired parenting time
    'best_interests'   // NEW — why proposed plan serves child
  ],

  child_support: [
    'financial',       // Both parents' income
    'children',
    'expenses',        // NEW — child's healthcare, education, childcare costs
    'payment_history'  // NEW — prior support payments made/owed
  ],

  domestic_violence: [
    'witness',
    'temporal',        // Dates and timeline of incidents
    'communication',   // Threatening texts, emails
    'injury',          // NEW — physical/emotional harm descriptions
    'pattern',         // NEW — pattern of behavior, not just one incident
    'safety_plan'      // NEW — where they are staying, protection needed
  ],

  // Civil Law
  small_claims: [
    'financial',       // Amount owed, damages calculation
    'temporal',        // When the debt/event occurred
    'communication',   // Contracts, promises made, demands sent
    'witness',         // What the defendant did or failed to do
    'evidence',        // Receipts, contracts, photos
    'mitigation'       // NEW — steps taken to resolve before filing
  ],

  landlord_tenant: [
    'temporal',        // Lease dates, notice dates, eviction timeline
    'financial',       // Rent amounts, deposits, unpaid amounts
    'property',        // Unit condition, repairs needed/made
    'communication',   // Written notices, repair requests
    'habitability',    // NEW — specific defects, health/safety issues
    'payment_history', // Rent payment records
    'witness'
  ],

  debt_defense: [
    'financial',
    'temporal',        // When debt allegedly incurred, last payment date
    'communication',   // Original creditor vs. debt buyer chain
    'evidence',        // Documents plaintiff has (or lacks)
    'exemption'        // NEW — exempt income/property (SSI, TANF, etc.)
  ],

  civil_harassment: [
    'temporal',
    'witness',
    'communication',
    'pattern',
    'injury',
    'evidence'
  ],

  name_change: [
    'relational',      // Reason for name change
    'identity',        // NEW — current legal name, desired new name
    'history'          // NEW — prior name changes, criminal history (required field)
  ],

  probate_small_estate: [
    'relational',      // Relationship to deceased
    'property',        // Estate assets and values
    'temporal',        // Date of death
    'heirship'         // NEW — heirs and their relationship to deceased
  ]
};
```

### Fact Validation Rules Per Matter

Each matter has specific legal standards:

```javascript
// To be added to enhancedFactValidationService.js

const MATTER_VALIDATION_RULES = {
  domestic_violence: {
    // Facts must be specific — "he hit me" → must get date, location, injury
    requiresSpecificity: true,
    requiresDate: true,
    minLegalStandardScore: 60,
    warningThreshold: 40,
    systemPromptAddendum: `
      For domestic violence declarations, each incident fact MUST include:
      1. Specific date (or approximate date range)
      2. Location
      3. What exactly happened (actions, words)
      4. Any physical injury or emotional harm
      5. Whether children witnessed it
      Vague statements like "he was abusive" are insufficient and must be prompted for details.
    `
  },
  small_claims: {
    requiresMoneyAmount: true,
    requiresSpecificDefendantAction: true,
    systemPromptAddendum: `
      For small claims, each fact should establish:
      1. What the defendant owed or agreed to do
      2. What they actually did (or failed to do)
      3. The specific dollar amount of damages and how it was calculated
      4. Evidence supporting the claim (receipts, contracts, messages)
    `
  },
  debt_defense: {
    // Key: establish SOL defense if applicable
    systemPromptAddendum: `
      For debt defense, focus on:
      1. When the debt allegedly arose (to calculate statute of limitations)
      2. Date of last payment made (resets SOL clock in many states)
      3. Whether plaintiff can prove they own the debt (chain of assignment)
      4. Whether defendant has exempt income/property (SSI, wages below threshold)
    `
  }
};
```

---

## Interview Orchestration

### Pattern: One Orchestrator Class Per Matter Type

Following the existing `DivorceOrchestrator` pattern, each matter type gets an orchestrator that:
1. Reads current case data
2. Determines current interview phase
3. Selects the correct system prompt for the phase
4. Calls the fact engine
5. Detects when a phase is complete and advances

### Orchestrator File Layout

```
services/
├── orchestrators/
│   ├── BaseOrchestrator.js            (NEW — shared logic)
│   ├── GeneralAffidavitOrchestrator.js (existing, move here)
│   │
│   ├── family/
│   │   ├── DivorceOrchestrator.js     (existing state-specific, consolidate)
│   │   ├── CustodyOrchestrator.js     (NEW)
│   │   ├── ChildSupportOrchestrator.js (NEW)
│   │   ├── PaternityOrchestrator.js   (NEW)
│   │   ├── DVROOrchestrator.js        (NEW — high-stakes, specialized)
│   │   ├── GuardianshipOrchestrator.js (NEW)
│   │   ├── AdoptionOrchestrator.js    (NEW)
│   │   └── EmancipationOrchestrator.js (NEW)
│   │
│   └── civil/
│       ├── SmallClaimsOrchestrator.js (NEW)
│       ├── LandlordTenantOrchestrator.js (NEW)
│       ├── DebtDefenseOrchestrator.js (NEW)
│       ├── CivilHarassmentOrchestrator.js (NEW)
│       ├── NameChangeOrchestrator.js  (NEW)
│       ├── GeneralCivilOrchestrator.js (NEW)
│       └── ProbateOrchestrator.js     (NEW)
```

### Interview Phase Designs

#### `CustodyOrchestrator` — Phases

```
INTAKE           → "Tell me about your children and the other parent."
                   Collects: child names/ages, other parent identity, current living arrangement

HISTORY          → "Walk me through who has been taking care of the children day to day."
                   Collects: caregiver history, prior agreements, school/medical decisions

CONCERNS         → "Are there any safety issues I should know about?"
                   Collects: DV, substance abuse, neglect, mental health (each flagged as 'safety' category)

PROPOSED_PLAN    → "What parenting schedule are you asking for?"
                   Collects: desired custody type (sole/joint), time-sharing schedule, holidays

EVIDENCE         → "What evidence do you have to support your request?"
                   Collects: texts, photos, school records, medical records, witness names

REVIEW           → Summary and confirmation before drafting
```

#### `SmallClaimsOrchestrator` — Phases

```
INTAKE           → "Who are you suing and why?"
                   Collects: defendant identity, general nature of dispute

CLAIM_DETAILS    → "Tell me exactly what happened and what you're owed."
                   Collects: specific events, dollar amounts, how damages calculated

DEMAND_HISTORY   → "Have you already tried to get your money back?"
                   Collects: oral/written demands, any response from defendant

EVIDENCE         → "What documents or proof do you have?"
                   Collects: contracts, receipts, photos, texts, emails

REVIEW           → Summary, amount confirmation, court selection
```

#### `DVROOrchestrator` — Phases (Special Handling)

```
SAFETY_CHECK     → "Are you safe right now? Do you need emergency help?"
                   Special: provide hotline numbers, explain TRO process

INTAKE           → "Tell me who you need protection from and your relationship to them."
                   Collects: respondent identity, relationship type

INCIDENTS        → "Tell me about what happened. Start with the most recent incident."
                   Collects: incidents in reverse chronological order, REQUIRES specificity
                   Special: AI prompts for date, location, what was said/done, injury

PATTERN          → "Has this happened before? Tell me about earlier incidents."
                   Collects: pattern of behavior (pattern facts weighted heavily)

CHILDREN         → "Are there children involved?"
                   Collects: children's exposure to violence, need for custody orders in DVRO

EVIDENCE         → "What evidence do you have? Texts, photos, medical records?"
                   Collects: evidence items

RELIEF_REQUESTED → "What are you asking the court to order?"
                   Collects: stay-away distance, no-contact, move-out, custody orders

REVIEW           → Full review before submission
```

#### `LandlordTenantOrchestrator` — Tenant-Side Phases

```
TRIAGE           → "Are you facing eviction, or a different landlord problem?"
                   Routes to: eviction_defense or habitability_claim or security_deposit

EVICTION_DEFENSE:
  INTAKE         → "Tell me about the eviction notice and why you're fighting it."
  DEFENSES       → "Do any of these apply? [retaliation, habitability, waiver, procedural defect]"
  PAYMENT        → "Tell me about your rent payment history."
  HABITABILITY   → "What conditions in your unit are dangerous or uninhabitable?"
  EVIDENCE       → "What documents do you have?"
  REVIEW

SECURITY_DEPOSIT:
  INTAKE         → "Tell me about the deposit and when you moved out."
  CONDITION      → "What was the condition of the unit when you left?"
  DEMAND         → "Have you already demanded your deposit back?"
  REVIEW
```

### `BaseOrchestrator.js` — Core Logic

```javascript
// services/orchestrators/BaseOrchestrator.js
class BaseOrchestrator {
  constructor(matterTypeCode) {
    this.matterTypeCode = matterTypeCode;
    this.llm = new MultiProviderLLM();
  }

  // Subclasses define this: maps phaseCode → systemPrompt
  getSystemPromptForPhase(phase, caseData) {
    throw new Error('Subclass must implement getSystemPromptForPhase');
  }

  // Determine if enough facts have been collected to advance phase
  isPhaseComplete(phase, facts, caseData) {
    const config = this.phaseConfigs[phase];
    if (!config) return true;
    const collectedCategories = new Set(facts.map(f => f.category));
    return config.requiredCategories.every(c => collectedCategories.has(c));
  }

  // Core: process one message turn
  async processMessage({ message, conversationHistory, caseData, facts }) {
    const phase = caseData.interview_phase || 'INTAKE';
    const systemPrompt = this.getSystemPromptForPhase(phase, caseData);

    const response = await this.llm.chat.completions.create({
      model: process.env.LLM_MODEL || 'gpt-4o-2024-08-06',
      messages: [
        { role: 'system', content: systemPrompt },
        ...conversationHistory.slice(-20),
        { role: 'user', content: message }
      ],
      max_tokens: 1500,
      temperature: 0.5  // More consistent for legal docs
    });

    const extracted = await this.extractFacts(response, phase, caseData);
    const nextPhase = this.isPhaseComplete(phase, [...facts, ...extracted.newFacts], caseData)
      ? this.getNextPhase(phase)
      : phase;

    return {
      response: response.choices[0].message.content,
      newFacts: extracted.newFacts,
      updatedCaseData: { ...caseData, interview_phase: nextPhase },
      phaseAdvanced: nextPhase !== phase,
      readyToGenerate: nextPhase === 'REVIEW' && this.isPhaseComplete('REVIEW', [...facts, ...extracted.newFacts], caseData)
    };
  }
}
```

---

## State Rollout Strategy

### Phase 0 (Done): 7 States
TX, UT, AZ, CA, FL, IL, NY — already supported for affidavits + partial divorce

### Phase 1: Complete 7 States for All New Matter Types
**Before adding states, go deep on the 7 we have.**
For each of the 7 states, build templates and interview orchestration for:
- All family law matters (divorce already started)
- Small claims (SRL-friendly, high volume)
- Name change (simple, high demand)
- Civil harassment restraining orders

### Phase 2: Top-10 Additional States by SRL Need
Priority based on: (1) state population, (2) known SRL filing rates, (3) court form availability

| Priority | State | Code | Rationale |
|---------|-------|------|-----------|
| 1 | Ohio | OH | 11.8M pop, high SRL family law rate |
| 2 | Pennsylvania | PA | 12.9M pop, complex family courts |
| 3 | Georgia | GA | 10.7M pop, fast-growing SRL base |
| 4 | Washington | WA | 7.7M pop, no-fault, forms available |
| 5 | North Carolina | NC | 10.4M pop, high divorce rate |
| 6 | Michigan | MI | 10.0M pop, strong SRL resources |
| 7 | New Jersey | NJ | 9.3M pop, high cost of attorneys |
| 8 | Virginia | VA | 8.6M pop, active SRL initiative |
| 9 | Tennessee | TN | 7.0M pop, high family law volume |
| 10 | Colorado | CO | 5.8M pop, strong SRL infrastructure |

### Phase 3: Remaining States (40 → 50)
Add states in batches of 5-10 as templates mature.

### State Verification Protocol
For each new state, each document type must pass:
1. **Template review** — Does the generated document match the official form structure?
2. **Legal citations** — Are all statutory references current?
3. **Required fields** — Does the template enforce all mandatory fields?
4. **Form number mapping** — Is the official form number recorded (e.g., CA FL-100)?
5. **Attorney sign-off** *(aspirational)* — Bar-licensed attorney review before `is_verified = true`

---

## Implementation Phases

### Phase 1 — Foundation (Weeks 1–2)
**Goal**: Database infrastructure + seeded catalog

**Tasks**:
1. Write migration `013_document_catalog.sql` with all tables + seed data for matter_types, document_type_catalog, interview_phase_configs
2. Write migration `014_state_support_matrix.sql` seeding state_document_support for current 7 states (initially all `is_supported = false` except already-built types)
3. Create `scripts/seed_catalog.js` — idempotent seeder for catalog tables
4. Update `cases` table with `matter_type_code`, `interview_phase`, `interview_data` columns
5. Add `case_document_queue` table + RLS policy

**Files changed**:
- `migrations/013_document_catalog.sql` (NEW)
- `migrations/014_state_support_matrix.sql` (NEW)
- `scripts/seed_catalog.js` (NEW)

---

### Phase 2 — Core Template Expansion (Weeks 2–4)
**Goal**: New base template classes + auto-discovery update

**Tasks**:
1. Create `templates/core/BaseDocument.js` — common ancestor
2. Refactor `templates/core/BaseAffidavitTemplate.js` to extend `BaseDocument`
3. Create `templates/core/BasePleadingTemplate.js`
4. Create `templates/core/BaseMotionTemplate.js`
5. Create `templates/core/BaseOrderTemplate.js`
6. Create `templates/core/BaseDeclarationTemplate.js`
7. Create `templates/core/BaseNoticeTemplate.js`
8. Update `templates/core/TemplateLoader.js` to auto-discover all base classes
9. Update `templates/core/TemplateRegistry.js` to route by `base_template_class` field

**Tests**: Add tests for each new base class in `__tests__/templates/core/`

---

### Phase 3 — Family Law: Complete Coverage (Weeks 4–8)
**Goal**: Full family law document suite for all 7 states

**Subphase 3A — Custody & Child Support** (Week 4–5):
- `CustodyOrchestrator.js` with 6 interview phases
- `ChildSupportOrchestrator.js` with 5 interview phases
- Templates: custody_petition, parenting_plan, temp_custody_declaration, support_petition, income_declaration, support_worksheet
- For all 7 states: TX, UT, AZ, CA, FL, IL, NY
- Seed `state_document_support` records

**Subphase 3B — Domestic Violence** (Week 5–6):
- `DVROOrchestrator.js` with safety-first design (hotline references, urgency detection)
- Templates: dvro_petition, dvro_declaration, dvro_final
- Special: "Emergency" flow for users in immediate danger (skip phases, generate TRO request instantly)
- For all 7 states

**Subphase 3C — Paternity, Separation, Annulment** (Week 6–7):
- `PaternityOrchestrator.js`
- `LegalSeparationOrchestrator.js`
- Templates for each matter
- For all 7 states

**Subphase 3D — Guardianship, Adoption, Emancipation** (Week 7–8):
- `GuardianshipOrchestrator.js`, `AdoptionOrchestrator.js`, `EmancipationOrchestrator.js`
- Templates for each matter
- For all 7 states

---

### Phase 4 — Civil Law: High-Volume Matters (Weeks 8–12)
**Goal**: Small claims, name change, restraining orders, debt defense

**Subphase 4A — Small Claims** (Week 8–9):
- `SmallClaimsOrchestrator.js`
- Templates: demand_letter (pre-litigation), complaint, declaration, answer, counterclaim
- State-specific dollar limits (TX: $20K, CA: $12.5K, NY: $10K, FL: $8K, AZ: $3.5K, IL: $10K, UT: $11K)
- For all 7 states

**Subphase 4B — Name Change** (Week 9–10):
- `NameChangeOrchestrator.js` (relatively simple, 3-phase)
- Templates: petition, declaration, OSC, publication_affidavit, decree
- Minor name change variant
- For all 7 states

**Subphase 4C — Civil Harassment** (Week 10–11):
- `CivilHarassmentOrchestrator.js` (mirrors DVRO but non-family relationship)
- Templates: ch_petition, ch_declaration, ch_response, ch_final_order
- For all 7 states

**Subphase 4D — Debt Defense** (Week 11–12):
- `DebtDefenseOrchestrator.js`
- Templates: debt_answer, sol_motion_dismiss, exemption_claim, validation_demand
- State-specific: SOL periods, exemption amounts, CA general denial form
- For all 7 states

---

### Phase 5 — Civil Law: Landlord-Tenant & Probate (Weeks 12–16)

**Subphase 5A — Landlord-Tenant** (Week 12–14):
- `LandlordTenantOrchestrator.js` with triage (which side? which issue?)
- Tenant-side: ud_answer, habitability_declaration, security_deposit_demand
- Landlord-side: ud_complaint, notice_declaration
- State-specific: notice periods, cure-or-quit requirements, just-cause states (CA, IL)
- For all 7 states

**Subphase 5B — Probate/Small Estate** (Week 14–15):
- `ProbateOrchestrator.js`
- Primarily small estate affidavit (most SRL-appropriate form of probate)
- State-specific thresholds (TX: $75K, CA: $184.5K, AZ: $75K, etc.)
- For all 7 states

**Subphase 5C — General Civil** (Week 15–16):
- `GeneralCivilOrchestrator.js` (catch-all for matters not yet specifically supported)
- Templates: civil_complaint, answer, general_declaration, proof_of_service
- For all 7 states

---

### Phase 6 — State Expansion (Weeks 16–28)
**Goal**: Add 10 new states (OH, PA, GA, WA, NC, MI, NJ, VA, TN, CO)

**Per-state process** (1-2 weeks per state):
1. Research official form numbers and legal citations for each document type
2. Create `templates/states/[state]/` directory structure
3. Implement state-specific template overrides (venue format, case number label, notary requirements, etc.)
4. Create `metadata.json` with all supported document types
5. Seed `state_document_support` records
6. Write state-specific tests
7. Verify auto-discovery works

---

### Phase 7 — Quality & Legal Review (Ongoing)
- Attorney review program: identify bar members willing to review templates
- Mark `is_verified = true` as documents are reviewed
- Create admin dashboard for template management
- User feedback loop: flag documents that need correction
- Quarterly legal citation audits (statutes change)

---

## API Design

### New Endpoints

#### Catalog Endpoints

```
GET  /api/catalog/matters                    List all matter types with state support
GET  /api/catalog/matters/:matterCode        Matter type detail + document types
GET  /api/catalog/matters/:matterCode/documents  Document types for a matter
GET  /api/catalog/states/:stateCode/matters  Matters supported in a state
GET  /api/catalog/document-types/:docCode    Single document type detail
```

#### Case Interview Endpoints

```
POST /api/cases/:caseId/interview            Send message to matter orchestrator
     Body: { message, conversationHistory }
     Returns: { response, newFacts, phaseAdvanced, currentPhase, readyToGenerate }

GET  /api/cases/:caseId/interview/status     Current phase + completion percentage
POST /api/cases/:caseId/interview/advance    Manually advance to next phase
POST /api/cases/:caseId/generate-package     Generate all docs in the case package
```

#### Document Queue Endpoints

```
GET  /api/cases/:caseId/queue                List document queue items + status
POST /api/cases/:caseId/queue/:docTypeCode/skip   Skip a document (user choice)
POST /api/cases/:caseId/queue/:docTypeCode/generate  Generate a single document
```

#### Enhanced Template Endpoints (extend existing /api/templates)

```
GET  /api/templates/matters                  (same as /api/catalog/matters — alias)
GET  /api/templates/support-matrix/:state    Full matrix of what's supported in state
```

### Updated Chat Route

```javascript
// routes/chat.js — updated routing logic
const orchestratorMap = {
  // Family
  divorce:           () => require('./orchestrators/family/DivorceOrchestrator'),
  legal_separation:  () => require('./orchestrators/family/LegalSeparationOrchestrator'),
  annulment:         () => require('./orchestrators/family/AnnulmentOrchestrator'),
  custody:           () => require('./orchestrators/family/CustodyOrchestrator'),
  child_support:     () => require('./orchestrators/family/ChildSupportOrchestrator'),
  paternity:         () => require('./orchestrators/family/PaternityOrchestrator'),
  domestic_violence: () => require('./orchestrators/family/DVROOrchestrator'),
  guardianship_minor:() => require('./orchestrators/family/GuardianshipOrchestrator'),
  adoption:          () => require('./orchestrators/family/AdoptionOrchestrator'),
  emancipation:      () => require('./orchestrators/family/EmancipationOrchestrator'),
  // Civil
  small_claims:      () => require('./orchestrators/civil/SmallClaimsOrchestrator'),
  landlord_tenant:   () => require('./orchestrators/civil/LandlordTenantOrchestrator'),
  debt_defense:      () => require('./orchestrators/civil/DebtDefenseOrchestrator'),
  civil_harassment:  () => require('./orchestrators/civil/CivilHarassmentOrchestrator'),
  name_change:       () => require('./orchestrators/civil/NameChangeOrchestrator'),
  general_civil:     () => require('./orchestrators/civil/GeneralCivilOrchestrator'),
  probate_small_estate:()=> require('./orchestrators/civil/ProbateOrchestrator'),
};

// In POST /api/chat:
const matterTypeCode = req.body.matterTypeCode
  || (caseData && caseData.matter_type_code)
  || 'general_affidavit';

const OrchestratorClass = orchestratorMap[matterTypeCode]?.() || GeneralAffidavitOrchestrator;
const orchestrator = new OrchestratorClass(req.body.state);
```

---

## Pricing Strategy

### Per-Document Pricing (existing model, extended)

| Package | Documents Included | Price |
|---------|-------------------|-------|
| Single Affidavit | 1 affidavit | $79 |
| Divorce Package (uncontested) | ~8 documents | $199 |
| Divorce Package (with children) | ~12 documents | $249 |
| Custody Package | ~5 documents | $149 |
| Small Claims Package | ~3 documents | $99 |
| Name Change Package | ~4 documents | $99 |
| DVRO Package | ~3 documents | $99 *(consider discounting for safety)* |
| Full Civil Defense Package | ~4 documents | $149 |
| Debt Defense Package | ~3 documents | $99 |
| Probate/Small Estate | 1–2 documents | $149 |

### Free Items (always free, builds trust)
- Demand letters (pre-litigation)
- Document checklists
- Interview/fact capture (only charge at document generation)
- Previews (first look before payment)

### `PRICING_CONFIG` Update in `routes/payment.js`

```javascript
const PRICING_CONFIG = {
  // Existing
  single_affidavit:         7900,   // $79
  family_law_package:      11999,   // $119.99
  all_state_access:        19999,   // $199.99

  // New
  divorce_package_basic:   19900,   // $199
  divorce_package_children: 24900,  // $249
  custody_package:         14900,   // $149
  child_support_package:   14900,   // $149
  dvro_package:             9900,   // $99 (safety consideration)
  small_claims_package:     9900,   // $99
  name_change_package:      9900,   // $99
  debt_defense_package:     9900,   // $99
  landlord_tenant_package: 14900,   // $149
  probate_small_estate:    14900,   // $149
  general_civil_package:   14900,   // $149
};
```

---

## Risk & Legal Considerations

### What We Are and Are Not

**We are**: A document drafting tool. The AI helps users organize their story into legally-formatted documents. This is analogous to LegalZoom, TurboTax, or a legal document assistant.

**We are not**: A law firm. We do not provide legal advice. The system does not advise users on the merits of their case or what claims to bring.

### Disclaimer Requirements

Every generated document must include:
1. Footer: "This document was prepared using AI-assisted software. It is not legal advice. Review with a licensed attorney before filing."
2. Pre-generation warning displayed to user in UI
3. Terms of Service acknowledge this limitation

### High-Risk Areas — Extra Caution Required

| Area | Risk | Mitigation |
|------|------|-----------|
| DVRO / Civil Harassment | Safety-critical, mistakes could endanger user | Add hotline numbers in UI, emergency fast-track, extra validation |
| Child Custody | Child welfare at stake | Mark all templates as `is_verified = false` until attorney-reviewed |
| Adoption / Termination of Parental Rights | Irrevocable consequences | Strong disclaimer, recommend attorney consultation |
| Debt Defense | SOL dates are jurisdiction-specific and complex | Always show SOL calculation with disclaimer |
| Immigration-adjacent (name change) | Name change can affect immigration status | Add specific disclaimer for non-citizen users |

### Template Accuracy Standard

- All templates with `is_verified = false` must display yellow "Unverified Template" banner
- Templates with `is_verified = true` (attorney-reviewed) display green "Attorney-Reviewed" badge
- Goal: all 7 current states, all matter types verified within 6 months of launch

### Unauthorized Practice of Law (UPL) Risk

The key protection: the system fills in facts the user provides. It does not decide what to file, what claims to assert, or what strategy to pursue. The AI interview is framed as "help me document your story" not "let me advise you on your case."

Boundary tests:
- ✅ OK: "Tell me what happened with the eviction" → extract facts → populate Answer
- ✅ OK: "Here are the grounds for annulment in your state" (factual information)
- ❌ Not OK: "You should claim [X] because it will win" (strategic legal advice)
- ❌ Not OK: "Your landlord violated [statute]" without user providing that fact

---

## Key Files Reference (Post-Implementation)

```
migrations/
├── 013_document_catalog.sql        Matter types + doc catalog + interview phases
├── 014_state_support_matrix.sql    State × matter × document support records

scripts/
├── seed_catalog.js                 Seed/update catalog tables idempotently

services/orchestrators/
├── BaseOrchestrator.js             Shared phase logic
├── family/
│   ├── DivorceOrchestrator.js      (consolidated from state-specific)
│   ├── CustodyOrchestrator.js
│   ├── ChildSupportOrchestrator.js
│   ├── PaternityOrchestrator.js
│   ├── DVROOrchestrator.js         (safety-first design)
│   ├── GuardianshipOrchestrator.js
│   ├── AdoptionOrchestrator.js
│   └── EmancipationOrchestrator.js
└── civil/
    ├── SmallClaimsOrchestrator.js
    ├── LandlordTenantOrchestrator.js
    ├── DebtDefenseOrchestrator.js
    ├── CivilHarassmentOrchestrator.js
    ├── NameChangeOrchestrator.js
    ├── GeneralCivilOrchestrator.js
    └── ProbateOrchestrator.js

templates/core/
├── BaseDocument.js                 Common ancestor for all document types
├── BaseAffidavitTemplate.js        (refactored to extend BaseDocument)
├── BasePleadingTemplate.js         Complaints, Petitions, Answers
├── BaseMotionTemplate.js           Motions, RFOs
├── BaseOrderTemplate.js            Decrees, Judgments (proposed)
├── BaseDeclarationTemplate.js      Unsworn declarations (penalty of perjury)
└── BaseNoticeTemplate.js           Notices, Letters, Summons

templates/states/
└── [state]/
    ├── AffidavitTemplate.js        (existing)
    ├── metadata.json               (expanded with all matter types)
    ├── divorce/                    (already exists for TX)
    ├── custody/
    ├── child_support/
    ├── domestic_violence/
    ├── small_claims/
    ├── name_change/
    ├── debt_defense/
    ├── landlord_tenant/
    └── [other matters]/

routes/
├── catalog.js                      NEW — /api/catalog/* endpoints
└── cases.js                        UPDATED — interview + queue endpoints

utils/
└── factNormalizer.js               UPDATED — new matter-specific fact categories
```

---

## Success Metrics

| Metric | 3-Month Target | 6-Month Target |
|--------|---------------|----------------|
| Matter types live | 4 (divorce + 3 civil) | All 16 |
| Document types available | 30 | 105 |
| States covered | 7 (current) | 17 |
| Templates `is_verified = true` | 20% | 60% |
| Avg interview completion rate | 70% | 80% |
| Avg facts per document | 8 | 12 |

---

*This plan is the working document for building the full SRL document database. When implementing, start with Phase 1 (database schema) and work forward. Each phase is independently deployable and testable.*
