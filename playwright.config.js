import { defineConfig } from "@playwright/test";
export default defineConfig({
  testDir: "e2e",
  workers: 1,
  use: { baseURL: "http://localhost:5173", channel: "chrome", headless: true },
  reporter: "list",
});
