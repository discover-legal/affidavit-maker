/**
 * Rendering — DocumentTree → bytes. No legal logic lives here; a renderer
 * only knows how to draw the block kinds. A `blank` draws an underline rule
 * and its draft note; a `paragraph` draws text; nothing else is interpreted.
 */

import type { DocumentTree } from '../compose/types';

export interface RenderOptions {
  /** Footer text after the page counter, e.g. "Created with Discover.Legal". */
  footerBrand?: string;
  /** Watermark or header line for drafts. */
  draftBanner?: boolean;
}

export interface Renderer {
  pdf(tree: DocumentTree, options?: RenderOptions): Promise<Buffer>;
  html(tree: DocumentTree, options?: RenderOptions): string;
  text(tree: DocumentTree): string;
}

