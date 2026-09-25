import { getAccessToken, setAccessToken, logout } from "./session.js";

async function refreshSession(): Promise<boolean> {
  const res = await fetch("/auth/refresh", {
    method: "POST",
    credentials: "include",
  });
  if (!res.ok) return false;
  const data = (await res.json()) as { accessToken: string };
  setAccessToken(data.accessToken);
  return true;
}

export async function api<T>(path: string, options: RequestInit = {}): Promise<T> {
  const token = getAccessToken();
  const res = await fetch(path, {
    ...options,
    credentials: "include",
    headers: {
      ...options.headers,
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
  });

  if (res.status === 401) {
    const refreshed = await refreshSession();
    if (!refreshed) {
      logout();
      throw new Error("Session expired");
    }
    const newToken = getAccessToken();
    const retry = await fetch(path, {
      ...options,
      credentials: "include",
      headers: {
        ...options.headers,
        ...(newToken ? { Authorization: `Bearer ${newToken}` } : {}),
      },
    });
    if (!retry.ok) throw new Error(`Request failed: ${retry.status}`);
    return retry.json() as Promise<T>;
  }

  if (!res.ok) throw new Error(`Request failed: ${res.status}`);
  return res.json() as Promise<T>;
}
