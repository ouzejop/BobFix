export const ACCESS_TOKEN_TTL = 15 * 60; // seconds
export const REFRESH_TOKEN_TTL_DAYS = 30;
export const JWT_SECRET = process.env.JWT_SECRET ?? "dev-only-secret";
