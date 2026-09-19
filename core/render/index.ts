/**
 * Renderer factory — DocumentTree → PDF / HTML / text. Draws block kinds;
 * interprets nothing.
 */

export * from './types';
import { renderHtml } from './html';
import { renderPdf } from './pdf';
import { renderText } from './text';
import type { Renderer } from './types';

export function createRenderer(): Renderer {
  return {
    pdf: (tree, options) => renderPdf(tree, options ?? {}),
    html: (tree, options) => renderHtml(tree, options ?? {}),
    text: (tree) => renderText(tree),
  };
}
