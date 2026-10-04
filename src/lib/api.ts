export class ApiError extends Error {
  status: number;
  code?: string;
  details?: { retryAfter?: number } | null;

  constructor(status: number, message: string, code?: string, details?: { retryAfter?: number } | null) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export async function api<T>(path: string, init?: RequestInit): Promise<T> {
  let response: Response;
  try {
    response = await fetch(path, {
      ...init,
      headers: {
        ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
        ...init?.headers,
      },
      credentials: 'same-origin',
    });
  } catch {
    throw new ApiError(0, 'Network unavailable.', 'NETWORK');
  }
  const data = (await response.json().catch(() => ({}))) as { error?: string; code?: string; details?: { retryAfter?: number } | null };
  if (!response.ok) {
    throw new ApiError(response.status, data.error || 'Request failed.', data.code, data.details);
  }
  return data as T;
}

export function isNetworkError(error: unknown) {
  return error instanceof ApiError && (error.status === 0 || error.code === 'NETWORK');
}
