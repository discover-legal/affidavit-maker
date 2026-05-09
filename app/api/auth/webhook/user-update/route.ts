import { NextRequest } from 'next/server';
import { handleUserUpsert, processAuth0Webhook } from '@/lib/api/auth0-webhook';

// Auth0 webhook: user create/update events. Mirrors the legacy Express path
// `POST /api/auth/webhook/user-update` so the existing Auth0 dashboard Action
// configuration keeps working without changes.
//
// Note: this nested path takes precedence over the catch-all
// /api/auth/[auth0]/route.ts (the @auth0/nextjs-auth0 handleAuth handler) in
// the App Router because more-specific segments win over dynamic ones.

export const runtime = 'nodejs';

export async function POST(req: NextRequest) {
  return processAuth0Webhook(req, handleUserUpsert);
}
