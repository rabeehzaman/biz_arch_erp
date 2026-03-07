// Default Chart of Accounts seed function
// Can be called from seed.ts and from org creation API

type PrismaTransactionClient = {
  account: {
    upsert: (args: {
      where: { organizationId_code: { organizationId: string; code: string } };
      update: Record<string, unknown>;
      create: Record<string, unknown>;
    }) => Promise<{ id: string; code: string }>;
    findFirst: (args: {
      where: { organizationId: string; code: string };
    }) => Promise<{ id: string } | null>;
  };
  cashBankAccount: {
    upsert: (args: {
      where: { organizationId_name: { organizationId: string; name: string } };
      update: Record<string, unknown>;
      create: Record<string, unknown>;
    }) => Promise<unknown>;
  };
};

interface AccountDef {
  code: string;
  name: string;
  accountType: string;
  accountSubType: string;
  parentCode?: string;
  isSystem: boolean;
}

const DEFAULT_ACCOUNTS: AccountDef[] = [
  // ASSETS
  { code: "1000", name: "Assets (الأصول)", accountType: "ASSET", accountSubType: "CURRENT_ASSET", isSystem: true },
  { code: "1100", name: "Cash (النقدية)", accountType: "ASSET", accountSubType: "CASH", parentCode: "1000", isSystem: true },
  { code: "1200", name: "Bank Accounts (حسابات البنوك)", accountType: "ASSET", accountSubType: "BANK", parentCode: "1000", isSystem: true },
  { code: "1300", name: "Accounts Receivable (حسابات المدينين)", accountType: "ASSET", accountSubType: "ACCOUNTS_RECEIVABLE", parentCode: "1000", isSystem: true },
  { code: "1350", name: "CGST Input", accountType: "ASSET", accountSubType: "CURRENT_ASSET", parentCode: "1000", isSystem: false },
  { code: "1360", name: "SGST Input", accountType: "ASSET", accountSubType: "CURRENT_ASSET", parentCode: "1000", isSystem: false },
  { code: "1370", name: "IGST Input", accountType: "ASSET", accountSubType: "CURRENT_ASSET", parentCode: "1000", isSystem: false },
  { code: "1400", name: "Inventory (المخزون)", accountType: "ASSET", accountSubType: "INVENTORY", parentCode: "1000", isSystem: true },
  { code: "1500", name: "Fixed Assets (الأصول الثابتة)", accountType: "ASSET", accountSubType: "FIXED_ASSET", parentCode: "1000", isSystem: false },

  // LIABILITIES
  { code: "2000", name: "Liabilities (الالتزامات)", accountType: "LIABILITY", accountSubType: "CURRENT_LIABILITY", isSystem: true },
  { code: "2100", name: "Accounts Payable (حسابات الدائنين)", accountType: "LIABILITY", accountSubType: "ACCOUNTS_PAYABLE", parentCode: "2000", isSystem: true },
  { code: "2210", name: "CGST Output", accountType: "LIABILITY", accountSubType: "CURRENT_LIABILITY", parentCode: "2000", isSystem: false },
  { code: "2220", name: "SGST Output", accountType: "LIABILITY", accountSubType: "CURRENT_LIABILITY", parentCode: "2000", isSystem: false },
  { code: "2230", name: "IGST Output", accountType: "LIABILITY", accountSubType: "CURRENT_LIABILITY", parentCode: "2000", isSystem: false },
  { code: "2500", name: "Long-Term Liabilities (الالتزامات طويلة الأجل)", accountType: "LIABILITY", accountSubType: "LONG_TERM_LIABILITY", parentCode: "2000", isSystem: false },

  // EQUITY
  { code: "3000", name: "Equity (حقوق الملكية)", accountType: "EQUITY", accountSubType: "OWNERS_EQUITY", isSystem: true },
  { code: "3100", name: "Owner's Capital (رأس مال المالك)", accountType: "EQUITY", accountSubType: "OWNERS_EQUITY", parentCode: "3000", isSystem: false },
  { code: "3200", name: "Retained Earnings (الأرباح المبقاة)", accountType: "EQUITY", accountSubType: "RETAINED_EARNINGS", parentCode: "3000", isSystem: true },

  // REVENUE
  { code: "4000", name: "Revenue (الإيرادات)", accountType: "REVENUE", accountSubType: "SALES_REVENUE", isSystem: true },
  { code: "4100", name: "Sales Revenue (إيرادات المبيعات)", accountType: "REVENUE", accountSubType: "SALES_REVENUE", parentCode: "4000", isSystem: true },
  // Sales Discounts is a contra-revenue account (debit-normal). In journal entries, DEBIT this account to record discounts given.
  { code: "4200", name: "Sales Discounts (خصومات المبيعات)", accountType: "REVENUE", accountSubType: "OTHER_REVENUE", parentCode: "4000", isSystem: false },
  { code: "4900", name: "Other Revenue (إيرادات أخرى)", accountType: "REVENUE", accountSubType: "OTHER_REVENUE", parentCode: "4000", isSystem: false },

  // EXPENSES
  { code: "5000", name: "Expenses (المصروفات)", accountType: "EXPENSE", accountSubType: "OPERATING_EXPENSE", isSystem: true },
  { code: "5100", name: "Cost of Goods Sold (تكلفة البضاعة المباعة)", accountType: "EXPENSE", accountSubType: "COST_OF_GOODS_SOLD", parentCode: "5000", isSystem: true },
  { code: "5200", name: "Operating Expenses (المصروفات التشغيلية)", accountType: "EXPENSE", accountSubType: "OPERATING_EXPENSE", parentCode: "5000", isSystem: false },
  { code: "5210", name: "Rent (الإيجار)", accountType: "EXPENSE", accountSubType: "OPERATING_EXPENSE", parentCode: "5200", isSystem: false },
  { code: "5220", name: "Utilities (الخدمات والمنافع)", accountType: "EXPENSE", accountSubType: "OPERATING_EXPENSE", parentCode: "5200", isSystem: false },
  { code: "5230", name: "Office Supplies (الأدوات المكتبية)", accountType: "EXPENSE", accountSubType: "OPERATING_EXPENSE", parentCode: "5200", isSystem: false },
  { code: "5240", name: "Insurance (التأمين)", accountType: "EXPENSE", accountSubType: "OPERATING_EXPENSE", parentCode: "5200", isSystem: false },
  { code: "5250", name: "Marketing (التسويق)", accountType: "EXPENSE", accountSubType: "OPERATING_EXPENSE", parentCode: "5200", isSystem: false },
  { code: "5260", name: "Travel (السفر)", accountType: "EXPENSE", accountSubType: "OPERATING_EXPENSE", parentCode: "5200", isSystem: false },
  { code: "5300", name: "Payroll (الرواتب والأجور)", accountType: "EXPENSE", accountSubType: "PAYROLL_EXPENSE", parentCode: "5000", isSystem: false },
  { code: "5400", name: "Depreciation (الاستهلاك)", accountType: "EXPENSE", accountSubType: "OPERATING_EXPENSE", parentCode: "5000", isSystem: false },
  { code: "5500", name: "Bank Charges (الرسوم البنكية)", accountType: "EXPENSE", accountSubType: "OPERATING_EXPENSE", parentCode: "5000", isSystem: false },
  // Purchase Discounts is a contra-expense account (credit-normal). In journal entries, CREDIT this account to record discounts received.
  { code: "5600", name: "Purchase Discounts (خصومات المشتريات)", accountType: "EXPENSE", accountSubType: "OTHER_EXPENSE", parentCode: "5000", isSystem: false },
  { code: "5900", name: "Other Expenses (مصروفات أخرى)", accountType: "EXPENSE", accountSubType: "OTHER_EXPENSE", parentCode: "5000", isSystem: false },
];

