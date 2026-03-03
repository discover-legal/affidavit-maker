-- Migration 013: Document catalog, matter types, interview infrastructure
-- Adds the full catalog of legal matter types and document types for
-- civil and family law, extending the cases table for matter-specific interviews.

-- ─── Matter types catalog ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS matter_types (
  id            SERIAL PRIMARY KEY,
  code          VARCHAR(50)  UNIQUE NOT NULL,
  practice_area VARCHAR(20)  NOT NULL,          -- 'family' | 'civil'
  category      VARCHAR(50),                    -- 'dissolution', 'custody', 'housing', etc.
  display_name  VARCHAR(200) NOT NULL,
  short_name    VARCHAR(100),
  description   TEXT,
  tagline       TEXT,                           -- SRL-facing one-liner shown in UI
  is_active     BOOLEAN DEFAULT true,
  is_packaged   BOOLEAN DEFAULT true,           -- has a multi-doc interview flow
  sort_order    INTEGER DEFAULT 0,
  created_at    TIMESTAMP DEFAULT NOW()
);

-- ─── Document type catalog ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS document_type_catalog (
  id                    SERIAL PRIMARY KEY,
  matter_type_code      VARCHAR(50)  NOT NULL REFERENCES matter_types(code),
  code                  VARCHAR(100) NOT NULL,
  display_name          VARCHAR(200) NOT NULL,
  short_name            VARCHAR(100),
  description           TEXT,
  base_template_class   VARCHAR(50)  NOT NULL DEFAULT 'affidavit',
  -- 'affidavit' | 'declaration' | 'pleading' | 'motion' | 'order' | 'notice' | 'letter' | 'worksheet'
  is_initiating         BOOLEAN DEFAULT false,
  typical_filer         VARCHAR(20),            -- 'petitioner' | 'respondent' | 'plaintiff' | 'defendant' | 'either'
  typical_sequence      INTEGER DEFAULT 0,
  requires_prior_docs   JSONB DEFAULT '[]',
  fact_categories       JSONB DEFAULT '[]',
  required_fields       JSONB DEFAULT '[]',
  optional_fields       JSONB DEFAULT '[]',
  is_active             BOOLEAN DEFAULT true,
  UNIQUE(matter_type_code, code)
);

-- ─── State × matter × document support matrix ──────────────────────────────────
CREATE TABLE IF NOT EXISTS state_document_support (
  id                    SERIAL PRIMARY KEY,
  state_code            CHAR(2)      NOT NULL,
  matter_type_code      VARCHAR(50)  NOT NULL REFERENCES matter_types(code),
  document_type_code    VARCHAR(100) NOT NULL,
  is_supported          BOOLEAN DEFAULT false,
  is_verified           BOOLEAN DEFAULT false,  -- attorney-reviewed
  template_version      VARCHAR(20)  DEFAULT '1.0',
  official_form_code    VARCHAR(100),           -- e.g. 'FL-100', 'UD-100'
  official_form_url     TEXT,
  legal_citations       JSONB DEFAULT '[]',
  state_specific_fields JSONB DEFAULT '{}',
  notes                 TEXT,
  effective_date        DATE,
  last_reviewed_at      DATE,
  reviewed_by           VARCHAR(200),
  created_at            TIMESTAMP DEFAULT NOW(),
  updated_at            TIMESTAMP DEFAULT NOW(),
  UNIQUE(state_code, matter_type_code, document_type_code)
);

-- ─── Interview phase configuration ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS interview_phase_configs (
  id                       SERIAL PRIMARY KEY,
  matter_type_code         VARCHAR(50) NOT NULL REFERENCES matter_types(code),
  phase_code               VARCHAR(50) NOT NULL,
  phase_order              INTEGER NOT NULL,
  display_name             VARCHAR(100),
  description              TEXT,
  system_prompt            TEXT NOT NULL,
  required_fact_categories JSONB DEFAULT '[]',
  min_facts                INTEGER DEFAULT 0,
  is_optional              BOOLEAN DEFAULT false,
  condition                JSONB DEFAULT NULL,
  next_phase_code          VARCHAR(50),
  created_at               TIMESTAMP DEFAULT NOW(),
  UNIQUE(matter_type_code, phase_code)
);

