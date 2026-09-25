import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
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

describe("auth", () => {
  it("login ok returns accessToken and sets rt cookie", async () => {
    const { app } = setup();
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "alice@shoply.test", password: "demo1234" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("accessToken");
    expect(res.headers["set-cookie"]).toBeDefined();
  });

  it("login wrong password returns 401", async () => {
    const { app } = setup();
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "alice@shoply.test", password: "wrongpass" });
    expect(res.status).toBe(401);
  });

  it("login unknown email returns 401", async () => {
    const { app } = setup();
    const res = await request(app)
      .post("/auth/login")
      .send({ email: "nobody@shoply.test", password: "demo1234" });
    expect(res.status).toBe(401);
  });

  it("logout returns 204 and clears cookie", async () => {
    const { app } = setup();
    const res = await request(app).post("/auth/logout");
    expect(res.status).toBe(204);
  });
});

describe("protected routes", () => {
  it("/me returns user info with valid token", async () => {
    const { app } = setup();
    const loginRes = await request(app)
      .post("/auth/login")
      .send({ email: "alice@shoply.test", password: "demo1234" });
    const { accessToken } = loginRes.body as { accessToken: string };

    const res = await request(app)
      .get("/me")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(res.body).toMatchObject({ email: "alice@shoply.test", name: "Alice" });
  });

  it("/me returns 401 without token", async () => {
    const { app } = setup();
    const res = await request(app).get("/me");
    expect(res.status).toBe(401);
  });

  it("/orders returns array with valid token", async () => {
    const { app } = setup();
    const loginRes = await request(app)
      .post("/auth/login")
      .send({ email: "alice@shoply.test", password: "demo1234" });
    const { accessToken } = loginRes.body as { accessToken: string };

    const res = await request(app)
      .get("/orders")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("/orders returns 401 without token", async () => {
    const { app } = setup();
    const res = await request(app).get("/orders");
    expect(res.status).toBe(401);
  });

  it("/cart returns array with valid token", async () => {
    const { app } = setup();
    const loginRes = await request(app)
      .post("/auth/login")
      .send({ email: "alice@shoply.test", password: "demo1234" });
    const { accessToken } = loginRes.body as { accessToken: string };

    const res = await request(app)
      .get("/cart")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });

  it("/cart returns 401 without token", async () => {
    const { app } = setup();
    const res = await request(app).get("/cart");
    expect(res.status).toBe(401);
  });
});

describe("refresh rotation", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("refresh rotates token and old token yields 401 after grace window", async () => {
    const { app } = setup();
    const loginRes = await request(app)
      .post("/auth/login")
      .send({ email: "alice@shoply.test", password: "demo1234" });
    const cookies = loginRes.headers["set-cookie"] as string[];
    const rtCookie = cookies.find((c: string) => c.startsWith("rt="));
    expect(rtCookie).toBeDefined();

    const refreshRes = await request(app)
      .post("/auth/refresh")
      .set("Cookie", rtCookie!);
    expect(refreshRes.status).toBe(200);
    expect(refreshRes.body).toHaveProperty("accessToken");

    // Advance time past the concurrent-grace window so the replay is treated
    // as a stale token (theft), not a concurrent sibling.
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 60_000);

    const reuseRes = await request(app)
      .post("/auth/refresh")
      .set("Cookie", rtCookie!);
    expect(reuseRes.status).toBe(401);
  });

  it("refresh without cookie returns 401", async () => {
    const { app } = setup();
    const res = await request(app).post("/auth/refresh");
    expect(res.status).toBe(401);
  });

  it("reusing old token after rotation revokes the family", async () => {
    const { app } = setup();
    const loginRes = await request(app)
      .post("/auth/login")
      .send({ email: "alice@shoply.test", password: "demo1234" });
    const cookies = loginRes.headers["set-cookie"] as string[];
    const originalRtCookie = cookies.find((c: string) => c.startsWith("rt="))!;

    const firstRefreshRes = await request(app)
      .post("/auth/refresh")
      .set("Cookie", originalRtCookie);
    expect(firstRefreshRes.status).toBe(200);

    const newCookies = firstRefreshRes.headers["set-cookie"] as string[];
    const newRtCookie = newCookies.find((c: string) => c.startsWith("rt="))!;

    // Advance time past the concurrent-grace window so the stale replay is
    // treated as theft and revokes the family.
    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 60_000);

    const reuseOldRes = await request(app)
      .post("/auth/refresh")
      .set("Cookie", originalRtCookie);
    expect(reuseOldRes.status).toBe(401);

    const newTokenNowRevokedRes = await request(app)
      .post("/auth/refresh")
      .set("Cookie", newRtCookie);
    expect(newTokenNowRevokedRes.status).toBe(401);
  });

  it("new access token from refresh is valid for /me", async () => {
    const { app } = setup();
    const loginRes = await request(app)
      .post("/auth/login")
      .send({ email: "alice@shoply.test", password: "demo1234" });
    const cookies = loginRes.headers["set-cookie"] as string[];
    const rtCookie = cookies.find((c: string) => c.startsWith("rt="))!;

    const refreshRes = await request(app)
      .post("/auth/refresh")
      .set("Cookie", rtCookie);
    const { accessToken } = refreshRes.body as { accessToken: string };

    const meRes = await request(app)
      .get("/me")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(meRes.status).toBe(200);
    expect(meRes.body).toMatchObject({ email: "alice@shoply.test" });
  });
});
