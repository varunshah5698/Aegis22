import { NextResponse } from "next/server";
import type { ZodError } from "zod";

export interface ApiMeta {
  requestId: string;
  [key: string]: unknown;
}

export interface ApiError {
  code: string;
  message: string;
  details?: unknown;
}

export interface ApiEnvelope<T> {
  data: T | null;
  error: ApiError | null;
  meta: ApiMeta;
}

export function requestId(): string {
  return crypto.randomUUID();
}

export function ok<T>(
  data: T,
  init: { meta?: Record<string, unknown>; status?: number; headers?: HeadersInit } = {},
) {
  const body: ApiEnvelope<T> = {
    data,
    error: null,
    meta: { requestId: requestId(), ...init.meta },
  };
  return NextResponse.json(body, {
    status: init.status ?? 200,
    ...(init.headers ? { headers: init.headers } : {}),
  });
}

export function fail(
  code: string,
  message: string,
  options: { status?: number; details?: unknown; headers?: HeadersInit; meta?: Record<string, unknown> } = {},
) {
  const body: ApiEnvelope<never> = {
    data: null,
    error: { code, message, ...(options.details === undefined ? {} : { details: options.details }) },
    meta: { requestId: requestId(), ...options.meta },
  };
  return NextResponse.json(body, {
    status: options.status ?? 400,
    ...(options.headers ? { headers: options.headers } : {}),
  });
}

export function validationError(error: ZodError) {
  return fail("validation_error", "The request body did not pass validation.", {
    status: 422,
    details: error.flatten(),
  });
}

export function fromSupabaseError(error: { code?: string; message: string }, status = 400) {
  return fail(error.code ?? "database_error", error.message, { status });
}
