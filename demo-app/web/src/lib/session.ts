let _accessToken: string | null = null;

export function getAccessToken(): string | null {
  return _accessToken;
}

export function setAccessToken(token: string): void {
  _accessToken = token;
}

export function logout(): void {
  _accessToken = null;
  fetch("/auth/logout", { method: "POST", credentials: "include" }).catch(() => {});
  window.location.href = "/login";
}