-- ─── Case document queue ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS case_document_queue (
  id                  SERIAL PRIMARY KEY,
  case_id             INTEGER NOT NULL REFERENCES cases(id) ON DELETE CASCADE,
  document_type_code  VARCHAR(100) NOT NULL,
  matter_type_code    VARCHAR(50)  NOT NULL,
  document_id         INTEGER REFERENCES documents(id) ON DELETE SET NULL,
  status              VARCHAR(30) DEFAULT 'pending',  -- 'pending'|'generating'|'done'|'skipped'
  generation_order    INTEGER DEFAULT 0,
  is_required         BOOLEAN DEFAULT true,
  skip_reason         TEXT,
  created_at          TIMESTAMP DEFAULT NOW(),
  updated_at          TIMESTAMP DEFAULT NOW()
);

-- ─── Extend cases table ────────────────────────────────────────────────────────
ALTER TABLE cases
  ADD COLUMN IF NOT EXISTS matter_type_code VARCHAR(50) REFERENCES matter_types(code),
  ADD COLUMN IF NOT EXISTS interview_phase  VARCHAR(50) DEFAULT 'INTAKE',
  ADD COLUMN IF NOT EXISTS interview_data   JSONB DEFAULT '{}';

-- ─── Indexes ──────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_matter_types_practice    ON matter_types(practice_area);
CREATE INDEX IF NOT EXISTS idx_matter_types_active      ON matter_types(is_active) WHERE is_active = true;
CREATE INDEX IF NOT EXISTS idx_doc_catalog_matter       ON document_type_catalog(matter_type_code);
CREATE INDEX IF NOT EXISTS idx_state_support_state      ON state_document_support(state_code);
CREATE INDEX IF NOT EXISTS idx_state_support_matter     ON state_document_support(matter_type_code);
CREATE INDEX IF NOT EXISTS idx_state_support_lookup     ON state_document_support(state_code, matter_type_code, document_type_code);
CREATE INDEX IF NOT EXISTS idx_queue_case               ON case_document_queue(case_id);
CREATE INDEX IF NOT EXISTS idx_queue_status             ON case_document_queue(status);
CREATE INDEX IF NOT EXISTS idx_cases_matter_type        ON cases(matter_type_code);

-- ─── RLS ──────────────────────────────────────────────────────────────────────
ALTER TABLE matter_types          ENABLE ROW LEVEL SECURITY;
ALTER TABLE document_type_catalog ENABLE ROW LEVEL SECURITY;
ALTER TABLE state_document_support ENABLE ROW LEVEL SECURITY;
ALTER TABLE interview_phase_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE case_document_queue   ENABLE ROW LEVEL SECURITY;

-- Catalog tables: read-only for everyone (public reference data)
DROP POLICY IF EXISTS matter_types_read          ON matter_types;
DROP POLICY IF EXISTS doc_catalog_read           ON document_type_catalog;
DROP POLICY IF EXISTS state_support_read         ON state_document_support;
DROP POLICY IF EXISTS interview_config_read      ON interview_phase_configs;

CREATE POLICY matter_types_read     ON matter_types          FOR SELECT USING (true);
CREATE POLICY doc_catalog_read      ON document_type_catalog FOR SELECT USING (true);
CREATE POLICY state_support_read    ON state_document_support FOR SELECT USING (true);
CREATE POLICY interview_config_read ON interview_phase_configs FOR SELECT USING (true);

-- Queue: scoped to case owner
DROP POLICY IF EXISTS queue_user_isolation ON case_document_queue;
CREATE POLICY queue_user_isolation ON case_document_queue
  USING (
    case_id IN (
      SELECT id FROM cases
      WHERE user_id = current_setting('app.current_user_id', true)::integer
    )
  );

-- ─── Updated_at trigger for state_document_support ────────────────────────────
CREATE OR REPLACE FUNCTION update_state_support_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS state_support_updated_at ON state_document_support;
CREATE TRIGGER state_support_updated_at
  BEFORE UPDATE ON state_document_support
  FOR EACH ROW EXECUTE FUNCTION update_state_support_updated_at();

-- ─── SEED: Matter types ────────────────────────────────────────────────────────

