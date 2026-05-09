import { NextResponse } from 'next/server';
import { randomUUID } from 'node:crypto';

export type ApiSuccess<T> = {
  success: true;
  data: T;
  timestamp: string;
};

export type ApiError = {
  success: false;
  error: string;
  errorType?: string;
  requestId: string;
  timestamp: string;
};

export function ok<T>(data: T, init?: ResponseInit): NextResponse<ApiSuccess<T>> {
  return NextResponse.json<ApiSuccess<T>>(
    { success: true, data, timestamp: new Date().toISOString() },
    init,
  );
}

export function fail(
  error: string,
  options: { status?: number; errorType?: string; requestId?: string } = {},
): NextResponse<ApiError> {
  const { status = 500, errorType, requestId = randomUUID() } = options;
  return NextResponse.json<ApiError>(
    {
      success: false,
      error,
      errorType,
      requestId,
      timestamp: new Date().toISOString(),
    },
    { status },
  );
}
