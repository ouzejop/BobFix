export const ACCESS_TOKEN_TTL = 15 * 60; // seconds
export const REFRESH_TOKEN_TTL_DAYS = 30;
export const JWT_SECRET = process.env.JWT_SECRET ?? "dev-only-secret";
/** A refresh token presented again within this window after its rotation comes from a
 *  concurrent sibling request (two tabs), not from theft: the family is not revoked. */
export const CONCURRENT_REFRESH_GRACE_MS = 30_000; // 30 seconds
