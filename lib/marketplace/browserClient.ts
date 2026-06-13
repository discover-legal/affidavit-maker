import { DiscoverLegalClient } from '@discover-legal/sdk';

/**
 * Shared browser-side SDK client for marketplace UI components. Same-origin
 * (baseUrl '') with default 'same-origin' credentials, so the authed provider
 * endpoints receive the session cookie. Import only from Client Components.
 */
export const marketplaceClient = new DiscoverLegalClient();
