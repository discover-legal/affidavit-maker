'use client';

import { Auth0Provider } from '@auth0/nextjs-auth0/client';
import type { User } from '@auth0/nextjs-auth0/types';

export default function Providers({
  children,
  user,
}: {
  children: React.ReactNode;
  user?: User;
}) {
  return (
    <Auth0Provider user={user} profileRoute="/api/auth/me">
      {children}
    </Auth0Provider>
  );
}
