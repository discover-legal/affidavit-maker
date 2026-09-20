/**
 * @jest-environment node
 *
 * compose({ kind: 'divorce_answer' }) — the responding party’s document:
 * admissions scaffold, defences, the jurisdiction’s counter-claim title,
 * verification. The answer transcribes and never decides (I-12).
 */
import { createComposer } from '@/core/compose';
import type { DocumentTree } from '@/core/compose';
import type { JurisdictionProfile } from '@/core/jurisdictions/types';
import type { CaseFile } from '@/core/model/types';
import { ON, TX, NY, blocksOfKind, caseFile, composeIntel, mustSection, sectionIds, stated } from './_helpers';

async function answer(file: CaseFile, jurisdiction: JurisdictionProfile): Promise<DocumentTree> {
  const intel = composeIntel();
  return createComposer({ intelligence: intel }).compose({ file, jurisdiction, kind: 'divorce_answer' });
}

const ANSWER_SECTIONS = ['admissions', 'defenses', 'claim', 'verification'];

describe('compose divorce_answer', () => {
  describe('Ontario (Form 10 family)', () => {
    it('is titled as the ON answer instrument, with Applicant / Respondent and Court File No.', async () => {
      const tree = await answer(caseFile({ jurisdiction: 'ON', role: 'respondent' }), ON);
      expect(tree.kind).toBe('divorce_answer');
      expect(tree.caption.title).toBe(ON.divorce!.instrument.answer);
      expect(tree.caption.fileNumberLabel).toBe('Court File No.');
      expect(tree.caption.parties.versus).toBe('AND BETWEEN');
      // The record’s "self" is the respondent; the caption keeps the legal roles.
      expect(tree.caption.parties.selfLabel).toBe('Respondent');
      expect(tree.caption.parties.otherLabel).toBe('Applicant');
      expect(tree.caption.parties.selfName).toBe('Maria Santos');
    });

    it('has the fixed answer section set, in order', async () => {
      const tree = await answer(caseFile({ jurisdiction: 'ON', role: 'respondent' }), ON);
      const ids = sectionIds(tree);
      for (const id of ANSWER_SECTIONS) expect(ids).toContain(id);
      const positions = ANSWER_SECTIONS.map((id) => ids.indexOf(id));
      expect([...positions].sort((a, b) => a - b)).toEqual(positions);
      expect(new Set(ids).size).toBe(ids.length);
    });

    it('admissions is a list block the respondent marks up — nothing is auto-decided', async () => {
      const tree = await answer(caseFile({ jurisdiction: 'ON', role: 'respondent' }), ON);
      const admissions = mustSection(tree, 'admissions');
      const lists = blocksOfKind(admissions, 'list');
      expect(lists.length).toBeGreaterThanOrEqual(1);
      expect(lists[0].items.length).toBeGreaterThan(0);
      for (const item of lists[0].items) expect(typeof item).toBe('string');
      // A note tells the respondent to mark each paragraph; no blank is invented for it.
      expect(blocksOfKind(admissions, 'note').length).toBeGreaterThanOrEqual(1);
    });

    it('the claim section is titled from the lexicon (Answer with Claim)', async () => {
      const tree = await answer(caseFile({ jurisdiction: 'ON', role: 'respondent' }), ON);
      const claim = mustSection(tree, 'claim');
      expect(claim.title).toBe(ON.lexicon.counterClaimTitle);
      expect(claim.title).toBe('Answer with Claim');
    });

    it('the claim section carries no relief paragraph the respondent did not state', async () => {
      const tree = await answer(caseFile({ jurisdiction: 'ON', role: 'respondent' }), ON);
      const claim = mustSection(tree, 'claim');
      // Only stated fields / facts / confirmations may support a paragraph; every paragraph here cites something.
      for (const p of blocksOfKind(claim, 'paragraph')) expect(p.supportedBy.length).toBeGreaterThan(0);
    });

    it('the defenses section exists and never asserts a defence the record does not support', async () => {
      const tree = await answer(caseFile({ jurisdiction: 'ON', role: 'respondent' }), ON);
      const defenses = mustSection(tree, 'defenses');
      for (const p of blocksOfKind(defenses, 'paragraph')) expect(p.supportedBy.length).toBeGreaterThan(0);
    });

    it('verification swears before a commissioner for oaths and signs as self', async () => {
      const tree = await answer(caseFile({ jurisdiction: 'ON', role: 'respondent' }), ON);
      const verification = mustSection(tree, 'verification');
      const jurats = blocksOfKind(verification, 'jurat');
      expect(jurats).toHaveLength(1);
      expect(jurats[0].officer).toBe(ON.jurat.officer);
      expect(blocksOfKind(verification, 'signature').some((s) => s.party === 'self')).toBe(true);
    });

    it('framing carries the draft notice and the ON official forms link', async () => {
      const tree = await answer(caseFile({ jurisdiction: 'ON', role: 'respondent' }), ON);
      expect(tree.framing.draftNotice.length).toBeGreaterThan(0);
      expect(tree.framing.officialForms).toEqual({ name: ON.divorce!.officialFormsName, url: ON.divorce!.officialFormsUrl });
    });
  });

  describe('Texas', () => {
    it('is titled as the TX answer instrument with CAUSE NO. and v.', async () => {
      const tree = await answer(caseFile({ jurisdiction: 'TX', role: 'respondent' }), TX);
      expect(tree.caption.title).toBe(TX.divorce!.instrument.answer);
      expect(tree.caption.fileNumberLabel).toBe(TX.lexicon.fileNumberLabel);
      expect(tree.caption.parties.versus).toBe('v.');
      expect(tree.caption.parties.selfLabel).toBe('Respondent');
      expect(tree.caption.parties.otherLabel).toBe('Petitioner');
    });

    it('the counter-claim section is titled from the TX lexicon (Counter-Petition)', async () => {
      const tree = await answer(caseFile({ jurisdiction: 'TX', role: 'respondent' }), TX);
      const claim = mustSection(tree, 'claim');
      expect(claim.title).toBe(TX.lexicon.counterClaimTitle);
      expect(claim.title).toBe('Counter-Petition');
    });

    it('verification swears before a notary', async () => {
      const tree = await answer(caseFile({ jurisdiction: 'TX', role: 'respondent' }), TX);
      const jurats = blocksOfKind(mustSection(tree, 'verification'), 'jurat');
      expect(jurats).toHaveLength(1);
      expect(jurats[0].officer).toBe('notary');
    });
  });

  describe('New York', () => {
    it('labels the parties Defendant / Plaintiff and titles the claim from the NY lexicon', async () => {
      const tree = await answer(caseFile({ jurisdiction: 'NY', role: 'respondent' }), NY);
      expect(tree.caption.parties.selfLabel).toBe('Defendant');
      expect(tree.caption.parties.otherLabel).toBe('Plaintiff');
      expect(mustSection(tree, 'claim').title).toBe(NY.lexicon.counterClaimTitle);
    });
  });

  describe('record-driven pieces', () => {
    it('a missing case number renders a caseNumber blank on the answer too', async () => {
      const tree = await answer(caseFile({ jurisdiction: 'ON', role: 'respondent' }), ON);
      expect(tree.caption.fileNumber).toBeUndefined();
      expect(tree.blanks.some((b) => b.field === 'caseNumber')).toBe(true);
    });

    it('a stated case number is carried into the caption', async () => {
      const tree = await answer(caseFile({ jurisdiction: 'ON', role: 'respondent', caseNumber: stated('FS-26-01234') }), ON);
      expect(tree.caption.fileNumber).toBe('FS-26-01234');
      expect(tree.blanks.some((b) => b.field === 'caseNumber')).toBe(false);
    });

    it('every paragraph on the answer cites the record', async () => {
      for (const j of [ON, TX, NY]) {
        const tree = await answer(caseFile({ jurisdiction: j.code, role: 'respondent' }), j);
        for (const p of blocksOfKind(tree, 'paragraph')) expect(p.supportedBy.length).toBeGreaterThan(0);
      }
    });

    it('language propagates to the answer tree', async () => {
      const tree = await answer(caseFile({ jurisdiction: 'TX', role: 'respondent', language: 'es' }), TX);
      expect(tree.language).toBe('es');
    });
  });
});
