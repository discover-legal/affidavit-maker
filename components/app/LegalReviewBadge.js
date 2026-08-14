'use client';

// LegalReviewBadge — shows when a jurisdiction's legal claims were last
// verified and what the AI corrected, sourced from
// /api/templates/validation/[state]. The recency coloring is the user-facing
// heuristic: fresher verification → higher likelihood the encoded law is
// still correct.
import React, { useState, useEffect, useRef } from 'react';
import { ShieldCheck, ShieldAlert, ChevronDown, ExternalLink } from 'lucide-react';

const dayMs = 24 * 60 * 60 * 1000;

const recencyTone = (lastVerified) => {
  const days = Math.max(0, Math.floor((Date.now() - new Date(lastVerified).getTime()) / dayMs));
  if (days <= 120) return { days, classes: 'text-green-700 bg-green-50 border-green-200' };
  if (days <= 365) return { days, classes: 'text-amber-700 bg-amber-50 border-amber-200' };
  return { days, classes: 'text-red-700 bg-red-50 border-red-200' };
};

const relative = (days) => {
  if (days === 0) return 'today';
  if (days === 1) return 'yesterday';
  if (days < 60) return `${days} days ago`;
  if (days < 365) return `${Math.round(days / 30)} months ago`;
  return `${Math.round(days / 365 * 10) / 10} years ago`;
};

const TYPE_LABELS = {
  verification: 'Verified',
  correction: 'Corrected',
  refinement: 'Refined',
};

const LegalReviewBadge = ({ stateCode }) => {
  const [entry, setEntry] = useState(null);
  const [open, setOpen] = useState(false);
  const panelRef = useRef(null);

  useEffect(() => {
    if (!stateCode) return;
    let cancelled = false;
    setEntry(null);
    fetch(`/api/templates/validation/${encodeURIComponent(stateCode)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((body) => {
        if (!cancelled && body?.success) setEntry(body.data.jurisdiction);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [stateCode]);

  useEffect(() => {
    if (!open) return;
    const onClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    return () => document.removeEventListener('mousedown', onClick);
  }, [open]);

  if (!stateCode || !entry) return null;

  const { days, classes } = recencyTone(entry.lastVerified);
  const corrections = entry.changelog.filter((e) => e.type === 'correction');
  const Icon = days <= 365 ? ShieldCheck : ShieldAlert;

  return (
    <div className="relative" ref={panelRef}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className={`flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-medium ${classes}`}
        aria-expanded={open}
        title="Legal review history for this jurisdiction"
      >
        <Icon className="h-3.5 w-3.5" aria-hidden="true" />
        <span>Law verified {relative(days)}</span>
        <ChevronDown className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />
      </button>

      {open && (
        <div className="absolute left-0 z-40 mt-2 w-80 sm:w-96 max-h-96 overflow-y-auto rounded-lg border border-gray-200 bg-white p-3 text-left shadow-lg">
          <div className="text-sm font-semibold text-gray-800">
            {entry.stateName} — legal review history
          </div>
          <p className="mt-1 text-xs text-gray-500">
            {Object.keys(entry.claims || {}).length} claim categories last verified{' '}
            {entry.lastVerified} against primary sources
            {corrections.length > 0 && `; ${corrections.length} correction${corrections.length === 1 ? '' : 's'} applied`}.
          </p>
          <ul className="mt-2 space-y-2">
            {entry.changelog.map((e, i) => (
              <li key={i} className="rounded border border-gray-100 bg-gray-50 p-2 text-xs text-gray-700">
                <div className="flex items-center gap-2">
                  <span className={`font-semibold ${e.type === 'correction' ? 'text-amber-700' : 'text-green-700'}`}>
                    {TYPE_LABELS[e.type] || e.type}
                  </span>
                  <span className="text-gray-400">{e.date}</span>
                  {e.claim && <span className="rounded bg-gray-200 px-1.5 py-0.5 text-[10px] uppercase tracking-wide">{e.claim}</span>}
                </div>
                <div className="mt-1">{e.summary}</div>
                {e.source && (
                  <a
                    href={e.source}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-1 inline-flex items-center gap-1 text-blue-600 hover:underline break-all"
                  >
                    <ExternalLink className="h-3 w-3 shrink-0" aria-hidden="true" />
                    source
                  </a>
                )}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-[11px] leading-snug text-gray-400">
            Verification dates let you judge freshness: the longer since the last
            review, the more likely the law has moved. Always confirm current
            requirements with the court before filing.
          </p>
        </div>
      )}
    </div>
  );
};

export default LegalReviewBadge;
