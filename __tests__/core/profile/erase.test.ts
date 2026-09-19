/**
 * @jest-environment node
 *
 * erase(userId) — privacy erase. Returns the empty story the caller persists.
 * Spec: docs/spec/02-facts-and-life-story.md §2.8.
 */

import { ScriptedIntelligence } from '@/core/intelligence';
import { emptyCaseFile } from '@/core/model';
import { createLifeStoryService } from '@/core/profile';
import type { LifeStoryService } from '@/core/profile';

let service: LifeStoryService;
let intel: ScriptedIntelligence;

beforeEach(() => {
  intel = new ScriptedIntelligence();
  service = createLifeStoryService({ intelligence: intel });
});

describe('erase', () => {
  it('returns an empty life story for that user', () => {
    const out = service.erase('user_42');

    expect(out.userId).toBe('user_42');
    expect(out.self).toEqual({});
    expect(out.people).toEqual({});
    expect(out.children).toEqual([]);
    expect(out.facts).toEqual([]);
    expect(out.events).toEqual([]);
    expect(out.fields).toEqual({});
    expect(out.confirmations).toEqual({});
    expect(typeof out.updatedAt).toBe('string');
    expect(Number.isNaN(new Date(out.updatedAt).getTime())).toBe(false);
  });

  it('never consults the model', () => {
    service.erase('user_42');
    expect(intel.calls).toHaveLength(0);
  });

  it('hydrating from an erased story is the identity', () => {
    const erased = service.erase('user_42');
    const file = emptyCaseFile({ id: 'file_1', userId: 'user_42', matter: 'divorce' });

    expect(service.hydrate(erased, file, 'family')).toEqual(file);
  });
});
