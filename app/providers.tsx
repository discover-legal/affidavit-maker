'use client';

import { Auth0Provider } from '@auth0/nextjs-auth0/client';
import type { User } from '@auth0/nextjs-auth0/types';
import { AUTH0_PROFILE_ROUTE } from '@/lib/auth0-routes';

export default function Providers({
  children,
  user,
}: {
  children: React.ReactNode;
  user?: User;
}) {
  return (
    <Auth0Provider user={user} profileRoute={AUTH0_PROFILE_ROUTE}>
      {children}
    </Auth0Provider>
  );
}
