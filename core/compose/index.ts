export * from './types';
import type { Composer, ComposerDeps } from './types';

export function createComposer(_deps: ComposerDeps): Composer {
  throw new Error('core/compose: not implemented yet');
}
