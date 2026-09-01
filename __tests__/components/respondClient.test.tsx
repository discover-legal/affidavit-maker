/**
 * RespondClient — deadline banner safety rail.
 *
 * Regression fixture for the Marcus persona (Ontario acceptance v6):
 * the user typed "june 24" for when they were served; the extraction
 * layer silently defaulted to the separation-date year (2024) instead of
 * the case year (2025), and the /respond banner then read
 *   Papers served: June 24, 2024 / Answer generally due: July 24, 2024 —
 *   This deadline has generally passed
 * for a real respondent whose deadline is actually weeks in the future.
 *
 * This page cannot know whether a served-date came from user
 * confirmation or from inference — so when the computed deadline sits
 * more than 6 months in the past, we suppress the flat "deadline has
 * passed" line and show a warning asking the user to correct the date
 * in their story.
 */

import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import '@testing-library/jest-dom';

jest.mock('next/navigation', () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

// Keep the client-only i18n init deterministic; RespondClient starts in EN
// and swaps in an effect — for tests we pin EN.
jest.mock('@/lib/i18n', () => ({
  getInitialLang: () => 'en',
  setLang: jest.fn(),
}));

// The perspective helper reads a profile shape; for these tests we always
// want the page in respondent mode without going through the confirm step.
jest.mock('@/lib/api/procedure', () => ({
  detectPerspective: () => 'respondent',
  isCanadianJurisdiction: (s: string) => s === 'ON' || s === 'CA',
}));

jest.mock('@/lib/officialForms', () => ({
  officialFormsLink: () => null,
}));

import RespondClient from '@/components/app/RespondClient';

type FetchMock = jest.Mock<Promise<Response>, [RequestInfo | URL, RequestInit?]>;

function mockFetchSequence(handlers: Array<(url: string) => unknown>) {
  const fetchMock: FetchMock = jest.fn(async (input) => {
    const url = typeof input === 'string' ? input : String(input);
    for (const handler of handlers) {
      const result = handler(url);
      if (result !== undefined) {
        return {
          ok: true,
          status: 200,
          json: async () => result,
        } as unknown as Response;
      }
    }
    throw new Error(`Unmocked fetch: ${url}`);
  });
  (global as unknown as { fetch: FetchMock }).fetch = fetchMock;
  return fetchMock;
}

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function profileResponse(serviceDate: string) {
  return {
    success: true,
    data: {
      profile: {
        state: 'ON',
        role: 'respondent',
        serviceDate,
      },
    },
  };
}

function procedureResponse(inState: number, outOfState: number) {
  return {
    success: true,
    data: { answerDeadlineDays: { inState, outOfState } },
  };
}

describe('RespondClient deadline safety rail', () => {
  afterEach(() => {
    jest.resetAllMocks();
  });

  it('shows the stale-date warning and suppresses "deadline has passed" when the served date is >6 months in the past (Marcus persona)', async () => {
    // 400 days ago mirrors the Marcus failure: "june 24" defaulted to
    // the prior-year value, so the computed deadline lands ~13 months
    // behind today.
    mockFetchSequence([
      (url) => (url.includes('/api/profile') ? profileResponse(isoDaysAgo(400)) : undefined),
      (url) => (url.includes('/api/procedure/') ? procedureResponse(30, 60) : undefined),
    ]);

    render(<RespondClient />);

    // Warning banner appears once the async pipeline settles.
    const warning = await screen.findByTestId('deadline-stale-warning');
    expect(warning).toHaveTextContent(
      /The deadline shown assumes the served date was .* — if that's wrong, please correct it in your story\./,
    );

    // The flat "deadline has generally passed" line is NEVER shown for a
    // suspected wrong-year inference — that's the bug this rail exists
    // to prevent.
    expect(screen.queryByText(/This deadline has generally passed/i)).not.toBeInTheDocument();
  });

  it('shows the normal deadline (with days-left) and no stale warning for a fresh served date', async () => {
    // 15 days ago with a 30-day answer window → ~15 days left; the
    // normal banner should render without the safety rail.
    mockFetchSequence([
      (url) => (url.includes('/api/profile') ? profileResponse(isoDaysAgo(15)) : undefined),
      (url) => (url.includes('/api/procedure/') ? procedureResponse(30, 60) : undefined),
    ]);

    render(<RespondClient />);

    await waitFor(() => {
      expect(screen.getByText(/Answer generally due:/i)).toBeInTheDocument();
    });

    // A real days-left figure is present — not the stale rail.
    expect(screen.getByText(/\d+ days left/)).toBeInTheDocument();
    expect(screen.queryByTestId('deadline-stale-warning')).not.toBeInTheDocument();
  });
});
