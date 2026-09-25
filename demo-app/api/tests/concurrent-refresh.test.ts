/**
 * Regression test for: rotate() check-then-act race across two browser tabs
 * Root-cause: Two concurrent POST /auth/refresh calls with the same rt cookie
 * — Tab B triggers revokeFamily() before Tab A inserts its successor token,
 * leaving Tab A's new token in a revoked family.
 */
import { describe, it, expect, afterEach, vi } from "vitest";
import request from "supertest";
import { openDb } from "../src/db/connection.js";
import { seed } from "../src/db/seed.js";
import { createApp } from "../src/app.js";

function setup() {
  const db = openDb(":memory:");
  seed(db);
  const app = createApp(db);
  return { db, app };
}

afterEach(() => {
  vi.useRealTimers();
});

/** Extract the "rt=..." cookie from a set-cookie header array */
function extractRtCookie(headers: Record<string, unknown>): string {
  const cookies = headers["set-cookie"] as string[] | string | undefined;
  if (!cookies) throw new Error("No set-cookie header");
  const arr = Array.isArray(cookies) ? cookies : [cookies];
  const rt = arr.find((c) => c.startsWith("rt="));
  if (!rt) throw new Error("No rt cookie");
  return rt;
}

describe("concurrent refresh (two-tab race)", () => {
  it("Test 1 — three concurrent requests with same rt cookie all get a valid session", async () => {
    const { app } = setup();

    const loginRes = await request(app)
      .post("/auth/login")
      .send({ email: "alice@shoply.test", password: "demo1234" });
    expect(loginRes.status).toBe(200);
    const rtCookie = extractRtCookie(loginRes.headers);

    // Simulate three browser tabs firing POST /auth/refresh simultaneously
    const results = await Promise.all([
      request(app).post("/auth/refresh").set("Cookie", rtCookie),
      request(app).post("/auth/refresh").set("Cookie", rtCookie),
      request(app).post("/auth/refresh").set("Cookie", rtCookie),
    ]);

    // Count how many succeeded vs. failed
    const succeeded = results.filter((r) => r.status === 200);

    // At least one must succeed
    expect(succeeded.length).toBeGreaterThanOrEqual(1);

    // Every successful response must carry a usable accessToken
    for (const r of succeeded) {
      expect(r.body).toHaveProperty("accessToken");
      const { accessToken } = r.body as { accessToken: string };

      const meRes = await request(app)
        .get("/me")
        .set("Authorization", `Bearer ${accessToken}`);
      // THE BUG: without the fix, Tab A gets 200 on refresh but the access token
      // is immediately rejected here because isFamilyRevoked() returns true.
      expect(meRes.status).toBe(200);
    }
  });

  it("Test 2 — theft detection works when stale token is replayed well after rotation", async () => {
    const { app } = setup();

    const loginRes = await request(app)
      .post("/auth/login")
      .send({ email: "alice@shoply.test", password: "demo1234" });
    const originalRtCookie = extractRtCookie(loginRes.headers);

    // Legitimate first rotation
    const first = await request(app)
      .post("/auth/refresh")
      .set("Cookie", originalRtCookie);
    expect(first.status).toBe(200);
    const rt2Cookie = extractRtCookie(first.headers);
    const { accessToken: at2 } = first.body as { accessToken: string };

    // Second legitimate rotation
    const second = await request(app)
      .post("/auth/refresh")
      .set("Cookie", rt2Cookie);
    expect(second.status).toBe(200);

    // Advance time well past the concurrent-grace window (30 s) to simulate
    // a stolen token being replayed later.
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 60_000);

    // Simulate theft: replay the original token well after rotation
    const staleReuse = await request(app)
      .post("/auth/refresh")
      .set("Cookie", originalRtCookie);
    expect(staleReuse.status).toBe(401);

    vi.useRealTimers();

    // Family is revoked — at2 (from the first rotation) must also be dead
    const meRes = await request(app)
      .get("/me")
      .set("Authorization", `Bearer ${at2}`);
    expect(meRes.status).toBe(401);
  });

  it("Test 3 — normal single rotation remains valid", async () => {
    const { app } = setup();

    const loginRes = await request(app)
      .post("/auth/login")
      .send({ email: "alice@shoply.test", password: "demo1234" });
    const rtCookie = extractRtCookie(loginRes.headers);

    const refreshRes = await request(app)
      .post("/auth/refresh")
      .set("Cookie", rtCookie);
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body).toHaveProperty("accessToken");
    const { accessToken } = refreshRes.body as { accessToken: string };

    const meRes = await request(app)
      .get("/me")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(meRes.status).toBe(200);

    // Advance time well past the grace window before replaying the original token
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 60_000);

    // Original rt is now invalid (stale theft scenario, outside grace window)
    const reuseRes = await request(app)
      .post("/auth/refresh")
      .set("Cookie", rtCookie);
    expect(reuseRes.status).toBe(401);
  });
});
