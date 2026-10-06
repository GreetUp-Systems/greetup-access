import { publicEnv } from "../env";

/**
 * An API failure, carried as the response's `code` so screens map it to a state (SPEC-014 §7).
 * `status` 0 means the request never got an HTTP answer (offline, DNS, CORS).
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly body: unknown,
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export interface ApiRequestOptions {
  method?: "GET" | "POST";
  /** The Privy access token; omitted on public endpoints. */
  token?: string | null;
  body?: unknown;
  /** Same key for a repeated attempt, so the API answers the first result (SPEC-005 §9). */
  idempotencyKey?: string;
  signal?: AbortSignal;
}

/** Calls the API straight from the browser with `Authorization: Bearer` (SPEC-014 §7). */
export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { method = "GET", token, body, idempotencyKey, signal } = options;
  const headers: Record<string, string> = { Accept: "application/json" };
  if (token !== undefined && token !== null) {
    headers.Authorization = `Bearer ${token}`;
  }
  if (body !== undefined) {
    headers["Content-Type"] = "application/json";
  }
  if (idempotencyKey !== undefined) {
    headers["Idempotency-Key"] = idempotencyKey;
  }

  let response: Response;
  try {
    response = await fetch(`${publicEnv.apiUrl}${path}`, {
      method,
      headers,
      body: body === undefined ? null : JSON.stringify(body),
      signal: signal ?? null,
      cache: "no-store",
    });
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      throw error;
    }
    throw new ApiError(0, "network_error", "The API could not be reached.", null);
  }

  const payload = await readJson(response);
  if (!response.ok) {
    throw new ApiError(
      response.status,
      stringField(payload, "code") ?? `http_${response.status}`,
      stringField(payload, "message") ?? response.statusText,
      payload,
    );
  }
  return payload as T;
}

async function readJson(response: Response): Promise<unknown> {
  const text = await response.text();
  if (text === "") {
    return null;
  }
  try {
    return JSON.parse(text) as unknown;
  } catch {
    return null;
  }
}

function stringField(payload: unknown, field: string): string | undefined {
  if (typeof payload !== "object" || payload === null) {
    return undefined;
  }
  const value = (payload as Record<string, unknown>)[field];
  return typeof value === "string" ? value : undefined;
}
