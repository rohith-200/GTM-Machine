import { NextResponse } from "next/server";
import type { ApiResponse } from "@/contract/types";

export type ErrorCode = "BAD_REQUEST" | "NOT_FOUND" | "UPSTREAM_FAILED" | "INTERNAL";

const STATUS: Record<ErrorCode, number> = {
  BAD_REQUEST: 400,
  NOT_FOUND: 404,
  UPSTREAM_FAILED: 502,
  INTERNAL: 500,
};

export class ApiError extends Error {
  constructor(public code: ErrorCode, message: string) {
    super(message);
  }
}

export function ok<T>(data: T) {
  return NextResponse.json<ApiResponse<T>>({ ok: true, data });
}

export function fail(code: ErrorCode, message: string) {
  return NextResponse.json<ApiResponse<never>>(
    { ok: false, error: { code, message } },
    { status: STATUS[code] },
  );
}

/** Wrap a handler so any thrown error becomes a contract-shaped error response. */
export function handle<T>(fn: () => Promise<T>) {
  return fn().then(ok, (e: unknown) => {
    if (e instanceof ApiError) return fail(e.code, e.message);
    console.error(e);
    return fail("INTERNAL", e instanceof Error ? e.message : "Unexpected error");
  });
}

export async function readBody<T>(req: Request): Promise<T> {
  try {
    return (await req.json()) as T;
  } catch {
    throw new ApiError("BAD_REQUEST", "Body must be valid JSON");
  }
}

export function requireFields(body: object, fields: string[]) {
  const b = body as Record<string, unknown>;
  const missing = fields.filter((f) => b[f] === undefined || b[f] === null || b[f] === "");
  if (missing.length) throw new ApiError("BAD_REQUEST", `Missing: ${missing.join(", ")}`);
}

export const now = () => new Date().toISOString();
export const newId = (prefix: string) => `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
