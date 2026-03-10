import { expect, test } from "@playwright/test";
import {
  createApiContext,
  createCustomer,
  createPurchaseInvoice,
  createSalesInvoice,
  createStockProduct,
  createSupplier,
  expectInvoiceVisible,
  getInvoiceItemCOGS,
  getProductStock,
  isoDate,
  makeRunId,
} from "./helpers/fifo";

test.describe("FIFO workflow", () => {
  test.setTimeout(90_000);

  test("consumes multiple purchase lots in FIFO order and updates reports", async ({ page, baseURL }) => {
    const api = await createApiContext(baseURL!);
    const runId = makeRunId();

    const supplier = await createSupplier(api, `${runId}-multi`);
    const customer = await createCustomer(api, `${runId}-multi`);
    const product = await createStockProduct(api, `${runId}-multi`);

    const firstPurchase = await createPurchaseInvoice(api, {
      supplierId: supplier.id,
      productId: product.id,
      unitId: product.unitId,
      quantity: 10,
      unitCost: 100,
      invoiceDate: isoDate(-2),
      label: `P1 ${runId}`,
    });

    const secondPurchase = await createPurchaseInvoice(api, {
      supplierId: supplier.id,
      productId: product.id,
      unitId: product.unitId,
      quantity: 5,
      unitCost: 120,
      invoiceDate: isoDate(-1),
      label: `P2 ${runId}`,
    });

    const sale = await createSalesInvoice(api, {
      customerId: customer.id,
      productId: product.id,
      unitId: product.unitId,
      quantity: 12,
      unitPrice: 160,
      issueDate: isoDate(0),
      label: `S1 ${runId}`,
    });

    const saleItem = await getInvoiceItemCOGS(sale.id);
    expect(Number(saleItem.costOfGoodsSold)).toBe(1240);
    expect(saleItem.stockLotConsumptions).toHaveLength(2);
    expect(Number(saleItem.stockLotConsumptions[0].quantityConsumed)).toBe(10);
    expect(Number(saleItem.stockLotConsumptions[1].quantityConsumed)).toBe(2);

    const stock = await getProductStock(product.id);
    expect(stock.remaining).toBe(3);
    expect(Number(stock.lots[0].remainingQuantity)).toBe(0);
    expect(Number(stock.lots[1].remainingQuantity)).toBe(3);

    const reportResponse = await api.get(`/api/reports/profit-by-items?productId=${product.id}`);
    expect(reportResponse.ok()).toBeTruthy();
    const report = await reportResponse.json();
    expect(report.summary.totalCOGS).toBe(1240);
    expect(report.summary.totalRevenue).toBe(1920);
    expect(report.summary.totalProfit).toBe(680);

    await expectInvoiceVisible(page, `/purchase-invoices/${firstPurchase.id}`, firstPurchase.purchaseInvoiceNumber);
    await expectInvoiceVisible(page, `/purchase-invoices/${secondPurchase.id}`, secondPurchase.purchaseInvoiceNumber);
    await expectInvoiceVisible(page, `/invoices/${sale.id}`, sale.invoiceNumber);

    await page.goto("/reports/profit-by-items", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(sale.invoiceNumber)).toBeVisible();
    await api.dispose();
  });

  test("recalculates zero-COGS sale after a backdated purchase arrives", async ({ page, baseURL }) => {
    const api = await createApiContext(baseURL!);
    const runId = makeRunId();

    const supplier = await createSupplier(api, `${runId}-backdated`);
    const customer = await createCustomer(api, `${runId}-backdated`);
    const product = await createStockProduct(api, `${runId}-backdated`, 220, 0);

    const sale = await createSalesInvoice(api, {
      customerId: customer.id,
      productId: product.id,
      unitId: product.unitId,
      quantity: 2,
      unitPrice: 220,
      issueDate: isoDate(0),
      label: `Backdated sale ${runId}`,
    });

    let saleItem = await getInvoiceItemCOGS(sale.id);
    expect(Number(saleItem.costOfGoodsSold)).toBe(0);

    const purchase = await createPurchaseInvoice(api, {
      supplierId: supplier.id,
      productId: product.id,
      unitId: product.unitId,
      quantity: 5,
      unitCost: 90,
      invoiceDate: isoDate(-1),
      label: `Backdated purchase ${runId}`,
    });

    saleItem = await getInvoiceItemCOGS(sale.id);
    expect(Number(saleItem.costOfGoodsSold)).toBe(180);
    expect(saleItem.stockLotConsumptions).toHaveLength(1);
    expect(Number(saleItem.stockLotConsumptions[0].quantityConsumed)).toBe(2);

    const stock = await getProductStock(product.id);
    expect(stock.remaining).toBe(3);

    await expectInvoiceVisible(page, `/purchase-invoices/${purchase.id}`, purchase.purchaseInvoiceNumber);
    await expectInvoiceVisible(page, `/invoices/${sale.id}`, sale.invoiceNumber);
    await api.dispose();
  });
});
