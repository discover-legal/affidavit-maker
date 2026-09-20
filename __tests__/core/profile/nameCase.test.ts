/**
 * @jest-environment node
 *
 * normalizeName(party) — legal casing of a name exactly as the user typed it.
 * Casing belongs to the model, never a deterministic transform.
 * Spec: docs/spec/02-facts-and-life-story.md §2.6 ("Name casing").
 *
 * CONTRACT NOTE for the implementer: `LifeStoryService` in core/profile/types.ts
 * does not (yet) declare this method. The implementation must export it on the
 * service object returned by createLifeStoryService():
 *
 *   normalizeName(party: Party): Promise<Party>
 *
 * It asks ASK.PROFILE_NAME_CASE once with the as-typed parts as input
 * ({ first_name?, last_name?, middle_name? }) and applies the answer's casing
 * to `value` only, keeping every provenance intact. Any failure (throw,
 * count mismatch, a change that is more than casing) returns the party as typed.
 */

import { ASK, ScriptedIntelligence } from '@/core/intelligence';
import { createLifeStoryService } from '@/core/profile';
import type { LifeStoryService } from '@/core/profile';
import type { Party } from '@/core/model';
import { askCalls, at, clone, field } from './_helpers';

type WithNormalizeName = LifeStoryService & { normalizeName(party: Party): Promise<Party> };

let service: WithNormalizeName;
let intel: ScriptedIntelligence;

beforeEach(() => {
  intel = new ScriptedIntelligence();
  service = createLifeStoryService({ intelligence: intel }) as WithNormalizeName;
});

const typed = (): Party => ({
  firstName: field('mike', 'stated', 'mike smith'),
  lastName: field('smith', 'stated', 'mike smith'),
});

describe('normalizeName', () => {
  it('asks ASK.PROFILE_NAME_CASE once with the as-typed parts as input', async () => {
    intel.onAsk(ASK.PROFILE_NAME_CASE, { first_name: 'Mike', last_name: 'Smith' });

    await service.normalizeName(typed());

    const calls = askCalls(intel, ASK.PROFILE_NAME_CASE);
    expect(calls).toHaveLength(1);
    expect(intel.calls).toHaveLength(1);
    expect(at(calls[0].request.input, 'first_name')).toBe('mike');
    expect(at(calls[0].request.input, 'last_name')).toBe('smith');
    expect(at(calls[0].request.input, 'middle_name')).toBeUndefined();
  });

  it('applies the scripted casing to value only, keeping provenance', async () => {
    intel.onAsk(ASK.PROFILE_NAME_CASE, { first_name: 'Mike', last_name: 'Smith' });
    const input = typed();

    const out = await service.normalizeName(input);

    expect(out.firstName?.value).toBe('Mike');
    expect(out.lastName?.value).toBe('Smith');
    expect(out.firstName?.provenance).toEqual(input.firstName?.provenance);
    expect(out.lastName?.provenance).toEqual(input.lastName?.provenance);
  });

  it('keeps internal capitals and compound surnames the model returns', async () => {
    intel.onAsk(ASK.PROFILE_NAME_CASE, { first_name: 'Ellis', middle_name: 'Jane', last_name: 'Smith Son-Wyatt' });
    const input: Party = {
      firstName: field('ellis'),
      middleName: field('jane'),
      lastName: field('smith son-wyatt'),
    };

    const out = await service.normalizeName(input);

    expect(out.firstName?.value).toBe('Ellis');
    expect(out.middleName?.value).toBe('Jane');
    expect(out.lastName?.value).toBe('Smith Son-Wyatt');
    expect(out.middleName?.provenance).toEqual(input.middleName?.provenance);
  });

  it('is fail-open: a throwing ask returns the party unchanged', async () => {
    intel.onAsk(ASK.PROFILE_NAME_CASE, () => {
      throw new Error('model unavailable');
    });
    const input = typed();
    const before = clone(input);

    await expect(service.normalizeName(input)).resolves.toEqual(before);
  });

  it('stores as typed when the answer returns fewer parts than were given (count-in/count-out)', async () => {
    intel.onAsk(ASK.PROFILE_NAME_CASE, { first_name: 'Mike' });
    const input = typed();
    const before = clone(input);

    const out = await service.normalizeName(input);

    expect(out).toEqual(before);
  });

  it('keeps the typed value when the answer changed more than casing', async () => {
    intel.onAsk(ASK.PROFILE_NAME_CASE, { first_name: 'Michael', last_name: 'Smith' });
    const input = typed();

    const out = await service.normalizeName(input);

    expect(out.firstName?.value).toBe('mike');
    expect(out.firstName?.provenance).toEqual(input.firstName?.provenance);
  });

  it('does not ask when the party has no name parts', async () => {
    const out = await service.normalizeName({ address: field('12 Elm St') });
    expect(intel.calls).toHaveLength(0);
    expect(out).toEqual({ address: field('12 Elm St') });
  });
});
