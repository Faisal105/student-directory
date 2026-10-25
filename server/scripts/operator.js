import sql from "mssql";
import { config } from "../src/config.js";
export async function operator(task) {
  let pool;
  try {
    pool = await new sql.ConnectionPool(config(process.env, true).db).connect();
    await task(pool);
  } catch (error) {
    console.error(
      error.message?.startsWith("Missing database")
        ? error.message
        : `Operation failed (${error.code || error.name}). Check configuration and database permissions.`,
    );
    process.exitCode = 1;
  } finally {
    await pool?.close();
  }
}
