import sql from "mssql";
import { operator } from "./operator.js";
await operator(async (pool) => {
  for (const [name, email, phone, department] of [
    ["Amina Khan", "amina@example.com", "+971501234567", "Computer Science"],
    [
      "Omar Hassan",
      "omar@example.com",
      "+971501234568",
      "Business Administration",
    ],
    ["Sara Ahmed", "sara@example.com", "+971501234569", "Design"],
  ]) {
    await pool
      .request()
      .input("name", sql.NVarChar(100), name)
      .input("email", sql.NVarChar(100), email)
      .input("phone", sql.NVarChar(20), phone)
      .input("department", sql.NVarChar(50), department)
      .query(
        "IF NOT EXISTS(SELECT 1 FROM dbo.Students WHERE Email=@email) INSERT dbo.Students(Name,Email,Phone,Department) VALUES(@name,@email,@phone,@department)",
      );
  }
  console.log("Synthetic seed records added; existing records preserved.");
});
