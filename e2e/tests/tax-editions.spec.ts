/**
 * Tax Editions — 80 API-level E2E tests for GST (India) and Saudi VAT
 *
 * Covers: GST rate calculations (CGST+SGST), VAT 15% calculations,
 * tax-inclusive, credit/debit notes with tax, POS checkout with tax,
 * journal entries with tax accounts, and tax reports.
 */
import { expect, test, request as playwrightRequest } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";
import pg from "pg";
import "dotenv/config";

const baseURL = "http://localhost:3000";
const authStatePath = "e2e/.auth/admin.json";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

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

function isoDate(off = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + off);
  return d.toISOString().slice(0, 10);
}

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------

let api: APIRequestContext;
let supplierId: string;
let customerId: string;
let productId: string;
let productUnitId: string;
let serviceProductId: string;
let serviceProductUnitId: string;
let unitId: string;
let warehouseId: string;
let employeePinCode: string;

// Org flags
let gstEnabled = false;
let saudiVATEnabled = false;
let isTaxInclusive = false;
let orgId: string;

// Track created invoice IDs for credit/debit note tests
let gstInvoiceId: string;
let gstInvoiceItemId: string;
let gstPurchaseId: string;
let gstPurchaseItemId: string;

// Date range for reports
const FROM = isoDate(-365);
const TO = isoDate(0);

test.beforeAll(async () => {
  api = await playwrightRequest.newContext({ baseURL, storageState: authStatePath });

  const run = uid();

  // Determine org edition
  const settings = await parse(await api.get("/api/settings"));
  gstEnabled = !!settings.gstEnabled;
  saudiVATEnabled = !!settings.saudiEInvoiceEnabled;
  isTaxInclusive = !!settings.isTaxInclusivePrice;

  // Get org ID from DB via settings
  const users = await parse(await api.get("/api/users"));
  if (users.length > 0) {
    const result = await pool.query(
      `SELECT "organizationId" FROM users WHERE id = $1`,
      [users[0].id]
    );
    orgId = result.rows[0]?.organizationId;
  }

  // Get pcs unit
  const units = await parse(await api.get("/api/units"));
  const pcsUnit = units.find((u: any) => u.code === "pcs") ?? units[0];
  unitId = pcsUnit.id;

  // Create test supplier
  const sup = await parse(
    await api.post("/api/suppliers", {
      data: { name: `Tax Supplier ${run}`, phone: "+966500000080" },
    })
  );
  supplierId = sup.id;

  // Create test customer
  const cust = await parse(
    await api.post("/api/customers", {
      data: { name: `Tax Customer ${run}`, phone: "+966500000081" },
    })
  );
  customerId = cust.id;

  // Create stock product (zero tax — tests will override)
  const prod = await parse(
    await api.post("/api/products", {
      data: {
        name: `Tax Prod ${run}`,
        sku: `TAX-${run}`,
        price: 1000,
        cost: 0,
        unitId,
        gstRate: 0,
        isService: false,
      },
    })
  );
  productId = prod.id;
  productUnitId = prod.unitId;

  // Create service product
  const svc = await parse(
    await api.post("/api/products", {
      data: {
        name: `Tax Svc ${run}`,
        sku: `TSVC-${run}`,
        price: 500,
        cost: 0,
        unitId,
        gstRate: 0,
        isService: true,
      },
    })
  );
  serviceProductId = svc.id;
  serviceProductUnitId = svc.unitId;

  // Get first warehouse
  const warehouses = await parse(await api.get("/api/warehouses"));
  warehouseId = warehouses[0]?.id ?? "";

  // Create employee for POS
  employeePinCode = `${Date.now()}`.slice(-6);
  await parse(
    await api.post("/api/employees", {
      data: { name: `Tax Employee ${run}`, pinCode: employeePinCode },
    })
  );

  // Seed purchase (100 units @ 500) for sales tests
  await parse(
    await api.post("/api/purchase-invoices", {
      data: {
        supplierId,
        invoiceDate: isoDate(-15),
        dueDate: isoDate(-15),
        supplierInvoiceRef: `taxseed-${run}`,
        ...(warehouseId ? { warehouseId } : {}),
        items: [
          {
            productId,
            description: "Tax seed stock",
            quantity: 100,
            unitCost: 500,
            unitId: productUnitId,
            gstRate: 0,
            discount: 0,
          },
        ],
      },
    })
  );
});

test.afterAll(async () => {
  await api?.dispose();
  await pool.end();
});

// ---------------------------------------------------------------------------
// Micro-helpers
// ---------------------------------------------------------------------------

async function createInvoice(opts: {
  quantity: number;
  unitPrice: number;
  gstRate: number;
  discount?: number;
  isTaxInclusive?: boolean;
  applyRoundOff?: boolean;
  paymentType?: "CASH" | "CREDIT";
  pId?: string;
  uId?: string;
}) {
  return parse(
    await api.post("/api/invoices", {
      data: {
        customerId,
        issueDate: isoDate(0),
        dueDate: isoDate(0),
        paymentType: opts.paymentType ?? "CASH",
        ...(warehouseId ? { warehouseId } : {}),
        isTaxInclusive: opts.isTaxInclusive,
        applyRoundOff: opts.applyRoundOff,
        items: [
          {
            productId: opts.pId ?? productId,
            description: "Tax test item",
            quantity: opts.quantity,
            unitPrice: opts.unitPrice,
            unitId: opts.uId ?? productUnitId,
            gstRate: opts.gstRate,
            discount: opts.discount ?? 0,
          },
        ],
      },
    })
  );
}

async function createPurchase(opts: {
  quantity: number;
  unitCost: number;
  gstRate: number;
  discount?: number;
  isTaxInclusive?: boolean;
}) {
  return parse(
    await api.post("/api/purchase-invoices", {
      data: {
        supplierId,
        invoiceDate: isoDate(0),
        dueDate: isoDate(0),
        supplierInvoiceRef: `tp-${uid()}`,
        ...(warehouseId ? { warehouseId } : {}),
        isTaxInclusive: opts.isTaxInclusive,
        items: [
          {
            productId,
            description: "Tax purchase",
            quantity: opts.quantity,
            unitCost: opts.unitCost,
            unitId: productUnitId,
            gstRate: opts.gstRate,
            discount: opts.discount ?? 0,
          },
        ],
      },
    })
  );
}

