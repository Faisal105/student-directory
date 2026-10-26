import sql from "mssql";
import { config } from "./config.js";
import { createStore } from "./store.js";
import { createApp } from "./app.js";
try {
  const settings = config();
  settings.serveUI = process.argv.includes("--serve-ui") || settings.production;
  if (settings.serveUI && !settings.production) {
    settings.origin = `http://localhost:${settings.port}`;
  }
  const pool = new sql.ConnectionPool(settings.db);
  pool.on("error", () => console.error("Database pool error"));
  await pool.connect();
  const app = await createApp({ store: createStore(pool), settings });
  const server = app.listen(settings.port, "0.0.0.0", () =>
    console.log(`Student Directory listening on port ${settings.port}`),
  );
  for (const signal of ["SIGTERM", "SIGINT"])
    process.once(signal, () => {
      server.close(async () => {
        await pool.close();
        process.exit(0);
      });
      setTimeout(() => process.exit(1), 10000).unref();
    });
} catch (error) {
  console.error(
    error.message?.startsWith("Missing database")
      ? error.message
      : "Startup failed. Check database connectivity and environment settings.",
  );
  process.exitCode = 1;
}
