import { migrate } from "drizzle-orm/better-sqlite3/migrator";
import request from "supertest";
import { beforeAll, beforeEach, describe, expect, it } from "vitest";
import { app } from "../../app";
import { db } from "../../db";
import { sessions, users } from "../../db/schema";

const VALID = {
  email: "user@example.com",
  password: "Abcdef1!",
  tosAccepted: true,
};

beforeAll(() => {
  migrate(db, { migrationsFolder: "./drizzle" });
});

beforeEach(() => {
  db.delete(sessions).run();
  db.delete(users).run();
});

describe("POST /auth/signup", () => {
  it("rejects an invalid password with 400 and field errors", async () => {
    const res = await request(app)
      .post("/auth/signup")
      .send({ ...VALID, password: "weak" });

    expect(res.status).toBe(400);
    expect(res.body.errors.password).toBeDefined();
  });

  it("rejects when Terms of Service not accepted", async () => {
    const res = await request(app)
      .post("/auth/signup")
      .send({ ...VALID, tosAccepted: false });

    expect(res.status).toBe(400);
    expect(res.body.errors.tosAccepted).toBeDefined();
  });

  it("creates a user, returns 201 + user, and sets an HttpOnly session cookie", async () => {
    const res = await request(app).post("/auth/signup").send(VALID);

    expect(res.status).toBe(201);
    expect(res.body.user).toMatchObject({ email: VALID.email });
    expect(res.body.user.passwordHash).toBeUndefined(); // never leak the hash

    const cookie = res.headers["set-cookie"][0];
    expect(cookie).toMatch(/session=/);
    expect(cookie).toMatch(/HttpOnly/);
    expect(cookie).toMatch(/SameSite=Strict/);
  });

  it("rejects a duplicate email with 409", async () => {
    await request(app).post("/auth/signup").send(VALID);
    const res = await request(app).post("/auth/signup").send(VALID);

    expect(res.status).toBe(409);
  });

  it("stores the email lowercased (case-insensitive)", async () => {
    await request(app)
      .post("/auth/signup")
      .send({ ...VALID, email: "USER@Example.COM" });
    const stored = db.select().from(users).get();

    expect(stored?.email).toBe("user@example.com");
  });
});

describe("POST /auth/signin", () => {
  beforeEach(async () => {
    await request(app).post("/auth/signup").send(VALID);
  });

  it("returns 200 + cookie for correct credentials", async () => {
    const res = await request(app)
      .post("/auth/signin")
      .send({ email: VALID.email, password: VALID.password });

    expect(res.status).toBe(200);
    expect(res.body.user).toMatchObject({ email: VALID.email });
    expect(res.headers["set-cookie"][0]).toMatch(/session=/);
  });

  it("returns a generic 401 for a wrong password", async () => {
    const res = await request(app)
      .post("/auth/signin")
      .send({ email: VALID.email, password: "WrongPw9!" });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Incorrect email or password.");
  });

  it("returns the same generic 401 for an unknown email (no user enumeration)", async () => {
    const res = await request(app)
      .post("/auth/signin")
      .send({ email: "nobody@example.com", password: VALID.password });

    expect(res.status).toBe(401);
    expect(res.body.error).toBe("Incorrect email or password.");
  });
});

describe("GET /auth/me", () => {
  it("returns 401 without a session cookie", async () => {
    const res = await request(app).get("/auth/me");
    expect(res.status).toBe(401);
  });

  it("returns the user's email with a valid session cookie", async () => {
    const agent = request.agent(app);
    await agent.post("/auth/signup").send(VALID);

    const res = await agent.get("/auth/me");

    expect(res.status).toBe(200);
    expect(res.body.email).toBe(VALID.email);
  });
});

describe("POST /auth/signout", () => {
  it("clears the session: 204, and /me is 401 afterward", async () => {
    const agent = request.agent(app);
    await agent.post("/auth/signup").send(VALID);

    const out = await agent.post("/auth/signout");
    expect(out.status).toBe(204);

    const me = await agent.get("/auth/me");
    expect(me.status).toBe(401);

    expect(db.select().from(sessions).all()).toHaveLength(0);
  });
});
