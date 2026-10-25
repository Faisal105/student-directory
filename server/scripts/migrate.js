import { readdir, readFile } from "node:fs/promises";
import sql from "mssql";
import { operator } from "./operator.js";
export async function migrate(pool) {
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    await new sql.Request(tx).query(
      "DECLARE @result int; EXEC @result=sp_getapplock @Resource='student_crud_migrations',@LockMode='Exclusive',@LockOwner='Transaction',@LockTimeout=15000; IF @result<0 THROW 50001,'Migration lock unavailable',1;",
    );
    await new sql.Request(tx).query(
      "IF OBJECT_ID('dbo.SchemaMigrations','U') IS NULL CREATE TABLE dbo.SchemaMigrations(Version NVARCHAR(255) PRIMARY KEY, AppliedAt DATETIME2 NOT NULL DEFAULT SYSUTCDATETIME())",
    );
    const done = new Set(
      (
        await new sql.Request(tx).query(
          "SELECT Version FROM dbo.SchemaMigrations",
        )
      ).recordset.map((r) => r.Version),
    );
    for (const file of (await readdir("database/migrations"))
      .filter((f) => f.endsWith(".sql"))
      .sort()) {
      if (done.has(file)) continue;
      await new sql.Request(tx).batch(
        await readFile(`database/migrations/${file}`, "utf8"),
      );
      await new sql.Request(tx)
        .input("version", sql.NVarChar(255), file)
        .query("INSERT dbo.SchemaMigrations(Version) VALUES(@version)");
      console.log(`Applied ${file}`);
    }
    await tx.commit();
  } catch (error) {
    await tx.rollback().catch(() => {});
    throw error;
  }
}
if (process.argv[1]?.endsWith("/migrate.js")) await operator(migrate);
