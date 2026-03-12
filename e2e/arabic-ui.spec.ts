import { expect, request as playwrightRequest, test, type APIRequestContext, type Page } from "@playwright/test";

const adminStorageState = "e2e/.auth/admin.json";

const staticRoutes = [
  "/settings",
  "/inventory/branches",
  "/inventory/opening-stock",
  "/inventory/stock-transfers",
  "/reports/profit-by-items",
  "/reports/customer-balances",
  "/reports/supplier-balances",
  "/reports/ledger",
  "/reports/trial-balance",
  "/reports/profit-loss",
  "/reports/balance-sheet",
  "/reports/cash-flow",
  "/reports/expense-report",
  "/reports/stock-summary",
  "/accounting/cash-bank",
  "/accounting/journal-entries",
  "/mobile-shop/imei-lookup",
  "/mobile-shop/device-inventory",
] as const;

const forbiddenEnglishPhrases = [
  "Document Round Off",
  "Applies to invoice, POS, and purchase document totals.",
  "Branches & Warehouses",
  "Manage your organization locations and storage facilities",
  "Set initial inventory quantities and values for your products",
  "Add Opening Stock",
  "Move stock between warehouses and complete the transfer in one step.",
  "Search transfers...",
  "No stock transfers found",
  "Complete your first stock transfer",
  "Transfer #",
  "Reverse transfer",
  "Stock Transfer",
  "Transfer Note",
  "Transfer Value",
  "Total Quantity",
  "Unit Cost",
  "Line Total",
  "Transfer not found",
  "Download PDF",
  "Print PDF",
  "Recorded on",
  "Profit by Invoice",
  "View profit analysis by invoice with expandable item details",
  "View customer balances - positive amounts are receivables (owed to you), negative amounts in green are advances (paid in advance)",
  "View outstanding supplier balances (Accounts Payable)",
  "View detailed transactions for any account, customer, or supplier",
  "Entity / Account",
  "Select entity",
  "Summary of all account balances",
  "As of Date",
  "Income statement for a period",
  "Financial position as of a date",
  "Cash inflows and outflows",
  "Expenses by category and supplier",
  "Number of Expenses",
  "Current inventory levels by product and warehouse",
  "Low stock only",
  "Search for a device by scanning or entering its IMEI number",
  "Scan or enter IMEI number...",
  "Search Device",
  "Press Enter, tap the camera icon, or scan a barcode to search",
  "Manage individual mobile devices",
  "Search IMEI, brand, model...",
  "Unable to load devices",
  "Mobile Shop module is not enabled",
  "Double-entry accounting records",
  "Manage cash and bank accounts",
  "Transfer Between Accounts",
  "Move funds between cash/bank accounts.",
  "Created on",
  "Dated",
  "Valid until",
  "No supplier expense",
  "Not yet paid",
  "Payable",
] as const;

test.use({
  storageState: adminStorageState,
  viewport: { width: 390, height: 844 },
  isMobile: true,
  hasTouch: true,
});

async function parseJson(response: Awaited<ReturnType<APIRequestContext["get"]>>) {
  const body = await response.text();
  const parsed = body ? JSON.parse(body) : null;
  if (!response.ok()) {
    throw new Error(`${response.url()} failed: ${response.status()} ${body}`);
  }
  return parsed;
}

async function getFirstId(api: APIRequestContext, path: string, key = "id") {
  const data = await parseJson(await api.get(path));
  const first = Array.isArray(data) ? data[0] : null;
  return first?.[key] ?? null;
}

