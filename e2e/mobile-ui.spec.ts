import { expect, test, type Page } from "@playwright/test";

test.use({
  viewport: { width: 360, height: 800 },
  isMobile: true,
  hasTouch: true,
  storageState: "e2e/.auth/admin.json",
});

async function expectNoHorizontalOverflow(page: Page) {
  const metrics = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
    bodyScrollWidth: document.body.scrollWidth,
  }));

  expect(metrics.scrollWidth, "document scrollWidth should fit the mobile viewport").toBeLessThanOrEqual(metrics.clientWidth + 1);
  expect(metrics.bodyScrollWidth, "body scrollWidth should fit the mobile viewport").toBeLessThanOrEqual(metrics.clientWidth + 1);
}

async function expectBottomNavSurfaceStable(page: Page) {
  const navMetrics = await page.evaluate(() => {
    const nav = Array.from(document.querySelectorAll("nav")).find((element) => getComputedStyle(element).position === "fixed");
    const underlay = document.querySelector('[data-testid="mobile-nav-underlay"]');

    if (!nav) {
      return null;
    }

    const styles = getComputedStyle(nav);
    const backgroundColor = styles.backgroundColor;
    const rgbaAlpha = backgroundColor.match(/rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*([0-9.]+)\s*\)/i);
    const slashAlpha = backgroundColor.match(/\/\s*([0-9.]+)\s*\)$/);
    const backgroundAlpha = rgbaAlpha ? Number(rgbaAlpha[1]) : slashAlpha ? Number(slashAlpha[1]) : 1;

    return {
      backgroundAlpha,
      backgroundColor,
      backdropFilter: styles.backdropFilter,
      underlayBackgroundColor: underlay ? getComputedStyle(underlay).backgroundColor : null,
    };
  });

  expect(navMetrics, "bottom mobile nav should be present").not.toBeNull();
  expect(navMetrics?.backgroundAlpha ?? 0, "bottom nav should stay opaque so page content cannot bleed through it").toBeGreaterThanOrEqual(0.99);
  expect(navMetrics?.backdropFilter ?? "", "bottom nav should avoid blur so it stays crisp after modal open/close").toBe("none");
  expect(navMetrics?.underlayBackgroundColor, "bottom nav should include an opaque underlay to cover any Safari bottom-gap bounce").toBe("rgb(255, 255, 255)");
}

async function expectBottomNavDocked(page: Page) {
  const navMetrics = await page.evaluate(() => {
    const nav = Array.from(document.querySelectorAll("nav")).find(
      (element) => getComputedStyle(element).position === "fixed"
    );

    if (!nav) {
      return null;
    }

    const rect = nav.getBoundingClientRect();
    const inner = nav.firstElementChild instanceof HTMLElement ? nav.firstElementChild : null;

    return {
      bottomGap: window.innerHeight - rect.bottom,
      height: rect.height,
      innerPaddingBottom: inner ? Number.parseFloat(getComputedStyle(inner).paddingBottom) : 0,
      transform: getComputedStyle(nav).transform,
    };
  });

  expect(navMetrics, "bottom mobile nav should be present").not.toBeNull();
  expect(navMetrics?.bottomGap ?? 999, "bottom nav should stay docked to the viewport bottom").toBeLessThanOrEqual(1);
  expect(navMetrics?.height ?? 999, "bottom nav height should stay compact after modal keyboard open/close").toBeLessThanOrEqual(112);
  expect(navMetrics?.innerPaddingBottom ?? 999, "bottom nav safe-area padding should not balloon after closing the product modal").toBeLessThanOrEqual(48);
  expect(navMetrics?.transform ?? "", "bottom nav should not drift with page overscroll in its resting state").toBe("none");
}

