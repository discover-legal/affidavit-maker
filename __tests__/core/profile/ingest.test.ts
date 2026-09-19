/**
 * @jest-environment node
 *
 * ingest(story, { text, documentId }) — read a court paper's text into
 * dated events, third-person facts and caption fields, all marked as coming
 * from that document. Spec: docs/spec/02-facts-and-life-story.md §2.7.
 *
 *   - judge JUDGE.PROFILE_INGEST_KIND (kind) first, then ask ASK.PROFILE_INGEST
 *   - every event / fact / field carries provenance.source 'ingested' + documentId
 *   - text shorter than 40 chars is rejected before any model call
 *   - ≤ 25 facts and ≤ 40 events; undated events are never added
 *   - served_on_user lands as a field; flipping the role is the caller's call
 */

import { ASK, JUDGE, ScriptedIntelligence, UnscriptedCallError, pick } from '@/core/intelligence';
import { createLifeStoryService } from '@/core/profile';
import type { LifeStoryService } from '@/core/profile';
import { askCalls, at, judgeCalls, schemaRequired, story } from './_helpers';

let service: LifeStoryService;
let intel: ScriptedIntelligence;

beforeEach(() => {
  intel = new ScriptedIntelligence();
  service = createLifeStoryService({ intelligence: intel });
});

const DOCUMENT_ID = 'doc_served_papers';
const TEXT = [
  'IN THE DISTRICT COURT OF UTAH COUNTY, STATE OF UTAH',
  'Dana Bell, Petitioner, v. Marcus Bell, Respondent. Case No. FS-26-01234',
  'Filed: 2025-06-17. Answer due: 2025-07-17. Served on Marcus Bell 2025-06-20.',
].join('\n');

const ANSWER = {
  events: [
    { date: '2025-06-17', title: 'Petition filed', detail: 'Petition for divorce filed by Dana Bell' },
    { date: '2025-07-17', title: 'Answer due' },
  ],
  facts: [
    { statement: 'Dana Bell filed a petition for divorce against Marcus Bell on 2025-06-17', category: 'procedure', subcategory: 'filing' },
    { statement: 'The petition alleges the marriage is irretrievably broken', category: 'relationship', subcategory: 'grounds' },
  ],
  fields: {
    case_number: 'FS-26-01234',
    petitioner_name: 'Dana Bell',
    respondent_name: 'Marcus Bell',
    court: 'District Court of Utah County',
    served_on_user: 'yes',
  },
};

function scriptHappyPath() {
  intel.onJudge('kind', () => pick('petition'));
  intel.onAsk(ASK.PROFILE_INGEST, ANSWER);
}

describe('ingest — the calls', () => {
  it('judges the paper kind first, then asks for the extraction with the text as structured input', async () => {
    scriptHappyPath();

    await service.ingest(story(), { text: TEXT, documentId: DOCUMENT_ID });

    expect(intel.calls.map((c) => c.purpose)).toEqual([JUDGE.PROFILE_INGEST_KIND, ASK.PROFILE_INGEST]);

    const [judged] = judgeCalls(intel, JUDGE.PROFILE_INGEST_KIND);
    expect(Object.keys(judged.request.state as object).sort()).toEqual(['kind_options', 'text']);
    expect(at(judged.request.state, 'text')).toBe(TEXT);
    expect(Object.keys(judged.request.questions)).toEqual(['kind']);
    expect(judged.request.questions.kind.type).toBe('choice');
    const options = (judged.request.questions.kind as { options: Record<string, unknown> }).options;
    expect(Object.keys(options).sort()).toEqual(['notice', 'order', 'petition', 'response', 'unknown']);

    const [asked] = askCalls(intel, ASK.PROFILE_INGEST);
    expect(at(asked.request.input, 'text')).toBe(TEXT);
    expect(schemaRequired(asked.request.schema)).toEqual(expect.arrayContaining(['events', 'facts', 'fields']));
  });

  it('rejects with UnscriptedCallError when the kind judgment was not scripted', async () => {
    await expect(service.ingest(story(), { text: TEXT, documentId: DOCUMENT_ID })).rejects.toBeInstanceOf(UnscriptedCallError);
    expect(askCalls(intel, ASK.PROFILE_INGEST)).toHaveLength(0);
  });
});

