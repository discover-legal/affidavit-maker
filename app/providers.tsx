'use client';

import { UserProvider } from '@auth0/nextjs-auth0/client';
import type { UserProfile } from '@auth0/nextjs-auth0/client';

export default function Providers({
  children,
  user,
}: {
  children: React.ReactNode;
  user?: UserProfile;
}) {
  return <UserProvider user={user}>{children}</UserProvider>;
}
