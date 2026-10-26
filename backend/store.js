import sql from "mssql";
const columns =
  "StudentId AS studentId, Name AS name, Email AS email, Phone AS phone, Department AS department, CreatedDate AS createdDate";
const outputColumns = columns.replace(
  /\b(StudentId|Name|Email|Phone|Department|CreatedDate)\b/g,
  "INSERTED.$1",
);
export function createStore(pool) {
  const fields = (r, s) =>
    r
      .input("name", sql.NVarChar(100), s.name)
      .input("email", sql.NVarChar(100), s.email)
      .input("phone", sql.NVarChar(20), s.phone)
      .input("department", sql.NVarChar(50), s.department);
  return {
    async user(email) {
      return (
        await pool
          .request()
          .input("email", sql.NVarChar(100), email)
          .query(
            "SELECT UserId AS userId, Email AS email, PasswordHash AS passwordHash, IsActive AS isActive FROM dbo.Users WHERE Email=@email",
          )
      ).recordset[0];
    },
    async addSession(hash, userId, expires) {
      await pool
        .request()
        .input("hash", sql.Char(64), hash)
        .input("id", sql.Int, userId)
        .input("expires", sql.DateTime2, expires)
        .query(
          "DELETE TOP (100) FROM dbo.Sessions WHERE ExpiresAt <= SYSUTCDATETIME(); INSERT dbo.Sessions(TokenHash,UserId,ExpiresAt) VALUES(@hash,@id,@expires)",
        );
    },
    async session(hash) {
      return (
        await pool
          .request()
          .input("hash", sql.Char(64), hash)
          .query(
            "SELECT u.UserId AS userId,u.Email AS email FROM dbo.Sessions s JOIN dbo.Users u ON u.UserId=s.UserId WHERE s.TokenHash=@hash AND s.ExpiresAt>SYSUTCDATETIME() AND u.IsActive=1",
          )
      ).recordset[0];
    },
    async deleteSession(hash) {
      await pool
        .request()
        .input("hash", sql.Char(64), hash)
        .query("DELETE dbo.Sessions WHERE TokenHash=@hash");
    },
    async list(page, pageSize) {
      const r = await pool
        .request()
        .input("offset", sql.Int, (page - 1) * pageSize)
        .input("size", sql.Int, pageSize)
        .query(
          `SELECT ${columns} FROM dbo.Students ORDER BY StudentId DESC OFFSET @offset ROWS FETCH NEXT @size ROWS ONLY; SELECT COUNT(*) AS total FROM dbo.Students;`,
        );
      return {
        items: r.recordsets[0],
        total: r.recordsets[1][0].total,
        page,
        pageSize,
      };
    },
    async get(id) {
      return (
        await pool
          .request()
          .input("id", sql.Int, id)
          .query(`SELECT ${columns} FROM dbo.Students WHERE StudentId=@id`)
      ).recordset[0];
    },
    async create(s) {
      return (
        await fields(pool.request(), s).query(
          `INSERT dbo.Students(Name,Email,Phone,Department) OUTPUT ${outputColumns} VALUES(@name,@email,@phone,@department)`,
        )
      ).recordset[0];
    },
    async update(id, s) {
      return (
        await fields(pool.request().input("id", sql.Int, id), s).query(
          `UPDATE dbo.Students SET Name=@name,Email=@email,Phone=@phone,Department=@department OUTPUT ${outputColumns} WHERE StudentId=@id`,
        )
      ).recordset[0];
    },
    async remove(id) {
      return (
        (
          await pool
            .request()
            .input("id", sql.Int, id)
            .query("DELETE dbo.Students WHERE StudentId=@id")
        ).rowsAffected[0] > 0
      );
    },
  };
}
