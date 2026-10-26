import { readFile } from "node:fs/promises";
import sql from "mssql";
import { config } from "../backend/config.js";

let pool;
try {
  const settings = config(process.env, true);
  const database = settings.db.database;
  if (!/^[A-Za-z][A-Za-z0-9_]{0,127}$/.test(database)) {
    throw new Error("DB_NAME must start with a letter and contain only letters, numbers, and underscores.");
  }

  pool = await new sql.ConnectionPool({ ...settings.db, database: "master" }).connect();
  const exists = await pool.request().input("name", sql.NVarChar(128), database)
    .query("SELECT DB_ID(@name) AS id");
  if (exists.recordset[0].id === null) {
    // The database identifier has been restricted to letters, numbers, and underscores above.
    await pool.request().query(`CREATE DATABASE [${database}]`);
  }
  await pool.close();

  pool = await new sql.ConnectionPool(settings.db).connect();
  const schema = await readFile(new URL("./schema.sql", import.meta.url), "utf8");
  const transaction = new sql.Transaction(pool);
  await transaction.begin();
  try {
    await new sql.Request(transaction).batch(schema);
    await transaction.commit();
  } catch (error) {
    await transaction.rollback().catch(() => {});
    throw error;
  }
  console.log(`Database ${database} and tables are ready. Existing data is preserved.`);
} catch (error) {
  console.error(`Database setup failed (${error.code || error.name}). Check SQL Server, credentials, DB_NAME, and database-creation permissions.`);
  process.exitCode = 1;
} finally {
  await pool?.close();
}
