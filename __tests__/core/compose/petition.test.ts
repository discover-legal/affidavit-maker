/**
 * @jest-environment node
 *
 * compose({ kind: 'divorce_petition' }) — captions per jurisdiction, the
 * fixed section set, grounds handling, framing and language propagation.
 * Every narrative paragraph is scripted; every verification is judged.
 */
import { createComposer } from '@/core/compose';
import type { DocumentTree } from '@/core/compose';
import { ScriptedIntelligence, UnscriptedCallError, yes } from '@/core/intelligence/scripted';
import { ASK, JUDGE } from '@/core/intelligence/purposes';
import type { JurisdictionProfile } from '@/core/jurisdictions/types';
import type { CaseFile } from '@/core/model/types';
import {
  ON,
  TX,
  NY,
  FACT_IDS,
  blanksFor,
  blocksOfKind,
  caseFile,
  composeIntel,
  daysAgoISO,
  mustSection,
  sectionIds,
  stated,
} from './_helpers';

async function petition(file: CaseFile, jurisdiction: JurisdictionProfile, intel = composeIntel()): Promise<{ tree: DocumentTree; intel: ScriptedIntelligence }> {
  const composer = createComposer({ intelligence: intel });
  const tree = await composer.compose({ file, jurisdiction, kind: 'divorce_petition' });
  return { tree, intel };
}

const PETITION_SECTIONS = ['parties', 'residency', 'grounds', 'children', 'property', 'support', 'relief', 'verification'];

