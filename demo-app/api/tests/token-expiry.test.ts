import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import request from "supertest";
import { SignJWT } from "jose";
import { openDb } from "../src/db/connection.js";
import { seed } from "../src/db/seed.js";
import { createApp } from "../src/app.js";
import { JWT_SECRET } from "../src/config.js";

function setup() {
  const db = openDb(":memory:");
  seed(db);
  const app = createApp(db);
  return { db, app };
}

const secretBytes = new TextEncoder().encode(JWT_SECRET);

async function makeExpiredToken(userId: number, familyId: string): Promise<string> {
  const nowSeconds = Math.floor(Date.now() / 1000);
  return new SignJWT({ sub: String(userId), fid: familyId })
    .setProtectedHeader({ alg: "HS256" })
    .setExpirationTime(nowSeconds - 1)
    .sign(secretBytes);
}

describe("token expiry", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("expired access token is rejected with 401", async () => {
    const { app } = setup();
    const loginRes = await request(app)
      .post("/auth/login")
      .send({ email: "alice@shoply.test", password: "demo1234" });
    expect(loginRes.status).toBe(200);
    const { accessToken } = loginRes.body as { accessToken: string };

    vi.useFakeTimers();
    vi.setSystemTime(Date.now() + 16 * 60 * 1000);

    const res = await request(app)
      .get("/me")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(res.status).toBe(401);
  });

  it("TTL is measured in seconds: token valid at 14m59s, expired at 15m01s", async () => {
    const { app } = setup();
    const loginRes = await request(app)
      .post("/auth/login")
      .send({ email: "alice@shoply.test", password: "demo1234" });
    const { accessToken } = loginRes.body as { accessToken: string };
    const loginTime = Date.now();

    vi.useFakeTimers();
    vi.setSystemTime(loginTime + (15 * 60 - 1) * 1000);

    const res1 = await request(app)
      .get("/me")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(res1.status).toBe(200);

    vi.setSystemTime(loginTime + (15 * 60 + 6) * 1000);

    const res2 = await request(app)
      .get("/me")
      .set("Authorization", `Bearer ${accessToken}`);
    expect(res2.status).toBe(401);
  });

  it("pre-built expired token is rejected", async () => {
    const { app, db } = setup();
    const user = db
      .prepare<[string], { id: number }>("SELECT id FROM users WHERE email = ?")
      .get("alice@shoply.test")!;

    const token = await makeExpiredToken(user.id, "fake-family-id");

    const res = await request(app)
      .get("/me")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(401);
  });
});
