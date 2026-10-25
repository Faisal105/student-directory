import express from "express";
import helmet from "helmet";
import cookieParser from "cookie-parser";
import { rateLimit } from "express-rate-limit";
import { randomBytes, createHash, randomUUID } from "node:crypto";
import argon2 from "argon2";
import { ZodError } from "zod";
import { resolve } from "node:path";
import {
  loginSchema,
  studentSchema,
  idSchema,
  paginationSchema,
} from "./validation.js";
export const hashToken = (token) =>
  createHash("sha256").update(token).digest("hex");
export const passwordOptions = {
  type: argon2.argon2id,
  memoryCost: 19456,
  timeCost: 2,
  parallelism: 1,
};
const fail = (res, status, code, message, fields) =>
  res
    .status(status)
    .json({ error: { code, message, ...(fields && { fields }) } });
export async function createApp({ store, settings }) {
  const app = express();
  const dummy = await argon2.hash(randomBytes(32), passwordOptions);
  const cookieName = settings.production ? "__Host-session" : "session";
  const cookieOptions = {
    httpOnly: true,
    secure: settings.production,
    sameSite: "lax",
    path: "/",
  };
  app.disable("x-powered-by");
  app.set("trust proxy", settings.trustProxy || false);
  app.use(
    helmet({
      strictTransportSecurity: settings.production ? undefined : false,
      contentSecurityPolicy: settings.production ? undefined : false,
    }),
  );
  app.use((req, res, next) => {
    req.requestId = randomUUID();
    res.set("X-Request-Id", req.requestId);
    next();
  });
  app.use("/api", (_req, res, next) => {
    res.set("Cache-Control", "no-store");
    next();
  });
  app.use("/api", (req, res, next) => {
    if (!["GET", "HEAD", "OPTIONS"].includes(req.method)) {
      if (req.get("origin") !== settings.origin)
        return fail(res, 403, "FORBIDDEN", "Request origin is not allowed.");
      if (!req.is("application/json"))
        return fail(
          res,
          415,
          "UNSUPPORTED_MEDIA_TYPE",
          "Send application/json.",
        );
    }
    next();
  });
  app.use(express.json({ limit: "16kb" }), cookieParser());
  app.get("/api/health", (_req, res) => res.json({ status: "ok" }));
  const limitHandler = (_req, res) =>
    fail(
      res,
      429,
      "RATE_LIMITED",
      "Too many sign-in attempts. Try again in 15 minutes.",
    );
  const ipLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 40,
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: limitHandler,
  });
  const accountLimit = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: 5,
    skipSuccessfulRequests: true,
    keyGenerator: (req) => hashToken(req.login.email),
    standardHeaders: "draft-8",
    legacyHeaders: false,
    handler: limitHandler,
  });
  app.post(
    "/api/auth/login",
    ipLimit,
    (req, _res, next) => {
      req.login = loginSchema.parse(req.body);
      next();
    },
    accountLimit,
    async (req, res) => {
      const user = await store.user(req.login.email);
      const valid = await argon2.verify(
        user?.passwordHash || dummy,
        req.login.password,
      );
      if (!valid || !user?.isActive)
        return fail(
          res,
          401,
          "INVALID_CREDENTIALS",
          "Email or password is incorrect.",
        );
      if (typeof req.cookies[cookieName] === "string")
        await store.deleteSession(hashToken(req.cookies[cookieName]));
      const token = randomBytes(32).toString("base64url");
      await store.addSession(
        hashToken(token),
        user.userId,
        new Date(Date.now() + 8 * 60 * 60 * 1000),
      );
      res
        .cookie(cookieName, token, {
          ...cookieOptions,
          maxAge: 8 * 60 * 60 * 1000,
        })
        .json({ user: { userId: user.userId, email: user.email } });
    },
  );
  const requireAuth = async (req, res, next) => {
    const token = req.cookies[cookieName];
    const user =
      typeof token === "string" && /^[\w-]{43}$/.test(token)
        ? await store.session(hashToken(token))
        : null;
    if (!user)
      return fail(res, 401, "UNAUTHENTICATED", "Please sign in to continue.");
    req.user = user;
    next();
  };
  app.get("/api/auth/me", requireAuth, (req, res) =>
    res.json({ user: req.user }),
  );
  app.post("/api/auth/logout", async (req, res) => {
    if (typeof req.cookies[cookieName] === "string")
      await store.deleteSession(hashToken(req.cookies[cookieName]));
    res.clearCookie(cookieName, cookieOptions).sendStatus(204);
  });
  app.use("/api/students", requireAuth);
  app.get("/api/students", async (req, res) => {
    const { page, pageSize } = paginationSchema.parse(req.query);
    res.json(await store.list(page, pageSize));
  });
  app.get("/api/students/:id", async (req, res) => {
    const student = await store.get(idSchema.parse(req.params.id));
    if (!student) return fail(res, 404, "NOT_FOUND", "Student not found.");
    res.json(student);
  });
  app.post("/api/students", async (req, res) => {
    const student = await store.create(studentSchema.parse(req.body));
    res
      .status(201)
      .location(`/api/students/${student.studentId}`)
      .json(student);
  });
  app.put("/api/students/:id", async (req, res) => {
    const student = await store.update(
      idSchema.parse(req.params.id),
      studentSchema.parse(req.body),
    );
    if (!student) return fail(res, 404, "NOT_FOUND", "Student not found.");
    res.json(student);
  });
  app.delete("/api/students/:id", async (req, res) => {
    if (!(await store.remove(idSchema.parse(req.params.id))))
      return fail(res, 404, "NOT_FOUND", "Student not found.");
    res.sendStatus(204);
  });
  app.use("/api", (_req, res) =>
    fail(res, 404, "NOT_FOUND", "Endpoint not found."),
  );
  if (settings.production) {
    app.use(express.static(resolve("client/dist")));
    app.get("/{*path}", (_req, res) =>
      res.sendFile(resolve("client/dist/index.html")),
    );
  }
  app.use((error, req, res, _next) => {
    if (error instanceof ZodError)
      return fail(
        res,
        400,
        "VALIDATION_ERROR",
        "Check the entered values.",
        Object.fromEntries(
          error.issues.map((i) => [i.path.join(".") || "form", i.message]),
        ),
      );
    if (error.type === "entity.parse.failed")
      return fail(res, 400, "INVALID_JSON", "Invalid JSON body.");
    if (error.type === "entity.too.large")
      return fail(res, 413, "BODY_TOO_LARGE", "Request is too large.");
    if ([2601, 2627].includes(error.number))
      return fail(
        res,
        409,
        "DUPLICATE_EMAIL",
        "A student with this email already exists.",
        { email: "This email is already in use." },
      );
    const unavailable =
      ["ETIMEOUT", "ESOCKET", "ECONNCLOSED", "ENOTOPEN", "ELOGIN"].includes(
        error.code,
      ) || error.name === "ConnectionError";
    console.error(
      JSON.stringify({
        requestId: req.requestId,
        code: error.code || "INTERNAL_ERROR",
      }),
    );
    fail(
      res,
      unavailable ? 503 : 500,
      unavailable ? "UNAVAILABLE" : "INTERNAL_ERROR",
      unavailable
        ? "Database unavailable. Please try again shortly."
        : "Something went wrong. Please try again.",
    );
  });
  return app;
}
