/**
 * Jurisdiction registry — one profile per templates/states/<dir>, built
 * once per registry instance from metadata.json + divorce-metadata.json.
 * Lookup is case-insensitive and trimmed; gating (active()) is evaluated
 * at call time from the environment, and never affects get() / all().
 */

export * from './types';
import { buildProfile } from './build';
import { isSurfaced } from './gating';
import { defaultTemplatesDir, loadRawJurisdictions } from './metadata';
import type { Country, JurisdictionProfile, JurisdictionRegistry } from './types';

/** The jurisdiction a country falls back to when the user has not chosen one. */
const DEFAULT_BY_COUNTRY: Readonly<Record<string, string>> = {
  US: 'TX',
  CA: 'ON',
  UK: 'ENG',
  IE: 'IRL',
  AU: 'NSW',
  NZ: 'NZ',
};

function normalizeCode(code: unknown): string {
  return typeof code === 'string' ? code.trim().toUpperCase() : '';
}

export function createJurisdictionRegistry(opts?: { templatesDir?: string }): JurisdictionRegistry {
  const templatesDir = opts?.templatesDir ?? defaultTemplatesDir();

  const profiles: JurisdictionProfile[] = [];
  const byCode = new Map<string, JurisdictionProfile>();
  for (const raw of loadRawJurisdictions(templatesDir)) {
    const profile = buildProfile(raw);
    if (byCode.has(profile.code)) {
      console.warn(`core/jurisdictions: duplicate code ${profile.code} in ${raw.directory}; keeping ${byCode.get(profile.code)!.directory}`);
      continue;
    }
    byCode.set(profile.code, profile);
    profiles.push(profile);
  }

  return {
    get(code: string): JurisdictionProfile | null {
      return byCode.get(normalizeCode(code)) ?? null;
    },
    all(): JurisdictionProfile[] {
      return profiles.slice();
    },
    active(): JurisdictionProfile[] {
      return profiles.filter((p) => isSurfaced(p.code));
    },
    countryOf(code: string): Country | null {
      return byCode.get(normalizeCode(code))?.country ?? null;
    },
    defaultFor(country: Country): JurisdictionProfile | null {
      const wanted = normalizeCode(country);
      if (!wanted) return null;
      const preferred = DEFAULT_BY_COUNTRY[wanted];
      if (preferred && byCode.has(preferred)) return byCode.get(preferred)!;
      return profiles.find((p) => p.country === wanted) ?? null;
    },
  };
}
