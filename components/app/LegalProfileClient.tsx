'use client';

import React, { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  Building2,
  Check,
  Loader2,
  PlusCircle,
  ShieldCheck,
  UserCircle,
  X,
} from 'lucide-react';
import Header from './Header';
import { useFirm } from '@/contexts/FirmContext';

/** Mirrors lib/biglaw/types.ts IntakeFact — kept local so this client
 * component doesn't import server-only modules. */
type Fact = {
  id: string;
  category: string;
  predicate: string;
  value: string;
  note: string;
  source: string;
  proposedBy: string;
  approverRole: string;
  status: string;
  decisionNote: string;
  createdAt: string;
  decidedAt: string;
};

type ProfileData = {
  profile: { id: string; clientNumber: string; name: string; email: string } | null;
  facts: Fact[];
  pendingYourApproval: Fact[];
  pendingLawyerApproval: Fact[];
};

type ApiEnvelope<T> = { success: boolean; data?: T; error?: string };

const CATEGORY_LABELS: Record<string, string> = {
  identity: 'Identity',
  contact: 'Contact',
  family: 'Family',
  financial: 'Financial',
  employment: 'Employment',
  matter: 'Matter',
  adverse_party: 'Adverse party',
  goal: 'Goal',
  concern: 'Concern',
  constraint: 'Constraint',
  preference: 'Preference',
  history: 'History',
  note: 'Note',
};

const CATEGORY_ORDER = Object.keys(CATEGORY_LABELS);

function categoryLabel(category: string): string {
  return CATEGORY_LABELS[category] ?? 'Note';
}

async function fetchJson<T>(url: string, init?: RequestInit): Promise<ApiEnvelope<T>> {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  const body = (await response.json().catch(() => ({}))) as ApiEnvelope<T>;
  if (!response.ok || !body.success) {
    throw new Error(body.error || `Request failed (${response.status})`);
  }
  return body;
}

const FactCard = ({ fact, actions }: { fact: Fact; actions?: React.ReactNode }) => (
  <li className="p-4 flex items-start justify-between gap-4">
    <div className="flex-1 min-w-0">
      <div className="flex items-center gap-2 flex-wrap">
        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
          {categoryLabel(fact.category)}
        </span>
        <span className="text-sm font-semibold text-gray-900 truncate">{fact.predicate}</span>
      </div>
      <p className="text-sm text-gray-700 mt-1 whitespace-pre-wrap break-words">{fact.value}</p>
      {fact.note && <p className="text-xs text-gray-500 mt-1">{fact.note}</p>}
    </div>
    {actions && <div className="flex items-center gap-2 flex-shrink-0">{actions}</div>}
  </li>
);

