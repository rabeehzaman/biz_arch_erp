import { expect, test } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const authDir = path.join(process.cwd(), "e2e", ".auth");
const adminAuthFile = path.join(authDir, "admin.json");
const superadminAuthFile = path.join(authDir, "superadmin.json");

test("authenticate admin session", async ({ page }) => {
  fs.mkdirSync(authDir, { recursive: true });

  await page.goto("/login");
  await page.locator("#email").fill("admin@bizarch.com");
  await page.locator("#password").fill("admin123");
  await page.getByRole("button", { name: /sign in/i }).click();

  await expect(page).toHaveURL(/\/$/, { timeout: 30_000 });
  await page.context().storageState({ path: adminAuthFile });
});

test("authenticate superadmin session", async ({ browser }) => {
  fs.mkdirSync(authDir, { recursive: true });

  const context = await browser.newContext({ baseURL: "http://localhost:3000" });
  const page = await context.newPage();

  await page.goto("/login");
  await page.locator("#email").fill("superadmin@bizarch.com");
  await page.locator("#password").fill("superadmin123");
  await page.getByRole("button", { name: /sign in/i }).click();

  await expect(page).toHaveURL(/\/admin\/organizations/, { timeout: 30_000 });
  await context.storageState({ path: superadminAuthFile });
  await context.close();
});