INSERT INTO matter_types (code, practice_area, category, display_name, short_name, tagline, is_packaged, sort_order) VALUES

-- Family Law
('divorce',            'family', 'dissolution',  'Divorce / Dissolution of Marriage', 'Divorce',        'End your marriage and divide your assets fairly',                 true,  10),
('legal_separation',   'family', 'dissolution',  'Legal Separation',                  'Separation',     'Separate legally while remaining married',                        true,  20),
('annulment',          'family', 'dissolution',  'Annulment / Nullity of Marriage',   'Annulment',      'Legally void a marriage that should not have existed',            true,  30),
('custody',            'family', 'custody',      'Child Custody & Visitation',        'Custody',        'Establish or modify who your children live with',                 true,  40),
('child_support',      'family', 'custody',      'Child Support',                     'Child Support',  'Establish, modify, or enforce child support payments',            true,  50),
('paternity',          'family', 'parentage',    'Paternity / Parentage',             'Paternity',      'Legally establish who is a child''s parent',                      true,  60),
('dvro',               'family', 'protection',   'Domestic Violence Restraining Order','DVRO',          'Get a protective order against domestic violence',                true,  70),
('guardianship_minor', 'family', 'guardianship', 'Guardianship of a Minor',           'Guardianship',   'Become the legal guardian of a child who needs you',              true,  80),
('adoption',           'family', 'adoption',     'Stepparent / Relative Adoption',    'Adoption',       'Legally adopt a child you are already raising',                   true,  90),
('emancipation',       'family', 'emancipation', 'Emancipation of a Minor',           'Emancipation',   'Become legally independent before turning 18',                    true, 100),

-- Civil Law
('small_claims',       'civil',  'money',        'Small Claims Court',                'Small Claims',   'Sue someone for money owed without hiring a lawyer',              true, 110),
('landlord_tenant',    'civil',  'housing',      'Landlord-Tenant Dispute',           'Eviction/Tenant','Fight an eviction, reclaim your deposit, or handle habitability',  true, 120),
('debt_defense',       'civil',  'money',        'Debt / Collection Defense',         'Debt Defense',   'Defend yourself against a debt collection lawsuit',               true, 130),
('civil_harassment',   'civil',  'protection',   'Civil Harassment Restraining Order','Harassment Order','Get a court order to stop harassment by a non-family member',    true, 140),
('name_change',        'civil',  'identity',     'Name Change',                       'Name Change',    'Legally change your name or your child''s name',                  true, 150),
('general_civil',      'civil',  'litigation',   'General Civil Litigation',          'Civil Case',     'File or defend a civil lawsuit in your state',                    true, 160),
('probate',             'civil',  'probate',      'Probate & Estate Administration',   'Probate',        'Administer a loved one''s estate after death',                    true, 170)

ON CONFLICT (code) DO NOTHING;

-- ─── SEED: Document type catalog (family law) ─────────────────────────────────

INSERT INTO document_type_catalog
  (matter_type_code, code, display_name, base_template_class, is_initiating, typical_filer, typical_sequence, fact_categories, required_fields)
VALUES

