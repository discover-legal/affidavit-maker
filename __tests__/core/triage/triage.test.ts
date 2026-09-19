/** @jest-environment node */
/**
 * core/triage — spec docs/spec/01-conversation-and-interviews.md §2.
 *
 * The decision is a JUDGE.TRIAGE_CLASSIFY judgment (matter / danger / scope /
 * language) plus one ASK.TRIAGE_REPLY for the words. Code decides; the model
 * supplies judgment and language. Every assertion is structural.
 */

import { createTriage, HOTLINES } from '@/core/triage';
import type { TriageInput, TriageMatterOption } from '@/core/triage';
import { ScriptedIntelligence, UnscriptedCallError, no, pick, yes } from '@/core/intelligence/scripted';
import { THRESHOLDS } from '@/core/intelligence/types';
import type { ChoiceAnswer } from '@/core/intelligence/types';
import { ASK, JUDGE } from '@/core/intelligence/purposes';
import { asObject, lastAsk, lastJudge } from '../helpers/scripted';

const MATTERS: TriageMatterOption[] = [
  { code: 'divorce', practiceArea: 'family', description: 'Ending a marriage', keywords: ['divorce', 'separation'] },
  { code: 'custody', practiceArea: 'family', description: 'Custody and parenting time', keywords: ['custody'] },
  { code: 'dvro', practiceArea: 'family', description: 'Protection from an intimate partner or family member', keywords: ['restraining order', 'abuse'] },
  { code: 'civil_harassment', practiceArea: 'civil', description: 'Protection from a neighbour, coworker or stranger', keywords: ['harassment'] },
  { code: 'name_change', practiceArea: 'civil', description: 'Legally changing your name', keywords: ['name change'] },
];

const MATTER_CODES = MATTERS.map((m) => m.code);

function input(overrides: Partial<TriageInput> = {}): TriageInput {
  return { message: 'hello', history: [], country: 'US', language: 'en', matters: MATTERS, ...overrides };
}

/** Script the classify judgment with the four answers and one reply. */
function scriptDecision(
  intel: ScriptedIntelligence,
  answers: { matter: ChoiceAnswer; danger?: ReturnType<typeof yes>; scope?: ChoiceAnswer; language?: ChoiceAnswer },
  reply: { say: string; clarifying_question: string | null } = { say: 'REPLY', clarifying_question: null },
): void {
  intel
    .onJudge(`${JUDGE.TRIAGE_CLASSIFY}:matter`, answers.matter)
    .onJudge(`${JUDGE.TRIAGE_CLASSIFY}:danger`, answers.danger ?? no())
    .onJudge(`${JUDGE.TRIAGE_CLASSIFY}:scope`, answers.scope ?? pick('in_scope'))
    .onJudge(`${JUDGE.TRIAGE_CLASSIFY}:language`, answers.language ?? pick('en'))
    .onAsk(ASK.TRIAGE_REPLY, reply);
}

