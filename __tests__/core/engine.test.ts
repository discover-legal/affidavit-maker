/** @jest-environment node */
/**
 * End-to-end through the v2 engine façade with every model answer scripted:
 * triage → one interview turn (with life-story promotion) → draft → PDF.
 * Assertions are structural; the "LLM loop" is the scripted intelligence.
 */
import { createEngine } from '@/core/engine';
import { ASK, JUDGE, ScriptedIntelligence, no, pick, yes, type Json } from '@/core/intelligence';
import type { TurnProposal } from '@/core/interview/types';
import { emptyCaseFile } from '@/core/model/types';
import { jurisdictionStub, registryStub, simpleDefinition } from './helpers/scripted';

const turnProposal: TurnProposal = {
  say: "Thanks Marcus. What is your spouse's full legal name?",
  questions_asked: ["What is your spouse's full legal name?"],
  phase_complete: false,
  fields: { petitioner_first_name: 'Marcus', petitioner_last_name: 'Thompson', county: 'Toronto' },
  facts: [{ statement: 'I live in Toronto, Ontario.', category: 'residence', quote: 'I live in Toronto' }],
  corrections: [],
  affirmations: [],
  children: [],
};

function scriptedIntel(): ScriptedIntelligence {
  return new ScriptedIntelligence()
    .onJudge(`${JUDGE.TRIAGE_CLASSIFY}:matter`, () => pick('divorce', 0.96, ['sample']))
    .onJudge(`${JUDGE.TRIAGE_CLASSIFY}:danger`, () => no())
    .onJudge(`${JUDGE.TRIAGE_CLASSIFY}:scope`, () => pick('in_scope'))
    .onJudge(`${JUDGE.TRIAGE_CLASSIFY}:language`, () => pick('en'))
    .onAsk(ASK.TRIAGE_REPLY, { say: 'It sounds like a divorce. Shall we start?', clarifying_question: null })
    .onJudge('language', () => pick('en'))
    .onJudge('in_language', () => yes())
    .onJudge('affirmed', () => yes())
    .onJudge('supersedes', () => no())
    .onJudge('duplicate', () => no())
    .onJudge('same_child', () => no())
    .onAsk(ASK.INTERVIEW_TURN, () => turnProposal as unknown as Json)
    .onAsk(ASK.PROFILE_PROMOTE, { fields: {} })
    .onAsk(ASK.COMPOSE_NARRATIVE, (req) => {
      const input = req.input as { section?: string };
      return { paragraphs: [{ text: `Narrative for ${input.section ?? 'section'}.`, supported_by: ['county'] }] };
    })
    .onJudge('supported', () => yes())
    .onJudge('restates', () => no());
}

describe('v2 engine end to end (scripted)', () => {
  const on = jurisdictionStub('ON');
  const engine = () =>
    createEngine({ intelligence: scriptedIntel(), jurisdictions: registryStub([on]), matters: [simpleDefinition()] });

  test('triage picks the matter, the interview turn fills the file, the draft renders', async () => {
    const eng = engine();
    const start = emptyCaseFile({ id: 'c1', userId: 'u1', jurisdiction: 'ON', country: 'CA' });

    const triaged = await eng.chat({ file: start, history: [], message: 'my wife and I are splitting up', story: null });
    expect(triaged.stage).toBe('triage');
    expect(triaged.file.matter).toBe('divorce');
    expect(triaged.file.interview.triaged).toBe(true);

    const turn = await eng.chat({
      file: triaged.file,
      history: [{ role: 'assistant', content: 'It sounds like a divorce. Shall we start?' }],
      message: 'I am Marcus Thompson, I live in Toronto',
      story: null,
    });
    expect(turn.stage).toBe('interview');
    if (turn.stage !== 'interview') return;
    expect(turn.result.asked).toHaveLength(1);
    expect(turn.file.parties.self.firstName?.value).toBe('Marcus');
    expect(turn.file.parties.self.firstName?.provenance.source).toBe('stated');
    expect(turn.file.county?.value).toBe('Toronto');
    expect(turn.file.facts.filter((f) => f.status === 'active')).toHaveLength(1);
    expect(turn.file.interview.turns).toBe(1);

    const tree = await eng.draft(turn.file, 'divorce_petition');
    expect(tree.kind).toBe('divorce_petition');
    expect(tree.jurisdiction).toBe('ON');
    expect(tree.caption.parties.selfLabel).toBe(on.lexicon.petitioner);
    expect(tree.caption.fileNumber).toBeUndefined();
    expect(tree.blanks.some((b) => b.field === 'caseNumber')).toBe(true);
    for (const section of tree.sections) {
      for (const block of section.blocks) {
        if (block.kind === 'paragraph') expect(block.supportedBy.length).toBeGreaterThan(0);
      }
    }

    const pdf = await eng.renderer.pdf(tree, { draftBanner: true });
    // Byte signature of the PDF container — syntactic, not prose.
    expect(pdf.subarray(0, 4).equals(Buffer.from('%PDF'))).toBe(true);
    const html = eng.renderer.html(tree);
    expect(typeof html).toBe('string');
    expect(html.length).toBeGreaterThan(0);
  });

  test('the divorce interview writes the field keys the composer reads (shared vocabulary)', () => {
    // The composer's structural sections read these CaseFile.fields keys; the
    // interview definition must produce them under exactly these targets or
    // stated facts silently render as blanks (caught live in e2e/drive-v2.mjs).
    const composerReads = [
      'marriageDate', 'marriagePlace', 'separationDate', 'residencyMonths', 'grounds',
      'propertyItems', 'debtItems', 'spousalSupportRequested', 'indigencyRequested', 'otherPartyMilitary',
    ];
    const targets = new Set(engine().matters.get('divorce', 'ON')?.fields.map((f) => f.target));
    for (const key of composerReads) expect(targets.has(key)).toBe(true);
  });

  test('the matter registry resolves divorce per jurisdiction and YAML matters by code', () => {
    const eng = engine();
    const divorce = eng.matters.get('divorce', 'ON');
    expect(divorce?.code).toBe('divorce');
    expect(divorce?.phases.map((p) => p.id)).not.toContain('INDIGENCY');
    expect(eng.matters.get(simpleDefinition().code)?.code).toBe(simpleDefinition().code);
    expect(eng.matters.get('nope')).toBeNull();
  });
});
