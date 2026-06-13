/**
 * @jest-environment node
 */
import { requireLawyer, isProvider, isAdmin, requireAdmin } from '@/lib/marketplace/guards';
import { AuthorizationError } from '@/lib/api/errors';

describe('requireLawyer', () => {
  it('allows lawyers', () => {
    expect(() => requireLawyer({ role: 'lawyer' })).not.toThrow();
  });
  it('allows admins', () => {
    expect(() => requireLawyer({ role: 'admin' })).not.toThrow();
  });
  it('rejects clients with a 403 AuthorizationError', () => {
    expect(() => requireLawyer({ role: 'client' })).toThrow(AuthorizationError);
  });
});

describe('isProvider', () => {
  it('is true for lawyer/admin, false for client', () => {
    expect(isProvider('lawyer')).toBe(true);
    expect(isProvider('admin')).toBe(true);
    expect(isProvider('client')).toBe(false);
  });
});

describe('admin guards', () => {
  it('isAdmin is true only for admin', () => {
    expect(isAdmin('admin')).toBe(true);
    expect(isAdmin('lawyer')).toBe(false);
    expect(isAdmin('client')).toBe(false);
  });
  it('requireAdmin allows admin, rejects lawyer/client', () => {
    expect(() => requireAdmin({ role: 'admin' })).not.toThrow();
    expect(() => requireAdmin({ role: 'lawyer' })).toThrow(AuthorizationError);
    expect(() => requireAdmin({ role: 'client' })).toThrow(AuthorizationError);
  });
});
