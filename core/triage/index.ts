export * from './types';
import type { Triage, TriageDeps } from './types';

export function createTriage(_deps: TriageDeps): Triage {
  throw new Error('core/triage: not implemented yet');
}
