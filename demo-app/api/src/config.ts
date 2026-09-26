export const ACCESS_TOKEN_TTL = 15 * 60; // seconds
export const REFRESH_TOKEN_TTL_DAYS = 30;
export const JWT_SECRET = process.env.JWT_SECRET ?? "dev-only-secret";
/** Grace window for concurrent refresh token rotation (ms). Requests that present
 *  an already-rotated token within this window are treated as a legitimate concurrent
 *  refresh race (two tabs), not token theft, so the family is NOT revoked. */
export const CONCURRENT_REFRESH_GRACE_MS = 30_000; // 30 seconds
