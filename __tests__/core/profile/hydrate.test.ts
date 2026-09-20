/**
 * @jest-environment node
 *
 * hydrate(story, file, scope) — pure gap-fill of a CaseFile from the stored
 * life story. Spec: docs/spec/02-facts-and-life-story.md §2.2 and
 * docs/spec/01-conversation-and-interviews.md §7.
 *
 *   - identity always hydrates, marked 'hydrated' with the original quote kept
 *   - 'general' scope never brings in family details; 'family' does
 *   - jurisdiction / county never hydrate
 *   - the current file always wins
 *   - stored active facts seed an EMPTY fact list only; retired facts never travel
 *   - hydrate(null, file) is the identity
 */

import { ScriptedIntelligence } from '@/core/intelligence';
import { createLifeStoryService } from '@/core/profile';
import type { LifeStoryService } from '@/core/profile';
import { child, clone, fact, familyFile, field, file, retiredFact, story } from './_helpers';

let service: LifeStoryService;
let intel: ScriptedIntelligence;

beforeEach(() => {
  intel = new ScriptedIntelligence();
  service = createLifeStoryService({ intelligence: intel });
});

describe('hydrate — identity', () => {
  it('fills the self name from the story with provenance hydrated and the original quote preserved', () => {
    const stored = story({
      self: {
        firstName: field('Kathleen', 'stated', 'my name is kathleen o brien-hatch'),
        lastName: field("O'Brien-Hatch", 'stated', 'my name is kathleen o brien-hatch'),
      },
    });

    const out = service.hydrate(stored, file(), 'general');

    expect(out.parties.self.firstName?.value).toBe('Kathleen');
    expect(out.parties.self.firstName?.provenance.source).toBe('hydrated');
    expect(out.parties.self.firstName?.provenance.quote).toBe('my name is kathleen o brien-hatch');
    expect(out.parties.self.lastName?.value).toBe("O'Brien-Hatch");
    expect(out.parties.self.lastName?.provenance.source).toBe('hydrated');
  });

  it('hydrates identity in family scope too', () => {
    const stored = story({ self: { firstName: field('Kathleen', 'stated', 'kathleen') } });
    const out = service.hydrate(stored, familyFile(), 'family');
    expect(out.parties.self.firstName?.value).toBe('Kathleen');
    expect(out.parties.self.firstName?.provenance.source).toBe('hydrated');
  });

  it('never consults the model', () => {
    const stored = story({ self: { firstName: field('Kathleen') }, children: [child({ name: 'Emma Smith' })] });
    service.hydrate(stored, familyFile(), 'family');
    expect(intel.calls).toHaveLength(0);
  });

  it('does not mutate the file it was given', () => {
    const stored = story({ self: { firstName: field('Kathleen') }, facts: [fact('I live in Provo', 'residence')] });
    const input = file();
    const before = clone(input);
    service.hydrate(stored, input, 'general');
    expect(input).toEqual(before);
  });
});

describe('hydrate — scope', () => {
  const stored = () =>
    story({
      self: { firstName: field('Kathleen') },
      people: { p_mark: { firstName: field('Mark'), lastName: field('Hatch'), relationship: field('spouse') } },
      children: [child({ id: 'child_emma', name: 'Emma Smith', dateOfBirth: '2015-04-02' })],
      fields: {
        monthlyIncome: field(3400, 'stated', 'I make about 3400 a month'),
        marriageDate: field('2019-05-04', 'stated', 'we married on may 4 2019'),
        separationDate: field('2024-03-01'),
      },
    });

  it("'general' scope hydrates general fields but never children, the other party or marriage fields", () => {
    const out = service.hydrate(stored(), file({ matter: 'small_claims' }), 'general');

    expect(out.fields.monthlyIncome?.value).toBe(3400);
    expect(out.fields.monthlyIncome?.provenance.source).toBe('hydrated');
    expect(out.fields.monthlyIncome?.provenance.quote).toBe('I make about 3400 a month');

    expect(out.children).toEqual([]);
    expect(out.parties.other).toEqual({});
    expect(out.fields.marriageDate).toBeUndefined();
    expect(out.fields.separationDate).toBeUndefined();
  });

  it("'family' scope hydrates the other party, children and marriage fields", () => {
    const out = service.hydrate(stored(), familyFile(), 'family');

    expect(out.parties.other.firstName?.value).toBe('Mark');
    expect(out.parties.other.firstName?.provenance.source).toBe('hydrated');
    expect(out.parties.other.lastName?.value).toBe('Hatch');

    expect(out.children).toHaveLength(1);
    expect(out.children[0].id).toBe('child_emma');
    expect(out.children[0].name?.value).toBe('Emma Smith');
    expect(out.children[0].name?.provenance.source).toBe('hydrated');
    expect(out.children[0].dateOfBirth?.value).toBe('2015-04-02');

    expect(out.fields.marriageDate?.value).toBe('2019-05-04');
    expect(out.fields.marriageDate?.provenance.source).toBe('hydrated');
    expect(out.fields.marriageDate?.provenance.quote).toBe('we married on may 4 2019');
    expect(out.fields.separationDate?.value).toBe('2024-03-01');
    expect(out.fields.monthlyIncome?.value).toBe(3400);
  });
});

