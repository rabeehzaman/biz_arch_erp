/**
 * Test Organization Setup
 *
 * Creates and configures two isolated test organizations for the comprehensive
 * E2E test suite: one INDIA edition (for GST testing) and one SAUDI edition
 * (for VAT testing). Idempotent — reuses existing orgs if they already exist.
 *
 * Usage:
 *   const { india, saudi } = await setupTestOrgs();
 *   const api = await getOrgApiContext(india);
 */
import "dotenv/config";
import fs from "node:fs";
import path from "node:path";
import { request as playwrightRequest, type APIRequestContext } from "@playwright/test";

// ─── Constants ──────────────────────────────────────────────────────────────

const BASE_URL = process.env.BASE_URL || "http://localhost:3000";
const AUTH_DIR = path.join(process.cwd(), "e2e", ".auth");
const SUPERADMIN_AUTH = path.join(AUTH_DIR, "superadmin.json");
const CONFIG_PATH = path.join(process.cwd(), "e2e", ".auth", "test-org-config.json");

const INDIA_ADMIN_AUTH = path.join(AUTH_DIR, "e2e-india-admin.json");
const SAUDI_ADMIN_AUTH = path.join(AUTH_DIR, "e2e-saudi-admin.json");

const INDIA_ORG = {
  name: "E2E Test India",
  slug: "e2e-test-india",
  edition: "INDIA" as const,
  adminEmail: "india-admin@e2e.test",
  adminPassword: "E2eTest123!",
  adminName: "India Admin",
};

const SAUDI_ORG = {
  name: "E2E Test Saudi",
  slug: "e2e-test-saudi",
  edition: "SAUDI" as const,
  adminEmail: "saudi-admin@e2e.test",
  adminPassword: "E2eTest123!",
  adminName: "Saudi Admin",
};

// ─── Types ──────────────────────────────────────────────────────────────────

export interface TestOrgConfig {
  orgId: string;
  orgName: string;
  edition: "INDIA" | "SAUDI";
  adminEmail: string;
  adminPassword: string;
  authStatePath: string;
  warehouses: Array<{ id: string; name: string; branchId: string }>;
}

interface OrgSetupResult {
  india: TestOrgConfig;
  saudi: TestOrgConfig;
}

// ─── Helpers ────────────────────────────────────────────────────────────────

async function parseJson(response: Awaited<ReturnType<APIRequestContext["get"]>>) {
  const body = await response.text();
  const parsed = body ? JSON.parse(body) : null;
  if (!response.ok()) {
    throw new Error(`${response.url()} ${response.status()}: ${body}`);
  }
  return parsed;
}

async function parseJsonSafe(response: Awaited<ReturnType<APIRequestContext["get"]>>) {
  const body = await response.text();
  const parsed = body ? JSON.parse(body) : null;
  return { ok: response.ok(), status: response.status(), data: parsed };
}

function makeUniqueCode(prefix: string) {
  return `${prefix}${Date.now().toString(36).slice(-4).toUpperCase()}`;
}

// ─── Superadmin API context ─────────────────────────────────────────────────

async function getSuperadminApi(): Promise<APIRequestContext> {
  if (!fs.existsSync(SUPERADMIN_AUTH)) {
    throw new Error(
      `Superadmin auth state not found at ${SUPERADMIN_AUTH}. ` +
        "Run the 'setup' project first (auth.setup.ts)."
    );
  }
  return playwrightRequest.newContext({
    baseURL: BASE_URL,
    storageState: SUPERADMIN_AUTH,
  });
}

// ─── Find or create organization ────────────────────────────────────────────

async function findOrgBySlug(
  api: APIRequestContext,
  slug: string
): Promise<{ id: string } | null> {
  const response = await api.get("/api/admin/organizations");
  const orgs = await parseJson(response);
  const match = orgs.find((o: any) => o.slug === slug);
  return match ? { id: match.id } : null;
}

