/**
 * @jest-environment node
 *
 * The anti-fabrication invariants (docs/spec/03 §3) as they apply to the
 * typed DocumentTree: silence renders a blank, dispositive text renders
 * only from Confirmations, dates of the wrong shape render a blank, and
 * verify() turns any unsupported paragraph into a blank.
 */
import { createComposer } from '@/core/compose';
import type { Block, DocumentTree, Section } from '@/core/compose';
import { ScriptedIntelligence, no, yes } from '@/core/intelligence/scripted';
import { ASK, JUDGE } from '@/core/intelligence/purposes';
import type { CaseFile } from '@/core/model/types';
import {
  ON,
  TX,
  PARTY_FIELD_ID,
  blanksFor,
  blocksOfKind,
  caseFile,
  composeIntel,
  confirmed,
  mustSection,
  narrativeHandler,
  stated,
} from './_helpers';

async function compose(file: CaseFile, jurisdiction = ON, intel = composeIntel()): Promise<DocumentTree> {
  return createComposer({ intelligence: intel }).compose({ file, jurisdiction, kind: 'divorce_petition' });
}

/** A paragraph whose supportedBy is exactly the given confirmation key. */
function confirmationParagraph(sec: Section, key: string) {
  return blocksOfKind(sec, 'paragraph').filter((p) => p.supportedBy.length === 1 && p.supportedBy[0] === key);
}

