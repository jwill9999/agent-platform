/** Browser-side calls to the Next.js BFF proxy (`/api/v1/*` → `API_PROXY_URL`). */
export const API_V1_PREFIX = '/api/v1';

export function apiPath(...segments: string[]): string {
  const safe = segments.map((s) => encodeURIComponent(s));
  return `${API_V1_PREFIX}/${safe.join('/')}`;
}

export class ApiRequestError extends Error {
  readonly status: number;
  readonly code?: string;
  readonly details?: unknown;

  constructor(message: string, status: number, code?: string, details?: unknown) {
    super(message);
    this.name = 'ApiRequestError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type Envelope<T> = { data: T };

function parseErrorBody(status: number, body: string): ApiRequestError {
  try {
    const j = JSON.parse(body) as {
      error?: { code?: string; message?: string; details?: unknown };
    };
    const msg = j.error?.message ?? `Request failed (${status})`;
    return new ApiRequestError(msg, status, j.error?.code, j.error?.details);
  } catch {
    return new ApiRequestError(body || `Request failed (${status})`, status);
  }
}

export async function apiGet<T>(path: string): Promise<T | undefined> {
  const res = await fetch(path, { cache: 'no-store' });
  const text = await res.text();
  if (!res.ok) {
    throw parseErrorBody(res.status, text);
  }
  if (!text.trim()) {
    return undefined;
  }
  const json = JSON.parse(text) as Envelope<T>;
  return json.data;
}

export async function apiPost<T>(path: string, body: unknown): Promise<T | undefined> {
  const res = await fetch(path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw parseErrorBody(res.status, text);
  }
  if (!text.trim()) {
    return undefined;
  }
  const json = JSON.parse(text) as Envelope<T>;
  return json.data;
}

export async function apiPut<T>(path: string, body: unknown): Promise<T | undefined> {
  const res = await fetch(path, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  if (!res.ok) {
    throw parseErrorBody(res.status, text);
  }
  if (!text.trim()) {
    return undefined;
  }
  const json = JSON.parse(text) as Envelope<T>;
  return json.data;
}

export async function apiDelete(path: string): Promise<void> {
  const res = await fetch(path, { method: 'DELETE' });
  if (!res.ok) {
    const text = await res.text();
    throw parseErrorBody(res.status, text);
  }
}
