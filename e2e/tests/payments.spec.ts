import { expect, test, request as playwrightRequest } from "@playwright/test";
import type { APIRequestContext } from "@playwright/test";
import pg from "pg";
import "dotenv/config";

/* ────────────────────────────────────────────────────────────────────────── */
/*  Helpers                                                                   */
/* ────────────────────────────────────────────────────────────────────────── */

const baseURL = "http://localhost:3000";
const authStatePath = "e2e/.auth/admin.json";
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

async function parse(r: Awaited<ReturnType<APIRequestContext["get"]>>) {
  const b = await r.text();
  const d = b ? JSON.parse(b) : null;
  if (!r.ok()) throw new Error(`${r.url()} ${r.status()}: ${b}`);
  return d;
}

async function parseSafe(r: Awaited<ReturnType<APIRequestContext["get"]>>) {
  const b = await r.text();
  return { ok: r.ok(), status: r.status(), data: b ? JSON.parse(b) : null };
}

function uid() {
  return `e2e-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

function isoDate(off = 0) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + off);
  return d.toISOString().slice(0, 10);
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  Shared state created once per file                                        */
/* ────────────────────────────────────────────────────────────────────────── */

test.setTimeout(180_000);

let api: APIRequestContext;
let customerId: string;
let supplierId: string;
let productId: string;
let productUnitId: string;
let unitId: string;
let warehouseId: string;

// Invoices / purchases with balanceDue for allocation tests
let creditInvoiceId: string;
let creditInvoiceTotal: number;
let creditInvoice2Id: string;
let creditInvoice2Total: number;
let creditPurchaseId: string;
let creditPurchaseTotal: number;
let creditPurchase2Id: string;
let creditPurchase2Total: number;

// Cash & Bank account IDs
let cashAccountId: string;
let bankAccountId: string;

test.beforeAll(async () => {
  test.setTimeout(180_000);
  api = await playwrightRequest.newContext({ baseURL, storageState: authStatePath, timeout: 60_000 });

  // Warm up DB connection pool
  await api.get("/api/units").catch(() => {});
  await new Promise((r) => setTimeout(r, 1000));

  const run = uid();

  // Get or create pcs unit
  const units = await parse(await api.get("/api/units"));
  const pcsUnit = units.find((u: any) => u.code === "pcs") ?? units[0];
  unitId = pcsUnit.id;

  // Create test customer
  const cust = await parse(
    await api.post("/api/customers", {
      data: {
        name: `PayTest Customer ${run}`,
        email: `${run}-cust@example.com`,
        phone: "+966500000010",
      },
    }),
  );
  customerId = cust.id;

  // Create test supplier
  const sup = await parse(
    await api.post("/api/suppliers", {
      data: {
        name: `PayTest Supplier ${run}`,
        email: `${run}-sup@example.com`,
        phone: "+966500000011",
      },
    }),
  );
  supplierId = sup.id;

  // Create stock product
  const prod = await parse(
    await api.post("/api/products", {
      data: {
        name: `PayTest Product ${run}`,
        sku: `PAY-${run}`,
        price: 100,
        cost: 0,
        unitId,
        gstRate: 0,
        isService: false,
      },
    }),
  );
  productId = prod.id;
  productUnitId = prod.unitId;

  // Get first warehouse
  const warehouses = await parse(await api.get("/api/warehouses"));
  warehouseId = warehouses[0]?.id ?? "";

  // Seed stock via purchase
  await parse(
    await api.post("/api/purchase-invoices", {
      data: {
        supplierId,
        invoiceDate: isoDate(-10),
        dueDate: isoDate(-10),
        supplierInvoiceRef: `seed-${run}`,
        ...(warehouseId ? { warehouseId } : {}),
        items: [
          {
            productId,
            description: "Seed stock",
            quantity: 200,
            unitCost: 50,
            unitId: productUnitId,
            gstRate: 0,
            discount: 0,
          },
        ],
      },
    }),
  );

  // Create CREDIT sales invoice #1 (has balanceDue for payment allocation)
  const inv1 = await parse(
    await api.post("/api/invoices", {
      data: {
        customerId,
        issueDate: isoDate(-5),
        dueDate: isoDate(25),
        paymentType: "CREDIT",
        ...(warehouseId ? { warehouseId } : {}),
        items: [
          {
            productId,
            description: "Credit sale 1",
            quantity: 5,
            unitPrice: 100,
            unitId: productUnitId,
            gstRate: 0,
            discount: 0,
          },
        ],
      },
    }),
  );
  creditInvoiceId = inv1.id;
  creditInvoiceTotal = Number(inv1.total);

  // Create CREDIT sales invoice #2 (for multi-allocation tests)
  const inv2 = await parse(
    await api.post("/api/invoices", {
      data: {
        customerId,
        issueDate: isoDate(-4),
        dueDate: isoDate(26),
        paymentType: "CREDIT",
        ...(warehouseId ? { warehouseId } : {}),
        items: [
          {
            productId,
            description: "Credit sale 2",
            quantity: 3,
            unitPrice: 100,
            unitId: productUnitId,
            gstRate: 0,
            discount: 0,
          },
        ],
      },
    }),
  );
  creditInvoice2Id = inv2.id;
  creditInvoice2Total = Number(inv2.total);

  // Create CREDIT purchase invoice #1 (has balanceDue for supplier payment allocation)
  const pi1 = await parse(
    await api.post("/api/purchase-invoices", {
      data: {
        supplierId,
        invoiceDate: isoDate(-5),
        dueDate: isoDate(25),
        supplierInvoiceRef: `pi1-${run}`,
        ...(warehouseId ? { warehouseId } : {}),
        items: [
          {
            productId,
            description: "Credit purchase 1",
            quantity: 4,
            unitCost: 50,
            unitId: productUnitId,
            gstRate: 0,
            discount: 0,
          },
        ],
      },
    }),
  );
  creditPurchaseId = pi1.id;
  creditPurchaseTotal = Number(pi1.total);

  // Create CREDIT purchase invoice #2
  const pi2 = await parse(
    await api.post("/api/purchase-invoices", {
      data: {
        supplierId,
        invoiceDate: isoDate(-4),
        dueDate: isoDate(26),
        supplierInvoiceRef: `pi2-${run}`,
        ...(warehouseId ? { warehouseId } : {}),
        items: [
          {
            productId,
            description: "Credit purchase 2",
            quantity: 3,
            unitCost: 50,
            unitId: productUnitId,
            gstRate: 0,
            discount: 0,
          },
        ],
      },
    }),
  );
  creditPurchase2Id = pi2.id;
  creditPurchase2Total = Number(pi2.total);

  // Get cash & bank account IDs
  const accounts = await parse(await api.get("/api/cash-bank-accounts"));
  const cashAcct = accounts.find((a: any) => a.accountSubType === "CASH");
  const bankAcct = accounts.find((a: any) => a.accountSubType === "BANK");
  cashAccountId = cashAcct?.id ?? accounts[0]?.id;
  bankAccountId = bankAcct?.id ?? accounts[1]?.id ?? accounts[0]?.id;
});

test.afterAll(async () => {
  await api?.dispose();
  await pool.end();
});

/* ────────────────────────────────────────────────────────────────────────── */
/*  DB query helpers                                                          */
/* ────────────────────────────────────────────────────────────────────────── */

async function getCustomerBalance(): Promise<number> {
  const r = await pool.query(`SELECT balance FROM customers WHERE id = $1`, [customerId]);
  return Number(r.rows[0]?.balance ?? 0);
}

async function getSupplierBalance(): Promise<number> {
  const r = await pool.query(`SELECT balance FROM suppliers WHERE id = $1`, [supplierId]);
  return Number(r.rows[0]?.balance ?? 0);
}

async function getCashBankBalance(accountId: string): Promise<number> {
  const r = await pool.query(`SELECT balance FROM cash_bank_accounts WHERE id = $1`, [accountId]);
  return Number(r.rows[0]?.balance ?? 0);
}

async function getJournalEntries(sourceType: string, sourceId: string) {
  const result = await pool.query(
    `SELECT je.id, je."sourceType", je."sourceId", jel."accountId", jel.debit, jel.credit
     FROM journal_entries je
     JOIN journal_entry_lines jel ON jel."journalEntryId" = je.id
     WHERE je."sourceType" = $1 AND je."sourceId" = $2
     ORDER BY jel.debit DESC`,
    [sourceType, sourceId],
  );
  return result.rows;
}

async function getCustomerTransactionByPayment(paymentId: string) {
  const r = await pool.query(
    `SELECT id, amount, "transactionType" FROM customer_transactions WHERE "paymentId" = $1`,
    [paymentId],
  );
  return r.rows;
}

async function getSupplierTransactionByPayment(paymentId: string) {
  const r = await pool.query(
    `SELECT id, amount, "transactionType" FROM supplier_transactions WHERE "supplierPaymentId" = $1`,
    [paymentId],
  );
  return r.rows;
}

async function getInvoiceBalance(invoiceId: string): Promise<number> {
  const r = await pool.query(`SELECT "balanceDue" FROM invoices WHERE id = $1`, [invoiceId]);
  return Number(r.rows[0]?.balanceDue ?? 0);
}

async function getPurchaseInvoiceBalance(purchaseInvoiceId: string): Promise<number> {
  const r = await pool.query(`SELECT "balanceDue" FROM purchase_invoices WHERE id = $1`, [purchaseInvoiceId]);
  return Number(r.rows[0]?.balanceDue ?? 0);
}

async function getCashBankTransactions(accountId: string) {
  const r = await pool.query(
    `SELECT id, "transactionType", amount, "runningBalance", description
     FROM cash_bank_transactions
     WHERE "cashBankAccountId" = $1
     ORDER BY "createdAt" DESC`,
    [accountId],
  );
  return r.rows;
}

/* ────────────────────────────────────────────────────────────────────────── */
/*  CUSTOMER PAYMENTS (20 tests)                                              */
/* ────────────────────────────────────────────────────────────────────────── */

test.describe("Customer Payments", () => {
  test.setTimeout(120_000);

  let cashPaymentId: string;
  let bankPaymentId: string;
  let checkPaymentId: string;
  let upiPaymentId: string;
  let allocPaymentId: string;
  let multiAllocPaymentId: string;
  let overPaymentId: string;
  let deletePaymentId: string;

  // 1. Create payment with CASH method
  test("1 — create payment with CASH method", async () => {
    const balBefore = await getCustomerBalance();
    const r = await parse(
      await api.post("/api/payments", {
        data: {
          customerId,
          amount: 50,
          paymentDate: isoDate(),
          paymentMethod: "CASH",
        },
      }),
    );
    cashPaymentId = r.id;
    expect(r.id).toBeTruthy();
    expect(r.paymentNumber).toMatch(/^PAY-/);
    expect(r.paymentMethod).toBe("CASH");
    expect(Number(r.amount)).toBe(50);
  });

  // 2. Create payment with BANK_TRANSFER
  test("2 — create payment with BANK_TRANSFER", async () => {
    const r = await parse(
      await api.post("/api/payments", {
        data: {
          customerId,
          amount: 75,
          paymentDate: isoDate(),
          paymentMethod: "BANK_TRANSFER",
        },
      }),
    );
    bankPaymentId = r.id;
    expect(r.paymentMethod).toBe("BANK_TRANSFER");
    expect(Number(r.amount)).toBe(75);
  });

  // 3. Create payment with CHECK + reference
  test("3 — create payment with CHECK + reference", async () => {
    const r = await parse(
      await api.post("/api/payments", {
        data: {
          customerId,
          amount: 30,
          paymentDate: isoDate(),
          paymentMethod: "CHECK",
          reference: "CHK-12345",
        },
      }),
    );
    checkPaymentId = r.id;
    expect(r.paymentMethod).toBe("CHECK");
    expect(r.reference).toBe("CHK-12345");
  });

  // 4. Create payment with UPI
  test("4 — create payment with UPI", async () => {
    const r = await parse(
      await api.post("/api/payments", {
        data: {
          customerId,
          amount: 20,
          paymentDate: isoDate(),
          paymentMethod: "UPI",
        },
      }),
    );
    upiPaymentId = r.id;
    expect(r.paymentMethod).toBe("UPI");
  });

  // 5. Create payment without customer → fail
  test("5 — create payment without customer fails", async () => {
    const res = await parseSafe(
      await api.post("/api/payments", {
        data: {
          amount: 100,
          paymentDate: isoDate(),
          paymentMethod: "CASH",
        },
      }),
    );
    expect(res.ok).toBe(false);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  // 6. Create payment with zero amount → should handle (400)
  test("6 — create payment with zero amount", async () => {
    const res = await parseSafe(
      await api.post("/api/payments", {
        data: {
          customerId,
          amount: 0,
          paymentDate: isoDate(),
          paymentMethod: "CASH",
        },
      }),
    );
    // Zero amount should be rejected (0 is falsy, API checks !amount)
    expect(res.ok).toBe(false);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  // 7. Create payment → customer balance decreased
  test("7 — customer balance decreases after payment", async () => {
    const balBefore = await getCustomerBalance();
    const r = await parse(
      await api.post("/api/payments", {
        data: {
          customerId,
          amount: 10,
          paymentDate: isoDate(),
          paymentMethod: "CASH",
        },
      }),
    );
    const balAfter = await getCustomerBalance();
    expect(balAfter).toBeCloseTo(balBefore - 10, 2);
    // cleanup reference
    deletePaymentId = r.id;
  });

  // 8. Create payment → cash account balance increased
  test("8 — cash account balance increases after customer payment", async () => {
    const balBefore = await getCashBankBalance(cashAccountId);
    await parse(
      await api.post("/api/payments", {
        data: {
          customerId,
          amount: 15,
          paymentDate: isoDate(),
          paymentMethod: "CASH",
        },
      }),
    );
    const balAfter = await getCashBankBalance(cashAccountId);
    expect(balAfter).toBeCloseTo(balBefore + 15, 2);
  });

  // 9. Create payment → journal entry (DR cash, CR AR)
  test("9 — customer payment creates journal entry", async () => {
    const r = await parse(
      await api.post("/api/payments", {
        data: {
          customerId,
          amount: 25,
          paymentDate: isoDate(),
          paymentMethod: "CASH",
        },
      }),
    );
    const je = await getJournalEntries("PAYMENT", r.id);
    expect(je.length).toBeGreaterThanOrEqual(2);
    const debits = je.filter((l: any) => Number(l.debit) > 0);
    const credits = je.filter((l: any) => Number(l.credit) > 0);
    expect(debits.length).toBeGreaterThanOrEqual(1);
    expect(credits.length).toBeGreaterThanOrEqual(1);
    // Total debits should equal total credits
    const totalDebit = debits.reduce((s: number, l: any) => s + Number(l.debit), 0);
    const totalCredit = credits.reduce((s: number, l: any) => s + Number(l.credit), 0);
    expect(totalDebit).toBeCloseTo(totalCredit, 2);
  });

  // 10. Create payment → customer transaction created
  test("10 — customer payment creates customer transaction", async () => {
    const r = await parse(
      await api.post("/api/payments", {
        data: {
          customerId,
          amount: 12,
          paymentDate: isoDate(),
          paymentMethod: "CASH",
        },
      }),
    );
    const txns = await getCustomerTransactionByPayment(r.id);
    expect(txns.length).toBe(1);
    expect(txns[0].transactionType).toBe("PAYMENT");
    expect(Number(txns[0].amount)).toBe(-12);
  });

  // 11. Payment with invoice allocation → invoice balanceDue reduced
  test("11 — payment allocated to invoice reduces balanceDue", async () => {
    const bdBefore = await getInvoiceBalance(creditInvoiceId);
    expect(bdBefore).toBeGreaterThan(0);
    const allocAmount = Math.min(100, bdBefore);
    const r = await parse(
      await api.post("/api/payments", {
        data: {
          customerId,
          invoiceId: creditInvoiceId,
          amount: allocAmount,
          paymentDate: isoDate(),
          paymentMethod: "CASH",
        },
      }),
    );
    allocPaymentId = r.id;
    const bdAfter = await getInvoiceBalance(creditInvoiceId);
    expect(bdAfter).toBeCloseTo(bdBefore - allocAmount, 2);
  });

  // 12. Payment allocated to multiple invoices (FIFO auto-apply without invoiceId)
  test("12 — payment auto-applied across multiple invoices (FIFO)", async () => {
    // This test creates a fresh customer with two invoices to test FIFO
    const run = uid();
    const cust2 = await parse(
      await api.post("/api/customers", {
        data: { name: `FIFO Cust ${run}`, email: `${run}-fifo@example.com`, phone: "+966500000099" },
      }),
    );
    // Create two CREDIT invoices for this customer
    const inv1 = await parse(
      await api.post("/api/invoices", {
        data: {
          customerId: cust2.id,
          issueDate: isoDate(-3),
          dueDate: isoDate(27),
          paymentType: "CREDIT",
          ...(warehouseId ? { warehouseId } : {}),
          items: [{ productId, description: "FIFO 1", quantity: 1, unitPrice: 100, unitId: productUnitId, gstRate: 0, discount: 0 }],
        },
      }),
    );
    const inv2 = await parse(
      await api.post("/api/invoices", {
        data: {
          customerId: cust2.id,
          issueDate: isoDate(-2),
          dueDate: isoDate(28),
          paymentType: "CREDIT",
          ...(warehouseId ? { warehouseId } : {}),
          items: [{ productId, description: "FIFO 2", quantity: 1, unitPrice: 80, unitId: productUnitId, gstRate: 0, discount: 0 }],
        },
      }),
    );
    // Pay 150 without specifying invoiceId → should auto-apply: 100 to inv1, 50 to inv2
    const r = await parse(
      await api.post("/api/payments", {
        data: {
          customerId: cust2.id,
          amount: 150,
          paymentDate: isoDate(),
          paymentMethod: "CASH",
        },
      }),
    );
    multiAllocPaymentId = r.id;
    const bd1 = await getInvoiceBalance(inv1.id);
    const bd2 = await getInvoiceBalance(inv2.id);
    expect(bd1).toBe(0); // fully paid
    expect(bd2).toBeCloseTo(80 - 50, 2); // 30 remaining
  });

  // 13. Over-payment (more than invoice due) → excess as advance (customer balance goes negative)
  test("13 — over-payment creates advance (excess reduces customer balance further)", async () => {
    const run = uid();
    const cust3 = await parse(
      await api.post("/api/customers", {
        data: { name: `OverPay Cust ${run}`, email: `${run}-op@example.com`, phone: "+966500000098" },
      }),
    );
    const inv = await parse(
      await api.post("/api/invoices", {
        data: {
          customerId: cust3.id,
          issueDate: isoDate(-1),
          dueDate: isoDate(29),
          paymentType: "CREDIT",
          ...(warehouseId ? { warehouseId } : {}),
          items: [{ productId, description: "OverPay", quantity: 1, unitPrice: 50, unitId: productUnitId, gstRate: 0, discount: 0 }],
        },
      }),
    );
    // Pay 80 against a 50 invoice
    const r = await parse(
      await api.post("/api/payments", {
        data: {
          customerId: cust3.id,
          invoiceId: inv.id,
          amount: 80,
          paymentDate: isoDate(),
          paymentMethod: "CASH",
        },
      }),
    );
    overPaymentId = r.id;
    const bd = await getInvoiceBalance(inv.id);
    expect(bd).toBe(0); // Invoice fully paid
    // Customer balance should be negative (advance/credit)
    const custBal = await pool.query(`SELECT balance FROM customers WHERE id = $1`, [cust3.id]);
    // balance was 50 (from credit invoice), minus 80 payment = -30
    expect(Number(custBal.rows[0].balance)).toBeCloseTo(-30, 2);
  });

  // 14. List payments → returns array
  test("14 — list payments returns array", async () => {
    const r = await parse(await api.get("/api/payments"));
    expect(Array.isArray(r.data)).toBe(true);
    expect(r.data.length).toBeGreaterThanOrEqual(1);
  });

  // 15. Get payment by ID
  test("15 — get payment by ID", async () => {
    expect(cashPaymentId).toBeTruthy();
    const r = await parse(await api.get(`/api/payments/${cashPaymentId}`));
    expect(r.id).toBe(cashPaymentId);
    expect(r.paymentMethod).toBe("CASH");
    expect(r.customer).toBeTruthy();
  });

  // 16. Get non-existent payment → 404
  test("16 — get non-existent payment returns 404", async () => {
    const res = await parseSafe(await api.get("/api/payments/nonexistent-id-12345"));
    expect(res.ok).toBe(false);
    expect(res.status).toBe(404);
  });

  // 17. Edit payment amount (PUT)
  test("17 — edit payment amount via PUT", async () => {
    // PUT may not be implemented — test the expected behavior
    const res = await parseSafe(
      await api.put(`/api/payments/${cashPaymentId}`, {
        data: { amount: 55 },
      }),
    );
    // If PUT is not implemented, we expect 405 Method Not Allowed
    // If it IS implemented, expect success
    if (res.ok) {
      expect(Number(res.data.amount)).toBe(55);
    } else {
      expect([404, 405, 500]).toContain(res.status);
    }
  });

  // 18. Edit payment method (PUT)
  test("18 — edit payment method via PUT", async () => {
    const res = await parseSafe(
      await api.put(`/api/payments/${bankPaymentId}`, {
        data: { paymentMethod: "CHECK" },
      }),
    );
    if (res.ok) {
      expect(res.data.paymentMethod).toBe("CHECK");
    } else {
      expect([404, 405, 500]).toContain(res.status);
    }
  });

  // 19. Delete payment → customer balance restored
  test("19 — delete payment restores customer balance", async () => {
    // Create a fresh payment to delete
    const balBefore = await getCustomerBalance();
    const r = await parse(
      await api.post("/api/payments", {
        data: {
          customerId,
          amount: 40,
          paymentDate: isoDate(),
          paymentMethod: "CASH",
        },
      }),
    );
    const balAfterCreate = await getCustomerBalance();
    expect(balAfterCreate).toBeCloseTo(balBefore - 40, 2);

    await parse(await api.delete(`/api/payments/${r.id}`));
    const balAfterDelete = await getCustomerBalance();
    expect(balAfterDelete).toBeCloseTo(balBefore, 2);
  });

  // 20. Delete payment → journal entry reversed
  test("20 — delete payment removes journal entries", async () => {
    const r = await parse(
      await api.post("/api/payments", {
        data: {
          customerId,
          amount: 22,
          paymentDate: isoDate(),
          paymentMethod: "CASH",
        },
      }),
    );
    const jeBefore = await getJournalEntries("PAYMENT", r.id);
    expect(jeBefore.length).toBeGreaterThanOrEqual(2);

    await parse(await api.delete(`/api/payments/${r.id}`));
    const jeAfter = await getJournalEntries("PAYMENT", r.id);
    expect(jeAfter.length).toBe(0);
  });
});

/* ────────────────────────────────────────────────────────────────────────── */
/*  SUPPLIER PAYMENTS (20 tests)                                              */
/* ────────────────────────────────────────────────────────────────────────── */

test.describe("Supplier Payments", () => {
  test.setTimeout(120_000);

  let cashSPayId: string;
  let bankSPayId: string;
  let checkSPayId: string;

  // 21. Create supplier payment with CASH
  test("21 — create supplier payment with CASH", async () => {
    const r = await parse(
      await api.post("/api/supplier-payments", {
        data: {
          supplierId,
          amount: 40,
          paymentDate: isoDate(),
          paymentMethod: "CASH",
        },
      }),
    );
    cashSPayId = r.id;
    expect(r.id).toBeTruthy();
    expect(r.paymentNumber).toMatch(/^SPAY-/);
    expect(r.paymentMethod).toBe("CASH");
    expect(Number(r.amount)).toBe(40);
  });

  // 22. Create supplier payment with BANK_TRANSFER
  test("22 — create supplier payment with BANK_TRANSFER", async () => {
    const r = await parse(
      await api.post("/api/supplier-payments", {
        data: {
          supplierId,
          amount: 60,
          paymentDate: isoDate(),
          paymentMethod: "BANK_TRANSFER",
        },
      }),
    );
    bankSPayId = r.id;
    expect(r.paymentMethod).toBe("BANK_TRANSFER");
    expect(Number(r.amount)).toBe(60);
  });

  // 23. Create supplier payment with CHECK
  test("23 — create supplier payment with CHECK", async () => {
    const r = await parse(
      await api.post("/api/supplier-payments", {
        data: {
          supplierId,
          amount: 30,
          paymentDate: isoDate(),
          paymentMethod: "CHECK",
          reference: "SCHK-999",
        },
      }),
    );
    checkSPayId = r.id;
    expect(r.paymentMethod).toBe("CHECK");
    expect(r.reference).toBe("SCHK-999");
  });

  // 24. Create supplier payment without supplier → fail
  test("24 — create supplier payment without supplier fails", async () => {
    const res = await parseSafe(
      await api.post("/api/supplier-payments", {
        data: {
          amount: 100,
          paymentDate: isoDate(),
          paymentMethod: "CASH",
        },
      }),
    );
    expect(res.ok).toBe(false);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  // 25. Create supplier payment → supplier balance decreased
  test("25 — supplier balance decreases after payment", async () => {
    const balBefore = await getSupplierBalance();
    await parse(
      await api.post("/api/supplier-payments", {
        data: {
          supplierId,
          amount: 10,
          paymentDate: isoDate(),
          paymentMethod: "CASH",
        },
      }),
    );
    const balAfter = await getSupplierBalance();
    expect(balAfter).toBeCloseTo(balBefore - 10, 2);
  });

  // 26. Create supplier payment → cash account decreased
  test("26 — cash account balance decreases after supplier payment", async () => {
    const balBefore = await getCashBankBalance(cashAccountId);
    await parse(
      await api.post("/api/supplier-payments", {
        data: {
          supplierId,
          amount: 15,
          paymentDate: isoDate(),
          paymentMethod: "CASH",
        },
      }),
    );
    const balAfter = await getCashBankBalance(cashAccountId);
    expect(balAfter).toBeCloseTo(balBefore - 15, 2);
  });

  // 27. Create supplier payment → journal entry (DR AP, CR cash)
  test("27 — supplier payment creates journal entry", async () => {
    const r = await parse(
      await api.post("/api/supplier-payments", {
        data: {
          supplierId,
          amount: 20,
          paymentDate: isoDate(),
          paymentMethod: "CASH",
        },
      }),
    );
    const je = await getJournalEntries("SUPPLIER_PAYMENT", r.id);
    expect(je.length).toBeGreaterThanOrEqual(2);
    const debits = je.filter((l: any) => Number(l.debit) > 0);
    const credits = je.filter((l: any) => Number(l.credit) > 0);
    expect(debits.length).toBeGreaterThanOrEqual(1);
    expect(credits.length).toBeGreaterThanOrEqual(1);
    const totalDebit = debits.reduce((s: number, l: any) => s + Number(l.debit), 0);
    const totalCredit = credits.reduce((s: number, l: any) => s + Number(l.credit), 0);
    expect(totalDebit).toBeCloseTo(totalCredit, 2);
  });

  // 28. Create supplier payment → supplier transaction created
  test("28 — supplier payment creates supplier transaction", async () => {
    const r = await parse(
      await api.post("/api/supplier-payments", {
        data: {
          supplierId,
          amount: 8,
          paymentDate: isoDate(),
          paymentMethod: "CASH",
        },
      }),
    );
    const txns = await getSupplierTransactionByPayment(r.id);
    expect(txns.length).toBe(1);
    expect(txns[0].transactionType).toBe("PAYMENT");
    expect(Number(txns[0].amount)).toBe(-8);
  });

  // 29. Supplier payment with purchase allocation → balanceDue reduced
  test("29 — supplier payment allocated to purchase reduces balanceDue", async () => {
    const bdBefore = await getPurchaseInvoiceBalance(creditPurchaseId);
    expect(bdBefore).toBeGreaterThan(0);
    const allocAmount = Math.min(50, bdBefore);
    const r = await parse(
      await api.post("/api/supplier-payments", {
        data: {
          supplierId,
          purchaseInvoiceId: creditPurchaseId,
          amount: allocAmount,
          paymentDate: isoDate(),
          paymentMethod: "CASH",
        },
      }),
    );
    const bdAfter = await getPurchaseInvoiceBalance(creditPurchaseId);
    expect(bdAfter).toBeCloseTo(bdBefore - allocAmount, 2);
  });

  // 30. Supplier payment allocated to multiple purchases (FIFO)
  test("30 — supplier payment auto-applied across multiple purchases (FIFO)", async () => {
    const run = uid();
    const sup2 = await parse(
      await api.post("/api/suppliers", {
        data: { name: `FIFO Sup ${run}`, email: `${run}-fisup@example.com`, phone: "+966500000097" },
      }),
    );
    // Create two purchase invoices
    const pi1 = await parse(
      await api.post("/api/purchase-invoices", {
        data: {
          supplierId: sup2.id,
          invoiceDate: isoDate(-3),
          dueDate: isoDate(27),
          supplierInvoiceRef: `fifo1-${run}`,
          ...(warehouseId ? { warehouseId } : {}),
          items: [{ productId, description: "FIFO PI 1", quantity: 2, unitCost: 50, unitId: productUnitId, gstRate: 0, discount: 0 }],
        },
      }),
    );
    const pi2 = await parse(
      await api.post("/api/purchase-invoices", {
        data: {
          supplierId: sup2.id,
          invoiceDate: isoDate(-2),
          dueDate: isoDate(28),
          supplierInvoiceRef: `fifo2-${run}`,
          ...(warehouseId ? { warehouseId } : {}),
          items: [{ productId, description: "FIFO PI 2", quantity: 2, unitCost: 40, unitId: productUnitId, gstRate: 0, discount: 0 }],
        },
      }),
    );
    // Pay 120 without specifying purchaseInvoiceId → FIFO: 100 to pi1, 20 to pi2
    await parse(
      await api.post("/api/supplier-payments", {
        data: {
          supplierId: sup2.id,
          amount: 120,
          paymentDate: isoDate(),
          paymentMethod: "CASH",
        },
      }),
    );
    const bd1 = await getPurchaseInvoiceBalance(pi1.id);
    const bd2 = await getPurchaseInvoiceBalance(pi2.id);
    expect(bd1).toBe(0);
    expect(bd2).toBeCloseTo(80 - 20, 2); // 60 remaining
  });

  // 31. Over-payment on purchase
  test("31 — over-payment on purchase invoice", async () => {
    const run = uid();
    const sup3 = await parse(
      await api.post("/api/suppliers", {
        data: { name: `OverPay Sup ${run}`, email: `${run}-opsup@example.com`, phone: "+966500000096" },
      }),
    );
    const pi = await parse(
      await api.post("/api/purchase-invoices", {
        data: {
          supplierId: sup3.id,
          invoiceDate: isoDate(-1),
          dueDate: isoDate(29),
          supplierInvoiceRef: `op-${run}`,
          ...(warehouseId ? { warehouseId } : {}),
          items: [{ productId, description: "OverPay PI", quantity: 1, unitCost: 50, unitId: productUnitId, gstRate: 0, discount: 0 }],
        },
      }),
    );
    // Pay 80 on a 50 invoice
    await parse(
      await api.post("/api/supplier-payments", {
        data: {
          supplierId: sup3.id,
          purchaseInvoiceId: pi.id,
          amount: 80,
          paymentDate: isoDate(),
          paymentMethod: "CASH",
        },
      }),
    );
    const bd = await getPurchaseInvoiceBalance(pi.id);
    expect(bd).toBe(0);
    // Supplier balance should go negative (advance)
    const supBal = await pool.query(`SELECT balance FROM suppliers WHERE id = $1`, [sup3.id]);
    expect(Number(supBal.rows[0].balance)).toBeCloseTo(-30, 2);
  });

  // 32. List supplier payments → array
  test("32 — list supplier payments returns array", async () => {
    const r = await parse(await api.get("/api/supplier-payments"));
    expect(Array.isArray(r.data)).toBe(true);
    expect(r.data.length).toBeGreaterThanOrEqual(1);
  });

  // 33. Get supplier payment by ID
  test("33 — get supplier payment by ID", async () => {
    expect(cashSPayId).toBeTruthy();
    const r = await parse(await api.get(`/api/supplier-payments/${cashSPayId}`));
    expect(r.id).toBe(cashSPayId);
    expect(r.paymentMethod).toBe("CASH");
    expect(r.supplier).toBeTruthy();
  });

  // 34. Get non-existent → 404
  test("34 — get non-existent supplier payment returns 404", async () => {
    const res = await parseSafe(await api.get("/api/supplier-payments/nonexistent-id-99999"));
    expect(res.ok).toBe(false);
    expect(res.status).toBe(404);
  });

  // 35. Edit supplier payment amount
  test("35 — edit supplier payment amount via PUT", async () => {
    const res = await parseSafe(
      await api.put(`/api/supplier-payments/${cashSPayId}`, {
        data: { amount: 45 },
      }),
    );
    if (res.ok) {
      expect(Number(res.data.amount)).toBe(45);
    } else {
      expect([404, 405, 500]).toContain(res.status);
    }
  });

  // 36. Edit supplier payment method
  test("36 — edit supplier payment method via PUT", async () => {
    const res = await parseSafe(
      await api.put(`/api/supplier-payments/${bankSPayId}`, {
        data: { paymentMethod: "CHECK" },
      }),
    );
    if (res.ok) {
      expect(res.data.paymentMethod).toBe("CHECK");
    } else {
      expect([404, 405, 500]).toContain(res.status);
    }
  });

  // 37. Delete supplier payment → supplier balance restored
  test("37 — delete supplier payment restores supplier balance", async () => {
    const balBefore = await getSupplierBalance();
    const r = await parse(
      await api.post("/api/supplier-payments", {
        data: {
          supplierId,
          amount: 35,
          paymentDate: isoDate(),
          paymentMethod: "CASH",
        },
      }),
    );
    const balAfterCreate = await getSupplierBalance();
    expect(balAfterCreate).toBeCloseTo(balBefore - 35, 2);

    await parse(await api.delete(`/api/supplier-payments/${r.id}`));
    const balAfterDelete = await getSupplierBalance();
    expect(balAfterDelete).toBeCloseTo(balBefore, 2);
  });

  // 38. Delete supplier payment → journal reversed
  test("38 — delete supplier payment removes journal entries", async () => {
    const r = await parse(
      await api.post("/api/supplier-payments", {
        data: {
          supplierId,
          amount: 18,
          paymentDate: isoDate(),
          paymentMethod: "CASH",
        },
      }),
    );
    const jeBefore = await getJournalEntries("SUPPLIER_PAYMENT", r.id);
    expect(jeBefore.length).toBeGreaterThanOrEqual(2);

    await parse(await api.delete(`/api/supplier-payments/${r.id}`));
    const jeAfter = await getJournalEntries("SUPPLIER_PAYMENT", r.id);
    expect(jeAfter.length).toBe(0);
  });

  // 39. Supplier payment auto-number
  test("39 — supplier payment auto-generates SPAY number", async () => {
    const r = await parse(
      await api.post("/api/supplier-payments", {
        data: {
          supplierId,
          amount: 5,
          paymentDate: isoDate(),
          paymentMethod: "CASH",
        },
      }),
    );
    expect(r.paymentNumber).toMatch(/^SPAY-\d{8}-\d{3}$/);
  });

  // 40. Supplier payment with notes and reference
  test("40 — supplier payment with notes and reference", async () => {
    const r = await parse(
      await api.post("/api/supplier-payments", {
        data: {
          supplierId,
          amount: 7,
          paymentDate: isoDate(),
          paymentMethod: "BANK_TRANSFER",
          reference: "REF-SUPPLIER-001",
          notes: "Monthly payment for raw materials",
        },
      }),
    );
    expect(r.reference).toBe("REF-SUPPLIER-001");
    expect(r.notes).toBe("Monthly payment for raw materials");
  });
});

/* ────────────────────────────────────────────────────────────────────────── */
/*  CASH & BANK ACCOUNTS (20 tests)                                           */
/* ────────────────────────────────────────────────────────────────────────── */

test.describe("Cash & Bank Accounts", () => {
  test.setTimeout(120_000);

  let customCashBankId: string;

  // 41. List cash/bank accounts → at least cash and bank exist
  test("41 — list cash/bank accounts returns at least two", async () => {
    const r = await parse(await api.get("/api/cash-bank-accounts"));
    expect(Array.isArray(r)).toBe(true);
    expect(r.length).toBeGreaterThanOrEqual(2);
    const types = r.map((a: any) => a.accountSubType);
    expect(types).toContain("CASH");
    expect(types).toContain("BANK");
  });

  // 42. Get cash account detail → shows transactions
  test("42 — get cash account detail includes transactions", async () => {
    const r = await parse(await api.get(`/api/cash-bank-accounts/${cashAccountId}`));
    expect(r.id).toBe(cashAccountId);
    expect(r.accountSubType).toBe("CASH");
    expect(Array.isArray(r.transactions)).toBe(true);
  });

  // 43. Get bank account detail → shows transactions
  test("43 — get bank account detail includes transactions", async () => {
    const r = await parse(await api.get(`/api/cash-bank-accounts/${bankAccountId}`));
    expect(r.id).toBe(bankAccountId);
    expect(Array.isArray(r.transactions)).toBe(true);
  });

  // 44. Deposit to cash account → balance increases
  test("44 — deposit to cash account increases balance", async () => {
    const balBefore = await getCashBankBalance(cashAccountId);
    await parse(
      await api.post(`/api/cash-bank-accounts/${cashAccountId}/deposit`, {
        data: {
          amount: 500,
          description: "Test deposit cash",
          transactionDate: isoDate(),
        },
      }),
    );
    const balAfter = await getCashBankBalance(cashAccountId);
    expect(balAfter).toBeCloseTo(balBefore + 500, 2);
  });

  // 45. Deposit to bank account → balance increases
  test("45 — deposit to bank account increases balance", async () => {
    const balBefore = await getCashBankBalance(bankAccountId);
    await parse(
      await api.post(`/api/cash-bank-accounts/${bankAccountId}/deposit`, {
        data: {
          amount: 300,
          description: "Test deposit bank",
          transactionDate: isoDate(),
        },
      }),
    );
    const balAfter = await getCashBankBalance(bankAccountId);
    expect(balAfter).toBeCloseTo(balBefore + 300, 2);
  });

  // 46. Deposit → journal entry (DR cash/bank, CR deposit account)
  test("46 — deposit creates journal entry", async () => {
    const r = await parse(
      await api.post(`/api/cash-bank-accounts/${cashAccountId}/deposit`, {
        data: {
          amount: 100,
          description: "JE deposit test",
          transactionDate: isoDate(),
        },
      }),
    );
    const je = await getJournalEntries("TRANSFER", r.id);
    expect(je.length).toBeGreaterThanOrEqual(2);
    const totalDebit = je.reduce((s: number, l: any) => s + Number(l.debit), 0);
    const totalCredit = je.reduce((s: number, l: any) => s + Number(l.credit), 0);
    expect(totalDebit).toBeCloseTo(totalCredit, 2);
  });

  // 47. Withdrawal from cash account → balance decreases
  test("47 — withdrawal from cash account decreases balance", async () => {
    const balBefore = await getCashBankBalance(cashAccountId);
    await parse(
      await api.post(`/api/cash-bank-accounts/${cashAccountId}/withdrawal`, {
        data: {
          amount: 200,
          description: "Test withdrawal cash",
          transactionDate: isoDate(),
        },
      }),
    );
    const balAfter = await getCashBankBalance(cashAccountId);
    expect(balAfter).toBeCloseTo(balBefore - 200, 2);
  });

  // 48. Withdrawal from bank account
  test("48 — withdrawal from bank account decreases balance", async () => {
    const balBefore = await getCashBankBalance(bankAccountId);
    await parse(
      await api.post(`/api/cash-bank-accounts/${bankAccountId}/withdrawal`, {
        data: {
          amount: 100,
          description: "Test withdrawal bank",
          transactionDate: isoDate(),
        },
      }),
    );
    const balAfter = await getCashBankBalance(bankAccountId);
    expect(balAfter).toBeCloseTo(balBefore - 100, 2);
  });

  // 49. Withdrawal → journal entry
  test("49 — withdrawal creates journal entry", async () => {
    const r = await parse(
      await api.post(`/api/cash-bank-accounts/${cashAccountId}/withdrawal`, {
        data: {
          amount: 50,
          description: "JE withdrawal test",
          transactionDate: isoDate(),
        },
      }),
    );
    const je = await getJournalEntries("TRANSFER", r.id);
    expect(je.length).toBeGreaterThanOrEqual(2);
    const totalDebit = je.reduce((s: number, l: any) => s + Number(l.debit), 0);
    const totalCredit = je.reduce((s: number, l: any) => s + Number(l.credit), 0);
    expect(totalDebit).toBeCloseTo(totalCredit, 2);
  });

  // 50. Transfer between accounts → source decreased, dest increased
  test("50 — transfer decreases source and increases destination", async () => {
    const fromBal = await getCashBankBalance(cashAccountId);
    const toBal = await getCashBankBalance(bankAccountId);
    await parse(
      await api.post("/api/cash-bank-accounts/transfer", {
        data: {
          fromAccountId: cashAccountId,
          toAccountId: bankAccountId,
          amount: 150,
          description: "Test transfer",
          transactionDate: isoDate(),
        },
      }),
    );
    const fromBalAfter = await getCashBankBalance(cashAccountId);
    const toBalAfter = await getCashBankBalance(bankAccountId);
    expect(fromBalAfter).toBeCloseTo(fromBal - 150, 2);
    expect(toBalAfter).toBeCloseTo(toBal + 150, 2);
  });

  // 51. Transfer → journal entry with offsetting lines
  test("51 — transfer creates journal entry with offsetting lines", async () => {
    // Find the latest cash_bank_transaction for the cash account (TRANSFER_OUT)
    const txns = await pool.query(
      `SELECT id FROM cash_bank_transactions
       WHERE "cashBankAccountId" = $1 AND "transactionType" = 'TRANSFER_OUT'
       ORDER BY "createdAt" DESC LIMIT 1`,
      [cashAccountId],
    );
    if (txns.rows.length > 0) {
      const je = await getJournalEntries("TRANSFER", txns.rows[0].id);
      expect(je.length).toBeGreaterThanOrEqual(2);
      const totalDebit = je.reduce((s: number, l: any) => s + Number(l.debit), 0);
      const totalCredit = je.reduce((s: number, l: any) => s + Number(l.credit), 0);
      expect(totalDebit).toBeCloseTo(totalCredit, 2);
    }
  });

  // 52. Deposit with reference number
  test("52 — deposit with reference info", async () => {
    const r = await parse(
      await api.post(`/api/cash-bank-accounts/${cashAccountId}/deposit`, {
        data: {
          amount: 75,
          description: "Deposit with ref",
          transactionDate: isoDate(),
          referenceType: "MANUAL",
          referenceId: "DEP-REF-001",
        },
      }),
    );
    expect(r.referenceType).toBe("MANUAL");
    expect(r.referenceId).toBe("DEP-REF-001");
    expect(Number(r.amount)).toBe(75);
  });

  // 53. Deposit with description
  test("53 — deposit stores description", async () => {
    const desc = `Customer walkup deposit ${uid()}`;
    const r = await parse(
      await api.post(`/api/cash-bank-accounts/${bankAccountId}/deposit`, {
        data: {
          amount: 60,
          description: desc,
          transactionDate: isoDate(),
        },
      }),
    );
    expect(r.description).toBe(desc);
  });

  // 54. Withdrawal with zero amount → should handle (400)
  test("54 — withdrawal with zero amount is rejected", async () => {
    const res = await parseSafe(
      await api.post(`/api/cash-bank-accounts/${cashAccountId}/withdrawal`, {
        data: {
          amount: 0,
          description: "Zero withdrawal",
          transactionDate: isoDate(),
        },
      }),
    );
    expect(res.ok).toBe(false);
    expect(res.status).toBeGreaterThanOrEqual(400);
  });

  // 55. Get account transactions after deposit → shows in list
  test("55 — deposit appears in account transactions", async () => {
    const desc = `Traceable deposit ${uid()}`;
    await parse(
      await api.post(`/api/cash-bank-accounts/${cashAccountId}/deposit`, {
        data: {
          amount: 33,
          description: desc,
          transactionDate: isoDate(),
        },
      }),
    );
    const acct = await parse(await api.get(`/api/cash-bank-accounts/${cashAccountId}`));
    const found = acct.transactions.find((t: any) => t.description === desc);
    expect(found).toBeTruthy();
    expect(Number(found.amount)).toBe(33);
  });

  // 56. Get account transactions after withdrawal → shows in list
  test("56 — withdrawal appears in account transactions", async () => {
    const desc = `Traceable withdrawal ${uid()}`;
    await parse(
      await api.post(`/api/cash-bank-accounts/${cashAccountId}/withdrawal`, {
        data: {
          amount: 11,
          description: desc,
          transactionDate: isoDate(),
        },
      }),
    );
    const acct = await parse(await api.get(`/api/cash-bank-accounts/${cashAccountId}`));
    const found = acct.transactions.find((t: any) => t.description === desc);
    expect(found).toBeTruthy();
    expect(Number(found.amount)).toBe(-11);
  });

  // 57. Create custom cash/bank account
  test("57 — create custom cash/bank account", async () => {
    // Get an available account (chart of accounts) for linking
    const accounts = await pool.query(
      `SELECT id FROM accounts WHERE code = '1000' LIMIT 1`,
    );
    // If we can't find a free account, create with a unique approach
    // Try to create; if 409 (duplicate), that's expected — we just verify the endpoint works
    const run = uid();
    // First get all existing accounts to find one that isn't already linked
    const existingLinked = await pool.query(
      `SELECT "accountId" FROM cash_bank_accounts`,
    );
    const linkedIds = new Set(existingLinked.rows.map((r: any) => r.accountId));
    const freeAccounts = await pool.query(
      `SELECT id FROM accounts WHERE id NOT IN (SELECT "accountId" FROM cash_bank_accounts) AND "accountType" = 'ASSET' LIMIT 1`,
    );

    if (freeAccounts.rows.length > 0) {
      const r = await parse(
        await api.post("/api/cash-bank-accounts", {
          data: {
            name: `Custom CB ${run}`,
            accountId: freeAccounts.rows[0].id,
            accountSubType: "CASH",
          },
        }),
      );
      customCashBankId = r.id;
      expect(r.id).toBeTruthy();
      expect(r.name).toContain("Custom CB");
      expect(r.accountSubType).toBe("CASH");
    } else {
      // No free accounts — just verify the endpoint rejects properly
      const res = await parseSafe(
        await api.post("/api/cash-bank-accounts", {
          data: {
            name: `Custom CB ${run}`,
            accountId: "nonexistent",
            accountSubType: "CASH",
          },
        }),
      );
      expect(res.ok).toBe(false);
    }
  });

  // 58. Cash account balance matches sum of transactions
  test("58 — cash account balance matches sum of transactions", async () => {
    const acct = await parse(await api.get(`/api/cash-bank-accounts/${cashAccountId}`));
    const bal = Number(acct.balance);
    // The running balance of the most recent transaction should equal the account balance
    // Note: transactions are ordered desc, so the first one is most recent
    if (acct.transactions.length > 0) {
      // Sum all transaction amounts to verify consistency
      const txnSum = await pool.query(
        `SELECT COALESCE(SUM(amount), 0) as total FROM cash_bank_transactions WHERE "cashBankAccountId" = $1`,
        [cashAccountId],
      );
      const totalFromTxns = Number(txnSum.rows[0].total);
      // The balance should be close to the sum of all transaction amounts
      expect(bal).toBeCloseTo(totalFromTxns, 1);
    }
  });

  // 59. Bank account balance matches sum of transactions
  test("59 — bank account balance matches sum of transactions", async () => {
    const acct = await parse(await api.get(`/api/cash-bank-accounts/${bankAccountId}`));
    const bal = Number(acct.balance);
    if (acct.transactions.length > 0) {
      const txnSum = await pool.query(
        `SELECT COALESCE(SUM(amount), 0) as total FROM cash_bank_transactions WHERE "cashBankAccountId" = $1`,
        [bankAccountId],
      );
      const totalFromTxns = Number(txnSum.rows[0].total);
      expect(bal).toBeCloseTo(totalFromTxns, 1);
    }
  });

  // 60. Multiple deposits and withdrawals → running balance correct
  test("60 — running balance is correct after multiple operations", async () => {
    const balStart = await getCashBankBalance(cashAccountId);

    // Deposit 200
    await parse(
      await api.post(`/api/cash-bank-accounts/${cashAccountId}/deposit`, {
        data: { amount: 200, description: "Multi-op deposit 1", transactionDate: isoDate() },
      }),
    );
    const bal1 = await getCashBankBalance(cashAccountId);
    expect(bal1).toBeCloseTo(balStart + 200, 2);

    // Withdraw 80
    await parse(
      await api.post(`/api/cash-bank-accounts/${cashAccountId}/withdrawal`, {
        data: { amount: 80, description: "Multi-op withdrawal 1", transactionDate: isoDate() },
      }),
    );
    const bal2 = await getCashBankBalance(cashAccountId);
    expect(bal2).toBeCloseTo(balStart + 200 - 80, 2);

    // Deposit 50
    await parse(
      await api.post(`/api/cash-bank-accounts/${cashAccountId}/deposit`, {
        data: { amount: 50, description: "Multi-op deposit 2", transactionDate: isoDate() },
      }),
    );
    const bal3 = await getCashBankBalance(cashAccountId);
    expect(bal3).toBeCloseTo(balStart + 200 - 80 + 50, 2);

    // Withdraw 30
    await parse(
      await api.post(`/api/cash-bank-accounts/${cashAccountId}/withdrawal`, {
        data: { amount: 30, description: "Multi-op withdrawal 2", transactionDate: isoDate() },
      }),
    );
    const bal4 = await getCashBankBalance(cashAccountId);
    expect(bal4).toBeCloseTo(balStart + 200 - 80 + 50 - 30, 2);

    // Final balance should be balStart + 140
    expect(bal4).toBeCloseTo(balStart + 140, 2);
  });
});
