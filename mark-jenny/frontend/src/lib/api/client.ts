// Static builds call the edge API directly; desktop/self-hosted deployments can
// override it through NEXT_PUBLIC_API_URL.
export const API_BASE = process.env.NEXT_PUBLIC_API_URL || 'https://mark-imti-api.kevin-clientmanager.workers.dev/api/v1';

class ApiError extends Error {
  constructor(public status: number, message: string, public data?: unknown) {
    super(message);
    this.name = 'ApiError';
  }
}

async function request<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  const url = `${API_BASE}${endpoint}`;
  
  const headers: HeadersInit = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
  if (token) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${token}`;
  }

  const response = await fetch(url, {
    ...options,
    headers,
    credentials: 'include',
  });

  if (!response.ok) {
    const raw = await response.text().catch(() => "");
    let message = raw || `Request failed (${response.status})`;
    try {
      const parsed = JSON.parse(raw);
      const detail = (parsed as any)?.detail ?? (parsed as any)?.message;
      message = typeof detail === "string" ? detail : detail ? JSON.stringify(detail) : message;
    } catch {
      message = raw.slice(0, 300) || message;
    }
    throw new ApiError(response.status, message, raw);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json();
}

export const api = {
  get: <T>(endpoint: string) => request<T>(endpoint, { method: 'GET' }),
  post: <T>(endpoint: string, data: unknown) => request<T>(endpoint, {
    method: 'POST',
    body: JSON.stringify(data),
  }),
  patch: <T>(endpoint: string, data: unknown) => request<T>(endpoint, {
    method: 'PATCH',
    body: JSON.stringify(data),
  }),
  delete: <T>(endpoint: string) => request<T>(endpoint, { method: 'DELETE' }),
  put: <T>(endpoint: string, data: unknown) => request<T>(endpoint, {
    method: 'PUT',
    body: JSON.stringify(data),
  }),
};

export { ApiError };
