'use strict';

/**
 * Matter definition schema (YAML → validated, normalized object).
 *
 * A "matter" is a claim / interview type: what the triage step can classify
 * into, what the catalog shows, and the phased interview that the generic
 * BaseMatterOrchestrator runs. Everything the hand-written JS packs under
 * services/agents/prompts/<matter>/index.js expressed in code is expressed
 * here declaratively so a new matter is one YAML file in matters/.
 *
 * See matters/README.md for the authoring guide.
 */

const { z } = require('zod');

const CODE_RE = /^[a-z][a-z0-9_]{1,39}$/;
const SNAKE_RE = /^[a-z][a-z0-9_]*$/;
const PHASE_ID_RE = /^[A-Z][A-Z0-9_]*$/;

// Names the tool call reserves for the engine itself.
const RESERVED_FIELDS = new Set(['response', 'phase_complete', 'extracted_facts', 'superseded_facts']);

const JSON_TYPES = ['string', 'number', 'integer', 'boolean', 'array', 'object'];

/** Recursive JSON-schema-ish field spec (the subset OpenAI tool params use). */
const fieldSpecSchema = z.lazy(() =>
  z
    .object({
      type: z.enum(JSON_TYPES),
      description: z.string().min(1).max(500).optional(),
      enum: z.array(z.string().min(1)).min(1).optional(),
      items: fieldSpecSchema.optional(),
      properties: z.record(z.string().regex(SNAKE_RE), fieldSpecSchema).optional(),
      required: z.array(z.string().regex(SNAKE_RE)).optional(),
      target: z.string().regex(/^[a-z][A-Za-z0-9]*$/, 'target must be camelCase').optional(),
    })
    .strict()
    .superRefine((spec, ctx) => {
      if (spec.type === 'array' && !spec.items) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'array fields need `items`' });
      }
      if (spec.type !== 'array' && spec.items) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: '`items` only applies to type: array' });
      }
      if (spec.type !== 'object' && spec.properties) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: '`properties` only applies to type: object' });
      }
      if (spec.enum && spec.type !== 'string') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, message: '`enum` only applies to type: string' });
      }
    }),
);

// `fields:` accepts either the full spec or a shorthand type string.
const fieldEntrySchema = z.union([z.enum(JSON_TYPES), fieldSpecSchema]);

const phaseSchema = z
  .object({
    id: z.string().regex(PHASE_ID_RE, 'phase id must be UPPER_SNAKE_CASE'),
    display_name: z.string().min(1).max(80),
    prompt: z.string().min(20),
    required_fields: z.array(z.string().min(1)).default([]),
    optional: z.boolean().optional(),
    skip_unless_any: z.array(z.string().min(1)).min(1).optional(),
    skip_if_any: z.array(z.string().min(1)).min(1).optional(),
    fact_category: z.string().regex(SNAKE_RE).optional(),
  })
  .strict();

const matterFileSchema = z
  .object({
    code: z.string().regex(CODE_RE, 'code must be snake_case, 2–40 chars'),
    practice_area: z.enum(['family', 'civil']),
    display_name: z.string().min(1).max(120),
    short_name: z.string().min(1).max(40),
    tagline: z.string().min(1).max(200),
    sort_order: z.number().int().min(0).max(100000).default(1000),
    is_packaged: z.boolean().default(false),
    family_profile: z.boolean().default(false),
    supported_jurisdictions: z.array(z.string().min(2).max(8)).min(1).optional(),
    documents: z.array(z.string().regex(SNAKE_RE)).min(1),
    document_selection: z
      .object({
        documents: z.array(z.string().regex(SNAKE_RE)).min(1),
        reasons: z.record(z.string().regex(SNAKE_RE), z.string().min(1)).default({}),
      })
      .strict()
      .optional(),
    triage: z
      .object({
        description: z.string().min(1).max(300),
        keywords: z.array(z.string().min(1)).min(1),
        routing_notes: z.array(z.string().min(1)).default([]),
      })
      .strict(),
    shared_rules: z.string().optional(),
    fields: z.record(z.string(), fieldEntrySchema),
    phases: z.array(phaseSchema).min(2),
  })
  .strict();

function snakeToCamel(key) {
  return key.replace(/_([a-z0-9])/g, (_, c) => c.toUpperCase());
}

/**
 * Validate a parsed YAML document and normalize it into the shape the
 * orchestrator factory and catalog consume.
 *
 * @param {unknown} raw   parsed YAML
 * @param {string}  sourceFile  for error messages
 * @returns {{ ok: true, matter: object } | { ok: false, errors: string[] }}
 */
