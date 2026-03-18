import "dotenv/config";
import { expect, request as playwrightRequest, type APIRequestContext, type Page } from "@playwright/test";
import pg from "pg";

export const authStatePath = "e2e/.auth/admin.json";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

type JsonValue = Record<string, any>;

export type ProductFixture = {
  id: string;
  name: string;
  unitId: string;
};

export type PartyFixture = {
  id: string;
  name: string;
};

export type PurchaseInvoiceFixture = {
  id: string;
  purchaseInvoiceNumber: string;
};

export type SalesInvoiceFixture = {
  id: string;
  invoiceNumber: string;
};

async function parseJson(response: Awaited<ReturnType<APIRequestContext["get"]>>) {
  const body = await response.text();
  const parsed = body ? JSON.parse(body) : null;
  if (!response.ok()) {
    throw new Error(`${response.url()} failed: ${response.status()} ${body}`);
  }
  return parsed;
}

export async function createApiContext(baseURL: string) {
  return playwrightRequest.newContext({
    baseURL,
    storageState: authStatePath,
  });
}

export function makeRunId() {
  return `fifo-${Date.now()}`;
}

export function isoDate(offsetDays = 0) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + offsetDays);
  return date.toISOString().slice(0, 10);
}

export async function createCustomer(api: APIRequestContext, runId: string): Promise<PartyFixture> {
  const response = await api.post("/api/customers", {
    data: {
      name: `FIFO Customer ${runId}`,
      email: `${runId}-customer@example.com`,
      phone: "+966500000001",
    },
  });
  const customer = await parseJson(response);
  return { id: customer.id, name: customer.name };
}

export async function createSupplier(api: APIRequestContext, runId: string): Promise<PartyFixture> {
  const response = await api.post("/api/suppliers", {
    data: {
      name: `FIFO Supplier ${runId}`,
      email: `${runId}-supplier@example.com`,
      phone: "+966500000002",
    },
  });
  const supplier = await parseJson(response);
  return { id: supplier.id, name: supplier.name };
}

export async function createStockProduct(api: APIRequestContext, runId: string, price = 160, cost = 0): Promise<ProductFixture> {
  const unitsResponse = await api.get("/api/units");
  const units = await parseJson(unitsResponse);
  const pcsUnit = units.find((unit: JsonValue) => unit.code === "pcs") ?? units[0];
  if (!pcsUnit?.id) {
    throw new Error("No unit available for test product creation");
  }

  const productResponse = await api.post("/api/products", {
    data: {
      name: `FIFO Product ${runId}`,
      description: `Headless FIFO test product ${runId}`,
      price,
      cost,
      unitId: pcsUnit.id,
      sku: `FIFO-${runId}`,
      gstRate: 0,
      isService: false,
    },
  });

  const product = await parseJson(productResponse);
  return { id: product.id, name: product.name, unitId: product.unitId };
}

export async function createPurchaseInvoice(
  api: APIRequestContext,
  input: {
    supplierId: string;
    productId: string;
    unitId: string;
    quantity: number;
    unitCost: number;
    invoiceDate: string;
    label: string;
  },
): Promise<PurchaseInvoiceFixture> {
  const response = await api.post("/api/purchase-invoices", {
    data: {
      supplierId: input.supplierId,
      invoiceDate: input.invoiceDate,
      dueDate: input.invoiceDate,
      supplierInvoiceRef: input.label,
      items: [
        {
          productId: input.productId,
          description: input.label,
          quantity: input.quantity,
          unitCost: input.unitCost,
          unitId: input.unitId,
          gstRate: 0,
          discount: 0,
        },
      ],
    },
  });

  const invoice = await parseJson(response);
  return {
    id: invoice.id,
    purchaseInvoiceNumber: invoice.purchaseInvoiceNumber,
  };
}

export async function createSalesInvoice(
  api: APIRequestContext,
  input: {
    customerId: string;
    productId: string;
    unitId: string;
    quantity: number;
    unitPrice: number;
    issueDate: string;
    label: string;
  },
): Promise<SalesInvoiceFixture> {
  const response = await api.post("/api/invoices", {
    data: {
      customerId: input.customerId,
      issueDate: input.issueDate,
      dueDate: input.issueDate,
      paymentType: "CASH",
      items: [
        {
          productId: input.productId,
          description: input.label,
          quantity: input.quantity,
          unitPrice: input.unitPrice,
          unitId: input.unitId,
          gstRate: 0,
          discount: 0,
        },
      ],
    },
  });

  const invoice = await parseJson(response);
  const createdInvoice = invoice.invoice ?? invoice;
  return {
    id: createdInvoice.id,
    invoiceNumber: createdInvoice.invoiceNumber,
  };
}

