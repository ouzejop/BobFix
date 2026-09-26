/**
 * FROZEN REPRO TEST — do not edit.
 * Bug: Users are randomly logged out after page reload when the browser sends
 *      concurrent POST /auth/refresh requests (two tabs) with the same rt cookie.
 *      One request returns 200 + accessToken, but the access token is immediately
 *      rejected by /me with 401 because revokeFamily() was called by the other
 *      concurrent request, invalidating the newly issued token.
 */
import { describe, it, expect } from "vitest";
import request from "supertest";
import { openDb } from "../../src/db/connection.js";
import { seed } from "../../src/db/seed.js";
import { createApp } from "../../src/app.js";

function setup() {
  const db = openDb(":memory:");
  seed(db);
  const app = createApp(db);
  return { app };
}

function extractRtCookie(headers: Record<string, unknown>): string {
  const cookies = headers["set-cookie"] as string[] | string | undefined;
  if (!cookies) throw new Error("No set-cookie header");
  const arr = Array.isArray(cookies) ? cookies : [cookies];
  const rt = arr.find((c) => c.startsWith("rt="));
  if (!rt) throw new Error("No rt cookie");
  return rt;
}

describe("repro: random logout on concurrent refresh (two-tab page reload)", () => {
  it("access token obtained from a successful /auth/refresh must not be immediately invalidated", async () => {
    const { app } = setup();

    // 1. Login — obtain initial rt cookie
    const loginRes = await request(app)
      .post("/auth/login")
      .send({ email: "alice@shoply.test", password: "demo1234" });
    expect(loginRes.status).toBe(200);
    const rtCookie = extractRtCookie(loginRes.headers);

    // 2. Two tabs reload simultaneously — both fire POST /auth/refresh with the
    //    same rt cookie (access token was expired in the browser, cookie still valid).
    const [tab1, tab2] = await Promise.all([
      request(app).post("/auth/refresh").set("Cookie", rtCookie),
      request(app).post("/auth/refresh").set("Cookie", rtCookie),
    ]);

    // 3. Exactly one of the two must succeed (the other is expected to get 401).
    const winner = [tab1, tab2].find((r) => r.status === 200);
    expect(winner).toBeDefined(); // at least one must succeed

    // 4. The access token returned by the successful refresh MUST be usable.
    //    BUG: without a fix this assertion fails with 401 because revokeFamily()
    //    was called by the losing tab, sweeping the winner's fresh token.
    const { accessToken } = winner!.body as { accessToken: string };
    const meRes = await request(app)
      .get("/me")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(meRes.status).toBe(200); // ← FAILS before fix
  });
});
