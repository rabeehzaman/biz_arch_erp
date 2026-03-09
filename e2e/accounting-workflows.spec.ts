import { expect, test, type APIRequestContext, type APIResponse } from "@playwright/test";
import {
  createApiContext,
  createCustomer,
  createPurchaseInvoice,
  createSalesInvoice,
  createStockProduct,
  createSupplier,
  expectInvoiceVisible,
  getProductStock,
  isoDate,
  makeRunId,
} from "./helpers/fifo";

type JsonRecord = Record<string, any>;

async function parseJson(response: APIResponse) {
  const body = await response.text();
  const parsed = body ? JSON.parse(body) : null;
  if (!response.ok()) {
    throw new Error(`${response.url()} failed: ${response.status()} ${body}`);
  }
  return parsed;
}

async function parseJsonAllowError(response: APIResponse) {
  const body = await response.text();
  return body ? JSON.parse(body) : null;
}

async function getCompactCustomerBalance(api: APIRequestContext, customerId: string) {
  const customers = await parseJson(await api.get("/api/customers?compact=true"));
  const customer = customers.find((entry: JsonRecord) => entry.id === customerId);
  if (!customer) {
    throw new Error(`Customer ${customerId} not found`);
  }
  return Number(customer.balance);
}

async function getCompactSupplierBalance(api: APIRequestContext, supplierId: string) {
  const suppliers = await parseJson(await api.get("/api/suppliers?compact=true"));
  const supplier = suppliers.find((entry: JsonRecord) => entry.id === supplierId);
  if (!supplier) {
    throw new Error(`Supplier ${supplierId} not found`);
  }
  return Number(supplier.balance);
}

async function getInvoice(api: APIRequestContext, invoiceId: string) {
  return parseJson(await api.get(`/api/invoices/${invoiceId}`));
}

async function getPurchaseInvoice(api: APIRequestContext, purchaseInvoiceId: string) {
  return parseJson(await api.get(`/api/purchase-invoices/${purchaseInvoiceId}`));
}

