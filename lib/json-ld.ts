/**
 * JSON.stringify with HTML-tag-safe escaping. Embedding JSON inside an
 * inline <script> via dangerouslySetInnerHTML is a known XSS vector if
 * the data ever contains </script>; escape `<` to its unicode form so
 * the parser never sees a tag terminator.
 *
 * Use ONLY for application/ld+json blocks.
 */
export function jsonLd(data: unknown): string {
  return JSON.stringify(data).replace(/</g, '\\u003c');
}
