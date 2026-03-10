import "dotenv/config";
import { request as playwrightRequest, type APIRequestContext } from "@playwright/test";
import pg from "pg";

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

export const defaultOrgId = "default-org";
const authStateByRole = {
  admin: "e2e/.auth/admin.json",
  superadmin: "e2e/.auth/superadmin.json",
} as const;

type Role = keyof typeof authStateByRole;

type JsonValue = Record<string, any>;

export async function createApiContext(baseURL: string, role: Role = "admin") {
  return playwrightRequest.newContext({
    baseURL,
    storageState: authStateByRole[role],
  });
}

async function parseJson(response: Awaited<ReturnType<APIRequestContext["get"]>>) {
  const body = await response.text();
  const parsed = body ? JSON.parse(body) : null;
  if (!response.ok()) {
    throw new Error(`${response.url()} failed: ${response.status()} ${body}`);
  }
  return parsed;
}

export function makeRunId() {
  return `pos-${Date.now()}`;
}

export async function setOrgPosAccountingMode(
  superadminApi: APIRequestContext,
  mode: "DIRECT" | "CLEARING_ACCOUNT",
) {
  const response = await superadminApi.put(`/api/admin/organizations/${defaultOrgId}`, {
    data: { posAccountingMode: mode },
  });
  await parseJson(response);
}

export async function listCashBankAccounts(api: APIRequestContext) {
  const response = await api.get("/api/cash-bank-accounts?activeOnly=true");
  return parseJson(response);
}

export async function createBranch(api: APIRequestContext, runId: string) {
  const response = await api.post("/api/branches", {
    data: {
      name: `POS Branch ${runId}`,
      code: `PB${runId.slice(-6).toUpperCase()}`,
      city: "Riyadh",
    },
  });
  return parseJson(response);
}

export async function createWarehouse(api: APIRequestContext, branchId: string, runId: string) {
  const response = await api.post("/api/warehouses", {
    data: {
      branchId,
      name: `POS Warehouse ${runId}`,
      code: `PW${runId.slice(-6).toUpperCase()}`,
    },
  });
  return parseJson(response);
}

export async function configureRegister(
  api: APIRequestContext,
  input: {
    branchId: string;
    warehouseId: string;
    defaultCashAccountId: string | null;
    defaultBankAccountId: string | null;
  },
) {
  const response = await api.put("/api/pos/register-configs", {
    data: input,
  });
  return parseJson(response);
}

export async function createPosProductAndStock(
  api: APIRequestContext,
  input: {
    runId: string;
    branchId: string;
    warehouseId: string;
    quantity?: number;
    unitCost?: number;
    unitPrice?: number;
  },
) {
  const unitsResponse = await api.get("/api/units");
  const units = await parseJson(unitsResponse);
  const pcsUnit = units.find((unit: JsonValue) => unit.code === "pcs") ?? units[0];
  if (!pcsUnit?.id) {
    throw new Error("No unit available for POS product creation");
  }

  const supplierResponse = await api.post("/api/suppliers", {
    data: {
      name: `POS Supplier ${input.runId}`,
      email: `${input.runId}-pos-supplier@example.com`,
    },
  });
  const supplier = await parseJson(supplierResponse);

  const productResponse = await api.post("/api/products", {
    data: {
      name: `POS Product ${input.runId}`,
      description: `POS clearing test ${input.runId}`,
      price: input.unitPrice ?? 60,
      cost: input.unitCost ?? 30,
      unitId: pcsUnit.id,
      sku: `POS-${input.runId}`,
      gstRate: 0,
      isService: false,
    },
  });
  const product = await parseJson(productResponse);

  const purchaseResponse = await api.post("/api/purchase-invoices", {
    data: {
      supplierId: supplier.id,
      invoiceDate: new Date().toISOString().slice(0, 10),
      dueDate: new Date().toISOString().slice(0, 10),
      branchId: input.branchId,
      warehouseId: input.warehouseId,
      items: [
        {
          productId: product.id,
          description: `Stock ${input.runId}`,
          quantity: input.quantity ?? 10,
          unitCost: input.unitCost ?? 30,
          unitId: pcsUnit.id,
          gstRate: 0,
          discount: 0,
        },
      ],
    },
  });
  await parseJson(purchaseResponse);

  return {
    productId: product.id,
    unitId: pcsUnit.id,
    unitPrice: input.unitPrice ?? 60,
  };
}

export async function openPosSession(
  api: APIRequestContext,
  input: { branchId: string; warehouseId: string; openingCash: number },
) {
  const response = await api.post("/api/pos/sessions", {
    data: input,
  });
  return parseJson(response);
}

