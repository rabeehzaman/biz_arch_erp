import { expect, test } from "@playwright/test";
import {
  configureRegister,
  createApiContext,
  createBranch,
  createPosProductAndStock,
  createWarehouse,
  listCashBankAccounts,
  makeRunId,
  openPosSession,
  posCheckout,
  setOrgPosAccountingMode,
} from "./helpers/pos";

test.describe("POS close dialog", () => {
  test.setTimeout(120_000);

  test("shows card and bank totals in closing dialog and calculates cash difference correctly", async ({ page, baseURL }) => {
    const superadminApi = await createApiContext(baseURL!, "superadmin");
    const adminApi = await createApiContext(baseURL!, "admin");
    const runId = makeRunId();

    await setOrgPosAccountingMode(superadminApi, "CLEARING_ACCOUNT");

    const branch = await createBranch(adminApi, `${runId}-dialog`);
    const warehouse = await createWarehouse(adminApi, branch.id, `${runId}-dialog`);
    const accounts = await listCashBankAccounts(adminApi);
    const cashAccount = accounts.find((account: any) => account.accountSubType === "CASH" && account.branchId === branch.id)
      ?? accounts.find((account: any) => account.accountSubType === "CASH");
    const bankAccount = accounts.find((account: any) => account.accountSubType === "BANK");

    expect(cashAccount).toBeTruthy();
    expect(bankAccount).toBeTruthy();

    await configureRegister(adminApi, {
      branchId: branch.id,
      warehouseId: warehouse.id,
      defaultCashAccountId: cashAccount.id,
      defaultBankAccountId: bankAccount.id,
    });

    const stock = await createPosProductAndStock(adminApi, {
      runId: `${runId}-dialog`,
      branchId: branch.id,
      warehouseId: warehouse.id,
      quantity: 20,
      unitCost: 25,
      unitPrice: 50,
    });

    const session = await openPosSession(adminApi, {
      branchId: branch.id,
      warehouseId: warehouse.id,
      openingCash: 100,
    });

    await posCheckout(adminApi, {
      sessionId: session.id,
      productId: stock.productId,
      quantity: 3,
      unitPrice: stock.unitPrice,
      payments: [
        { method: "CASH", amount: 80 },
        { method: "CREDIT_CARD", amount: 40, reference: `cc-${runId}` },
        { method: "BANK_TRANSFER", amount: 30, reference: `bank-${runId}` },
      ],
    });

    await page.goto(`/pos/terminal?sessionId=${session.id}`);
    await page.getByRole("button", { name: /End Session/i }).click();

    const dialog = page.getByRole("dialog");
    const paymentBreakdownCard = dialog
      .locator("div")
      .filter({ hasText: "Payment Breakdown" })
      .first();

    await expect(dialog.getByRole("heading", { name: "Close POS Session" })).toBeVisible();
    await expect(paymentBreakdownCard).toBeVisible();
    await expect(paymentBreakdownCard).toContainText("Cash");
    await expect(paymentBreakdownCard).toContainText("80.00");
    await expect(paymentBreakdownCard).toContainText("Card");
    await expect(paymentBreakdownCard).toContainText("40.00");
    await expect(paymentBreakdownCard).toContainText("Bank Transfer");
    await expect(paymentBreakdownCard).toContainText("30.00");
    await expect(paymentBreakdownCard).toContainText("Deposit Non-Cash To");
    await expect(paymentBreakdownCard).toContainText("70.00");
    await expect(dialog).toContainText("180.00");

    const countedCashInput = dialog.getByRole("textbox");
    const diffLabel = dialog.locator("span").filter({ hasText: /^Diff:/ }).last();

    await countedCashInput.type("16000", { delay: 80 });
    await expect(countedCashInput).toHaveValue("16000");
    await expect(diffLabel).toContainText("15,820.00");
    await expect(diffLabel).not.toContainText("179.00");

    await countedCashInput.fill("175");
    await expect(diffLabel).toContainText("-₹5.00");

    await countedCashInput.fill("");
    await countedCashInput.fill("180");
    await expect(diffLabel).toContainText("₹0.00");

    await adminApi.dispose();
    await superadminApi.dispose();
  });
});
