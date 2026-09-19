/**
 * @jest-environment node
 *
 * promote(file, definition) — fill absent structured fields from ACTIVE facts
 * with ONE ask(ASK.PROFILE_PROMOTE) against the definition's field schema.
 * Replaces v1's rescue loops and the whereabouts / children-count / grounds
 * regexes. Spec: docs/spec/02-facts-and-life-story.md §2.4, §2.5.
 *
 *   - exactly one ask per call; input = active facts + current fields
 *   - the ask's schema names only the definition keys still ABSENT on the file
 *   - answers land on typed slots / fields with provenance 'derived' + derivedFrom
 *   - an answer outside the enum or of the wrong type is DROPPED (absence, never a sentinel)
 *   - present fields are never overwritten; no facts → no ask; a throwing ask is fail-open
 */

import { ASK, ScriptedIntelligence } from '@/core/intelligence';
import { createLifeStoryService } from '@/core/profile';
import type { LifeStoryService } from '@/core/profile';
import type { CaseFile, Fact } from '@/core/model';
import { ALL_FIELD_KEYS, DEFINITION, askCalls, clone, familyFile, fact, field, retiredFact, schemaPropertyKeys, schemaRequired, subSchema } from './_helpers';

let service: LifeStoryService;
let intel: ScriptedIntelligence;

beforeEach(() => {
  intel = new ScriptedIntelligence();
  service = createLifeStoryService({ intelligence: intel });
});

const SCRIPTED_ANSWER = {
  fields: {
    respondent_address_unknown: true,
    respondent_suspected_location: 'Louisiana or Mississippi',
    number_of_children: 3,
    grounds: 'insupportability',
  },
};

/** A divorce file with the self name present, three active facts and one retired fact. */
function scenario(): { file: CaseFile; active: Fact[]; retired: Fact } {
  const whereabouts = fact('I do not know where Dana lives; she may be in Louisiana or Mississippi', 'residence', {
    subcategory: 'respondent_whereabouts',
    values: { place: 'Louisiana or Mississippi' },
  });
  const kids = fact('Dana and I have three children together', 'children', { values: { number: 3 } });
  const grounds = fact('Our marriage has become insupportable because of discord', 'relationship', {
    subcategory: 'grounds',
    values: { ground: 'insupportability' },
  });
  const retired = retiredFact('Dana and I have two children together', 'children', kids.id, { values: { number: 2 } });
  const f = familyFile({
    parties: { self: { firstName: field('Marcus', 'stated', 'i am marcus') }, other: {} },
    facts: [retired, whereabouts, kids, grounds],
  });
  return { file: f, active: [whereabouts, kids, grounds], retired };
}

describe('promote — the request', () => {
  it('makes exactly one ask with only the active facts and the current fields as input', async () => {
    const { file, active, retired } = scenario();
    intel.onAsk(ASK.PROFILE_PROMOTE, SCRIPTED_ANSWER);

    await service.promote(file, DEFINITION);

    const calls = askCalls(intel, ASK.PROFILE_PROMOTE);
    expect(calls).toHaveLength(1);
    expect(intel.calls).toHaveLength(1);

    const input = calls[0].request.input as { facts: Array<{ id: string; statement: string }>; fields: Record<string, unknown> };
    expect(Array.isArray(input.facts)).toBe(true);
    expect(input.facts.map((f) => f.id).sort()).toEqual(active.map((f) => f.id).sort());
    expect(input.facts.find((f) => f.id === retired.id)).toBeUndefined();
    expect(input.facts.every((f) => typeof f.statement === 'string')).toBe(true);
    expect(typeof input.fields).toBe('object');
    expect(input.fields).not.toBeNull();
  });

  it('asks only for the definition keys still absent on the file', async () => {
    const { file } = scenario();
    intel.onAsk(ASK.PROFILE_PROMOTE, SCRIPTED_ANSWER);

    await service.promote(file, DEFINITION);

    const [call] = askCalls(intel, ASK.PROFILE_PROMOTE);
    expect(schemaRequired(call.request.schema)).toEqual(['fields']);
    const fieldsSchema = subSchema(call.request.schema, 'fields');
    // petitioner_first_name binds self.firstName, which the file already has
    expect(schemaPropertyKeys(fieldsSchema)).toEqual(ALL_FIELD_KEYS.filter((k) => k !== 'petitioner_first_name').sort());
    expect(subSchema(fieldsSchema, 'grounds')?.enum).toEqual(['insupportability', 'cruelty']);
  });

  it('omits every key whose slot is already present, whether typed or in fields', async () => {
    const { file } = scenario();
    file.parties.other.firstName = field('Dana');
    file.parties.other.whereaboutsUnknown = field(true, 'stated', 'no idea where she is');
    file.fields.numberOfChildren = field(3);
    file.fields.hasProperty = field(false);
    intel.onAsk(ASK.PROFILE_PROMOTE, { fields: {} });

    await service.promote(file, DEFINITION);

    const [call] = askCalls(intel, ASK.PROFILE_PROMOTE);
    expect(schemaPropertyKeys(subSchema(call.request.schema, 'fields'))).toEqual(
      ['respondent_suspected_location', 'grounds', 'monthly_income'].sort(),
    );
  });
});

