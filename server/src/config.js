export function config(env = process.env, operator = false) {
  const production = env.NODE_ENV === "production";
  const origin = env.APP_ORIGIN || "http://localhost:5173";
  if (
    new URL(origin).origin !== origin ||
    (production && !origin.startsWith("https://"))
  )
    throw new Error("APP_ORIGIN must be an exact origin (HTTPS in production)");
  const user = operator ? env.DB_ADMIN_USER : env.DB_USER;
  const password = operator ? env.DB_ADMIN_PASSWORD : env.DB_PASSWORD;
  if (!env.DB_SERVER || !env.DB_NAME || !user || !password)
    throw new Error(
      `Missing database settings. Configure ${operator ? "DB_ADMIN_USER/DB_ADMIN_PASSWORD" : "DB_USER/DB_PASSWORD"}, DB_SERVER and DB_NAME in .env.`,
    );
  if (production && env.DB_TRUST_CERTIFICATE === "true")
    throw new Error("Certificate bypass is forbidden in production");
  return {
    production,
    origin,
    port: Number(env.PORT || 3000),
    trustProxy: env.TRUST_PROXY === "1" ? 1 : false,
    db: {
      server: env.DB_SERVER,
      port: Number(env.DB_PORT || 1433),
      database: env.DB_NAME,
      user,
      password,
      connectionTimeout: 15000,
      requestTimeout: 15000,
      pool: { max: 5, min: 0, idleTimeoutMillis: 30000 },
      options: {
        encrypt: true,
        trustServerCertificate:
          !production && env.DB_TRUST_CERTIFICATE === "true",
        useUTC: true,
      },
    },
  };
}