export async function expectInvoiceVisible(page: Page, path: string, invoiceNumber: string) {
  await page.goto(path, { waitUntil: "domcontentloaded" });
  await expect(page.getByText(invoiceNumber, { exact: true }).first()).toBeVisible();
}

export async function getInvoiceItemCOGS(invoiceId: string) {
  const invoiceItemResult = await pool.query(
    `select id, "costOfGoodsSold"
     from invoice_items
     where "invoiceId" = $1
     order by "createdAt" asc
     limit 1`,
    [invoiceId],
  );
  if (!invoiceItemResult.rows.length) {
    throw new Error(`Invoice ${invoiceId} has no items`);
  }

  const invoiceItem = invoiceItemResult.rows[0];
  const consumptionsResult = await pool.query(
    `select "quantityConsumed", "unitCost", "totalCost"
     from stock_lot_consumptions
     where "invoiceItemId" = $1
     order by "createdAt" asc`,
    [invoiceItem.id],
  );

  return {
    ...invoiceItem,
    stockLotConsumptions: consumptionsResult.rows,
  };
}

export async function getProductStock(productId: string) {
  const lotsResult = await pool.query(
    `select id, "lotDate", "remainingQuantity"
     from stock_lots
     where "productId" = $1
     order by "lotDate" asc, "createdAt" asc`,
    [productId],
  );
  const lots = lotsResult.rows;
  const remaining = lots.reduce((sum, lot) => sum + Number(lot.remainingQuantity), 0);
  return { lots, remaining };
}

// ──────────────────────────────────────────────────────────────────
// Multi-warehouse / stock transfer helpers
// ──────────────────────────────────────────────────────────────────

export type WarehouseFixture = { id: string; name: string; branchId: string };
export type StockTransferFixture = { id: string; transferNumber: string };

/** Return at least 2 existing warehouses or create branches + warehouses */
export async function ensureTestWarehouses(api: APIRequestContext, runId: string): Promise<[WarehouseFixture, WarehouseFixture]> {
  const response = await api.get("/api/warehouses");
  const warehouses = await parseJson(response);

  if (warehouses.length >= 2) {
    return [
      { id: warehouses[0].id, name: warehouses[0].name, branchId: warehouses[0].branchId },
      { id: warehouses[1].id, name: warehouses[1].name, branchId: warehouses[1].branchId },
    ];
  }

  // Need to create — ensure at least 2 branches exist first
  const branchRes = await api.get("/api/branches");
  const branches = await parseJson(branchRes);
  let branchIds: string[] = branches.map((b: any) => b.id);

  const suffix = runId.slice(-6);
  while (branchIds.length < 2) {
    const idx = branchIds.length + 1;
    const res = await api.post("/api/branches", {
      data: { name: `Test Branch ${idx} ${suffix}`, code: `TB${idx}${suffix}` },
    });
    const branch = await parseJson(res);
    branchIds.push(branch.id);
  }

  // Create warehouses under first two branches
  const created: WarehouseFixture[] = [];
  for (let i = 0; i < 2; i++) {
    const existing = warehouses.find((w: any) => w.branchId === branchIds[i]);
    if (existing) {
      created.push({ id: existing.id, name: existing.name, branchId: existing.branchId });
    } else {
      const idx = i + 1;
      const res = await api.post("/api/warehouses", {
        data: { name: `Test WH ${idx} ${suffix}`, code: `TW${idx}${suffix}`, branchId: branchIds[i] },
      });
      const wh = await parseJson(res);
      created.push({ id: wh.id, name: wh.name, branchId: branchIds[i] });
    }
  }

  return [created[0], created[1]];
}

