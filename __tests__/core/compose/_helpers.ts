/**
 * Shared fixtures for the compose / render behaviour tests.
 *
 * Nothing here touches the jurisdiction registry: the profiles are built
 * in memory so the compose tests only depend on the compose contract.
 *
 * ── Identifier conventions the composer is expected to use ──────────────
 *
 * `supportedBy` on a paragraph (and `field` on a blank) carry ids drawn
 * from the CaseFile. The tests rely on these spellings:
 *
 *   CaseFile.fields[key]         → key                          ('marriageDate', 'grounds', …)
 *   CaseFile.county              → 'county'
 *   CaseFile.caseNumber          → 'caseNumber'
 *   party sub-fields             → 'parties.<self|other>.<field>' (PARTY_FIELD_ID helper)
 *   children                     → child.id
 *   facts                        → fact.id
 *   confirmations                → the ConfirmationKey itself     ('no_property', …)
 *
 * Blank slots (`blank.field`) used by the tests:
 *   'caseNumber' | 'marriageDate' | 'grounds' | 'property' | 'debts' | 'support' | 'otherAddress'
 *
 * Structured fields the tests put on CaseFile.fields (Field<…>):
 *   marriageDate: string (ISO / partial)   separationDate: string (ISO / partial)
 *   marriagePlace: string                  residencyMonths: number
 *   grounds: string (a Ground.code of the jurisdiction's divorce profile)
 *   propertyItems: string[]                debtItems: string[]
 *   spousalSupportRequested: boolean       indigencyRequested: boolean
 *   otherPartyMilitary: boolean            (absent = unknown; see confirmations.not_military)
 */

import type { Json } from '@/core/intelligence/types';
import type { AskRequest } from '@/core/intelligence/types';
import { ScriptedIntelligence, yes } from '@/core/intelligence/scripted';
import { ASK, JUDGE } from '@/core/intelligence/purposes';
import type { JurisdictionProfile } from '@/core/jurisdictions/types';
import type { CaseFile, Child, Confirmations, Fact, Field, Provenance } from '@/core/model/types';
import type { Block, DocumentTree, Section } from '@/core/compose/types';

// ─── Provenance / field builders ────────────────────────────────────────────

const AT = '2026-09-01T12:00:00.000Z';

export function statedProvenance(quote: string): Provenance {
  return { source: 'stated', quote, turnId: 'turn_1', at: AT };
}

export function stated<T extends Json>(value: T, quote = 'as the user said it'): Field<T> {
  return { value, provenance: statedProvenance(quote) };
}

export function confirmed(quote: string): Provenance {
  return { source: 'confirmed', quote, turnId: 'turn_2', at: AT };
}

/** The id a party sub-field carries in `supportedBy`. */
export function PARTY_FIELD_ID(side: 'self' | 'other', field: string): string {
  return `parties.${side}.${field}`;
}

/**
 * An ISO date `days` before now. Date arithmetic only (no parsing of
 * prose); the tests need "recent" vs "old" separation dates relative to
 * the day they run.
 */
export function daysAgoISO(days: number): string {
  const d = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  return d.toISOString().slice(0, 10);
}

// ─── In-memory jurisdiction profiles ────────────────────────────────────────

export const ON: JurisdictionProfile = {
  code: 'ON',
  name: 'Ontario',
  country: 'CA',
  paper: 'letter',
  directory: 'ontario',
  lexicon: {
    petitioner: 'Applicant',
    respondent: 'Respondent',
    fileNumberLabel: 'Court File No.',
    versus: 'AND BETWEEN',
    orderIntro: 'IT IS ORDERED',
    selfRepresented: 'self-represented',
    maritalProperty: 'family property',
    maritalDebts: 'family debts',
    counterClaimTitle: 'Answer with Claim',
    regionLabel: 'Province',
    countyLabel: 'Region',
  },
  court: {
    name: 'Superior Court of Justice',
    venueLines: ['ONTARIO', 'SUPERIOR COURT OF JUSTICE', 'FAMILY COURT'],
  },
  jurat: {
    officer: 'commissioner_for_oaths',
    verificationText: 'Sworn or affirmed before a Commissioner for Taking Oaths.',
    citations: ['Evidence Act, RSO 1990, c. E.23, s.45'],
  },
  divorce: {
    instrument: { petition: 'APPLICATION (GENERAL)', decree: 'DIVORCE ORDER', answer: 'ANSWER (FORM 10)' },
    residency: { text: 'Ordinarily resident in Ontario for at least one year.', citation: 'Divorce Act, s.3(1)', months: 12 },
    grounds: [
      { code: 'one_year_separation', label: 'One-Year Separation', citation: 'Divorce Act, s.8(2)(a)', noFault: true },
      { code: 'adultery', label: 'Adultery', citation: 'Divorce Act, s.8(2)(b)(i)', noFault: false },
      { code: 'cruelty', label: 'Physical or Mental Cruelty', citation: 'Divorce Act, s.8(2)(b)(ii)', noFault: false },
    ],
    separationMonthsRequired: 12,
    citations: {
      divorceAct: 'Divorce Act, RSC 1985, c. 3',
      familyLawAct: 'Family Law Act, RSO 1990, c. F.3',
      familyLawRules: 'Family Law Rules, O. Reg. 114/99',
    },
    officialFormsUrl: 'https://ontariocourtforms.on.ca/en/',
    officialFormsName: 'Ontario Court Forms',
  },
};

