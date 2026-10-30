import type { ApiResponse } from "@/contract/types";

export class ApiClientError extends Error {
  constructor(
    public readonly code: string,
    message: string,
    public readonly status = 0,
  ) {
    super(message);
    this.name = "ApiClientError";
  }
}

/** The single browser-side boundary for the frozen API response envelope. */
export async function api<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!path.startsWith("/api/")) {
    throw new ApiClientError("INVALID_PATH", "Requests must use a local /api route.");
  }

  const headers = new Headers(init.headers);
  headers.set("Accept", "application/json");
  if (init.body && !headers.has("Content-Type")) headers.set("Content-Type", "application/json");

  let response: Response;
  try {
    response = await fetch(path, { ...init, headers, cache: "no-store" });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") throw error;
    throw new ApiClientError("NETWORK_ERROR", "Could not connect. Check your connection and try again.");
  }

  let payload: ApiResponse<T>;
  try {
    payload = await response.json();
  } catch {
    throw new ApiClientError("INVALID_RESPONSE", "The server returned an unreadable response. Please try again.", response.status);
  }

  if (!payload || typeof payload !== "object" || typeof payload.ok !== "boolean") {
    throw new ApiClientError("INVALID_RESPONSE", "The server returned an unexpected response.", response.status);
  }
  if (!payload.ok) {
    throw new ApiClientError(
      payload.error?.code || "INTERNAL",
      payload.error?.message || "Something went wrong. Please try again.",
      response.status,
    );
  }
  if (!response.ok || !("data" in payload)) {
    throw new ApiClientError("INVALID_RESPONSE", "The server could not complete this request.", response.status);
  }
  return payload.data;
}