async function createOrg(
  api: APIRequestContext,
  input: { name: string; slug: string; edition: "INDIA" | "SAUDI" }
): Promise<string> {
  const result = await parseJsonSafe(
    await api.post("/api/admin/organizations", { data: input })
  );

  // 201 = created, 409 = already exists — both are fine
  if (result.ok) {
    return result.data.id;
  }

  if (result.status === 409) {
    // Slug conflict — org already exists, fetch it
    const existing = await findOrgBySlug(api, input.slug);
    if (existing) return existing.id;
  }

  throw new Error(`Failed to create org "${input.slug}": ${result.status} ${JSON.stringify(result.data)}`);
}

// ─── Find or create admin user ──────────────────────────────────────────────

async function ensureAdminUser(
  api: APIRequestContext,
  input: { name: string; email: string; password: string; organizationId: string }
): Promise<string> {
  const result = await parseJsonSafe(
    await api.post("/api/admin/users", {
      data: {
        name: input.name,
        email: input.email,
        password: input.password,
        role: "admin",
        organizationId: input.organizationId,
      },
    })
  );

  if (result.ok) {
    return result.data.id;
  }

  if (result.status === 409) {
    // User already exists — that's fine
    return "existing";
  }

  throw new Error(`Failed to create user "${input.email}": ${result.status} ${JSON.stringify(result.data)}`);
}

// ─── Configure org settings ─────────────────────────────────────────────────

async function configureIndiaOrg(api: APIRequestContext, orgId: string): Promise<void> {
  await parseJson(
    await api.put(`/api/admin/organizations/${orgId}`, {
      data: {
        gstEnabled: true,
        gstin: "27AABCT1234H1Z0",
        multiUnitEnabled: true,
        multiBranchEnabled: true,
      },
    })
  );
}

async function configureSaudiOrg(api: APIRequestContext, orgId: string): Promise<void> {
  await parseJson(
    await api.put(`/api/admin/organizations/${orgId}`, {
      data: {
        saudiEInvoiceEnabled: true,
        multiBranchEnabled: true,
        currency: "SAR",
        language: "en",
      },
    })
  );
}

// ─── Authenticate org admin and save storage state ──────────────────────────

async function authenticateOrgAdmin(
  email: string,
  password: string,
  authStatePath: string
): Promise<void> {
  // Use a fresh browser-like context to perform login
  const ctx = await playwrightRequest.newContext({ baseURL: BASE_URL });
  try {
    // Attempt API-based login via NextAuth credentials endpoint
    const csrfResponse = await ctx.get("/api/auth/csrf");
    const csrfData = await csrfResponse.json();
    const csrfToken = csrfData.csrfToken;

    const loginResponse = await ctx.post("/api/auth/callback/credentials", {
      form: {
        email,
        password,
        csrfToken,
        json: "true",
      },
    });

    if (!loginResponse.ok()) {
      throw new Error(
        `Login failed for ${email}: ${loginResponse.status()} ${await loginResponse.text()}`
      );
    }

    // Save the storage state (cookies) for subsequent use
    await ctx.storageState({ path: authStatePath });
  } finally {
    await ctx.dispose();
  }
}

// ─── Create branches + warehouses for an org ────────────────────────────────