async function getDialogMetrics(page: Page) {
  return page.evaluate(() => {
    const dialog = document.querySelector('[data-slot="dialog-content"]');
    const wrapper = dialog?.querySelector(':scope > div:nth-of-type(2)');
    const header = dialog?.querySelector('[data-slot="dialog-header"]');
    const body = dialog?.querySelector('[data-testid="product-form-body"]');
    const footer = dialog?.querySelector('[data-slot="dialog-footer"]');
    const category = document.getElementById("category");
    const toRect = (element: Element | null) => {
      if (!element) return null;
      const rect = element.getBoundingClientRect();
      return {
        top: rect.top,
        bottom: rect.bottom,
        left: rect.left,
        right: rect.right,
        width: rect.width,
        height: rect.height,
      };
    };

    return {
      clientWidth: document.documentElement.clientWidth,
      scrollWidth: document.documentElement.scrollWidth,
      bodyScrollWidth: document.body.scrollWidth,
      viewportHeight: window.innerHeight,
      dialog: toRect(dialog),
      header: toRect(header),
      footer: toRect(footer),
      category: toRect(category),
      body: body
        ? {
            scrollTop: body.scrollTop,
            scrollHeight: body.scrollHeight,
            clientHeight: body.clientHeight,
            overflowY: getComputedStyle(body).overflowY,
          }
        : null,
      wrapper: wrapper
        ? {
            scrollHeight: wrapper.scrollHeight,
            clientHeight: wrapper.clientHeight,
            overflowY: getComputedStyle(wrapper).overflowY,
          }
        : null,
      activeElementId: document.activeElement instanceof HTMLElement ? document.activeElement.id : null,
      activeElementRole: document.activeElement?.getAttribute("data-slot") ?? document.activeElement?.getAttribute("role"),
      scannerVisible: Boolean(document.querySelector('[aria-label="Scanner"]')),
    };
  });
}

async function scrollOpenDialog(page: Page, amount: number | "end" = 260) {
  await page.evaluate((value) => {
    const dialog = document.querySelector('[data-slot="dialog-content"]');
    const scrollHost =
      dialog?.querySelector<HTMLElement>('[data-testid="product-form-body"]') ??
      dialog?.querySelector<HTMLElement>(':scope > div:nth-of-type(2)');

    if (!scrollHost) {
      throw new Error("No scrollable dialog host found");
    }

    scrollHost.scrollTop = value === "end" ? scrollHost.scrollHeight : value;
  }, amount);
}

async function expectDialogChromePinned(page: Page) {
  const initialMetrics = await getDialogMetrics(page);
  expect(initialMetrics.dialog?.top ?? -1, "dialog should stay inside the mobile viewport").toBeGreaterThanOrEqual(0);
  expect(initialMetrics.dialog?.bottom ?? 0, "dialog should stay inside the mobile viewport").toBeLessThanOrEqual(initialMetrics.viewportHeight + 2);

  const scrollState = initialMetrics.body ?? initialMetrics.wrapper;
  expect(scrollState, "dialog should expose a scroll host").not.toBeNull();
  const extraScroll = (scrollState?.scrollHeight ?? 0) - (scrollState?.clientHeight ?? 0);

  if (extraScroll > 24) {
    const headerTopBeforeScroll = initialMetrics.header?.top ?? 0;
    const footerBottomBeforeScroll = initialMetrics.footer?.bottom ?? 0;

    await scrollOpenDialog(page, Math.min(260, Math.max(extraScroll, 0)));
    await page.waitForTimeout(120);

    const afterScrollMetrics = await getDialogMetrics(page);
    expect(
      Math.abs((afterScrollMetrics.header?.top ?? 0) - headerTopBeforeScroll),
      "dialog header should stay pinned while the body scrolls"
    ).toBeLessThanOrEqual(2);
    expect(
      Math.abs((afterScrollMetrics.footer?.bottom ?? 0) - footerBottomBeforeScroll),
      "dialog footer should stay pinned while the body scrolls"
    ).toBeLessThanOrEqual(2);
  }
}