const LegalProfileClient = () => {
  const router = useRouter();
  const { firmMode, firmName, loading: firmLoading } = useFirm();

  const [profileData, setProfileData] = useState<ProfileData | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  // Decision state: proposal id currently being decided
  const [decidingId, setDecidingId] = useState<string | null>(null);
  const [decisionError, setDecisionError] = useState<string | null>(null);

  // Propose form state
  const [proposeCategory, setProposeCategory] = useState('contact');
  const [proposePredicate, setProposePredicate] = useState('');
  const [proposeValue, setProposeValue] = useState('');
  const [isProposing, setIsProposing] = useState(false);
  const [proposeError, setProposeError] = useState<string | null>(null);
  const [proposeSuccess, setProposeSuccess] = useState<string | null>(null);

  const loadProfile = useCallback(async () => {
    try {
      setLoadError(null);
      const body = await fetchJson<ProfileData>('/api/firm/profile');
      setProfileData(
        body.data ?? {
          profile: null,
          facts: [],
          pendingYourApproval: [],
          pendingLawyerApproval: [],
        },
      );
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load your legal profile');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    if (firmLoading) return;
    if (!firmMode) {
      setIsLoading(false);
      return;
    }
    loadProfile();
  }, [firmMode, firmLoading, loadProfile]);

  const handleDecision = async (proposalId: string, decision: 'approve' | 'reject') => {
    setDecidingId(proposalId);
    setDecisionError(null);
    try {
      await fetchJson(`/api/firm/profile/proposals/${encodeURIComponent(proposalId)}/decision`, {
        method: 'POST',
        body: JSON.stringify({ decision }),
      });
      await loadProfile();
    } catch (err) {
      setDecisionError(err instanceof Error ? err.message : 'Failed to submit your decision');
    } finally {
      setDecidingId(null);
    }
  };

  const handlePropose = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const predicate = proposePredicate.trim();
    const value = proposeValue.trim();
    if (!predicate || !value) {
      setProposeError('Please fill in both the label and the details.');
      return;
    }

    setIsProposing(true);
    setProposeError(null);
    setProposeSuccess(null);
    try {
      await fetchJson('/api/firm/profile/propose', {
        method: 'POST',
        body: JSON.stringify({
          facts: [{ category: proposeCategory, predicate, value }],
        }),
      });
      setProposePredicate('');
      setProposeValue('');
      setProposeSuccess(`Sent to ${firmName || 'your law firm'} for review.`);
      await loadProfile();
    } catch (err) {
      setProposeError(err instanceof Error ? err.message : 'Failed to send your update');
    } finally {
      setIsProposing(false);
    }
  };

  const renderShell = (children: React.ReactNode) => (
    <>
      <Header
        currentView="profile"
        onBackToDashboard={() => router.push('/dashboard')}
        onSave={undefined}
        sessionSaved={undefined}
        isSaving={undefined}
      />
      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
        <div className="mb-6 sm:mb-8 flex items-center gap-3">
          <UserCircle className="h-8 w-8 text-blue-600 flex-shrink-0" />
          <div>
            <h2 className="text-2xl sm:text-3xl font-bold text-gray-900">My Legal Profile</h2>
            <p className="text-sm sm:text-base text-gray-600">
              {firmMode
                ? `The information ${firmName || 'your law firm'} keeps on file about you — nothing changes without your approval.`
                : 'Your shared profile with a law firm.'}
            </p>
          </div>
        </div>
        {children}
      </main>
    </>
  );

  if (firmLoading || isLoading) {
    return renderShell(
      <div className="text-center p-10">
        <Loader2 className="h-8 w-8 animate-spin mx-auto text-blue-600" />
        <p className="mt-4 text-gray-600">Loading your legal profile...</p>
      </div>,
    );
  }

  if (!firmMode) {
    return renderShell(
      <div className="bg-white rounded-lg shadow-sm border p-12 text-center">
        <Building2 className="h-12 w-12 mx-auto text-gray-300 mb-4" />
        <p className="text-gray-500">
          This feature is available when your account is connected to a law firm.
        </p>
      </div>,
    );
  }

  if (loadError) {
    return renderShell(
      <div className="text-center p-10">
        <p className="text-red-600 mb-4">Error: {loadError}</p>
        <button
          onClick={() => {
            setIsLoading(true);
            loadProfile();
          }}
          className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          Retry
        </button>
      </div>,
    );
  }

  const data: ProfileData = profileData ?? {
    profile: null,
    facts: [],
    pendingYourApproval: [],
    pendingLawyerApproval: [],
  };

  const factsByCategory = new Map<string, Fact[]>();
  for (const fact of data.facts) {
    const key = CATEGORY_LABELS[fact.category] ? fact.category : 'note';
    const group = factsByCategory.get(key) ?? [];
    group.push(fact);
    factsByCategory.set(key, group);
  }

  return renderShell(
    <div className="space-y-6">
      {data.profile && (
        <div className="bg-white rounded-lg shadow-sm border px-6 py-4 flex items-center justify-between">
          <div>
            <p className="font-semibold text-gray-900">{data.profile.name}</p>
            <p className="text-sm text-gray-500">{data.profile.email}</p>
          </div>
          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-blue-100 text-blue-700">
            Client {data.profile.clientNumber}
          </span>
        </div>
      )}

      {/* (a) Lawyer-proposed facts awaiting the client's approval */}
      <section className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Pending your approval</h3>
          <p className="text-sm text-gray-500 mt-1">
            Updates {firmName || 'your law firm'} proposed. Nothing is added to your profile
            until you approve it.
          </p>
        </div>
        {decisionError && (
          <p className="px-6 pt-3 text-sm text-red-600">{decisionError}</p>
        )}
        {data.pendingYourApproval.length === 0 ? (
          <p className="px-6 py-4 text-sm text-gray-400">Nothing waiting on you right now.</p>
        ) : (
          <ul className="divide-y">
            {data.pendingYourApproval.map((fact) => (
              <FactCard
                key={fact.id}
                fact={fact}
                actions={
                  <>
                    <button
                      onClick={() => handleDecision(fact.id, 'approve')}
                      disabled={decidingId !== null}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-colors"
                    >
                      {decidingId === fact.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Check className="h-4 w-4" />
                      )}
                      Approve
                    </button>
                    <button
                      onClick={() => handleDecision(fact.id, 'reject')}
                      disabled={decidingId !== null}
                      className="flex items-center gap-1 px-3 py-1.5 text-sm border border-red-300 text-red-600 rounded-lg hover:bg-red-50 disabled:opacity-50 disabled:cursor-not-allowed font-semibold transition-colors"
                    >
                      <X className="h-4 w-4" />
                      Reject
                    </button>
                  </>
                }
              />
            ))}
          </ul>
        )}
      </section>

      {/* (b) Approved profile, grouped by category */}
      <section className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b flex items-center gap-2">
          <ShieldCheck className="h-5 w-5 text-green-600" />
          <div>
            <h3 className="text-lg font-semibold text-gray-900">Your profile</h3>
            <p className="text-sm text-gray-500 mt-0.5">
              Facts you and the firm have both agreed on.
            </p>
          </div>
        </div>
        {data.facts.length === 0 ? (
          <p className="px-6 py-4 text-sm text-gray-400">
            No approved facts yet. They appear here once you and the firm agree on them.
          </p>
        ) : (
          <div className="divide-y">
            {CATEGORY_ORDER.filter((category) => factsByCategory.has(category)).map(
              (category) => (
                <div key={category} className="px-6 py-4">
                  <h4 className="text-sm font-semibold text-gray-700 mb-2">
                    {categoryLabel(category)}
                  </h4>
                  <ul className="space-y-2">
                    {(factsByCategory.get(category) ?? []).map((fact) => (
                      <li key={fact.id} className="text-sm text-gray-700">
                        <span className="font-medium text-gray-900">{fact.predicate}:</span>{' '}
                        <span className="whitespace-pre-wrap break-words">{fact.value}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              ),
            )}
          </div>
        )}
      </section>

      {/* (c) Client proposals awaiting the firm */}
      <section className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Awaiting firm review</h3>
          <p className="text-sm text-gray-500 mt-1">
            Updates you proposed that {firmName || 'your law firm'} hasn&apos;t reviewed yet.
          </p>
        </div>
        {data.pendingLawyerApproval.length === 0 ? (
          <p className="px-6 py-4 text-sm text-gray-400">No pending updates.</p>
        ) : (
          <ul className="divide-y">
            {data.pendingLawyerApproval.map((fact) => (
              <FactCard key={fact.id} fact={fact} />
            ))}
          </ul>
        )}
      </section>

      {/* (d) Propose an update */}
      <section className="bg-white rounded-lg shadow-sm border">
        <div className="px-6 py-4 border-b">
          <h3 className="text-lg font-semibold text-gray-900">Propose an update</h3>
          <p className="text-sm text-gray-500 mt-1">
            Tell the firm something changed — they review it before it joins your profile.
          </p>
        </div>
        <form onSubmit={handlePropose} className="px-6 py-4 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="propose-category" className="block text-sm font-medium text-gray-700 mb-1">
                Category
              </label>
              <select
                id="propose-category"
                value={proposeCategory}
                onChange={(e) => setProposeCategory(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                disabled={isProposing}
              >
                {CATEGORY_ORDER.map((category) => (
                  <option key={category} value={category}>
                    {categoryLabel(category)}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="propose-predicate" className="block text-sm font-medium text-gray-700 mb-1">
                Label
              </label>
              <input
                id="propose-predicate"
                type="text"
                value={proposePredicate}
                onChange={(e) => setProposePredicate(e.target.value)}
                maxLength={64}
                placeholder="e.g. phone, new address, employer"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
                disabled={isProposing}
              />
            </div>
          </div>
          <div>
            <label htmlFor="propose-value" className="block text-sm font-medium text-gray-700 mb-1">
              Details
            </label>
            <textarea
              id="propose-value"
              value={proposeValue}
              onChange={(e) => setProposeValue(e.target.value)}
              maxLength={2000}
              rows={3}
              placeholder="What should the firm know?"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
              disabled={isProposing}
            />
          </div>
          {proposeError && <p className="text-sm text-red-600">{proposeError}</p>}
          {proposeSuccess && <p className="text-sm text-green-700">{proposeSuccess}</p>}
          <button
            type="submit"
            disabled={isProposing || !proposePredicate.trim() || !proposeValue.trim()}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors font-semibold text-sm"
          >
            {isProposing ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <PlusCircle className="h-4 w-4" />
            )}
            {isProposing ? 'Sending...' : 'Send for review'}
          </button>
        </form>
      </section>
    </div>,
  );
};

export default LegalProfileClient;