describe('promote — applying the answer', () => {
  it('lands answers on typed slots and fields with provenance derived from the facts passed', async () => {
    const { file, active, retired } = scenario();
    intel.onAsk(ASK.PROFILE_PROMOTE, SCRIPTED_ANSWER);

    const out = await service.promote(file, DEFINITION);

    expect(out.parties.other.whereaboutsUnknown?.value).toBe(true);
    expect(out.parties.other.suspectedLocation?.value).toBe('Louisiana or Mississippi');
    expect(out.fields.numberOfChildren?.value).toBe(3);
    expect(out.fields.grounds?.value).toBe('insupportability');

    const activeIds = active.map((f) => f.id);
    for (const slot of [
      out.parties.other.whereaboutsUnknown,
      out.parties.other.suspectedLocation,
      out.fields.numberOfChildren,
      out.fields.grounds,
    ]) {
      expect(slot?.provenance.source).toBe('derived');
      expect(slot?.provenance.derivedFrom).toEqual(expect.arrayContaining(activeIds));
      expect(slot?.provenance.derivedFrom).not.toEqual(expect.arrayContaining([retired.id]));
      expect(typeof slot?.provenance.at).toBe('string');
    }

    // untouched parts survive
    expect(out.parties.self.firstName).toEqual(field('Marcus', 'stated', 'i am marcus'));
    expect(out.facts).toEqual(file.facts);
    expect(out.fields.monthlyIncome).toBeUndefined();
    expect(out.fields.hasProperty).toBeUndefined();
    expect(out.parties.other.firstName).toBeUndefined();
  });

  it('drops an answer value that is not in the enum — absence, never a sentinel', async () => {
    const { file } = scenario();
    intel.onAsk(ASK.PROFILE_PROMOTE, { fields: { ...SCRIPTED_ANSWER.fields, grounds: 'unknown' } });

    const out = await service.promote(file, DEFINITION);

    expect(out.fields.grounds).toBeUndefined();
    expect(Object.keys(out.fields)).not.toEqual(expect.arrayContaining(['grounds']));
    // the rest of the answer still lands
    expect(out.parties.other.whereaboutsUnknown?.value).toBe(true);
    expect(out.fields.numberOfChildren?.value).toBe(3);
  });

  it('drops an answer value of the wrong type for its schema', async () => {
    const { file } = scenario();
    intel.onAsk(ASK.PROFILE_PROMOTE, {
      fields: { has_property: 'yes', number_of_children: 'three', respondent_address_unknown: true },
    });

    const out = await service.promote(file, DEFINITION);

    expect(out.fields.hasProperty).toBeUndefined();
    expect(out.fields.numberOfChildren).toBeUndefined();
    expect(out.parties.other.whereaboutsUnknown?.value).toBe(true);
  });

  it('never overwrites a field that is already present', async () => {
    const { file } = scenario();
    file.fields.numberOfChildren = field(2, 'stated', 'we have two kids');
    file.parties.other.suspectedLocation = field('Baton Rouge', 'stated', 'probably baton rouge');
    intel.onAsk(ASK.PROFILE_PROMOTE, SCRIPTED_ANSWER);

    const out = await service.promote(file, DEFINITION);

    expect(out.fields.numberOfChildren).toEqual(field(2, 'stated', 'we have two kids'));
    expect(out.parties.other.suspectedLocation).toEqual(field('Baton Rouge', 'stated', 'probably baton rouge'));
    expect(out.parties.other.whereaboutsUnknown?.value).toBe(true);
    expect(out.fields.grounds?.value).toBe('insupportability');
  });

  it('ignores answer keys the definition does not declare', async () => {
    const { file } = scenario();
    intel.onAsk(ASK.PROFILE_PROMOTE, { fields: { spousal_support_waived: true, grounds: 'cruelty' } });

    const out = await service.promote(file, DEFINITION);

    expect(out.fields.spousalSupportWaived).toBeUndefined();
    expect(out.fields.spousal_support_waived).toBeUndefined();
    expect(out.confirmations).toEqual({});
    expect(out.fields.grounds?.value).toBe('cruelty');
  });
});

describe('promote — when not to ask, and failure', () => {
  it('makes no ask at all when the file has no active facts', async () => {
    const retired = retiredFact('Dana and I have two children together', 'children', 'fact_gone');
    const file = familyFile({ facts: [retired] });
    const before = clone(file);
    intel.onAsk(ASK.PROFILE_PROMOTE, SCRIPTED_ANSWER);

    const out = await service.promote(file, DEFINITION);

    expect(intel.calls).toHaveLength(0);
    expect(out).toEqual(before);
  });

  it('makes no ask when every definition key is already present', async () => {
    const file = familyFile({
      parties: {
        self: { firstName: field('Marcus') },
        other: { firstName: field('Dana'), whereaboutsUnknown: field(false), suspectedLocation: field('Provo') },
      },
      fields: { numberOfChildren: field(1), grounds: field('cruelty'), monthlyIncome: field(3400), hasProperty: field(true) },
      facts: [fact('I live in Provo', 'residence')],
    });
    const before = clone(file);
    intel.onAsk(ASK.PROFILE_PROMOTE, SCRIPTED_ANSWER);

    const out = await service.promote(file, DEFINITION);

    expect(intel.calls).toHaveLength(0);
    expect(out).toEqual(before);
  });

  it('is fail-open: a throwing ask returns the file unchanged', async () => {
    const { file } = scenario();
    const before = clone(file);
    intel.onAsk(ASK.PROFILE_PROMOTE, () => {
      throw new Error('model unavailable');
    });

    await expect(service.promote(file, DEFINITION)).resolves.toEqual(before);
  });
});