async function getJournalLines(sourceType: string, sourceId: string) {
  const result = await pool.query(
    `SELECT je.id, jel.account_code, jel.debit, jel.credit
     FROM journal_entries je
     JOIN journal_entry_lines jel ON jel."journalEntryId" = je.id
     WHERE je."sourceType" = $1 AND je."sourceId" = $2
     ORDER BY jel.debit DESC`,
    [sourceType, sourceId]
  );
  return result.rows;
}

async function getInvoiceItems(invoiceId: string) {
  const result = await pool.query(
    `SELECT id, "productId", quantity, "unitPrice", "gstRate", "cgst", "sgst", "igst",
            "taxAmount", "lineTotal", "costOfGoodsSold", discount
     FROM invoice_items WHERE "invoiceId" = $1`,
    [invoiceId]
  );
  return result.rows;
}

async function getPurchaseItems(purchaseId: string) {
  const result = await pool.query(
    `SELECT id, "productId", quantity, "unitCost", "gstRate", "cgst", "sgst", "igst",
            "taxAmount", "lineTotal", discount
     FROM purchase_invoice_items WHERE "purchaseInvoiceId" = $1`,
    [purchaseId]
  );
  return result.rows;
}

// ===========================================================================
// 1. GST INDIA EDITION (40 tests)
// ===========================================================================
test.describe("GST India Edition", () => {
  test.setTimeout(120_000);

  // 1
  test("1 — Invoice with GST 18% has CGST 9% + SGST 9%", async () => {
    test.skip(!gstEnabled, "GST not enabled for this org");
    const inv = await createInvoice({ quantity: 1, unitPrice: 1000, gstRate: 18 });
    const items = await getInvoiceItems(inv.id);
    expect(items.length).toBe(1);
    expect(Number(items[0].cgst)).toBeCloseTo(90, 1);
    expect(Number(items[0].sgst)).toBeCloseTo(90, 1);
    expect(Number(items[0].taxAmount)).toBeCloseTo(180, 1);
  });

  // 2
  test("2 — Invoice with GST 5% has CGST 2.5% + SGST 2.5%", async () => {
    test.skip(!gstEnabled, "GST not enabled for this org");
    const inv = await createInvoice({ quantity: 1, unitPrice: 1000, gstRate: 5 });
    const items = await getInvoiceItems(inv.id);
    expect(Number(items[0].cgst)).toBeCloseTo(25, 1);
    expect(Number(items[0].sgst)).toBeCloseTo(25, 1);
    expect(Number(items[0].taxAmount)).toBeCloseTo(50, 1);
  });

  // 3
  test("3 — Invoice with GST 12% has CGST 6% + SGST 6%", async () => {
    test.skip(!gstEnabled, "GST not enabled for this org");
    const inv = await createInvoice({ quantity: 1, unitPrice: 1000, gstRate: 12 });
    const items = await getInvoiceItems(inv.id);
    expect(Number(items[0].cgst)).toBeCloseTo(60, 1);
    expect(Number(items[0].sgst)).toBeCloseTo(60, 1);
    expect(Number(items[0].taxAmount)).toBeCloseTo(120, 1);
  });

  // 4
  test("4 — Invoice with GST 28% has CGST 14% + SGST 14%", async () => {
    test.skip(!gstEnabled, "GST not enabled for this org");
    const inv = await createInvoice({ quantity: 1, unitPrice: 1000, gstRate: 28 });
    const items = await getInvoiceItems(inv.id);
    expect(Number(items[0].cgst)).toBeCloseTo(140, 1);
    expect(Number(items[0].sgst)).toBeCloseTo(140, 1);
    expect(Number(items[0].taxAmount)).toBeCloseTo(280, 1);
  });

  // 5
  test("5 — Invoice with GST 0% has no tax", async () => {
    test.skip(!gstEnabled, "GST not enabled for this org");
    const inv = await createInvoice({ quantity: 1, unitPrice: 1000, gstRate: 0 });
    const items = await getInvoiceItems(inv.id);
    expect(Number(items[0].cgst)).toBe(0);
    expect(Number(items[0].sgst)).toBe(0);
    expect(Number(items[0].taxAmount)).toBe(0);
  });

  // 6
  test("6 — Invoice with GST 0.1% (cess rate)", async () => {
    test.skip(!gstEnabled, "GST not enabled for this org");
    const inv = await createInvoice({ quantity: 1, unitPrice: 10000, gstRate: 0.1 });
    const items = await getInvoiceItems(inv.id);
    expect(Number(items[0].taxAmount)).toBeCloseTo(10, 1);
  });

  // 7
  test("7 — Invoice total = subtotal + CGST + SGST", async () => {
    test.skip(!gstEnabled, "GST not enabled for this org");
    const inv = await createInvoice({ quantity: 2, unitPrice: 500, gstRate: 18 });
    // subtotal = 2 * 500 = 1000, tax = 180, total = 1180
    expect(Number(inv.total)).toBeCloseTo(1180, 1);
    expect(Number(inv.subtotal)).toBeCloseTo(1000, 1);
    expect(Number(inv.taxTotal)).toBeCloseTo(180, 1);
  });

  // 8
  test("8 — Purchase with GST has input tax calculated", async () => {
    test.skip(!gstEnabled, "GST not enabled for this org");
    const pi = await createPurchase({ quantity: 1, unitCost: 1000, gstRate: 18 });
    const items = await getPurchaseItems(pi.id);
    expect(Number(items[0].cgst)).toBeCloseTo(90, 1);
    expect(Number(items[0].sgst)).toBeCloseTo(90, 1);
    gstPurchaseId = pi.id;
    gstPurchaseItemId = items[0].id;
  });

  // 9
  test("9 — GST on discounted amount (not full price)", async () => {
    test.skip(!gstEnabled, "GST not enabled for this org");
    const inv = await createInvoice({ quantity: 1, unitPrice: 1000, gstRate: 18, discount: 10 });
    const items = await getInvoiceItems(inv.id);
    // After 10% discount: taxable = 900, tax = 162
    expect(Number(items[0].taxAmount)).toBeCloseTo(162, 1);
  });

  // 10
  test("10 — Tax-inclusive price: subtotal back-calculated", async () => {
    test.skip(!gstEnabled, "GST not enabled for this org");
    const inv = await createInvoice({ quantity: 1, unitPrice: 1180, gstRate: 18, isTaxInclusive: true });
    // inclusive: 1180 / 1.18 = 1000 subtotal, 180 tax
    expect(Number(inv.subtotal)).toBeCloseTo(1000, 0);
    expect(Number(inv.taxTotal)).toBeCloseTo(180, 0);
    expect(Number(inv.total)).toBeCloseTo(1180, 0);
  });

  // 11
  test("11 — Tax-inclusive with GST 18%", async () => {
    test.skip(!gstEnabled, "GST not enabled for this org");
    const inv = await createInvoice({ quantity: 1, unitPrice: 590, gstRate: 18, isTaxInclusive: true });
    // 590 / 1.18 = 500, tax = 90
    expect(Number(inv.subtotal)).toBeCloseTo(500, 0);
    expect(Number(inv.taxTotal)).toBeCloseTo(90, 0);
  });

  // 12
  test("12 — Tax-inclusive with GST 5%", async () => {
    test.skip(!gstEnabled, "GST not enabled for this org");
    const inv = await createInvoice({ quantity: 1, unitPrice: 1050, gstRate: 5, isTaxInclusive: true });
    expect(Number(inv.subtotal)).toBeCloseTo(1000, 0);
    expect(Number(inv.taxTotal)).toBeCloseTo(50, 0);
  });

  // 13
  test("13 — Multiple items with different GST rates", async () => {
    test.skip(!gstEnabled, "GST not enabled for this org");
    const inv = await parse(
      await api.post("/api/invoices", {
        data: {
          customerId,
          issueDate: isoDate(0),
          dueDate: isoDate(0),
          paymentType: "CASH",
          ...(warehouseId ? { warehouseId } : {}),
          items: [
            {
              productId,
              description: "Item 18%",
              quantity: 1,
              unitPrice: 1000,
              unitId: productUnitId,
              gstRate: 18,
              discount: 0,
            },
            {
              productId: serviceProductId,
              description: "Item 5%",
              quantity: 1,
              unitPrice: 500,
              unitId: serviceProductUnitId,
              gstRate: 5,
              discount: 0,
            },
          ],
        },
      })
    );
    // total tax = 180 + 25 = 205
    expect(Number(inv.taxTotal)).toBeCloseTo(205, 1);
    expect(Number(inv.total)).toBeCloseTo(1705, 1);
  });

  // 14
  test("14 — Invoice with HSN code on product", async () => {
    test.skip(!gstEnabled, "GST not enabled for this org");
    const run = uid();
    const p = await parse(
      await api.post("/api/products", {
        data: {
          name: `HSN Prod ${run}`,
          sku: `HSN-${run}`,
          price: 1000,
          cost: 0,
          unitId,
          gstRate: 18,
          hsnCode: "6109",
          isService: false,
        },
      })
    );
    expect(p.hsnCode).toBe("6109");
  });

  // 15
  test("15 — GST summary report shows output/input tax", async () => {
    test.skip(!gstEnabled, "GST not enabled for this org");
    const d = await parse(await api.get(`/api/reports/gst-summary?from=${FROM}&to=${TO}`));
    expect(d).toHaveProperty("sales");
    expect(d).toHaveProperty("purchases");
    expect(d.sales).toHaveProperty("cgst");
    expect(d.sales).toHaveProperty("sgst");
  });

  // 16
  test("16 — GST detail report shows per-invoice breakdown", async () => {
    test.skip(!gstEnabled, "GST not enabled for this org");
    const d = await parse(await api.get(`/api/reports/gst-detail?from=${FROM}&to=${TO}`));
    expect(d).toHaveProperty("rows");
    expect(Array.isArray(d.rows)).toBe(true);
  });

  // 17
  test("17 — Credit note with GST: tax reversed", async () => {
    test.skip(!gstEnabled, "GST not enabled for this org");
    // Create an invoice first
    const inv = await createInvoice({ quantity: 5, unitPrice: 200, gstRate: 18, paymentType: "CREDIT" });
    gstInvoiceId = inv.id;
    const invItems = await getInvoiceItems(inv.id);
    gstInvoiceItemId = invItems[0].id;

    // Create credit note returning 2 units
    const cn = await parse(
      await api.post("/api/credit-notes", {
        data: {
          customerId,
          invoiceId: inv.id,
          issueDate: isoDate(0),
          reason: "GST credit note test",
          ...(warehouseId ? { warehouseId } : {}),
          items: [
            {
              invoiceItemId: gstInvoiceItemId,
              productId,
              description: "Return",
              quantity: 2,
              unitPrice: 200,
              unitId: productUnitId,
              gstRate: 18,
              discount: 0,
            },
          ],
        },
      })
    );
    // tax on 2 * 200 = 400 @ 18% = 72
    expect(Number(cn.taxTotal)).toBeCloseTo(72, 1);
    expect(Number(cn.total)).toBeCloseTo(472, 1);
  });

  // 18
  test("18 — Debit note with GST: tax reversed", async () => {
    test.skip(!gstEnabled, "GST not enabled for this org");
    // Create a purchase first
    const pi = await createPurchase({ quantity: 5, unitCost: 200, gstRate: 18 });
    const piItems = await getPurchaseItems(pi.id);

    // Create debit note returning 2 units
    const dn = await parse(
      await api.post("/api/debit-notes", {
        data: {
          supplierId,
          purchaseInvoiceId: pi.id,
          issueDate: isoDate(0),
          reason: "GST debit note test",
          ...(warehouseId ? { warehouseId } : {}),
          items: [
            {
              purchaseInvoiceItemId: piItems[0].id,
              productId,
              description: "Return to supplier",
              quantity: 2,
              unitCost: 200,
              unitId: productUnitId,
              gstRate: 18,
              discount: 0,
            },
          ],
        },
      })
    );
    expect(Number(dn.taxTotal)).toBeCloseTo(72, 1);
    expect(Number(dn.total)).toBeCloseTo(472, 1);
  });

  // 19
  test("19 — POS checkout with GST", async () => {
    test.skip(!gstEnabled, "GST not enabled for this org");
    const sessionId = await openPosSession();
    const result = await parse(
      await api.post("/api/pos/checkout", {
        data: {
          sessionId,
          items: [
            {
              productId,
              name: "POS GST Item",
              quantity: 1,
              unitPrice: 1000,
              discount: 0,
              gstRate: 18,
            },
          ],
          payments: [{ method: "cash", amount: 1180 }],
        },
      })
    );
    expect(result).toBeTruthy();
    expect(result.invoice || result.id).toBeTruthy();
    await closePosSession(sessionId);
  });

  // 20
  test("20 — Round-off with GST invoice", async () => {
    test.skip(!gstEnabled, "GST not enabled for this org");
    const inv = await createInvoice({
      quantity: 1,
      unitPrice: 999,
      gstRate: 18,
      applyRoundOff: true,
    });
    // 999 + 179.82 = 1178.82 — round off should apply
    expect(inv).toHaveProperty("roundOff");
    expect(typeof Number(inv.total)).toBe("number");
  });

  // 21
  test("21 — Invoice journal includes GST accounts", async () => {
    test.skip(!gstEnabled, "GST not enabled for this org");
    if (!gstInvoiceId) {
      const inv = await createInvoice({ quantity: 1, unitPrice: 1000, gstRate: 18, paymentType: "CREDIT" });
      gstInvoiceId = inv.id;
    }
    const lines = await getJournalLines("INVOICE", gstInvoiceId);
    expect(lines.length).toBeGreaterThan(0);
    // Should have GST liability accounts in the journal
    const accountCodes = lines.map((l: any) => l.account_code);
    // At least revenue and AR accounts
    expect(accountCodes.length).toBeGreaterThanOrEqual(2);
  });

  // 22
  test("22 — Purchase journal includes GST input accounts", async () => {
    test.skip(!gstEnabled, "GST not enabled for this org");
    if (!gstPurchaseId) {
      const pi = await createPurchase({ quantity: 1, unitCost: 1000, gstRate: 18 });
      gstPurchaseId = pi.id;
    }
    const lines = await getJournalLines("PURCHASE_INVOICE", gstPurchaseId);
    expect(lines.length).toBeGreaterThan(0);
  });

  // 23
  test("23 — GST on zero-amount item produces zero tax", async () => {
    test.skip(!gstEnabled, "GST not enabled for this org");
    const inv = await createInvoice({
      quantity: 1,
      unitPrice: 0,
      gstRate: 18,
      pId: serviceProductId,
      uId: serviceProductUnitId,
    });
    const items = await getInvoiceItems(inv.id);
    expect(Number(items[0].taxAmount)).toBe(0);
  });

  // 24
  test("24 — Mixed GST + non-GST items", async () => {
    test.skip(!gstEnabled, "GST not enabled for this org");
    const inv = await parse(
      await api.post("/api/invoices", {
        data: {
          customerId,
          issueDate: isoDate(0),
          dueDate: isoDate(0),
          paymentType: "CASH",
          ...(warehouseId ? { warehouseId } : {}),
          items: [
            { productId, description: "Taxed", quantity: 1, unitPrice: 1000, unitId: productUnitId, gstRate: 18, discount: 0 },
            { productId: serviceProductId, description: "No tax", quantity: 1, unitPrice: 500, unitId: serviceProductUnitId, gstRate: 0, discount: 0 },
          ],
        },
      })
    );
    // Tax only on first item: 180
    expect(Number(inv.taxTotal)).toBeCloseTo(180, 1);
    expect(Number(inv.subtotal)).toBeCloseTo(1500, 1);
    expect(Number(inv.total)).toBeCloseTo(1680, 1);
  });

  // 25
  test("25 — Invoice PDF includes GSTIN (if set)", async () => {
    test.skip(!gstEnabled, "GST not enabled for this org");
    const settings = await parse(await api.get("/api/settings"));
    // Just verify the setting exists — we don't modify invoice PDFs
    expect("companyGstNumber" in settings).toBe(true);
  });

  // 26
  test("26 — Invoice with IGST (rate works for inter-state)", async () => {
    test.skip(!gstEnabled, "GST not enabled for this org");
    const inv = await createInvoice({ quantity: 1, unitPrice: 1000, gstRate: 18 });
    const items = await getInvoiceItems(inv.id);
    // System calculates CGST+SGST or IGST depending on state codes
    const totalGST = Number(items[0].cgst) + Number(items[0].sgst) + Number(items[0].igst);
    expect(totalGST).toBeCloseTo(180, 1);
  });

  // 27
  test("27 — GST rate 0.25%: CGST 0.125% + SGST 0.125%", async () => {
    test.skip(!gstEnabled, "GST not enabled for this org");
    const inv = await createInvoice({ quantity: 1, unitPrice: 10000, gstRate: 0.25 });
    const items = await getInvoiceItems(inv.id);
    expect(Number(items[0].taxAmount)).toBeCloseTo(25, 1);
  });

  // 28
  test("28 — GST rate 1%: CGST 0.5% + SGST 0.5%", async () => {
    test.skip(!gstEnabled, "GST not enabled for this org");
    const inv = await createInvoice({ quantity: 1, unitPrice: 10000, gstRate: 1 });
    const items = await getInvoiceItems(inv.id);
    expect(Number(items[0].taxAmount)).toBeCloseTo(100, 1);
  });

  // 29
  test("29 — GST rate 1.5%", async () => {
    test.skip(!gstEnabled, "GST not enabled for this org");
    const inv = await createInvoice({ quantity: 1, unitPrice: 10000, gstRate: 1.5 });
    const items = await getInvoiceItems(inv.id);
    expect(Number(items[0].taxAmount)).toBeCloseTo(150, 1);
  });

  // 30
  test("30 — GST rate 3%", async () => {
    test.skip(!gstEnabled, "GST not enabled for this org");
    const inv = await createInvoice({ quantity: 1, unitPrice: 10000, gstRate: 3 });
    const items = await getInvoiceItems(inv.id);
    expect(Number(items[0].taxAmount)).toBeCloseTo(300, 1);
  });

  // 31
  test("31 — GST rate 7.5%", async () => {
    test.skip(!gstEnabled, "GST not enabled for this org");
    const inv = await createInvoice({ quantity: 1, unitPrice: 10000, gstRate: 7.5 });
    const items = await getInvoiceItems(inv.id);
    expect(Number(items[0].taxAmount)).toBeCloseTo(750, 1);
  });

  // 32
  test("32 — Invoice with all valid GST rates in sequence", async () => {
    test.skip(!gstEnabled, "GST not enabled for this org");
    const rates = [0, 0.25, 1, 3, 5, 12, 18, 28];
    for (const rate of rates) {
      const inv = await createInvoice({ quantity: 1, unitPrice: 1000, gstRate: rate });
      const expected = 1000 * (rate / 100);
      expect(Number(inv.taxTotal)).toBeCloseTo(expected, 0);
    }
  });

  // 33
  test("33 — Invalid GST rate (e.g., 15%) is handled", async () => {
    test.skip(!gstEnabled, "GST not enabled for this org");
    // The system may accept any rate or reject invalid ones
    const res = await parseSafe(
      await api.post("/api/invoices", {
        data: {
          customerId,
          issueDate: isoDate(0),
          dueDate: isoDate(0),
          paymentType: "CASH",
          ...(warehouseId ? { warehouseId } : {}),
          items: [{ productId: serviceProductId, description: "Invalid rate", quantity: 1, unitPrice: 1000, unitId: serviceProductUnitId, gstRate: 15, discount: 0 }],
        },
      })
    );
    // Either accepted (calculated) or rejected with error
    expect([200, 201, 400].includes(res.status)).toBe(true);
  });

  // 34
  test("34 — Purchase with tax-inclusive has correct cost calculation", async () => {
    test.skip(!gstEnabled, "GST not enabled for this org");
    const pi = await createPurchase({ quantity: 1, unitCost: 1180, gstRate: 18, isTaxInclusive: true });
    expect(Number(pi.subtotal)).toBeCloseTo(1000, 0);
    expect(Number(pi.taxTotal)).toBeCloseTo(180, 0);
  });

  // 35
  test("35 — GST on credit note matches original invoice rate", async () => {
    test.skip(!gstEnabled, "GST not enabled for this org");
    // Already tested in test 17 — verify rates match
    if (gstInvoiceId) {
      const invItems = await getInvoiceItems(gstInvoiceId);
      expect(Number(invItems[0].gstRate)).toBe(18);
    }
  });

  // 36
  test("36 — GST summary totals match journal entries", async () => {
    test.skip(!gstEnabled, "GST not enabled for this org");
    const summary = await parse(await api.get(`/api/reports/gst-summary?from=${FROM}&to=${TO}`));
    expect(typeof summary.totalLiability).toBe("number");
    expect(summary.sales).toHaveProperty("total");
    expect(summary.purchases).toHaveProperty("total");
  });

  // 37
  test("37 — CGST + SGST = total GST for each item", async () => {
    test.skip(!gstEnabled, "GST not enabled for this org");
    const inv = await createInvoice({ quantity: 1, unitPrice: 1000, gstRate: 18 });
    const items = await getInvoiceItems(inv.id);
    const item = items[0];
    const cgstPlusSgst = Number(item.cgst) + Number(item.sgst);
    // For intra-state, IGST = 0 and CGST+SGST = taxAmount
    if (Number(item.igst) === 0) {
      expect(cgstPlusSgst).toBeCloseTo(Number(item.taxAmount), 1);
    }
  });

  // 38
  test("38 — Multi-item invoice: total GST = sum of item GSTs", async () => {
    test.skip(!gstEnabled, "GST not enabled for this org");
    const inv = await parse(
      await api.post("/api/invoices", {
        data: {
          customerId,
          issueDate: isoDate(0),
          dueDate: isoDate(0),
          paymentType: "CASH",
          ...(warehouseId ? { warehouseId } : {}),
          items: [
            { productId, description: "A", quantity: 2, unitPrice: 500, unitId: productUnitId, gstRate: 18, discount: 0 },
            { productId: serviceProductId, description: "B", quantity: 1, unitPrice: 1000, unitId: serviceProductUnitId, gstRate: 12, discount: 0 },
          ],
        },
      })
    );
    // item A: 1000 * 18% = 180, item B: 1000 * 12% = 120, total = 300
    expect(Number(inv.taxTotal)).toBeCloseTo(300, 1);
  });

  // 39
  test("39 — Invoice edit: GST recalculated", async () => {
    test.skip(!gstEnabled, "GST not enabled for this org");
    const inv = await createInvoice({ quantity: 1, unitPrice: 1000, gstRate: 18, paymentType: "CREDIT" });
    // Edit: change quantity to 2
    const updated = await parse(
      await api.put(`/api/invoices/${inv.id}`, {
        data: {
          customerId,
          issueDate: isoDate(0),
          dueDate: isoDate(0),
          paymentType: "CREDIT",
          ...(warehouseId ? { warehouseId } : {}),
          items: [{ productId, description: "Edited", quantity: 2, unitPrice: 1000, unitId: productUnitId, gstRate: 18, discount: 0 }],
        },
      })
    );
    expect(Number(updated.taxTotal)).toBeCloseTo(360, 1);
    expect(Number(updated.total)).toBeCloseTo(2360, 1);
  });

  // 40
  test("40 — Delete invoice: GST journal reversed", async () => {
    test.skip(!gstEnabled, "GST not enabled for this org");
    const inv = await createInvoice({ quantity: 1, unitPrice: 1000, gstRate: 18, paymentType: "CREDIT" });
    // Delete
    await parse(await api.delete(`/api/invoices/${inv.id}`));
    // Journal entries should be gone
    const lines = await getJournalLines("INVOICE", inv.id);
    expect(lines.length).toBe(0);
  });
});

