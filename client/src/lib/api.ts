/**
 * Lightweight API client for the backend.
 * In development, Vite proxies /api/* to http://localhost:3001.
 * In production, set VITE_API_BASE_URL.
 */
const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

interface ApiResponse<T> {
  data: T;
  status: number;
  ok: boolean;
}

async function request<T>(path: string, init?: RequestInit): Promise<ApiResponse<T>> {
  const url = `${BASE_URL}${path}`;

  const token = typeof window !== 'undefined' ? localStorage.getItem('auth_token') : null;

  const authHeaders: Record<string, string> = {};
  if (token) {
    authHeaders['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    credentials: 'include', // Includes HttpOnly cookies
    headers: {
      'Content-Type': 'application/json',
      ...authHeaders,
      ...init?.headers,
    },
    ...init,
  });

  const data = (await response.json()) as T;

  return {
    data,
    status: response.status,
    ok: response.ok,
  };
}

export const api = {
  get: <T>(path: string) => request<T>(path),
  post: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown) =>
    request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string) => request<T>(path, { method: 'DELETE' }),
};
