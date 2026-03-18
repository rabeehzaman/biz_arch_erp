/**
 * Playwright Global Setup — Comprehensive E2E Test Suite
 *
 * Runs once before all tests in the "comprehensive" project:
 *   1. Authenticates superadmin (reuses existing auth.setup.ts storage state)
 *   2. Creates / reuses two test organizations (India + Saudi)
 *   3. Authenticates each org's admin and saves storage state
 *   4. Creates branches + warehouses for each org
 *   5. Writes org configs to disk for tests to read
 */
import { chromium, type FullConfig } from "@playwright/test";
import fs from "node:fs";
import path from "node:path";

const AUTH_DIR = path.join(process.cwd(), "e2e", ".auth");
const SUPERADMIN_AUTH = path.join(AUTH_DIR, "superadmin.json");

async function ensureSuperadminAuth(config: FullConfig) {
  // If superadmin auth state already exists and is fresh enough, skip.
  if (fs.existsSync(SUPERADMIN_AUTH)) {
    const stat = fs.statSync(SUPERADMIN_AUTH);
    const ageMs = Date.now() - stat.mtimeMs;
    // Reuse if less than 30 minutes old
    if (ageMs < 30 * 60 * 1000) {
      console.log("[global-setup] Reusing existing superadmin auth state");
      return;
    }
  }

  console.log("[global-setup] Authenticating superadmin via browser...");
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  const baseURL =
    config.projects[0]?.use?.baseURL || "http://localhost:3000";
  const browser = await chromium.launch();
  const context = await browser.newContext({ baseURL });
  const page = await context.newPage();

  try {
    await page.goto("/login");
    await page.locator("#email").fill("superadmin@bizarch.com");
    await page.locator("#password").fill("superadmin123");
    await page.getByRole("button", { name: /sign in/i }).click();

    // Wait for redirect to admin panel
    await page.waitForURL(/\/admin\/organizations/, { timeout: 15000 });
    await context.storageState({ path: SUPERADMIN_AUTH });
    console.log("[global-setup] Superadmin auth saved");
  } finally {
    await context.close();
    await browser.close();
  }
}

async function globalSetup(config: FullConfig) {
  console.log("[global-setup] Starting comprehensive test suite setup...");

  // Step 1: Ensure superadmin is authenticated
  await ensureSuperadminAuth(config);

  // Step 2: Create test organizations, users, branches, warehouses
  // Dynamically import to avoid loading playwright request at module scope
  const { setupTestOrgs } = await import("./helpers/test-org-setup");
  const result = await setupTestOrgs();

  console.log("[global-setup] Setup complete:");
  console.log(`  India org: ${result.india.orgId} (${result.india.warehouses.length} warehouses)`);
  console.log(`  Saudi org: ${result.saudi.orgId} (${result.saudi.warehouses.length} warehouses)`);
}

export default globalSetup;
