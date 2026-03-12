import { expect, test } from "@playwright/test";

async function fixedNavCount(page: Parameters<typeof test>[0]["page"]) {
  return page.evaluate(() => {
    return Array.from(document.querySelectorAll("nav")).filter((element) => {
      const style = getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.position === "fixed" &&
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        rect.width > 0 &&
        rect.height > 0
      );
    }).length;
  });
}

test.describe("desktop UI shell", () => {
  test.use({ viewport: { width: 1440, height: 960 } });

  test("dashboard renders immediately with desktop chrome", async ({ page }) => {
    await page.goto("/");

    await expect(page.getByRole("link", { name: /^dashboard$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /search or jump to/i })).toBeVisible();

    const shellState = await page.evaluate(() => {
      const main = document.querySelector("main");
      if (!main) {
        return null;
      }

      const style = getComputedStyle(main);
      return {
        opacity: style.opacity,
        transform: style.transform,
      };
    });

    expect(shellState).not.toBeNull();
    expect(shellState?.opacity).toBe("1");
    expect(shellState?.transform).toBe("none");
    expect(await fixedNavCount(page)).toBe(0);
  });

  test("products page keeps desktop layout without mobile nav", async ({ page }) => {
    await page.goto("/products");

    await expect(page.getByRole("link", { name: /^products$/i })).toBeVisible();
    await expect(page.getByRole("button", { name: /add product/i })).toBeVisible();
    await expect(await fixedNavCount(page)).toBe(0);
  });

  test("desktop sidebar can still reach its footer when long sections are expanded", async ({ page }) => {
    await page.goto("/");

    await page.getByRole("button", { name: /^sales$/i }).click();
    await page.getByRole("button", { name: /^purchases$/i }).click();
    await page.getByRole("button", { name: /^accounting$/i }).click();
    await page.getByRole("button", { name: /^reports$/i }).click();

    const sidebarState = await page.locator("nav").first().evaluate((element) => {
      element.scrollTo({ top: element.scrollHeight });
      const footer = Array.from(document.querySelectorAll("button")).find((button) => {
        return (button.textContent || "").trim() === "Sign Out";
      });

      if (!footer) {
        return null;
      }

      const footerRect = footer.getBoundingClientRect();
      return {
        canScroll: element.scrollHeight > element.clientHeight,
        footerBottom: footerRect.bottom,
        viewportHeight: window.innerHeight,
      };
    });

    expect(sidebarState).not.toBeNull();
    expect(sidebarState?.canScroll).toBeTruthy();
    expect(sidebarState!.footerBottom).toBeLessThanOrEqual(sidebarState!.viewportHeight);
  });

  test("desktop pages reach the bottom with window scrolling instead of a trapped main scroller", async ({ page }) => {
    await page.goto("/invoices");

    const scrollState = await page.evaluate(() => {
      const main = document.querySelector("main");
      const mainOverflowY = main ? getComputedStyle(main).overflowY : null;

      return {
        mainOverflowY,
        scrollingElementTag: document.scrollingElement?.tagName ?? null,
      };
    });

    expect(scrollState.scrollingElementTag).toBe("HTML");
    expect(scrollState.mainOverflowY).not.toBe("auto");
    expect(scrollState.mainOverflowY).not.toBe("scroll");
  });

  test("pos landing keeps search responsive on desktop", async ({ page }) => {
    await page.goto("/pos");

    await expect(page.getByRole("textbox", { name: /search registers/i })).toBeVisible();
    await expect(page.getByRole("heading", { name: /pos terminal/i })).toBeVisible();

    const registerButtons = await page.getByRole("button", { name: /continue selling|open register/i }).count();
    expect(registerButtons).toBeGreaterThan(0);
  });

  test("settings desktop shell lazy-loads non-active tabs", async ({ page }) => {
    const requests = new Set<string>();

    page.on("request", (request) => {
      if (request.method() !== "GET") {
        return;
      }

      requests.add(new URL(request.url()).pathname);
    });

    await page.goto("/settings");
    await expect(page.getByRole("tab", { name: /company/i })).toBeVisible();
    await page.waitForTimeout(1200);

    expect(requests.has("/api/settings")).toBeTruthy();
    expect(requests.has("/api/units")).toBeFalsy();
    expect(requests.has("/api/accounts")).toBeFalsy();
    expect(requests.has("/api/settings/pos-receipt-printing")).toBeFalsy();
    expect(requests.has("/api/user-warehouse-access")).toBeFalsy();

    await page.getByRole("tab", { name: /units/i }).click();
    await expect
      .poll(() => requests.has("/api/units"))
      .toBeTruthy();
  });

  test("login desktop page stays simple without blurred desktop chrome", async ({ browser, baseURL }) => {
    const context = await browser.newContext({
      baseURL,
      viewport: { width: 1440, height: 960 },
      storageState: { cookies: [], origins: [] },
    });
    const page = await context.newPage();

    try {
      await page.goto("/login");
      await expect(page.locator("#email")).toBeVisible();

      const audit = await page.evaluate(() => {
        const blurredElements = Array.from(document.querySelectorAll<HTMLElement>("*")).filter((element) => {
          const style = getComputedStyle(element);
          return style.backdropFilter && style.backdropFilter !== "none";
        }).length;

        return {
          clientWidth: document.documentElement.clientWidth,
          scrollWidth: document.documentElement.scrollWidth,
          bodyScrollWidth: document.body.scrollWidth,
          blurredElements,
        };
      });

      expect(audit.scrollWidth).toBeLessThanOrEqual(audit.clientWidth + 1);
      expect(audit.bodyScrollWidth).toBeLessThanOrEqual(audit.clientWidth + 1);
      expect(audit.blurredElements).toBe(0);
    } finally {
      await context.close();
    }
  });
});