-- DIVORCE
('divorce','divorce_petition',        'Petition for Dissolution of Marriage',          'pleading',    true,  'petitioner', 1,  '["relational","temporal"]',           '["petitionerName","respondentName","state","county"]'),
('divorce','divorce_response',        'Response to Petition for Dissolution',          'pleading',    false, 'respondent', 2,  '["relational"]',                      '["respondentName","state","county"]'),
('divorce','summons',                 'Summons (Family Law)',                           'notice',      false, 'petitioner', 2,  '[]',                                  '["petitionerName","respondentName","state"]'),
('divorce','waiver_of_service',       'Waiver / Acceptance of Service',                'affidavit',   false, 'respondent', 3,  '["relational"]',                      '["respondentName","state"]'),
('divorce','financial_disclosure',    'Income & Expense Declaration',                  'declaration', false, 'either',     4,  '["financial"]',                       '["affiantName","state"]'),
('divorce','asset_debt_schedule',     'Schedule of Assets and Debts',                  'declaration', false, 'either',     5,  '["property","financial"]',            '["affiantName","state"]'),
('divorce','parenting_plan',          'Parenting Plan / Custody & Visitation Schedule','order',       false, 'petitioner', 6,  '["children","relational"]',           '["petitionerName","respondentName","state"]'),
('divorce','child_support_worksheet', 'Child Support Calculation Worksheet',           'worksheet',   false, 'either',     7,  '["financial","children"]',            '["state"]'),
('divorce','prove_up_affidavit',      'Affidavit in Support of Default Judgment',      'affidavit',   false, 'petitioner', 8,  '["relational","temporal"]',           '["affiantName","state","county"]'),
('divorce','military_status_affidavit','Military Status Affidavit',                    'affidavit',   false, 'petitioner', 9,  '[]',                                  '["affiantName","state"]'),
('divorce','indigency_affidavit',     'Affidavit of Indigency / Fee Waiver',           'affidavit',   false, 'petitioner', 10, '["financial"]',                       '["affiantName","state","county"]'),
('divorce','cert_last_known_address', 'Certificate of Last Known Address',             'affidavit',   false, 'petitioner', 11, '[]',                                  '["affiantName","state"]'),
('divorce','divorce_decree',          'Final Decree of Dissolution',                   'order',       false, 'petitioner', 12, '["relational","property"]',           '["petitionerName","respondentName","state","county"]'),

-- LEGAL SEPARATION
('legal_separation','separation_petition', 'Petition for Legal Separation',           'pleading',    true,  'petitioner', 1,  '["relational","temporal"]',           '["petitionerName","respondentName","state","county"]'),
('legal_separation','separation_response', 'Response to Separation Petition',         'pleading',    false, 'respondent', 2,  '["relational"]',                      '["respondentName","state"]'),
('legal_separation','separation_agreement','Separation Agreement',                     'declaration', false, 'either',     3,  '["property","financial"]',            '["petitionerName","respondentName","state"]'),
('legal_separation','separation_decree',   'Decree of Legal Separation',              'order',       false, 'petitioner', 4,  '["relational","property"]',           '["petitionerName","respondentName","state","county"]'),

-- ANNULMENT
('annulment','nullity_petition',      'Petition for Nullity of Marriage',              'pleading',    true,  'petitioner', 1,  '["relational","temporal"]',           '["petitionerName","respondentName","state","county"]'),
('annulment','nullity_declaration',   'Declaration Re: Grounds for Nullity',           'declaration', false, 'petitioner', 2,  '["relational","temporal"]',           '["affiantName","state"]'),
('annulment','nullity_judgment',      'Judgment of Nullity',                           'order',       false, 'petitioner', 3,  '[]',                                  '["petitionerName","respondentName","state","county"]'),

-- CUSTODY
('custody','custody_petition',        'Petition to Establish Custody and Visitation',  'pleading',    true,  'petitioner', 1,  '["children","relational"]',           '["petitionerName","respondentName","state","county"]'),
('custody','custody_response',        'Response to Custody Petition',                  'pleading',    false, 'respondent', 2,  '["children"]',                        '["respondentName","state"]'),
('custody','temp_custody_declaration','Declaration in Support of Temporary Orders',    'declaration', false, 'petitioner', 3,  '["children","safety","temporal"]',    '["affiantName","state"]'),
('custody','parenting_plan',          'Proposed Parenting Plan',                       'order',       false, 'petitioner', 4,  '["children","relational"]',           '["petitionerName","respondentName","state"]'),
('custody','custody_modification',    'Motion to Modify Custody Order',                'motion',      false, 'either',     5,  '["children","temporal"]',             '["affiantName","state","county"]'),
('custody','custody_mod_declaration', 'Declaration Re: Change in Circumstances',       'declaration', false, 'either',     6,  '["children","temporal"]',             '["affiantName","state"]'),
('custody','custody_order',           'Child Custody Order',                           'order',       false, 'petitioner', 7,  '["children"]',                        '["petitionerName","respondentName","state","county"]'),

