/**
 * lib/marketplace/renderTemplate.ts
 *
 * Renders a lawyer-authored marketplace template into a finished document by
 * substituting the buyer's interview answers into the authored body. This is
 * "the system" for marketplace documents — the template builder writes a body
 * with `{{questionId}}` placeholders plus typed questions, and this renders
 * whatever was authored.
 *
 * Pure and deterministic (no IO), so it's trivially testable and safe to run on
 * the server during generate. Designed to be expandable: today it handles
 * placeholder substitution + a Q&A fallback; sections, conditionals, and
 * richer formatting can layer on without changing the call sites.
 */
import type { InterviewQuestion, TemplateConfig } from '@discover-legal/sdk';

export interface RenderResult {
  /** The completed document text. */
  document: string;
  /** Ids of required questions that had no answer (caller may block/ warn). */
  missingRequired: string[];
}

/** Format a single answer for insertion into the document. */
export function formatAnswer(question: InterviewQuestion, value: unknown): string {
  if (value === undefined || value === null || value === '') return '';
  if (question.type === 'boolean') {
    if (typeof value === 'boolean') return value ? 'Yes' : 'No';
    return value === 'true' || value === 'yes' ? 'Yes' : 'No';
  }
  if (Array.isArray(value)) return value.map((v) => String(v)).join(', ');
  return String(value);
}

function isAnswered(value: unknown): boolean {
  if (value === undefined || value === null) return false;
  if (typeof value === 'string') return value.trim() !== '';
  return true;
}

/**
 * Render `config` against `answers`. Placeholders are `{{id}}` with optional
 * surrounding whitespace. Unknown / unanswered placeholders render as the
 * empty string (never a literal `{{…}}`). With no authored body, falls back to
 * a labeled question/answer listing.
 */
export function renderTemplate(
  config: TemplateConfig,
  answers: Record<string, unknown>,
): RenderResult {
  const byId = new Map(config.questions.map((q) => [q.id, q]));

  const missingRequired = config.questions
    .filter((q) => q.required && !isAnswered(answers[q.id]))
    .map((q) => q.id);

  let document: string;
  if (config.body && config.body.trim()) {
    document = config.body.replace(/\{\{\s*([A-Za-z0-9_]+)\s*\}\}/g, (_match, id: string) => {
      const question = byId.get(id);
      if (!question) return '';
      return formatAnswer(question, answers[id]);
    });
  } else {
    document = config.questions
      .map((q) => `${q.label}: ${formatAnswer(q, answers[q.id])}`)
      .join('\n');
  }

  return { document, missingRequired };
}
