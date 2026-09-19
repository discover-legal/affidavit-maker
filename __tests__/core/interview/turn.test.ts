/** @jest-environment node */
/**
 * core/interview — turn mechanics (spec §3 and §4).
 *
 * One engine for every matter definition. The model proposes a TurnProposal;
 * the engine binds fields, records facts with provenance, enforces the
 * one-question rule, mirrors language, and advances phases only in code.
 */

import { createInterviewEngine } from '@/core/interview';
import type { InterviewEngine } from '@/core/interview/types';
import { ScriptedIntelligence, UnscriptedCallError, no, pick, yes } from '@/core/intelligence/scripted';
import type { JsonObject } from '@/core/intelligence/types';
import { ASK, JUDGE } from '@/core/intelligence/purposes';
import type { CaseFile } from '@/core/model/types';
import {
  asObject,
  fileFor,
  jurisdictionStub,
  lastAsk,
  lastJudge,
  matterStub,
  proposal,
  registryStub,
  runInterview,
  simpleDefinition,
  stated,
} from '../helpers/scripted';

const DEF = simpleDefinition();

function harness(): { engine: InterviewEngine; intel: ScriptedIntelligence } {
  const intel = new ScriptedIntelligence();
  const engine = createInterviewEngine({
    intelligence: intel,
    matters: matterStub(DEF),
    jurisdictions: registryStub([jurisdictionStub('TX')]),
  });
  return { engine, intel };
}

function newFile(overrides: Partial<CaseFile> = {}): CaseFile {
  return fileFor({ matter: DEF.code, jurisdiction: 'TX', country: 'US', ...overrides });
}

/** A file whose INTAKE requirements are already satisfied. */
function namedFile(overrides: Partial<CaseFile> = {}): CaseFile {
  return newFile({
    parties: {
      self: { firstName: { value: 'Maria', provenance: stated('Maria Lopez') }, lastName: { value: 'Lopez', provenance: stated('Maria Lopez') } },
      other: {},
    },
    county: { value: 'Travis', provenance: stated('Travis County') },
    ...overrides,
  });
}