-- CHILD SUPPORT
('child_support','support_petition',  'Petition to Establish Child Support',           'pleading',    true,  'petitioner', 1,  '["financial","children"]',            '["petitionerName","respondentName","state","county"]'),
('child_support','support_response',  'Response to Child Support Petition',            'pleading',    false, 'respondent', 2,  '["financial"]',                       '["respondentName","state"]'),
('child_support','income_declaration','Declaration of Income and Expenses',            'declaration', false, 'either',     3,  '["financial"]',                       '["affiantName","state"]'),
('child_support','support_worksheet', 'Child Support Calculation Worksheet',           'worksheet',   false, 'either',     4,  '["financial","children"]',            '["state"]'),
('child_support','support_modification','Motion to Modify Child Support',              'motion',      false, 'either',     5,  '["financial","temporal"]',            '["affiantName","state","county"]'),
('child_support','support_mod_declaration','Declaration Re: Changed Circumstances',   'declaration', false, 'either',     6,  '["financial","temporal"]',            '["affiantName","state"]'),
('child_support','support_enforcement','Motion to Enforce Child Support Order',        'motion',      false, 'petitioner', 7,  '["financial","temporal"]',            '["affiantName","state","county"]'),
('child_support','arrears_declaration','Declaration Re: Unpaid Child Support Arrears', 'declaration', false, 'petitioner', 8,  '["financial","temporal"]',            '["affiantName","state"]'),
('child_support','support_order',     'Child Support Order',                           'order',       false, 'petitioner', 9,  '["financial","children"]',            '["petitionerName","respondentName","state","county"]'),
('child_support','wage_assignment',   'Wage Assignment / Income Withholding Order',    'order',       false, 'petitioner', 10, '["financial"]',                       '["respondentName","state"]'),

-- PATERNITY
('paternity','parentage_petition',    'Petition to Establish Parentage',               'pleading',    true,  'petitioner', 1,  '["relational","children"]',           '["petitionerName","respondentName","state","county"]'),
('paternity','voluntary_declaration', 'Voluntary Declaration of Paternity/Parentage',  'declaration', false, 'either',     2,  '["relational","children"]',           '["affiantName","state"]'),
('paternity','parentage_declaration', 'Declaration Re: Parentage',                     'declaration', false, 'petitioner', 3,  '["relational","children"]',           '["affiantName","state"]'),
('paternity','disestablishment_petition','Petition to Disestablish Paternity',         'pleading',    false, 'petitioner', 4,  '["relational","children"]',           '["petitionerName","respondentName","state","county"]'),
('paternity','parentage_order',       'Order Establishing Parentage',                  'order',       false, 'petitioner', 5,  '["relational","children"]',           '["petitionerName","respondentName","state","county"]'),

-- DOMESTIC VIOLENCE
('dvro','dvro_petition', 'Request for DV Restraining Order',              'pleading',    true,  'petitioner', 1,  '["injury","temporal","pattern"]',     '["petitionerName","respondentName","state","county"]'),
('dvro','dvro_declaration','Declaration Re: Domestic Violence',           'declaration', false, 'petitioner', 2,  '["injury","temporal","pattern","witness"]','["affiantName","state"]'),
('dvro','dvro_response', 'Response to DV Restraining Order',              'pleading',    false, 'respondent', 3,  '["relational"]',                      '["respondentName","state"]'),
('dvro','dvro_final',    'Domestic Violence Restraining Order After Hearing','order',    false, 'petitioner', 4,  '[]',                                  '["petitionerName","respondentName","state","county"]'),
('dvro','dvro_renewal',  'Request for Renewal of Restraining Order',      'motion',      false, 'petitioner', 5,  '["temporal","pattern"]',              '["affiantName","state","county"]'),

-- GUARDIANSHIP MINOR
('guardianship_minor','guardianship_petition','Petition for Appointment of Guardian of Minor','pleading',true,'petitioner',1,'["relational","children"]',            '["petitionerName","state","county"]'),
('guardianship_minor','guardian_declaration', 'Declaration in Support of Guardianship','declaration',false,'petitioner', 2,  '["relational","children"]',           '["affiantName","state"]'),
('guardianship_minor','guardian_consent',     'Consent of Proposed Guardian',          'declaration', false, 'petitioner', 3,  '[]',                                  '["affiantName","state"]'),
('guardianship_minor','guardianship_order',   'Order Appointing Guardian',             'order',       false, 'petitioner', 4,  '["relational","children"]',           '["petitionerName","state","county"]'),
('guardianship_minor','annual_report',        'Annual Guardian Report',                'declaration', false, 'petitioner', 5,  '["children"]',                        '["affiantName","state"]'),

