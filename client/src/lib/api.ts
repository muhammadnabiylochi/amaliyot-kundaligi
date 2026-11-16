/**
 * Lightweight API client for the backend.
 * In development, Vite proxies /api/* to http://localhost:3001.
 * In production, set VITE_API_BASE_URL (or serve the client from the API server).
 */
export const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

export const NETWORK_ERROR_MESSAGE = "Server bilan aloqa yo'q. Internet aloqasini yoki server ishlayotganini tekshiring.";

interface ApiResponse<T> {
  data: T;
  status: number;
  ok: boolean;
}

export class ApiError extends Error {
  status: number;
  constructor(message: string, status: number) {
    super(message);
    this.status = status;
  }
}

export function authHeaders(): Record<string, string> {
  let token: string | null = null;
  try {
    token = localStorage.getItem('auth_token');
  } catch {
    token = null;
  }
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
  let response: Response;
  try {
    response = await fetch(`${BASE_URL}${path}`, {
      credentials: 'include',
      ...init,
      headers: {
        ...(init?.body instanceof FormData ? {} : { 'Content-Type': 'application/json' }),
        ...authHeaders(),
        ...init?.headers,
      },
    });
  } catch {
    throw new ApiError(NETWORK_ERROR_MESSAGE, 0);
  }

  let data: any = null;
  const type = response.headers.get('content-type') || '';
  if (type.includes('application/json')) {
    data = await response.json().catch(() => null);
  } else if (!response.ok) {
    data = { error: { message: response.status >= 500 ? 'Serverda ichki xatolik yuz berdi.' : `So'rov bajarilmadi (${response.status}).` } };
  }

  return { data: data as T, status: response.status, ok: response.ok };
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: body instanceof FormData ? body : JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};

/** Performs a request and returns `data.data`, throwing ApiError with the server's message on failure. */
export async function apiData<T>(method: 'get' | 'post' | 'patch' | 'delete', path: string, body?: unknown): Promise<T> {
  const res =
    method === 'get' || method === 'delete'
      ? await api[method]<{ data: T; error?: { message: string } }>(path)
      : await api[method]<{ data: T; error?: { message: string } }>(path, body ?? {});
  if (!res.ok) {
    throw new ApiError((res.data as any)?.error?.message || "So'rovni bajarishda xatolik yuz berdi.", res.status);
  }
  return (res.data as any)?.data as T;
}