async function createCreditNote(
  api: APIRequestContext,
  input: {
    customerId: string;
    invoiceId: string;
    invoiceItemId: string;
    productId: string;
    unitId: string;
    quantity: number;
    unitPrice: number;
    issueDate: string;
    label: string;
  },
) {
  return parseJson(await api.post("/api/credit-notes", {
    data: {
      customerId: input.customerId,
      invoiceId: input.invoiceId,
      issueDate: input.issueDate,
      reason: input.label,
      notes: input.label,
      appliedToBalance: true,
      items: [
        {
          invoiceItemId: input.invoiceItemId,
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
  }));
}

async function createDebitNote(
  api: APIRequestContext,
  input: {
    supplierId: string;
    purchaseInvoiceId: string;
    purchaseInvoiceItemId: string;
    productId: string;
    unitId: string;
    quantity: number;
    unitCost: number;
    issueDate: string;
    label: string;
  },
) {
  return parseJson(await api.post("/api/debit-notes", {
    data: {
      supplierId: input.supplierId,
      purchaseInvoiceId: input.purchaseInvoiceId,
      issueDate: input.issueDate,
      reason: input.label,
      notes: input.label,
      appliedToBalance: true,
      items: [
        {
          purchaseInvoiceItemId: input.purchaseInvoiceItemId,
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
  }));
}

async function createQuotation(
  api: APIRequestContext,
  input: {
    customerId: string;
    productId: string;
    unitId: string;
    quantity: number;
    unitPrice: number;
    issueDate: string;
    validUntil: string;
    label: string;
  },
) {
  return parseJson(await api.post("/api/quotations", {
    data: {
      customerId: input.customerId,
      issueDate: input.issueDate,
      validUntil: input.validUntil,
      notes: input.label,
      terms: "E2E quotation validation",
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
  }));
}

async function listAccounts(api: APIRequestContext) {
  return parseJson(await api.get("/api/accounts"));
}

function getAccountIdByCode(accounts: JsonRecord[], code: string) {
  const account = accounts.find((entry) => entry.code === code);
  if (!account) {
    throw new Error(`Account code ${code} not found`);
  }
  return account.id as string;
}

test.describe("Accounting workflows", () => {
  test.setTimeout(120_000);

  test("sales invoice and credit note deletion clear customer balances", async ({ page, baseURL }) => {
    const api = await createApiContext(baseURL!);
    const runId = makeRunId();

    const supplier = await createSupplier(api, `${runId}-sales-stock`);
    const customer = await createCustomer(api, `${runId}-sales-customer`);
    const product = await createStockProduct(api, `${runId}-sales-product`, 175, 90);

    await createPurchaseInvoice(api, {
      supplierId: supplier.id,
      productId: product.id,
      unitId: product.unitId,
      quantity: 10,
      unitCost: 90,
      invoiceDate: isoDate(-1),
      label: `Sales stock ${runId}`,
    });

    const salesInvoice = await createSalesInvoice(api, {
      customerId: customer.id,
      productId: product.id,
      unitId: product.unitId,
      quantity: 4,
      unitPrice: 175,
      issueDate: isoDate(0),
      label: `Sales invoice ${runId}`,
    });

    const invoiceDetail = await getInvoice(api, salesInvoice.id);
    const invoiceItem = invoiceDetail.items[0];
    const invoiceTotal = Number(invoiceDetail.total);

    expect(Number(invoiceDetail.balanceDue)).toBe(invoiceTotal);
    expect(await getCompactCustomerBalance(api, customer.id)).toBe(invoiceTotal);
    expect((await getProductStock(product.id)).remaining).toBe(6);

    await expectInvoiceVisible(page, `/invoices/${salesInvoice.id}`, salesInvoice.invoiceNumber);
    await page.goto("/reports/customer-balances", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(customer.name, { exact: true })).toBeVisible();

    const creditNote = await createCreditNote(api, {
      customerId: customer.id,
      invoiceId: salesInvoice.id,
      invoiceItemId: invoiceItem.id,
      productId: product.id,
      unitId: product.unitId,
      quantity: 1,
      unitPrice: 175,
      issueDate: isoDate(0),
      label: `Credit note ${runId}`,
    });

    const creditNoteTotal = Number(creditNote.total);
    const invoiceAfterCredit = await getInvoice(api, salesInvoice.id);

    expect(Number(invoiceAfterCredit.balanceDue)).toBe(invoiceTotal - creditNoteTotal);
    expect(await getCompactCustomerBalance(api, customer.id)).toBe(invoiceTotal - creditNoteTotal);
    expect((await getProductStock(product.id)).remaining).toBe(7);

    await expectInvoiceVisible(page, `/credit-notes/${creditNote.id}`, creditNote.creditNoteNumber);

    expect((await api.delete(`/api/credit-notes/${creditNote.id}`)).ok()).toBeTruthy();

    const invoiceAfterCreditDelete = await getInvoice(api, salesInvoice.id);
    expect(Number(invoiceAfterCreditDelete.balanceDue)).toBe(invoiceTotal);
    expect(await getCompactCustomerBalance(api, customer.id)).toBe(invoiceTotal);
    expect((await getProductStock(product.id)).remaining).toBe(6);

    expect((await api.delete(`/api/invoices/${salesInvoice.id}`)).ok()).toBeTruthy();
    expect(await getCompactCustomerBalance(api, customer.id)).toBe(0);
    expect((await getProductStock(product.id)).remaining).toBe(10);

    const deletedInvoiceResponse = await api.get(`/api/invoices/${salesInvoice.id}`);
    expect(deletedInvoiceResponse.status()).toBe(404);

    await api.dispose();
  });

  test("purchase invoice and debit note deletion clear supplier balances", async ({ page, baseURL }) => {
    const api = await createApiContext(baseURL!);
    const runId = makeRunId();

    const supplier = await createSupplier(api, `${runId}-purchase-supplier`);
    const product = await createStockProduct(api, `${runId}-purchase-product`, 140, 80);

    const purchaseInvoice = await createPurchaseInvoice(api, {
      supplierId: supplier.id,
      productId: product.id,
      unitId: product.unitId,
      quantity: 5,
      unitCost: 80,
      invoiceDate: isoDate(0),
      label: `Purchase invoice ${runId}`,
    });

    const purchaseDetail = await getPurchaseInvoice(api, purchaseInvoice.id);
    const purchaseItem = purchaseDetail.items[0];
    const purchaseTotal = Number(purchaseDetail.total);

    expect(Number(purchaseDetail.balanceDue)).toBe(purchaseTotal);
    expect(await getCompactSupplierBalance(api, supplier.id)).toBe(purchaseTotal);
    expect((await getProductStock(product.id)).remaining).toBe(5);

    await expectInvoiceVisible(page, `/purchase-invoices/${purchaseInvoice.id}`, purchaseInvoice.purchaseInvoiceNumber);
    await page.goto("/reports/supplier-balances", { waitUntil: "domcontentloaded" });
    await expect(page.getByText(supplier.name, { exact: true })).toBeVisible();

    const debitNote = await createDebitNote(api, {
      supplierId: supplier.id,
      purchaseInvoiceId: purchaseInvoice.id,
      purchaseInvoiceItemId: purchaseItem.id,
      productId: product.id,
      unitId: product.unitId,
      quantity: 1,
      unitCost: 80,
      issueDate: isoDate(0),
      label: `Debit note ${runId}`,
    });

    const debitNoteTotal = Number(debitNote.total);
    const purchaseAfterDebit = await getPurchaseInvoice(api, purchaseInvoice.id);

    expect(Number(purchaseAfterDebit.balanceDue)).toBe(purchaseTotal - debitNoteTotal);
    expect(await getCompactSupplierBalance(api, supplier.id)).toBe(purchaseTotal - debitNoteTotal);
    expect((await getProductStock(product.id)).remaining).toBe(4);

    await expectInvoiceVisible(page, `/debit-notes/${debitNote.id}`, debitNote.debitNoteNumber);

    expect((await api.delete(`/api/debit-notes/${debitNote.id}`)).ok()).toBeTruthy();

    const purchaseAfterDebitDelete = await getPurchaseInvoice(api, purchaseInvoice.id);
    expect(Number(purchaseAfterDebitDelete.balanceDue)).toBe(purchaseTotal);
    expect(await getCompactSupplierBalance(api, supplier.id)).toBe(purchaseTotal);
    expect((await getProductStock(product.id)).remaining).toBe(5);

    expect((await api.delete(`/api/purchase-invoices/${purchaseInvoice.id}`)).ok()).toBeTruthy();
    expect(await getCompactSupplierBalance(api, supplier.id)).toBe(0);
    expect((await getProductStock(product.id)).remaining).toBe(0);

    const deletedPurchaseResponse = await api.get(`/api/purchase-invoices/${purchaseInvoice.id}`);
    expect(deletedPurchaseResponse.status()).toBe(404);

    await api.dispose();
  });

  test("quotation workflow handles updates and deletions", async ({ page, baseURL }) => {
    const api = await createApiContext(baseURL!);
    const runId = makeRunId();

    const customer = await createCustomer(api, `${runId}-quotation-customer`);
    const product = await createStockProduct(api, `${runId}-quotation-product`, 210, 100);

    const quotation = await createQuotation(api, {
      customerId: customer.id,
      productId: product.id,
      unitId: product.unitId,
      quantity: 2,
      unitPrice: 210,
      issueDate: isoDate(0),
      validUntil: isoDate(15),
      label: `Quotation ${runId}`,
    });

    expect(quotation.status).toBe("SENT");
    expect(Number(quotation.total)).toBe(420);

    await expectInvoiceVisible(page, `/quotations/${quotation.id}`, quotation.quotationNumber);

    const invalidQuotationStatus = await api.put(`/api/quotations/${quotation.id}`, {
      data: {
        status: "ACCEPTED",
      },
    });

    expect(invalidQuotationStatus.status()).toBe(400);
    expect((await parseJsonAllowError(invalidQuotationStatus)).error).toContain("Invalid quotation status");

    const updatedQuotation = await parseJson(await api.put(`/api/quotations/${quotation.id}`, {
      data: {
        status: "CANCELLED",
        items: [
          {
            productId: product.id,
            description: `Quotation update ${runId}`,
            quantity: 3,
            unitPrice: 210,
            unitId: product.unitId,
            gstRate: 0,
            discount: 0,
          },
        ],
      },
    }));

    expect(updatedQuotation.status).toBe("CANCELLED");
    expect(Number(updatedQuotation.total)).toBe(630);

    expect((await api.delete(`/api/quotations/${quotation.id}`)).ok()).toBeTruthy();
    expect((await api.get(`/api/quotations/${quotation.id}`)).status()).toBe(404);

    await api.dispose();
  });

  test("manual journal entry workflow validates updates and deletions", async ({ page, baseURL }) => {
    const api = await createApiContext(baseURL!);
    const runId = makeRunId();

    const accounts = await listAccounts(api);
    const expenseAccountId = getAccountIdByCode(accounts, "5100");
    const equityAccountId = getAccountIdByCode(accounts, "3100");

    const invalidJournalResponse = await api.post("/api/journal-entries", {
      data: {
        date: new Date().toISOString(),
        description: `Unbalanced journal ${runId}`,
        status: "POSTED",
        lines: [
          { accountId: expenseAccountId, debit: 100, credit: 0 },
          { accountId: equityAccountId, debit: 0, credit: 90 },
        ],
      },
    });
    expect(invalidJournalResponse.status()).toBe(400);
    expect((await parseJsonAllowError(invalidJournalResponse)).error).toContain("Total debits must equal total credits");

    const journalEntry = await parseJson(await api.post("/api/journal-entries", {
      data: {
        date: new Date().toISOString(),
        description: `Manual journal ${runId}`,
        status: "POSTED",
        lines: [
          { accountId: expenseAccountId, description: "Debit line", debit: 125, credit: 0 },
          { accountId: equityAccountId, description: "Credit line", debit: 0, credit: 125 },
        ],
      },
    }));

    expect(journalEntry.status).toBe("POSTED");
    expect(journalEntry.lines).toHaveLength(2);

    await expectInvoiceVisible(page, `/accounting/journal-entries/${journalEntry.id}`, journalEntry.journalNumber);

    const updatedJournal = await parseJson(await api.put(`/api/journal-entries/${journalEntry.id}`, {
      data: {
        description: `Manual journal updated ${runId}`,
        lines: [
          { accountId: expenseAccountId, description: "Debit line updated", debit: 150, credit: 0 },
          { accountId: equityAccountId, description: "Credit line updated", debit: 0, credit: 150 },
        ],
      },
    }));

    expect(updatedJournal.description).toContain("updated");
    expect(Number(updatedJournal.lines[0].debit) + Number(updatedJournal.lines[1].debit)).toBe(150);
    expect(Number(updatedJournal.lines[0].credit) + Number(updatedJournal.lines[1].credit)).toBe(150);

    expect((await api.delete(`/api/journal-entries/${journalEntry.id}`)).ok()).toBeTruthy();
    expect((await api.get(`/api/journal-entries/${journalEntry.id}`)).status()).toBe(404);

    await api.dispose();
  });
});
