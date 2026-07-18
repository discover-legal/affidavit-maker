/** @jest-environment node */

import { buildAuth0SessionConfig } from '@/lib/auth0';

describe('Auth0 v4 session limits', () => {
  it('uses the production 24-hour absolute and one-hour inactivity defaults', () => {
    expect(buildAuth0SessionConfig({})).toEqual({
      rolling: true,
      absoluteDuration: 86400,
      inactivityDuration: 3600,
    });
  });

  it('accepts only positive integer overrides', () => {
    expect(buildAuth0SessionConfig({
      AUTH0_SESSION_ABSOLUTE_DURATION: '7200',
      AUTH0_SESSION_INACTIVITY_DURATION: '900',
    })).toMatchObject({ absoluteDuration: 7200, inactivityDuration: 900 });
    expect(buildAuth0SessionConfig({
      AUTH0_SESSION_ABSOLUTE_DURATION: '-1',
      AUTH0_SESSION_INACTIVITY_DURATION: 'NaN',
    })).toMatchObject({ absoluteDuration: 86400, inactivityDuration: 3600 });
  });
});
