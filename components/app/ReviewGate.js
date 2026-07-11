'use client';

// components/app/ReviewGate.js — "Verify before you swear" review gate.
//
// Sworn court documents are signed under penalty of perjury, so before a
// PDF downloads we show the user everything that will appear in it —
// party names, dates, place, children, and every statement of fact with
// its provenance (their own words) — and require explicit confirmation.
//
// UPL-safe framing: the user verifies THEIR OWN statements. This gate
// gives no legal advice and makes no judgment about the content.
import React, { useEffect, useState } from 'react';
import { X } from 'lucide-react';

// Key document fields worth re-confirming, in display order.
const FIELD_LABELS = [
  ['affiantName', 'Your name (affiant)'],
  ['petitionerName', 'Petitioner'],
  ['respondentName', 'Respondent'],
  ['state', 'State'],
  ['county', 'County'],
  ['marriageDate', 'Date of marriage'],
  ['separationDate', 'Date of separation'],
  ['groundsForDivorce', 'Grounds for divorce'],
  ['custodyArrangement', 'Custody arrangement'],
  ['childSupportAmount', 'Child support amount'],
];

const hasValue = (value) =>
  value !== undefined && value !== null && String(value).trim() !== '';

const ReviewGate = ({ isOpen, affidavitData, onConfirm, onCancel }) => {
  const [confirmed, setConfirmed] = useState(false);

  // Require a fresh confirmation every time the gate opens.
  useEffect(() => {
    if (isOpen) setConfirmed(false);
  }, [isOpen]);

  if (!isOpen) return null;

  const data = affidavitData || {};
  const fields = FIELD_LABELS
    .map(([key, label]) => ({ key, label, value: data[key] }))
    .filter(({ value }) => hasValue(value));
  const children = Array.isArray(data.children) ? data.children : [];
  const facts = Array.isArray(data.facts) ? data.facts : [];
  const hasAnything = fields.length > 0 || children.length > 0 || facts.length > 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4 overflow-y-auto">
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="review-gate-title"
        className="bg-white rounded-2xl shadow-xl max-w-2xl w-full my-auto flex flex-col max-h-[85vh]"
      >
        {/* Header - fixed */}
        <div className="flex items-start justify-between p-4 sm:p-6 pb-3 border-b flex-shrink-0">
          <div className="min-w-0">
            <h3 id="review-gate-title" className="text-lg font-semibold text-gray-900">
              Check your statements before you sign
            </h3>
            <p className="mt-1 text-sm text-gray-600">
              This is everything your document will say. Only you can confirm it&apos;s accurate.
            </p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            aria-label="Close review"
            className="ml-4 flex-shrink-0 p-1"
          >
            <X className="h-6 w-6 text-gray-400 hover:text-gray-600" />
          </button>
        </div>

        {/* Scrollable content area */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {!hasAnything && (
            <p className="text-sm text-gray-600">
              There&apos;s nothing to review yet — add your information in the chat first.
            </p>
          )}

          {fields.length > 0 && (
            <section>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Parties, dates &amp; place
              </h4>
              <dl className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                {fields.map(({ key, label, value }) => (
                  <div key={key} className="flex items-baseline justify-between gap-4 px-3 py-2">
                    <dt className="text-sm text-gray-600 flex-shrink-0">{label}</dt>
                    <dd className="text-sm font-medium text-gray-900 text-right break-words">
                      {String(value)}
                    </dd>
                  </div>
                ))}
              </dl>
            </section>
          )}

          {children.length > 0 && (
            <section>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Children
              </h4>
              <ul className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                {children.map((child, index) => (
                  <li key={index} className="flex items-baseline justify-between gap-4 px-3 py-2">
                    <span className="text-sm font-medium text-gray-900 break-words">
                      {child?.name || 'Unnamed child'}
                    </span>
                    {hasValue(child?.dob) && (
                      <span className="text-sm text-gray-600 flex-shrink-0">
                        Born {String(child.dob)}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </section>
          )}

          {facts.length > 0 && (
            <section>
              <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2">
                Your statements ({facts.length})
              </h4>
              <ol className="border border-gray-200 rounded-lg divide-y divide-gray-100">
                {facts.map((fact, index) => (
                  <li key={index} className="px-3 py-2.5">
                    {hasValue(fact?.category) && (
                      <div className="text-[11px] font-medium text-gray-400 uppercase tracking-wide mb-0.5">
                        {String(fact.category).replace(/_/g, ' ')}
                      </div>
                    )}
                    <p className="text-sm text-gray-900">
                      {fact?.professionalRewrite || fact?.content}
                    </p>
                    {hasValue(fact?.sourceQuote) && (
                      <p className="mt-1 text-xs text-gray-500">
                        You said: &ldquo;{fact.sourceQuote}&rdquo;
                      </p>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          )}
        </div>

        {/* Footer - fixed */}
        <div className="border-t p-4 sm:p-6 pt-4 flex-shrink-0 space-y-3">
          <label className="flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(e) => setConfirmed(e.target.checked)}
              className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
            />
            <span className="text-sm font-medium text-gray-900">
              These statements are true and in my own words
            </span>
          </label>

          <div className="flex flex-col sm:flex-row gap-3">
            <button
              type="button"
              onClick={onCancel}
              className="flex-1 px-4 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition-colors"
            >
              Go back and fix something
            </button>
            <button
              type="button"
              onClick={onConfirm}
              disabled={!confirmed}
              className="flex-1 px-4 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-medium transition-colors"
            >
              Looks right — create my document
            </button>
          </div>

          <p className="text-xs text-gray-500">
            Court documents are signed under penalty of perjury. If anything is wrong,
            go back and correct it in the chat or on Your life story.
          </p>
        </div>
      </div>
    </div>
  );
};

export default ReviewGate;