export async function seedDefaultCOA(
  tx: PrismaTransactionClient,
  organizationId: string
) {
  // First pass: create all accounts without parent references
  const accountMap = new Map<string, string>(); // code -> id

  // Sort so parents come before children
  const sorted = [...DEFAULT_ACCOUNTS].sort((a, b) => a.code.localeCompare(b.code));

  for (const acct of sorted) {
    const parentId = acct.parentCode ? accountMap.get(acct.parentCode) : null;

    const created = await tx.account.upsert({
      where: {
        organizationId_code: { organizationId, code: acct.code },
      },
      update: {},
      create: {
        code: acct.code,
        name: acct.name,
        accountType: acct.accountType,
        accountSubType: acct.accountSubType,
        parentId: parentId || null,
        isSystem: acct.isSystem,
        organizationId,
      },
    });

    accountMap.set(acct.code, created.id);
  }

  await _createCashBankAccounts(tx, organizationId, accountMap);

  return accountMap;
}

// ─── Saudi VAT Accounts ────────────────────────────────────────────────────
// Call this when saudiEInvoiceEnabled is toggled ON for an org

const SAUDI_VAT_ACCOUNTS: AccountDef[] = [
  { code: "1380", name: "VAT Input (ضريبة القيمة المضافة - مدخلات)", accountType: "ASSET", accountSubType: "CURRENT_ASSET", parentCode: "1000", isSystem: false },
  { code: "2240", name: "VAT Output (ضريبة القيمة المضافة - مخرجات)", accountType: "LIABILITY", accountSubType: "CURRENT_LIABILITY", parentCode: "2000", isSystem: false },
];