describe('core/interview — turn', () => {
  test('name-first gate: a phase never completes while the user’s own name is missing', async () => {
    const h = harness();
    const [t1] = await runInterview(h, newFile(), [
      { user: 'I want custody of my kids, Travis County', model: proposal({ phase_complete: true, fields: { county: 'Travis' } }) },
    ]);

    expect(t1.result.phaseAdvanced).toBe(false);
    expect(t1.file.interview.phase).toBe('INTAKE');
    expect(t1.file.interview.completed).toEqual([]);
    // What was stated is still kept.
    expect(t1.file.county?.value).toBe('Travis');
    expect(t1.file.parties.self.firstName).toBeUndefined();
  });

  test('fields bind to typed slots with stated provenance quoting the user’s message', async () => {
    const h = harness();
    const message = 'My name is Maria Lopez and I live in Travis County';
    const [t1] = await runInterview(h, newFile(), [
      {
        user: message,
        model: proposal({ fields: { petitioner_first_name: 'Maria', petitioner_last_name: 'Lopez', county: 'Travis', has_children: true } }),
      },
    ]);

    const { self } = t1.file.parties;
    expect(self.firstName?.value).toBe('Maria');
    expect(self.firstName?.provenance.source).toBe('stated');
    expect(self.firstName?.provenance.quote).toBe(message);
    expect(self.lastName?.value).toBe('Lopez');
    expect(self.lastName?.provenance.quote).toBe(message);
    expect(t1.file.county?.value).toBe('Travis');
    expect(t1.file.county?.provenance.source).toBe('stated');
    expect(t1.file.county?.provenance.quote).toBe(message);
    // Unbound fields land on `fields` under the camelCase target.
    expect(t1.file.fields.hasChildren?.value).toBe(true);
    expect(t1.file.fields.hasChildren?.provenance.source).toBe('stated');
    expect(t1.file.fields.hasChildren?.provenance.quote).toBe(message);
  });

  test('facts get an id, active status and stated provenance with the quote', async () => {
    const h = harness();
    const message = 'I have lived in Travis County since 2019';
    const [t1] = await runInterview(h, namedFile(), [
      {
        user: message,
        model: proposal({ facts: [{ statement: 'I have lived in Travis County since 2019.', category: 'residence', quote: message }] }),
      },
    ]);

    expect(t1.result.newFacts).toHaveLength(1);
    const fact = t1.result.newFacts[0];
    expect(typeof fact.id).toBe('string');
    expect(fact.id.length).toBeGreaterThan(0);
    expect(fact.status).toBe('active');
    expect(fact.category).toBe('residence');
    expect(fact.statement).toBe('I have lived in Travis County since 2019.');
    expect(fact.provenance.source).toBe('stated');
    expect(fact.provenance.quote).toBe(message);
    expect(t1.file.facts.map((f) => f.id)).toEqual([fact.id]);
  });

  test('exactly one question: a two-question reply is reformulated once', async () => {
    const h = harness();
    const [t1] = await runInterview(h, namedFile(), [
      {
        user: 'ok',
        model: proposal({ say: 'TWO_QUESTIONS', questions_asked: ['What county?', 'Do you have children?'] }),
        asks: { [ASK.INTERVIEW_REFORMULATE]: { say: 'ONE_QUESTION', questions_asked: ['What county?'] } },
      },
    ]);

    expect(h.intel.callsTo(ASK.INTERVIEW_REFORMULATE)).toHaveLength(1);
    expect(t1.result.asked).toEqual(['What county?']);
    expect(t1.result.reply).toBe('ONE_QUESTION');
    const reformulate = lastAsk(h.intel, ASK.INTERVIEW_REFORMULATE);
    expect(asObject(reformulate.input).say).toBe('TWO_QUESTIONS');
    expect(asObject(reformulate.input).questions_asked).toEqual(['What county?', 'Do you have children?']);
  });

  test('exactly one question: a reply with no question is reformulated too', async () => {
    const h = harness();
    const [t1] = await runInterview(h, namedFile(), [
      {
        user: 'ok',
        model: proposal({ say: 'NO_QUESTION', questions_asked: [] }),
        asks: { [ASK.INTERVIEW_REFORMULATE]: { say: 'ONE_QUESTION', questions_asked: ['Do you have children?'] } },
      },
    ]);

    expect(h.intel.callsTo(ASK.INTERVIEW_REFORMULATE)).toHaveLength(1);
    expect(t1.result.asked).toEqual(['Do you have children?']);
  });

  test('exactly one question: a well-formed reply is not reformulated', async () => {
    const h = harness();
    const [t1] = await runInterview(h, namedFile(), [{ user: 'ok', model: proposal({ say: 'FINE', questions_asked: ['Do you have children?'] }) }]);

    expect(h.intel.callsTo(ASK.INTERVIEW_REFORMULATE)).toHaveLength(0);
    expect(t1.result.reply).toBe('FINE');
    expect(t1.result.asked).toEqual(['Do you have children?']);
  });

  test('language: a Spanish message switches the file language and the turn is asked in it', async () => {
    const h = harness();
    const message = 'Quiero la custodia de mis hijos, vivo en el condado de Travis';
    const [t1] = await runInterview(h, newFile(), [{ user: message, model: proposal(), judgments: { language: pick('es') } }]);

    expect(t1.file.language).toBe('es');
    expect(t1.result.language).toBe('es');
    expect(lastAsk(h.intel, ASK.INTERVIEW_TURN).language).toBe('es');
    expect(asObject(lastJudge(h.intel, JUDGE.INTERVIEW_LANGUAGE).state).message).toBe(message);
  });

  test('reply-language check: a reply judged not in the case language is reformulated once', async () => {
    const h = harness();
    const [t1] = await runInterview(h, namedFile(), [
      {
        user: 'ok',
        model: proposal({ say: 'WRONG_LANGUAGE', questions_asked: ['Q'] }),
        judgments: { in_language: [no(), yes()] },
        asks: { [ASK.INTERVIEW_REFORMULATE]: { say: 'RIGHT_LANGUAGE', questions_asked: ['Q'] } },
      },
    ]);

    expect(h.intel.callsTo(ASK.INTERVIEW_REFORMULATE)).toHaveLength(1);
    expect(lastAsk(h.intel, ASK.INTERVIEW_REFORMULATE).language).toBe('en');
    expect(t1.result.reply).toBe('RIGHT_LANGUAGE');
    const judged = asObject(lastJudge(h.intel, JUDGE.INTERVIEW_REPLY_LANGUAGE).state);
    expect(judged.language).toBe('en');
    expect(typeof judged.say).toBe('string');
  });

  test('phase advance: INTAKE completes into DETAILS when hasChildren is true', async () => {
    const h = harness();
    const [t1] = await runInterview(h, namedFile(), [{ user: 'yes, two kids', model: proposal({ phase_complete: true, fields: { has_children: true } }) }]);

    expect(t1.result.phaseAdvanced).toBe(true);
    expect(t1.file.interview.completed).toEqual(['INTAKE']);
    expect(t1.file.interview.phase).toBe('DETAILS');
  });

  test('phase advance: INTAKE completes straight into REVIEW when the conditional phase is skipped', async () => {
    const h = harness();
    const [t1] = await runInterview(h, namedFile(), [{ user: 'no kids', model: proposal({ phase_complete: true, fields: { has_children: false } }) }]);

    expect(t1.result.phaseAdvanced).toBe(true);
    expect(t1.file.interview.completed).toEqual(['INTAKE']);
    expect(t1.file.interview.phase).toBe('REVIEW');
  });

  test('phase advance: phase_complete is ignored while a required field is missing', async () => {
    const h = harness();
    const file = namedFile({ county: undefined });
    const [t1] = await runInterview(h, file, [{ user: 'no kids', model: proposal({ phase_complete: true, fields: { has_children: false } }) }]);

    expect(t1.result.phaseAdvanced).toBe(false);
    expect(t1.file.interview.phase).toBe('INTAKE');
    expect(t1.file.interview.completed).toEqual([]);
  });

  test('nextPhase() is pure and honours skipUnlessAny', () => {
    const { engine } = harness();
    const done = (file: CaseFile) => ({ ...file, interview: { ...file.interview, phase: 'INTAKE', completed: ['INTAKE'] } });

    const withChildren = done(namedFile({ fields: { hasChildren: { value: true, provenance: stated('two kids') } } }));
    expect(engine.nextPhase(withChildren, DEF)).toBe('DETAILS');

    const withoutChildren = done(namedFile());
    expect(engine.nextPhase(withoutChildren, DEF)).toBe('REVIEW');

    const allDone = namedFile({ interview: { phase: 'REVIEW', completed: ['INTAKE', 'REVIEW'], turns: 3, triaged: true } });
    expect(engine.nextPhase(allDone, DEF)).toBeNull();

    // Pure: the inputs are untouched.
    expect(withChildren.interview.phase).toBe('INTAKE');
    expect(allDone.interview.completed).toEqual(['INTAKE', 'REVIEW']);
  });

  test('isComplete() requires every unskipped phase done and the review confirmed', () => {
    const { engine } = harness();
    const reviewed = namedFile({
      interview: { phase: 'REVIEW', completed: ['INTAKE', 'REVIEW'], turns: 3, triaged: true },
      confirmations: { review_confirmed: { source: 'confirmed', quote: 'yes, everything is correct', at: '2026-01-01T00:00:00.000Z' } },
    });
    expect(engine.isComplete(reviewed, DEF)).toBe(true);

    const notConfirmed = namedFile({ interview: { phase: 'REVIEW', completed: ['INTAKE', 'REVIEW'], turns: 3, triaged: true } });
    expect(engine.isComplete(notConfirmed, DEF)).toBe(false);

    const stillInReview = namedFile({
      interview: { phase: 'REVIEW', completed: ['INTAKE'], turns: 2, triaged: true },
      confirmations: { review_confirmed: { source: 'confirmed', quote: 'yes', at: '2026-01-01T00:00:00.000Z' } },
    });
    expect(engine.isComplete(stillInReview, DEF)).toBe(false);
  });

  test('the turns counter increments once per turn', async () => {
    const h = harness();
    const [t1, t2] = await runInterview(h, namedFile(), [
      { user: 'first', model: proposal() },
      { user: 'second', model: proposal() },
    ]);
    expect(t1.file.interview.turns).toBe(1);
    expect(t2.file.interview.turns).toBe(2);
  });

  test('the ask carries the history, the message as input, and a schema requiring the proposal keys', async () => {
    const h = harness();
    const message = 'I have two kids';
    await runInterview(h, namedFile(), [
      { user: 'hello', model: proposal({ say: 'R1', questions_asked: ['Q1'] }) },
      { user: message, model: proposal({ say: 'R2', questions_asked: ['Q2'] }) },
    ]);

    const asks = h.intel.callsTo(ASK.INTERVIEW_TURN);
    expect(asks).toHaveLength(2);
    const second = asks[1];
    if (second.kind !== 'ask') throw new Error('expected an ask');
    expect(second.request.history).toEqual([
      { role: 'user', content: 'hello' },
      { role: 'assistant', content: 'R1' },
    ]);
    expect(asObject(second.request.input).message).toBe(message);
    expect(second.request.language).toBe('en');

    const schema = second.request.schema as { required?: string[]; properties?: Record<string, JsonObject> };
    expect(schema.required).toEqual(expect.arrayContaining(['say', 'questions_asked', 'phase_complete', 'fields', 'facts', 'corrections', 'affirmations', 'children']));
    const fieldProps = (schema.properties?.fields as { properties?: Record<string, unknown> } | undefined)?.properties ?? {};
    expect(Object.keys(fieldProps).sort()).toEqual(DEF.fields.map((f) => f.key).sort());
  });

  test('an unscripted model call throws instead of being answered', async () => {
    const { engine } = harness();
    await expect(engine.turn({ file: namedFile(), history: [], message: 'hello' })).rejects.toThrow(UnscriptedCallError);
  });
});
