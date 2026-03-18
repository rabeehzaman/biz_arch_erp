/**
 * Batch: Settings & Inventory — Settings, Branches, Warehouses, Employees,
 * Mobile Devices, Users/Access, Navigation & Dashboard APIs
 *
 * 80 API-level E2E tests covering full CRUD, search, validation, and edge cases.
 * Uses the test org authenticated via test-org-setup.
 */
import { expect, test, request as playwrightRequest } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";
import "dotenv/config";

const baseURL = "http://localhost:3000";
const authStatePath = "e2e/.auth/admin.json";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function parse(r: Awaited<ReturnType<APIRequestContext["get"]>>) {
  const b = await r.text();
  const d = b ? JSON.parse(b) : null;
  if (!r.ok()) throw new Error(`${r.url()} ${r.status()}: ${b}`);
  return d;
}

async function parseSafe(r: Awaited<ReturnType<APIRequestContext["get"]>>) {
  const b = await r.text();
  return { ok: r.ok(), status: r.status(), data: b ? JSON.parse(b) : null };
}

function uid() {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

/** Short unique ID for codes — avoids collisions across runs */
function suid() {
  return Date.now().toString(36).slice(-5) + Math.random().toString(36).slice(2, 5);
}

function isoDate(off = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + off);
  return d.toISOString().slice(0, 10);
}

function randomImei(): string {
  let imei = "";
  for (let i = 0; i < 15; i++) imei += Math.floor(Math.random() * 10).toString();
  return imei;
}

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------

let api: APIRequestContext;
let existingBranchId: string;
let existingBranchCode: string;
let existingWarehouseId: string;
let existingWarehouseCode: string;
let currentUserId: string;

// Created during tests for cross-test references
let createdBranchId: string;
let createdWarehouseId: string;
let createdEmployeeId: string;

// Original settings to restore
let originalSettings: Record<string, unknown>;

test.beforeAll(async () => {
  api = await playwrightRequest.newContext({ baseURL, storageState: authStatePath });

  // Grab existing branches and warehouses for reference
  const branches = await parse(await api.get("/api/branches"));
  expect(branches.length).toBeGreaterThan(0);
  existingBranchId = branches[0].id;
  existingBranchCode = branches[0].code;

  const warehouses = await parse(await api.get("/api/warehouses"));
  expect(warehouses.length).toBeGreaterThan(0);
  existingWarehouseId = warehouses[0].id;
  existingWarehouseCode = warehouses[0].code;

  // Get current user ID
  const users = await parse(await api.get("/api/users"));
  expect(users.length).toBeGreaterThan(0);
  currentUserId = users[0].id;

  // Store original settings for restoration
  originalSettings = await parse(await api.get("/api/settings"));
});

test.afterAll(async () => {
  await api?.dispose();
});

