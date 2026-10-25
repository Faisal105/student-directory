// One-time local SQL Server setup. Never prints generated passwords.
import { randomBytes } from "node:crypto";
import { writeFile, readFile, chmod } from "node:fs/promises";
import { execFileSync } from "node:child_process";
import { setTimeout } from "node:timers/promises";
import sql from "mssql";
import argon2 from "argon2";
import { migrate } from "./migrate.js";
import { passwordOptions } from "../src/app.js";
const context = "colima-student-sql";
const secret = () => `S!${randomBytes(24).toString("base64url")}9a`;
let env;
try {
  env = await readFile(".env", "utf8");
} catch (error) {
  if (error.code !== "ENOENT") throw error;
  const admin = secret(),
    app = secret();
  env = `NODE_ENV=development\nPORT=3000\nAPP_ORIGIN=http://localhost:5173\nDB_SERVER=127.0.0.1\nDB_PORT=1433\nDB_NAME=student_crud_dev\nDB_USER=student_app_user\nDB_PASSWORD=${app}\nDB_ADMIN_USER=sa\nDB_ADMIN_PASSWORD=${admin}\nDB_TRUST_CERTIFICATE=true\nTRUST_PROXY=false\n`;
  await writeFile(".env", env, { flag: "wx", mode: 0o600 });
}
const values = Object.fromEntries(
  env
    .trim()
    .split("\n")
    .map((line) => line.split(/=(.*)/s).slice(0, 2)),
);
if (
  values.DB_SERVER !== "127.0.0.1" ||
  values.DB_NAME !== "student_crud_dev" ||
  values.DB_ADMIN_USER !== "sa"
)
  throw new Error(
    "Local setup only accepts the dedicated local database configuration",
  );
await writeFile(
  ".env.sqlserver",
  `ACCEPT_EULA=Y\nMSSQL_PID=Developer\nMSSQL_SA_PASSWORD=${values.DB_ADMIN_PASSWORD}\n`,
  { mode: 0o600 },
);
await chmod(".env.sqlserver", 0o600);
const docker = (args) =>
  execFileSync("docker", ["--context", context, ...args], { stdio: "inherit" });
let exists = false;
try {
  execFileSync(
    "docker",
    ["--context", context, "container", "inspect", "student-sql"],
    { stdio: "ignore" },
  );
  exists = true;
} catch {
  /* new container */
}
if (exists) docker(["start", "student-sql"]);
else
  docker([
    "run",
    "-d",
    "--name",
    "student-sql",
    "--platform",
    "linux/amd64",
    "--restart",
    "unless-stopped",
    "-p",
    "127.0.0.1:1433:1433",
    "--env-file",
    ".env.sqlserver",
    "-v",
    "student-sql-data:/var/opt/mssql",
    "mcr.microsoft.com/mssql/server:2022-latest",
  ]);
const connection = {
  server: "127.0.0.1",
  port: 1433,
  user: "sa",
  password: values.DB_ADMIN_PASSWORD,
  connectionTimeout: 5000,
  requestTimeout: 60000,
  options: { encrypt: true, trustServerCertificate: true, useUTC: true },
};
let pool;
console.log(
  "Waiting for local SQL Server (emulation can take several minutes)…",
);
for (let attempt = 0; attempt < 90; attempt++) {
  const candidate = new sql.ConnectionPool({
    ...connection,
    database: "master",
  });
  candidate.on("error", () => {});
  try {
    pool = await candidate.connect();
    break;
  } catch {
    await candidate.close().catch(() => {});
    await setTimeout(5000);
  }
}
if (!pool)
  throw new Error(
    "SQL Server did not become ready. Inspect docker logs student-sql.",
  );
await pool
  .request()
  .query(
    "IF DB_ID('student_crud_dev') IS NULL CREATE DATABASE student_crud_dev",
  );
// Identifiers are fixed and generated secrets are escaped for SQL Server DDL.
const escaped = values.DB_PASSWORD.replaceAll("'", "''");
await pool
  .request()
  .query(
    `IF NOT EXISTS(SELECT 1 FROM sys.server_principals WHERE name='student_app_user') CREATE LOGIN student_app_user WITH PASSWORD='${escaped}', CHECK_POLICY=ON`,
  );
await pool.close();
pool = await new sql.ConnectionPool({
  ...connection,
  database: "student_crud_dev",
}).connect();
try {
  await migrate(pool);
  await pool
    .request()
    .query(
      "IF NOT EXISTS(SELECT 1 FROM sys.database_principals WHERE name='student_app_user') BEGIN CREATE USER student_app_user FOR LOGIN student_app_user; ALTER ROLE student_app ADD MEMBER student_app_user; END",
    );
  let credentials;
  try {
    credentials = JSON.parse(await readFile(".env.local-login.json", "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    credentials = { email: "reviewer@example.com", password: secret() };
    await writeFile(
      ".env.local-login.json",
      JSON.stringify(credentials, null, 2) + "\n",
      { mode: 0o600, flag: "wx" },
    );
  }
  const hash = await argon2.hash(credentials.password, passwordOptions);
  await pool
    .request()
    .input("email", sql.NVarChar(100), credentials.email)
    .input("hash", sql.NVarChar(255), hash)
    .query(
      "IF NOT EXISTS(SELECT 1 FROM dbo.Users WHERE Email=@email) INSERT dbo.Users(Email,PasswordHash) VALUES(@email,@hash)",
    );
  const result = await pool
    .request()
    .query(
      "SELECT COLUMN_NAME,DATA_TYPE,CHARACTER_MAXIMUM_LENGTH FROM INFORMATION_SCHEMA.COLUMNS WHERE TABLE_NAME='Students' ORDER BY ORDINAL_POSITION",
    );
  console.table(result.recordset);
  console.log(
    "Local database, student table, app user and reviewer account are ready. Login details: .env.local-login.json (private, ignored by Git).",
  );
} finally {
  await pool.close();
}