test.describe("mobile UI stability", () => {
  test("dashboard shell stays stable on mobile", async ({ page }) => {
    await page.goto("/");
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /more/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /scanner/i })).toBeVisible();
    await expect(page.getByTestId("mobile-language-switcher")).toBeVisible();
    await page.getByTestId("mobile-language-switcher").click();
    await expect(page.getByTestId("mobile-language-option-en")).toBeVisible();
    await expect(page.getByTestId("mobile-language-option-ar")).toBeVisible();
    await page.keyboard.press("Escape");
    const navMetrics = await page.evaluate(() => {
      const nav = document.querySelector("nav");
      const items = Array.from(nav?.querySelectorAll("a") ?? []).map((el) => {
        const rect = el.getBoundingClientRect();
        return {
          text: (el.textContent || "").trim(),
          left: rect.left,
          right: rect.right,
        };
      });

      return { viewport: window.innerWidth, items };
    });

    for (const item of navMetrics.items) {
      expect(item.left, `${item.text} should stay inside left edge`).toBeGreaterThanOrEqual(0);
      expect(item.right, `${item.text} should stay inside right edge`).toBeLessThanOrEqual(navMetrics.viewport);
    }
    await expectBottomNavSurfaceStable(page);
    await expectBottomNavDocked(page);
    await expectNoHorizontalOverflow(page);
  });

  test("scanner stays discoverable when camera APIs are unavailable", async ({ page }) => {
    await page.addInitScript(() => {
      Object.defineProperty(navigator, "mediaDevices", {
        configurable: true,
        get: () => undefined,
      });
    });

    await page.goto("/");
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();

    const scannerButton = page.getByRole("button", { name: /scanner/i });
    await expect(scannerButton).toBeVisible();
    await scannerButton.click();

    await expect(page.getByText(/not exposing camera access/i)).toBeVisible();
    await expect(page.getByText(/Mobile camera scanning works in a secure browser context/i)).toBeVisible();
  });

  test("invoices list uses compact mobile cards", async ({ page }) => {
    await page.goto("/invoices");
    await expect(page.getByRole("heading", { name: /sales invoices/i })).toBeVisible();
    await expect(page.getByTestId("mobile-language-switcher")).toHaveCount(0);
    await expect(page.getByRole("link", { name: /new invoice/i })).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(100);
    await expectBottomNavDocked(page);
    await expect(page.locator("table:visible")).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });

  test("products tabs keep mobile cards in both sections", async ({ page }) => {
    await page.goto("/products");
    await expect(page.getByRole("heading", { name: /^Products$/ })).toBeVisible();
    await expect(page.locator("table:visible")).toHaveCount(0);
    await expectNoHorizontalOverflow(page);

    await page.getByRole("button", { name: /inventory/i }).click();
    await expect(page.locator("table:visible")).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });

  test("product add modal keeps mobile scrolling and overlays under control", async ({ page }) => {
    await page.goto("/products?action=new", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /^Products$/ })).toBeVisible();

    const dialog = page.locator('[data-slot="dialog-content"]');
    await expect(dialog).toBeVisible({ timeout: 15000 });
    await expect(page.getByRole("button", { name: /scanner/i })).toHaveCount(0);

    const initialMetrics = await getDialogMetrics(page);
    expect(initialMetrics.dialog?.top ?? 999, "product modal should stay in the tall mobile sheet layout").toBeLessThanOrEqual(70);
    expect(initialMetrics.body?.overflowY).toBe("auto");
    expect(initialMetrics.body?.scrollHeight ?? 0, "product form body should remain scrollable").toBeGreaterThan(initialMetrics.body?.clientHeight ?? 0);
    expect(initialMetrics.category?.width ?? 0, "category trigger should fill the modal width").toBeGreaterThanOrEqual(280);
    expect(initialMetrics.activeElementId, "mobile product dialog should not auto-focus the name field and trigger the keyboard").not.toBe("prod-name");
    await expectNoHorizontalOverflow(page);

    await expectDialogChromePinned(page);

    await page.locator("#prod-isBundle").check();
    await page.getByRole("button", { name: /add component/i }).click();
    await scrollOpenDialog(page, "end");

    await expect(page.getByRole("button", { name: /^add product$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /scanner/i })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);

    await page.locator("#prod-name").click();
    await expect(page.locator("#prod-name")).toBeFocused();

    await page.getByRole("button", { name: /close/i }).click();
    await expect(dialog).toHaveCount(0);
    await page.waitForTimeout(1100);
    await expect(page.getByRole("button", { name: /scanner/i })).toBeVisible();
    await expectBottomNavSurfaceStable(page);
    await expectBottomNavDocked(page);

    await page.goto("/invoices");
    await expect(page.getByRole("heading", { name: /sales invoices/i })).toBeVisible();
    await expectBottomNavSurfaceStable(page);
    await expectBottomNavDocked(page);
  });

  test("product edit modal keeps the same mobile constraints", async ({ page, request }) => {
    const response = await request.get("/api/products");
    expect(response.ok()).toBeTruthy();
    const products = (await response.json()) as Array<{ id: string; name: string }>;
    test.skip(products.length === 0, "No products available for the edit modal test");

    const product = products[0];
    await page.goto(`/products?action=edit&id=${product.id}`, { waitUntil: "domcontentloaded" });
    await page.waitForTimeout(450);

    const dialog = page.locator('[data-slot="dialog-content"]');
    await expect(dialog).toBeVisible();
    await expect(page.locator("#prod-name")).toHaveValue(product.name);
    await expect(page.getByRole("button", { name: /scanner/i })).toHaveCount(0);

    const metrics = await getDialogMetrics(page);
    expect(metrics.dialog?.top ?? 999, "edit modal should stay in the mobile sheet layout").toBeLessThanOrEqual(70);
    await expectDialogChromePinned(page);
    await expectNoHorizontalOverflow(page);
  });

  test("settings tabs remain operable without page overflow", async ({ page }) => {
    await page.goto("/settings");
    await expect(page.getByRole("heading", { name: /settings/i })).toBeVisible();
    const tabList = page.getByRole("tablist");
    await expect(tabList).toBeVisible();
    await tabList.evaluate((element) => {
      element.scrollLeft = element.scrollWidth;
    });

    const usersTab = page.getByRole("tab", { name: /^Users$/ });
    await expect(usersTab).toBeVisible();
    await usersTab.click();
    await expect(usersTab).toHaveAttribute("data-state", "active");
    await expectNoHorizontalOverflow(page);
  });

  test("sales and operations lists switch to mobile cards", async ({ page }) => {
    const cases = [
      { route: "/quotations", heading: /quotations/i },
      { route: "/purchase-invoices", heading: /purchase invoices/i },
      { route: "/credit-notes", heading: /credit notes/i },
      { route: "/debit-notes", heading: /debit notes/i },
      { route: "/customers", heading: /customers/i },
      { route: "/suppliers", heading: /suppliers/i },
      { route: "/payments", heading: /customer payments/i },
      { route: "/supplier-payments", heading: /supplier payments/i },
      { route: "/accounting/expenses", heading: /expenses/i },
    ] as const;

    for (const testCase of cases) {
      await page.goto(testCase.route);
      await expect(page.getByRole("heading", { name: testCase.heading })).toBeVisible();
      await expect(page.locator("table:visible")).toHaveCount(0);
      await expectNoHorizontalOverflow(page);
    }
  });

  test("reports and admin inventory lists switch to mobile cards", async ({ page }) => {
    const cases = [
      { route: "/reports/customer-balances", heading: /customer balances/i },
      { route: "/reports/supplier-balances", heading: /supplier balances/i },
      { route: "/inventory/branches", heading: /branches & warehouses/i },
      { route: "/inventory/branches?tab=warehouses", heading: /branches & warehouses/i },
      { route: "/inventory/opening-stock", heading: /opening stock/i },
      { route: "/inventory/stock-transfers", heading: /stock transfers/i },
      { route: "/mobile-shop/device-inventory", heading: /device inventory/i },
      { route: "/accounting/journal-entries", heading: /journal entries/i },
    ] as const;

    for (const testCase of cases) {
      await page.goto(testCase.route);
      await expect(page.getByRole("heading", { name: testCase.heading })).toBeVisible();
      await expect(page.locator("table:visible")).toHaveCount(0);
      await expectNoHorizontalOverflow(page);
    }
  });

  test("financial summary reports switch to mobile cards", async ({ page }) => {
    const cases = [
      { route: "/reports/trial-balance", heading: /trial balance/i },
      { route: "/reports/profit-loss", heading: /profit & loss/i },
      { route: "/reports/cash-flow", heading: /cash flow/i },
      { route: "/reports/expense-report", heading: /expense report/i },
      { route: "/reports/stock-summary", heading: /stock summary/i },
      { route: "/reports/balance-sheet", heading: /balance sheet/i },
      { route: "/reports/profit-by-items", heading: /profit by invoice/i },
    ] as const;

    for (const testCase of cases) {
      await page.goto(testCase.route);
      await expect(page.getByRole("heading", { name: testCase.heading })).toBeVisible();
      await expect(page.locator("table:visible")).toHaveCount(0);
      await expectNoHorizontalOverflow(page);
    }
  });

  test("invoice detail navigation resets scroll to the top", async ({ page }) => {
    await page.goto("/invoices");
    await expect(page.getByRole("heading", { name: /sales invoices/i })).toBeVisible();
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight));
    await page.waitForTimeout(100);

    await page.getByRole("link", { name: /details/i }).first().click();
    await page.waitForURL(/\/invoices\/[^/]+$/);
    await expect(page.getByRole("heading", { name: /invoice /i })).toBeVisible();

    const scrollY = await page.evaluate(() => window.scrollY);
    expect(scrollY, "detail page should open from the top on mobile").toBeLessThanOrEqual(1);
    await expectNoHorizontalOverflow(page);
  });

  test("pos landing shows mobile nav but terminal stays immersive", async ({ page }) => {
    await page.goto("/pos");
    await expect(page).toHaveURL(/\/pos$/);
    await expect(page.getByTestId("mobile-language-switcher")).toHaveCount(0);
    await expect(page.getByRole("link", { name: /^pos$/i })).toBeVisible();
    await expect(page.getByRole("link", { name: /more/i })).toBeVisible();
    await expectNoHorizontalOverflow(page);

    await page.goto("/pos/terminal");
    await expect(page).toHaveURL(/\/pos\/terminal$/);
    await expect(page.getByRole("link", { name: /more/i })).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });
});