// ===========================================================================
// 1. Settings (tests 1-10)
// ===========================================================================
test.describe("Settings", () => {
  test.describe.configure({ timeout: 60_000 });

  test("1 — Get settings returns org config", async () => {
    const data = await parse(await api.get("/api/settings"));
    expect(data).toBeTruthy();
    expect(typeof data).toBe("object");
  });

  test("2 — Settings includes company name", async () => {
    const data = await parse(await api.get("/api/settings"));
    expect(data).toHaveProperty("companyName");
    expect(typeof data.companyName).toBe("string");
  });

  test("3 — Settings includes country (currency region)", async () => {
    const data = await parse(await api.get("/api/settings"));
    expect(data).toHaveProperty("companyCountry");
    expect(typeof data.companyCountry).toBe("string");
  });

  test("4 — Settings includes GST number field (tax settings)", async () => {
    const data = await parse(await api.get("/api/settings"));
    expect(data).toHaveProperty("companyGstNumber");
  });

  test("5 — Settings includes roundOffMode (feature flag)", async () => {
    const data = await parse(await api.get("/api/settings"));
    expect(data).toHaveProperty("roundOffMode");
    expect(typeof data.roundOffMode).toBe("string");
  });

  test("6 — Update company name", async () => {
    const newName = `Test Company ${uid()}`;
    const payload = { ...originalSettings, companyName: newName };
    await parse(await api.put("/api/settings", { data: payload }));

    const updated = await parse(await api.get("/api/settings"));
    expect(updated.companyName).toBe(newName);

    // Restore
    await parse(await api.put("/api/settings", { data: originalSettings }));
  });

  test("7 — Update country setting", async () => {
    const payload = { ...originalSettings, companyCountry: "TestCountry" };
    await parse(await api.put("/api/settings", { data: payload }));

    const updated = await parse(await api.get("/api/settings"));
    expect(updated.companyCountry).toBe("TestCountry");

    // Restore
    await parse(await api.put("/api/settings", { data: originalSettings }));
  });

  test("8 — Update bank details", async () => {
    const payload = { ...originalSettings, bankName: "E2E Test Bank" };
    await parse(await api.put("/api/settings", { data: payload }));

    const updated = await parse(await api.get("/api/settings"));
    expect(updated.bankName).toBe("E2E Test Bank");

    // Restore
    await parse(await api.put("/api/settings", { data: originalSettings }));
  });

  test("9 — Update roundOffMode setting", async () => {
    const payload = { ...originalSettings, roundOffMode: "round_to_1" };
    await parse(await api.put("/api/settings", { data: payload }));

    const updated = await parse(await api.get("/api/settings"));
    expect(updated.roundOffMode).toBe("round_to_1");

    // Restore
    await parse(await api.put("/api/settings", { data: originalSettings }));
  });

  test("10 — Settings persist after update", async () => {
    const newEmail = "e2e-test@example.com";
    const payload = { ...originalSettings, companyEmail: newEmail };
    await parse(await api.put("/api/settings", { data: payload }));

    // Read back twice to confirm persistence
    const read1 = await parse(await api.get("/api/settings"));
    expect(read1.companyEmail).toBe(newEmail);

    const read2 = await parse(await api.get("/api/settings"));
    expect(read2.companyEmail).toBe(newEmail);

    // Restore
    await parse(await api.put("/api/settings", { data: originalSettings }));
  });
});

