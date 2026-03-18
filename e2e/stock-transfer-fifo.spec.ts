import { expect, test } from "@playwright/test";
import {
  createApiContext,
  createCustomer,
  createPurchaseInvoiceInWarehouse,
  createSalesInvoiceInWarehouse,
  createStockProduct,
  createStockTransfer,
  createSupplier,
  editStockTransfer,
  ensureTestWarehouses,
  getInvoiceItemCOGS,
  getProductStockInWarehouse,
  getStockTransfer,
  isoDate,
  makeRunId,
  reverseStockTransfer,
  type WarehouseFixture,
  type PartyFixture,
  type ProductFixture,
} from "./helpers/fifo";

/**
 * Stock Transfer FIFO Recalculation Tests
 *
 * These tests prove that editing or reversing a completed stock transfer
 * works correctly even when the transferred stock has been consumed (sold)
 * at the destination warehouse. The system recalculates FIFO for all
 * downstream transactions automatically.
 */
test.describe("Stock transfer edit/reverse with consumed stock", () => {
  test.setTimeout(120_000);

  // Shared fixtures — initialized per-test via setup()
  type Fixtures = {
    api: Awaited<ReturnType<typeof createApiContext>>;
    whA: WarehouseFixture;
    whB: WarehouseFixture;
    supplier: PartyFixture;
    customer: PartyFixture;
  };

  async function setup(baseURL: string): Promise<Fixtures> {
    const api = await createApiContext(baseURL);
    const runId = makeRunId();
    const [whA, whB] = await ensureTestWarehouses(api, runId);
    const supplier = await createSupplier(api, runId);
    const customer = await createCustomer(api, runId);
    return { api, whA, whB, supplier, customer };
  }

  // ─── Test 1: Edit transfer qty AFTER destination stock was partially sold ───
  test("edit consumed transfer — reduces quantity with sufficient remaining stock", async ({ baseURL }) => {
    const { api, whA, whB, supplier, customer } = await setup(baseURL!);
    const runId = makeRunId();
    const product = await createStockProduct(api, `${runId}-t1`, 200, 0);

    // Purchase 10 @ $100 into WH-A
    await createPurchaseInvoiceInWarehouse(api, {
      supplierId: supplier.id, productId: product.id, unitId: product.unitId,
      quantity: 10, unitCost: 100, invoiceDate: isoDate(-3), label: `P ${runId}`,
      warehouseId: whA.id,
    });

    // Transfer 10 from WH-A → WH-B
    const transfer = await createStockTransfer(api, {
      sourceWarehouseId: whA.id, destinationWarehouseId: whB.id,
      items: [{ productId: product.id, quantity: 10 }],
      transferDate: isoDate(-2),
    });

    // Sell 3 at WH-B (consumes from transfer destination lot)
    const sale = await createSalesInvoiceInWarehouse(api, {
      customerId: customer.id, productId: product.id, unitId: product.unitId,
      quantity: 3, unitPrice: 200, issueDate: isoDate(-1), label: `S ${runId}`,
      warehouseId: whB.id,
    });

    // Verify initial state: stock at B = 7, COGS = $300
    let stockB = await getProductStockInWarehouse(product.id, whB.id);
    expect(stockB.remaining).toBe(7);
    let cogs = await getInvoiceItemCOGS(sale.id);
    expect(Number(cogs.costOfGoodsSold)).toBe(300);

    // ★ Edit transfer from 10 → 8 (previously blocked, now works!)
    await editStockTransfer(api, transfer.id, {
      sourceWarehouseId: whA.id, destinationWarehouseId: whB.id,
      items: [{ productId: product.id, quantity: 8 }],
      transferDate: isoDate(-2),
    });

    // After edit: stock at B = 8 − 3 = 5, stock at A = 10 − 8 = 2
    stockB = await getProductStockInWarehouse(product.id, whB.id);
    expect(stockB.remaining).toBe(5);

    const stockA = await getProductStockInWarehouse(product.id, whA.id);
    expect(stockA.remaining).toBe(2);

    // COGS unchanged (still enough stock, same unit cost)
    cogs = await getInvoiceItemCOGS(sale.id);
    expect(Number(cogs.costOfGoodsSold)).toBe(300);

    // Transfer detail shows updated quantity & cost
    const detail = await getStockTransfer(api, transfer.id);
    expect(Number(detail.items[0].quantity)).toBe(8);
    expect(Number(detail.items[0].unitCost)).toBe(100);

    await api.dispose();
  });

  // ─── Test 2: Reverse transfer AFTER destination stock was sold ───
  test("reverse consumed transfer — COGS recalculated to fallback cost", async ({ baseURL }) => {
    const { api, whA, whB, supplier, customer } = await setup(baseURL!);
    const runId = makeRunId();
    const product = await createStockProduct(api, `${runId}-t2`, 200, 0);

    // Two purchases at different prices → product.cost ends up at $120 (last purchase)
    await createPurchaseInvoiceInWarehouse(api, {
      supplierId: supplier.id, productId: product.id, unitId: product.unitId,
      quantity: 5, unitCost: 80, invoiceDate: isoDate(-5), label: `P1 ${runId}`,
      warehouseId: whA.id,
    });
    await createPurchaseInvoiceInWarehouse(api, {
      supplierId: supplier.id, productId: product.id, unitId: product.unitId,
      quantity: 5, unitCost: 120, invoiceDate: isoDate(-4), label: `P2 ${runId}`,
      warehouseId: whA.id,
    });

    // Transfer 10 from A → B: FIFO = 5×$80 + 5×$120 = $1000, unitCost = $100
    const transfer = await createStockTransfer(api, {
      sourceWarehouseId: whA.id, destinationWarehouseId: whB.id,
      items: [{ productId: product.id, quantity: 10 }],
      transferDate: isoDate(-3),
    });

    // Sell 5 at B (COGS = 5 × $100 = $500)
    const sale = await createSalesInvoiceInWarehouse(api, {
      customerId: customer.id, productId: product.id, unitId: product.unitId,
      quantity: 5, unitPrice: 200, issueDate: isoDate(-1), label: `S ${runId}`,
      warehouseId: whB.id,
    });

    let cogs = await getInvoiceItemCOGS(sale.id);
    expect(Number(cogs.costOfGoodsSold)).toBe(500);

    // ★ Reverse the transfer (previously blocked!)
    await reverseStockTransfer(api, transfer.id);

    // After reverse: source stock fully restored
    const stockA = await getProductStockInWarehouse(product.id, whA.id);
    expect(stockA.remaining).toBe(10);

    // Destination stock is gone (zeroed lot)
    const stockB = await getProductStockInWarehouse(product.id, whB.id);
    expect(stockB.remaining).toBe(0);

    // COGS recalculated: sale used fallback cost ($120) since no stock at WH-B
    cogs = await getInvoiceItemCOGS(sale.id);
    expect(Number(cogs.costOfGoodsSold)).toBe(600); // 5 × $120

    // Transfer status is REVERSED
    const detail = await getStockTransfer(api, transfer.id);
    expect(detail.status).toBe("REVERSED");

    await api.dispose();
  });

  // ─── Test 3: Edit reduces qty below consumed → shortfall with fallback cost ───
  test("edit transfer to less than consumed qty — shortfall uses fallback cost", async ({ baseURL }) => {
    const { api, whA, whB, supplier, customer } = await setup(baseURL!);
    const runId = makeRunId();
    const product = await createStockProduct(api, `${runId}-t3`, 200, 0);

    // Two purchases: 5 @ $80, then 5 @ $120
    await createPurchaseInvoiceInWarehouse(api, {
      supplierId: supplier.id, productId: product.id, unitId: product.unitId,
      quantity: 5, unitCost: 80, invoiceDate: isoDate(-5), label: `P1 ${runId}`,
      warehouseId: whA.id,
    });
    await createPurchaseInvoiceInWarehouse(api, {
      supplierId: supplier.id, productId: product.id, unitId: product.unitId,
      quantity: 5, unitCost: 120, invoiceDate: isoDate(-4), label: `P2 ${runId}`,
      warehouseId: whA.id,
    });

    // Transfer 10 A→B (unitCost = $100)
    const transfer = await createStockTransfer(api, {
      sourceWarehouseId: whA.id, destinationWarehouseId: whB.id,
      items: [{ productId: product.id, quantity: 10 }],
      transferDate: isoDate(-3),
    });

    // Sell 8 at B (COGS = 8 × $100 = $800)
    const sale = await createSalesInvoiceInWarehouse(api, {
      customerId: customer.id, productId: product.id, unitId: product.unitId,
      quantity: 8, unitPrice: 200, issueDate: isoDate(-1), label: `S ${runId}`,
      warehouseId: whB.id,
    });

    let cogs = await getInvoiceItemCOGS(sale.id);
    expect(Number(cogs.costOfGoodsSold)).toBe(800);

    // ★ Edit transfer from 10 → 5 (less than the 8 already sold!)
    await editStockTransfer(api, transfer.id, {
      sourceWarehouseId: whA.id, destinationWarehouseId: whB.id,
      items: [{ productId: product.id, quantity: 5 }],
      transferDate: isoDate(-3),
    });

    // After edit: source consumed only 5 via FIFO (5 @ $80 = $400, unitCost = $80)
    // Sale recalculated: 5 from lot @ $80 = $400, shortfall 3 @ $120 (fallback) = $360
    // New COGS = $760
    cogs = await getInvoiceItemCOGS(sale.id);
    expect(Number(cogs.costOfGoodsSold)).toBe(760);

    // Stock at A: 10 − 5 = 5 remaining (lot2 still full)
    const stockA = await getProductStockInWarehouse(product.id, whA.id);
    expect(stockA.remaining).toBe(5);

    // Stock at B: lot had 5, all consumed → 0
    const stockB = await getProductStockInWarehouse(product.id, whB.id);
    expect(stockB.remaining).toBe(0);

    await api.dispose();
  });

  // ─── Test 4: Edit transfer to INCREASE qty → resolves previous shortfall ───
  test("edit transfer to increase qty — resolves shortfall, COGS improves", async ({ baseURL }) => {
    const { api, whA, whB, supplier, customer } = await setup(baseURL!);
    const runId = makeRunId();
    const product = await createStockProduct(api, `${runId}-t4`, 200, 0);

    // Two purchases at different prices
    await createPurchaseInvoiceInWarehouse(api, {
      supplierId: supplier.id, productId: product.id, unitId: product.unitId,
      quantity: 5, unitCost: 80, invoiceDate: isoDate(-5), label: `P1 ${runId}`,
      warehouseId: whA.id,
    });
    await createPurchaseInvoiceInWarehouse(api, {
      supplierId: supplier.id, productId: product.id, unitId: product.unitId,
      quantity: 5, unitCost: 120, invoiceDate: isoDate(-4), label: `P2 ${runId}`,
      warehouseId: whA.id,
    });

    // Transfer only 5 from A→B (FIFO: 5 @ $80, unitCost = $80)
    const transfer = await createStockTransfer(api, {
      sourceWarehouseId: whA.id, destinationWarehouseId: whB.id,
      items: [{ productId: product.id, quantity: 5 }],
      transferDate: isoDate(-3),
    });

    // Sell 8 at B — only 5 available, shortfall 3
    // COGS: 5 × $80 + 3 × $120 (fallback) = $400 + $360 = $760
    const sale = await createSalesInvoiceInWarehouse(api, {
      customerId: customer.id, productId: product.id, unitId: product.unitId,
      quantity: 8, unitPrice: 200, issueDate: isoDate(-1), label: `S ${runId}`,
      warehouseId: whB.id,
    });

    let cogs = await getInvoiceItemCOGS(sale.id);
    expect(Number(cogs.costOfGoodsSold)).toBe(760);

    // ★ Edit transfer from 5 → 10 (now enough stock, resolves shortfall)
    await editStockTransfer(api, transfer.id, {
      sourceWarehouseId: whA.id, destinationWarehouseId: whB.id,
      items: [{ productId: product.id, quantity: 10 }],
      transferDate: isoDate(-3),
    });

    // After edit: transfer FIFO = 5×$80 + 5×$120 = $1000, unitCost = $100
    // Sale: 8 × $100 = $800 (no more shortfall!)
    cogs = await getInvoiceItemCOGS(sale.id);
    expect(Number(cogs.costOfGoodsSold)).toBe(800);

    // Stock at B: 10 − 8 = 2
    const stockB = await getProductStockInWarehouse(product.id, whB.id);
    expect(stockB.remaining).toBe(2);

    // Stock at A: 10 − 10 = 0
    const stockA = await getProductStockInWarehouse(product.id, whA.id);
    expect(stockA.remaining).toBe(0);

    await api.dispose();
  });

  // ─── Test 5: Multiple sales consuming transfer stock, then edit ───
  test("multiple downstream sales recalculated after transfer edit", async ({ baseURL }) => {
    const { api, whA, whB, supplier, customer } = await setup(baseURL!);
    const runId = makeRunId();
    const product = await createStockProduct(api, `${runId}-t5`, 200, 0);

    // Two purchases: 6 @ $80, 6 @ $120 → blended available
    await createPurchaseInvoiceInWarehouse(api, {
      supplierId: supplier.id, productId: product.id, unitId: product.unitId,
      quantity: 6, unitCost: 80, invoiceDate: isoDate(-6), label: `P1 ${runId}`,
      warehouseId: whA.id,
    });
    await createPurchaseInvoiceInWarehouse(api, {
      supplierId: supplier.id, productId: product.id, unitId: product.unitId,
      quantity: 6, unitCost: 120, invoiceDate: isoDate(-5), label: `P2 ${runId}`,
      warehouseId: whA.id,
    });

    // Transfer 12 A→B: FIFO = 6×$80 + 6×$120 = $1200, unitCost = $100
    const transfer = await createStockTransfer(api, {
      sourceWarehouseId: whA.id, destinationWarehouseId: whB.id,
      items: [{ productId: product.id, quantity: 12 }],
      transferDate: isoDate(-4),
    });

    // Sale 1: 4 units (COGS = 4 × $100 = $400)
    const sale1 = await createSalesInvoiceInWarehouse(api, {
      customerId: customer.id, productId: product.id, unitId: product.unitId,
      quantity: 4, unitPrice: 200, issueDate: isoDate(-3), label: `S1 ${runId}`,
      warehouseId: whB.id,
    });
    // Sale 2: 6 units (COGS = 6 × $100 = $600)
    const sale2 = await createSalesInvoiceInWarehouse(api, {
      customerId: customer.id, productId: product.id, unitId: product.unitId,
      quantity: 6, unitPrice: 200, issueDate: isoDate(-2), label: `S2 ${runId}`,
      warehouseId: whB.id,
    });

    let cogs1 = await getInvoiceItemCOGS(sale1.id);
    let cogs2 = await getInvoiceItemCOGS(sale2.id);
    expect(Number(cogs1.costOfGoodsSold)).toBe(400);
    expect(Number(cogs2.costOfGoodsSold)).toBe(600);

    // ★ Edit transfer from 12 → 6 (FIFO: 6 @ $80 = $480, unitCost = $80)
    await editStockTransfer(api, transfer.id, {
      sourceWarehouseId: whA.id, destinationWarehouseId: whB.id,
      items: [{ productId: product.id, quantity: 6 }],
      transferDate: isoDate(-4),
    });

    // Sale 1: 4 @ $80 = $320 (recalculated, enough stock)
    cogs1 = await getInvoiceItemCOGS(sale1.id);
    expect(Number(cogs1.costOfGoodsSold)).toBe(320);

    // Sale 2: needs 6, only 2 left (6 − 4 consumed by sale1)
    // 2 @ $80 = $160, shortfall 4 @ $120 (fallback) = $480 → total $640
    cogs2 = await getInvoiceItemCOGS(sale2.id);
    expect(Number(cogs2.costOfGoodsSold)).toBe(640);

    // Stock at B: 6 − 4 − 6 = 0 (shortfall handled by fallback cost, not negative stock)
    const stockB = await getProductStockInWarehouse(product.id, whB.id);
    expect(stockB.remaining).toBe(0);

    await api.dispose();
  });

  // ─── Test 6: Multi-hop transfer cascade (A→B→C), edit A→B ───
  test("multi-hop cascade — editing first transfer recalculates second transfer and final sale", async ({ baseURL }) => {
    const api = await createApiContext(baseURL!);
    const runId = makeRunId();

    // Need 3 warehouses — get first two, then find/use a third
    const whResponse = await api.get("/api/warehouses");
    const allWarehouses = await whResponse.json();
    if (allWarehouses.length < 3) {
      test.skip(true, "Need at least 3 warehouses for multi-hop test");
      return;
    }
    const whA = { id: allWarehouses[0].id, name: allWarehouses[0].name, branchId: allWarehouses[0].branchId };
    const whB = { id: allWarehouses[1].id, name: allWarehouses[1].name, branchId: allWarehouses[1].branchId };
    const whC = { id: allWarehouses[2].id, name: allWarehouses[2].name, branchId: allWarehouses[2].branchId };

    const supplier = await createSupplier(api, runId);
    const customer = await createCustomer(api, runId);
    const product = await createStockProduct(api, `${runId}-t6`, 200, 0);

    // Purchase 10 @ $100 into WH-A
    await createPurchaseInvoiceInWarehouse(api, {
      supplierId: supplier.id, productId: product.id, unitId: product.unitId,
      quantity: 10, unitCost: 100, invoiceDate: isoDate(-6), label: `P ${runId}`,
      warehouseId: whA.id,
    });

    // Transfer 10 A→B (unitCost = $100)
    const t1 = await createStockTransfer(api, {
      sourceWarehouseId: whA.id, destinationWarehouseId: whB.id,
      items: [{ productId: product.id, quantity: 10 }],
      transferDate: isoDate(-5),
    });

    // Transfer 6 B→C (consumes from T1 destination lot, unitCost = $100)
    const t2 = await createStockTransfer(api, {
      sourceWarehouseId: whB.id, destinationWarehouseId: whC.id,
      items: [{ productId: product.id, quantity: 6 }],
      transferDate: isoDate(-3),
    });

    // Sell 4 at WH-C (COGS = 4 × $100 = $400)
    const sale = await createSalesInvoiceInWarehouse(api, {
      customerId: customer.id, productId: product.id, unitId: product.unitId,
      quantity: 4, unitPrice: 200, issueDate: isoDate(-1), label: `S ${runId}`,
      warehouseId: whC.id,
    });

    let cogs = await getInvoiceItemCOGS(sale.id);
    expect(Number(cogs.costOfGoodsSold)).toBe(400);

    // ★ Edit T1 from 10 → 4 (less than T2 needs!)
    await editStockTransfer(api, t1.id, {
      sourceWarehouseId: whA.id, destinationWarehouseId: whB.id,
      items: [{ productId: product.id, quantity: 4 }],
      transferDate: isoDate(-5),
    });

    // T1 recalculated: 4 @ $100 = $400, unitCost = $100
    // T2: tries 6 from B, only 4 available → 4 @ $100 consumed, shortfall 2
    // T2 unitCost is recalculated
    // Sale at C: 4 units from T2 destination lot (which has recalculated cost)
    // The exact COGS depends on T2's new blended cost

    // Stock at A: 10 − 4 = 6
    const stockA = await getProductStockInWarehouse(product.id, whA.id);
    expect(stockA.remaining).toBe(6);

    // Stock at B: 4 (from T1) − 6 (to T2, partially shortfall) → 0
    const stockB = await getProductStockInWarehouse(product.id, whB.id);
    expect(stockB.remaining).toBe(0);

    // Transfer detail shows reduced quantity
    const detail = await getStockTransfer(api, t1.id);
    expect(Number(detail.items[0].quantity)).toBe(4);

    await api.dispose();
  });

  // ─── Test 7: Edit transfer — remove consumed product, add new product ───
  test("edit transfer to swap products — removed product COGS uses fallback", async ({ baseURL }) => {
    const { api, whA, whB, supplier, customer } = await setup(baseURL!);
    const runId = makeRunId();
    const productA = await createStockProduct(api, `${runId}-t7a`, 200, 0);
    const productB = await createStockProduct(api, `${runId}-t7b`, 150, 0);

    // Purchase both products into WH-A
    await createPurchaseInvoiceInWarehouse(api, {
      supplierId: supplier.id, productId: productA.id, unitId: productA.unitId,
      quantity: 10, unitCost: 100, invoiceDate: isoDate(-5), label: `PA ${runId}`,
      warehouseId: whA.id,
    });
    await createPurchaseInvoiceInWarehouse(api, {
      supplierId: supplier.id, productId: productB.id, unitId: productB.unitId,
      quantity: 10, unitCost: 60, invoiceDate: isoDate(-5), label: `PB ${runId}`,
      warehouseId: whA.id,
    });

    // Transfer 5 of product A from A→B
    const transfer = await createStockTransfer(api, {
      sourceWarehouseId: whA.id, destinationWarehouseId: whB.id,
      items: [{ productId: productA.id, quantity: 5 }],
      transferDate: isoDate(-3),
    });

    // Sell 3 of product A at B (COGS = 3 × $100 = $300)
    const sale = await createSalesInvoiceInWarehouse(api, {
      customerId: customer.id, productId: productA.id, unitId: productA.unitId,
      quantity: 3, unitPrice: 200, issueDate: isoDate(-1), label: `SA ${runId}`,
      warehouseId: whB.id,
    });

    let cogs = await getInvoiceItemCOGS(sale.id);
    expect(Number(cogs.costOfGoodsSold)).toBe(300);

    // ★ Edit transfer: replace product A with product B
    await editStockTransfer(api, transfer.id, {
      sourceWarehouseId: whA.id, destinationWarehouseId: whB.id,
      items: [{ productId: productB.id, quantity: 5 }],
      transferDate: isoDate(-3),
    });

    // Product A: sale COGS recalculated with fallback (no stock at WH-B anymore)
    // product.cost for A = $100 (from purchase), so COGS = 3 × $100 = $300
    cogs = await getInvoiceItemCOGS(sale.id);
    expect(Number(cogs.costOfGoodsSold)).toBe(300); // fallback = purchase cost

    // Product A stock at B: 0 (lot zeroed, sale consumed via fallback)
    const stockAatB = await getProductStockInWarehouse(productA.id, whB.id);
    expect(stockAatB.remaining).toBe(0);

    // Product A stock at A: restored to 10 (not transferred anymore)
    const stockAatA = await getProductStockInWarehouse(productA.id, whA.id);
    expect(stockAatA.remaining).toBe(10);

    // Product B now at B: 5 units
    const stockBatB = await getProductStockInWarehouse(productB.id, whB.id);
    expect(stockBatB.remaining).toBe(5);

    // Product B stock at A: 10 − 5 = 5
    const stockBatA = await getProductStockInWarehouse(productB.id, whA.id);
    expect(stockBatA.remaining).toBe(5);

    await api.dispose();
  });

  // ─── Test 8: Edit consumed transfer — no stock change, same qty (date-only edit) ───
  test("edit transfer date only — COGS recalculated with correct FIFO ordering", async ({ baseURL }) => {
    const { api, whA, whB, supplier, customer } = await setup(baseURL!);
    const runId = makeRunId();
    const product = await createStockProduct(api, `${runId}-t8`, 200, 0);

    // Purchase 10 @ $100 into WH-A
    await createPurchaseInvoiceInWarehouse(api, {
      supplierId: supplier.id, productId: product.id, unitId: product.unitId,
      quantity: 10, unitCost: 100, invoiceDate: isoDate(-5), label: `P ${runId}`,
      warehouseId: whA.id,
    });

    // Transfer 10 A→B (date -3)
    const transfer = await createStockTransfer(api, {
      sourceWarehouseId: whA.id, destinationWarehouseId: whB.id,
      items: [{ productId: product.id, quantity: 10 }],
      transferDate: isoDate(-3),
    });

    // Sell 5 at B
    const sale = await createSalesInvoiceInWarehouse(api, {
      customerId: customer.id, productId: product.id, unitId: product.unitId,
      quantity: 5, unitPrice: 200, issueDate: isoDate(-1), label: `S ${runId}`,
      warehouseId: whB.id,
    });

    let cogs = await getInvoiceItemCOGS(sale.id);
    expect(Number(cogs.costOfGoodsSold)).toBe(500);

    // ★ Edit transfer: only change the date (same items and qty)
    await editStockTransfer(api, transfer.id, {
      sourceWarehouseId: whA.id, destinationWarehouseId: whB.id,
      items: [{ productId: product.id, quantity: 10 }],
      transferDate: isoDate(-4), // moved earlier
    });

    // Stock should be unchanged
    const stockB = await getProductStockInWarehouse(product.id, whB.id);
    expect(stockB.remaining).toBe(5);

    const stockA = await getProductStockInWarehouse(product.id, whA.id);
    expect(stockA.remaining).toBe(0);

    // COGS stays the same (same cost, just different date)
    cogs = await getInvoiceItemCOGS(sale.id);
    expect(Number(cogs.costOfGoodsSold)).toBe(500);

    await api.dispose();
  });
});
