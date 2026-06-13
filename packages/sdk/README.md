# @discover-legal/sdk

Typed TypeScript client for the [discover.legal](https://discover.legal) document
marketplace API. Used by the in-repo marketplace UI and published for partner /
external integrations.

> The marketplace is gated behind the `ENABLE_MARKETPLACE` feature flag on the
> server. When it is off, every endpoint returns `404` and this client throws a
> `MarketplaceApiError` with `status: 404`.

## Install

```bash
npm install @discover-legal/sdk
```

## Usage

```ts
import { DiscoverLegalClient } from '@discover-legal/sdk';

const client = new DiscoverLegalClient({
  baseUrl: 'https://discover.legal', // omit for same-origin browser usage
});

// Search / filter with cursor pagination
const page = await client.templates.search({
  q: 'divorce',
  jurisdiction: 'CA',
  practiceArea: 'family',
  sortBy: 'rating',
  limit: 20,
});
console.log(page.templates, page.nextCursor, page.total);

// Fetch one by slug
const template = await client.templates.get('simple-affidavit-tx');
```

### Options

| Option    | Type                       | Default        | Notes                                            |
| --------- | -------------------------- | -------------- | ------------------------------------------------ |
| `baseUrl` | `string`                   | `''`           | API origin. Empty = same-origin (browser).       |
| `fetch`   | `typeof fetch`             | global `fetch` | Inject for tests / Node < 18 / retry middleware. |
| `headers` | `Record<string, string>`   | `{}`           | Sent on every request (e.g. a partner API key).  |

### Errors

- `MarketplaceApiError` — non-2xx HTTP response. Exposes `status`, `errorType`,
  `requestId`, and the parsed `body`.
- `MarketplaceNetworkError` — the request never produced a response (DNS,
  connection, abort). Exposes `cause`.

```ts
import { MarketplaceApiError } from '@discover-legal/sdk';

try {
  await client.templates.get('missing');
} catch (err) {
  if (err instanceof MarketplaceApiError && err.status === 404) {
    // not found (or marketplace disabled)
  }
}
```

## Contract

The published API contract lives in [`openapi.yaml`](./openapi.yaml). Regenerate
the raw schema types with:

```bash
npm run generate   # openapi-typescript openapi.yaml -> src/generated/schema.d.ts
```

The hand-authored types in `src/types.ts` are the client's source of truth and
are kept in lock-step with the spec.

## Develop

```bash
npm run type-check
npm test
npm run build      # emits dist/ (ESM + .d.ts)
```