export async function seedSaudiVATAccounts(
  tx: PrismaTransactionClient,
  organizationId: string
) {
  const sorted = [...SAUDI_VAT_ACCOUNTS].sort((a, b) => a.code.localeCompare(b.code));

  for (const acct of sorted) {
    // Find parent account id
    let parentId: string | null = null;
    if (acct.parentCode) {
      const parent = await tx.account.findFirst({ where: { organizationId, code: acct.parentCode } });
      parentId = parent?.id ?? null;
    }

    await tx.account.upsert({
      where: { organizationId_code: { organizationId, code: acct.code } },
      update: {},
      create: {
        code: acct.code,
        name: acct.name,
        accountType: acct.accountType,
        accountSubType: acct.accountSubType,
        parentId,
        isSystem: acct.isSystem,
        organizationId,
      },
    });
  }
}

// ─── POS Clearing Accounts ─────────────────────────────────────────────────
// Call this when posAccountingMode is set to CLEARING_ACCOUNT for an org

const POS_CLEARING_ACCOUNTS: AccountDef[] = [
  { code: "1150", name: "POS Undeposited Funds (أموال نقاط البيع غير المودعة)", accountType: "ASSET", accountSubType: "CURRENT_ASSET", parentCode: "1000", isSystem: true },
  { code: "6150", name: "Cash Short and Over (العجز والزيادة في النقدية)", accountType: "EXPENSE", accountSubType: "OTHER_EXPENSE", parentCode: "5000", isSystem: true },
];

export async function seedPOSClearingAccounts(
  tx: PrismaTransactionClient,
  organizationId: string
) {
  const sorted = [...POS_CLEARING_ACCOUNTS].sort((a, b) => a.code.localeCompare(b.code));

  for (const acct of sorted) {
    let parentId: string | null = null;
    if (acct.parentCode) {
      const parent = await tx.account.findFirst({ where: { organizationId, code: acct.parentCode } });
      parentId = parent?.id ?? null;
    }

    await tx.account.upsert({
      where: { organizationId_code: { organizationId, code: acct.code } },
      update: {},
      create: {
        code: acct.code,
        name: acct.name,
        accountType: acct.accountType,
        accountSubType: acct.accountSubType,
        parentId,
        isSystem: acct.isSystem,
        organizationId,
      },
    });
  }
}

// ─── Original seedDefaultCOA continues below ───────────────────────────────
// (split to reuse the seedSaudiVATAccounts separately)

async function _createCashBankAccounts(
  tx: PrismaTransactionClient,
  organizationId: string,
  accountMap: Map<string, string>
) {
  // Create default Cash account (linked to COA 1100)
  const cashAccountId = accountMap.get("1100");
  if (cashAccountId) {
    await tx.cashBankAccount.upsert({
      where: {
        organizationId_name: { organizationId, name: "Cash (النقدية)" },
      },
      update: {},
      create: {
        name: "Cash (النقدية)",
        accountId: cashAccountId,
        accountSubType: "CASH",
        isDefault: true,
        organizationId,
      },
    });
  }

  // Create default Bank account (linked to COA 1200)
  const bankAccountId = accountMap.get("1200");
  if (bankAccountId) {
    await tx.cashBankAccount.upsert({
      where: {
        organizationId_name: { organizationId, name: "Bank Account (حساب البنك)" },
      },
      update: {},
      create: {
        name: "Bank Account (حساب البنك)",
        accountId: bankAccountId,
        accountSubType: "BANK",
        isDefault: false,
        organizationId,
      },
    });
  }

  return accountMap;
}
