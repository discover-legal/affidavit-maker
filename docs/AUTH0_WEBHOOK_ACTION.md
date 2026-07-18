# Auth0 webhook Action deployment

The user-update webhook now rejects replayed and out-of-order deliveries. The
production Auth0 Action must therefore send the Auth0 user record's
authoritative `updated_at` value as the signed `updateTime` field. Do not use
the Action's delivery time: retries would then look like newer identity data.

Configure these Action secrets:

- `DISCOVER_LEGAL_WEBHOOK_URL` = `https://discover.legal/api/auth/webhook/user-update`
- `DISCOVER_LEGAL_WEBHOOK_SECRET` = the same value as Render's
  `AUTH0_WEBHOOK_SECRET`

Add `axios` as an Action dependency, deploy this Action, attach it to the
Post Login flow, and test it before deploying the application change:

```js
const crypto = require('crypto');
const axios = require('axios');

exports.onExecutePostLogin = async (event) => {
  if (!event.user.updated_at) throw new Error('Auth0 user.updated_at is required');

  const body = JSON.stringify({
    user: {
      user_id: event.user.user_id,
      email: event.user.email,
      email_verified: event.user.email_verified,
      name: event.user.name,
      nickname: event.user.nickname,
    },
    updateTime: event.user.updated_at,
  });
  const signature = crypto
    .createHmac('sha256', event.secrets.DISCOVER_LEGAL_WEBHOOK_SECRET)
    .update(body, 'utf8')
    .digest('hex');

  await axios.post(event.secrets.DISCOVER_LEGAL_WEBHOOK_URL, body, {
    headers: {
      'content-type': 'application/json',
      'content-length': String(Buffer.byteLength(body)),
      'auth0-signature': signature,
    },
    timeout: 5000,
  });
};
```

If a separate email-update Action remains configured, it must use the same
payload/timestamp rule and target `/api/auth/webhook/email-update`.

Release check: trigger a login, confirm a 200 delivery, replay the exact signed
body (200 with `ignored: true` when stale/older), and verify an event missing
`updateTime` returns 400.