async function collectDynamicRoutes(baseURL: string) {
  const api = await playwrightRequest.newContext({
    baseURL,
    storageState: adminStorageState,
  });

  try {
    const [
      invoiceId,
      quotationId,
      purchaseInvoiceId,
      customerId,
      supplierId,
      expenseId,
      transferId,
    ] = await Promise.all([
      getFirstId(api, "/api/invoices"),
      getFirstId(api, "/api/quotations"),
      getFirstId(api, "/api/purchase-invoices"),
      getFirstId(api, "/api/customers?compact=true"),
      getFirstId(api, "/api/suppliers?compact=true"),
      getFirstId(api, "/api/expenses"),
      getFirstId(api, "/api/stock-transfers"),
    ]);

    return [
      invoiceId ? `/invoices/${invoiceId}` : null,
      quotationId ? `/quotations/${quotationId}` : null,
      purchaseInvoiceId ? `/purchase-invoices/${purchaseInvoiceId}` : null,
      customerId ? `/customers/${customerId}/statement` : null,
      supplierId ? `/suppliers/${supplierId}/statement` : null,
      expenseId ? `/accounting/expenses/${expenseId}` : null,
      transferId ? `/inventory/stock-transfers/${transferId}` : null,
    ].filter(Boolean) as string[];
  } finally {
    await api.dispose();
  }
}

async function enableArabic(page: Page) {
  await page.context().addCookies([
    {
      name: "preferred-language",
      value: "ar",
      domain: "localhost",
      path: "/",
      sameSite: "Lax",
    },
  ]);

  await page.addInitScript(() => {
    window.localStorage.setItem("preferred-language", "ar");
  });
}

async function assertNoForbiddenEnglish(page: Page, route: string) {
  await page.goto(route, { waitUntil: "domcontentloaded", timeout: 15_000 });
  await page.waitForTimeout(1_100);

  const bodyText = await page.locator("body").innerText();

  for (const phrase of forbiddenEnglishPhrases) {
    expect(bodyText, `${route} leaked English phrase: ${phrase}`).not.toContain(
      phrase
    );
  }
}

test("admin routes honor Arabic preference for shared UI copy", async ({
  page,
  baseURL,
}) => {
  test.setTimeout(180_000);

  await enableArabic(page);

  const routes = [...staticRoutes, ...(await collectDynamicRoutes(baseURL!))];

  for (const route of routes) {
    await assertNoForbiddenEnglish(page, route);
  }
});

test("stock transfer dialog honors Arabic preference for modal copy", async ({
  page,
}) => {
  await enableArabic(page);
  await page.goto("/inventory/stock-transfers", {
    waitUntil: "domcontentloaded",
    timeout: 15_000,
  });
  await page.waitForTimeout(1_100);

  await page.getByRole("button", { name: /تحويل جديد|New Transfer/i }).click();
  await page.waitForTimeout(500);

  const bodyText = await page.locator("body").innerText();
  const forbiddenModalPhrases = [
    "New Transfer",
    "New Stock Transfer",
    "Source Warehouse",
    "Destination Warehouse",
    "Select source warehouse",
    "Select destination warehouse",
    "Select source warehouse first",
    "Select product",
    "Complete Transfer",
    "Add Item",
    "Optional transfer notes",
  ] as const;

  for (const phrase of forbiddenModalPhrases) {
    expect(bodyText, `stock transfer dialog leaked English phrase: ${phrase}`).not.toContain(
      phrase
    );
  }
});

test("cash bank transfer dialog honors Arabic preference for modal copy", async ({
  page,
}) => {
  await enableArabic(page);
  await page.goto("/accounting/cash-bank", {
    waitUntil: "domcontentloaded",
    timeout: 15_000,
  });
  await page.waitForTimeout(1_100);

  await page.getByRole("button", { name: /تحويل|Transfer/i }).first().click();
  await page.waitForTimeout(500);

  const bodyText = await page.locator("body").innerText();
  const forbiddenModalPhrases = [
    "Transfer Between Accounts",
    "Move funds between cash/bank accounts.",
    "From Account",
    "To Account",
    "Select source",
    "Select destination",
    "Transfer description",
  ] as const;

  for (const phrase of forbiddenModalPhrases) {
    expect(bodyText, `cash-bank transfer dialog leaked English phrase: ${phrase}`).not.toContain(
      phrase
    );
  }
});