export async function posCheckout(
  api: APIRequestContext,
  input: {
    sessionId: string;
    productId: string;
    quantity: number;
    unitPrice: number;
    payments: Array<{ method: string; amount: number; reference?: string }>;
  },
) {
  const response = await api.post("/api/pos/checkout", {
    data: {
      sessionId: input.sessionId,
      items: [
        {
          productId: input.productId,
          name: "POS Test Item",
          quantity: input.quantity,
          unitPrice: input.unitPrice,
          gstRate: 0,
        },
      ],
      payments: input.payments,
    },
  });
  return parseJson(response);
}

export async function closePosSession(
  api: APIRequestContext,
  input: {
    sessionId: string;
    closingCash: number;
    settleCashAccountId?: string | null;
    settleBankAccountId?: string | null;
  },
) {
  const response = await api.put(`/api/pos/sessions/${input.sessionId}/close`, {
    data: {
      closingCash: input.closingCash,
      settleCashAccountId: input.settleCashAccountId ?? null,
      settleBankAccountId: input.settleBankAccountId ?? null,
    },
  });
  return parseJson(response);
}

export async function getSessionSummary(api: APIRequestContext, sessionId: string) {
  const response = await api.get(`/api/pos/sessions/${sessionId}/summary`);
  return parseJson(response);
}

export async function getCashBankBalance(cashBankAccountId: string) {
  const result = await pool.query(
    `select balance from cash_bank_accounts where id = $1`,
    [cashBankAccountId],
  );
  if (!result.rows.length) {
    throw new Error(`Cash bank account ${cashBankAccountId} not found`);
  }
  return Number(result.rows[0].balance);
}

export async function getSessionSnapshot(sessionId: string) {
  const result = await pool.query(
    `select "sessionNumber", status, "openingCash", "closingCash", "expectedCash", "cashDifference", "totalSales", "totalTransactions"
     from pos_sessions
     where id = $1`,
    [sessionId],
  );
  if (!result.rows.length) {
    throw new Error(`POS session ${sessionId} not found`);
  }
  return result.rows[0];
}

export async function getCloseJournalLines(sessionId: string) {
  const result = await pool.query(
    `select je.description as "journalDescription", a.code as "accountCode", a.name as "accountName",
            jel.debit, jel.credit, jel.description as "lineDescription"
     from journal_entries je
     join journal_entry_lines jel on jel."journalEntryId" = je.id
     join accounts a on a.id = jel."accountId"
     where je."sourceType" = 'POS_SESSION_CLOSE' and je."sourceId" = $1
     order by je."createdAt" asc, jel."createdAt" asc`,
    [sessionId],
  );
  return result.rows;
}

export async function getOpenJournalLines(sessionId: string) {
  const result = await pool.query(
    `select je.description as "journalDescription", a.code as "accountCode", jel.debit, jel.credit
     from journal_entries je
     join journal_entry_lines jel on jel."journalEntryId" = je.id
     join accounts a on a.id = jel."accountId"
     where je."sourceType" = 'POS_SESSION_OPEN' and je."sourceId" = $1
     order by jel."createdAt" asc`,
    [sessionId],
  );
  return result.rows;
}

export async function getClearingNetForSession(sessionId: string) {
  const result = await pool.query(
    `with payment_source_ids as (
       select p.id
       from payments p
       join invoices i on i.id = p."invoiceId"
       where i."posSessionId" = $1
     )
     select coalesce(sum(jel.debit - jel.credit), 0) as net
     from journal_entry_lines jel
     join journal_entries je on je.id = jel."journalEntryId"
     join accounts a on a.id = jel."accountId"
     where a.code = '1150'
       and (
         (je."sourceType" in ('POS_SESSION_OPEN', 'POS_SESSION_CLOSE') and je."sourceId" = $1)
         or
         (je."sourceType" = 'PAYMENT' and je."sourceId" in (select id from payment_source_ids))
       )`,
    [sessionId],
  );
  return Number(result.rows[0]?.net ?? 0);
}

export async function getCashBankTransactionsForSession(sessionId: string) {
  const result = await pool.query(
    `select cbt.description, cbt."transactionType", cbt.amount, cba.name as "accountName"
     from cash_bank_transactions cbt
     join cash_bank_accounts cba on cba.id = cbt."cashBankAccountId"
     where cbt."referenceType" = 'POS_SESSION' and cbt."referenceId" = $1
     order by cbt."createdAt" asc`,
    [sessionId],
  );
  return result.rows;
}
