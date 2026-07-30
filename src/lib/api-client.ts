/**
 * Every TanStack Query hook in this app calls the API through this one
 * function rather than raw fetch — it's what makes "a 404 shows a 404,
 * a 500 shows a 500, a network failure shows a network failure" true
 * consistently, instead of each hook needing to remember to check
 * res.ok itself. Throws on any non-2xx response with the server's own
 * error message when one was provided, which is what TanStack Query's
 * `error` state actually surfaces to a component.
 */
export class ApiError extends Error {
  readonly status: number;
  readonly issues?: unknown;

  constructor(message: string, status: number, issues?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.issues = issues;
  }
}

export async function apiFetch<T = unknown>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, {
    ...init,
    headers: {
      ...(init?.body ? { "Content-Type": "application/json" } : {}),
      ...init?.headers,
    },
  });

  const contentType = res.headers.get("content-type") ?? "";
  const body = contentType.includes("application/json") ? await res.json().catch(() => null) : null;

  if (!res.ok) {
    throw new ApiError((body?.error as string) ?? `Request failed (${res.status})`, res.status, body?.issues);
  }

  return body as T;
}

export function apiGet<T = unknown>(url: string): Promise<T> {
  return apiFetch<T>(url);
}

export function apiPost<T = unknown>(url: string, data?: unknown): Promise<T> {
  return apiFetch<T>(url, { method: "POST", body: data !== undefined ? JSON.stringify(data) : undefined });
}

export function apiPatch<T = unknown>(url: string, data?: unknown): Promise<T> {
  return apiFetch<T>(url, { method: "PATCH", body: data !== undefined ? JSON.stringify(data) : undefined });
}

export function apiDelete<T = unknown>(url: string): Promise<T> {
  return apiFetch<T>(url, { method: "DELETE" });
}