-- ADOPTION
('adoption','adoption_petition',      'Petition for Adoption',                         'pleading',    true,  'petitioner', 1,  '["relational","children"]',           '["petitionerName","state","county"]'),
('adoption','adoption_consent',       'Consent to Adoption (biological parent)',        'declaration', false, 'either',     2,  '["relational","children"]',           '["affiantName","state"]'),
('adoption','adoption_declaration',   'Declaration in Support of Adoption',             'declaration', false, 'petitioner', 3,  '["relational","children"]',           '["affiantName","state"]'),
('adoption','adoption_decree',        'Decree of Adoption',                             'order',       false, 'petitioner', 4,  '["relational","children"]',           '["petitionerName","state","county"]'),

-- EMANCIPATION
('emancipation','emancipation_petition',  'Petition for Declaration of Emancipation',  'pleading',    true,  'petitioner', 1,  '["relational","financial"]',          '["petitionerName","state","county"]'),
('emancipation','emancipation_declaration','Declaration of Minor''s Circumstances',    'declaration', false, 'petitioner', 2,  '["relational","financial","temporal"]','["affiantName","state"]'),
('emancipation','emancipation_decree',    'Declaration of Emancipation',               'order',       false, 'petitioner', 3,  '[]',                                  '["petitionerName","state","county"]'),

-- SMALL CLAIMS
('small_claims','demand_letter',          'Pre-Litigation Demand Letter',              'letter',      true,  'plaintiff',  1,  '["financial","temporal","communication"]','["petitionerName","respondentName"]'),
('small_claims','small_claims_complaint', 'Small Claims Complaint / Claim Form',       'pleading',    true,  'plaintiff',  2,  '["financial","temporal","witness"]',  '["petitionerName","respondentName","state","county"]'),
('small_claims','small_claims_declaration','Declaration in Support of Claim',          'declaration', false, 'plaintiff',  3,  '["financial","temporal","witness","evidence"]','["affiantName","state"]'),
('small_claims','small_claims_answer',    'Defendant''s Answer to Small Claims',       'pleading',    false, 'defendant',  4,  '["financial","temporal"]',            '["respondentName","state","county"]'),
('small_claims','small_claims_counterclaim','Defendant''s Counterclaim',               'pleading',    false, 'defendant',  5,  '["financial","temporal"]',            '["respondentName","state","county"]'),
('small_claims','default_vacate_motion',  'Motion to Vacate Default Judgment',         'motion',      false, 'defendant',  6,  '["temporal"]',                        '["respondentName","state","county"]'),

-- LANDLORD-TENANT
('landlord_tenant','ud_answer',           'Answer to Unlawful Detainer / Eviction',    'pleading',    false, 'defendant',  1,  '["temporal","financial","habitability"]','["respondentName","state","county"]'),
('landlord_tenant','habitability_declaration','Declaration Re: Habitability Defects',  'declaration', false, 'defendant',  2,  '["habitability","temporal","witness"]','["affiantName","state"]'),
('landlord_tenant','rent_payment_declaration','Declaration Re: Rent Payment History',  'declaration', false, 'defendant',  3,  '["financial","temporal"]',            '["affiantName","state"]'),
('landlord_tenant','retaliation_declaration', 'Declaration Re: Retaliatory Eviction',  'declaration', false, 'defendant',  4,  '["temporal","communication","witness"]','["affiantName","state"]'),
('landlord_tenant','security_deposit_demand', 'Demand Letter for Return of Security Deposit','letter',false, 'defendant',  5,  '["financial","temporal"]',            '["petitionerName","respondentName"]'),
('landlord_tenant','ud_complaint',        'Unlawful Detainer Complaint',               'pleading',    true,  'plaintiff',  1,  '["financial","temporal"]',            '["petitionerName","respondentName","state","county"]'),
('landlord_tenant','notice_declaration',  'Declaration Re: Service of Notice',         'declaration', false, 'plaintiff',  2,  '["temporal"]',                        '["affiantName","state"]'),
('landlord_tenant','rent_ledger_declaration','Declaration Re: Rent Ledger / Unpaid Rent','declaration',false,'plaintiff',  3,  '["financial","temporal"]',            '["affiantName","state"]'),