function validateMatterDefinition(raw, sourceFile = '<inline>') {
  const parsed = matterFileSchema.safeParse(raw);
  if (!parsed.success) {
    const errors = parsed.error.issues.map(
      (i) => `${i.path.length ? i.path.join('.') : '(root)'}: ${i.message}`,
    );
    return { ok: false, errors };
  }
  const d = parsed.data;
  const errors = [];

  // ── fields ──
  const fields = [];
  const targets = new Map(); // camelCase target → snake key
  for (const [key, entry] of Object.entries(d.fields)) {
    if (!SNAKE_RE.test(key)) {
      errors.push(`fields.${key}: field names must be snake_case`);
      continue;
    }
    if (RESERVED_FIELDS.has(key)) {
      errors.push(`fields.${key}: reserved by the interview engine`);
      continue;
    }
    const spec = typeof entry === 'string' ? { type: entry } : entry;
    const { target: explicitTarget, ...jsonSchema } = spec;
    const target = explicitTarget || snakeToCamel(key);
    if (targets.has(target)) {
      errors.push(`fields.${key}: target "${target}" already used by fields.${targets.get(target)}`);
      continue;
    }
    targets.set(target, key);
    fields.push({ key, target, schema: stripTargets(jsonSchema) });
  }
  if (fields.length === 0) errors.push('fields: at least one field is required');

  // ── phases ──
  const ids = new Set();
  const phases = [];
  d.phases.forEach((p, idx) => {
    const where = `phases[${idx}] (${p.id})`;
    if (ids.has(p.id)) errors.push(`${where}: duplicate phase id`);
    ids.add(p.id);

    const requiredFields = p.required_fields.map((f) => resolveFieldRef(f, targets, `${where}.required_fields`, errors)).filter(Boolean);
    const skipUnlessAny = (p.skip_unless_any || []).map((f) => resolveFieldRef(f, targets, `${where}.skip_unless_any`, errors)).filter(Boolean);
    const skipIfAny = (p.skip_if_any || []).map((f) => resolveFieldRef(f, targets, `${where}.skip_if_any`, errors)).filter(Boolean);
    const conditional = skipUnlessAny.length > 0 || skipIfAny.length > 0;
    if (p.optional === false && conditional) {
      errors.push(`${where}: optional: false conflicts with skip_unless_any / skip_if_any`);
    }

    const prompt = d.shared_rules ? `${p.prompt.replace(/\s+$/, '')}\n\n${d.shared_rules.trim()}\n` : p.prompt;
    phases.push({
      id: p.id,
      displayName: p.display_name,
      prompt,
      requiredFields,
      optional: p.optional ?? conditional,
      skipUnlessAny,
      skipIfAny,
      factCategory: p.fact_category || null,
    });
  });
  if (!ids.has('INTAKE')) errors.push('phases: an INTAKE phase is required (the engine starts and resets there)');
  const last = d.phases[d.phases.length - 1];
  if (last && last.id !== 'REVIEW') errors.push('phases: the last phase must be REVIEW (the engine completes the interview there)');
  const reviewIdx = d.phases.findIndex((p) => p.id === 'REVIEW');
  if (reviewIdx !== -1 && reviewIdx !== d.phases.length - 1) errors.push('phases: REVIEW must be the last phase');
  if (phases[0] && phases[0].id !== 'INTAKE') errors.push('phases: INTAKE must be the first phase');
  if (phases.some((p) => (p.id === 'INTAKE' || p.id === 'REVIEW') && (p.skipUnlessAny.length || p.skipIfAny.length))) {
    errors.push('phases: INTAKE and REVIEW cannot be conditional');
  }

  // ── document_selection reasons must describe listed documents ──
  if (d.document_selection) {
    for (const doc of Object.keys(d.document_selection.reasons)) {
      if (!d.document_selection.documents.includes(doc)) {
        errors.push(`document_selection.reasons.${doc}: not in document_selection.documents`);
      }
    }
  }

  if (errors.length) return { ok: false, errors };

  return {
    ok: true,
    matter: {
      code: d.code,
      practiceArea: d.practice_area,
      displayName: d.display_name,
      shortName: d.short_name,
      tagline: d.tagline,
      sortOrder: d.sort_order,
      isPackaged: d.is_packaged,
      familyProfile: d.family_profile,
      supportedJurisdictions: d.supported_jurisdictions ? d.supported_jurisdictions.map((s) => s.toUpperCase()) : null,
      documents: d.documents,
      documentSelection: d.document_selection || null,
      triage: {
        description: d.triage.description,
        keywords: d.triage.keywords,
        routingNotes: d.triage.routing_notes,
      },
      fields,
      phases,
      sourceFile,
    },
  };
}

/** A phase may reference a field by its snake_case key or its camelCase target. */
function resolveFieldRef(ref, targets, where, errors) {
  if (targets.has(ref)) return ref;
  const asTarget = snakeToCamel(ref);
  if (targets.has(asTarget)) return asTarget;
  errors.push(`${where}: unknown field "${ref}"`);
  return null;
}

/** Nested specs may not carry `target` (only top-level fields map to data keys). */
function stripTargets(spec) {
  const out = { type: spec.type };
  if (spec.description) out.description = spec.description;
  if (spec.enum) out.enum = spec.enum;
  if (spec.items) out.items = stripTargets(spec.items);
  if (spec.properties) {
    out.properties = Object.fromEntries(Object.entries(spec.properties).map(([k, v]) => [k, stripTargets(v)]));
  }
  if (spec.required) out.required = spec.required;
  return out;
}

module.exports = { validateMatterDefinition, snakeToCamel, RESERVED_FIELDS, CODE_RE };
