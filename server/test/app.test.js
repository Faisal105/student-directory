import { test } from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import argon2 from "argon2";
import { createApp, passwordOptions } from "../src/app.js";
const origin = "http://localhost:5173";
const student = {
  name: "Amina Khan",
  email: "amina@example.com",
  phone: "+971501234567",
  department: "Computer Science",
};
async function fixture() {
  const users = {
    userId: 1,
    email: "reviewer@example.com",
    isActive: true,
    passwordHash: await argon2.hash("A-long-test-password!", passwordOptions),
  };
  const sessions = new Map(),
    students = new Map();
  let next = 1;
  const store = {
    async user(email) {
      return email === users.email ? users : null;
    },
    async addSession(hash, id, expires) {
      sessions.set(hash, { userId: id, email: users.email, expires });
    },
    async session(hash) {
      const s = sessions.get(hash);
      return s && s.expires > Date.now() && users.isActive
        ? { userId: s.userId, email: s.email }
        : null;
    },
    async deleteSession(hash) {
      sessions.delete(hash);
    },
    async list(page, pageSize) {
      return {
        items: [...students.values()],
        total: students.size,
        page,
        pageSize,
      };
    },
    async get(id) {
      return students.get(id);
    },
    async create(s) {
      if ([...students.values()].some((x) => x.email === s.email))
        throw Object.assign(new Error(), { number: 2627 });
      const r = {
        ...s,
        studentId: next++,
        createdDate: new Date().toISOString(),
      };
      students.set(r.studentId, r);
      return r;
    },
    async update(id, s) {
      if (!students.has(id)) return;
      const r = { ...students.get(id), ...s };
      students.set(id, r);
      return r;
    },
    async remove(id) {
      return students.delete(id);
    },
  };
  const app = await createApp({
    store,
    settings: { origin, production: false },
  });
  const agent = request.agent(app);
  const login = () =>
    agent
      .post("/api/auth/login")
      .set("Origin", origin)
      .send({ email: users.email, password: "A-long-test-password!" });
  return { app, agent, login, store, sessions, users };
}
test("authentication protects all student routes and rejects foreign origins", async () => {
  const { app } = await fixture();
  for (const [method, path] of [
    ["get", "/api/students"],
    ["get", "/api/students/1"],
    ["post", "/api/students"],
    ["put", "/api/students/1"],
    ["delete", "/api/students/1"],
  ]) {
    assert.equal(
      (await request(app)[method](path).set("Origin", origin).send({})).status,
      401,
    );
  }
  assert.equal(
    (
      await request(app)
        .post("/api/auth/login")
        .set("Origin", "https://evil.example")
        .send({})
    ).status,
    403,
  );
});
test("login, CRUD, validation, duplicate email and logout", async () => {
  const { agent, login } = await fixture();
  const signed = await login();
  assert.equal(signed.status, 200);
  assert.match(signed.headers["set-cookie"][0], /HttpOnly/);
  assert.match(signed.headers["set-cookie"][0], /SameSite=Lax/);
  assert.equal((await agent.get("/api/auth/me")).status, 200);
  let r = await agent.post("/api/students").set("Origin", origin).send(student);
  assert.equal(r.status, 201);
  const id = r.body.studentId;
  const created = r.body.createdDate;
  assert.equal(
    (await agent.post("/api/students").set("Origin", origin).send(student))
      .status,
    409,
  );
  assert.equal(
    (
      await agent
        .post("/api/students")
        .set("Origin", origin)
        .send({ ...student, studentId: 100 })
    ).status,
    400,
  );
  assert.equal((await agent.get("/api/students/-1")).status, 400);
  assert.equal((await agent.get("/api/students?pageSize=101")).status, 400);
  assert.equal((await agent.get("/api/students")).body.total, 1);
  r = await agent
    .put(`/api/students/${id}`)
    .set("Origin", origin)
    .send({ ...student, name: "O'Brien <script>" });
  assert.equal(r.status, 200);
  assert.equal(r.body.createdDate, created);
  assert.equal(
    (await agent.get(`/api/students/${id}`)).body.name,
    "O'Brien <script>",
  );
  assert.equal(
    (await agent.delete(`/api/students/${id}`).set("Origin", origin).send({}))
      .status,
    204,
  );
  assert.equal((await agent.get(`/api/students/${id}`)).status, 404);
  assert.equal(
    (await agent.post("/api/auth/logout").set("Origin", origin).send({}))
      .status,
    204,
  );
  assert.equal((await agent.get("/api/students")).status, 401);
});
test("failed login limits, session expiry, inactive accounts and session rotation", async () => {
  const { agent, login, sessions, users } = await fixture();
  await login();
  const first = [...sessions.keys()][0];
  await login();
  assert.equal(sessions.has(first), false);
  for (const session of sessions.values()) session.expires = new Date(0);
  assert.equal((await agent.get("/api/auth/me")).status, 401);
  users.isActive = false;
  assert.equal((await login()).status, 401);
  for (let i = 0; i < 5; i++)
    await agent
      .post("/api/auth/login")
      .set("Origin", origin)
      .send({ email: "unknown@example.com", password: "wrong" });
  assert.equal(
    (
      await agent
        .post("/api/auth/login")
        .set("Origin", origin)
        .send({ email: "unknown@example.com", password: "wrong" })
    ).status,
    429,
  );
});
test("malformed JSON and oversized requests have controlled responses", async () => {
  const { app } = await fixture();
  assert.equal(
    (
      await request(app)
        .post("/api/auth/login")
        .set("Origin", origin)
        .set("Content-Type", "application/json")
        .send("{")
    ).status,
    400,
  );
  assert.equal(
    (
      await request(app)
        .post("/api/auth/login")
        .set("Origin", origin)
        .send({ password: "a".repeat(17000) })
    ).status,
    413,
  );
});
