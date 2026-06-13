/**
 * Error types thrown by the discover.legal SDK.
 *
 * - `MarketplaceApiError` — the server responded with a non-2xx status. Carries
 *   the HTTP status plus the structured `errorType` / `requestId` from the
 *   API's error envelope so callers can branch on them and correlate to server
 *   logs.
 * - `MarketplaceNetworkError` — the request never produced an HTTP response
 *   (DNS failure, connection reset, fetch rejection, abort).
 */

export class MarketplaceApiError extends Error {
  readonly name = 'MarketplaceApiError';
  readonly status: number;
  readonly errorType?: string;
  readonly requestId?: string;
  /** The raw parsed body, when it was JSON. */
  readonly body?: unknown;

  constructor(
    message: string,
    options: { status: number; errorType?: string; requestId?: string; body?: unknown },
  ) {
    super(message);
    this.status = options.status;
    this.errorType = options.errorType;
    this.requestId = options.requestId;
    this.body = options.body;
    // Restore prototype chain for instanceof across transpilation targets.
    Object.setPrototypeOf(this, MarketplaceApiError.prototype);
  }
}

export class MarketplaceNetworkError extends Error {
  readonly name = 'MarketplaceNetworkError';
  readonly cause?: unknown;

  constructor(message: string, cause?: unknown) {
    super(message);
    this.cause = cause;
    Object.setPrototypeOf(this, MarketplaceNetworkError.prototype);
  }
}