-- DEBT DEFENSE
('debt_defense','debt_answer',            'Answer to Debt Collection Complaint',       'pleading',    false, 'defendant',  1,  '["financial","temporal"]',            '["respondentName","state","county"]'),
('debt_defense','sol_motion_dismiss',     'Motion to Dismiss (Statute of Limitations)','motion',      false, 'defendant',  2,  '["financial","temporal"]',            '["respondentName","state","county"]'),
('debt_defense','sol_declaration',        'Declaration in Support of SOL Motion',      'declaration', false, 'defendant',  3,  '["financial","temporal"]',            '["affiantName","state"]'),
('debt_defense','validation_demand',      'Debt Validation Demand Letter',             'letter',      false, 'defendant',  1,  '["financial","temporal"]',            '["respondentName"]'),
('debt_defense','exemption_claim',        'Claim of Exemption (Wage Garnishment)',      'motion',      false, 'defendant',  4,  '["financial","exemption"]',           '["respondentName","state","county"]'),
('debt_defense','exemption_declaration',  'Declaration in Support of Exemption Claim', 'declaration', false, 'defendant',  5,  '["financial","exemption"]',           '["affiantName","state"]'),
('debt_defense','general_denial',         'General Denial',                             'pleading',    false, 'defendant',  1,  '[]',                                  '["respondentName","state","county"]'),

-- CIVIL HARASSMENT
('civil_harassment','ch_petition',        'Petition for Civil Harassment Restraining Order','pleading',true, 'petitioner', 1,  '["pattern","temporal","injury"]',     '["petitionerName","respondentName","state","county"]'),
('civil_harassment','ch_declaration',     'Declaration Re: Civil Harassment',          'declaration', false, 'petitioner', 2,  '["pattern","temporal","injury","witness"]','["affiantName","state"]'),
('civil_harassment','ch_response',        'Response to Civil Harassment Petition',     'pleading',    false, 'respondent', 3,  '["relational"]',                      '["respondentName","state"]'),
('civil_harassment','ch_final_order',     'Civil Harassment Restraining Order After Hearing','order', false, 'petitioner', 4,  '[]',                                  '["petitionerName","respondentName","state","county"]'),
('civil_harassment','ch_renewal',         'Request for Renewal of Restraining Order',  'motion',      false, 'petitioner', 5,  '["temporal","pattern"]',              '["affiantName","state","county"]'),

-- NAME CHANGE
('name_change','name_petition',           'Petition for Change of Name',               'pleading',    true,  'petitioner', 1,  '["identity","relational"]',           '["petitionerName","state","county"]'),
('name_change','name_declaration',        'Declaration in Support of Name Change',     'declaration', false, 'petitioner', 2,  '["identity","relational"]',           '["affiantName","state"]'),
('name_change','name_osc',                'Order to Show Cause Re: Name Change',       'order',       false, 'petitioner', 3,  '[]',                                  '["petitionerName","state","county"]'),
('name_change','publication_affidavit',   'Affidavit of Publication',                  'affidavit',   false, 'petitioner', 4,  '["temporal"]',                        '["affiantName","state","county"]'),
('name_change','name_decree',             'Decree Changing Name',                      'order',       false, 'petitioner', 5,  '[]',                                  '["petitionerName","state","county"]'),
('name_change','minor_name_petition',     'Petition for Change of Name (Minor)',        'pleading',    true,  'petitioner', 1,  '["identity","children"]',             '["petitionerName","state","county"]'),

-- GENERAL CIVIL
('general_civil','civil_complaint',       'Civil Complaint',                           'pleading',    true,  'plaintiff',  1,  '["financial","temporal","witness"]',  '["petitionerName","respondentName","state","county"]'),
('general_civil','civil_answer',          'Answer to Civil Complaint',                 'pleading',    false, 'defendant',  2,  '["financial","temporal"]',            '["respondentName","state","county"]'),
('general_civil','general_declaration',   'General Declaration',                       'declaration', false, 'either',     3,  '["witness","temporal"]',              '["affiantName","state"]'),
('general_civil','proof_service',         'Proof of Service',                          'affidavit',   false, 'plaintiff',  4,  '["temporal"]',                        '["affiantName","state"]'),
('general_civil','request_dismissal',     'Request for Dismissal',                     'motion',      false, 'plaintiff',  5,  '[]',                                  '["petitionerName","state","county"]'),

