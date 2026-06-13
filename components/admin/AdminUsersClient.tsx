'use client';

import { useCallback, useEffect, useState } from 'react';
import { MarketplaceApiError, type AdminUser, type UserRole } from '@discover-legal/sdk';
import { marketplaceClient } from '@/lib/marketplace/browserClient';

const ROLES: UserRole[] = ['client', 'lawyer', 'admin'];

export default function AdminUsersClient() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [q, setQ] = useState('');
  const [roleFilter, setRoleFilter] = useState<UserRole | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<number | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const page = await marketplaceClient.admin.listUsers({
        role: roleFilter === 'all' ? undefined : roleFilter,
        q: q.trim() || undefined,
        limit: 100,
      });
      setUsers(page.users);
    } catch (err) {
      setError(err instanceof MarketplaceApiError ? 'Could not load users.' : 'Network error.');
    } finally {
      setLoading(false);
    }
  }, [q, roleFilter]);

  useEffect(() => {
    void load();
  }, [roleFilter]); // eslint-disable-line react-hooks/exhaustive-deps

  const changeRole = useCallback(async (u: AdminUser, role: UserRole) => {
    if (role === u.role) return;
    setBusyId(u.id);
    setError(null);
    try {
      const updated = await marketplaceClient.admin.setUserRole(u.id, role);
      setUsers((list) => list.map((x) => (x.id === u.id ? updated : x)));
    } catch (err) {
      setError(err instanceof MarketplaceApiError ? err.message : 'Could not update role.');
    } finally {
      setBusyId(null);
    }
  }, []);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-bold text-gray-900">Users</h1>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void load();
        }}
        className="flex flex-wrap items-end gap-3"
      >
        <label className="flex-1">
          <span className="mb-1 block text-xs font-medium text-gray-600">Search</span>
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="email or name"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          />
        </label>
        <label>
          <span className="mb-1 block text-xs font-medium text-gray-600">Role</span>
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value as UserRole | 'all')}
            className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
          >
            <option value="all">All</option>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {r}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white hover:bg-blue-700"
        >
          Search
        </button>
      </form>

      {error && <p className="text-sm text-red-600">{error}</p>}

      {loading ? (
        <p className="text-sm text-gray-500">Loading…</p>
      ) : (
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
          {users.map((u) => (
            <li key={u.id} className="flex items-center justify-between px-4 py-3">
              <div className="min-w-0">
                <div className="font-medium text-gray-900">{u.name ?? u.email}</div>
                <div className="text-xs text-gray-500">{u.email}</div>
              </div>
              <label className="flex items-center gap-2 text-sm">
                <span className="text-xs text-gray-500">Role</span>
                <select
                  value={u.role}
                  disabled={busyId === u.id}
                  onChange={(e) => void changeRole(u, e.target.value as UserRole)}
                  className="rounded-lg border border-gray-300 px-2 py-1 text-sm disabled:opacity-50"
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>
                      {r}
                    </option>
                  ))}
                </select>
              </label>
            </li>
          ))}
          {users.length === 0 && (
            <li className="px-4 py-8 text-center text-sm text-gray-500">No users match.</li>
          )}
        </ul>
      )}
    </div>
  );
}
