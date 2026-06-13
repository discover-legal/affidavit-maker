/**
 * lib/marketplace/schemas.ts
 *
 * Zod schemas for provider (lawyer) template authoring request bodies. Shared
 * by the create / update Route Handlers. The parsed output is shaped to the
 * SDK's CreateTemplateInput / UpdateTemplateInput so the repository can consume
 * it directly.
 */
import { z } from 'zod';

const jurisdictionCode = z
  .string()
  .trim()
  .regex(/^[A-Za-z_]{2,10}$/, 'invalid jurisdiction code')
  .transform((s) => s.toUpperCase());

export const interviewQuestionSchema = z.object({
  id: z
    .string()
    .trim()
    .min(1)
    .max(60)
    .regex(/^[A-Za-z0-9_]+$/, 'question id must be alphanumeric/underscore'),
  label: z.string().trim().min(1).max(300),
  type: z.enum(['text', 'textarea', 'date', 'number', 'select', 'boolean']),
  required: z.boolean().optional(),
  options: z.array(z.string().max(200)).max(50).optional(),
  help: z.string().max(500).optional(),
});

export const templateConfigSchema = z.object({
  questions: z.array(interviewQuestionSchema).max(200).default([]),
  body: z.string().max(50_000).optional(),
});

export const createTemplateSchema = z.object({
  title: z.string().trim().min(3).max(500),
  matterType: z.string().trim().min(1).max(50),
  practiceArea: z.enum(['family', 'civil']),
  shortDescription: z.string().trim().max(300).optional(),
  description: z.string().max(20_000).optional(),
  jurisdictions: z.array(jurisdictionCode).max(120).optional(),
  priceCents: z.number().int().min(0).max(1_000_000).optional(),
  tags: z.array(z.string().trim().max(40)).max(20).optional(),
  estimatedMinutes: z.number().int().min(1).max(600).optional(),
  difficultyLevel: z.enum(['basic', 'standard', 'complex']).optional(),
  coverImageUrl: z.string().url().max(1000).optional(),
  templateConfig: templateConfigSchema.optional(),
});

// Partial for PATCH/PUT-style updates; at least one field must be present.
export const updateTemplateSchema = createTemplateSchema
  .partial()
  .refine((obj) => Object.keys(obj).length > 0, { message: 'No updatable fields supplied' });

export type CreateTemplateBody = z.infer<typeof createTemplateSchema>;
export type UpdateTemplateBody = z.infer<typeof updateTemplateSchema>;
