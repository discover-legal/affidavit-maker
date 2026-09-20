/**
 * Allowlist / international gating, delegated to config/jurisdictions.js so
 * v1 and v2 can never disagree about which codes surface:
 *
 *   1. JURISDICTION_ALLOWLIST set (non-blank) → only those codes, case-insensitive.
 *   2. Otherwise the North American set (51 US + 13 CA) always surfaces, and
 *      the rest only when ENABLE_INTERNATIONAL is exactly the string 'true'.
 *
 * Evaluated at call time so callers see live env changes.
 */

import { NA_JURISDICTIONS, isInternationalEnabled, readAllowlist } from '../../config/jurisdictions';

export function isSurfaced(codeUpper: string): boolean {
  const allowlist = readAllowlist() as Set<string> | null;
  if (allowlist) return allowlist.has(codeUpper);
  if ((NA_JURISDICTIONS as Set<string>).has(codeUpper)) return true;
  return isInternationalEnabled();
}