describe('ingest — the result', () => {
  it("takes the kind from the judgment", async () => {
    scriptHappyPath();
    const out = await service.ingest(story(), { text: TEXT, documentId: DOCUMENT_ID });
    expect(out.kind).toBe('petition');
  });

  it('returns dated events with ids and document provenance', async () => {
    scriptHappyPath();

    const out = await service.ingest(story(), { text: TEXT, documentId: DOCUMENT_ID });

    expect(out.events).toHaveLength(2);
    expect(out.events.map((e) => e.date)).toEqual(['2025-06-17', '2025-07-17']);
    expect(out.events.map((e) => e.title)).toEqual(['Petition filed', 'Answer due']);
    expect(out.events[0].detail).toBe('Petition for divorce filed by Dana Bell');
    const ids = out.events.map((e) => e.id);
    expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    for (const e of out.events) {
      expect(e.provenance.source).toBe('ingested');
      expect(e.provenance.documentId).toBe(DOCUMENT_ID);
      expect(typeof e.provenance.at).toBe('string');
    }
  });

  it('returns active facts marked ingested from that document', async () => {
    scriptHappyPath();

    const out = await service.ingest(story(), { text: TEXT, documentId: DOCUMENT_ID });

    expect(out.facts).toHaveLength(2);
    expect(out.facts.map((f) => f.statement)).toEqual(ANSWER.facts.map((f) => f.statement));
    expect(out.facts.map((f) => f.category)).toEqual(['procedure', 'relationship']);
    expect(out.facts[1].subcategory).toBe('grounds');
    const ids = out.facts.map((f) => f.id);
    expect(ids.every((id) => typeof id === 'string' && id.length > 0)).toBe(true);
    expect(new Set(ids).size).toBe(ids.length);
    for (const f of out.facts) {
      expect(f.status).toBe('active');
      expect(f.provenance.source).toBe('ingested');
      expect(f.provenance.documentId).toBe(DOCUMENT_ID);
    }
  });

  it('returns caption fields with ingested provenance, including served_on_user as a field (role is the caller\'s decision)', async () => {
    scriptHappyPath();

    const out = await service.ingest(story(), { text: TEXT, documentId: DOCUMENT_ID });

    expect(out.fields.servedOnUser?.value).toBe('yes');
    expect(out.fields.caseNumber?.value).toBe('FS-26-01234');
    expect(out.fields.petitionerName?.value).toBe('Dana Bell');
    expect(out.fields.respondentName?.value).toBe('Marcus Bell');
    expect(out.fields.court?.value).toBe('District Court of Utah County');
    expect(Object.keys(out.fields).length).toBeGreaterThanOrEqual(5);
    for (const f of Object.values(out.fields)) {
      expect(f.provenance.source).toBe('ingested');
      expect(f.provenance.documentId).toBe(DOCUMENT_ID);
    }
    expect(out.fields.role).toBeUndefined();
  });

  it('drops an undated event (spec §2.7: undated items are never added)', async () => {
    intel.onJudge('kind', () => pick('notice'));
    intel.onAsk(ASK.PROFILE_INGEST, {
      ...ANSWER,
      events: [{ title: 'Hearing scheduled' }, { date: '2025-08-01', title: 'Hearing' }],
    });

    const out = await service.ingest(story(), { text: TEXT, documentId: DOCUMENT_ID });

    expect(out.kind).toBe('notice');
    expect(out.events.map((e) => e.title)).toEqual(['Hearing']);
  });
});

describe('ingest — limits', () => {
  it('rejects text shorter than 40 characters before calling the model', async () => {
    scriptHappyPath();
    const short = 'Case No. FS-26-01234';
    expect(short.length).toBeLessThan(40);

    await expect(service.ingest(story(), { text: short, documentId: DOCUMENT_ID })).rejects.toBeInstanceOf(Error);
    expect(intel.calls).toHaveLength(0);
  });

  it('truncates more than 25 facts to 25', async () => {
    intel.onJudge('kind', () => pick('petition'));
    intel.onAsk(ASK.PROFILE_INGEST, {
      ...ANSWER,
      facts: Array.from({ length: 30 }, (_, i) => ({ statement: `The petition states item ${i}`, category: 'procedure' })),
    });

    const out = await service.ingest(story(), { text: TEXT, documentId: DOCUMENT_ID });

    expect(out.facts).toHaveLength(25);
    expect(out.facts.map((f) => f.statement)).toEqual(Array.from({ length: 25 }, (_, i) => `The petition states item ${i}`));
  });

  it('truncates more than 40 events to 40', async () => {
    intel.onJudge('kind', () => pick('order'));
    intel.onAsk(ASK.PROFILE_INGEST, {
      ...ANSWER,
      events: Array.from({ length: 45 }, (_, i) => ({ date: `2025-01-${String(i + 1).padStart(2, '0')}`, title: `Event ${i}` })),
    });

    const out = await service.ingest(story(), { text: TEXT, documentId: DOCUMENT_ID });

    expect(out.events).toHaveLength(40);
    expect(out.events.map((e) => e.title)).toEqual(Array.from({ length: 40 }, (_, i) => `Event ${i}`));
  });

  it('works with no stored story', async () => {
    scriptHappyPath();
    const out = await service.ingest(null, { text: TEXT, documentId: DOCUMENT_ID });
    expect(out.kind).toBe('petition');
    expect(out.facts).toHaveLength(2);
  });
});
