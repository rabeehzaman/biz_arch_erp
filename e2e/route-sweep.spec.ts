import { expect, request as playwrightRequest, test, type APIRequestContext, type Page } from "@playwright/test";

const adminStorageState = "e2e/.auth/admin.json";
const superadminStorageState = "e2e/.auth/superadmin.json";

const staticAdminRoutes = [
  "/",
  "/more",
  "/settings",
  "/products",
  "/customers",
  "/suppliers",
  "/invoices",
  "/invoices/new",
  "/payments",
  "/quotations",
  "/quotations/new",
  "/credit-notes",
  "/credit-notes/new",
  "/purchase-invoices",
  "/purchase-invoices/new",
  "/debit-notes",
  "/debit-notes/new",
  "/supplier-payments",
  "/inventory",
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
  "/reports/branch-pl",
  "/accounting/expenses",
  "/accounting/expenses/new",
  "/accounting/cash-bank",
  "/accounting/journal-entries",
  "/accounting/journal-entries/new",
  "/accounting/chart-of-accounts",
  "/pos",
  "/pos/terminal",
  "/mobile-shop/imei-lookup",
  "/mobile-shop/device-inventory",
] as const;

test.use({
  viewport: { width: 360, height: 800 },
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

async function collectAdminDynamicRoutes(baseURL: string) {
  const api = await playwrightRequest.newContext({
    baseURL,
    storageState: adminStorageState,
  });

  try {
    const [
      invoiceId,
      quotationId,
      creditNoteId,
      purchaseInvoiceId,
      debitNoteId,
      customerId,
      supplierId,
      expenseId,
      journalEntryId,
      cashBankId,
      stockTransferId,
    ] = await Promise.all([
      getFirstId(api, "/api/invoices"),
      getFirstId(api, "/api/quotations"),
      getFirstId(api, "/api/credit-notes"),
      getFirstId(api, "/api/purchase-invoices"),
      getFirstId(api, "/api/debit-notes"),
      getFirstId(api, "/api/customers?compact=true"),
      getFirstId(api, "/api/suppliers?compact=true"),
      getFirstId(api, "/api/expenses"),
      getFirstId(api, "/api/journal-entries"),
      getFirstId(api, "/api/cash-bank-accounts?activeOnly=true"),
      getFirstId(api, "/api/stock-transfers"),
    ]);

    return [
      invoiceId ? `/invoices/${invoiceId}` : null,
      invoiceId ? `/invoices/${invoiceId}/edit` : null,
      quotationId ? `/quotations/${quotationId}` : null,
      quotationId ? `/quotations/${quotationId}/edit` : null,
      creditNoteId ? `/credit-notes/${creditNoteId}` : null,
      creditNoteId ? `/credit-notes/${creditNoteId}/edit` : null,
      purchaseInvoiceId ? `/purchase-invoices/${purchaseInvoiceId}` : null,
      purchaseInvoiceId ? `/purchase-invoices/${purchaseInvoiceId}/edit` : null,
      debitNoteId ? `/debit-notes/${debitNoteId}` : null,
      debitNoteId ? `/debit-notes/${debitNoteId}/edit` : null,
      customerId ? `/customers/${customerId}/statement` : null,
      supplierId ? `/suppliers/${supplierId}/statement` : null,
      expenseId ? `/accounting/expenses/${expenseId}` : null,
      journalEntryId ? `/accounting/journal-entries/${journalEntryId}` : null,
      journalEntryId ? `/accounting/journal-entries/${journalEntryId}/edit` : null,
      cashBankId ? `/accounting/cash-bank/${cashBankId}` : null,
      stockTransferId ? `/inventory/stock-transfers/${stockTransferId}` : null,
    ].filter(Boolean) as string[];
  } finally {
    await api.dispose();
  }
}

async function collectSuperadminRoutes(baseURL: string) {
  const api = await playwrightRequest.newContext({
    baseURL,
    storageState: superadminStorageState,
  });

  try {
    const organizationId = await getFirstId(api, "/api/admin/organizations");

    return [
      "/admin/organizations",
      "/admin/fix-balances",
      organizationId ? `/admin/organizations/${organizationId}` : null,
    ].filter(Boolean) as string[];
  } finally {
    await api.dispose();
  }
}

async function auditRoute(page: Page, route: string) {
  await page.goto(route, { waitUntil: "domcontentloaded", timeout: 15_000 });
  await page.waitForTimeout(900);

  try {
    await page.waitForLoadState("networkidle", { timeout: 2_000 });
  } catch {
    // Some routes keep background requests alive; a short settle delay is enough for the audit.
  }

  for (let attempt = 0; attempt < 3; attempt += 1) {
    try {
      return await page.evaluate(() => {
        const bodyText = document.body.innerText;
        const navItems = Array.from(document.querySelectorAll("nav a")).map((el) => {
          const rect = el.getBoundingClientRect();
          return {
            text: (el.textContent || "").trim(),
            left: rect.left,
            right: rect.right,
          };
        });

        return {
          pathname: location.pathname + location.search,
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          bodyScrollWidth: document.body.scrollWidth,
          bodyLength: bodyText.trim().length,
          hasFatalText:
            bodyText.includes("Application error") ||
            bodyText.includes("Something went wrong") ||
            bodyText.includes("This page could not be found"),
          navItems,
        };
      });
    } catch (error) {
      const isNavigationRace = error instanceof Error && error.message.includes("Execution context was destroyed");
      if (!isNavigationRace || attempt === 2) {
        throw error;
      }

      await page.waitForLoadState("domcontentloaded");
      await page.waitForTimeout(400);
    }
  }

  throw new Error(`Failed to audit route after retries: ${route}`);
}

test("admin mobile route sweep", async ({ page, baseURL }) => {
  test.setTimeout(300_000);

  const routes = [...staticAdminRoutes, ...(await collectAdminDynamicRoutes(baseURL!))];
  const issues: string[] = [];

  for (const route of routes) {
    console.log(`[route-sweep][admin] ${route}`);

    let audit: Awaited<ReturnType<typeof auditRoute>>;
    try {
      audit = await auditRoute(page, route);
    } catch (error) {
      const message = error instanceof Error ? error.message.split("\n")[0] : String(error);
      issues.push(`${route}: audit failed (${message})`);
      continue;
    }

    if (audit.bodyLength === 0) {
      issues.push(`${route}: page body is empty`);
    }

    if (audit.hasFatalText) {
      issues.push(`${route}: fatal error text visible`);
    }

    if (audit.scrollWidth > audit.clientWidth + 1 || audit.bodyScrollWidth > audit.clientWidth + 1) {
      issues.push(`${route}: horizontal overflow (${audit.scrollWidth}/${audit.bodyScrollWidth} > ${audit.clientWidth})`);
    }

    for (const item of audit.navItems) {
      if (item.left < -1 || item.right > audit.clientWidth + 1) {
        issues.push(`${route}: nav item "${item.text}" is clipped`);
      }
    }
  }

  expect(issues).toEqual([]);
});

test("superadmin mobile route sweep", async ({ browser, baseURL }) => {
  test.setTimeout(120_000);

  const context = await browser.newContext({
    viewport: { width: 360, height: 800 },
    isMobile: true,
    hasTouch: true,
    baseURL,
    storageState: superadminStorageState,
  });

  const page = await context.newPage();
  const issues: string[] = [];

  try {
    const routes = await collectSuperadminRoutes(baseURL!);

    for (const route of routes) {
      console.log(`[route-sweep][superadmin] ${route}`);

      let audit: Awaited<ReturnType<typeof auditRoute>>;
      try {
        audit = await auditRoute(page, route);
      } catch (error) {
        const message = error instanceof Error ? error.message.split("\n")[0] : String(error);
        issues.push(`${route}: audit failed (${message})`);
        continue;
      }

      if (audit.bodyLength === 0) {
        issues.push(`${route}: page body is empty`);
      }

      if (audit.hasFatalText) {
        issues.push(`${route}: fatal error text visible`);
      }

      if (audit.scrollWidth > audit.clientWidth + 1 || audit.bodyScrollWidth > audit.clientWidth + 1) {
        issues.push(`${route}: horizontal overflow (${audit.scrollWidth}/${audit.bodyScrollWidth} > ${audit.clientWidth})`);
      }
    }

    expect(issues).toEqual([]);
  } finally {
    await context.close();
  }
});
