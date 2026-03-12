import { expect, test } from "@playwright/test";
import {
  createApiContext,
  createBranch,
  createPosProductCatalog,
  createWarehouse,
  makeRunId,
  openPosSession,
} from "./helpers/pos";

function makeSpecRunId(label: string) {
  return `${makeRunId()}-${label}-${Math.random().toString(36).slice(2, 8)}`;
}

test.describe("POS product grid scroll", () => {
  test.setTimeout(120_000);

  test("keeps scroll position after selecting a product near the bottom", async ({ page, baseURL }) => {
    const api = await createApiContext(baseURL!, "admin");
    const runId = makeSpecRunId("grid-scroll");
    const branch = await createBranch(api, runId);
    const warehouse = await createWarehouse(api, branch.id, runId);
    const catalog = await createPosProductCatalog(api, {
      runId,
      branchId: branch.id,
      warehouseId: warehouse.id,
      count: 24,
      quantity: 20,
      unitCost: 25,
      unitPrice: 60,
    });
    const session = await openPosSession(api, {
      branchId: branch.id,
      warehouseId: warehouse.id,
      openingCash: 100,
    });

    await page.setViewportSize({ width: 900, height: 700 });
    await page.goto(`/pos/terminal?sessionId=${session.id}`);

    const productGrid = page.getByTestId("pos-product-grid");
    await expect(productGrid).toBeVisible();

    const firstTile = page.getByRole("button", { name: catalog[0].name }).first();
    await expect(firstTile).toBeVisible();
    await firstTile.click();

    await productGrid.evaluate((element) => {
      element.scrollTop = element.scrollHeight;
    });

    const bottomTile = page.getByRole("button", { name: catalog[catalog.length - 1].name }).first();
    await expect(bottomTile).toBeVisible();

    const scrollTopBefore = await productGrid.evaluate((element) => element.scrollTop);
    await bottomTile.click();
    await expect(bottomTile).toHaveAttribute("aria-pressed", "true");

    const scrollTopAfter = await productGrid.evaluate((element) => element.scrollTop);

    expect(scrollTopBefore, "grid should be scrolled before selecting the bottom product").toBeGreaterThan(100);
    expect(scrollTopAfter, "grid scroll should not jump back to the top after selection").toBeGreaterThan(
      scrollTopBefore - 24,
    );

    await api.dispose();
  });
});