-- PROBATE / SMALL ESTATE
('probate','small_estate_affidavit','Small Estate Affidavit',             'affidavit',   true,  'petitioner', 1,  '["relational","property","temporal"]','["affiantName","state","county"]'),
('probate','heirship_affidavit',    'Affidavit of Heirship',              'affidavit',   true,  'petitioner', 1,  '["relational","property","temporal","heirship"]','["affiantName","state","county"]'),
('probate','inventory_affidavit',   'Inventory and Appraisal Affidavit', 'affidavit',   false, 'petitioner', 2,  '["property"]',                        '["affiantName","state","county"]'),
('probate','successor_affidavit',   'Affidavit of Successor',            'affidavit',   false, 'petitioner', 2,  '["relational","property"]',           '["affiantName","state","county"]')

ON CONFLICT (matter_type_code, code) DO NOTHING;

-- ─── SEED: State document support for current 7 states ────────────────────────
-- Marks already-built document types as supported + verified.
-- All others set is_supported=false initially (populated as templates are built).

INSERT INTO state_document_support (state_code, matter_type_code, document_type_code, is_supported, is_verified, template_version, notes)
SELECT s.state_code, 'divorce' AS matter_type_code, dt.code, true, true, '2.0',
       'Built in original TX divorce set'
FROM (VALUES ('TX'),('UT'),('AZ'),('CA'),('FL'),('IL'),('NY')) AS s(state_code)
CROSS JOIN (VALUES
  ('divorce_petition'),('divorce_decree'),('waiver_of_service'),
  ('cert_last_known_address'),('military_status_affidavit'),
  ('prove_up_affidavit'),('indigency_affidavit')
) AS dt(code)
ON CONFLICT (state_code, matter_type_code, document_type_code) DO NOTHING;

-- General affidavit: all 7 US states already supported
INSERT INTO state_document_support (state_code, matter_type_code, document_type_code, is_supported, is_verified, template_version)
SELECT s.state_code, 'general_civil' AS matter_type_code, 'general_declaration', true, true, '2.0'
FROM (VALUES ('TX'),('UT'),('AZ'),('CA'),('FL'),('IL'),('NY')) AS s(state_code)
ON CONFLICT (state_code, matter_type_code, document_type_code) DO NOTHING;

-- ─── SEED: Canadian provinces — divorce documents (Divorce Act, RSC 1985, c. 3) ─
-- Core divorce documents supported for ON, BC, AB, QC.
-- US-specific documents (military affidavit, prove-up, cert of last known address,
-- indigency affidavit) are NOT applicable in Canadian provinces.

INSERT INTO state_document_support (state_code, matter_type_code, document_type_code, is_supported, is_verified, template_version, notes)
SELECT p.province_code, 'divorce' AS matter_type_code, dt.code, true, true, '1.0',
       'Canadian provincial divorce under federal Divorce Act (RSC 1985, c. 3)'
FROM (VALUES ('ON'),('BC'),('AB'),('QC')) AS p(province_code)
CROSS JOIN (VALUES
  ('divorce_petition'),('divorce_decree'),('parenting_plan'),
  ('financial_disclosure'),('waiver_of_service')
) AS dt(code)
ON CONFLICT (state_code, matter_type_code, document_type_code) DO NOTHING;

-- General affidavit: Canadian provinces
INSERT INTO state_document_support (state_code, matter_type_code, document_type_code, is_supported, is_verified, template_version, notes)
SELECT p.province_code, 'general_civil' AS matter_type_code, 'general_declaration', true, true, '1.0',
       'General affidavit / declaration for Canadian provincial proceedings'
FROM (VALUES ('ON'),('BC'),('AB'),('QC')) AS p(province_code)
ON CONFLICT (state_code, matter_type_code, document_type_code) DO NOTHING;
