import { API_BASE_URL } from './config';

export class ApiError extends Error {
  status: number;
  code: string;
  constructor(status: number, code: string, message: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

let authToken: string | null = null;
let onUnauthorized: (() => void) | null = null;

export function setAuthToken(token: string | null) {
  authToken = token;
}

export function setUnauthorizedHandler(handler: (() => void) | null) {
  onUnauthorized = handler;
}

export interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Attach the bearer token when signed in (default true). */
  auth?: boolean;
  timeoutMs?: number;
  signal?: AbortSignal;
}

const FRIENDLY: Record<number, string> = {
  401: 'Please sign in to continue.',
  404: 'We couldn’t find that.',
  429: 'Too many attempts. Please wait a minute and try again.',
};

export async function api<T>(path: string, opts: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, auth = true, timeoutMs = 20000, signal } = opts;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const abort = () => controller.abort();
  signal?.addEventListener('abort', abort);

  const headers: Record<string, string> = {
    Accept: 'application/json',
    'X-CNM-Client': 'mobile',
  };
  if (body !== undefined) headers['Content-Type'] = 'application/json';
  if (auth && authToken) headers.Authorization = `Bearer ${authToken}`;

  const url = /^https?:\/\//.test(path) ? path : `${API_BASE_URL}${path.startsWith('/') ? '' : '/'}${path}`;

  let res: Response;
  try {
    res = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (e) {
    const aborted = (e as Error)?.name === 'AbortError';
    if (aborted && signal?.aborted) throw e;
    throw new ApiError(0, aborted ? 'timeout' : 'network', aborted ? 'The request timed out. Please try again.' : 'You appear to be offline. Please check your connection.');
  } finally {
    clearTimeout(timer);
    signal?.removeEventListener('abort', abort);
  }

  const text = await res.text();
  let data: unknown = null;
  if (text) {
    try {
      data = JSON.parse(text);
    } catch {
      data = null;
    }
  }

  if (!res.ok) {
    const err = (data ?? {}) as { error?: string; message?: string };
    if (res.status === 401 && auth && authToken) onUnauthorized?.();
    throw new ApiError(res.status, err.error ?? `http_${res.status}`, err.message ?? FRIENDLY[res.status] ?? 'Something went wrong. Please try again.');
  }
  return data as T;
}

export function errorMessage(e: unknown): string {
  if (e instanceof ApiError) return e.message;
  if (e instanceof Error) return e.message;
  return 'Something went wrong. Please try again.';
}
