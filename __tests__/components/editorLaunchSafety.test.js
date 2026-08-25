import { createPersistedDocumentSnapshot } from '@/contexts/DocumentContext';
import { getDownloadReadiness } from '@/components/app/EditorView';

jest.mock('@/lib/auth0-client', () => ({ useAuth0: jest.fn() }));
jest.mock('@/contexts/TOSContext', () => ({ useTOS: jest.fn() }));
jest.mock('next/navigation', () => ({
  useParams: jest.fn(),
  useSearchParams: jest.fn(),
}));
jest.mock('@/components/app/ChatInterface', () => () => null);
jest.mock('@/components/app/DocumentPreview', () => () => null);
jest.mock('@/components/app/ValidationSidebar', () => () => null);
jest.mock('@/components/app/PaymentModal', () => () => null);
jest.mock('@/lib/utils/analytics', () => ({ trackEvent: jest.fn() }));

describe('editor launch safety', () => {
  it('persists jurisdiction-specific answers and evidence without transient caches', () => {
    const evidence = [{ id: 'e1', evidenceData: { fileKey: 'user/doc/file.pdf' } }];
    const snapshot = createPersistedDocumentSnapshot({
      documentId: 'doc-1',
      state: 'TX',
      petitionerFirstName: 'Avery',
      respondentAddress: '123 Main St',
      hasChildren: true,
      evidence,
      factSummary: 'derived text',
      factSignature: 'derived hash',
      optionalUndefined: undefined,
    });

    expect(snapshot).toMatchObject({
      documentId: 'doc-1',
      petitionerFirstName: 'Avery',
      respondentAddress: '123 Main St',
      hasChildren: true,
      evidence,
    });
    expect(snapshot).not.toHaveProperty('factSummary');
    expect(snapshot).not.toHaveProperty('factSignature');
    expect(snapshot).not.toHaveProperty('optionalUndefined');
  });

  it('blocks checkout until core interview information exists', () => {
    expect(getDownloadReadiness({ facts: [] })).toEqual({
      ready: false,
      missing: ['jurisdiction', 'your name', 'at least one fact'],
    });
    expect(getDownloadReadiness({
      state: 'TX',
      petitionerName: 'Avery Smith',
      facts: [{ text: 'The parties separated.' }],
    })).toEqual({ ready: true, missing: [] });
  });

  it('reads the name from the user\'s OWN side of the caption under role', () => {
    // Respondent user, no affiantName: their own respondentName satisfies
    // the check — the petitioner caption (the spouse) alone does not.
    expect(getDownloadReadiness({
      state: 'UT',
      role: 'respondent',
      petitionerName: 'Alex Example',
      respondentName: 'Jordan S. Example',
      facts: [{ text: 'The parties separated.' }],
    })).toEqual({ ready: true, missing: [] });

    expect(getDownloadReadiness({
      state: 'UT',
      role: 'respondent',
      petitionerName: 'Alex Example',
      facts: [{ text: 'The parties separated.' }],
    })).toEqual({ ready: false, missing: ['your name'] });
  });
});