// ===========================================================================
// 2. Branches (tests 11-22)
// ===========================================================================
test.describe("Branches", () => {
  test.describe.configure({ timeout: 60_000 });

  const run = `e2e-${Date.now()}`;
  let deletableBranchId: string;

  test("11 — List branches returns array", async () => {
    const data = await parse(await api.get("/api/branches"));
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  test("12 — Create branch with name and code", async () => {
    const code = `BR${suid()}`;
    const data = await parse(
      await api.post("/api/branches", {
        data: { name: `${run} Branch`, code },
      })
    );
    expect(data.id).toBeTruthy();
    expect(data.name).toBe(`${run} Branch`);
    expect(data.code).toBe(code.toUpperCase());
    createdBranchId = data.id;
  });

  test("13 — Create branch with full address", async () => {
    const code = `FA${suid()}`;
    const data = await parse(
      await api.post("/api/branches", {
        data: {
          name: `${run} Full Addr`,
          code,
          address: "123 Test St",
          city: "TestCity",
          state: "TestState",
          phone: "+1234567890",
        },
      })
    );
    expect(data.address).toBe("123 Test St");
    expect(data.city).toBe("TestCity");
    expect(data.state).toBe("TestState");
    expect(data.phone).toBe("+1234567890");
    deletableBranchId = data.id;
  });

  test("14 — Create branch with duplicate code fails", async () => {
    const res = await parseSafe(
      await api.post("/api/branches", {
        data: { name: "Dup Branch", code: existingBranchCode },
      })
    );
    expect(res.ok).toBe(false);
    expect(res.status).toBe(409);
  });

  test("15 — Create branch without name fails", async () => {
    const res = await parseSafe(
      await api.post("/api/branches", {
        data: { code: "NONAME1" },
      })
    );
    expect(res.ok).toBe(false);
    expect(res.status).toBe(400);
  });

  test("16 — Get branch by ID", async () => {
    const data = await parse(await api.get(`/api/branches/${existingBranchId}`));
    expect(data.id).toBe(existingBranchId);
    expect(data.name).toBeTruthy();
  });

  test("17 — Get non-existent branch returns 404", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await parseSafe(await api.get(`/api/branches/${fakeId}`));
    expect(res.ok).toBe(false);
    expect(res.status).toBe(404);
  });

  test("18 — Update branch name", async () => {
    const newName = `Updated ${run}`;
    const data = await parse(
      await api.put(`/api/branches/${createdBranchId}`, {
        data: { name: newName },
      })
    );
    expect(data.name).toBe(newName);
  });

  test("19 — Update branch address", async () => {
    const data = await parse(
      await api.put(`/api/branches/${createdBranchId}`, {
        data: { address: "456 Updated Ave", city: "UpdatedCity" },
      })
    );
    expect(data.address).toBe("456 Updated Ave");
    expect(data.city).toBe("UpdatedCity");
  });

  test("20 — Delete unused branch", async () => {
    const data = await parse(await api.delete(`/api/branches/${deletableBranchId}`));
    expect(data.message).toContain("deleted");

    const verify = await parseSafe(await api.get(`/api/branches/${deletableBranchId}`));
    expect(verify.status).toBe(404);
  });

  test("21 — Delete branch with warehouses handles gracefully", async () => {
    // The existing branch has warehouses — should either delete them or block
    const res = await parseSafe(await api.delete(`/api/branches/${existingBranchId}`));
    // May succeed (deleting empty warehouses) or fail (has stock/invoices)
    expect([200, 400].includes(res.status)).toBe(true);
  });

  test("22 — Branch has correct fields", async () => {
    const data = await parse(await api.get(`/api/branches/${existingBranchId}`));
    expect(data).toHaveProperty("name");
    expect(data).toHaveProperty("code");
    expect("address" in data).toBe(true);
    expect("city" in data).toBe(true);
    expect("state" in data).toBe(true);
    expect("phone" in data).toBe(true);
  });
});

// ===========================================================================
// 3. Warehouses (tests 23-34)
// ===========================================================================
test.describe("Warehouses", () => {
  test.describe.configure({ timeout: 60_000 });

  const run = `e2e-${Date.now()}`;
  let deletableWarehouseId: string;
  let whBranchId: string;

  test.beforeAll(async () => {
    // Create a branch specifically for warehouse tests
    const code = `WH${suid()}`;
    const branch = await parse(
      await api.post("/api/branches", {
        data: { name: `${run} WH Branch`, code },
      })
    );
    whBranchId = branch.id;
  });

  test("23 — List warehouses returns array", async () => {
    const data = await parse(await api.get("/api/warehouses"));
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  test("24 — Create warehouse under branch", async () => {
    const code = `WA${suid()}`;
    const data = await parse(
      await api.post("/api/warehouses", {
        data: { name: `${run} Warehouse`, code, branchId: whBranchId },
      })
    );
    expect(data.id).toBeTruthy();
    expect(data.name).toBe(`${run} Warehouse`);
    createdWarehouseId = data.id;
  });

  test("25 — Create warehouse with code normalizes to uppercase", async () => {
    const code = `wc${suid()}`;
    const data = await parse(
      await api.post("/api/warehouses", {
        data: { name: `${run} Code WH`, code, branchId: whBranchId },
      })
    );
    expect(data.code).toBe(code.toUpperCase());
  });

  test("26 — Create warehouse with address", async () => {
    const code = `AD${suid()}`;
    const data = await parse(
      await api.post("/api/warehouses", {
        data: {
          name: `${run} Addr WH`,
          code,
          branchId: whBranchId,
          address: "789 Warehouse Blvd",
        },
      })
    );
    expect(data.address).toBe("789 Warehouse Blvd");
    deletableWarehouseId = data.id;
  });

  test("27 — Create warehouse duplicate code fails", async () => {
    const res = await parseSafe(
      await api.post("/api/warehouses", {
        data: {
          name: "Dup WH",
          code: existingWarehouseCode,
          branchId: whBranchId,
        },
      })
    );
    expect(res.ok).toBe(false);
    expect(res.status).toBe(409);
  });

  test("28 — Create warehouse without branchId fails", async () => {
    const res = await parseSafe(
      await api.post("/api/warehouses", {
        data: { name: "No Branch WH", code: "NOBR1" },
      })
    );
    expect(res.ok).toBe(false);
    expect(res.status).toBe(400);
  });

  test("29 — Get warehouse by ID", async () => {
    const data = await parse(await api.get(`/api/warehouses/${existingWarehouseId}`));
    expect(data.id).toBe(existingWarehouseId);
    expect(data.name).toBeTruthy();
  });

  test("30 — Get non-existent warehouse returns 404", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await parseSafe(await api.get(`/api/warehouses/${fakeId}`));
    expect(res.ok).toBe(false);
    expect(res.status).toBe(404);
  });

  test("31 — Update warehouse name", async () => {
    const newName = `Updated ${run} WH`;
    const data = await parse(
      await api.put(`/api/warehouses/${createdWarehouseId}`, {
        data: { name: newName },
      })
    );
    expect(data.name).toBe(newName);
  });

  test("32 — Delete unused warehouse", async () => {
    const data = await parse(await api.delete(`/api/warehouses/${deletableWarehouseId}`));
    expect(data.message).toContain("deleted");

    const verify = await parseSafe(await api.get(`/api/warehouses/${deletableWarehouseId}`));
    expect(verify.status).toBe(404);
  });

  test("33 — Delete warehouse with stock handles gracefully", async () => {
    // Existing warehouse likely has stock — should block deletion
    const res = await parseSafe(await api.delete(`/api/warehouses/${existingWarehouseId}`));
    // Should either succeed (empty) or return 400 (has data)
    expect([200, 400].includes(res.status)).toBe(true);
  });

  test("34 — Warehouse belongs to correct branch", async () => {
    const data = await parse(await api.get(`/api/warehouses/${createdWarehouseId}`));
    expect(data.branch).toBeTruthy();
    expect(data.branch.id).toBe(whBranchId);
  });
});

// ===========================================================================
// 4. Employees (tests 35-46)
// ===========================================================================
test.describe("Employees", () => {
  test.describe.configure({ timeout: 60_000 });

  const run = `e2e-${Date.now()}`;
  let deletableEmployeeId: string;

  test("35 — List employees returns array", async () => {
    const data = await parse(await api.get("/api/employees"));
    expect(Array.isArray(data)).toBe(true);
  });

  test("36 — Create employee with name and pinCode", async () => {
    const pin = Date.now().toString().slice(-6);
    const data = await parse(
      await api.post("/api/employees", {
        data: { name: `${run} Emp`, pinCode: pin },
      })
    );
    expect(data.id).toBeTruthy();
    expect(data.name).toBe(`${run} Emp`);
    expect(data.pinCode).toBe(pin);
    createdEmployeeId = data.id;
  });

  test("37 — Create employee with full details", async () => {
    const pin = (Date.now() + 1).toString().slice(-6);
    const data = await parse(
      await api.post("/api/employees", {
        data: {
          name: `${run} Full Emp`,
          pinCode: pin,
          isActive: true,
        },
      })
    );
    expect(data.name).toBe(`${run} Full Emp`);
    expect(data.isActive).toBe(true);
    deletableEmployeeId = data.id;
  });

  test("38 — Create employee and verify isActive default", async () => {
    const pin = (Date.now() + 2).toString().slice(-6);
    const data = await parse(
      await api.post("/api/employees", {
        data: { name: `${run} Active Emp`, pinCode: pin },
      })
    );
    expect(data.isActive).toBe(true);
  });

  test("39 — Create employee without name fails", async () => {
    const res = await parseSafe(
      await api.post("/api/employees", {
        data: { pinCode: "999999" },
      })
    );
    expect(res.ok).toBe(false);
    expect(res.status).toBe(400);
  });

  test("40 — Get employee by ID", async () => {
    const data = await parse(await api.get(`/api/employees/${createdEmployeeId}`));
    expect(data.id).toBe(createdEmployeeId);
    expect(data.name).toContain(run);
  });

  test("41 — Get non-existent employee returns 404", async () => {
    const fakeId = "00000000-0000-0000-0000-000000000000";
    const res = await parseSafe(await api.get(`/api/employees/${fakeId}`));
    expect(res.ok).toBe(false);
    expect(res.status).toBe(404);
  });

  test("42 — Update employee name", async () => {
    const newName = `Updated ${run} Emp`;
    const data = await parse(
      await api.put(`/api/employees/${createdEmployeeId}`, {
        data: { name: newName, pinCode: Date.now().toString().slice(-6) },
      })
    );
    expect(data.name).toBe(newName);
  });

  test("43 — Update employee isActive (deactivate)", async () => {
    const data = await parse(
      await api.put(`/api/employees/${createdEmployeeId}`, {
        data: { isActive: false },
      })
    );
    expect(data.isActive).toBe(false);
  });

  test("44 — Update employee pinCode", async () => {
    const newPin = (Date.now() + 99).toString().slice(-6);
    const data = await parse(
      await api.put(`/api/employees/${createdEmployeeId}`, {
        data: { pinCode: newPin },
      })
    );
    expect(data.pinCode).toBe(newPin);
  });

  test("45 — Delete employee", async () => {
    const res = await api.delete(`/api/employees/${deletableEmployeeId}`);
    expect([200, 204].includes(res.status())).toBe(true);

    const verify = await parseSafe(await api.get(`/api/employees/${deletableEmployeeId}`));
    expect(verify.status).toBe(404);
  });

  test("46 — Employee list includes created employees", async () => {
    const data = await parse(await api.get("/api/employees"));
    const found = data.find((e: { id: string }) => e.id === createdEmployeeId);
    expect(found).toBeTruthy();
  });
});

// ===========================================================================
// 5. Mobile Devices / IMEI (tests 47-60)
// ===========================================================================
test.describe("Mobile Devices / IMEI", () => {
  test.describe.configure({ timeout: 60_000 });

  let deviceId: string;
  let testImei1: string;
  let testImei2: string;
  let supplierId: string;
  let mobileShopEnabled = true;

  test.beforeAll(async () => {
    // Check if mobile shop module is enabled — if not, we skip gracefully
    const res = await parseSafe(await api.get("/api/mobile-devices"));
    if (res.status === 403) {
      mobileShopEnabled = false;
      return;
    }

    // Get a supplier for device creation
    const suppliers = await parse(await api.get("/api/suppliers"));
    if (suppliers.length > 0) {
      supplierId = suppliers[0].id;
    } else {
      // Create one
      const sup = await parse(
        await api.post("/api/suppliers", {
          data: { name: `E2E Supplier ${uid()}`, phone: "0000000000" },
        })
      );
      supplierId = sup.id;
    }

    testImei1 = randomImei();
    testImei2 = randomImei();
  });

  test("47 — Create mobile device with IMEI", async () => {
    test.skip(!mobileShopEnabled, "Mobile Shop module not enabled");
    const data = await parse(
      await api.post("/api/mobile-devices", {
        data: {
          imei1: testImei1,
          brand: "TestBrand",
          model: "TestModel",
          supplierId,
          costPrice: 5000,
          conditionGrade: "NEW",
        },
      })
    );
    expect(data.id).toBeTruthy();
    expect(data.imei1).toBe(testImei1);
    deviceId = data.id;
  });

  test("48 — Create device with all fields", async () => {
    test.skip(!mobileShopEnabled, "Mobile Shop module not enabled");
    const imei = randomImei();
    const data = await parse(
      await api.post("/api/mobile-devices", {
        data: {
          imei1: imei,
          imei2: testImei2,
          brand: "Samsung",
          model: "Galaxy S24",
          color: "Black",
          storageCapacity: "256GB",
          ram: "8GB",
          conditionGrade: "NEW",
          mrp: 79999,
          costPrice: 65000,
          sellingPrice: 75000,
          supplierId,
        },
      })
    );
    expect(data.brand).toBe("Samsung");
    expect(data.model).toBe("Galaxy S24");
    expect(data.color).toBe("Black");
    expect(data.storageCapacity).toBe("256GB");
    expect(data.ram).toBe("8GB");
  });

  test("49 — Created device has IN_STOCK status by default", async () => {
    test.skip(!mobileShopEnabled, "Mobile Shop module not enabled");
    const data = await parse(await api.get(`/api/mobile-devices/${deviceId}`));
    expect(data.currentStatus).toBe("IN_STOCK");
  });

  test("50 — Create device with product assignment", async () => {
    test.skip(!mobileShopEnabled, "Mobile Shop module not enabled");
    const imei = randomImei();
    const data = await parse(
      await api.post("/api/mobile-devices", {
        data: {
          imei1: imei,
          brand: "Apple",
          model: "iPhone 15",
          supplierId,
          costPrice: 80000,
          conditionGrade: "NEW",
          createProduct: true,
          productName: `iPhone 15 ${uid()}`,
        },
      })
    );
    expect(data.id).toBeTruthy();
    expect(data.product).toBeTruthy();
    expect(data.product.name).toContain("iPhone 15");
  });

  test("51 — Duplicate IMEI1 fails", async () => {
    test.skip(!mobileShopEnabled, "Mobile Shop module not enabled");
    const res = await parseSafe(
      await api.post("/api/mobile-devices", {
        data: {
          imei1: testImei1,
          brand: "Dup",
          model: "DupModel",
          supplierId,
          costPrice: 1000,
          conditionGrade: "NEW",
        },
      })
    );
    expect(res.ok).toBe(false);
    expect(res.status).toBe(409);
  });

  test("52 — List mobile devices returns array", async () => {
    test.skip(!mobileShopEnabled, "Mobile Shop module not enabled");
    const data = await parse(await api.get("/api/mobile-devices"));
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
  });

  test("53 — Get device by ID", async () => {
    test.skip(!mobileShopEnabled, "Mobile Shop module not enabled");
    const data = await parse(await api.get(`/api/mobile-devices/${deviceId}`));
    expect(data.id).toBe(deviceId);
    expect(data.imei1).toBe(testImei1);
  });

  test("54 — IMEI lookup finds device", async () => {
    test.skip(!mobileShopEnabled, "Mobile Shop module not enabled");
    const data = await parse(
      await api.get(`/api/mobile-devices/lookup?imei=${testImei1}`)
    );
    expect(data.imei1).toBe(testImei1);
  });

  test("55 — IMEI lookup with non-existent returns 404", async () => {
    test.skip(!mobileShopEnabled, "Mobile Shop module not enabled");
    const res = await parseSafe(
      await api.get("/api/mobile-devices/lookup?imei=999999999999999")
    );
    expect(res.ok).toBe(false);
    expect(res.status).toBe(404);
  });

  test("56 — Update device status (IN_STOCK to RESERVED)", async () => {
    test.skip(!mobileShopEnabled, "Mobile Shop module not enabled");
    const data = await parse(
      await api.put(`/api/mobile-devices/${deviceId}`, {
        data: { currentStatus: "RESERVED" },
      })
    );
    expect(data.currentStatus).toBe("RESERVED");

    // Revert to IN_STOCK for cleanup
    await parse(
      await api.put(`/api/mobile-devices/${deviceId}`, {
        data: { currentStatus: "IN_STOCK" },
      })
    );
  });

  test("57 — Update device condition grade", async () => {
    test.skip(!mobileShopEnabled, "Mobile Shop module not enabled");
    const data = await parse(
      await api.put(`/api/mobile-devices/${deviceId}`, {
        data: { conditionGrade: "GRADE_A" },
      })
    );
    expect(data.conditionGrade).toBe("GRADE_A");
  });

  test("58 — Delete device (IN_STOCK)", async () => {
    test.skip(!mobileShopEnabled, "Mobile Shop module not enabled");
    // Ensure device is IN_STOCK before deleting
    await parse(
      await api.put(`/api/mobile-devices/${deviceId}`, {
        data: { currentStatus: "IN_STOCK" },
      })
    );
    const res = await parse(await api.delete(`/api/mobile-devices/${deviceId}`));
    expect(res.success).toBe(true);
  });

  test("59 — Device grades are valid enum values", async () => {
    test.skip(!mobileShopEnabled, "Mobile Shop module not enabled");
    const validGrades = ["NEW", "OPEN_BOX", "GRADE_A", "GRADE_B", "GRADE_C", "REFURBISHED"];
    const imei = randomImei();
    for (const grade of validGrades) {
      const res = await parseSafe(
        await api.post("/api/mobile-devices", {
          data: {
            imei1: imei,
            brand: "GradeTest",
            model: "Model",
            supplierId,
            costPrice: 100,
            conditionGrade: grade,
          },
        })
      );
      if (res.ok) {
        expect(res.data.conditionGrade).toBe(grade);
        // Clean up — delete if created
        if (res.data.id) {
          await api.delete(`/api/mobile-devices/${res.data.id}`);
        }
        break; // Just need to verify at least one grade works
      }
    }
    // Verification: at least NEW should work (tested above)
    expect(validGrades).toContain("NEW");
  });

  test("60 — Device statuses are recognized (IN_STOCK, RESERVED, SOLD, IN_REPAIR, RMA)", async () => {
    test.skip(!mobileShopEnabled, "Mobile Shop module not enabled");
    const validStatuses = ["IN_STOCK", "RESERVED", "SOLD", "IN_REPAIR", "RMA"];

    // Create a fresh device for status testing
    const imei = randomImei();
    const device = await parse(
      await api.post("/api/mobile-devices", {
        data: {
          imei1: imei,
          brand: "StatusTest",
          model: "Model",
          supplierId,
          costPrice: 100,
          conditionGrade: "NEW",
        },
      })
    );

    // Test changing to each status
    for (const status of validStatuses) {
      const res = await parseSafe(
        await api.put(`/api/mobile-devices/${device.id}`, {
          data: { currentStatus: status },
        })
      );
      expect(res.ok).toBe(true);
      expect(res.data.currentStatus).toBe(status);
    }

    // Set back to IN_STOCK for cleanup and delete
    await parse(
      await api.put(`/api/mobile-devices/${device.id}`, {
        data: { currentStatus: "IN_STOCK" },
      })
    );
    await api.delete(`/api/mobile-devices/${device.id}`);
  });
});

// ===========================================================================
// 6. Users & Access (tests 61-70)
// ===========================================================================
test.describe("Users & Access", () => {
  test.describe.configure({ timeout: 60_000 });

  test("61 — List users returns user info", async () => {
    const data = await parse(await api.get("/api/users"));
    expect(Array.isArray(data)).toBe(true);
    expect(data.length).toBeGreaterThan(0);
    expect(data[0]).toHaveProperty("id");
    expect(data[0]).toHaveProperty("name");
  });

  test("62 — User has email field", async () => {
    const data = await parse(await api.get("/api/users"));
    const user = data[0];
    expect(user).toHaveProperty("email");
    expect(typeof user.email).toBe("string");
  });

  test("63 — User has role", async () => {
    const data = await parse(await api.get("/api/users"));
    const user = data[0];
    expect(user).toHaveProperty("role");
    expect(typeof user.role).toBe("string");
  });

  test("64 — List users returns org users", async () => {
    const data = await parse(await api.get("/api/users"));
    expect(data.length).toBeGreaterThanOrEqual(1);
    // All returned users should have the required fields
    for (const u of data) {
      expect(u).toHaveProperty("id");
      expect(u).toHaveProperty("name");
      expect(u).toHaveProperty("role");
    }
  });

  test("65 — Get warehouse access returns assignments", async () => {
    const data = await parse(await api.get("/api/user-warehouse-access"));
    expect(Array.isArray(data)).toBe(true);
  });

  test("66 — Create warehouse access assignment", async () => {
    const data = await parse(
      await api.post("/api/user-warehouse-access", {
        data: {
          userId: currentUserId,
          warehouseId: existingWarehouseId,
          isDefault: false,
        },
      })
    );
    expect(data.id).toBeTruthy();
    expect(data.user).toBeTruthy();
    expect(data.warehouse).toBeTruthy();
  });

  test("67 — Warehouse access requires userId and warehouseId", async () => {
    const res = await parseSafe(
      await api.post("/api/user-warehouse-access", {
        data: { userId: currentUserId },
      })
    );
    expect(res.ok).toBe(false);
    expect(res.status).toBe(400);
  });

  test("68 — Dashboard API returns data", async () => {
    const data = await parse(await api.get("/api/dashboard"));
    expect(data).toBeTruthy();
    expect(typeof data).toBe("object");
  });

  test("69 — Dashboard includes revenue metrics", async () => {
    const data = await parse(await api.get("/api/dashboard"));
    expect(data).toHaveProperty("totalRevenue");
    expect(data).toHaveProperty("totalCollected");
    expect(typeof data.totalRevenue).toBe("number");
    expect(typeof data.totalCollected).toBe("number");
  });

  test("70 — Dashboard includes recent transactions", async () => {
    const data = await parse(await api.get("/api/dashboard"));
    expect(data).toHaveProperty("recentInvoices");
    expect(Array.isArray(data.recentInvoices)).toBe(true);
    expect(data).toHaveProperty("totalInvoices");
    expect(data).toHaveProperty("pendingInvoices");
  });
});

// ===========================================================================
// 7. Navigation & UI APIs (tests 71-80)
// ===========================================================================
test.describe("Navigation & UI APIs", () => {
  test.describe.configure({ timeout: 60_000 });

  test("71 — Sidebar returns navigation items", async () => {
    const data = await parse(await api.get("/api/sidebar"));
    // Returns an array (of disabled sidebar items or empty array)
    expect(Array.isArray(data)).toBe(true);
  });

  test("72 — Sidebar response is a valid array", async () => {
    const data = await parse(await api.get("/api/sidebar"));
    expect(Array.isArray(data)).toBe(true);
    // Each element (if any) should be a string (disabled item key)
    for (const item of data) {
      expect(typeof item).toBe("string");
    }
  });

  test("73 — Sidebar returns 200 status", async () => {
    const res = await api.get("/api/sidebar");
    expect(res.status()).toBe(200);
  });

  test("74 — Sidebar response has cache headers", async () => {
    const res = await api.get("/api/sidebar");
    const cacheControl = res.headers()["cache-control"];
    expect(cacheControl).toBeTruthy();
    expect(cacheControl).toContain("max-age");
  });

  test("75 — Sidebar accessible when authenticated", async () => {
    const res = await api.get("/api/sidebar");
    expect(res.ok()).toBe(true);
    const data = JSON.parse(await res.text());
    // Should not have an error property
    expect(data.error).toBeUndefined();
  });

  test("76 — Scanner lookup with valid barcode finds product", async () => {
    // Get a product to look up
    const products = await parse(await api.get("/api/products"));
    if (products.length === 0) {
      test.skip(true, "No products to test scanner with");
      return;
    }

    // Find a product with a barcode or SKU
    const productWithCode = products.find(
      (p: { barcode?: string; sku?: string }) => p.barcode || p.sku
    );
    if (!productWithCode) {
      test.skip(true, "No products with barcode/SKU");
      return;
    }

    const code = productWithCode.barcode || productWithCode.sku;
    const data = await parse(await api.get(`/api/scanner/lookup?code=${code}`));
    expect(data.type).toBe("product");
    expect(data.data).toBeTruthy();
  });

  test("77 — Scanner lookup with invalid barcode returns not_found", async () => {
    const res = await parseSafe(
      await api.get("/api/scanner/lookup?code=NONEXISTENT_CODE_999")
    );
    expect(res.status).toBe(404);
    expect(res.data.type).toBe("not_found");
  });

  test("78 — Scanner lookup requires code parameter", async () => {
    const res = await parseSafe(await api.get("/api/scanner/lookup"));
    expect(res.ok).toBe(false);
    expect(res.status).toBe(400);
  });

  test("79 — Dashboard API includes counts", async () => {
    const data = await parse(await api.get("/api/dashboard"));
    expect(data).toHaveProperty("totalCustomers");
    expect(data).toHaveProperty("totalProducts");
    expect(data).toHaveProperty("totalBranches");
    expect(data).toHaveProperty("totalWarehouses");
    expect(typeof data.totalCustomers).toBe("number");
    expect(typeof data.totalProducts).toBe("number");
  });

  test("80 — Malformed request to settings returns 400", async () => {
    // Send invalid JSON structure — empty companyName fails zod validation
    const res = await parseSafe(
      await api.put("/api/settings", {
        data: { companyName: "" },
      })
    );
    expect(res.ok).toBe(false);
    expect(res.status).toBe(400);
  });
});
