'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  MarketplaceApiError,
  type CreateTemplateInput,
  type DifficultyLevel,
  type InterviewQuestionType,
  type PracticeArea,
} from '@discover-legal/sdk';
import { marketplaceClient } from '@/lib/marketplace/browserClient';

interface QuestionDraft {
  id: string;
  label: string;
  type: InterviewQuestionType;
  required: boolean;
  options: string; // comma-separated in the editor
}

interface FormState {
  title: string;
  shortDescription: string;
  description: string;
  matterType: string;
  practiceArea: PracticeArea;
  jurisdictions: string; // comma-separated
  priceDollars: string;
  tags: string; // comma-separated
  estimatedMinutes: string;
  difficultyLevel: DifficultyLevel;
  body: string;
  questions: QuestionDraft[];
}

const EMPTY: FormState = {
  title: '',
  shortDescription: '',
  description: '',
  matterType: '',
  practiceArea: 'civil',
  jurisdictions: '',
  priceDollars: '1',
  tags: '',
  estimatedMinutes: '15',
  difficultyLevel: 'standard',
  body: '',
  questions: [],
};

const QUESTION_TYPES: InterviewQuestionType[] = ['text', 'textarea', 'date', 'number', 'select', 'boolean'];

function slugifyId(label: string, index: number): string {
  const base = label.toLowerCase().replace(/[^a-z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return base || `q${index + 1}`;
}

function toCsv(arr: string[]): string {
  return arr.join(', ');
}
function fromCsv(value: string): string[] {
  return value
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export default function TemplateBuilderClient({ templateId }: { templateId?: number }) {
  const router = useRouter();
  const isEdit = templateId != null;
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!isEdit) return;
    let active = true;
    marketplaceClient.lawyer
      .get(templateId)
      .then((t) => {
        if (!active) return;
        setForm({
          title: t.title,
          shortDescription: t.shortDescription ?? '',
          description: t.description ?? '',
          matterType: t.matterType,
          practiceArea: t.practiceArea,
          jurisdictions: toCsv(t.jurisdictions),
          priceDollars: String(t.priceCents / 100),
          tags: toCsv(t.tags),
          estimatedMinutes: t.estimatedMinutes != null ? String(t.estimatedMinutes) : '15',
          difficultyLevel: t.difficultyLevel,
          body: t.templateConfig.body ?? '',
          questions: t.templateConfig.questions.map((q) => ({
            id: q.id,
            label: q.label,
            type: q.type,
            required: q.required ?? false,
            options: toCsv(q.options ?? []),
          })),
        });
      })
      .catch(() => active && setError('Could not load this template.'))
      .finally(() => active && setLoading(false));
    return () => {
      active = false;
    };
  }, [isEdit, templateId]);

  const set = <K extends keyof FormState>(key: K, value: FormState[K]) =>
    setForm((f) => ({ ...f, [key]: value }));

  const addQuestion = () =>
    set('questions', [
      ...form.questions,
      { id: '', label: '', type: 'text', required: false, options: '' },
    ]);
  const updateQuestion = (i: number, patch: Partial<QuestionDraft>) =>
    set(
      'questions',
      form.questions.map((q, idx) => (idx === i ? { ...q, ...patch } : q)),
    );
  const removeQuestion = (i: number) =>
    set('questions', form.questions.filter((_, idx) => idx !== i));
  const moveQuestion = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= form.questions.length) return;
    const next = [...form.questions];
    [next[i], next[j]] = [next[j], next[i]];
    set('questions', next);
  };

  function buildInput(): CreateTemplateInput {
    const priceCents = Math.round(Number(form.priceDollars || '0') * 100);
    return {
      title: form.title.trim(),
      matterType: form.matterType.trim(),
      practiceArea: form.practiceArea,
      shortDescription: form.shortDescription.trim() || undefined,
      description: form.description.trim() || undefined,
      jurisdictions: fromCsv(form.jurisdictions).map((j) => j.toUpperCase()),
      priceCents: Number.isFinite(priceCents) ? priceCents : 100,
      tags: fromCsv(form.tags),
      estimatedMinutes: Number(form.estimatedMinutes) || undefined,
      difficultyLevel: form.difficultyLevel,
      templateConfig: {
        questions: form.questions.map((q, i) => ({
          id: q.id.trim() || slugifyId(q.label, i),
          label: q.label.trim(),
          type: q.type,
          required: q.required,
          ...(q.type === 'select' ? { options: fromCsv(q.options) } : {}),
        })),
        body: form.body.trim() || undefined,
      },
    };
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const input = buildInput();
      if (isEdit) {
        await marketplaceClient.lawyer.update(templateId, input);
        setNotice('Saved.');
      } else {
        const created = await marketplaceClient.lawyer.create(input);
        router.push(`/lawyer/templates/${created.id}`);
        return;
      }
    } catch (err) {
      setError(
        err instanceof MarketplaceApiError
          ? err.message
          : 'Could not save. Check your connection and try again.',
      );
    } finally {
      setSaving(false);
    }
  }

  if (loading) return <p className="text-sm text-gray-500">Loading…</p>;

  return (
    <form onSubmit={onSubmit} className="mx-auto max-w-3xl space-y-8">
      <h1 className="text-2xl font-bold text-gray-900">
        {isEdit ? 'Edit template' : 'New template'}
      </h1>

      {error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
      {notice && <p className="rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{notice}</p>}

      {/* Basics */}
      <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Basics</h2>
        <Field label="Title" required>
          <input
            type="text"
            required
            minLength={3}
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Short description">
          <input
            type="text"
            maxLength={300}
            value={form.shortDescription}
            onChange={(e) => set('shortDescription', e.target.value)}
            className={inputCls}
          />
        </Field>
        <Field label="Description">
          <textarea
            rows={4}
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            className={inputCls}
          />
        </Field>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <Field label="Matter type" required>
            <input
              type="text"
              required
              placeholder="e.g. affidavit, divorce"
              value={form.matterType}
              onChange={(e) => set('matterType', e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Practice area">
            <select
              value={form.practiceArea}
              onChange={(e) => set('practiceArea', e.target.value as PracticeArea)}
              className={inputCls}
            >
              <option value="civil">Civil</option>
              <option value="family">Family</option>
            </select>
          </Field>
          <Field label="Jurisdictions (comma-separated codes)">
            <input
              type="text"
              placeholder="TX, CA, ON"
              value={form.jurisdictions}
              onChange={(e) => set('jurisdictions', e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Price (USD)">
            <input
              type="number"
              min={0}
              step="0.01"
              value={form.priceDollars}
              onChange={(e) => set('priceDollars', e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Estimated minutes">
            <input
              type="number"
              min={1}
              value={form.estimatedMinutes}
              onChange={(e) => set('estimatedMinutes', e.target.value)}
              className={inputCls}
            />
          </Field>
          <Field label="Difficulty">
            <select
              value={form.difficultyLevel}
              onChange={(e) => set('difficultyLevel', e.target.value as DifficultyLevel)}
              className={inputCls}
            >
              <option value="basic">Basic</option>
              <option value="standard">Standard</option>
              <option value="complex">Complex</option>
            </select>
          </Field>
        </div>
        <Field label="Tags (comma-separated)">
          <input
            type="text"
            value={form.tags}
            onChange={(e) => set('tags', e.target.value)}
            className={inputCls}
          />
        </Field>
      </section>

      {/* Interview */}
      <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">Interview questions</h2>
          <button
            type="button"
            onClick={addQuestion}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:border-blue-300 hover:text-blue-700"
          >
            + Add question
          </button>
        </div>
        {form.questions.length === 0 && (
          <p className="text-sm text-gray-500">
            No questions yet. Add the prompts your client answers; reference them in the body with{' '}
            <code className="rounded bg-gray-100 px-1">{'{{questionId}}'}</code>.
          </p>
        )}
        <ul className="space-y-3">
          {form.questions.map((q, i) => (
            <li key={i} className="rounded-lg border border-gray-200 p-3">
              <div className="grid grid-cols-1 gap-2 sm:grid-cols-[1fr_8rem_6rem]">
                <input
                  type="text"
                  placeholder="Question label"
                  value={q.label}
                  onChange={(e) => updateQuestion(i, { label: e.target.value })}
                  className={inputCls}
                />
                <select
                  value={q.type}
                  onChange={(e) => updateQuestion(i, { type: e.target.value as InterviewQuestionType })}
                  className={inputCls}
                >
                  {QUESTION_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
                <label className="flex items-center gap-1 text-sm text-gray-600">
                  <input
                    type="checkbox"
                    checked={q.required}
                    onChange={(e) => updateQuestion(i, { required: e.target.checked })}
                  />
                  Required
                </label>
              </div>
              <div className="mt-2 flex items-center gap-2">
                <input
                  type="text"
                  placeholder="Field id (auto from label if blank)"
                  value={q.id}
                  onChange={(e) => updateQuestion(i, { id: e.target.value })}
                  className={`${inputCls} text-xs`}
                />
                {q.type === 'select' && (
                  <input
                    type="text"
                    placeholder="Options (comma-separated)"
                    value={q.options}
                    onChange={(e) => updateQuestion(i, { options: e.target.value })}
                    className={`${inputCls} text-xs`}
                  />
                )}
              </div>
              <div className="mt-2 flex items-center gap-2 text-xs">
                <button type="button" onClick={() => moveQuestion(i, -1)} className="text-gray-500 hover:text-gray-800">
                  ↑ Up
                </button>
                <button type="button" onClick={() => moveQuestion(i, 1)} className="text-gray-500 hover:text-gray-800">
                  ↓ Down
                </button>
                <button type="button" onClick={() => removeQuestion(i)} className="text-red-500 hover:text-red-700">
                  Remove
                </button>
              </div>
            </li>
          ))}
        </ul>
      </section>

      {/* Body */}
      <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Document body</h2>
        <p className="text-sm text-gray-500">
          Use <code className="rounded bg-gray-100 px-1">{'{{questionId}}'}</code> placeholders to
          insert answers.
        </p>
        <textarea
          rows={10}
          value={form.body}
          onChange={(e) => set('body', e.target.value)}
          className={`${inputCls} font-mono text-sm`}
        />
      </section>

      <div className="flex items-center gap-3">
        <button
          type="submit"
          disabled={saving}
          className="rounded-lg bg-blue-600 px-6 py-2.5 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
        >
          {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Create draft'}
        </button>
        <button
          type="button"
          onClick={() => router.push('/lawyer/templates')}
          className="rounded-lg border border-gray-300 px-5 py-2.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
        >
          Cancel
        </button>
      </div>
    </form>
  );
}

const inputCls =
  'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-gray-600">
        {label} {required && <span className="text-red-500">*</span>}
      </span>
      {children}
    </label>
  );
}