describe('anti-fabrication invariants', () => {
  // ─── I-2 property / debts ───────────────────────────────────────────────

  describe('property', () => {
    it('(1) silence: no confirmation and no property fields → a property blank and no paragraph', async () => {
      const file = caseFile({ jurisdiction: 'ON', without: ['propertyItems'] });
      // Also drop the property fact so the record is genuinely silent about property.
      file.facts = file.facts.filter((f) => f.category !== 'property');
      const tree = await compose(file);
      const property = mustSection(tree, 'property');
      const blanks = blocksOfKind(property, 'blank').filter((b) => b.field === 'property');
      expect(blanks).toHaveLength(1);
      expect(blanks[0].note.length).toBeGreaterThan(0);
      expect(blocksOfKind(property, 'paragraph').filter((p) => p.supportedBy.includes('no_property'))).toEqual([]);
      expect(blanksFor(tree, 'property').map((b) => b.section)).toEqual(['property']);
    });

    it('(2) no_property confirmed → one paragraph supported by exactly the confirmation key, no property blank', async () => {
      const file = caseFile({
        jurisdiction: 'ON',
        without: ['propertyItems'],
        confirmations: { no_property: confirmed('we have nothing to divide, no house, no savings') },
      });
      file.facts = file.facts.filter((f) => f.category !== 'property');
      const tree = await compose(file);
      const property = mustSection(tree, 'property');
      expect(confirmationParagraph(property, 'no_property')).toHaveLength(1);
      expect(blanksFor(tree, 'property')).toEqual([]);
    });

    it('stated property items → an allegation paragraph citing the items, no property blank, no nil paragraph', async () => {
      const tree = await compose(caseFile({ jurisdiction: 'TX' }), TX);
      const property = mustSection(tree, 'property');
      expect(blanksFor(tree, 'property')).toEqual([]);
      expect(confirmationParagraph(property, 'no_property')).toEqual([]);
      const cited = new Set(blocksOfKind(property, 'paragraph').flatMap((p) => p.supportedBy));
      expect(cited.has('propertyItems')).toBe(true);
    });
  });

  describe('debts', () => {
    it('silence about debts → a debts blank and no nil-debts paragraph', async () => {
      const tree = await compose(caseFile({ jurisdiction: 'ON', without: ['debtItems'] }));
      const property = mustSection(tree, 'property');
      expect(blocksOfKind(property, 'blank').filter((b) => b.field === 'debts')).toHaveLength(1);
      expect(confirmationParagraph(property, 'no_debts')).toEqual([]);
    });

    it('no_debts confirmed → a paragraph supported by exactly the confirmation key, no debts blank', async () => {
      const tree = await compose(
        caseFile({ jurisdiction: 'ON', without: ['debtItems'], confirmations: { no_debts: confirmed('no debts at all, we paid everything off') } }),
      );
      const property = mustSection(tree, 'property');
      expect(confirmationParagraph(property, 'no_debts')).toHaveLength(1);
      expect(blanksFor(tree, 'debts')).toEqual([]);
    });
  });

  // ─── I-1 spousal support ────────────────────────────────────────────────

  describe('spousal support', () => {
    it('(3) spousalSupportRequested=false without a waiver → support blank, no waiver paragraph', async () => {
      const tree = await compose(caseFile({ jurisdiction: 'TX', fields: { spousalSupportRequested: stated(false, "I'm not asking for alimony") } }), TX);
      const support = mustSection(tree, 'support');
      expect(blocksOfKind(support, 'blank').filter((b) => b.field === 'support')).toHaveLength(1);
      expect(confirmationParagraph(support, 'support_waived')).toEqual([]);
      expect(blanksFor(tree, 'support').map((b) => b.section)).toEqual(['support']);
    });

    it('support field absent altogether → support blank', async () => {
      const tree = await compose(caseFile({ jurisdiction: 'TX', without: ['spousalSupportRequested'] }), TX);
      const support = mustSection(tree, 'support');
      expect(blocksOfKind(support, 'blank').map((b) => b.field)).toContain('support');
      expect(confirmationParagraph(support, 'support_waived')).toEqual([]);
    });

    it('(2) support_waived confirmed → a paragraph supported by exactly the confirmation key, no support blank', async () => {
      const tree = await compose(
        caseFile({
          jurisdiction: 'TX',
          fields: { spousalSupportRequested: stated(false) },
          confirmations: { support_waived: confirmed('we both agree neither of us will ask for spousal support, ever') },
        }),
        TX,
      );
      const support = mustSection(tree, 'support');
      expect(confirmationParagraph(support, 'support_waived')).toHaveLength(1);
      expect(blanksFor(tree, 'support')).toEqual([]);
    });

    it('a stated request renders a paragraph citing the request field, no waiver, no blank', async () => {
      const tree = await compose(caseFile({ jurisdiction: 'TX' }), TX); // default: spousalSupportRequested true
      const support = mustSection(tree, 'support');
      const cited = new Set(blocksOfKind(support, 'paragraph').flatMap((p) => p.supportedBy));
      expect(cited.has('spousalSupportRequested')).toBe(true);
      expect(confirmationParagraph(support, 'support_waived')).toEqual([]);
      expect(blanksFor(tree, 'support')).toEqual([]);
    });
  });

  // ─── no_children ────────────────────────────────────────────────────────

  describe('children', () => {
    it('no children on record and no confirmation → children blank, no nil paragraph', async () => {
      const tree = await compose(caseFile({ jurisdiction: 'TX', children: [] }), TX);
      const children = mustSection(tree, 'children');
      expect(blocksOfKind(children, 'blank').map((b) => b.field)).toContain('children');
      expect(confirmationParagraph(children, 'no_children')).toEqual([]);
    });

    it('no_children confirmed → paragraph supported by exactly the confirmation key, no children blank', async () => {
      const tree = await compose(caseFile({ jurisdiction: 'TX', children: [], confirmations: { no_children: confirmed('we never had kids') } }), TX);
      const children = mustSection(tree, 'children');
      expect(confirmationParagraph(children, 'no_children')).toHaveLength(1);
      expect(blanksFor(tree, 'children')).toEqual([]);
    });
  });

  // ─── I-5 date shape ─────────────────────────────────────────────────────

  describe('dates', () => {
    it('(4) a marriage date that is not an ISO / partial date renders a marriageDate blank', async () => {
      const tree = await compose(caseFile({ jurisdiction: 'TX', fields: { marriageDate: stated('a few months ago', 'we married a few months ago') } }), TX);
      const blanks = blocksOfKind(tree, 'blank').filter((b) => b.field === 'marriageDate');
      expect(blanks).toHaveLength(1);
      expect(blanks[0].note.length).toBeGreaterThan(0);
      expect(blanksFor(tree, 'marriageDate')).toHaveLength(1);
      // The prose value never becomes a paragraph's support.
      const cited = blocksOfKind(tree, 'paragraph').flatMap((p) => p.supportedBy);
      expect(cited).not.toContain('marriageDate');
    });

    it('an ISO marriage date renders no marriageDate blank and is cited', async () => {
      const tree = await compose(caseFile({ jurisdiction: 'TX' }), TX);
      expect(blanksFor(tree, 'marriageDate')).toEqual([]);
      const cited = new Set(blocksOfKind(tree, 'paragraph').flatMap((p) => p.supportedBy));
      expect(cited.has('marriageDate')).toBe(true);
    });

    it('a partial (year-month) marriage date is a valid date, not a blank', async () => {
      const tree = await compose(caseFile({ jurisdiction: 'TX', fields: { marriageDate: stated('2015-06', 'June 2015') } }), TX);
      expect(blanksFor(tree, 'marriageDate')).toEqual([]);
    });

    it('no marriage date at all renders a marriageDate blank', async () => {
      const tree = await compose(caseFile({ jurisdiction: 'TX', without: ['marriageDate'] }), TX);
      expect(blanksFor(tree, 'marriageDate')).toHaveLength(1);
    });
  });

  // ─── (6) provenance on every paragraph ──────────────────────────────────

  describe('every paragraph is supported', () => {
    const scenarios: Array<[string, () => CaseFile, typeof ON]> = [
      ['fully stated ON', () => caseFile({ jurisdiction: 'ON' }), ON],
      ['fully stated TX', () => caseFile({ jurisdiction: 'TX' }), TX],
      ['TX with confirmations', () => caseFile({ jurisdiction: 'TX', without: ['propertyItems', 'debtItems'], children: [], confirmations: { no_property: confirmed('nothing'), no_debts: confirmed('none'), no_children: confirmed('no kids') } }), TX],
      ['sparse ON', () => caseFile({ jurisdiction: 'ON', without: ['propertyItems', 'debtItems', 'grounds', 'separationDate', 'spousalSupportRequested'] }), ON],
    ];

    it.each(scenarios)('(6) %s: no paragraph has an empty supportedBy', async (_name, make, jurisdiction) => {
      const tree = await compose(make(), jurisdiction);
      const paragraphs = blocksOfKind(tree, 'paragraph');
      expect(paragraphs.length).toBeGreaterThan(0);
      for (const p of paragraphs) {
        expect(Array.isArray(p.supportedBy)).toBe(true);
        expect(p.supportedBy.length).toBeGreaterThan(0);
        for (const id of p.supportedBy) expect(id.length).toBeGreaterThan(0);
      }
    });

    it.each(scenarios)('%s: tree.blanks mirrors every blank block with its section', async (_name, make, jurisdiction) => {
      const tree = await compose(make(), jurisdiction);
      const fromBlocks = tree.sections.flatMap((s) => s.blocks.filter((b): b is Extract<Block, { kind: 'blank' }> => b.kind === 'blank').map((b) => ({ field: b.field, section: s.id })));
      const fromIndex = tree.blanks.map((b) => ({ field: b.field, section: b.section }));
      const key = (x: { field: string; section: string }) => `${x.section}/${x.field}`;
      expect(fromIndex.map(key).sort()).toEqual(fromBlocks.map(key).sort());
      for (const b of tree.blanks) expect(b.note.length).toBeGreaterThan(0);
    });
  });

  // ─── I-10 other party’s address ─────────────────────────────────────────

  describe('the other party’s address', () => {
    it('(7) whereaboutsUnknown affirmed → parties paragraph cites that field and a note follows', async () => {
      const file = caseFile({
        jurisdiction: 'TX',
        parties: {
          other: {
            firstName: stated('Daniel'),
            lastName: stated('Santos'),
            fullName: 'Daniel Santos',
            whereaboutsUnknown: stated(true, "I have no idea where he lives now"),
            suspectedLocation: stated('Louisiana', 'maybe Louisiana'),
          },
        },
      });
      const tree = await compose(file, TX);
      const parties = mustSection(tree, 'parties');
      const id = PARTY_FIELD_ID('other', 'whereaboutsUnknown');
      const citing = blocksOfKind(parties, 'paragraph').filter((p) => p.supportedBy.includes(id));
      expect(citing.length).toBeGreaterThanOrEqual(1);
      expect(blocksOfKind(parties, 'note').length).toBeGreaterThanOrEqual(1);
      expect(blanksFor(tree, 'otherAddress')).toEqual([]);
    });

    it('(7) no address and no whereabouts affirmation → otherAddress blank', async () => {
      const file = caseFile({
        jurisdiction: 'TX',
        parties: { other: { firstName: stated('Daniel'), lastName: stated('Santos'), fullName: 'Daniel Santos' } },
      });
      // The factory spreads overrides over defaults; remove the default address explicitly.
      delete file.parties.other.address;
      delete file.parties.other.whereaboutsUnknown;
      const tree = await compose(file, TX);
      const parties = mustSection(tree, 'parties');
      const blanks = blocksOfKind(parties, 'blank').filter((b) => b.field === 'otherAddress');
      expect(blanks).toHaveLength(1);
      expect(blanksFor(tree, 'otherAddress').map((b) => b.section)).toEqual(['parties']);
      expect(blocksOfKind(parties, 'paragraph').filter((p) => p.supportedBy.includes(PARTY_FIELD_ID('other', 'whereaboutsUnknown')))).toEqual([]);
    });

    it('a stated address → paragraph cites the address field, no otherAddress blank', async () => {
      const tree = await compose(caseFile({ jurisdiction: 'TX' }), TX);
      const parties = mustSection(tree, 'parties');
      const cited = new Set(blocksOfKind(parties, 'paragraph').flatMap((p) => p.supportedBy));
      expect(cited.has(PARTY_FIELD_ID('other', 'address'))).toBe(true);
      expect(blanksFor(tree, 'otherAddress')).toEqual([]);
    });
  });

  // ─── (5) verify() ───────────────────────────────────────────────────────

  describe('verify()', () => {
    function handTree(): DocumentTree {
      return {
        kind: 'divorce_petition',
        jurisdiction: 'TX',
        language: 'en',
        paper: 'letter',
        caption: {
          courtLines: ['IN THE DISTRICT COURT OF', 'HARRIS COUNTY, TEXAS'],
          fileNumberLabel: 'CAUSE NO.',
          parties: { selfLabel: 'Petitioner', selfName: 'Maria Santos', otherLabel: 'Respondent', otherName: 'Daniel Santos', versus: 'v.' },
          title: 'ORIGINAL PETITION FOR DIVORCE',
        },
        sections: [
          {
            id: 'parties',
            title: 'Parties',
            blocks: [
              { kind: 'heading', text: 'Parties', level: 2 },
              { kind: 'paragraph', text: 'Paragraph one (hand-built).', numbered: true, supportedBy: ['marriageDate', 'fact_marriage'] },
              { kind: 'paragraph', text: 'Paragraph two (hand-built).', numbered: true, supportedBy: ['fact_separation'] },
              { kind: 'note', text: 'A note (hand-built).' },
            ],
          },
          {
            id: 'property',
            title: 'Property',
            blocks: [
              { kind: 'paragraph', text: 'Paragraph three (hand-built).', numbered: true, supportedBy: ['no_property'] },
              { kind: 'blank', field: 'debts', note: 'Draft — say whether there are debts.' },
            ],
          },
        ],
        framing: { draftNotice: 'Draft — not for filing.' },
        blanks: [{ field: 'debts', note: 'Draft — say whether there are debts.', section: 'property' }],
      };
    }

    function verifier(judge: (state: unknown) => ReturnType<typeof yes>) {
      const intel = new ScriptedIntelligence()
        .onAsk(ASK.COMPOSE_NARRATIVE, narrativeHandler())
        .onJudge(`${JUDGE.COMPOSE_VERIFY}:supported`, (_q, state) => judge(state))
        .onJudge(`${JUDGE.COMPOSE_VERIFY}:restates`, () => no());
      return { intel, composer: createComposer({ intelligence: intel }) };
    }

    it('judged supported → the tree is unchanged, one judge call per paragraph', async () => {
      const { intel, composer } = verifier(() => yes());
      const before = handTree();
      const after = await composer.verify(handTree(), caseFile({ jurisdiction: 'TX' }));
      expect(after).toEqual(before);
      expect(intel.callsTo(JUDGE.COMPOSE_VERIFY)).toHaveLength(3);
      expect(intel.callsTo(ASK.COMPOSE_NARRATIVE)).toEqual([]);
    });

    it('(5) judged unsupported → the paragraph becomes a blank on its first supportedBy id, with a note, and tree.blanks gains it', async () => {
      // The second paragraph in "parties" is unsupported; everything else is fine.
      const { composer } = verifier((state) => {
        const s = state as { paragraph?: { text?: string; supportedBy?: string[]; supported_by?: string[] } };
        const ids = s.paragraph?.supportedBy ?? s.paragraph?.supported_by ?? [];
        return ids.length === 1 && ids[0] === 'fact_separation' ? no() : yes();
      });
      const after = await composer.verify(handTree(), caseFile({ jurisdiction: 'TX' }));

      const parties = mustSection(after, 'parties');
      expect(parties.blocks[0].kind).toBe('heading');
      expect(parties.blocks[1].kind).toBe('paragraph');
      expect(parties.blocks[2].kind).toBe('blank');
      const blank = parties.blocks[2] as Extract<Block, { kind: 'blank' }>;
      expect(blank.field).toBe('fact_separation');
      expect(blank.note.length).toBeGreaterThan(0);
      expect(parties.blocks[3].kind).toBe('note');
      expect(parties.blocks).toHaveLength(4);

      expect(after.blanks.map((b) => `${b.section}/${b.field}`).sort()).toEqual(['parties/fact_separation', 'property/debts']);
      // The other sections are untouched.
      expect(mustSection(after, 'property')).toEqual(mustSection(handTree(), 'property'));
    });

    it('a paragraph with no supportedBy that is judged unsupported becomes a blank on "narrative"', async () => {
      const { composer } = verifier(() => no());
      const tree = handTree();
      tree.sections[0].blocks = [{ kind: 'paragraph', text: 'Unsupported (hand-built).', supportedBy: [] }];
      tree.sections[1].blocks = [];
      tree.blanks = [];
      const after = await composer.verify(tree, caseFile({ jurisdiction: 'TX' }));
      expect(after.sections[0].blocks).toHaveLength(1);
      expect(after.sections[0].blocks[0].kind).toBe('blank');
      expect((after.sections[0].blocks[0] as Extract<Block, { kind: 'blank' }>).field).toBe('narrative');
      expect(after.blanks).toEqual([expect.objectContaining({ field: 'narrative', section: 'parties' })]);
    });

    it('judges each paragraph against the record: state names the paragraph and the record', async () => {
      const { intel, composer } = verifier(() => yes());
      await composer.verify(handTree(), caseFile({ jurisdiction: 'TX' }));
      for (const call of intel.callsTo(JUDGE.COMPOSE_VERIFY)) {
        if (call.kind !== 'judge') continue;
        const state = call.request.state as { [key: string]: unknown };
        expect(state).toHaveProperty('paragraph');
        expect(state).toHaveProperty('record');
        expect(call.request.questions.supported.type).toBe('yesno');
      }
    });

    it('is idempotent: a second pass with all-yes changes nothing and judges each paragraph exactly once more', async () => {
      const { intel, composer } = verifier(() => yes());
      const file = caseFile({ jurisdiction: 'TX' });
      const once = await composer.verify(handTree(), file);
      const callsAfterOnce = intel.callsTo(JUDGE.COMPOSE_VERIFY).length;
      const twice = await composer.verify(once, file);
      expect(twice).toEqual(once);
      expect(intel.callsTo(JUDGE.COMPOSE_VERIFY).length).toBe(callsAfterOnce * 2);
      expect(callsAfterOnce).toBe(blocksOfKind(once, 'paragraph').length);
    });

    it('a blanked paragraph is not re-judged on the next pass (blanks are not paragraphs)', async () => {
      const { intel, composer } = verifier(() => no());
      const file = caseFile({ jurisdiction: 'TX' });
      const once = await composer.verify(handTree(), file);
      expect(intel.callsTo(JUDGE.COMPOSE_VERIFY)).toHaveLength(3);
      expect(blocksOfKind(once, 'paragraph')).toEqual([]);
      expect(blocksOfKind(once, 'blank')).toHaveLength(4); // 3 blanked paragraphs + the original debts blank
      const twice = await composer.verify(once, file);
      expect(intel.callsTo(JUDGE.COMPOSE_VERIFY)).toHaveLength(3);
      expect(twice).toEqual(once);
    });

    it('does not mutate the tree it was given', async () => {
      const { composer } = verifier(() => no());
      const input = handTree();
      const snapshot = handTree();
      await composer.verify(input, caseFile({ jurisdiction: 'TX' }));
      expect(input).toEqual(snapshot);
    });
  });

  // ─── compose() applies the same verification ────────────────────────────

  describe('compose() verifies what it drafts', () => {
    it('a narrative paragraph judged unsupported never reaches the tree as a paragraph', async () => {
      const intel = new ScriptedIntelligence()
        .onAsk(ASK.COMPOSE_NARRATIVE, narrativeHandler({ residency: [{ text: 'Residency narrative (scripted, will be rejected).', supported_by: ['residencyMonths'] }] }))
        .onJudge(`${JUDGE.COMPOSE_VERIFY}:supported`, (_q, state) => {
          const s = state as { paragraph?: { supportedBy?: string[]; supported_by?: string[] } };
          const ids = s.paragraph?.supportedBy ?? s.paragraph?.supported_by ?? [];
          return ids.length === 1 && ids[0] === 'residencyMonths' ? no() : yes();
        })
        .onJudge(`${JUDGE.COMPOSE_VERIFY}:restates`, () => no());
      const tree = await compose(caseFile({ jurisdiction: 'TX' }), TX, intel);
      const residency = mustSection(tree, 'residency');
      // The rejected addition is dropped outright. A blank marks a REQUIRED
      // value that is missing, and residencyMonths is present on this file,
      // so no blank appears for it either (the structural paragraph stands).
      expect(blocksOfKind(residency, 'paragraph').filter((p) => p.supportedBy.length === 1 && p.supportedBy[0] === 'residencyMonths')).toEqual([]);
      expect(blocksOfKind(residency, 'blank').some((b) => b.field === 'residencyMonths')).toBe(false);
      expect(blanksFor(tree, 'residencyMonths')).toEqual([]);
    });
  });
});