export const TX: JurisdictionProfile = {
  code: 'TX',
  name: 'Texas',
  country: 'US',
  paper: 'letter',
  directory: 'texas',
  lexicon: {
    petitioner: 'Petitioner',
    respondent: 'Respondent',
    fileNumberLabel: 'CAUSE NO.',
    versus: 'v.',
    orderIntro: 'IT IS ORDERED AND DECREED',
    selfRepresented: 'pro se',
    maritalProperty: 'community property',
    maritalDebts: 'community debts',
    counterClaimTitle: 'Counter-Petition',
    regionLabel: 'State',
    countyLabel: 'County',
  },
  court: {
    name: 'District Court',
    venueLines: ['IN THE DISTRICT COURT OF', '{county} COUNTY, {state}'],
    divisionLabel: 'JUDICIAL DISTRICT',
  },
  jurat: {
    officer: 'notary',
    verificationText: 'BEFORE ME, the undersigned authority, personally appeared the affiant.',
    citations: ['Tex. Civ. Prac. & Rem. Code § 18.002'],
  },
  divorce: {
    instrument: { petition: 'ORIGINAL PETITION FOR DIVORCE', decree: 'FINAL DECREE OF DIVORCE', answer: 'ORIGINAL ANSWER' },
    residency: { text: 'Domiciliary of Texas for six months and resident of the county for ninety days.', citation: 'Tex. Fam. Code § 6.301', months: 6 },
    waitingPeriod: { text: 'Sixty days after filing.', citation: 'Tex. Fam. Code § 6.702' },
    grounds: [
      { code: 'insupportability', label: 'Insupportability', citation: 'Tex. Fam. Code § 6.001', noFault: true },
      { code: 'cruelty', label: 'Cruel Treatment', citation: 'Tex. Fam. Code § 6.002', noFault: false, alternative: 'insupportability' },
      { code: 'adultery', label: 'Adultery', citation: 'Tex. Fam. Code § 6.003', noFault: false, alternative: 'insupportability' },
    ],
    citations: {
      dissolution: 'Tex. Fam. Code ch. 6',
      property: 'Tex. Fam. Code ch. 7',
      conservatorship: 'Tex. Fam. Code ch. 153',
    },
    officialFormsUrl: 'https://www.txcourts.gov/rules-forms/forms/',
    officialFormsName: 'Texas Judicial Branch — Forms',
  },
};

export const NY: JurisdictionProfile = {
  code: 'NY',
  name: 'New York',
  country: 'US',
  paper: 'letter',
  directory: 'newyork',
  lexicon: {
    petitioner: 'Plaintiff',
    respondent: 'Defendant',
    fileNumberLabel: 'INDEX NO.',
    versus: 'v.',
    orderIntro: 'IT IS ORDERED, ADJUDGED AND DECREED',
    selfRepresented: 'pro se',
    maritalProperty: 'marital property',
    maritalDebts: 'marital debts',
    counterClaimTitle: 'Counterclaim',
    regionLabel: 'State',
    countyLabel: 'County',
  },
  court: {
    name: 'Supreme Court',
    venueLines: ['SUPREME COURT OF THE STATE OF NEW YORK', 'COUNTY OF {county}'],
  },
  jurat: {
    officer: 'notary',
    verificationText: 'Subscribed and sworn to before me.',
    citations: ['N.Y. Executive Law § 137'],
  },
  divorce: {
    instrument: { petition: 'VERIFIED COMPLAINT FOR DIVORCE', decree: 'JUDGMENT OF DIVORCE', answer: 'VERIFIED ANSWER' },
    residency: { text: 'Residency under DRL § 230.', citation: 'N.Y. Dom. Rel. Law § 230', months: 12 },
    grounds: [
      { code: 'irretrievable_breakdown', label: 'Irretrievable Breakdown', citation: 'N.Y. Dom. Rel. Law § 170(7)', noFault: true },
      { code: 'cruelty', label: 'Cruel and Inhuman Treatment', citation: 'N.Y. Dom. Rel. Law § 170(1)', noFault: false },
    ],
    citations: { equitableDistribution: 'N.Y. Dom. Rel. Law § 236-B' },
    officialFormsUrl: 'https://www.nycourts.gov/statewide-forms',
    officialFormsName: 'New York Courts — Statewide Forms',
  },
};