describe('core/triage — classify', () => {
  let intel: ScriptedIntelligence;
  beforeEach(() => {
    intel = new ScriptedIntelligence();
  });

  test('(a) a clear divorce description in Canada is classified as divorce with the scripted reply', async () => {
    scriptDecision(intel, { matter: pick('divorce', 0.95) }, { say: 'DIVORCE_REPLY', clarifying_question: null });
    const triage = createTriage({ intelligence: intel });

    const result = await triage.classify(input({ message: 'we want to split up, house in Calgary', country: 'CA' }));

    expect(result.outcome).toEqual({ kind: 'classified', matter: 'divorce', confidence: 0.95, reply: 'DIVORCE_REPLY' });
    expect(result.safety).toBeUndefined();
    expect(intel.callsTo(JUDGE.TRIAGE_CLASSIFY)).toHaveLength(1);
    expect(intel.callsTo(ASK.TRIAGE_REPLY)).toHaveLength(1);
    // The judgment comes first; the reply is written once the decision is made in code.
    expect(intel.calls.map((c) => c.purpose)).toEqual([JUDGE.TRIAGE_CLASSIFY, ASK.TRIAGE_REPLY]);
  });

  test('(b) an ambiguous restraining-order message yields a clarify outcome with the two likeliest matters', async () => {
    scriptDecision(
      intel,
      {
        matter: {
          choice: 'unclear',
          confidence: 0.4,
          probabilities: { unclear: 0.4, dvro: 0.3, civil_harassment: 0.25, divorce: 0.03, custody: 0.01, name_change: 0.01, out_of_scope: 0 },
        },
      },
      { say: 'CLARIFY_REPLY', clarifying_question: 'Is the person an intimate partner or a co-parent?' },
    );
    const triage = createTriage({ intelligence: intel });

    const result = await triage.classify(input({ message: 'I need a restraining order against my neighbour' }));

    expect(result.outcome.kind).toBe('clarify');
    if (result.outcome.kind !== 'clarify') return;
    expect(result.outcome.candidates).toEqual(['dvro', 'civil_harassment']);
    expect(result.outcome.reply).toBe('CLARIFY_REPLY');
    expect(intel.callsTo(ASK.TRIAGE_REPLY)).toHaveLength(1);
  });

  test('(b) a matter below THRESHOLDS.triage is not locked; the runner-up joins the candidates', async () => {
    const belowThreshold = THRESHOLDS.triage - 0.2;
    scriptDecision(intel, { matter: pick('dvro', belowThreshold, ['civil_harassment']) });
    const triage = createTriage({ intelligence: intel });

    const result = await triage.classify(input({ message: 'someone keeps threatening me' }));

    expect(result.outcome.kind).toBe('clarify');
    if (result.outcome.kind !== 'clarify') return;
    expect(result.outcome.candidates).toEqual(['dvro', 'civil_harassment']);
  });

  test('(c) danger puts the country hotline in the result and still classifies the matter', async () => {
    scriptDecision(intel, { matter: pick('dvro', 0.95), danger: yes() }, { say: 'SAFETY_REPLY', clarifying_question: null });
    const triage = createTriage({ intelligence: intel });

    const result = await triage.classify(input({ message: 'my husband hits me and I need him out', country: 'US' }));

    expect(result.safety).toEqual({ hotline: HOTLINES.US, country: 'US' });
    expect(result.outcome).toEqual({ kind: 'classified', matter: 'dvro', confidence: 0.95, reply: 'SAFETY_REPLY' });
  });

  test('(c) the Canadian hotline is used for a Canadian conversation', async () => {
    scriptDecision(intel, { matter: pick('dvro', 0.95), danger: yes() });
    const triage = createTriage({ intelligence: intel });

    const result = await triage.classify(input({ message: 'he threatened me again last night', country: 'CA' }));

    expect(result.safety).toEqual({ hotline: HOTLINES.CA, country: 'CA' });
  });

  test('(d) a criminal matter is out of scope with reason criminal', async () => {
    scriptDecision(intel, { matter: pick('out_of_scope', 0.9), scope: pick('criminal', 0.95) }, { say: 'OUT_OF_SCOPE_REPLY', clarifying_question: null });
    const triage = createTriage({ intelligence: intel });

    const result = await triage.classify(input({ message: 'I got a DUI last weekend' }));

    expect(result.outcome).toEqual({ kind: 'out_of_scope', reason: 'criminal', reply: 'OUT_OF_SCOPE_REPLY' });
    expect(result.safety).toBeUndefined();
  });

  test('(d) every out-of-scope label is passed through as the reason', async () => {
    for (const reason of ['immigration', 'bankruptcy', 'criminal_protective_order', 'other'] as const) {
      const local = new ScriptedIntelligence();
      scriptDecision(local, { matter: pick('out_of_scope', 0.9), scope: pick(reason, 0.95) });
      const result = await createTriage({ intelligence: local }).classify(input({ message: 'help' }));
      expect(result.outcome.kind).toBe('out_of_scope');
      if (result.outcome.kind === 'out_of_scope') expect(result.outcome.reason).toBe(reason);
    }
  });

  test('(e) the matter question offers exactly the supplied matter codes plus unclear and out_of_scope', async () => {
    scriptDecision(intel, { matter: pick('divorce', 0.95) });
    await createTriage({ intelligence: intel }).classify(input({ message: 'I want a divorce' }));

    const judge = lastJudge(intel, JUDGE.TRIAGE_CLASSIFY);
    const matterQuestion = judge.questions.matter;
    expect(matterQuestion.type).toBe('choice');
    expect(Object.keys(matterQuestion.options ?? {}).sort()).toEqual([...MATTER_CODES, 'unclear', 'out_of_scope'].sort());
    for (const m of MATTERS) expect(matterQuestion.options?.[m.code]).toBe(m.description);

    expect(judge.questions.danger.type).toBe('yesno');
    expect(judge.questions.scope.type).toBe('choice');
    expect(Object.keys(judge.questions.scope.options ?? {}).sort()).toEqual(
      ['in_scope', 'criminal', 'immigration', 'bankruptcy', 'criminal_protective_order', 'other'].sort(),
    );
    expect(judge.questions.language.type).toBe('choice');
    expect(Object.keys(judge.questions.language.options ?? {}).sort()).toEqual(['en', 'es']);
  });

  test('(f) the message, country and matter list reach the judgment as state, not as instructions', async () => {
    const message = 'my landlord will not return my deposit';
    const history = [
      { role: 'assistant' as const, content: 'Welcome. What brings you here today?' },
      { role: 'user' as const, content: 'housing trouble' },
    ];
    scriptDecision(intel, { matter: pick('civil_harassment', 0.9) });
    await createTriage({ intelligence: intel }).classify(input({ message, history, country: 'CA' }));

    const state = asObject(lastJudge(intel, JUDGE.TRIAGE_CLASSIFY).state);
    expect(state.message).toBe(message);
    expect(state.country).toBe('CA');
    const matters = state.matters as Array<{ code: string; description: string; keywords: string[] }>;
    expect(matters.map((m) => m.code)).toEqual(MATTER_CODES);
    expect(matters[0]).toMatchObject({ code: 'divorce', description: 'Ending a marriage', keywords: ['divorce', 'separation'] });

    // The reply is asked with the message as structured input and the history as history.
    const ask = lastAsk(intel, ASK.TRIAGE_REPLY);
    expect(asObject(ask.input).message).toBe(message);
    expect(ask.history).toEqual(history);
    expect(typeof ask.instructions).toBe('string');
  });

  test('the reply is asked in the judged language', async () => {
    scriptDecision(intel, { matter: pick('divorce', 0.95), language: pick('es') });
    const result = await createTriage({ intelligence: intel }).classify(input({ message: 'quiero divorciarme de mi esposo', language: 'en' }));

    expect(lastAsk(intel, ASK.TRIAGE_REPLY).language).toBe('es');
    expect(result.outcome.kind).toBe('classified');
  });

  test('an unscripted judgment throws instead of silently classifying', async () => {
    const triage = createTriage({ intelligence: intel });
    await expect(triage.classify(input({ message: 'I want a divorce' }))).rejects.toThrow(UnscriptedCallError);
  });
});