test.describe("mobile dialog stability", () => {
  test.use({
    viewport: { width: 360, height: 640 },
    isMobile: true,
    hasTouch: true,
    storageState: "e2e/.auth/admin.json",
  });

  test("core admin dialogs keep header and footer anchored on short mobile screens", async ({ page }) => {
    test.setTimeout(90000);

    const cases = [
      {
        route: "/customers",
        pageHeading: /customers/i,
        openButton: /add customer/i,
        dialogHeading: /add new customer/i,
      },
      {
        route: "/suppliers",
        pageHeading: /suppliers/i,
        openButton: /add supplier/i,
        dialogHeading: /add new supplier/i,
      },
      {
        route: "/payments",
        pageHeading: /customer payments/i,
        openButton: /record payment/i,
        dialogHeading: /record payment/i,
      },
      {
        route: "/supplier-payments",
        pageHeading: /supplier payments/i,
        openButton: /^record payment$/i,
        dialogHeading: /record supplier payment/i,
      },
      {
        route: "/inventory/stock-transfers",
        pageHeading: /stock transfers/i,
        openButton: /new transfer/i,
        dialogHeading: /new stock transfer/i,
      },
      {
        route: "/accounting/chart-of-accounts",
        pageHeading: /chart of accounts/i,
        openButton: /add account/i,
        dialogHeading: /add account/i,
      },
      {
        route: "/mobile-shop/device-inventory",
        pageHeading: /device inventory/i,
        openButton: /add device/i,
        dialogHeading: /add device/i,
      },
    ] as const;

    for (const testCase of cases) {
      await page.goto(testCase.route, { waitUntil: "domcontentloaded" });
      await expect(page.getByRole("heading", { name: testCase.pageHeading })).toBeVisible();
      const trigger = page.getByRole("button", { name: testCase.openButton }).first();
      const dialogHeading = page.getByRole("heading", { name: testCase.dialogHeading });
      await expect(trigger).toBeVisible();
      await trigger.evaluate((element: HTMLButtonElement) => element.click());
      try {
        await dialogHeading.waitFor({ state: "visible", timeout: 1500 });
      } catch {
        await trigger.click({ force: true });
        await expect(dialogHeading).toBeVisible();
      }
      await page.waitForTimeout(400);

      await expectDialogChromePinned(page);
      await expectNoHorizontalOverflow(page);
    }
  });
});

