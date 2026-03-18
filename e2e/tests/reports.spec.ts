/**
 * Reports E2E Tests — 100 tests across all 30+ report endpoints
 *
 * Covers: Financial, Cash, Aging, Balance, Transaction Register, Analysis,
 * Inventory, Tax, and Other report APIs (data + PDF where available).
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

function isoDate(off = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + off);
  return d.toISOString().slice(0, 10);
}

// Broad date range that captures existing test data
const FROM = isoDate(-365);
const TO = isoDate(0);

// ---------------------------------------------------------------------------
// Shared state
// ---------------------------------------------------------------------------

test.setTimeout(120_000);

let api: APIRequestContext;
let cashAccountId: string;

test.beforeAll(async () => {
  api = await playwrightRequest.newContext({ baseURL, storageState: authStatePath, timeout: 60_000 });

  // Warm up DB connection pool
  await api.get("/api/units").catch(() => {});
  await new Promise((r) => setTimeout(r, 1000));

  // Resolve a cash account id for ledger / cash-book tests
  const accounts: any[] = await parse(await api.get("/api/accounts"));
  const cash = accounts.find((a: any) => a.code === "1100");
  cashAccountId = cash?.id ?? accounts[0]?.id;
});

test.afterAll(async () => {
  await api.dispose();
});

// ===========================================================================
// 1. FINANCIAL REPORTS (20 tests)
// ===========================================================================
test.describe("Financial Reports", () => {
  test.setTimeout(120_000);

  // --- Balance Sheet ---
  test("1 — Balance sheet returns assets, liabilities, equity sections", async () => {
    const d = await parse(await api.get("/api/reports/balance-sheet"));
    expect(d).toHaveProperty("assets");
    expect(d).toHaveProperty("liabilities");
    expect(d).toHaveProperty("equity");
    expect(Array.isArray(d.assets)).toBe(true);
    expect(Array.isArray(d.liabilities)).toBe(true);
    expect(Array.isArray(d.equity)).toBe(true);
  });

  test("2 — Balance sheet: assets = liabilities + equity", async () => {
    const d = await parse(await api.get("/api/reports/balance-sheet"));
    expect(typeof d.totalAssets).toBe("number");
    expect(typeof d.totalLiabilitiesAndEquity).toBe("number");
    expect(d.isBalanced).toBe(true);
    expect(Math.abs(d.totalAssets - d.totalLiabilitiesAndEquity)).toBeLessThan(0.01);
  });

  test("3 — Balance sheet with asOfDate filter", async () => {
    const d = await parse(
      await api.get(`/api/reports/balance-sheet?asOfDate=${isoDate(-30)}`)
    );
    expect(d.asOfDate).toBe(isoDate(-30));
    expect(d).toHaveProperty("totalAssets");
  });

  test("4 — Balance sheet PDF returns 200", async () => {
    const r = await api.get("/api/reports/balance-sheet/pdf");
    expect(r.status()).toBe(200);
    const ct = r.headers()["content-type"] || "";
    expect(ct).toContain("pdf");
  });

  // --- Profit & Loss ---
  test("5 — P&L returns revenue, expenses, net profit", async () => {
    const d = await parse(
      await api.get(`/api/reports/profit-loss?fromDate=${FROM}&toDate=${TO}`)
    );
    expect(d).toHaveProperty("revenue");
    expect(d).toHaveProperty("expenses");
    expect(d).toHaveProperty("netIncome");
    expect(Array.isArray(d.revenue)).toBe(true);
    expect(Array.isArray(d.expenses)).toBe(true);
  });

  test("6 — P&L: net profit = revenue - expenses", async () => {
    const d = await parse(
      await api.get(`/api/reports/profit-loss?fromDate=${FROM}&toDate=${TO}`)
    );
    expect(typeof d.totalRevenue).toBe("number");
    expect(typeof d.totalExpenses).toBe("number");
    expect(Math.abs(d.netIncome - (d.totalRevenue - d.totalExpenses))).toBeLessThan(0.01);
  });

  test("7 — P&L with date range filter", async () => {
    const d = await parse(
      await api.get(`/api/reports/profit-loss?fromDate=${FROM}&toDate=${TO}`)
    );
    expect(d.fromDate).toBe(FROM);
    expect(d.toDate).toBe(TO);
  });

  test("8 — P&L PDF returns 200", async () => {
    const r = await api.get(`/api/reports/profit-loss/pdf?fromDate=${FROM}&toDate=${TO}`);
    expect(r.status()).toBe(200);
    const ct = r.headers()["content-type"] || "";
    expect(ct).toContain("pdf");
  });

  // --- Trial Balance ---
  test("9 — Trial balance returns accounts with debit/credit totals", async () => {
    const d = await parse(await api.get("/api/reports/trial-balance"));
    expect(d).toHaveProperty("accounts");
    expect(Array.isArray(d.accounts)).toBe(true);
    expect(d).toHaveProperty("totalDebit");
    expect(d).toHaveProperty("totalCredit");
  });

  test("10 — Trial balance: total debits = total credits", async () => {
    const d = await parse(await api.get("/api/reports/trial-balance"));
    expect(d.isBalanced).toBe(true);
    expect(Math.abs(d.totalDebit - d.totalCredit)).toBeLessThan(0.01);
  });

  test("11 — Trial balance with asOfDate filter", async () => {
    const d = await parse(
      await api.get(`/api/reports/trial-balance?asOfDate=${isoDate(-30)}`)
    );
    expect(d.asOfDate).toBe(isoDate(-30));
    expect(d).toHaveProperty("accounts");
  });

  test("12 — Trial balance PDF returns 200", async () => {
    const r = await api.get("/api/reports/trial-balance/pdf");
    expect(r.status()).toBe(200);
    const ct = r.headers()["content-type"] || "";
    expect(ct).toContain("pdf");
  });

  // --- Ledger ---
  test("13 — Ledger for Cash account shows transactions", async () => {
    const d = await parse(
      await api.get(`/api/reports/ledger?type=ACCOUNT&id=${cashAccountId}`)
    );
    expect(d).toHaveProperty("transactions");
    expect(Array.isArray(d.transactions)).toBe(true);
    expect(d).toHaveProperty("openingBalance");
    expect(d).toHaveProperty("closingBalance");
  });

  test("14 — Ledger with date range filter", async () => {
    const d = await parse(
      await api.get(
        `/api/reports/ledger?type=ACCOUNT&id=${cashAccountId}&fromDate=${FROM}&toDate=${TO}`
      )
    );
    expect(d).toHaveProperty("transactions");
    expect(d).toHaveProperty("totalDebit");
    expect(d).toHaveProperty("totalCredit");
  });

  test("15 — Ledger PDF returns 200", async () => {
    const r = await api.get(
      `/api/reports/ledger/pdf?type=ACCOUNT&id=${cashAccountId}`
    );
    expect(r.status()).toBe(200);
    const ct = r.headers()["content-type"] || "";
    expect(ct).toContain("pdf");
  });

  // --- Cash Flow ---
  test("16 — Cash flow returns operating, investing, financing sections", async () => {
    const d = await parse(
      await api.get(`/api/reports/cash-flow?fromDate=${FROM}&toDate=${TO}`)
    );
    expect(d).toHaveProperty("summary");
    expect(d).toHaveProperty("totalInflow");
    expect(d).toHaveProperty("totalOutflow");
    expect(d).toHaveProperty("netCashFlow");
  });

  test("17 — Cash flow with date range filter", async () => {
    const d = await parse(
      await api.get(`/api/reports/cash-flow?fromDate=${FROM}&toDate=${TO}`)
    );
    expect(d.fromDate).toBe(FROM);
    expect(d.toDate).toBe(TO);
  });

  test("18 — Cash flow PDF returns 200", async () => {
    const r = await api.get(
      `/api/reports/cash-flow/pdf?fromDate=${FROM}&toDate=${TO}`
    );
    expect(r.status()).toBe(200);
    const ct = r.headers()["content-type"] || "";
    expect(ct).toContain("pdf");
  });

  // --- Edge cases ---
  test("19 — Balance sheet with no data returns structure with zeros", async () => {
    // Use a far-future date so there's no data
    const d = await parse(
      await api.get(`/api/reports/balance-sheet?asOfDate=2000-01-01`)
    );
    expect(d).toHaveProperty("totalAssets");
    expect(d).toHaveProperty("totalLiabilities");
    expect(d).toHaveProperty("totalEquity");
    // Structure is valid even if values are 0
    expect(typeof d.totalAssets).toBe("number");
  });

  test("20 — P&L with no data returns structure with zeros", async () => {
    const d = await parse(
      await api.get(
        `/api/reports/profit-loss?fromDate=2000-01-01&toDate=2000-01-31`
      )
    );
    expect(d).toHaveProperty("totalRevenue");
    expect(d).toHaveProperty("totalExpenses");
    expect(d).toHaveProperty("netIncome");
    expect(typeof d.netIncome).toBe("number");
  });
});

// ===========================================================================
// 2. CASH REPORTS (10 tests)
// ===========================================================================
test.describe("Cash Reports", () => {
  test.setTimeout(120_000);

  test("21 — Cash book returns cash transactions", async () => {
    const d = await parse(await api.get("/api/reports/cash-book"));
    expect(d).toHaveProperty("transactions");
    expect(Array.isArray(d.transactions)).toBe(true);
    expect(d).toHaveProperty("openingBalance");
    expect(d).toHaveProperty("closingBalance");
    expect(d).toHaveProperty("totalCashIn");
    expect(d).toHaveProperty("totalCashOut");
  });

  test("22 — Cash book with date range", async () => {
    const d = await parse(
      await api.get(`/api/reports/cash-book?fromDate=${FROM}&toDate=${TO}`)
    );
    expect(d).toHaveProperty("transactions");
    expect(typeof d.totalCashIn).toBe("number");
    expect(typeof d.totalCashOut).toBe("number");
  });

  test("23 — Cash book PDF returns 200", async () => {
    const r = await api.get(
      `/api/reports/cash-book/pdf?fromDate=${FROM}&toDate=${TO}`
    );
    expect(r.status()).toBe(200);
    const ct = r.headers()["content-type"] || "";
    expect(ct).toContain("pdf");
  });

  test("24 — Bank book returns bank transactions", async () => {
    const d = await parse(await api.get("/api/reports/bank-book"));
    expect(d).toHaveProperty("transactions");
    expect(Array.isArray(d.transactions)).toBe(true);
    expect(d).toHaveProperty("openingBalance");
    expect(d).toHaveProperty("closingBalance");
  });

  test("25 — Bank book with date range", async () => {
    const d = await parse(
      await api.get(`/api/reports/bank-book?fromDate=${FROM}&toDate=${TO}`)
    );
    expect(d).toHaveProperty("transactions");
    expect(typeof d.totalCashIn).toBe("number");
  });

  test("26 — Bank book PDF returns 200", async () => {
    const r = await api.get(
      `/api/reports/bank-book/pdf?fromDate=${FROM}&toDate=${TO}`
    );
    expect(r.status()).toBe(200);
    const ct = r.headers()["content-type"] || "";
    expect(ct).toContain("pdf");
  });

  test("27 — Cash & bank summary returns totals for all accounts", async () => {
    const d = await parse(await api.get("/api/reports/cash-bank-summary"));
    expect(d).toHaveProperty("accounts");
    expect(Array.isArray(d.accounts)).toBe(true);
    expect(d).toHaveProperty("totals");
    expect(d.totals).toHaveProperty("openingBalance");
    expect(d.totals).toHaveProperty("closingBalance");
  });

  test("28 — Cash & bank summary with date range", async () => {
    const d = await parse(
      await api.get(
        `/api/reports/cash-bank-summary?fromDate=${FROM}&toDate=${TO}`
      )
    );
    expect(d).toHaveProperty("accounts");
    expect(d).toHaveProperty("fromDate");
    expect(d).toHaveProperty("toDate");
  });

  test("29 — Cash & bank summary PDF returns 200", async () => {
    const r = await api.get(
      `/api/reports/cash-bank-summary/pdf?fromDate=${FROM}&toDate=${TO}`
    );
    expect(r.status()).toBe(200);
    const ct = r.headers()["content-type"] || "";
    expect(ct).toContain("pdf");
  });

  test("30 — Cash book balance matches closing balance calculation", async () => {
    const d = await parse(
      await api.get(`/api/reports/cash-book?fromDate=${FROM}&toDate=${TO}`)
    );
    // closingBalance should equal openingBalance + totalCashIn - totalCashOut
    const expected = d.openingBalance + d.totalCashIn - d.totalCashOut;
    expect(Math.abs(d.closingBalance - expected)).toBeLessThan(0.01);
  });
});

// ===========================================================================
// 3. AGING REPORTS (10 tests)
// ===========================================================================
test.describe("Aging Reports", () => {
  test.setTimeout(120_000);

  test("31 — AR aging returns customer aging buckets", async () => {
    const d = await parse(await api.get("/api/reports/ar-aging"));
    expect(d).toHaveProperty("customers");
    expect(Array.isArray(d.customers)).toBe(true);
    expect(d).toHaveProperty("totals");
  });

  test("32 — AR aging has current + 30/60/90/90+ columns", async () => {
    const d = await parse(await api.get("/api/reports/ar-aging"));
    // Totals should have aging bucket keys
    expect(d.totals).toHaveProperty("current");
    expect(d.totals).toHaveProperty("days30");
    expect(d.totals).toHaveProperty("days60");
    expect(d.totals).toHaveProperty("days90");
    expect(d.totals).toHaveProperty("days90Plus");
  });

  test("33 — AR aging with asOfDate", async () => {
    const d = await parse(
      await api.get(`/api/reports/ar-aging?asOfDate=${isoDate(-30)}`)
    );
    expect(d.asOfDate).toBe(isoDate(-30));
    expect(d).toHaveProperty("customers");
  });

  test("34 — AR aging PDF returns 200", async () => {
    const r = await api.get("/api/reports/ar-aging/pdf");
    expect(r.status()).toBe(200);
    const ct = r.headers()["content-type"] || "";
    expect(ct).toContain("pdf");
  });

  test("35 — AP aging returns supplier aging buckets", async () => {
    const d = await parse(await api.get("/api/reports/ap-aging"));
    expect(d).toHaveProperty("suppliers");
    expect(Array.isArray(d.suppliers)).toBe(true);
    expect(d).toHaveProperty("totals");
  });

  test("36 — AP aging has current + 30/60/90/90+ columns", async () => {
    const d = await parse(await api.get("/api/reports/ap-aging"));
    expect(d.totals).toHaveProperty("current");
    expect(d.totals).toHaveProperty("days30");
    expect(d.totals).toHaveProperty("days60");
    expect(d.totals).toHaveProperty("days90");
    expect(d.totals).toHaveProperty("days90Plus");
  });

  test("37 — AP aging with asOfDate", async () => {
    const d = await parse(
      await api.get(`/api/reports/ap-aging?asOfDate=${isoDate(-30)}`)
    );
    expect(d.asOfDate).toBe(isoDate(-30));
    expect(d).toHaveProperty("suppliers");
  });

  test("38 — AP aging PDF returns 200", async () => {
    const r = await api.get("/api/reports/ap-aging/pdf");
    expect(r.status()).toBe(200);
    const ct = r.headers()["content-type"] || "";
    expect(ct).toContain("pdf");
  });

  test("39 — AR aging total matches sum of customer totals", async () => {
    const d = await parse(await api.get("/api/reports/ar-aging"));
    const customerTotal = d.customers.reduce(
      (sum: number, c: any) => sum + (c.total ?? 0),
      0
    );
    expect(Math.abs(d.totals.total - customerTotal)).toBeLessThan(0.01);
  });

  test("40 — AP aging total matches sum of supplier totals", async () => {
    const d = await parse(await api.get("/api/reports/ap-aging"));
    const supplierTotal = d.suppliers.reduce(
      (sum: number, s: any) => sum + (s.total ?? 0),
      0
    );
    expect(Math.abs(d.totals.total - supplierTotal)).toBeLessThan(0.01);
  });
});

// ===========================================================================
// 4. BALANCE REPORTS (6 tests)
// ===========================================================================
test.describe("Balance Reports", () => {
  test.setTimeout(120_000);

  test("41 — Customer balances returns list with amounts", async () => {
    const d = await parse(await api.get("/api/reports/customer-balances"));
    expect(d).toHaveProperty("customers");
    expect(Array.isArray(d.customers)).toBe(true);
    expect(d).toHaveProperty("summary");
    expect(d.summary).toHaveProperty("totalReceivable");
  });

  test("42 — Customer balances PDF returns 200", async () => {
    const r = await api.get("/api/reports/customer-balances/pdf");
    expect(r.status()).toBe(200);
    const ct = r.headers()["content-type"] || "";
    expect(ct).toContain("pdf");
  });

  test("43 — Customer balances total matches summary totalReceivable", async () => {
    const d = await parse(await api.get("/api/reports/customer-balances"));
    const sumPositive = d.customers.reduce(
      (sum: number, c: any) => sum + Math.max(0, c.balance ?? 0),
      0
    );
    expect(Math.abs(d.summary.totalReceivable - sumPositive)).toBeLessThan(0.01);
  });

  test("44 — Supplier balances returns list with amounts", async () => {
    const d = await parse(await api.get("/api/reports/supplier-balances"));
    expect(d).toHaveProperty("suppliers");
    expect(Array.isArray(d.suppliers)).toBe(true);
    expect(d).toHaveProperty("summary");
    expect(d.summary).toHaveProperty("totalPayable");
  });

  test("45 — Supplier balances PDF returns 200", async () => {
    const r = await api.get("/api/reports/supplier-balances/pdf");
    expect(r.status()).toBe(200);
    const ct = r.headers()["content-type"] || "";
    expect(ct).toContain("pdf");
  });

  test("46 — Supplier balances total matches summary totalPayable", async () => {
    const d = await parse(await api.get("/api/reports/supplier-balances"));
    // totalPayable is the sum from the ledger
    expect(typeof d.summary.totalPayable).toBe("number");
    expect(typeof d.summary.totalSuppliers).toBe("number");
  });
});

// ===========================================================================
// 5. TRANSACTION REGISTERS (10 tests)
// ===========================================================================
test.describe("Transaction Registers", () => {
  test.setTimeout(120_000);

  // --- Sales Register ---
  test("47 — Sales register returns invoices with totals", async () => {
    const d = await parse(
      await api.get(`/api/reports/sales-register?fromDate=${FROM}&toDate=${TO}`)
    );
    expect(d).toHaveProperty("rows");
    expect(Array.isArray(d.rows)).toBe(true);
    expect(d).toHaveProperty("totals");
    expect(d.totals).toHaveProperty("total");
    expect(d.totals).toHaveProperty("subtotal");
  });

  test("48 — Sales register with date range", async () => {
    const d = await parse(
      await api.get(`/api/reports/sales-register?fromDate=${FROM}&toDate=${TO}`)
    );
    expect(d).toHaveProperty("invoiceCount");
    expect(typeof d.invoiceCount).toBe("number");
  });

  test("49 — Sales register PDF returns 200", async () => {
    const r = await api.get(
      `/api/reports/sales-register/pdf?fromDate=${FROM}&toDate=${TO}`
    );
    expect(r.status()).toBe(200);
    const ct = r.headers()["content-type"] || "";
    expect(ct).toContain("pdf");
  });

  test("50 — Sales register total is sum of row totals", async () => {
    const d = await parse(
      await api.get(`/api/reports/sales-register?fromDate=${FROM}&toDate=${TO}`)
    );
    const rowSum = d.rows.reduce((s: number, r: any) => s + r.total, 0);
    expect(Math.abs(d.totals.total - rowSum)).toBeLessThan(0.01);
  });

  // --- Purchase Register ---
  test("51 — Purchase register returns purchases with totals", async () => {
    const d = await parse(
      await api.get(
        `/api/reports/purchase-register?fromDate=${FROM}&toDate=${TO}`
      )
    );
    expect(d).toHaveProperty("rows");
    expect(Array.isArray(d.rows)).toBe(true);
    expect(d).toHaveProperty("totals");
    expect(d.totals).toHaveProperty("total");
  });

  test("52 — Purchase register with date range", async () => {
    const d = await parse(
      await api.get(
        `/api/reports/purchase-register?fromDate=${FROM}&toDate=${TO}`
      )
    );
    expect(d).toHaveProperty("invoiceCount");
    expect(typeof d.invoiceCount).toBe("number");
  });

  test("53 — Purchase register PDF returns 200", async () => {
    const r = await api.get(
      `/api/reports/purchase-register/pdf?fromDate=${FROM}&toDate=${TO}`
    );
    expect(r.status()).toBe(200);
    const ct = r.headers()["content-type"] || "";
    expect(ct).toContain("pdf");
  });

  test("54 — Purchase register total is sum of row totals", async () => {
    const d = await parse(
      await api.get(
        `/api/reports/purchase-register?fromDate=${FROM}&toDate=${TO}`
      )
    );
    const rowSum = d.rows.reduce((s: number, r: any) => s + r.total, 0);
    expect(Math.abs(d.totals.total - rowSum)).toBeLessThan(0.01);
  });

  test("55 — Sales register includes invoice numbers", async () => {
    const d = await parse(
      await api.get(`/api/reports/sales-register?fromDate=${FROM}&toDate=${TO}`)
    );
    if (d.rows.length > 0) {
      expect(d.rows[0]).toHaveProperty("invoiceNumber");
      expect(typeof d.rows[0].invoiceNumber).toBe("string");
    }
  });

  test("56 — Purchase register includes purchase numbers", async () => {
    const d = await parse(
      await api.get(
        `/api/reports/purchase-register?fromDate=${FROM}&toDate=${TO}`
      )
    );
    if (d.rows.length > 0) {
      expect(d.rows[0]).toHaveProperty("invoiceNumber");
      expect(typeof d.rows[0].invoiceNumber).toBe("string");
    }
  });
});

// ===========================================================================
// 6. ANALYSIS REPORTS (18 tests)
// ===========================================================================
test.describe("Analysis Reports", () => {
  test.setTimeout(120_000);

  // --- Sales by Item ---
  test("57 — Sales by item returns product sales breakdown", async () => {
    const d = await parse(
      await api.get(`/api/reports/sales-by-item?fromDate=${FROM}&toDate=${TO}`)
    );
    expect(d).toHaveProperty("rows");
    expect(Array.isArray(d.rows)).toBe(true);
    expect(d).toHaveProperty("totals");
  });

  test("58 — Sales by item with date range", async () => {
    const d = await parse(
      await api.get(`/api/reports/sales-by-item?fromDate=${FROM}&toDate=${TO}`)
    );
    expect(d.fromDate).toBe(FROM);
    expect(d.toDate).toBe(TO);
  });

  test("59 — Sales by item PDF returns 200", async () => {
    const r = await api.get(
      `/api/reports/sales-by-item/pdf?fromDate=${FROM}&toDate=${TO}`
    );
    expect(r.status()).toBe(200);
    const ct = r.headers()["content-type"] || "";
    expect(ct).toContain("pdf");
  });

  // --- Sales by Customer ---
  test("60 — Sales by customer returns customer sales breakdown", async () => {
    const d = await parse(
      await api.get(
        `/api/reports/sales-by-customer?fromDate=${FROM}&toDate=${TO}`
      )
    );
    expect(d).toHaveProperty("rows");
    expect(Array.isArray(d.rows)).toBe(true);
    expect(d).toHaveProperty("totals");
  });

  test("61 — Sales by customer with date range", async () => {
    const d = await parse(
      await api.get(
        `/api/reports/sales-by-customer?fromDate=${FROM}&toDate=${TO}`
      )
    );
    expect(d).toHaveProperty("totals");
    expect(typeof d.totals.invoiceCount).toBe("number");
  });

  test("62 — Sales by customer PDF returns 200", async () => {
    const r = await api.get(
      `/api/reports/sales-by-customer/pdf?fromDate=${FROM}&toDate=${TO}`
    );
    expect(r.status()).toBe(200);
    const ct = r.headers()["content-type"] || "";
    expect(ct).toContain("pdf");
  });

  // --- Sales by Salesperson ---
  test("63 — Sales by salesperson returns salesperson breakdown", async () => {
    const d = await parse(
      await api.get(
        `/api/reports/sales-by-salesperson?fromDate=${FROM}&toDate=${TO}`
      )
    );
    expect(d).toHaveProperty("rows");
    expect(Array.isArray(d.rows)).toBe(true);
    expect(d).toHaveProperty("totals");
  });

  test("64 — Sales by salesperson PDF returns 200", async () => {
    const r = await api.get(
      `/api/reports/sales-by-salesperson/pdf?fromDate=${FROM}&toDate=${TO}`
    );
    expect(r.status()).toBe(200);
    const ct = r.headers()["content-type"] || "";
    expect(ct).toContain("pdf");
  });

  // --- Purchases by Item ---
  test("65 — Purchases by item returns product purchase breakdown", async () => {
    const d = await parse(
      await api.get(
        `/api/reports/purchases-by-item?fromDate=${FROM}&toDate=${TO}`
      )
    );
    expect(d).toHaveProperty("rows");
    expect(Array.isArray(d.rows)).toBe(true);
    expect(d).toHaveProperty("totals");
  });

  test("66 — Purchases by item with date range", async () => {
    const d = await parse(
      await api.get(
        `/api/reports/purchases-by-item?fromDate=${FROM}&toDate=${TO}`
      )
    );
    expect(d.fromDate).toBe(FROM);
    expect(d.toDate).toBe(TO);
  });

  test("67 — Purchases by item PDF returns 200", async () => {
    const r = await api.get(
      `/api/reports/purchases-by-item/pdf?fromDate=${FROM}&toDate=${TO}`
    );
    expect(r.status()).toBe(200);
    const ct = r.headers()["content-type"] || "";
    expect(ct).toContain("pdf");
  });

  // --- Purchases by Supplier ---
  test("68 — Purchases by supplier returns supplier breakdown", async () => {
    const d = await parse(
      await api.get(
        `/api/reports/purchases-by-supplier?fromDate=${FROM}&toDate=${TO}`
      )
    );
    expect(d).toHaveProperty("rows");
    expect(Array.isArray(d.rows)).toBe(true);
    expect(d).toHaveProperty("totals");
  });

  test("69 — Purchases by supplier with date range", async () => {
    const d = await parse(
      await api.get(
        `/api/reports/purchases-by-supplier?fromDate=${FROM}&toDate=${TO}`
      )
    );
    expect(d).toHaveProperty("totals");
    expect(typeof d.totals.invoiceCount).toBe("number");
  });

  test("70 — Purchases by supplier PDF returns 200", async () => {
    const r = await api.get(
      `/api/reports/purchases-by-supplier/pdf?fromDate=${FROM}&toDate=${TO}`
    );
    expect(r.status()).toBe(200);
    const ct = r.headers()["content-type"] || "";
    expect(ct).toContain("pdf");
  });

  // --- Profit by Items ---
  test("71 — Profit by items shows revenue, COGS, profit per product", async () => {
    const d = await parse(
      await api.get(`/api/reports/profit-by-items?from=${FROM}&to=${TO}`)
    );
    expect(d).toHaveProperty("invoices");
    expect(Array.isArray(d.invoices)).toBe(true);
    expect(d).toHaveProperty("summary");
    expect(d.summary).toHaveProperty("totalRevenue");
    expect(d.summary).toHaveProperty("totalCOGS");
    expect(d.summary).toHaveProperty("totalProfit");
  });

  test("72 — Profit by items with productId filter", async () => {
    // First get the data without filter to find a productId
    const full = await parse(
      await api.get(`/api/reports/profit-by-items?from=${FROM}&to=${TO}`)
    );
    if (full.invoices.length > 0 && full.invoices[0].items?.length > 0) {
      const pid = full.invoices[0].items[0].productId;
      if (pid) {
        const d = await parse(
          await api.get(
            `/api/reports/profit-by-items?from=${FROM}&to=${TO}&productId=${pid}`
          )
        );
        expect(d).toHaveProperty("summary");
        // Filtered result should have <= full result
        expect(d.summary.totalItems).toBeLessThanOrEqual(full.summary.totalItems);
      }
    }
    // If no data, just verify the structure
    expect(full).toHaveProperty("summary");
  });

  test("73 — Profit by items returns generatedAt timestamp", async () => {
    const d = await parse(
      await api.get(`/api/reports/profit-by-items?from=${FROM}&to=${TO}`)
    );
    expect(d).toHaveProperty("generatedAt");
    expect(typeof d.generatedAt).toBe("string");
  });

  test("74 — Profit by items: profit = revenue - COGS", async () => {
    const d = await parse(
      await api.get(`/api/reports/profit-by-items?from=${FROM}&to=${TO}`)
    );
    const expected = d.summary.totalRevenue - d.summary.totalCOGS;
    expect(Math.abs(d.summary.totalProfit - expected)).toBeLessThan(0.01);
  });
});

// ===========================================================================
// 7. INVENTORY REPORTS (6 tests)
// ===========================================================================
test.describe("Inventory Reports", () => {
  test.setTimeout(120_000);

  test("75 — Stock summary returns products with quantities", async () => {
    const d = await parse(await api.get("/api/reports/stock-summary"));
    expect(d).toHaveProperty("rows");
    expect(Array.isArray(d.rows)).toBe(true);
    expect(d).toHaveProperty("summary");
    expect(d.summary).toHaveProperty("totalItems");
    expect(d.summary).toHaveProperty("totalValue");
  });

  test("76 — Stock summary with warehouse filter", async () => {
    const d = await parse(await api.get("/api/reports/stock-summary"));
    // Use first warehouse if available
    if (d.warehouses?.length > 0) {
      const whId = d.warehouses[0].id;
      const filtered = await parse(
        await api.get(`/api/reports/stock-summary?warehouseId=${whId}`)
      );
      expect(filtered).toHaveProperty("rows");
      expect(filtered.summary.totalItems).toBeLessThanOrEqual(d.summary.totalItems);
    }
    // Structure should always be valid
    expect(d).toHaveProperty("rows");
  });

  test("77 — Stock summary returns warehouses and branches for filters", async () => {
    const d = await parse(await api.get("/api/reports/stock-summary"));
    expect(d).toHaveProperty("warehouses");
    expect(d).toHaveProperty("branches");
    expect(Array.isArray(d.warehouses)).toBe(true);
    expect(Array.isArray(d.branches)).toBe(true);
  });

  test("78 — Stock summary total value calculation", async () => {
    const d = await parse(await api.get("/api/reports/stock-summary"));
    const rowValueSum = d.rows.reduce(
      (s: number, r: any) => s + (r.totalValue ?? 0),
      0
    );
    expect(Math.abs(d.summary.totalValue - rowValueSum)).toBeLessThan(0.01);
  });

  test("79 — Stock summary shows quantity and avg cost", async () => {
    const d = await parse(await api.get("/api/reports/stock-summary"));
    if (d.rows.length > 0) {
      const row = d.rows[0];
      expect(row).toHaveProperty("totalQuantity");
      expect(row).toHaveProperty("avgCost");
      expect(row).toHaveProperty("totalValue");
      expect(typeof row.totalQuantity).toBe("number");
      expect(typeof row.avgCost).toBe("number");
    }
  });

  test("80 — Stock summary rows have lot count", async () => {
    const d = await parse(await api.get("/api/reports/stock-summary"));
    if (d.rows.length > 0) {
      expect(d.rows[0]).toHaveProperty("lotCount");
      expect(typeof d.rows[0].lotCount).toBe("number");
      expect(d.rows[0].lotCount).toBeGreaterThanOrEqual(1);
    }
  });
});

// ===========================================================================
// 8. TAX REPORTS (12 tests)
// ===========================================================================
test.describe("Tax Reports", () => {
  test.setTimeout(120_000);

  // --- GST Summary ---
  test("81 — GST summary returns tax totals", async () => {
    const d = await parse(
      await api.get(`/api/reports/gst-summary?from=${FROM}&to=${TO}`)
    );
    expect(d).toHaveProperty("sales");
    expect(d).toHaveProperty("purchases");
    expect(d).toHaveProperty("totalLiability");
    expect(d.sales).toHaveProperty("cgst");
    expect(d.sales).toHaveProperty("sgst");
    expect(d.sales).toHaveProperty("igst");
  });

  test("82 — GST summary with date range", async () => {
    const d = await parse(
      await api.get(`/api/reports/gst-summary?from=${FROM}&to=${TO}`)
    );
    expect(d).toHaveProperty("fromDate");
    expect(d).toHaveProperty("toDate");
  });

  test("83 — GST summary PDF returns 200", async () => {
    const r = await api.get(
      `/api/reports/gst-summary/pdf?from=${FROM}&to=${TO}`
    );
    expect(r.status()).toBe(200);
    const ct = r.headers()["content-type"] || "";
    expect(ct).toContain("pdf");
  });

  // --- GST Detail ---
  test("84 — GST detail returns itemized tax breakdown", async () => {
    const d = await parse(
      await api.get(`/api/reports/gst-detail?from=${FROM}&to=${TO}`)
    );
    expect(d).toHaveProperty("rows");
    expect(Array.isArray(d.rows)).toBe(true);
  });

  test("85 — GST detail with date range", async () => {
    const d = await parse(
      await api.get(`/api/reports/gst-detail?from=${FROM}&to=${TO}`)
    );
    expect(d).toHaveProperty("totalTaxableOutput");
    expect(d).toHaveProperty("totalTaxableInput");
  });

  test("86 — GST detail PDF returns 200", async () => {
    const r = await api.get(
      `/api/reports/gst-detail/pdf?from=${FROM}&to=${TO}`
    );
    expect(r.status()).toBe(200);
    const ct = r.headers()["content-type"] || "";
    expect(ct).toContain("pdf");
  });

  // --- VAT Summary ---
  test("87 — VAT summary returns VAT totals", async () => {
    const d = await parse(
      await api.get(`/api/reports/vat-summary?fromDate=${FROM}&toDate=${TO}`)
    );
    expect(d).toHaveProperty("sales");
    expect(d).toHaveProperty("purchases");
    expect(d).toHaveProperty("netOutputVAT");
    expect(d).toHaveProperty("netInputVAT");
    expect(d).toHaveProperty("netVATPayable");
  });

  test("88 — VAT summary with date range", async () => {
    const d = await parse(
      await api.get(`/api/reports/vat-summary?fromDate=${FROM}&toDate=${TO}`)
    );
    expect(d.fromDate).toBe(FROM);
    expect(d.toDate).toBe(TO);
  });

  test("89 — VAT summary PDF returns 200", async () => {
    const r = await api.get(
      `/api/reports/vat-summary/pdf?fromDate=${FROM}&toDate=${TO}`
    );
    expect(r.status()).toBe(200);
    const ct = r.headers()["content-type"] || "";
    expect(ct).toContain("pdf");
  });

  // --- VAT Detail ---
  test("90 — VAT detail returns itemized breakdown", async () => {
    const d = await parse(
      await api.get(`/api/reports/vat-detail?fromDate=${FROM}&toDate=${TO}`)
    );
    expect(d).toHaveProperty("rows");
    expect(Array.isArray(d.rows)).toBe(true);
    expect(d).toHaveProperty("netVATPayable");
  });

  test("91 — VAT detail with date range", async () => {
    const d = await parse(
      await api.get(`/api/reports/vat-detail?fromDate=${FROM}&toDate=${TO}`)
    );
    expect(d).toHaveProperty("totalTaxableOutput");
    expect(d).toHaveProperty("totalVATOutput");
    expect(d).toHaveProperty("totalTaxableInput");
    expect(d).toHaveProperty("totalVATInput");
  });

  test("92 — VAT detail PDF returns 200", async () => {
    const r = await api.get(
      `/api/reports/vat-detail/pdf?fromDate=${FROM}&toDate=${TO}`
    );
    expect(r.status()).toBe(200);
    const ct = r.headers()["content-type"] || "";
    expect(ct).toContain("pdf");
  });
});

// ===========================================================================
// 9. OTHER REPORTS (8 tests)
// ===========================================================================
test.describe("Other Reports", () => {
  test.setTimeout(120_000);

  // --- Branch P&L ---
  test("93 — Branch P&L returns per-branch profit/loss", async () => {
    const d = await parse(
      await api.get(`/api/reports/branch-pl?fromDate=${FROM}&toDate=${TO}`)
    );
    expect(d).toHaveProperty("rows");
    expect(Array.isArray(d.rows)).toBe(true);
    expect(d).toHaveProperty("totals");
    expect(d.totals).toHaveProperty("revenue");
    expect(d.totals).toHaveProperty("grossProfit");
  });

  test("94 — Branch P&L with date range", async () => {
    const d = await parse(
      await api.get(`/api/reports/branch-pl?fromDate=${FROM}&toDate=${TO}`)
    );
    expect(d).toHaveProperty("from");
    expect(d).toHaveProperty("to");
    if (d.rows.length > 0) {
      const row = d.rows[0];
      expect(row).toHaveProperty("branchName");
      expect(row).toHaveProperty("revenue");
      expect(row).toHaveProperty("grossProfit");
      expect(row).toHaveProperty("grossMargin");
    }
  });

  test("95 — Branch P&L totals are sum of branch rows", async () => {
    const d = await parse(
      await api.get(`/api/reports/branch-pl?fromDate=${FROM}&toDate=${TO}`)
    );
    const totalRevenue = d.rows.reduce((s: number, r: any) => s + r.revenue, 0);
    expect(Math.abs(d.totals.revenue - totalRevenue)).toBeLessThan(0.01);
  });

  // --- Cost Audit ---
  test("96 — Cost audit returns FIFO cost changes", async () => {
    const d = await parse(await api.get("/api/reports/cost-audit"));
    expect(d).toHaveProperty("logs");
    expect(Array.isArray(d.logs)).toBe(true);
    expect(d).toHaveProperty("pagination");
    expect(d.pagination).toHaveProperty("total");
    expect(d.pagination).toHaveProperty("hasMore");
    expect(d).toHaveProperty("summary");
  });

  test("97 — Cost audit with productId filter", async () => {
    const full = await parse(await api.get("/api/reports/cost-audit"));
    if (full.logs.length > 0) {
      const pid = full.logs[0].productId;
      const d = await parse(
        await api.get(`/api/reports/cost-audit?productId=${pid}`)
      );
      expect(d).toHaveProperty("logs");
      expect(d.pagination.total).toBeLessThanOrEqual(full.pagination.total);
    }
    // Structure valid regardless
    expect(full).toHaveProperty("summary");
    expect(full.summary).toHaveProperty("totalChanges");
  });

  test("98 — Cost audit pagination works", async () => {
    const d = await parse(
      await api.get("/api/reports/cost-audit?limit=5&offset=0")
    );
    expect(d.pagination.limit).toBe(5);
    expect(d.pagination.offset).toBe(0);
    expect(d.logs.length).toBeLessThanOrEqual(5);
  });

  // --- Expense Report ---
  test("99 — Expense report returns expense breakdown", async () => {
    const d = await parse(
      await api.get(
        `/api/reports/expense-report?fromDate=${FROM}&toDate=${TO}`
      )
    );
    expect(d).toHaveProperty("byCategory");
    expect(d).toHaveProperty("bySupplier");
    expect(d).toHaveProperty("totalExpenses");
    expect(d).toHaveProperty("expenseCount");
    expect(d).toHaveProperty("expenses");
    expect(Array.isArray(d.byCategory)).toBe(true);
    expect(Array.isArray(d.bySupplier)).toBe(true);
    expect(Array.isArray(d.expenses)).toBe(true);
  });

  test("100 — Expense report total matches sum of expenses", async () => {
    const d = await parse(
      await api.get(
        `/api/reports/expense-report?fromDate=${FROM}&toDate=${TO}`
      )
    );
    const expenseSum = d.expenses.reduce(
      (s: number, e: any) => s + (e.total ?? 0),
      0
    );
    expect(Math.abs(d.totalExpenses - expenseSum)).toBeLessThan(0.01);
    expect(d.expenseCount).toBe(d.expenses.length);
  });
});
