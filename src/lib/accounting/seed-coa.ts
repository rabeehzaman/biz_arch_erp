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
  { code: "1000", name: "Assets", accountType: "ASSET", accountSubType: "CURRENT_ASSET", isSystem: true },
  { code: "1100", name: "Cash", accountType: "ASSET", accountSubType: "CASH", parentCode: "1000", isSystem: true },
  { code: "1200", name: "Bank Accounts", accountType: "ASSET", accountSubType: "BANK", parentCode: "1000", isSystem: true },
  { code: "1300", name: "Accounts Receivable", accountType: "ASSET", accountSubType: "ACCOUNTS_RECEIVABLE", parentCode: "1000", isSystem: true },
  { code: "1400", name: "Inventory", accountType: "ASSET", accountSubType: "INVENTORY", parentCode: "1000", isSystem: true },
  { code: "1500", name: "Fixed Assets", accountType: "ASSET", accountSubType: "FIXED_ASSET", parentCode: "1000", isSystem: false },

  // LIABILITIES
  { code: "2000", name: "Liabilities", accountType: "LIABILITY", accountSubType: "CURRENT_LIABILITY", isSystem: true },
  { code: "2100", name: "Accounts Payable", accountType: "LIABILITY", accountSubType: "ACCOUNTS_PAYABLE", parentCode: "2000", isSystem: true },
  { code: "2200", name: "Taxes Payable", accountType: "LIABILITY", accountSubType: "CURRENT_LIABILITY", parentCode: "2000", isSystem: false },
  { code: "2500", name: "Long-Term Liabilities", accountType: "LIABILITY", accountSubType: "LONG_TERM_LIABILITY", parentCode: "2000", isSystem: false },

  // EQUITY
  { code: "3000", name: "Equity", accountType: "EQUITY", accountSubType: "OWNERS_EQUITY", isSystem: true },
  { code: "3100", name: "Owner's Capital", accountType: "EQUITY", accountSubType: "OWNERS_EQUITY", parentCode: "3000", isSystem: false },
  { code: "3200", name: "Retained Earnings", accountType: "EQUITY", accountSubType: "RETAINED_EARNINGS", parentCode: "3000", isSystem: true },

  // REVENUE
  { code: "4000", name: "Revenue", accountType: "REVENUE", accountSubType: "SALES_REVENUE", isSystem: true },
  { code: "4100", name: "Sales Revenue", accountType: "REVENUE", accountSubType: "SALES_REVENUE", parentCode: "4000", isSystem: true },
  { code: "4200", name: "Sales Discounts", accountType: "REVENUE", accountSubType: "SALES_REVENUE", parentCode: "4000", isSystem: false },
  { code: "4900", name: "Other Revenue", accountType: "REVENUE", accountSubType: "OTHER_REVENUE", parentCode: "4000", isSystem: false },

  // EXPENSES
  { code: "5000", name: "Expenses", accountType: "EXPENSE", accountSubType: "OPERATING_EXPENSE", isSystem: true },
  { code: "5100", name: "Cost of Goods Sold", accountType: "EXPENSE", accountSubType: "COST_OF_GOODS_SOLD", parentCode: "5000", isSystem: true },
  { code: "5200", name: "Operating Expenses", accountType: "EXPENSE", accountSubType: "OPERATING_EXPENSE", parentCode: "5000", isSystem: false },
  { code: "5210", name: "Rent", accountType: "EXPENSE", accountSubType: "OPERATING_EXPENSE", parentCode: "5200", isSystem: false },
  { code: "5220", name: "Utilities", accountType: "EXPENSE", accountSubType: "OPERATING_EXPENSE", parentCode: "5200", isSystem: false },
  { code: "5230", name: "Office Supplies", accountType: "EXPENSE", accountSubType: "OPERATING_EXPENSE", parentCode: "5200", isSystem: false },
  { code: "5240", name: "Insurance", accountType: "EXPENSE", accountSubType: "OPERATING_EXPENSE", parentCode: "5200", isSystem: false },
  { code: "5250", name: "Marketing", accountType: "EXPENSE", accountSubType: "OPERATING_EXPENSE", parentCode: "5200", isSystem: false },
  { code: "5260", name: "Travel", accountType: "EXPENSE", accountSubType: "OPERATING_EXPENSE", parentCode: "5200", isSystem: false },
  { code: "5300", name: "Payroll", accountType: "EXPENSE", accountSubType: "PAYROLL_EXPENSE", parentCode: "5000", isSystem: false },
  { code: "5400", name: "Depreciation", accountType: "EXPENSE", accountSubType: "OPERATING_EXPENSE", parentCode: "5000", isSystem: false },
  { code: "5500", name: "Bank Charges", accountType: "EXPENSE", accountSubType: "OPERATING_EXPENSE", parentCode: "5000", isSystem: false },
  { code: "5600", name: "Purchase Discounts", accountType: "EXPENSE", accountSubType: "OPERATING_EXPENSE", parentCode: "5000", isSystem: false },
  { code: "5900", name: "Other Expenses", accountType: "EXPENSE", accountSubType: "OTHER_EXPENSE", parentCode: "5000", isSystem: false },
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

  // Create default Cash account (linked to COA 1100)
  const cashAccountId = accountMap.get("1100");
  if (cashAccountId) {
    await tx.cashBankAccount.upsert({
      where: {
        organizationId_name: { organizationId, name: "Cash" },
      },
      update: {},
      create: {
        name: "Cash",
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
        organizationId_name: { organizationId, name: "Bank Account" },
      },
      update: {},
      create: {
        name: "Bank Account",
        accountId: bankAccountId,
        accountSubType: "BANK",
        isDefault: false,
        organizationId,
      },
    });
  }

  return accountMap;
}