test.describe("superadmin mobile UI stability", () => {
  test.use({
    viewport: { width: 360, height: 800 },
    isMobile: true,
    hasTouch: true,
    storageState: "e2e/.auth/superadmin.json",
  });

  test("organizations list uses mobile cards", async ({ page }) => {
    await page.goto("/admin/organizations");
    await expect(page.getByRole("heading", { name: /^organizations$/i })).toBeVisible();
    await expect(page.locator("table:visible")).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });

  test("superadmin mobile shell exposes sign out", async ({ page }) => {
    await page.goto("/admin/organizations", { waitUntil: "domcontentloaded" });
    const signOutButton = page.getByRole("button", { name: /sign out/i });
    await expect(signOutButton).toBeVisible();
    await signOutButton.click();
    await page.waitForURL("**/login");
  });

  test("fix balances stays table-free on mobile after running checks", async ({ page }) => {
    await page.goto("/admin/fix-balances");
    await expect(page.getByRole("heading", { name: /fix customer balances/i })).toBeVisible();
    await page.getByRole("button", { name: /check balances/i }).click();
    await Promise.race([
      page.getByText(/total customers:/i).waitFor({ timeout: 15000 }),
      page.getByText(/failed to check customer balances/i).waitFor({ timeout: 15000 }),
    ]);
    await expect(page.locator("table:visible")).toHaveCount(0);
    await expectNoHorizontalOverflow(page);
  });

  test("sidebar configuration dialog stays pinned on short mobile screens", async ({ page, request }) => {
    const response = await request.get("/api/admin/organizations");
    expect(response.ok()).toBeTruthy();
    const organizations = (await response.json()) as Array<{ id: string; name: string }>;
    test.skip(organizations.length === 0, "No organizations available for the sidebar dialog test");

    await page.setViewportSize({ width: 360, height: 640 });
    await page.goto(`/admin/organizations/${organizations[0].id}`, { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("button", { name: /^configure$/i })).toBeVisible();

    await page.getByRole("button", { name: /^configure$/i }).click();
    await expect(page.getByRole("heading", { name: /sidebar configuration/i })).toBeVisible();
    await page.locator('[data-slot="dialog-content"] .animate-spin').waitFor({ state: "detached", timeout: 10000 }).catch(() => {});
    await page.waitForTimeout(150);

    await expectDialogChromePinned(page);
    await expectNoHorizontalOverflow(page);
  });
});
