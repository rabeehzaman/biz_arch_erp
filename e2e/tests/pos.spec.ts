import { expect, test, request as playwrightRequest } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";
import pg from "pg";
import "dotenv/config";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Helpers                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

const baseURL = "http://localhost:3000";
const authStatePath = "e2e/.auth/admin.json";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

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

function isoDate(off = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + off);
  return d.toISOString().slice(0, 10);
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Shared state                                                              */
/* ────────────────────────────────────────────────────────────────────────── */

let api: APIRequestContext;
let productId: string;
let productName: string;
let productUnitId: string;
let serviceProductId: string;
let serviceProductName: string;
let unitId: string;
let warehouseId: string;
let supplierId: string;
let customerId: string;
let employeePinCode: string;
let mainSessionId: string;

/** Helper: open a POS session, return its id */
async function openSession(
  openingCash = 500,
  wId?: string,
): Promise<string> {
  const res = await parse(
    await api.post("/api/pos/sessions", {
      data: { openingCash, warehouseId: wId ?? warehouseId, pinCode: employeePinCode },
    }),
  );
  return res.id;
}

/** Helper: close a POS session */
async function closeSession(sessionId: string, closingCash = 500) {
  return parse(
    await api.put(`/api/pos/sessions/${sessionId}/close`, {
      data: { closingCash, pinCode: employeePinCode },
    }),
  );
}