/** Create a purchase invoice targeting a specific warehouse */
export async function createPurchaseInvoiceInWarehouse(
  api: APIRequestContext,
  input: {
    supplierId: string;
    productId: string;
    unitId: string;
    quantity: number;
    unitCost: number;
    invoiceDate: string;
    label: string;
    warehouseId: string;
  },
): Promise<PurchaseInvoiceFixture> {
  const response = await api.post("/api/purchase-invoices", {
    data: {
      supplierId: input.supplierId,
      invoiceDate: input.invoiceDate,
      dueDate: input.invoiceDate,
      supplierInvoiceRef: input.label,
      warehouseId: input.warehouseId,
      items: [
        {
          productId: input.productId,
          description: input.label,
          quantity: input.quantity,
          unitCost: input.unitCost,
          unitId: input.unitId,
          gstRate: 0,
          discount: 0,
        },
      ],
    },
  });
  const invoice = await parseJson(response);
  return { id: invoice.id, purchaseInvoiceNumber: invoice.purchaseInvoiceNumber };
}

/** Create a sales invoice targeting a specific warehouse */
export async function createSalesInvoiceInWarehouse(
  api: APIRequestContext,
  input: {
    customerId: string;
    productId: string;
    unitId: string;
    quantity: number;
    unitPrice: number;
    issueDate: string;
    label: string;
    warehouseId: string;
  },
): Promise<SalesInvoiceFixture> {
  const response = await api.post("/api/invoices", {
    data: {
      customerId: input.customerId,
      issueDate: input.issueDate,
      dueDate: input.issueDate,
      paymentType: "CASH",
      warehouseId: input.warehouseId,
      items: [
        {
          productId: input.productId,
          description: input.label,
          quantity: input.quantity,
          unitPrice: input.unitPrice,
          unitId: input.unitId,
          gstRate: 0,
          discount: 0,
        },
      ],
    },
  });
  const invoice = await parseJson(response);
  const created = invoice.invoice ?? invoice;
  return { id: created.id, invoiceNumber: created.invoiceNumber };
}

/** Create a stock transfer (immediately COMPLETED) */
export async function createStockTransfer(
  api: APIRequestContext,
  input: {
    sourceWarehouseId: string;
    destinationWarehouseId: string;
    items: Array<{ productId: string; quantity: number }>;
    transferDate?: string;
  },
): Promise<StockTransferFixture> {
  const response = await api.post("/api/stock-transfers", {
    data: {
      sourceWarehouseId: input.sourceWarehouseId,
      destinationWarehouseId: input.destinationWarehouseId,
      transferDate: input.transferDate ?? isoDate(0),
      items: input.items,
    },
  });
  const transfer = await parseJson(response);
  return { id: transfer.id, transferNumber: transfer.transferNumber };
}

/** Edit a stock transfer (PUT) */
export async function editStockTransfer(
  api: APIRequestContext,
  transferId: string,
  input: {
    sourceWarehouseId: string;
    destinationWarehouseId: string;
    items: Array<{ productId: string; quantity: number }>;
    transferDate?: string;
  },
): Promise<void> {
  const response = await api.put(`/api/stock-transfers/${transferId}`, {
    data: {
      sourceWarehouseId: input.sourceWarehouseId,
      destinationWarehouseId: input.destinationWarehouseId,
      transferDate: input.transferDate,
      items: input.items,
    },
  });
  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`Edit stock transfer failed: ${response.status()} ${body}`);
  }
}

/** Reverse a stock transfer (PATCH action=reverse) */
export async function reverseStockTransfer(api: APIRequestContext, transferId: string): Promise<void> {
  const response = await api.patch(`/api/stock-transfers/${transferId}`, {
    data: { action: "reverse" },
  });
  if (!response.ok()) {
    const body = await response.text();
    throw new Error(`Reverse stock transfer failed: ${response.status()} ${body}`);
  }
}

/** Get stock lots for a product in a specific warehouse (only lots with remaining > 0) */
export async function getProductStockInWarehouse(productId: string, warehouseId: string) {
  const result = await pool.query(
    `SELECT id, "lotDate", "unitCost", "initialQuantity", "remainingQuantity", "sourceType"
     FROM stock_lots
     WHERE "productId" = $1 AND "warehouseId" = $2 AND "remainingQuantity" > 0
     ORDER BY "lotDate" ASC, "createdAt" ASC`,
    [productId, warehouseId],
  );
  const lots = result.rows;
  const remaining = lots.reduce((sum: number, lot: any) => sum + Number(lot.remainingQuantity), 0);
  return { lots, remaining };
}

/** Get the stock transfer detail from API */
export async function getStockTransfer(api: APIRequestContext, transferId: string) {
  const response = await api.get(`/api/stock-transfers/${transferId}`);
  return parseJson(response);
}