export const PROFILES: Record<string, JurisdictionProfile> = { ON, TX, NY };

/** The no-fault ground the default record pleads, per jurisdiction. */
const DEFAULT_GROUNDS: Record<string, string> = {
  ON: 'one_year_separation',
  TX: 'insupportability',
  NY: 'irretrievable_breakdown',
};

// ─── CaseFile factory ───────────────────────────────────────────────────────

export const CHILD_IDS = ['child_1', 'child_2'] as const;
export const FACT_IDS = {
  marriage: 'fact_marriage',
  separation: 'fact_separation',
  grounds: 'fact_grounds',
  property: 'fact_property',
} as const;

export interface CaseFileOptions {
  jurisdiction?: keyof typeof PROFILES | string;
  role?: CaseFile['role'];
  language?: CaseFile['language'];
  matter?: string;
  /** Merged over the default fields. */
  fields?: Record<string, Field>;
  /** Field keys to remove after merging. */
  without?: string[];
  confirmations?: Confirmations;
  caseNumber?: Field<string>;
  county?: Field<string>;
  children?: Child[];
  facts?: Fact[];
  parties?: Partial<CaseFile['parties']>;
}

/** A fully stated divorce record; override what a scenario needs. */
export function caseFile(opts: CaseFileOptions = {}): CaseFile {
  const jurisdiction = opts.jurisdiction ?? 'ON';
  const grounds = DEFAULT_GROUNDS[jurisdiction] ?? 'one_year_separation';

  const defaultFields: Record<string, Field> = {
    marriageDate: stated('2015-06-14', 'we got married June 14th 2015'),
    marriagePlace: stated('Toronto', 'we married in Toronto'),
    separationDate: stated(daysAgoISO(600), 'we separated about twenty months ago'),
    residencyMonths: stated(36, "I've lived here three years"),
    grounds: stated(grounds, 'we have just been separated for over a year'),
    propertyItems: stated(['2018 Honda Civic', 'joint chequing account'], 'we own a Civic and a joint account'),
    debtItems: stated(['joint credit card'], 'there is a joint credit card'),
    spousalSupportRequested: stated(true, 'I will need some support'),
  };

  const fields = { ...defaultFields, ...(opts.fields ?? {}) };
  for (const key of opts.without ?? []) delete fields[key];

  const children: Child[] = opts.children ?? [
    { id: CHILD_IDS[0], name: stated('Ava Santos'), dateOfBirth: stated('2016-03-02'), residesWith: stated('self') },
    { id: CHILD_IDS[1], name: stated('Leo Santos'), dateOfBirth: stated('2019-11-20'), residesWith: stated('self') },
  ];

  const facts: Fact[] = opts.facts ?? [
    {
      id: FACT_IDS.marriage,
      statement: 'I married Daniel on June 14, 2015 in Toronto.',
      category: 'relationship',
      subcategory: 'marriage',
      provenance: statedProvenance('we got married June 14th 2015 in Toronto'),
      status: 'active',
      values: { date: '2015-06-14', place: 'Toronto' },
    },
    {
      id: FACT_IDS.separation,
      statement: 'We separated and have lived apart since then.',
      category: 'relationship',
      subcategory: 'separation',
      provenance: statedProvenance('we separated about twenty months ago'),
      status: 'active',
    },
    {
      id: FACT_IDS.grounds,
      statement: 'The marriage has broken down and we have been living separate and apart.',
      category: 'relationship',
      subcategory: 'grounds',
      provenance: statedProvenance('we have just been separated for over a year'),
      status: 'active',
      values: { ground: grounds },
    },
    {
      id: FACT_IDS.property,
      statement: 'We own a 2018 Honda Civic and a joint chequing account.',
      category: 'property',
      provenance: statedProvenance('we own a Civic and a joint account'),
      status: 'active',
    },
  ];

  return {
    id: 'case_test',
    userId: 'user_test',
    matter: opts.matter ?? 'divorce',
    jurisdiction,
    role: opts.role ?? 'petitioner',
    language: opts.language ?? 'en',
    country: PROFILES[jurisdiction]?.country,
    caseNumber: opts.caseNumber,
    county: opts.county ?? stated('Toronto', 'I live in Toronto'),
    parties: {
      self: {
        firstName: stated('Maria'),
        lastName: stated('Santos'),
        fullName: 'Maria Santos',
        address: stated('12 Elm Street, Toronto'),
        ...(opts.parties?.self ?? {}),
      },
      other: {
        firstName: stated('Daniel'),
        lastName: stated('Santos'),
        fullName: 'Daniel Santos',
        address: stated('40 Oak Avenue, Toronto'),
        ...(opts.parties?.other ?? {}),
      },
    },
    children,
    fields,
    facts,
    confirmations: opts.confirmations ?? {},
    interview: { phase: 'REVIEW', completed: ['INTAKE', 'MARRIAGE', 'CHILDREN', 'PROPERTY'], turns: 12, triaged: true },
  };
}

