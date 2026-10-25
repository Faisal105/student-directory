import { test } from "node:test";
import assert from "node:assert/strict";
import sql from "mssql";
import { randomUUID } from "node:crypto";
import { config } from "../src/config.js";
import { createStore } from "../src/store.js";
test(
  "real SQL Server student CRUD and unique constraint",
  { skip: process.env.SQL_INTEGRATION !== "true" },
  async () => {
    const pool = await new sql.ConnectionPool(config().db).connect();
    const store = createStore(pool);
    const created = [];
    const student = {
      name: "Test O'Brien",
      email: `test-${randomUUID()}@example.com`,
      phone: "+971501234567",
      department: "Integration Test",
    };
    try {
      const record = await store.create(student);
      created.push(record.studentId);
      assert.equal((await store.get(record.studentId)).name, student.name);
      await assert.rejects(
        () => store.create(student),
        (e) => [2601, 2627].includes(e.number),
      );
      const edited = await store.update(record.studentId, {
        ...student,
        name: "Updated Test",
      });
      assert.equal(edited.name, "Updated Test");
      assert.equal(
        edited.createdDate.toISOString(),
        record.createdDate.toISOString(),
      );
      assert.equal(await store.remove(record.studentId), true);
      assert.equal(await store.get(record.studentId), undefined);
    } finally {
      for (const id of created) await store.remove(id);
      await pool.close();
    }
  },
);