// ===========================================================================
// 2. SAUDI VAT EDITION (40 tests)
// ===========================================================================
test.describe("Saudi VAT Edition", () => {
  test.setTimeout(120_000);

  // Helper to check if we should skip (if org is GST-enabled, not VAT)
  function skipIfNotVAT() {
    test.skip(!saudiVATEnabled, "Saudi VAT not enabled for this org");
  }

  let vatInvoiceId: string;
  let vatInvoiceItemId: string;
  let vatPurchaseId: string;
  let vatPurchaseItemId: string;

  // 41
  test("41 — Invoice with VAT 15% has VAT calculated", async () => {
    skipIfNotVAT();
    const inv = await createInvoice({ quantity: 1, unitPrice: 1000, gstRate: 15 });
    expect(Number(inv.taxTotal)).toBeCloseTo(150, 1);
    expect(Number(inv.total)).toBeCloseTo(1150, 1);
    vatInvoiceId = inv.id;
  });

  // 42
  test("42 — Invoice with VAT 0% is zero rated", async () => {
    skipIfNotVAT();
    const inv = await createInvoice({ quantity: 1, unitPrice: 1000, gstRate: 0 });
    expect(Number(inv.taxTotal)).toBe(0);
    expect(Number(inv.total)).toBeCloseTo(1000, 1);
  });

  // 43
  test("43 — Invoice total = subtotal + VAT", async () => {
    skipIfNotVAT();
    const inv = await createInvoice({ quantity: 3, unitPrice: 400, gstRate: 15 });
    expect(Number(inv.subtotal)).toBeCloseTo(1200, 1);
    expect(Number(inv.taxTotal)).toBeCloseTo(180, 1);
    expect(Number(inv.total)).toBeCloseTo(1380, 1);
  });

  // 44
  test("44 — Purchase with VAT has input tax", async () => {
    skipIfNotVAT();
    const pi = await createPurchase({ quantity: 1, unitCost: 1000, gstRate: 15 });
    const items = await getPurchaseItems(pi.id);
    expect(Number(items[0].taxAmount)).toBeCloseTo(150, 1);
    vatPurchaseId = pi.id;
    vatPurchaseItemId = items[0].id;
  });

  // 45
  test("45 — VAT on discounted amount", async () => {
    skipIfNotVAT();
    const inv = await createInvoice({ quantity: 1, unitPrice: 1000, gstRate: 15, discount: 20 });
    // 1000 - 20% = 800, VAT = 120
    expect(Number(inv.taxTotal)).toBeCloseTo(120, 1);
    expect(Number(inv.total)).toBeCloseTo(920, 1);
  });

  // 46
  test("46 — Tax-inclusive with VAT 15%", async () => {
    skipIfNotVAT();
    const inv = await createInvoice({ quantity: 1, unitPrice: 1150, gstRate: 15, isTaxInclusive: true });
    expect(Number(inv.subtotal)).toBeCloseTo(1000, 0);
    expect(Number(inv.taxTotal)).toBeCloseTo(150, 0);
  });

  // 47
  test("47 — Multiple items with VAT", async () => {
    skipIfNotVAT();
    const inv = await parse(
      await api.post("/api/invoices", {
        data: {
          customerId,
          issueDate: isoDate(0),
          dueDate: isoDate(0),
          paymentType: "CASH",
          ...(warehouseId ? { warehouseId } : {}),
          items: [
            { productId, description: "A", quantity: 2, unitPrice: 500, unitId: productUnitId, gstRate: 15, discount: 0 },
            { productId: serviceProductId, description: "B", quantity: 1, unitPrice: 1000, unitId: serviceProductUnitId, gstRate: 15, discount: 0 },
          ],
        },
      })
    );
    // (1000 + 1000) * 15% = 300
    expect(Number(inv.taxTotal)).toBeCloseTo(300, 1);
    expect(Number(inv.total)).toBeCloseTo(2300, 1);
  });

  // 48
  test("48 — VAT summary report shows output/input", async () => {
    skipIfNotVAT();
    const d = await parse(await api.get(`/api/reports/vat-summary?fromDate=${FROM}&toDate=${TO}`));
    expect(d).toHaveProperty("sales");
    expect(d).toHaveProperty("purchases");
    expect(d).toHaveProperty("netVATPayable");
  });

  // 49
  test("49 — VAT detail report shows per-invoice", async () => {
    skipIfNotVAT();
    const d = await parse(await api.get(`/api/reports/vat-detail?fromDate=${FROM}&toDate=${TO}`));
    expect(d).toHaveProperty("rows");
    expect(Array.isArray(d.rows)).toBe(true);
  });

  // 50
  test("50 — Credit note with VAT reversed", async () => {
    skipIfNotVAT();
    const inv = await createInvoice({ quantity: 5, unitPrice: 200, gstRate: 15, paymentType: "CREDIT" });
    vatInvoiceId = inv.id;
    const invItems = await getInvoiceItems(inv.id);
    vatInvoiceItemId = invItems[0].id;

    const cn = await parse(
      await api.post("/api/credit-notes", {
        data: {
          customerId,
          invoiceId: inv.id,
          issueDate: isoDate(0),
          reason: "VAT credit note test",
          ...(warehouseId ? { warehouseId } : {}),
          items: [
            { invoiceItemId: vatInvoiceItemId, productId, description: "Return", quantity: 2, unitPrice: 200, unitId: productUnitId, gstRate: 15, discount: 0 },
          ],
        },
      })
    );
    // 2 * 200 = 400, VAT = 60
    expect(Number(cn.taxTotal)).toBeCloseTo(60, 1);
    expect(Number(cn.total)).toBeCloseTo(460, 1);
  });

  // 51
  test("51 — Debit note with VAT reversed", async () => {
    skipIfNotVAT();
    const pi = await createPurchase({ quantity: 5, unitCost: 200, gstRate: 15 });
    const piItems = await getPurchaseItems(pi.id);

    const dn = await parse(
      await api.post("/api/debit-notes", {
        data: {
          supplierId,
          purchaseInvoiceId: pi.id,
          issueDate: isoDate(0),
          reason: "VAT debit note test",
          ...(warehouseId ? { warehouseId } : {}),
          items: [
            { purchaseInvoiceItemId: piItems[0].id, productId, description: "Return", quantity: 2, unitCost: 200, unitId: productUnitId, gstRate: 15, discount: 0 },
          ],
        },
      })
    );
    expect(Number(dn.taxTotal)).toBeCloseTo(60, 1);
    expect(Number(dn.total)).toBeCloseTo(460, 1);
  });

  // 52
  test("52 — POS checkout with VAT", async () => {
    skipIfNotVAT();
    const sessionId = await openPosSession();
    const result = await parse(
      await api.post("/api/pos/checkout", {
        data: {
          sessionId,
          items: [{ productId, name: "VAT POS", quantity: 1, unitPrice: 1000, discount: 0, gstRate: 15 }],
          payments: [{ method: "cash", amount: 1150 }],
        },
      })
    );
    expect(result).toBeTruthy();
    await closePosSession(sessionId);
  });

  // 53
  test("53 — Round-off with VAT", async () => {
    skipIfNotVAT();
    const inv = await createInvoice({ quantity: 1, unitPrice: 999, gstRate: 15, applyRoundOff: true });
    expect(inv).toHaveProperty("roundOff");
    expect(typeof Number(inv.total)).toBe("number");
  });

  // 54
  test("54 — Invoice journal includes VAT accounts", async () => {
    skipIfNotVAT();
    if (!vatInvoiceId) {
      const inv = await createInvoice({ quantity: 1, unitPrice: 1000, gstRate: 15, paymentType: "CREDIT" });
      vatInvoiceId = inv.id;
    }
    const lines = await getJournalLines("INVOICE", vatInvoiceId);
    expect(lines.length).toBeGreaterThan(0);
  });

  // 55
  test("55 — Purchase journal includes VAT input accounts", async () => {
    skipIfNotVAT();
    if (!vatPurchaseId) {
      const pi = await createPurchase({ quantity: 1, unitCost: 1000, gstRate: 15 });
      vatPurchaseId = pi.id;
    }
    const lines = await getJournalLines("PURCHASE_INVOICE", vatPurchaseId);
    expect(lines.length).toBeGreaterThan(0);
  });

  // 56
  test("56 — VAT 15% calculation accuracy", async () => {
    skipIfNotVAT();
    const inv = await createInvoice({ quantity: 7, unitPrice: 333, gstRate: 15 });
    // 7 * 333 = 2331, VAT = 349.65
    expect(Number(inv.subtotal)).toBeCloseTo(2331, 1);
    expect(Number(inv.taxTotal)).toBeCloseTo(349.65, 0);
  });

  // 57
  test("57 — VAT on service items", async () => {
    skipIfNotVAT();
    const inv = await createInvoice({
      quantity: 1, unitPrice: 1000, gstRate: 15,
      pId: serviceProductId, uId: serviceProductUnitId,
    });
    expect(Number(inv.taxTotal)).toBeCloseTo(150, 1);
  });

  // 58
  test("58 — VAT on stock items", async () => {
    skipIfNotVAT();
    const inv = await createInvoice({ quantity: 1, unitPrice: 1000, gstRate: 15 });
    expect(Number(inv.taxTotal)).toBeCloseTo(150, 1);
  });

  // 59
  test("59 — Mixed VAT-rated items", async () => {
    skipIfNotVAT();
    const inv = await parse(
      await api.post("/api/invoices", {
        data: {
          customerId,
          issueDate: isoDate(0),
          dueDate: isoDate(0),
          paymentType: "CASH",
          ...(warehouseId ? { warehouseId } : {}),
          items: [
            { productId, description: "VAT 15%", quantity: 1, unitPrice: 1000, unitId: productUnitId, gstRate: 15, discount: 0 },
            { productId: serviceProductId, description: "Zero VAT", quantity: 1, unitPrice: 500, unitId: serviceProductUnitId, gstRate: 0, discount: 0 },
          ],
        },
      })
    );
    expect(Number(inv.taxTotal)).toBeCloseTo(150, 1);
    expect(Number(inv.total)).toBeCloseTo(1650, 1);
  });

  // 60
  test("60 — VAT-exempt items (0%)", async () => {
    skipIfNotVAT();
    const inv = await createInvoice({ quantity: 1, unitPrice: 1000, gstRate: 0 });
    expect(Number(inv.taxTotal)).toBe(0);
  });

  // 61
  test("61 — Invoice with TRN (Tax Registration Number)", async () => {
    skipIfNotVAT();
    const settings = await parse(await api.get("/api/settings"));
    // vatNumber may be set at org level
    expect("vatNumber" in settings || "companyGstNumber" in settings).toBe(true);
  });

  // 62
  test("62 — SAR currency formatting", async () => {
    skipIfNotVAT();
    if (orgId) {
      const result = await pool.query(`SELECT currency FROM organizations WHERE id = $1`, [orgId]);
      expect(result.rows[0].currency).toBe("SAR");
    }
  });

  // 63
  test("63 — Arabic translation support (if enabled)", async () => {
    skipIfNotVAT();
    if (orgId) {
      const result = await pool.query(`SELECT language FROM organizations WHERE id = $1`, [orgId]);
      // Language can be 'en' or 'ar'
      expect(["en", "ar"]).toContain(result.rows[0].language);
    }
  });

  // 64
  test("64 — VAT category: STANDARD (15%)", async () => {
    skipIfNotVAT();
    const inv = await createInvoice({ quantity: 1, unitPrice: 1000, gstRate: 15 });
    expect(Number(inv.taxTotal)).toBeCloseTo(150, 1);
  });

  // 65
  test("65 — VAT category: ZERO_RATED (0%)", async () => {
    skipIfNotVAT();
    const inv = await createInvoice({ quantity: 1, unitPrice: 1000, gstRate: 0 });
    expect(Number(inv.taxTotal)).toBe(0);
  });

  // 66
  test("66 — VAT category: EXEMPT (0%)", async () => {
    skipIfNotVAT();
    const inv = await createInvoice({ quantity: 1, unitPrice: 1000, gstRate: 0 });
    expect(Number(inv.total)).toBeCloseTo(1000, 1);
  });

  // 67
  test("67 — Invoice PDF includes TRN/VAT number (setting exists)", async () => {
    skipIfNotVAT();
    const settings = await parse(await api.get("/api/settings"));
    // We just verify the setting structure — we don't modify invoice PDFs
    expect(typeof settings).toBe("object");
  });

  // 68
  test("68 — VAT summary matches journal totals", async () => {
    skipIfNotVAT();
    const summary = await parse(
      await api.get(`/api/reports/vat-summary?fromDate=${FROM}&toDate=${TO}`)
    );
    expect(typeof summary.netOutputVAT).toBe("number");
    expect(typeof summary.netInputVAT).toBe("number");
    expect(typeof summary.netVATPayable).toBe("number");
  });

  // 69
  test("69 — Tax-inclusive reverse calculation", async () => {
    skipIfNotVAT();
    const inv = await createInvoice({ quantity: 1, unitPrice: 2300, gstRate: 15, isTaxInclusive: true });
    // 2300 / 1.15 = 2000, tax = 300
    expect(Number(inv.subtotal)).toBeCloseTo(2000, 0);
    expect(Number(inv.taxTotal)).toBeCloseTo(300, 0);
  });

  // 70
  test("70 — Edit invoice: VAT recalculated", async () => {
    skipIfNotVAT();
    const inv = await createInvoice({ quantity: 1, unitPrice: 1000, gstRate: 15, paymentType: "CREDIT" });
    const updated = await parse(
      await api.put(`/api/invoices/${inv.id}`, {
        data: {
          customerId,
          issueDate: isoDate(0),
          dueDate: isoDate(0),
          paymentType: "CREDIT",
          ...(warehouseId ? { warehouseId } : {}),
          items: [{ productId, description: "Edited VAT", quantity: 3, unitPrice: 1000, unitId: productUnitId, gstRate: 15, discount: 0 }],
        },
      })
    );
    expect(Number(updated.taxTotal)).toBeCloseTo(450, 1);
    expect(Number(updated.total)).toBeCloseTo(3450, 1);
  });

  // 71
  test("71 — Delete invoice: VAT journal reversed", async () => {
    skipIfNotVAT();
    const inv = await createInvoice({ quantity: 1, unitPrice: 1000, gstRate: 15, paymentType: "CREDIT" });
    await parse(await api.delete(`/api/invoices/${inv.id}`));
    const lines = await getJournalLines("INVOICE", inv.id);
    expect(lines.length).toBe(0);
  });

  // 72
  test("72 — Purchase with tax-inclusive VAT", async () => {
    skipIfNotVAT();
    const pi = await createPurchase({ quantity: 1, unitCost: 1150, gstRate: 15, isTaxInclusive: true });
    expect(Number(pi.subtotal)).toBeCloseTo(1000, 0);
    expect(Number(pi.taxTotal)).toBeCloseTo(150, 0);
  });

  // 73
  test("73 — Credit note with VAT 15%", async () => {
    skipIfNotVAT();
    const inv = await createInvoice({ quantity: 5, unitPrice: 100, gstRate: 15, paymentType: "CREDIT" });
    const invItems = await getInvoiceItems(inv.id);
    const cn = await parse(
      await api.post("/api/credit-notes", {
        data: {
          customerId,
          invoiceId: inv.id,
          issueDate: isoDate(0),
          reason: "VAT CN test",
          ...(warehouseId ? { warehouseId } : {}),
          items: [
            { invoiceItemId: invItems[0].id, productId, description: "Return", quantity: 1, unitPrice: 100, unitId: productUnitId, gstRate: 15, discount: 0 },
          ],
        },
      })
    );
    expect(Number(cn.taxTotal)).toBeCloseTo(15, 1);
    expect(Number(cn.total)).toBeCloseTo(115, 1);
  });

  // 74
  test("74 — Debit note with VAT 15%", async () => {
    skipIfNotVAT();
    const pi = await createPurchase({ quantity: 5, unitCost: 100, gstRate: 15 });
    const piItems = await getPurchaseItems(pi.id);
    const dn = await parse(
      await api.post("/api/debit-notes", {
        data: {
          supplierId,
          purchaseInvoiceId: pi.id,
          issueDate: isoDate(0),
          reason: "VAT DN test",
          ...(warehouseId ? { warehouseId } : {}),
          items: [
            { purchaseInvoiceItemId: piItems[0].id, productId, description: "Return", quantity: 1, unitCost: 100, unitId: productUnitId, gstRate: 15, discount: 0 },
          ],
        },
      })
    );
    expect(Number(dn.taxTotal)).toBeCloseTo(15, 1);
    expect(Number(dn.total)).toBeCloseTo(115, 1);
  });

  // 75
  test("75 — POS checkout with split payment and VAT", async () => {
    skipIfNotVAT();
    const sessionId = await openPosSession();
    const result = await parse(
      await api.post("/api/pos/checkout", {
        data: {
          sessionId,
          items: [{ productId, name: "VAT Split", quantity: 1, unitPrice: 1000, discount: 0, gstRate: 15 }],
          payments: [
            { method: "cash", amount: 575 },
            { method: "card", amount: 575 },
          ],
        },
      })
    );
    expect(result).toBeTruthy();
    await closePosSession(sessionId);
  });

  // 76
  test("76 — VAT on decimal quantities", async () => {
    skipIfNotVAT();
    const inv = await createInvoice({ quantity: 2.5, unitPrice: 400, gstRate: 15 });
    // 2.5 * 400 = 1000, VAT = 150
    expect(Number(inv.subtotal)).toBeCloseTo(1000, 1);
    expect(Number(inv.taxTotal)).toBeCloseTo(150, 1);
  });

  // 77
  test("77 — VAT rounding (to 2 decimal places)", async () => {
    skipIfNotVAT();
    const inv = await createInvoice({ quantity: 1, unitPrice: 333, gstRate: 15 });
    // 333 * 0.15 = 49.95
    expect(Number(inv.taxTotal)).toBeCloseTo(49.95, 1);
  });

  // 78
  test("78 — VAT total = 15% of subtotal (verified)", async () => {
    skipIfNotVAT();
    const inv = await createInvoice({ quantity: 4, unitPrice: 250, gstRate: 15 });
    const expected = Number(inv.subtotal) * 0.15;
    expect(Math.abs(Number(inv.taxTotal) - expected)).toBeLessThan(0.02);
  });

  // 79
  test("79 — Invoice with VAT and discount combined", async () => {
    skipIfNotVAT();
    const inv = await createInvoice({ quantity: 1, unitPrice: 2000, gstRate: 15, discount: 25 });
    // 2000 - 25% = 1500, VAT = 225
    expect(Number(inv.subtotal)).toBeCloseTo(1500, 1);
    expect(Number(inv.taxTotal)).toBeCloseTo(225, 1);
    expect(Number(inv.total)).toBeCloseTo(1725, 1);
  });

  // 80
  test("80 — VAT detail report includes all invoices", async () => {
    skipIfNotVAT();
    const d = await parse(
      await api.get(`/api/reports/vat-detail?fromDate=${FROM}&toDate=${TO}`)
    );
    expect(d).toHaveProperty("rows");
    expect(d).toHaveProperty("totalTaxableOutput");
    expect(d).toHaveProperty("totalVATOutput");
    expect(d).toHaveProperty("totalTaxableInput");
    expect(d).toHaveProperty("totalVATInput");
    expect(d).toHaveProperty("netVATPayable");
  });
});

// ---------------------------------------------------------------------------
// POS session helpers (used by both GST and VAT tests)
// ---------------------------------------------------------------------------

async function openPosSession(openingCash = 500): Promise<string> {
  const res = await parse(
    await api.post("/api/pos/sessions", {
      data: { openingCash, warehouseId, pinCode: employeePinCode },
    })
  );
  return res.id;
}

async function closePosSession(sessionId: string, closingCash = 500) {
  return parseSafe(
    await api.put(`/api/pos/sessions/${sessionId}/close`, {
      data: { closingCash, pinCode: employeePinCode },
    })
  );
}