describe('compose divorce_petition', () => {
  describe('caption', () => {
    it('ON: Applicant / Respondent, Court File No., AND BETWEEN, titled as the ON instrument', async () => {
      const { tree } = await petition(caseFile({ jurisdiction: 'ON' }), ON);
      expect(tree.kind).toBe('divorce_petition');
      expect(tree.jurisdiction).toBe('ON');
      expect(tree.paper).toBe('letter');
      expect(tree.caption.parties.selfLabel).toBe('Applicant');
      expect(tree.caption.parties.otherLabel).toBe('Respondent');
      expect(tree.caption.fileNumberLabel).toBe('Court File No.');
      expect(tree.caption.parties.versus).toBe('AND BETWEEN');
      expect(tree.caption.title).toBe(ON.divorce!.instrument.petition);
      expect(tree.caption.courtLines.length).toBeGreaterThan(0);
    });

    it('ON: party names come from the record', async () => {
      const { tree } = await petition(caseFile({ jurisdiction: 'ON' }), ON);
      expect(tree.caption.parties.selfName).toBe('Maria Santos');
      expect(tree.caption.parties.otherName).toBe('Daniel Santos');
    });

    it('TX: Petitioner / Respondent, CAUSE NO., v., titled as the TX instrument', async () => {
      const { tree } = await petition(caseFile({ jurisdiction: 'TX' }), TX);
      expect(tree.caption.parties.selfLabel).toBe('Petitioner');
      expect(tree.caption.parties.otherLabel).toBe('Respondent');
      expect(tree.caption.fileNumberLabel).toBe(TX.lexicon.fileNumberLabel);
      expect(tree.caption.parties.versus).toBe('v.');
      expect(tree.caption.title).toBe(TX.divorce!.instrument.petition);
    });

    it('NY: Plaintiff / Defendant', async () => {
      const { tree } = await petition(caseFile({ jurisdiction: 'NY' }), NY);
      expect(tree.caption.parties.selfLabel).toBe('Plaintiff');
      expect(tree.caption.parties.otherLabel).toBe('Defendant');
      expect(tree.caption.fileNumberLabel).toBe(NY.lexicon.fileNumberLabel);
    });

    it('a respondent’s petition swaps the labels: the filer is still labelled by role', async () => {
      const { tree } = await petition(caseFile({ jurisdiction: 'TX', role: 'respondent' }), TX);
      // The record’s "self" is the respondent; the caption keeps the legal roles.
      expect(tree.caption.parties.selfLabel).toBe('Respondent');
      expect(tree.caption.parties.otherLabel).toBe('Petitioner');
    });

    it('missing case number → no fileNumber string and a caseNumber blank', async () => {
      const { tree } = await petition(caseFile({ jurisdiction: 'ON' }), ON);
      expect(tree.caption.fileNumber).toBeUndefined();
      expect(typeof tree.caption.fileNumber).not.toBe('string');
      const blanks = blanksFor(tree, 'caseNumber');
      expect(blanks.length).toBeGreaterThanOrEqual(1);
      expect(typeof blanks[0].note).toBe('string');
      expect(blanks[0].note.length).toBeGreaterThan(0);
    });

    it('stated case number → rendered verbatim and no caseNumber blank', async () => {
      const { tree } = await petition(caseFile({ jurisdiction: 'ON', caseNumber: stated('FS-26-01234') }), ON);
      expect(tree.caption.fileNumber).toBe('FS-26-01234');
      expect(blanksFor(tree, 'caseNumber')).toEqual([]);
    });
  });

  describe('sections', () => {
    it('a petitioner petition has the fixed section set, in order', async () => {
      const { tree } = await petition(caseFile({ jurisdiction: 'ON' }), ON);
      const ids = sectionIds(tree);
      for (const id of PETITION_SECTIONS) expect(ids).toContain(id);
      const positions = PETITION_SECTIONS.map((id) => ids.indexOf(id));
      expect([...positions].sort((a, b) => a - b)).toEqual(positions);
    });

    it('section ids are unique', async () => {
      const { tree } = await petition(caseFile({ jurisdiction: 'TX' }), TX);
      const ids = sectionIds(tree);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('residency paragraphs cite the residency field ids', async () => {
      const { tree } = await petition(caseFile({ jurisdiction: 'TX' }), TX);
      const paragraphs = blocksOfKind(mustSection(tree, 'residency'), 'paragraph');
      expect(paragraphs.length).toBeGreaterThan(0);
      for (const p of paragraphs) expect(p.supportedBy.length).toBeGreaterThan(0);
      const cited = new Set(paragraphs.flatMap((p) => p.supportedBy));
      expect(cited.has('residencyMonths')).toBe(true);
      expect(cited.has('county')).toBe(true);
    });

    it('the verification section carries a jurat naming the jurisdiction’s officer and a self signature', async () => {
      const { tree } = await petition(caseFile({ jurisdiction: 'TX' }), TX);
      const verification = mustSection(tree, 'verification');
      const jurats = blocksOfKind(verification, 'jurat');
      expect(jurats).toHaveLength(1);
      expect(jurats[0].officer).toBe(TX.jurat.officer);
      expect(jurats[0].citations).toEqual(TX.jurat.citations);
      const signatures = blocksOfKind(verification, 'signature');
      expect(signatures.some((s) => s.party === 'self')).toBe(true);
    });

    it('children section covers each child on the record', async () => {
      const { tree } = await petition(caseFile({ jurisdiction: 'ON' }), ON);
      const children = mustSection(tree, 'children');
      const cited = new Set(blocksOfKind(children, 'paragraph').flatMap((p) => p.supportedBy));
      expect(cited.has('child_1')).toBe(true);
      expect(cited.has('child_2')).toBe(true);
    });
  });

  describe('grounds', () => {
    it('TX cruelty: primary + alternative paragraphs both cite the grounds field, plus a note', async () => {
      const file = caseFile({ jurisdiction: 'TX', fields: { grounds: stated('cruelty', 'he was cruel to me for years') } });
      const { tree } = await petition(file, TX);
      const grounds = mustSection(tree, 'grounds');
      const citing = blocksOfKind(grounds, 'paragraph').filter((p) => p.supportedBy.includes('grounds'));
      expect(citing.length).toBeGreaterThanOrEqual(2);
      expect(blocksOfKind(grounds, 'note').length).toBeGreaterThanOrEqual(1);
      expect(blocksOfKind(grounds, 'blank')).toEqual([]);
    });

    it('TX insupportability (no alternative): grounds paragraph(s) but no alternative note', async () => {
      const { tree } = await petition(caseFile({ jurisdiction: 'TX' }), TX);
      const grounds = mustSection(tree, 'grounds');
      const citing = blocksOfKind(grounds, 'paragraph').filter((p) => p.supportedBy.includes('grounds'));
      expect(citing.length).toBeGreaterThanOrEqual(1);
      expect(blocksOfKind(grounds, 'blank')).toEqual([]);
    });

    it('ON separated < 12 months: grounds is a blank with a note, never a paragraph', async () => {
      const file = caseFile({
        jurisdiction: 'ON',
        fields: { separationDate: stated(daysAgoISO(200), 'we split up about six months ago') },
      });
      const { tree } = await petition(file, ON);
      const grounds = mustSection(tree, 'grounds');
      expect(blocksOfKind(grounds, 'paragraph')).toEqual([]);
      const blanks = blocksOfKind(grounds, 'blank');
      expect(blanks).toHaveLength(1);
      expect(blanks[0].field).toBe('grounds');
      expect(blanks[0].note.length).toBeGreaterThan(0);
      expect(blocksOfKind(grounds, 'note').length).toBeGreaterThanOrEqual(1);
      expect(blanksFor(tree, 'grounds').map((b) => b.section)).toEqual(['grounds']);
    });

    it('ON separated ≥ 12 months: grounds paragraph cites the grounds field, no blank', async () => {
      const { tree } = await petition(caseFile({ jurisdiction: 'ON' }), ON); // default separation is 600 days ago
      const grounds = mustSection(tree, 'grounds');
      expect(blocksOfKind(grounds, 'blank')).toEqual([]);
      const citing = blocksOfKind(grounds, 'paragraph').filter((p) => p.supportedBy.includes('grounds'));
      expect(citing.length).toBeGreaterThanOrEqual(1);
    });

    it('ON with no separation date on record: grounds cannot be pleaded as satisfied → blank', async () => {
      const { tree } = await petition(caseFile({ jurisdiction: 'ON', without: ['separationDate'] }), ON);
      const grounds = mustSection(tree, 'grounds');
      expect(blocksOfKind(grounds, 'paragraph')).toEqual([]);
      expect(blocksOfKind(grounds, 'blank').map((b) => b.field)).toEqual(['grounds']);
    });

    it('no grounds field at all → grounds blank', async () => {
      const { tree } = await petition(caseFile({ jurisdiction: 'TX', without: ['grounds'] }), TX);
      const grounds = mustSection(tree, 'grounds');
      expect(blocksOfKind(grounds, 'blank').map((b) => b.field)).toEqual(['grounds']);
      expect(blocksOfKind(grounds, 'paragraph').filter((p) => p.supportedBy.includes('grounds'))).toEqual([]);
    });
  });

  describe('framing', () => {
    it('carries a draft notice and the jurisdiction’s official forms link', async () => {
      const { tree } = await petition(caseFile({ jurisdiction: 'ON' }), ON);
      expect(typeof tree.framing.draftNotice).toBe('string');
      expect(tree.framing.draftNotice.length).toBeGreaterThan(0);
      expect(tree.framing.officialForms).toEqual({ name: ON.divorce!.officialFormsName, url: ON.divorce!.officialFormsUrl });
    });

    it('omits officialForms when the profile has none', async () => {
      const noForms: JurisdictionProfile = {
        ...TX,
        divorce: { ...TX.divorce!, officialFormsUrl: undefined, officialFormsName: undefined },
      };
      const { tree } = await petition(caseFile({ jurisdiction: 'TX' }), noForms);
      expect(tree.framing.officialForms).toBeUndefined();
    });
  });

  describe('language', () => {
    it('propagates the file’s language to the tree and to every narrative ask', async () => {
      const { tree, intel } = await petition(caseFile({ jurisdiction: 'TX', language: 'es' }), TX);
      expect(tree.language).toBe('es');
      const asks = intel.callsTo(ASK.COMPOSE_NARRATIVE);
      expect(asks.length).toBeGreaterThan(0);
      for (const call of asks) {
        expect(call.kind).toBe('ask');
        if (call.kind === 'ask') expect(call.request.language).toBe('es');
      }
    });

    it('defaults to English', async () => {
      const { tree, intel } = await petition(caseFile({ jurisdiction: 'TX' }), TX);
      expect(tree.language).toBe('en');
      for (const call of intel.callsTo(ASK.COMPOSE_NARRATIVE)) {
        if (call.kind === 'ask') expect(call.request.language).toBe('en');
      }
    });
  });

  describe('model calls', () => {
    it('asks for narrative with the section id in the input, never inside instructions', async () => {
      const { intel } = await petition(caseFile({ jurisdiction: 'TX' }), TX);
      const asks = intel.callsTo(ASK.COMPOSE_NARRATIVE);
      expect(asks.length).toBeGreaterThan(0);
      for (const call of asks) {
        if (call.kind !== 'ask') continue;
        const input = call.request.input as { [key: string]: unknown };
        expect(typeof input.section).toBe('string');
        expect(typeof call.request.schema).toBe('object');
      }
    });

    it('verifies every narrative paragraph it keeps', async () => {
      const { tree, intel } = await petition(caseFile({ jurisdiction: 'TX' }), TX);
      const judged = intel.callsTo(JUDGE.COMPOSE_VERIFY);
      const paragraphs = blocksOfKind(tree, 'paragraph');
      expect(judged.length).toBeGreaterThan(0);
      expect(judged.length).toBeLessThanOrEqual(paragraphs.length);
      for (const call of judged) {
        if (call.kind === 'judge') expect(Object.keys(call.request.questions)).toContain('supported');
      }
    });

    it('an unscripted model call throws — the composer never fails open on the model', async () => {
      const intel = new ScriptedIntelligence().onJudge(`${JUDGE.COMPOSE_VERIFY}:supported`, () => yes());
      // No ASK.COMPOSE_NARRATIVE scripted.
      const composer = createComposer({ intelligence: intel });
      await expect(composer.compose({ file: caseFile({ jurisdiction: 'TX' }), jurisdiction: TX, kind: 'divorce_petition' })).rejects.toBeInstanceOf(
        UnscriptedCallError,
      );
    });

    it('the record fact ids the script cites survive into the tree', async () => {
      const { tree } = await petition(caseFile({ jurisdiction: 'TX' }), TX);
      const cited = new Set(blocksOfKind(tree, 'paragraph').flatMap((p) => p.supportedBy));
      expect(cited.has(FACT_IDS.grounds)).toBe(true);
    });
  });
});
