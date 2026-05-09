import { handleAuth, handleLogin, handleLogout, handleCallback } from '@auth0/nextjs-auth0';

// Handles /api/auth/login, /logout, /callback, /me automatically.
//
// We pass an explicit returnTo on login so the user lands on the dashboard
// after a successful login, not back on the marketing page.
export const GET = handleAuth({
  login: handleLogin({
    returnTo: '/dashboard',
    authorizationParams: {
      audience: process.env.AUTH0_AUDIENCE,
      scope: 'openid profile email',
    },
  }),
  signup: handleLogin({
    returnTo: '/dashboard',
    authorizationParams: {
      audience: process.env.AUTH0_AUDIENCE,
      scope: 'openid profile email',
      screen_hint: 'signup',
    },
  }),
  callback: handleCallback(),
  logout: handleLogout({ returnTo: '/' }),
});