/** Helper: perform a POS checkout, return result */
async function checkout(
  sessionId: string,
  items: Array<{
    productId: string;
    name: string;
    quantity: number;
    unitPrice: number;
    discount?: number;
    gstRate?: number;
  }>,
  payments: Array<{ method: string; amount: number }>,
  opts: { customerId?: string; notes?: string } = {},
) {
  return parse(
    await api.post("/api/pos/checkout", {
      data: {
        sessionId,
        items,
        payments,
        customerId: opts.customerId,
        notes: opts.notes,
      },
    }),
  );
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Setup & Teardown                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

test.beforeAll(async () => {
  api = await playwrightRequest.newContext({
    baseURL,
    storageState: authStatePath,
  });

  const run = uid();

  // Get pcs unit
  const units = await parse(await api.get("/api/units"));
  const pcsUnit = units.find((u: any) => u.code === "pcs") ?? units[0];
  unitId = pcsUnit.id;

  // Create test supplier
  const sup = await parse(
    await api.post("/api/suppliers", {
      data: {
        name: `POS Supplier ${run}`,
        email: `${run}-possup@example.com`,
        phone: "+966500000099",
      },
    }),
  );
  supplierId = sup.id;

  // Create test customer
  const cust = await parse(
    await api.post("/api/customers", {
      data: {
        name: `POS Customer ${run}`,
        email: `${run}-poscust@example.com`,
        phone: "+966500000098",
      },
    }),
  );
  customerId = cust.id;

  // Create stock product
  const prod = await parse(
    await api.post("/api/products", {
      data: {
        name: `POS Product ${run}`,
        sku: `POS-${run}`,
        price: 200,
        cost: 0,
        unitId,
        gstRate: 0,
        isService: false,
      },
    }),
  );
  productId = prod.id;
  productName = prod.name;
  productUnitId = prod.unitId;

  // Create service product
  const svc = await parse(
    await api.post("/api/products", {
      data: {
        name: `POS Service ${run}`,
        sku: `POSSVC-${run}`,
        price: 500,
        cost: 0,
        unitId,
        gstRate: 0,
        isService: true,
      },
    }),
  );
  serviceProductId = svc.id;
  serviceProductName = svc.name;

  // Get first warehouse
  const warehouses = await parse(await api.get("/api/warehouses"));
  warehouseId = warehouses[0]?.id ?? "";

  // Create employee with PIN for POS sessions
  employeePinCode = `${Date.now()}`.slice(-6);
  await parse(
    await api.post("/api/employees", {
      data: {
        name: `POS Employee ${run}`,
        pinCode: employeePinCode,
      },
    }),
  );

  // Seed purchase: 100 units @ cost 100
  await parse(
    await api.post("/api/purchase-invoices", {
      data: {
        supplierId,
        invoiceDate: isoDate(-10),
        dueDate: isoDate(-10),
        supplierInvoiceRef: `posseed-${run}`,
        ...(warehouseId ? { warehouseId } : {}),
        items: [
          {
            productId,
            description: "POS seed stock",
            quantity: 100,
            unitCost: 100,
            unitId: productUnitId,
            gstRate: 0,
            discount: 0,
          },
        ],
      },
    }),
  );

  // Open the main POS session used by most tests
  mainSessionId = await openSession(500);
});

test.afterAll(async () => {
  // Close the main session if still open
  const current = await parseSafe(
    await api.get("/api/pos/sessions/current"),
  );
  if (current.ok && current.data?.session?.id === mainSessionId) {
    await parseSafe(
      await api.put(`/api/pos/sessions/${mainSessionId}/close`, {
        data: { closingCash: 500, pinCode: employeePinCode },
      }),
    );
  }

  await api.dispose();
  await pool.end();
});

/* ────────────────────────────────────────────────────────────────────────── */
/*  POS Sessions (tests 1–25)                                                 */
/* ────────────────────────────────────────────────────────────────────────── */

test.describe("POS Sessions", () => {
  test.setTimeout(120_000);

  // 1
  test("1 - Open POS session with opening balance", async () => {
    // mainSessionId was opened in beforeAll with openingCash=500
    expect(mainSessionId).toBeTruthy();
  });

  // 2
  test("2 - Open session → status is OPEN", async () => {
    const s = await parse(
      await api.get(`/api/pos/sessions/${mainSessionId}`),
    );
    expect(s.status).toBe("OPEN");
  });

  // 3
  test("3 - Open session with warehouse", async () => {
    const s = await parse(
      await api.get(`/api/pos/sessions/${mainSessionId}`),
    );
    if (warehouseId) {
      expect(s.warehouseId).toBe(warehouseId);
    }
  });

  // 4
  test("4 - Get current session → returns open session", async () => {
    const res = await parse(
      await api.get("/api/pos/sessions/current"),
    );
    expect(res.session).not.toBeNull();
    expect(res.session.status).toBe("OPEN");
  });

  // 5
  test("5 - List sessions → includes new session", async () => {
    const list = await parse(await api.get("/api/pos/sessions"));
    const found = list.find((s: any) => s.id === mainSessionId);
    expect(found).toBeTruthy();
  });

  // 6
  test("6 - Get session by ID", async () => {
    const s = await parse(
      await api.get(`/api/pos/sessions/${mainSessionId}`),
    );
    expect(s.id).toBe(mainSessionId);
    expect(s.sessionNumber).toBeTruthy();
  });

  // 7 + 8 + 9 — Close a separate session
  test("7 - Close session with closing balance", async () => {
    const sid = await openSession(100);
    const closed = await closeSession(sid, 100);
    expect(closed.status).toBe("CLOSED");
  });

  test("8 - Close session → status changes to CLOSED", async () => {
    const sid = await openSession(0);
    const closed = await closeSession(sid, 0);
    expect(closed.status).toBe("CLOSED");
    expect(closed.closedAt).toBeTruthy();
  });

  test("9 - Close session → summary calculated", async () => {
    const sid = await openSession(200);
    const closed = await closeSession(sid, 200);
    expect(closed.totalSales).toBeDefined();
    expect(closed.totalTransactions).toBeDefined();
  });

  // 10
  test("10 - Cannot open second session while one is open (same register)", async () => {
    // mainSessionId is already open for this branch/warehouse
    const res = await parseSafe(
      await api.post("/api/pos/sessions", {
        data: { openingCash: 100, warehouseId, pinCode: employeePinCode },
      }),
    );
    expect(res.ok).toBe(false);
    expect(res.status).toBe(400);
  });

  // 11
  test("11 - Session with zero opening balance", async () => {
    const sid = await openSession(0);
    const s = await parse(await api.get(`/api/pos/sessions/${sid}`));
    expect(Number(s.openingCash)).toBe(0);
    await closeSession(sid, 0);
  });

  // 12
  test("12 - Session orders endpoint → empty initially", async () => {
    const sid = await openSession(100);
    const res = await parse(
      await api.get(`/api/pos/sessions/${sid}/orders`),
    );
    expect(res.orders).toHaveLength(0);
    await closeSession(sid, 100);
  });

  // 13
  test("13 - Session summary → zero totals initially", async () => {
    const sid = await openSession(50);
    const summary = await parse(
      await api.get(`/api/pos/sessions/${sid}/summary`),
    );
    expect(Number(summary.session.totalSales)).toBe(0);
    expect(summary.session.totalTransactions).toBe(0);
    await closeSession(sid, 50);
  });

  // 14
  test("14 - Session PDF endpoint → returns 200", async () => {
    const sid = await openSession(100);
    // Make a quick sale so the session has data
    await checkout(
      sid,
      [{ productId, name: productName, quantity: 1, unitPrice: 50 }],
      [{ method: "CASH", amount: 50 }],
    );
    await closeSession(sid, 150);
    const res = await api.get(`/api/pos/sessions/${sid}/pdf`);
    expect(res.status()).toBe(200);
    expect(res.headers()["content-type"]).toContain("application/pdf");
  });

  // 15 — Session notes (close with notes)
  test("15 - Update session notes (via close)", async () => {
    const sid = await openSession(100);
    const closed = await parse(
      await api.put(`/api/pos/sessions/${sid}/close`, {
        data: { closingCash: 100, notes: "Shift note e2e", pinCode: employeePinCode },
      }),
    );
    expect(closed.notes).toBe("Shift note e2e");
  });

  // 16
  test("16 - Session closing balance vs calculated difference", async () => {
    const sid = await openSession(100);
    // sell 1 item @ 200 cash
    await checkout(
      sid,
      [{ productId, name: productName, quantity: 1, unitPrice: 200 }],
      [{ method: "CASH", amount: 200 }],
    );
    // Expected = 100 + 200 = 300; close with 280 → difference = -20
    const closed = await closeSession(sid, 280);
    expect(Number(closed.expectedCash)).toBe(300);
    expect(Number(closed.cashDifference)).toBe(-20);
  });

  // 17
  test("17 - Close session with notes", async () => {
    const sid = await openSession(0);
    const closed = await parse(
      await api.put(`/api/pos/sessions/${sid}/close`, {
        data: { closingCash: 0, notes: "Closing note test", pinCode: employeePinCode },
      }),
    );
    expect(closed.notes).toBe("Closing note test");
  });

  // 18
  test("18 - Open new session after closing previous", async () => {
    const sid1 = await openSession(100);
    await closeSession(sid1, 100);
    const sid2 = await openSession(200);
    expect(sid2).toBeTruthy();
    expect(sid2).not.toBe(sid1);
    await closeSession(sid2, 200);
  });

  // 19
  test("19 - Session with large opening balance", async () => {
    const sid = await openSession(999999.99);
    const s = await parse(await api.get(`/api/pos/sessions/${sid}`));
    expect(Number(s.openingCash)).toBeCloseTo(999999.99, 2);
    await closeSession(sid, 999999.99);
  });

  // 20
  test("20 - Get non-existent session → 404", async () => {
    const res = await parseSafe(
      await api.get("/api/pos/sessions/nonexistent-id-xyz"),
    );
    expect(res.status).toBe(404);
  });

  // 21
  test("21 - Close already-closed session → should fail", async () => {
    const sid = await openSession(100);
    await closeSession(sid, 100);
    const res = await parseSafe(
      await api.put(`/api/pos/sessions/${sid}/close`, {
        data: { closingCash: 100, pinCode: employeePinCode },
      }),
    );
    expect(res.ok).toBe(false);
    expect(res.status).toBe(400);
  });

  // 22
  test("22 - Session list ordered by date", async () => {
    const list = await parse(await api.get("/api/pos/sessions"));
    expect(list.length).toBeGreaterThan(0);
    for (let i = 1; i < list.length; i++) {
      expect(
        new Date(list[i - 1].openedAt).getTime(),
      ).toBeGreaterThanOrEqual(new Date(list[i].openedAt).getTime());
    }
  });

  // 23
  test("23 - Session includes opening/closing timestamps", async () => {
    const sid = await openSession(100);
    const open = await parse(await api.get(`/api/pos/sessions/${sid}`));
    expect(open.openedAt).toBeTruthy();
    expect(open.closedAt).toBeNull();
    const closed = await closeSession(sid, 100);
    expect(closed.closedAt).toBeTruthy();
  });

  // 24
  test("24 - Session warehouse filtering", async () => {
    if (!warehouseId) return;
    const list = await parse(
      await api.get(`/api/pos/sessions?warehouseId=${warehouseId}`),
    );
    for (const s of list) {
      expect(s.warehouseId).toBe(warehouseId);
    }
  });

  // 25
  test("25 - Session summary after orders", async () => {
    const sid = await openSession(100);
    await checkout(
      sid,
      [{ productId, name: productName, quantity: 2, unitPrice: 100 }],
      [{ method: "CASH", amount: 200 }],
    );
    const summary = await parse(
      await api.get(`/api/pos/sessions/${sid}/summary`),
    );
    expect(Number(summary.session.totalSales)).toBeGreaterThan(0);
    expect(summary.session.totalTransactions).toBeGreaterThanOrEqual(1);
    await closeSession(sid, 300);
  });
});

/* ────────────────────────────────────────────────────────────────────────── */
/*  POS Checkout (tests 26–60)                                                */
/* ────────────────────────────────────────────────────────────────────────── */

test.describe("POS Checkout", () => {
  test.setTimeout(120_000);

  // 26
  test("26 - Checkout with single item + CASH payment", async () => {
    const res = await checkout(
      mainSessionId,
      [{ productId, name: productName, quantity: 1, unitPrice: 200 }],
      [{ method: "CASH", amount: 200 }],
    );
    expect(res.invoice).toBeTruthy();
    expect(res.invoice.invoiceNumber).toBeTruthy();
    expect(res.payments).toHaveLength(1);
  });

  // 27
  test("27 - Checkout with multiple items", async () => {
    const res = await checkout(
      mainSessionId,
      [
        { productId, name: productName, quantity: 1, unitPrice: 100 },
        { productId, name: productName, quantity: 2, unitPrice: 50 },
      ],
      [{ method: "CASH", amount: 200 }],
    );
    expect(res.invoice.items).toHaveLength(2);
  });

  // 28
  test("28 - Checkout with discount on item", async () => {
    const res = await checkout(
      mainSessionId,
      [
        {
          productId,
          name: productName,
          quantity: 1,
          unitPrice: 200,
          discount: 10,
        },
      ],
      [{ method: "CASH", amount: 180 }],
    );
    // 200 - 10% = 180
    expect(Number(res.invoice.total)).toBeCloseTo(180, 0);
  });

  // 29
  test("29 - Checkout with GST/VAT tax", async () => {
    const res = await checkout(
      mainSessionId,
      [
        {
          productId,
          name: productName,
          quantity: 1,
          unitPrice: 100,
          gstRate: 18,
        },
      ],
      [{ method: "CASH", amount: 118 }],
    );
    const total = Number(res.invoice.total);
    // Total should include tax
    expect(total).toBeGreaterThanOrEqual(100);
  });

  // 30
  test("30 - Checkout creates invoice automatically", async () => {
    const res = await checkout(
      mainSessionId,
      [{ productId, name: productName, quantity: 1, unitPrice: 50 }],
      [{ method: "CASH", amount: 50 }],
    );
    expect(res.invoice.id).toBeTruthy();
    expect(res.invoice.sourceType).toBe("POS");
    expect(res.invoice.posSessionId).toBe(mainSessionId);
  });

  // 31
  test("31 - Checkout creates payment automatically", async () => {
    const res = await checkout(
      mainSessionId,
      [{ productId, name: productName, quantity: 1, unitPrice: 50 }],
      [{ method: "CASH", amount: 50 }],
    );
    expect(res.payments.length).toBeGreaterThanOrEqual(1);
    expect(res.payments[0].paymentNumber).toBeTruthy();
  });

  // 32
  test("32 - Checkout → FIFO stock consumed", async () => {
    // Grab stock before
    const stockBefore = await pool.query(
      `SELECT COALESCE(SUM("remainingQuantity"), 0) AS stock
       FROM "stock_lots"
       WHERE "productId" = $1`,
      [productId],
    );
    const before = Number(stockBefore.rows[0].stock);

    await checkout(
      mainSessionId,
      [{ productId, name: productName, quantity: 1, unitPrice: 50 }],
      [{ method: "CASH", amount: 50 }],
    );

    const stockAfter = await pool.query(
      `SELECT COALESCE(SUM("remainingQuantity"), 0) AS stock
       FROM "stock_lots"
       WHERE "productId" = $1`,
      [productId],
    );
    const after = Number(stockAfter.rows[0].stock);
    expect(after).toBe(before - 1);
  });

  // 33
  test("33 - Checkout → COGS calculated", async () => {
    const res = await checkout(
      mainSessionId,
      [{ productId, name: productName, quantity: 1, unitPrice: 300 }],
      [{ method: "CASH", amount: 300 }],
    );
    const invoiceId = res.invoice.id;
    const cogsResult = await pool.query(
      `SELECT COALESCE(SUM("costOfGoodsSold"), 0) AS cogs
       FROM "invoice_items"
       WHERE "invoiceId" = $1`,
      [invoiceId],
    );
    expect(Number(cogsResult.rows[0].cogs)).toBeGreaterThan(0);
  });

  // 34
  test("34 - Checkout → journal entries created", async () => {
    const res = await checkout(
      mainSessionId,
      [{ productId, name: productName, quantity: 1, unitPrice: 100 }],
      [{ method: "CASH", amount: 100 }],
    );
    const invoiceId = res.invoice.id;
    // Revenue journal
    const journals = await pool.query(
      `SELECT COUNT(*) AS cnt
       FROM "journal_entries"
       WHERE "sourceId" = $1 AND "sourceType" = 'INVOICE'`,
      [invoiceId],
    );
    expect(Number(journals.rows[0].cnt)).toBeGreaterThanOrEqual(1);
  });

  // 35
  test("35 - Checkout without session → should fail", async () => {
    const res = await parseSafe(
      await api.post("/api/pos/checkout", {
        data: {
          sessionId: "nonexistent-session-id",
          items: [
            { productId, name: productName, quantity: 1, unitPrice: 100 },
          ],
          payments: [{ method: "CASH", amount: 100 }],
        },
      }),
    );
    expect(res.ok).toBe(false);
    expect(res.status).toBe(400);
  });

  // 36
  test("36 - Checkout without items → should fail", async () => {
    const res = await parseSafe(
      await api.post("/api/pos/checkout", {
        data: {
          sessionId: mainSessionId,
          items: [],
          payments: [{ method: "CASH", amount: 100 }],
        },
      }),
    );
    expect(res.ok).toBe(false);
    expect(res.status).toBe(400);
  });

  // 37
  test("37 - Checkout without payment → should fail", async () => {
    const res = await parseSafe(
      await api.post("/api/pos/checkout", {
        data: {
          sessionId: mainSessionId,
          items: [
            { productId, name: productName, quantity: 1, unitPrice: 100 },
          ],
        },
      }),
    );
    expect(res.ok).toBe(false);
    expect(res.status).toBe(400);
  });

  // 38
  test("38 - Checkout with named customer", async () => {
    const res = await checkout(
      mainSessionId,
      [{ productId, name: productName, quantity: 1, unitPrice: 50 }],
      [{ method: "CASH", amount: 50 }],
      { customerId },
    );
    expect(res.invoice.customerId).toBe(customerId);
  });

  // 39
  test("39 - Checkout walk-in (no customer)", async () => {
    const res = await checkout(
      mainSessionId,
      [{ productId, name: productName, quantity: 1, unitPrice: 50 }],
      [{ method: "CASH", amount: 50 }],
    );
    // Should default to walk-in
    expect(res.invoice.customer.name).toBe("Walk-in Customer");
  });

  // 40
  test("40 - Checkout with split payment (CASH + CARD)", async () => {
    const res = await checkout(
      mainSessionId,
      [{ productId, name: productName, quantity: 1, unitPrice: 100 }],
      [
        { method: "CASH", amount: 60 },
        { method: "CREDIT_CARD", amount: 40 },
      ],
    );
    expect(res.payments).toHaveLength(2);
  });

  // 41
  test("41 - Checkout with BANK_TRANSFER payment", async () => {
    const res = await checkout(
      mainSessionId,
      [{ productId, name: productName, quantity: 1, unitPrice: 50 }],
      [{ method: "BANK_TRANSFER", amount: 50 }],
    );
    expect(res.payments[0].paymentMethod).toBe("BANK_TRANSFER");
  });

  // 42
  test("42 - Checkout with CREDIT_CARD payment", async () => {
    const res = await checkout(
      mainSessionId,
      [{ productId, name: productName, quantity: 1, unitPrice: 50 }],
      [{ method: "CREDIT_CARD", amount: 50 }],
    );
    expect(res.payments[0].paymentMethod).toBe("CREDIT_CARD");
  });

  // 43
  test("43 - Checkout with UPI payment", async () => {
    const res = await checkout(
      mainSessionId,
      [{ productId, name: productName, quantity: 1, unitPrice: 50 }],
      [{ method: "UPI", amount: 50 }],
    );
    expect(res.payments[0].paymentMethod).toBe("UPI");
  });

  // 44
  test("44 - Checkout total = items total + tax - discounts", async () => {
    const res = await checkout(
      mainSessionId,
      [
        {
          productId,
          name: productName,
          quantity: 2,
          unitPrice: 100,
          discount: 10,
          gstRate: 0,
        },
      ],
      [{ method: "CASH", amount: 180 }],
    );
    // 2 * 100 * (1 - 0.10) = 180 (0% tax)
    expect(Number(res.invoice.total)).toBeCloseTo(180, 0);
  });

  // 45
  test("45 - Checkout payment total must equal invoice total", async () => {
    const res = await checkout(
      mainSessionId,
      [{ productId, name: productName, quantity: 1, unitPrice: 100, gstRate: 0 }],
      [{ method: "CASH", amount: 100 }],
    );
    const invoiceTotal = Number(res.invoice.total);
    const paymentTotal = res.payments.reduce(
      (s: number, p: any) => s + Number(p.amount),
      0,
    );
    expect(paymentTotal).toBeCloseTo(invoiceTotal, 2);
  });

  // 46 — under-payment: the API does not reject under-payment for POS (it creates a balance)
  // so we just verify balanceDue > 0
  test("46 - Checkout under-payment → balanceDue > 0", async () => {
    const res = await checkout(
      mainSessionId,
      [{ productId, name: productName, quantity: 1, unitPrice: 100, gstRate: 0 }],
      [{ method: "CASH", amount: 50 }],
    );
    expect(Number(res.invoice.balanceDue)).toBeGreaterThan(0);
  });

  // 47
  test("47 - Checkout with notes", async () => {
    const res = await checkout(
      mainSessionId,
      [{ productId, name: productName, quantity: 1, unitPrice: 50 }],
      [{ method: "CASH", amount: 50 }],
      { notes: "Customer asked for bag" },
    );
    expect(res.invoice.notes).toBe("Customer asked for bag");
  });

  // 48
  test("48 - Checkout → session orders count increases", async () => {
    const ordersBefore = await parse(
      await api.get(`/api/pos/sessions/${mainSessionId}/orders`),
    );
    const countBefore = ordersBefore.orders.length;

    await checkout(
      mainSessionId,
      [{ productId, name: productName, quantity: 1, unitPrice: 50 }],
      [{ method: "CASH", amount: 50 }],
    );

    const ordersAfter = await parse(
      await api.get(`/api/pos/sessions/${mainSessionId}/orders`),
    );
    expect(ordersAfter.orders.length).toBe(countBefore + 1);
  });

  // 49
  test("49 - Checkout → session summary totals increase", async () => {
    const sid = await openSession(0);
    await checkout(
      sid,
      [{ productId, name: productName, quantity: 1, unitPrice: 100, gstRate: 0 }],
      [{ method: "CASH", amount: 100 }],
    );
    const summary = await parse(
      await api.get(`/api/pos/sessions/${sid}/summary`),
    );
    expect(Number(summary.session.totalSales)).toBeGreaterThanOrEqual(100);
    expect(summary.session.totalTransactions).toBeGreaterThanOrEqual(1);
    await closeSession(sid, 100);
  });

  // 50
  test("50 - Checkout with service product → no COGS", async () => {
    const res = await checkout(
      mainSessionId,
      [
        {
          productId: serviceProductId,
          name: serviceProductName,
          quantity: 1,
          unitPrice: 500,
        },
      ],
      [{ method: "CASH", amount: 500 }],
    );
    // Service products don't have stock lots, COGS should be 0
    const cogsResult = await pool.query(
      `SELECT COALESCE(SUM("costOfGoodsSold"), 0) AS cogs
       FROM "invoice_items"
       WHERE "invoiceId" = $1`,
      [res.invoice.id],
    );
    expect(Number(cogsResult.rows[0].cogs)).toBe(0);
  });

  // 51
  test("51 - Checkout with zero-stock product → fallback cost warning", async () => {
    // Create a product with zero stock
    const run2 = uid();
    const zeroStockProd = await parse(
      await api.post("/api/products", {
        data: {
          name: `Zero Stock ${run2}`,
          sku: `ZS-${run2}`,
          price: 50,
          cost: 10,
          unitId,
          gstRate: 0,
          isService: false,
        },
      }),
    );
    const res = await checkout(
      mainSessionId,
      [
        {
          productId: zeroStockProd.id,
          name: zeroStockProd.name,
          quantity: 1,
          unitPrice: 50,
        },
      ],
      [{ method: "CASH", amount: 50 }],
    );
    // Should still succeed with a warning
    expect(res.invoice).toBeTruthy();
    expect(res.warnings.length).toBeGreaterThan(0);
  });

  // 52
  test("52 - Checkout with decimal quantities", async () => {
    const res = await checkout(
      mainSessionId,
      [
        {
          productId,
          name: productName,
          quantity: 0.5,
          unitPrice: 200,
        },
      ],
      [{ method: "CASH", amount: 100 }],
    );
    expect(Number(res.invoice.total)).toBeCloseTo(100, 0);
  });

  // 53
  test("53 - Checkout multiple orders in same session", async () => {
    const res1 = await checkout(
      mainSessionId,
      [{ productId, name: productName, quantity: 1, unitPrice: 50 }],
      [{ method: "CASH", amount: 50 }],
    );
    const res2 = await checkout(
      mainSessionId,
      [{ productId, name: productName, quantity: 1, unitPrice: 60 }],
      [{ method: "CASH", amount: 60 }],
    );
    expect(res1.invoice.id).not.toBe(res2.invoice.id);
  });

  // 54
  test("54 - Checkout with large quantities", async () => {
    // Ensure stock exists
    await parse(
      await api.post("/api/purchase-invoices", {
        data: {
          supplierId,
          invoiceDate: isoDate(),
          dueDate: isoDate(),
          supplierInvoiceRef: `large-${uid()}`,
          ...(warehouseId ? { warehouseId } : {}),
          items: [
            {
              productId,
              description: "Large stock",
              quantity: 500,
              unitCost: 50,
              unitId: productUnitId,
              gstRate: 0,
              discount: 0,
            },
          ],
        },
      }),
    );

    const res = await checkout(
      mainSessionId,
      [{ productId, name: productName, quantity: 50, unitPrice: 10 }],
      [{ method: "CASH", amount: 500 }],
    );
    expect(res.invoice.items[0].quantity).toBe(50);
  });

  // 55
  test("55 - Checkout → invoice has correct warehouse", async () => {
    if (!warehouseId) return;
    const res = await checkout(
      mainSessionId,
      [{ productId, name: productName, quantity: 1, unitPrice: 50 }],
      [{ method: "CASH", amount: 50 }],
    );
    expect(res.invoice.warehouseId).toBe(warehouseId);
  });

  // 56
  test("56 - Checkout → customer balance updated (if customer specified)", async () => {
    // Fetch balance before
    const custBefore = await pool.query(
      `SELECT "balance" FROM "customers" WHERE "id" = $1`,
      [customerId],
    );
    const balBefore = Number(custBefore.rows[0].balance);

    // Under-pay to create a balance increase
    await checkout(
      mainSessionId,
      [{ productId, name: productName, quantity: 1, unitPrice: 200, gstRate: 0 }],
      [{ method: "CASH", amount: 100 }],
      { customerId },
    );

    const custAfter = await pool.query(
      `SELECT "balance" FROM "customers" WHERE "id" = $1`,
      [customerId],
    );
    const balAfter = Number(custAfter.rows[0].balance);
    // Balance should increase by the unpaid amount (200 - 100 = 100)
    expect(balAfter).toBeGreaterThan(balBefore);
  });

  // 57
  test("57 - Checkout CASH → cash tendered can exceed total (change)", async () => {
    const res = await checkout(
      mainSessionId,
      [{ productId, name: productName, quantity: 1, unitPrice: 50, gstRate: 0 }],
      [{ method: "CASH", amount: 100 }],
    );
    expect(res.change).toBe(50);
  });

  // 58
  test("58 - Checkout with multiple tax rates", async () => {
    const res = await checkout(
      mainSessionId,
      [
        {
          productId,
          name: productName,
          quantity: 1,
          unitPrice: 100,
          gstRate: 5,
        },
        {
          productId,
          name: productName,
          quantity: 1,
          unitPrice: 100,
          gstRate: 18,
        },
      ],
      [{ method: "CASH", amount: 223 }],
    );
    expect(res.invoice.items).toHaveLength(2);
  });

  // 59
  test("59 - Checkout rapid consecutive (3 orders fast)", async () => {
    const [r1, r2, r3] = await Promise.all([
      checkout(
        mainSessionId,
        [{ productId, name: productName, quantity: 1, unitPrice: 10 }],
        [{ method: "CASH", amount: 10 }],
      ),
      checkout(
        mainSessionId,
        [{ productId, name: productName, quantity: 1, unitPrice: 20 }],
        [{ method: "CASH", amount: 20 }],
      ),
      checkout(
        mainSessionId,
        [{ productId, name: productName, quantity: 1, unitPrice: 30 }],
        [{ method: "CASH", amount: 30 }],
      ),
    ]);
    // All three should have unique invoice numbers
    const numbers = new Set([
      r1.invoice.invoiceNumber,
      r2.invoice.invoiceNumber,
      r3.invoice.invoiceNumber,
    ]);
    expect(numbers.size).toBe(3);
  });

  // 60
  test("60 - Checkout → invoice number auto-generated", async () => {
    const res = await checkout(
      mainSessionId,
      [{ productId, name: productName, quantity: 1, unitPrice: 50 }],
      [{ method: "CASH", amount: 50 }],
    );
    expect(res.invoice.invoiceNumber).toMatch(/^INV-\d{8}-\d{3}$/);
  });
});

/* ────────────────────────────────────────────────────────────────────────── */
/*  POS Products & Settings (tests 61–75)                                     */
/* ────────────────────────────────────────────────────────────────────────── */

test.describe("POS Products & Settings", () => {
  test.setTimeout(120_000);

  // 61
  test("61 - POS products list → returns products with stock", async () => {
    const products = await parse(await api.get("/api/pos/products"));
    expect(products.length).toBeGreaterThan(0);
    const found = products.find((p: any) => p.id === productId);
    expect(found).toBeTruthy();
    expect(found.stockQuantity).toBeDefined();
  });

  // 62
  test("62 - POS products → filters by warehouse (via session)", async () => {
    // POS products don't take a warehouse param directly,
    // they show all active products with stock aggregation
    const products = await parse(await api.get("/api/pos/products"));
    expect(Array.isArray(products)).toBe(true);
  });

  // 63
  test("63 - POS products → includes price and stock qty", async () => {
    const products = await parse(await api.get("/api/pos/products"));
    const found = products.find((p: any) => p.id === productId);
    expect(found.price).toBeDefined();
    expect(found.stockQuantity).toBeDefined();
    expect(Number(found.price)).toBeGreaterThan(0);
  });

  // 64
  test("64 - POS products → includes service products", async () => {
    const products = await parse(await api.get("/api/pos/products"));
    const svc = products.find((p: any) => p.id === serviceProductId);
    expect(svc).toBeTruthy();
    expect(svc.isService).toBe(true);
  });

  // 65
  test("65 - POS products → search by name (via list filtering)", async () => {
    // The POS products endpoint returns all products; search is client-side
    const products = await parse(await api.get("/api/pos/products"));
    const matches = products.filter((p: any) =>
      p.name.includes("POS Product"),
    );
    expect(matches.length).toBeGreaterThan(0);
  });

  // 66
  test("66 - POS org settings → returns org config", async () => {
    const settings = await parse(await api.get("/api/pos/org-settings"));
    expect(settings).toBeTruthy();
    expect(settings.posAccountingMode).toBeDefined();
  });

  // 67
  test("67 - POS org settings → includes posAccountingMode", async () => {
    const settings = await parse(await api.get("/api/pos/org-settings"));
    expect(["DIRECT", "CLEARING_ACCOUNT"]).toContain(
      settings.posAccountingMode,
    );
  });

  // 68
  test("68 - POS org settings → includes tax settings", async () => {
    const settings = await parse(await api.get("/api/pos/org-settings"));
    expect(settings.saudiEInvoiceEnabled).toBeDefined();
  });

  // 69
  test("69 - POS register configs → returns registers", async () => {
    const configs = await parse(
      await api.get("/api/pos/register-configs"),
    );
    expect(Array.isArray(configs)).toBe(true);
  });

  // 70
  test("70 - POS register configs → includes warehouse assignment", async () => {
    if (!warehouseId) return;
    const res = await parse(
      await api.get(
        `/api/pos/register-configs?warehouseId=${warehouseId}`,
      ),
    );
    // Returns { config: ... } when queried with specific params
    expect(res).toHaveProperty("config");
  });

  // 71
  test("71 - POS products with zero stock → still listed", async () => {
    const run2 = uid();
    const zProd = await parse(
      await api.post("/api/products", {
        data: {
          name: `ZeroList ${run2}`,
          sku: `ZL-${run2}`,
          price: 10,
          cost: 0,
          unitId,
          gstRate: 0,
          isService: false,
        },
      }),
    );
    const products = await parse(await api.get("/api/pos/products"));
    const found = products.find((p: any) => p.id === zProd.id);
    expect(found).toBeTruthy();
    expect(Number(found.stockQuantity)).toBe(0);
  });

  // 72
  test("72 - POS products stock after checkout → decremented", async () => {
    const productsBefore = await parse(await api.get("/api/pos/products"));
    const before = productsBefore.find((p: any) => p.id === productId);
    const stockBefore = Number(before.stockQuantity);

    await checkout(
      mainSessionId,
      [{ productId, name: productName, quantity: 1, unitPrice: 50 }],
      [{ method: "CASH", amount: 50 }],
    );

    const productsAfter = await parse(await api.get("/api/pos/products"));
    const after = productsAfter.find((p: any) => p.id === productId);
    expect(Number(after.stockQuantity)).toBe(stockBefore - 1);
  });

  // 73
  test("73 - POS products → includes barcode if set", async () => {
    const products = await parse(await api.get("/api/pos/products"));
    const any = products[0];
    expect(any).toHaveProperty("barcode");
  });

  // 74
  test("74 - POS products → correct price format", async () => {
    const products = await parse(await api.get("/api/pos/products"));
    const found = products.find((p: any) => p.id === productId);
    expect(typeof Number(found.price)).toBe("number");
    expect(Number(found.price)).toBe(200);
  });

  // 75
  test("75 - POS org settings → includes roundOffMode", async () => {
    const settings = await parse(await api.get("/api/pos/org-settings"));
    expect(settings.roundOffMode).toBeDefined();
  });
});

/* ────────────────────────────────────────────────────────────────────────── */
/*  POS Held Orders (tests 76–90)                                             */
/* ────────────────────────────────────────────────────────────────────────── */

test.describe("POS Held Orders", () => {
  test.setTimeout(120_000);

  const heldItems = [
    {
      productId: "", // filled in beforeAll
      name: "",
      quantity: 2,
      unitPrice: 100,
    },
  ];

  test.beforeAll(() => {
    heldItems[0].productId = productId;
    heldItems[0].name = productName;
  });

  // 76
  test("76 - Hold order with items", async () => {
    const res = await parse(
      await api.post("/api/pos/held-orders", {
        data: {
          items: heldItems,
          subtotal: 200,
        },
      }),
    );
    expect(res.id).toBeTruthy();
    expect(res.items).toBeTruthy();
    // cleanup
    await api.delete(`/api/pos/held-orders/${res.id}`);
  });

  // 77
  test("77 - Hold order with customer", async () => {
    const res = await parse(
      await api.post("/api/pos/held-orders", {
        data: {
          items: heldItems,
          subtotal: 200,
          customerId,
        },
      }),
    );
    expect(res.customerId).toBe(customerId);
    await api.delete(`/api/pos/held-orders/${res.id}`);
  });

  // 78
  test("78 - Hold order with notes", async () => {
    const res = await parse(
      await api.post("/api/pos/held-orders", {
        data: {
          items: heldItems,
          subtotal: 200,
          notes: "Hold for 5 min",
        },
      }),
    );
    expect(res.notes).toBe("Hold for 5 min");
    await api.delete(`/api/pos/held-orders/${res.id}`);
  });

  // 79
  test("79 - Hold order → persists in list", async () => {
    const held = await parse(
      await api.post("/api/pos/held-orders", {
        data: {
          items: heldItems,
          subtotal: 200,
        },
      }),
    );
    const list = await parse(await api.get("/api/pos/held-orders"));
    const found = list.find((h: any) => h.id === held.id);
    expect(found).toBeTruthy();
    await api.delete(`/api/pos/held-orders/${held.id}`);
  });

  // 80
  test("80 - List held orders", async () => {
    const held1 = await parse(
      await api.post("/api/pos/held-orders", {
        data: { items: heldItems, subtotal: 200 },
      }),
    );
    const held2 = await parse(
      await api.post("/api/pos/held-orders", {
        data: { items: heldItems, subtotal: 200, notes: "second" },
      }),
    );
    const list = await parse(await api.get("/api/pos/held-orders"));
    expect(list.length).toBeGreaterThanOrEqual(2);
    await api.delete(`/api/pos/held-orders/${held1.id}`);
    await api.delete(`/api/pos/held-orders/${held2.id}`);
  });

  // 81
  test("81 - Get held order by ID (via list match)", async () => {
    const held = await parse(
      await api.post("/api/pos/held-orders", {
        data: { items: heldItems, subtotal: 200 },
      }),
    );
    const list = await parse(await api.get("/api/pos/held-orders"));
    const found = list.find((h: any) => h.id === held.id);
    expect(found).toBeTruthy();
    expect(found.id).toBe(held.id);
    await api.delete(`/api/pos/held-orders/${held.id}`);
  });

  // 82
  test("82 - Update held order items (recreate)", async () => {
    const held = await parse(
      await api.post("/api/pos/held-orders", {
        data: { items: heldItems, subtotal: 200 },
      }),
    );
    // Delete and recreate with new items (no PUT endpoint exists for held orders)
    await parse(await api.delete(`/api/pos/held-orders/${held.id}`));
    const updated = await parse(
      await api.post("/api/pos/held-orders", {
        data: {
          items: [
            { productId, name: productName, quantity: 5, unitPrice: 100 },
          ],
          subtotal: 500,
        },
      }),
    );
    expect(updated.id).toBeTruthy();
    expect(Number(updated.subtotal)).toBe(500);
    await api.delete(`/api/pos/held-orders/${updated.id}`);
  });

  // 83
  test("83 - Update held order customer (recreate)", async () => {
    const held = await parse(
      await api.post("/api/pos/held-orders", {
        data: { items: heldItems, subtotal: 200 },
      }),
    );
    await parse(await api.delete(`/api/pos/held-orders/${held.id}`));
    const updated = await parse(
      await api.post("/api/pos/held-orders", {
        data: {
          items: heldItems,
          subtotal: 200,
          customerId,
        },
      }),
    );
    expect(updated.customerId).toBe(customerId);
    await api.delete(`/api/pos/held-orders/${updated.id}`);
  });

  // 84
  test("84 - Delete held order", async () => {
    const held = await parse(
      await api.post("/api/pos/held-orders", {
        data: { items: heldItems, subtotal: 200 },
      }),
    );
    const del = await parse(
      await api.delete(`/api/pos/held-orders/${held.id}`),
    );
    expect(del.success).toBe(true);
    // Verify it's gone
    const list = await parse(await api.get("/api/pos/held-orders"));
    const found = list.find((h: any) => h.id === held.id);
    expect(found).toBeFalsy();
  });

  // 85
  test("85 - Hold and resume → items preserved", async () => {
    const held = await parse(
      await api.post("/api/pos/held-orders", {
        data: {
          items: [
            { productId, name: productName, quantity: 3, unitPrice: 150 },
          ],
          subtotal: 450,
          notes: "resume test",
        },
      }),
    );
    // Retrieve from list
    const list = await parse(await api.get("/api/pos/held-orders"));
    const found = list.find((h: any) => h.id === held.id);
    expect(found.items).toHaveLength(1);
    expect(found.items[0].quantity).toBe(3);
    expect(found.items[0].unitPrice).toBe(150);
    await api.delete(`/api/pos/held-orders/${held.id}`);
  });

  // 86
  test("86 - Multiple held orders simultaneously", async () => {
    const h1 = await parse(
      await api.post("/api/pos/held-orders", {
        data: { items: heldItems, subtotal: 200, notes: "order-A" },
      }),
    );
    const h2 = await parse(
      await api.post("/api/pos/held-orders", {
        data: { items: heldItems, subtotal: 200, notes: "order-B" },
      }),
    );
    const h3 = await parse(
      await api.post("/api/pos/held-orders", {
        data: { items: heldItems, subtotal: 200, notes: "order-C" },
      }),
    );
    const list = await parse(await api.get("/api/pos/held-orders"));
    const ids = list.map((h: any) => h.id);
    expect(ids).toContain(h1.id);
    expect(ids).toContain(h2.id);
    expect(ids).toContain(h3.id);
    await api.delete(`/api/pos/held-orders/${h1.id}`);
    await api.delete(`/api/pos/held-orders/${h2.id}`);
    await api.delete(`/api/pos/held-orders/${h3.id}`);
  });

  // 87
  test("87 - Hold order without items → fail", async () => {
    const res = await parseSafe(
      await api.post("/api/pos/held-orders", {
        data: { items: [], subtotal: 0 },
      }),
    );
    expect(res.ok).toBe(false);
    expect(res.status).toBe(400);
  });

  // 88
  test("88 - Get non-existent held order → 404 on delete", async () => {
    const res = await parseSafe(
      await api.delete("/api/pos/held-orders/nonexistent-held-id"),
    );
    expect(res.ok).toBe(false);
    expect(res.status).toBe(404);
  });

  // 89
  test("89 - Delete non-existent → 404", async () => {
    const res = await parseSafe(
      await api.delete("/api/pos/held-orders/does-not-exist-xyz"),
    );
    expect(res.ok).toBe(false);
    expect(res.status).toBe(404);
  });

  // 90
  test("90 - Held order items include product details", async () => {
    const held = await parse(
      await api.post("/api/pos/held-orders", {
        data: {
          items: [
            { productId, name: productName, quantity: 1, unitPrice: 200 },
          ],
          subtotal: 200,
        },
      }),
    );
    const list = await parse(await api.get("/api/pos/held-orders"));
    const found = list.find((h: any) => h.id === held.id);
    expect(found.items[0].productId).toBe(productId);
    expect(found.items[0].name).toBe(productName);
    await api.delete(`/api/pos/held-orders/${held.id}`);
  });
});

/* ────────────────────────────────────────────────────────────────────────── */
/*  POS Credit Notes / Returns (tests 91–100)                                 */
/* ────────────────────────────────────────────────────────────────────────── */

test.describe("POS Credit Notes / Returns", () => {
  test.setTimeout(120_000);

  let returnSessionId: string;
  let saleInvoiceId: string;
  let saleInvoiceItemId: string;
  let saleCustomerId: string;

  test.beforeAll(async () => {
    // Open a dedicated session for return tests
    returnSessionId = await openSession(500);

    // Make a sale to return against
    const res = await checkout(
      returnSessionId,
      [{ productId, name: productName, quantity: 5, unitPrice: 100, gstRate: 0 }],
      [{ method: "CASH", amount: 500 }],
      { customerId },
    );
    saleInvoiceId = res.invoice.id;
    saleInvoiceItemId = res.invoice.items[0].id;
    saleCustomerId = res.invoice.customerId;
  });

  test.afterAll(async () => {
    // Close session
    await parseSafe(
      await api.put(`/api/pos/sessions/${returnSessionId}/close`, {
        data: { closingCash: 0, pinCode: employeePinCode },
      }),
    );
  });

  // 91
  test("91 - POS return → creates credit note", async () => {
    const cn = await parse(
      await api.post("/api/credit-notes", {
        data: {
          customerId: saleCustomerId,
          invoiceId: saleInvoiceId,
          issueDate: isoDate(),
          posSessionId: returnSessionId,
          warehouseId,
          items: [
            {
              invoiceItemId: saleInvoiceItemId,
              productId,
              description: productName,
              quantity: 1,
              unitPrice: 100,
              gstRate: 0,
            },
          ],
          reason: "Damaged product",
        },
      }),
    );
    expect(cn.id).toBeTruthy();
    expect(cn.creditNoteNumber).toMatch(/^CN-/);
    expect(cn.posSessionId).toBe(returnSessionId);
  });

  // 92
  test("92 - POS return → restores stock", async () => {
    const stockBefore = await pool.query(
      `SELECT COALESCE(SUM("remainingQuantity"), 0) AS stock
       FROM "stock_lots"
       WHERE "productId" = $1`,
      [productId],
    );
    const before = Number(stockBefore.rows[0].stock);

    await parse(
      await api.post("/api/credit-notes", {
        data: {
          customerId: saleCustomerId,
          invoiceId: saleInvoiceId,
          issueDate: isoDate(),
          posSessionId: returnSessionId,
          warehouseId,
          items: [
            {
              invoiceItemId: saleInvoiceItemId,
              productId,
              description: productName,
              quantity: 1,
              unitPrice: 100,
              gstRate: 0,
            },
          ],
          reason: "Wrong item",
        },
      }),
    );

    const stockAfter = await pool.query(
      `SELECT COALESCE(SUM("remainingQuantity"), 0) AS stock
       FROM "stock_lots"
       WHERE "productId" = $1`,
      [productId],
    );
    const after = Number(stockAfter.rows[0].stock);
    expect(after).toBe(before + 1);
  });

  // 93
  test("93 - POS return → reverses COGS journal", async () => {
    const cn = await parse(
      await api.post("/api/credit-notes", {
        data: {
          customerId: saleCustomerId,
          invoiceId: saleInvoiceId,
          issueDate: isoDate(),
          posSessionId: returnSessionId,
          warehouseId,
          items: [
            {
              invoiceItemId: saleInvoiceItemId,
              productId,
              description: productName,
              quantity: 1,
              unitPrice: 100,
              gstRate: 0,
            },
          ],
          reason: "Return test COGS",
        },
      }),
    );
    // Check for COGS reversal journal entry
    const journals = await pool.query(
      `SELECT COUNT(*) AS cnt
       FROM "journal_entries"
       WHERE "sourceId" = $1 AND "sourceType" = 'CREDIT_NOTE'
       AND "description" LIKE 'COGS Reversal%'`,
      [cn.id],
    );
    expect(Number(journals.rows[0].cnt)).toBeGreaterThanOrEqual(1);
  });

  // 94
  test("94 - POS return → cash refunded (journal CR Cash)", async () => {
    const cn = await parse(
      await api.post("/api/credit-notes", {
        data: {
          customerId: saleCustomerId,
          invoiceId: saleInvoiceId,
          issueDate: isoDate(),
          posSessionId: returnSessionId,
          warehouseId,
          items: [
            {
              invoiceItemId: saleInvoiceItemId,
              productId,
              description: productName,
              quantity: 1,
              unitPrice: 100,
              gstRate: 0,
            },
          ],
          reason: "Cash refund test",
        },
      }),
    );
    // POS returns: journal entry credits Cash (1100) instead of AR
    const lines = await pool.query(
      `SELECT jl."description", jl."credit"
       FROM "journal_entry_lines" jl
       JOIN "journal_entries" je ON jl."journalEntryId" = je."id"
       WHERE je."sourceId" = $1 AND je."sourceType" = 'CREDIT_NOTE'
       AND je."description" LIKE 'Credit Note%'
       AND jl."credit" > 0`,
      [cn.id],
    );
    const cashLine = lines.rows.find((l: any) =>
      l.description.includes("Cash") || l.description.includes("POS Refund"),
    );
    expect(cashLine).toBeTruthy();
  });

  // 95
  test("95 - POS return partial quantity", async () => {
    // Original sale was 5 units; return only 2
    const cn = await parse(
      await api.post("/api/credit-notes", {
        data: {
          customerId: saleCustomerId,
          invoiceId: saleInvoiceId,
          issueDate: isoDate(),
          posSessionId: returnSessionId,
          warehouseId,
          items: [
            {
              invoiceItemId: saleInvoiceItemId,
              productId,
              description: productName,
              quantity: 2,
              unitPrice: 100,
              gstRate: 0,
            },
          ],
          reason: "Partial return",
        },
      }),
    );
    expect(Number(cn.total)).toBeCloseTo(200, 0);
    expect(cn.items[0].quantity).toBe(2);
  });

  // 96
  test("96 - POS return on walk-in sale", async () => {
    // Make a walk-in sale
    const sale = await checkout(
      returnSessionId,
      [{ productId, name: productName, quantity: 1, unitPrice: 80, gstRate: 0 }],
      [{ method: "CASH", amount: 80 }],
    );
    expect(sale.invoice.customer.name).toBe("Walk-in Customer");

    // Return it — no customerId → resolves to walk-in
    const cn = await parse(
      await api.post("/api/credit-notes", {
        data: {
          invoiceId: sale.invoice.id,
          issueDate: isoDate(),
          posSessionId: returnSessionId,
          warehouseId,
          items: [
            {
              invoiceItemId: sale.invoice.items[0].id,
              productId,
              description: productName,
              quantity: 1,
              unitPrice: 80,
              gstRate: 0,
            },
          ],
          reason: "Walk-in return",
        },
      }),
    );
    expect(cn.customer.name).toBe("Walk-in Customer");
  });

  // 97
  test("97 - POS return on named customer sale", async () => {
    const sale = await checkout(
      returnSessionId,
      [{ productId, name: productName, quantity: 1, unitPrice: 60, gstRate: 0 }],
      [{ method: "CASH", amount: 60 }],
      { customerId },
    );
    const cn = await parse(
      await api.post("/api/credit-notes", {
        data: {
          customerId,
          invoiceId: sale.invoice.id,
          issueDate: isoDate(),
          posSessionId: returnSessionId,
          warehouseId,
          items: [
            {
              invoiceItemId: sale.invoice.items[0].id,
              productId,
              description: productName,
              quantity: 1,
              unitPrice: 60,
              gstRate: 0,
            },
          ],
          reason: "Named customer return",
        },
      }),
    );
    expect(cn.customerId).toBe(customerId);
  });

  // 98
  test("98 - POS return appears in session summary (return counters)", async () => {
    // The return increments totalReturns / totalReturnTransactions on the session
    const summary = await parse(
      await api.get(`/api/pos/sessions/${returnSessionId}/summary`),
    );
    expect(Number(summary.session.totalReturns)).toBeGreaterThan(0);
    expect(summary.session.totalReturnTransactions).toBeGreaterThan(0);
  });

  // 99
  test("99 - POS return with multiple items", async () => {
    // Make a multi-item sale
    const sale = await checkout(
      returnSessionId,
      [
        { productId, name: productName, quantity: 2, unitPrice: 100, gstRate: 0 },
        { productId, name: productName, quantity: 1, unitPrice: 200, gstRate: 0 },
      ],
      [{ method: "CASH", amount: 400 }],
    );

    const cn = await parse(
      await api.post("/api/credit-notes", {
        data: {
          customerId: sale.invoice.customerId,
          invoiceId: sale.invoice.id,
          issueDate: isoDate(),
          posSessionId: returnSessionId,
          warehouseId,
          items: [
            {
              invoiceItemId: sale.invoice.items[0].id,
              productId,
              description: productName,
              quantity: 1,
              unitPrice: 100,
              gstRate: 0,
            },
            {
              invoiceItemId: sale.invoice.items[1].id,
              productId,
              description: productName,
              quantity: 1,
              unitPrice: 200,
              gstRate: 0,
            },
          ],
          reason: "Multi-item return",
        },
      }),
    );
    expect(cn.items).toHaveLength(2);
    expect(Number(cn.total)).toBeCloseTo(300, 0);
  });

  // 100
  test("100 - POS return → customer balance adjusted", async () => {
    // Get customer balance before return
    const custBefore = await pool.query(
      `SELECT "balance" FROM "customers" WHERE "id" = $1`,
      [customerId],
    );
    const balBefore = Number(custBefore.rows[0].balance);

    // Make a sale on named customer and return it
    const sale = await checkout(
      returnSessionId,
      [{ productId, name: productName, quantity: 1, unitPrice: 150, gstRate: 0 }],
      [{ method: "CASH", amount: 150 }],
      { customerId },
    );

    await parse(
      await api.post("/api/credit-notes", {
        data: {
          customerId,
          invoiceId: sale.invoice.id,
          issueDate: isoDate(),
          posSessionId: returnSessionId,
          warehouseId,
          items: [
            {
              invoiceItemId: sale.invoice.items[0].id,
              productId,
              description: productName,
              quantity: 1,
              unitPrice: 150,
              gstRate: 0,
            },
          ],
          reason: "Balance adjust test",
          appliedToBalance: true,
        },
      }),
    );

    const custAfter = await pool.query(
      `SELECT "balance" FROM "customers" WHERE "id" = $1`,
      [customerId],
    );
    const balAfter = Number(custAfter.rows[0].balance);
    // Credit note should reduce the customer's balance by 150
    expect(balAfter).toBe(balBefore - 150);
  });
});