// ─── Scripted intelligence for composition ──────────────────────────────────

export interface NarrativeParagraph {
  text: string;
  supported_by: string[];
}

/** Default scripted narrative per section id; anything else gets no paragraphs. */
export const DEFAULT_NARRATIVE: Record<string, NarrativeParagraph[]> = {
  residency: [{ text: 'Residency narrative (scripted).', supported_by: ['residencyMonths', 'county'] }],
  grounds: [{ text: 'Grounds narrative (scripted).', supported_by: ['grounds', FACT_IDS.grounds] }],
  children: [{ text: 'Children narrative (scripted).', supported_by: [...CHILD_IDS] }],
  property: [{ text: 'Property narrative (scripted).', supported_by: ['propertyItems', FACT_IDS.property] }],
};

/**
 * An ask handler for ASK.COMPOSE_NARRATIVE that reads `input.section` and
 * answers from a per-section table. It is deliberately dumb: what ends up
 * in the tree is the composer's decision, not the script's.
 */
export function narrativeHandler(table: Record<string, NarrativeParagraph[]> = DEFAULT_NARRATIVE) {
  return (req: AskRequest): Json => {
    const input = (req.input ?? {}) as { [key: string]: Json };
    const section = typeof input.section === 'string' ? input.section : '';
    const paragraphs = table[section] ?? [];
    return { paragraphs: paragraphs.map((p) => ({ text: p.text, supported_by: [...p.supported_by] })) };
  };
}

/** Narrative scripted for every section; every verification judged supported. */
export function composeIntel(table: Record<string, NarrativeParagraph[]> = DEFAULT_NARRATIVE): ScriptedIntelligence {
  return new ScriptedIntelligence()
    .onAsk(ASK.COMPOSE_NARRATIVE, narrativeHandler(table))
    .onJudge(`${JUDGE.COMPOSE_VERIFY}:supported`, () => yes());
}

// ─── Tree finders ───────────────────────────────────────────────────────────

export type BlockOf<K extends Block['kind']> = Extract<Block, { kind: K }>;

export function blocksOfKind<K extends Block['kind']>(tree: DocumentTree | Section, kind: K): BlockOf<K>[] {
  const sections: Section[] = 'sections' in tree ? tree.sections : [tree];
  const out: BlockOf<K>[] = [];
  for (const s of sections) for (const b of s.blocks) if (b.kind === kind) out.push(b as BlockOf<K>);
  return out;
}

export function section(tree: DocumentTree, id: string): Section | undefined {
  return tree.sections.find((s) => s.id === id);
}

/** Like `section` but fails the test loudly when the section is absent. */
export function mustSection(tree: DocumentTree, id: string): Section {
  const s = section(tree, id);
  if (!s) throw new Error(`section "${id}" not in tree; have: ${tree.sections.map((x) => x.id).join(', ')}`);
  return s;
}

export function sectionIds(tree: DocumentTree): string[] {
  return tree.sections.map((s) => s.id);
}

export function blanksFor(tree: DocumentTree, field: string): DocumentTree['blanks'] {
  return tree.blanks.filter((b) => b.field === field);
}
