/** @jest-environment node */

import { readFileSync, readdirSync, statSync } from 'fs';
import { join } from 'path';
import { AUTH0_PROFILE_ROUTE } from '@/lib/auth0-routes';

/**
 * The v4 SDK resolves the profile URL per useUser() call — Auth0Provider's
 * profileRoute prop is not forwarded to the hook. A bare useUser() therefore
 * fetches the SDK-default /auth/profile, 404s against our custom-route
 * middleware, and the client treats a signed-in user as signed out
 * (production login loop, 2026-08-07). Every call site must pass
 * { route: AUTH0_PROFILE_ROUTE }.
 */

const ROOT = join(__dirname, '..', '..');
const SCAN_DIRS = ['app', 'components', 'lib', 'contexts', 'hooks'];
const SOURCE_EXT = /\.(ts|tsx|js|jsx)$/;

function sourceFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((entry) => {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) return sourceFiles(full);
    return SOURCE_EXT.test(entry) ? [full] : [];
  });
}

describe('Auth0 client profile route', () => {
  it('matches the route the middleware serves (lib/auth0.ts routes.profile)', () => {
    const config = readFileSync(join(ROOT, 'lib', 'auth0.ts'), 'utf8');
    expect(config).toContain('profile: AUTH0_PROFILE_ROUTE');
    expect(AUTH0_PROFILE_ROUTE).toBe('/api/auth/me');
  });

  it('is passed explicitly at every useUser() call site', () => {
    const offenders: string[] = [];
    for (const dir of SCAN_DIRS) {
      for (const file of sourceFiles(join(ROOT, dir))) {
        const source = readFileSync(file, 'utf8')
          .replace(/\/\*[\s\S]*?\*\//g, '')
          .replace(/^\s*\/\/.*$/gm, '');
        for (const match of source.matchAll(/useUser\(([^)]*)\)/g)) {
          if (!match[1].includes('route')) {
            offenders.push(`${file.slice(ROOT.length + 1)}: useUser(${match[1]})`);
          }
        }
      }
    }
    expect(offenders).toEqual([]);
  });
});