async function ensureBranchesAndWarehouses(
  api: APIRequestContext,
  _orgId: string
): Promise<Array<{ id: string; name: string; branchId: string }>> {
  // Check existing warehouses first
  const whResponse = await api.get("/api/warehouses");
  const existingWarehouses = await parseJson(whResponse);

  if (existingWarehouses.length >= 2) {
    return existingWarehouses.slice(0, 2).map((w: any) => ({
      id: w.id,
      name: w.name,
      branchId: w.branchId,
    }));
  }

  // Check existing branches
  const brResponse = await api.get("/api/branches");
  const existingBranches = await parseJson(brResponse);
  const branchIds: string[] = existingBranches.map((b: any) => b.id);

  // Create branches if needed (we need at least 2)
  while (branchIds.length < 2) {
    const idx = branchIds.length + 1;
    const code = makeUniqueCode(`BR${idx}`);
    const result = await parseJsonSafe(
      await api.post("/api/branches", {
        data: { name: `Branch ${idx}`, code },
      })
    );
    if (result.ok) {
      branchIds.push(result.data.id);
    } else if (result.status === 409) {
      // Code conflict — try a different code
      const retryCode = makeUniqueCode(`B${idx}R`);
      const retry = await parseJson(
        await api.post("/api/branches", {
          data: { name: `Branch ${idx}`, code: retryCode },
        })
      );
      branchIds.push(retry.id);
    } else {
      throw new Error(`Failed to create branch: ${result.status} ${JSON.stringify(result.data)}`);
    }
  }

  // Create warehouses under the first two branches
  const warehouses: Array<{ id: string; name: string; branchId: string }> = [];

  for (let i = 0; i < 2; i++) {
    // Check if this branch already has a warehouse
    const existing = existingWarehouses.find((w: any) => w.branchId === branchIds[i]);
    if (existing) {
      warehouses.push({ id: existing.id, name: existing.name, branchId: existing.branchId });
      continue;
    }

    const idx = i + 1;
    const code = makeUniqueCode(`WH${idx}`);
    const result = await parseJsonSafe(
      await api.post("/api/warehouses", {
        data: { name: `Warehouse ${idx}`, code, branchId: branchIds[i] },
      })
    );
    if (result.ok) {
      warehouses.push({ id: result.data.id, name: result.data.name, branchId: branchIds[i] });
    } else if (result.status === 409) {
      const retryCode = makeUniqueCode(`W${idx}H`);
      const retry = await parseJson(
        await api.post("/api/warehouses", {
          data: { name: `Warehouse ${idx}`, code: retryCode, branchId: branchIds[i] },
        })
      );
      warehouses.push({ id: retry.id, name: retry.name, branchId: branchIds[i] });
    } else {
      throw new Error(`Failed to create warehouse: ${result.status} ${JSON.stringify(result.data)}`);
    }
  }

  return warehouses;
}

// ─── Main setup function ────────────────────────────────────────────────────

