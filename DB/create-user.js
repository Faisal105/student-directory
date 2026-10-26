import { input, password, confirm } from "@inquirer/prompts";
import argon2 from "argon2";
import sql from "mssql";
import { email } from "../backend/validation.js";
import { passwordOptions } from "../backend/app.js";
import { operator } from "./operator.js";
const address = email.parse(await input({ message: "Reviewer email:" }));
const secret = await password({
  message: "Password (15–128 characters):",
  mask: "*",
});
if (secret.length < 15 || secret.length > 128)
  throw new Error("Password must contain 15–128 characters");
const repeated = await password({ message: "Repeat password:", mask: "*" });
if (secret !== repeated) throw new Error("Passwords do not match");
await operator(async (pool) => {
  const existing = (
    await pool
      .request()
      .input("email", sql.NVarChar(100), address)
      .query("SELECT UserId FROM dbo.Users WHERE Email=@email")
  ).recordset[0];
  if (
    existing &&
    !(await confirm({
      message: "Replace this account’s password and revoke all its sessions?",
      default: false,
    }))
  )
    return;
  const hash = await argon2.hash(secret, passwordOptions);
  const tx = new sql.Transaction(pool);
  await tx.begin();
  try {
    const request = new sql.Request(tx)
      .input("email", sql.NVarChar(100), address)
      .input("hash", sql.NVarChar(255), hash);
    if (existing)
      await request
        .input("id", sql.Int, existing.UserId)
        .query(
          "UPDATE dbo.Users SET PasswordHash=@hash,IsActive=1 WHERE UserId=@id; DELETE dbo.Sessions WHERE UserId=@id",
        );
    else
      await request.query(
        "INSERT dbo.Users(Email,PasswordHash) VALUES(@email,@hash)",
      );
    await tx.commit();
    console.log("Reviewer account is ready. Share credentials privately.");
  } catch (error) {
    await tx.rollback().catch(() => {});
    throw error;
  }
});
