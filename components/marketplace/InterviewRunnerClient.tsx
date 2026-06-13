'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  MarketplaceApiError,
  type InterviewQuestion,
  type PurchaseDetail,
} from '@discover-legal/sdk';
import { marketplaceClient } from '@/lib/marketplace/browserClient';

type Answers = Record<string, unknown>;

export default function InterviewRunnerClient({ purchaseId }: { purchaseId: number }) {
  const [detail, setDetail] = useState<PurchaseDetail | null>(null);
  const [answers, setAnswers] = useState<Answers>({});
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [pendingTries, setPendingTries] = useState(0);

  const fetchDetail = useCallback(async () => {
    try {
      const d = await marketplaceClient.purchases.get(purchaseId);
      setDetail(d);
      setAnswers(d.interviewAnswers ?? {});
      return d;
    } catch (err) {
      setError(
        err instanceof MarketplaceApiError && err.status === 404
          ? 'Purchase not found.'
          : 'Could not load your purchase.',
      );
      return null;
    }
  }, [purchaseId]);

  useEffect(() => {
    void fetchDetail();
  }, [fetchDetail]);

  // Payment may still be settling via the Stripe webhook right after redirect.
  // Poll a few times before giving the buyer a manual refresh.
  useEffect(() => {
    if (!detail || detail.status === 'paid' || pendingTries >= 5) return;
    const t = setTimeout(() => {
      setPendingTries((n) => n + 1);
      void fetchDetail();
    }, 2000);
    return () => clearTimeout(t);
  }, [detail, pendingTries, fetchDetail]);

  const setAnswer = (id: string, value: unknown) => setAnswers((a) => ({ ...a, [id]: value }));

  const save = useCallback(async () => {
    setSaving(true);
    setError(null);
    setNotice(null);
    try {
      const updated = await marketplaceClient.purchases.saveAnswers(purchaseId, answers);
      setDetail((d) => (d ? { ...d, interviewAnswers: updated.interviewAnswers } : d));
      setNotice('Saved.');
    } catch {
      setError('Could not save your answers.');
    } finally {
      setSaving(false);
    }
  }, [purchaseId, answers]);

  const generate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    setNotice(null);
    try {
      await marketplaceClient.purchases.saveAnswers(purchaseId, answers);
      const updated = await marketplaceClient.purchases.generate(purchaseId);
      setDetail(updated);
      setNotice('Document generated.');
    } catch (err) {
      setError(
        err instanceof MarketplaceApiError
          ? err.message
          : 'Could not generate the document.',
      );
    } finally {
      setGenerating(false);
    }
  }, [purchaseId, answers]);

  if (error && !detail) return <p className="text-sm text-red-600">{error}</p>;
  if (!detail) return <p className="text-sm text-gray-500">Loading…</p>;

  if (detail.status !== 'paid') {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <h1 className="text-lg font-semibold text-gray-900">Finalizing your purchase…</h1>
        <p className="mt-2 text-sm text-gray-600">
          Payment is being confirmed. This usually takes a few seconds.
        </p>
        <button
          type="button"
          onClick={() => void fetchDetail()}
          className="mt-4 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:border-blue-300 hover:text-blue-700"
        >
          Refresh
        </button>
      </div>
    );
  }

  const questions = detail.templateConfig.questions;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <div>
        <Link href="/marketplace/purchases" className="text-sm text-gray-500 hover:text-blue-700">
          ← My documents
        </Link>
        <h1 className="mt-1 text-2xl font-bold text-gray-900">{detail.templateTitle}</h1>
      </div>

      {error && <p className="rounded-lg bg-red-50 px-4 py-2 text-sm text-red-700">{error}</p>}
      {notice && <p className="rounded-lg bg-emerald-50 px-4 py-2 text-sm text-emerald-700">{notice}</p>}

      <section className="space-y-4 rounded-xl border border-gray-200 bg-white p-6">
        <h2 className="text-lg font-semibold text-gray-900">Your answers</h2>
        {questions.length === 0 ? (
          <p className="text-sm text-gray-500">This template has no questions — just generate it.</p>
        ) : (
          questions.map((q) => (
            <QuestionField key={q.id} question={q} value={answers[q.id]} onChange={(v) => setAnswer(q.id, v)} />
          ))
        )}
        <div className="flex gap-3 pt-2">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving}
            className="rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-60"
          >
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button
            type="button"
            onClick={() => void generate()}
            disabled={generating}
            className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
          >
            {generating ? 'Generating…' : 'Generate document'}
          </button>
        </div>
      </section>

      {detail.completedDocument != null && (
        <CompletedDocument
          purchaseId={detail.id}
          title={detail.templateTitle}
          document={detail.completedDocument}
        />
      )}
    </div>
  );
}

function QuestionField({
  question,
  value,
  onChange,
}: {
  question: InterviewQuestion;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const cls =
    'w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500';
  const label = (
    <span className="mb-1 block text-sm font-medium text-gray-700">
      {question.label} {question.required && <span className="text-red-500">*</span>}
    </span>
  );

  if (question.type === 'boolean') {
    return (
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input type="checkbox" checked={value === true} onChange={(e) => onChange(e.target.checked)} />
        {question.label} {question.required && <span className="text-red-500">*</span>}
      </label>
    );
  }

  return (
    <label className="block">
      {label}
      {question.help && <span className="mb-1 block text-xs text-gray-400">{question.help}</span>}
      {question.type === 'textarea' ? (
        <textarea rows={3} value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} className={cls} />
      ) : question.type === 'select' ? (
        <select value={String(value ?? '')} onChange={(e) => onChange(e.target.value)} className={cls}>
          <option value="">Select…</option>
          {(question.options ?? []).map((opt) => (
            <option key={opt} value={opt}>
              {opt}
            </option>
          ))}
        </select>
      ) : (
        <input
          type={question.type === 'date' ? 'date' : question.type === 'number' ? 'number' : 'text'}
          value={String(value ?? '')}
          onChange={(e) => onChange(question.type === 'number' ? Number(e.target.value) : e.target.value)}
          className={cls}
        />
      )}
    </label>
  );
}

function CompletedDocument({
  purchaseId,
  title,
  document,
}: {
  purchaseId: number;
  title: string;
  document: string;
}) {
  const download = () => {
    const blob = new Blob([document], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `${title.replace(/[^a-z0-9]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'document'}.md`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <section className="space-y-3 rounded-xl border border-gray-200 bg-white p-6">
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold text-gray-900">Completed document</h2>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={() => void navigator.clipboard?.writeText(document)}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Copy
          </button>
          <button
            type="button"
            onClick={download}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Markdown
          </button>
          <a
            href={`/api/marketplace/purchases/${purchaseId}/pdf`}
            className="rounded-lg bg-gray-900 px-3 py-1.5 text-sm font-medium text-white hover:bg-gray-700"
          >
            Download PDF
          </a>
        </div>
      </div>
      <pre className="max-h-[28rem] overflow-auto whitespace-pre-wrap rounded-lg bg-gray-50 p-4 font-mono text-sm text-gray-800">
        {document}
      </pre>
    </section>
  );
}
