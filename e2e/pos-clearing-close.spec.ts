import { expect, test } from "@playwright/test";
import {
  closePosSession,
  configureRegister,
  createApiContext,
  createBranch,
  createPosProductAndStock,
  createWarehouse,
  getCashBankBalance,
  getCashBankTransactionsForSession,
  getClearingNetForSession,
  getCloseJournalLines,
  getOpenJournalLines,
  getSessionSnapshot,
  getSessionSummary,
  listCashBankAccounts,
  makeRunId,
  openPosSession,
  posCheckout,
  setOrgPosAccountingMode,
} from "./helpers/pos";

test.describe("POS clearing close", () => {
  test.setTimeout(120_000);

  test("settles cash and non-cash payments through clearing account on close", async ({ baseURL }) => {
    const superadminApi = await createApiContext(baseURL!, "superadmin");
    const adminApi = await createApiContext(baseURL!, "admin");
    const runId = makeRunId();

    await setOrgPosAccountingMode(superadminApi, "CLEARING_ACCOUNT");

    const branch = await createBranch(adminApi, `${runId}-mix`);
    const warehouse = await createWarehouse(adminApi, branch.id, `${runId}-mix`);
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
      runId: `${runId}-mix`,
      branchId: branch.id,
      warehouseId: warehouse.id,
      quantity: 20,
      unitCost: 30,
      unitPrice: 60,
    });

    const safeBefore = await getCashBankBalance(cashAccount.id);
    const bankBefore = await getCashBankBalance(bankAccount.id);

    const posSession = await openPosSession(adminApi, {
      branchId: branch.id,
      warehouseId: warehouse.id,
      openingCash: 100,
    });

    const openLines = await getOpenJournalLines(posSession.id);
    expect(openLines.some((line) => line.accountCode === "1150" && Number(line.debit) === 100 && Number(line.credit) === 0)).toBeTruthy();

    await posCheckout(adminApi, {
      sessionId: posSession.id,
      productId: stock.productId,
      quantity: 2,
      unitPrice: stock.unitPrice,
      payments: [
        { method: "CASH", amount: 80 },
        { method: "CREDIT_CARD", amount: 40, reference: `cc-${runId}` },
      ],
    });

    const summary = await getSessionSummary(adminApi, posSession.id);
    expect(summary.paymentBreakdown).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ method: "CASH", total: 80 }),
        expect.objectContaining({ method: "CREDIT_CARD", total: 40 }),
      ]),
    );

    await closePosSession(adminApi, {
      sessionId: posSession.id,
      closingCash: 180,
      settleCashAccountId: cashAccount.id,
      settleBankAccountId: bankAccount.id,
    });

    const session = await getSessionSnapshot(posSession.id);
    expect(session.status).toBe("CLOSED");
    expect(Number(session.openingCash)).toBe(100);
    expect(Number(session.expectedCash)).toBe(180);
    expect(Number(session.closingCash)).toBe(180);
    expect(Number(session.cashDifference)).toBe(0);
    expect(Number(session.totalSales)).toBe(120);
    expect(Number(session.totalTransactions)).toBe(1);

    const closeLines = await getCloseJournalLines(posSession.id);
    expect(
      closeLines.some((line) => line.journalDescription === `POS Session Close - Cash to Store Safe (${posSession.sessionNumber})` && line.accountCode === "1150" && Number(line.credit) === 180),
    ).toBeTruthy();
    expect(
      closeLines.some((line) => line.journalDescription === `POS Session Close - Non-Cash Deposit (${posSession.sessionNumber})` && line.accountCode === "1150" && Number(line.credit) === 40),
    ).toBeTruthy();

    const safeAfter = await getCashBankBalance(cashAccount.id);
    const bankAfter = await getCashBankBalance(bankAccount.id);
    expect(safeAfter - safeBefore).toBe(80);
    expect(bankAfter - bankBefore).toBe(40);

    const clearingNet = await getClearingNetForSession(posSession.id);
    expect(clearingNet).toBe(0);

    const cbTransactions = await getCashBankTransactionsForSession(posSession.id);
    expect(cbTransactions.some((tx) => tx.transactionType === "WITHDRAWAL" && Number(tx.amount) === 100)).toBeTruthy();
    expect(cbTransactions.some((tx) => tx.transactionType === "DEPOSIT" && Number(tx.amount) === 180)).toBeTruthy();
    expect(cbTransactions.some((tx) => tx.transactionType === "DEPOSIT" && Number(tx.amount) === 40)).toBeTruthy();
    await adminApi.dispose();
    await superadminApi.dispose();
  });

  test("posts cash shortage against cash short and over account in clearing mode", async ({ baseURL }) => {
    const superadminApi = await createApiContext(baseURL!, "superadmin");
    const adminApi = await createApiContext(baseURL!, "admin");
    const runId = makeRunId();

    await setOrgPosAccountingMode(superadminApi, "CLEARING_ACCOUNT");

    const branch = await createBranch(adminApi, `${runId}-short`);
    const warehouse = await createWarehouse(adminApi, branch.id, `${runId}-short`);
    const accounts = await listCashBankAccounts(adminApi);
    const cashAccount = accounts.find((account: any) => account.accountSubType === "CASH" && account.branchId === branch.id)
      ?? accounts.find((account: any) => account.accountSubType === "CASH");
    expect(cashAccount).toBeTruthy();

    await configureRegister(adminApi, {
      branchId: branch.id,
      warehouseId: warehouse.id,
      defaultCashAccountId: cashAccount.id,
      defaultBankAccountId: null,
    });

    const stock = await createPosProductAndStock(adminApi, {
      runId: `${runId}-short`,
      branchId: branch.id,
      warehouseId: warehouse.id,
      quantity: 20,
      unitCost: 25,
      unitPrice: 50,
    });

    const safeBefore = await getCashBankBalance(cashAccount.id);
    const posSession = await openPosSession(adminApi, {
      branchId: branch.id,
      warehouseId: warehouse.id,
      openingCash: 100,
    });

    await posCheckout(adminApi, {
      sessionId: posSession.id,
      productId: stock.productId,
      quantity: 1,
      unitPrice: stock.unitPrice,
      payments: [{ method: "CASH", amount: 50 }],
    });

    await closePosSession(adminApi, {
      sessionId: posSession.id,
      closingCash: 140,
      settleCashAccountId: cashAccount.id,
    });

    const session = await getSessionSnapshot(posSession.id);
    expect(session.status).toBe("CLOSED");
    expect(Number(session.expectedCash)).toBe(150);
    expect(Number(session.closingCash)).toBe(140);
    expect(Number(session.cashDifference)).toBe(-10);

    const closeLines = await getCloseJournalLines(posSession.id);
    expect(
      closeLines.some((line) => line.journalDescription === `POS Session Close - Cash to Store Safe (${posSession.sessionNumber})` && line.accountCode === "1150" && Number(line.credit) === 150),
    ).toBeTruthy();
    expect(
      closeLines.some((line) => line.journalDescription === `POS Session Close - Cash to Store Safe (${posSession.sessionNumber})` && String(line.accountName).includes("Cash Short and Over") && Number(line.debit) === 10),
    ).toBeTruthy();

    const safeAfter = await getCashBankBalance(cashAccount.id);
    expect(safeAfter - safeBefore).toBe(40);

    const clearingNet = await getClearingNetForSession(posSession.id);
    expect(clearingNet).toBe(0);

    await adminApi.dispose();
    await superadminApi.dispose();
  });
});