describe('hydrate — jurisdiction never hydrates', () => {
  const stored = () =>
    story({
      self: { firstName: field('Kathleen') },
      fields: {
        jurisdiction: field('UT'),
        state: field('UT'),
        county: field('Salt Lake'),
        residencyMonths: field(18),
      },
    });

  it.each(['general', 'family'] as const)('leaves jurisdiction and county absent in %s scope', (scope) => {
    const out = service.hydrate(stored(), scope === 'family' ? familyFile() : file(), scope);

    expect(out.jurisdiction).toBeUndefined();
    expect(out.county).toBeUndefined();
    expect(out.fields.jurisdiction).toBeUndefined();
    expect(out.fields.state).toBeUndefined();
    expect(out.fields.county).toBeUndefined();
    expect(out.fields.residencyMonths).toBeUndefined();
    // identity still came through, so the scope did run
    expect(out.parties.self.firstName?.value).toBe('Kathleen');
  });
});

describe('hydrate — the current file wins', () => {
  it('keeps the file value and provenance when the story disagrees', () => {
    const stored = story({
      self: { firstName: field('Kathleen', 'stated', 'kathleen') },
      fields: { monthlyIncome: field(3400) },
    });
    const current = familyFile({
      parties: { self: { firstName: field('Kate', 'stated', 'call me kate') }, other: {} },
      fields: { monthlyIncome: field(5000, 'stated', 'about 5000 now') },
    });

    const out = service.hydrate(stored, current, 'family');

    expect(out.parties.self.firstName).toEqual(field('Kate', 'stated', 'call me kate'));
    expect(out.fields.monthlyIncome).toEqual(field(5000, 'stated', 'about 5000 now'));
  });

  it('gap-fills only the parts the file lacks', () => {
    const stored = story({ self: { firstName: field('Kathleen'), lastName: field("O'Brien-Hatch") } });
    const current = file({ parties: { self: { firstName: field('Kate') }, other: {} } });

    const out = service.hydrate(stored, current, 'general');

    expect(out.parties.self.firstName?.value).toBe('Kate');
    expect(out.parties.self.lastName?.value).toBe("O'Brien-Hatch");
    expect(out.parties.self.lastName?.provenance.source).toBe('hydrated');
  });
});

describe('hydrate — facts', () => {
  it("seeds an empty file's facts with the story's active facts, status active and source unchanged", () => {
    const f1 = fact('I was married on 2019-05-04', 'relationship');
    const f2 = fact('I live in Provo, Utah', 'residence');
    const stored = story({ facts: [f1, f2] });

    const out = service.hydrate(stored, file(), 'general');

    expect(out.facts.map((f) => f.id)).toEqual([f1.id, f2.id]);
    for (const f of out.facts) {
      expect(f.status).toBe('active');
      expect(f.provenance.source).toBe('stated');
    }
    expect(out.facts[0].provenance.quote).toBe(f1.provenance.quote);
  });

  it('leaves a file that already has facts alone', () => {
    const stored = story({ facts: [fact('I was married on 2019-05-04', 'relationship')] });
    const own = fact('I moved to Utah in 2022', 'residence');
    const current = file({ facts: [own] });

    const out = service.hydrate(stored, current, 'general');

    expect(out.facts).toEqual([own]);
  });

  it('never hydrates retired stored facts', () => {
    const active = fact('We separated on 2024-03-01', 'relationship');
    const retired = retiredFact('We separated at the end of February 2024', 'relationship', active.id);
    const stored = story({ facts: [retired, active] });

    const out = service.hydrate(stored, familyFile(), 'family');

    expect(out.facts.map((f) => f.id)).toEqual([active.id]);
    expect(out.facts.every((f) => f.status === 'active')).toBe(true);
  });
});

describe('hydrate — null story', () => {
  it('returns an equivalent file when there is no story', () => {
    const current = familyFile({
      parties: { self: { firstName: field('Kate') }, other: { firstName: field('Mark') } },
      children: [child({ name: 'Emma' })],
      facts: [fact('I live in Provo', 'residence')],
      fields: { monthlyIncome: field(3400) },
      confirmations: { no_property: { source: 'confirmed', quote: 'we own nothing', at: '2026-09-01T00:00:00.000Z' } },
    });
    const before = clone(current);

    const out = service.hydrate(null, current, 'family');

    expect(out).toEqual(before);
    expect(service.hydrate(null, file(), 'general')).toEqual(file());
  });
});
