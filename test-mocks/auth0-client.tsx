import type { ReactNode } from 'react';

export function Auth0Provider({ children }: { children: ReactNode }) {
  return children;
}

export function useUser() {
  return { user: null, error: null, isLoading: false };
}

export function withPageAuthRequired<T>(component: T): T {
  return component;
}

export async function getAccessToken() {
  return '';
}