export async function setupTestOrgs(): Promise<OrgSetupResult> {
  fs.mkdirSync(AUTH_DIR, { recursive: true });

  const superadminApi = await getSuperadminApi();

  try {
    // ── Step 1: Create organizations ──────────────────────────────────────

    console.log("[test-org-setup] Creating/finding India org...");
    const indiaOrgId = await createOrg(superadminApi, {
      name: INDIA_ORG.name,
      slug: INDIA_ORG.slug,
      edition: INDIA_ORG.edition,
    });

    console.log("[test-org-setup] Creating/finding Saudi org...");
    const saudiOrgId = await createOrg(superadminApi, {
      name: SAUDI_ORG.name,
      slug: SAUDI_ORG.slug,
      edition: SAUDI_ORG.edition,
    });

    // ── Step 2: Create admin users ────────────────────────────────────────

    console.log("[test-org-setup] Creating/finding India admin user...");
    await ensureAdminUser(superadminApi, {
      name: INDIA_ORG.adminName,
      email: INDIA_ORG.adminEmail,
      password: INDIA_ORG.adminPassword,
      organizationId: indiaOrgId,
    });

    console.log("[test-org-setup] Creating/finding Saudi admin user...");
    await ensureAdminUser(superadminApi, {
      name: SAUDI_ORG.adminName,
      email: SAUDI_ORG.adminEmail,
      password: SAUDI_ORG.adminPassword,
      organizationId: saudiOrgId,
    });

    // ── Step 3: Configure org settings ────────────────────────────────────

    console.log("[test-org-setup] Configuring India org settings...");
    await configureIndiaOrg(superadminApi, indiaOrgId);

    console.log("[test-org-setup] Configuring Saudi org settings...");
    await configureSaudiOrg(superadminApi, saudiOrgId);

    // ── Step 4: Authenticate org admins ───────────────────────────────────

    console.log("[test-org-setup] Authenticating India admin...");
    await authenticateOrgAdmin(INDIA_ORG.adminEmail, INDIA_ORG.adminPassword, INDIA_ADMIN_AUTH);

    console.log("[test-org-setup] Authenticating Saudi admin...");
    await authenticateOrgAdmin(SAUDI_ORG.adminEmail, SAUDI_ORG.adminPassword, SAUDI_ADMIN_AUTH);

    // ── Step 5: Create branches + warehouses per org ──────────────────────

    console.log("[test-org-setup] Setting up India branches & warehouses...");
    const indiaAdminApi = await getOrgApiContext({
      orgId: indiaOrgId,
      orgName: INDIA_ORG.name,
      edition: INDIA_ORG.edition,
      adminEmail: INDIA_ORG.adminEmail,
      adminPassword: INDIA_ORG.adminPassword,
      authStatePath: INDIA_ADMIN_AUTH,
      warehouses: [],
    });
    const indiaWarehouses = await ensureBranchesAndWarehouses(indiaAdminApi, indiaOrgId);
    await indiaAdminApi.dispose();

    console.log("[test-org-setup] Setting up Saudi branches & warehouses...");
    const saudiAdminApi = await getOrgApiContext({
      orgId: saudiOrgId,
      orgName: SAUDI_ORG.name,
      edition: SAUDI_ORG.edition,
      adminEmail: SAUDI_ORG.adminEmail,
      adminPassword: SAUDI_ORG.adminPassword,
      authStatePath: SAUDI_ADMIN_AUTH,
      warehouses: [],
    });
    const saudiWarehouses = await ensureBranchesAndWarehouses(saudiAdminApi, saudiOrgId);
    await saudiAdminApi.dispose();

    // ── Step 6: Build and cache configs ───────────────────────────────────

    const india: TestOrgConfig = {
      orgId: indiaOrgId,
      orgName: INDIA_ORG.name,
      edition: INDIA_ORG.edition,
      adminEmail: INDIA_ORG.adminEmail,
      adminPassword: INDIA_ORG.adminPassword,
      authStatePath: INDIA_ADMIN_AUTH,
      warehouses: indiaWarehouses,
    };

    const saudi: TestOrgConfig = {
      orgId: saudiOrgId,
      orgName: SAUDI_ORG.name,
      edition: SAUDI_ORG.edition,
      adminEmail: SAUDI_ORG.adminEmail,
      adminPassword: SAUDI_ORG.adminPassword,
      authStatePath: SAUDI_ADMIN_AUTH,
      warehouses: saudiWarehouses,
    };

    const result: OrgSetupResult = { india, saudi };

    // Write to disk so tests can load without re-running setup
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(result, null, 2));
    console.log("[test-org-setup] Config written to", CONFIG_PATH);

    return result;
  } finally {
    await superadminApi.dispose();
  }
}

// ─── Load cached config ─────────────────────────────────────────────────────

export function loadTestOrgConfig(): OrgSetupResult {
  if (!fs.existsSync(CONFIG_PATH)) {
    throw new Error(
      `Test org config not found at ${CONFIG_PATH}. ` +
        "Run global-setup first (npx playwright test --project=setup)."
    );
  }
  return JSON.parse(fs.readFileSync(CONFIG_PATH, "utf-8"));
}

// ─── Create API context for an org admin ────────────────────────────────────

export async function getOrgApiContext(config: TestOrgConfig): Promise<APIRequestContext> {
  if (!fs.existsSync(config.authStatePath)) {
    throw new Error(
      `Auth state not found at ${config.authStatePath}. ` +
        "Run global-setup first to authenticate org admins."
    );
  }
  return playwrightRequest.newContext({
    baseURL: BASE_URL,
    storageState: config.authStatePath,
  });
}
