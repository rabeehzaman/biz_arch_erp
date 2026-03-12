import { expect, test } from "@playwright/test";
import {
  createApiContext,
  createBranch,
  createPosProductAndStock,
  createWarehouse,
  makeRunId,
  openPosSession,
} from "./helpers/pos";

function makeSpecRunId(label: string) {
  return `${makeRunId()}-${label}-${Math.random().toString(36).slice(2, 8)}`;
}

test.describe("POS checkout layout", () => {
  test.setTimeout(120_000);

  test("keeps the desktop numpad aligned under quick cash amounts", async ({ page, baseURL }) => {
    const api = await createApiContext(baseURL!, "admin");
    const runId = makeSpecRunId("checkout-layout");
    const branch = await createBranch(api, runId);
    const warehouse = await createWarehouse(api, branch.id, runId);
    await createPosProductAndStock(api, {
      runId,
      branchId: branch.id,
      warehouseId: warehouse.id,
      quantity: 20,
      unitCost: 25,
      unitPrice: 60,
    });
    const session = await openPosSession(api, {
      branchId: branch.id,
      warehouseId: warehouse.id,
      openingCash: 100,
    });

    const productName = `POS Product ${runId}`;

    await page.setViewportSize({ width: 1440, height: 900 });
    await page.goto(`/pos/terminal?sessionId=${session.id}`);

    const productTile = page.locator("button").filter({ hasText: productName }).first();
    await expect(productTile).toBeVisible();
    await productTile.click();

    const payNowButton = page.getByRole("button", { name: /^Pay Now/ });
    await expect(payNowButton).toBeVisible();
    await payNowButton.click();

    await expect(page.getByRole("heading", { name: "Checkout" })).toBeVisible();
    await expect(page.getByRole("textbox", { name: "0.00" })).toBeVisible();

    const layoutMetrics = await page.evaluate(() => {
      const exactButton = Array.from(document.querySelectorAll("button")).find((element) =>
        element.textContent?.includes("Exact")
      );
      const quickAmountsRow = exactButton?.parentElement;
      const numpad = quickAmountsRow?.nextElementSibling as HTMLElement | null;
      const creditRow = Array.from(document.querySelectorAll("label")).find((element) =>
        element.textContent?.includes("Credit Sale")
      )?.parentElement as HTMLElement | null;

      if (!quickAmountsRow || !numpad || !creditRow) {
        return null;
      }

      const quickAmountsRect = quickAmountsRow.getBoundingClientRect();
      const numpadRect = numpad.getBoundingClientRect();
      const creditRowRect = creditRow.getBoundingClientRect();

      return {
        gapBetweenQuickAmountsAndNumpad: Math.round(numpadRect.top - quickAmountsRect.bottom),
        gapBetweenNumpadAndCreditRow: Math.round(creditRowRect.top - numpadRect.bottom),
      };
    });

    expect(layoutMetrics, "checkout layout metrics should be measurable").not.toBeNull();
    expect(
      layoutMetrics?.gapBetweenQuickAmountsAndNumpad ?? 999,
      "desktop numpad should stay visually attached to the quick amount row"
    ).toBeLessThanOrEqual(16);
    expect(
      layoutMetrics?.gapBetweenNumpadAndCreditRow ?? 999,
      "desktop numpad should not drift far away from the credit-sale row"
    ).toBeLessThanOrEqual(28);

    await api.dispose();
  });
});
