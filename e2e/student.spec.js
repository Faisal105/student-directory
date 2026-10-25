import { test, expect } from "@playwright/test";
import { readFile } from "node:fs/promises";
test("reviewer can sign in and manage a student", async ({ page }) => {
  const credentials = JSON.parse(
    await readFile(".env.local-login.json", "utf8"),
  );
  const unique = `Browser Test ${Date.now()}`;
  await page.goto("/");
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
  await page.getByLabel("Email address").fill(credentials.email);
  await page.getByLabel("Password", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "Students.", exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Add student", exact: true }).click();
  await page.getByLabel("Full name").fill(unique);
  await page
    .getByLabel("Email address")
    .fill(`browser-${Date.now()}@example.com`);
  await page.getByLabel("Phone number").fill("+971501234567");
  await page.getByLabel("Department").fill("Computer Science");
  await page.getByRole("button", { name: "Create student" }).click();
  await expect(
    page.getByRole("heading", { name: unique, exact: true }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Edit student", exact: true }).click();
  await page.getByLabel("Department").fill("Engineering");
  await page.getByRole("button", { name: "Save changes" }).click();
  await expect(page.getByText("Engineering", { exact: true })).toBeVisible();
  await page.reload();
  await expect(page.getByText("Engineering", { exact: true })).toBeVisible();
  await page.getByRole("link", { name: "Back to students" }).click();
  page.once("dialog", (dialog) => dialog.accept());
  await page
    .getByRole("button", { name: `Delete ${unique}`, exact: true })
    .click();
  await expect(
    page.getByText(`${unique} was deleted.`, { exact: true }),
  ).toBeVisible();
  await page.screenshot({ path: "tmp/directory-desktop.png", fullPage: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "tmp/directory-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Sign out" }).click();
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
  await page.screenshot({ path: "tmp/login-mobile.png", fullPage: true });
});

test("mobile layout fits the viewport", async ({ browser }) => {
  const context = await browser.newContext({
    viewport: { width: 390, height: 844 },
  });
  const page = await context.newPage();
  const credentials = JSON.parse(
    await readFile(".env.local-login.json", "utf8"),
  );
  await page.goto("http://localhost:5173");
  await expect(
    page.getByRole("heading", { name: "Welcome back." }),
  ).toBeVisible();
  await page.screenshot({ path: "tmp/login-mobile.png", fullPage: true });
  await page.getByLabel("Email address").fill(credentials.email);
  await page.getByLabel("Password", { exact: true }).fill(credentials.password);
  await page.getByRole("button", { name: "Sign in to workspace" }).click();
  await expect(
    page.getByRole("heading", { name: "All students" }),
  ).toBeVisible();
  await expect(
    page.getByText("amina@example.com", { exact: true }),
  ).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.screenshot({ path: "tmp/directory-mobile.png", fullPage: true });
  await page.getByRole("link", { name: "Add student", exact: true }).click();
  await expect(page.getByLabel("Full name")).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBe(
    390,
  );
  await page.screenshot({ path: "tmp/form-mobile.png", fullPage: true });
  await page.getByRole("button", { name: "Sign out" }).click();
  await context.close();
});
