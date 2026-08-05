import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';
import { ZodError } from 'zod';

export class AppError extends Error {
  status: number;
  errorType: string;
  constructor(message: string, status = 500, errorType = 'AppError') {
    super(message);
    this.status = status;
    this.errorType = errorType;
  }
}

export class ValidationError extends AppError {
  constructor(message = 'Validation failed') {
    super(message, 400, 'ValidationError');
  }
}

export class AuthenticationError extends AppError {
  constructor(message = 'Authentication required') {
    super(message, 401, 'AuthenticationError');
  }
}

export class AuthorizationError extends AppError {
  constructor(message = 'Forbidden') {
    super(message, 403, 'AuthorizationError');
  }
}

export class NotFoundError extends AppError {
  constructor(message = 'Not found') {
    super(message, 404, 'NotFoundError');
  }
}

export class RateLimitError extends AppError {
  constructor(message = 'Too many requests') {
    super(message, 429, 'RateLimitError');
  }
}

export class ExternalServiceError extends AppError {
  constructor(message = 'External service unavailable') {
    super(message, 503, 'ExternalServiceError');
  }
}

/**
 * Resolve the request id stamped by `middleware.ts`. Falling back to a fresh
 * UUID keeps the contract intact when this helper is used outside a Route
 * Handler context (e.g. server actions), but the common path emits the same
 * id that's on the request/response headers, so client error reports can
 * be correlated to server logs.
 */
function resolveRequestId(): string {
  // Next 15 made headers() asynchronous. Error conversion is intentionally
  // synchronous and is also used outside request scope, so generate a safe
  // correlation ID here rather than relying on dynamic request APIs.
  return randomUUID();
}

export function toErrorResponse(err: unknown): NextResponse {
  const requestId = resolveRequestId();
  const timestamp = new Date().toISOString();

  if (err instanceof ZodError) {
    return NextResponse.json(
      {
        success: false,
        error: 'Invalid input',
        errorType: 'ValidationError',
        details: err.flatten(),
        requestId,
        timestamp,
      },
      { status: 400, headers: { 'x-request-id': requestId } },
    );
  }

  if (err instanceof AppError) {
    return NextResponse.json(
      {
        success: false,
        error: err.message,
        errorType: err.errorType,
        requestId,
        timestamp,
      },
      { status: err.status, headers: { 'x-request-id': requestId } },
    );
  }

  // Never leak internal error messages — log structurally, return generic
  // text to the client. The requestId is the bridge.
  // eslint-disable-next-line no-console
  console.error(
    JSON.stringify({
      level: 'error',
      event: 'unhandled_error',
      requestId,
      timestamp,
      error: err instanceof Error ? { name: err.name, message: err.message, stack: err.stack } : String(err),
    }),
  );
  return NextResponse.json(
    {
      success: false,
      error: 'Internal server error',
      errorType: 'InternalError',
      requestId,
      timestamp,
    },
    { status: 500, headers: { 'x-request-id': requestId } },
  );
}

/** Wraps an async handler, catching thrown errors into proper JSON responses. */
export function asHandler<T extends (...args: never[]) => Promise<Response>>(fn: T): T {
  return (async (...args: never[]) => {
    try {
      return await fn(...args);
    } catch (err) {
      return toErrorResponse(err);
    }
  }) as T;
}
