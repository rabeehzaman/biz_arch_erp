import { expect, test } from "@playwright/test";

test.describe("standalone shell behavior", () => {
  test.use({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    storageState: "e2e/.auth/admin.json",
  });

  test("browser mode keeps normal mobile viewport behavior", async ({ page }) => {
    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();

    const shellState = await page.evaluate(() => ({
      viewport: document.querySelector('meta[name="viewport"]')?.getAttribute("content") ?? "",
      themeColor: document.querySelector('meta[name="theme-color"]')?.getAttribute("content") ?? "",
      displayMode: document.documentElement.dataset.appDisplayMode,
      orientation: document.documentElement.dataset.appOrientation,
      blockerVisible: Boolean(document.body.textContent?.includes("Rotate your phone")),
    }));
    const manifestResponse = await page.request.get("/manifest.webmanifest");
    expect(manifestResponse.ok()).toBeTruthy();
    const manifest = (await manifestResponse.json()) as { background_color?: string; theme_color?: string };

    expect(shellState.viewport).not.toContain("user-scalable=no");
    expect(shellState.viewport).not.toContain("maximum-scale=1");
    expect(shellState.themeColor).toBe("#ffffff");
    expect(shellState.displayMode).toBe("browser");
    expect(shellState.orientation).toBe("portrait");
    expect(shellState.blockerVisible).toBeFalsy();
    expect(manifest.background_color).toBe("#ffffff");
    expect(manifest.theme_color).toBe("#ffffff");
  });

  test("standalone mode disables zoom and stays usable in portrait", async ({ page }) => {
    await page.addInitScript(() => {
      const originalMatchMedia = window.matchMedia.bind(window);

      window.matchMedia = (query: string) => {
        if (query === "(display-mode: standalone)" || query === "(display-mode: fullscreen)") {
          return {
            matches: true,
            media: query,
            onchange: null,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => false,
          } as MediaQueryList;
        }

        return originalMatchMedia(query);
      };
    });

    await page.goto("/", { waitUntil: "domcontentloaded" });
    await expect(page.getByRole("heading", { name: /dashboard/i })).toBeVisible();

    const shellState = await page.evaluate(() => ({
      viewport: document.querySelector('meta[name="viewport"]')?.getAttribute("content") ?? "",
      themeColor: document.querySelector('meta[name="theme-color"]')?.getAttribute("content") ?? "",
      displayMode: document.documentElement.dataset.appDisplayMode,
      orientation: document.documentElement.dataset.appOrientation,
      blockerVisible: Boolean(document.body.textContent?.includes("Rotate your phone")),
    }));

    expect(shellState.viewport).toContain("user-scalable=no");
    expect(shellState.viewport).toContain("maximum-scale=1");
    expect(shellState.themeColor).toBe("#ffffff");
    expect(shellState.displayMode).toBe("standalone");
    expect(shellState.orientation).toBe("portrait");
    expect(shellState.blockerVisible).toBeFalsy();
  });

  test("standalone mode blocks landscape with a rotate overlay", async ({ page }) => {
    await page.addInitScript(() => {
      const originalMatchMedia = window.matchMedia.bind(window);

      window.matchMedia = (query: string) => {
        if (query === "(display-mode: standalone)" || query === "(display-mode: fullscreen)") {
          return {
            matches: true,
            media: query,
            onchange: null,
            addListener: () => {},
            removeListener: () => {},
            addEventListener: () => {},
            removeEventListener: () => {},
            dispatchEvent: () => false,
          } as MediaQueryList;
        }

        return originalMatchMedia(query);
      };
    });

    await page.setViewportSize({ width: 844, height: 390 });
    await page.goto("/", { waitUntil: "domcontentloaded" });

    await expect(page.getByText(/portrait only/i)).toBeVisible();
    await expect(page.getByRole("heading", { name: /rotate your phone/i })).toBeVisible();

    const shellState = await page.evaluate(() => ({
      viewport: document.querySelector('meta[name="viewport"]')?.getAttribute("content") ?? "",
      displayMode: document.documentElement.dataset.appDisplayMode,
      orientation: document.documentElement.dataset.appOrientation,
    }));

    expect(shellState.viewport).toContain("user-scalable=no");
    expect(shellState.displayMode).toBe("standalone");
    expect(shellState.orientation).toBe("landscape");
  });
});
