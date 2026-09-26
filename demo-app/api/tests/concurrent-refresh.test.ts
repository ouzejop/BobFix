/**
 * Regression test: two tabs refreshing at the same time must both stay logged in.
 * The web client (web/src/lib/apiClient.ts) calls logout() on ANY non-ok /auth/refresh,
 * so a 401 for the second tab is the user-visible bug, not an acceptable outcome.
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

async function login(app: ReturnType<typeof setup>["app"]) {
  const res = await request(app)
    .post("/auth/login")
    .send({ email: "alice@shoply.test", password: "demo1234" });
  expect(res.status).toBe(200);
  return extractRtCookie(res.headers);
}

afterEach(() => {
  vi.useRealTimers();
});

describe("concurrent refresh (two tabs)", () => {
  it("every tab refreshing with the same cookie gets 200 and a usable session", async () => {
    const { app } = setup();
    const rt = await login(app);

    const tabs = await Promise.all([
      request(app).post("/auth/refresh").set("Cookie", rt),
      request(app).post("/auth/refresh").set("Cookie", rt),
      request(app).post("/auth/refresh").set("Cookie", rt),
    ]);

    // No tab may receive the response that makes the client log out.
    expect(tabs.map((r) => r.status)).toEqual([200, 200, 200]);

    for (const tab of tabs) {
      const me = await request(app)
        .get("/me")
        .set("Authorization", `Bearer ${(tab.body as { accessToken: string }).accessToken}`);
      expect(me.status).toBe(200);

      // The rotated cookie each tab received keeps working on the next refresh.
      const next = await request(app).post("/auth/refresh").set("Cookie", extractRtCookie(tab.headers));
      expect(next.status).toBe(200);
    }
  });

  it("replaying a token rotated longer ago than the grace window still revokes the family", async () => {
    const { app } = setup();
    const rt = await login(app);

    const first = await request(app).post("/auth/refresh").set("Cookie", rt);
    expect(first.status).toBe(200);
    const { accessToken } = first.body as { accessToken: string };

    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(Date.now() + 60_000);

    const replay = await request(app).post("/auth/refresh").set("Cookie", rt);
    expect(replay.status).toBe(401);

    const me = await request(app).get("/me").set("Authorization", `Bearer ${accessToken}`);
    expect(me.status).toBe(401);
  });
});
