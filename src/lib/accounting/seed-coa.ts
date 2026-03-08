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
    findFirst: (args: {
      where: { accountId?: string; organizationId?: string; name?: string };
      select?: { id: true };
    }) => Promise<{ id: string } | null>;
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
  { code: "1400", name: "Inventory (المخزون)", accountType: "ASSET", accountSubType: "INVENTORY", parentCode: "1000", isSystem: true },
  { code: "1500", name: "Fixed Assets (الأصول الثابتة)", accountType: "ASSET", accountSubType: "FIXED_ASSET", parentCode: "1000", isSystem: false },

  // LIABILITIES
  { code: "2000", name: "Liabilities (الالتزامات)", accountType: "LIABILITY", accountSubType: "CURRENT_LIABILITY", isSystem: true },
  { code: "2100", name: "Accounts Payable (حسابات الدائنين)", accountType: "LIABILITY", accountSubType: "ACCOUNTS_PAYABLE", parentCode: "2000", isSystem: true },
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

// ─── GST Accounts ──────────────────────────────────────────────────────────
// Call this when gstEnabled is toggled ON for an org (India GST: CGST/SGST/IGST)

const GST_ACCOUNTS: AccountDef[] = [
  { code: "1350", name: "CGST Input", accountType: "ASSET", accountSubType: "CURRENT_ASSET", parentCode: "1000", isSystem: false },
  { code: "1360", name: "SGST Input", accountType: "ASSET", accountSubType: "CURRENT_ASSET", parentCode: "1000", isSystem: false },
  { code: "1370", name: "IGST Input", accountType: "ASSET", accountSubType: "CURRENT_ASSET", parentCode: "1000", isSystem: false },
  { code: "2210", name: "CGST Output", accountType: "LIABILITY", accountSubType: "CURRENT_LIABILITY", parentCode: "2000", isSystem: false },
  { code: "2220", name: "SGST Output", accountType: "LIABILITY", accountSubType: "CURRENT_LIABILITY", parentCode: "2000", isSystem: false },
  { code: "2230", name: "IGST Output", accountType: "LIABILITY", accountSubType: "CURRENT_LIABILITY", parentCode: "2000", isSystem: false },
];

export async function seedGSTAccounts(
  tx: PrismaTransactionClient,
  organizationId: string
) {
  const sorted = [...GST_ACCOUNTS].sort((a, b) => a.code.localeCompare(b.code));

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

// ─── Saudi Standard Chart of Accounts (SOCPA/IFRS) ─────────────────────────
// Full SOCPA-aligned COA for Saudi ZATCA orgs: fixed assets, GOSI, EOS,
// zakat, government fees, payroll allowances, etc.

const SAUDI_STANDARD_ACCOUNTS: AccountDef[] = [
  // Assets (parent: 1000)
  { code: "1310", name: "Notes Receivable (أوراق القبض)", accountType: "ASSET", accountSubType: "CURRENT_ASSET", parentCode: "1000", isSystem: false },
  { code: "1320", name: "Allowance for Doubtful Accounts (مخصص الديون المشكوك في تحصيلها)", accountType: "ASSET", accountSubType: "CURRENT_ASSET", parentCode: "1000", isSystem: false },
  { code: "1390", name: "Prepaid Expenses (مصروفات مدفوعة مقدماً)", accountType: "ASSET", accountSubType: "CURRENT_ASSET", parentCode: "1000", isSystem: false },
  { code: "1410", name: "Goods in Transit (بضاعة في الطريق)", accountType: "ASSET", accountSubType: "CURRENT_ASSET", parentCode: "1000", isSystem: false },
  { code: "1450", name: "Other Current Assets (أصول متداولة أخرى)", accountType: "ASSET", accountSubType: "OTHER_ASSET", parentCode: "1000", isSystem: false },

  // Fixed Assets (parent: 1500)
  { code: "1510", name: "Furniture and Fixtures (الأثاث والتجهيزات)", accountType: "ASSET", accountSubType: "FIXED_ASSET", parentCode: "1500", isSystem: false },
  { code: "1520", name: "Vehicles (المركبات)", accountType: "ASSET", accountSubType: "FIXED_ASSET", parentCode: "1500", isSystem: false },
  { code: "1530", name: "Equipment (المعدات)", accountType: "ASSET", accountSubType: "FIXED_ASSET", parentCode: "1500", isSystem: false },
  { code: "1540", name: "Leasehold Improvements (تحسينات المباني المستأجرة)", accountType: "ASSET", accountSubType: "FIXED_ASSET", parentCode: "1500", isSystem: false },
  { code: "1590", name: "Accumulated Depreciation (مجمع الاستهلاك)", accountType: "ASSET", accountSubType: "FIXED_ASSET", parentCode: "1500", isSystem: false },

  // Liabilities (parent: 2000)
  { code: "2110", name: "Notes Payable (أوراق الدفع)", accountType: "LIABILITY", accountSubType: "CURRENT_LIABILITY", parentCode: "2000", isSystem: false },
  { code: "2250", name: "Accrued Expenses (مصروفات مستحقة)", accountType: "LIABILITY", accountSubType: "CURRENT_LIABILITY", parentCode: "2000", isSystem: false },
  { code: "2260", name: "GOSI Payable (التأمينات الاجتماعية المستحقة)", accountType: "LIABILITY", accountSubType: "CURRENT_LIABILITY", parentCode: "2000", isSystem: false },
  { code: "2270", name: "Withholding Tax Payable (ضريبة الاستقطاع المستحقة)", accountType: "LIABILITY", accountSubType: "CURRENT_LIABILITY", parentCode: "2000", isSystem: false },
  { code: "2280", name: "Zakat Payable (الزكاة المستحقة)", accountType: "LIABILITY", accountSubType: "CURRENT_LIABILITY", parentCode: "2000", isSystem: false },
  { code: "2290", name: "Employee Payables (مستحقات الموظفين)", accountType: "LIABILITY", accountSubType: "CURRENT_LIABILITY", parentCode: "2000", isSystem: false },
  { code: "2300", name: "Advance Revenue (إيرادات مقدمة)", accountType: "LIABILITY", accountSubType: "CURRENT_LIABILITY", parentCode: "2000", isSystem: false },

  // Long-Term Liabilities (parent: 2500)
  { code: "2510", name: "End of Service Benefits (مكافأة نهاية الخدمة)", accountType: "LIABILITY", accountSubType: "LONG_TERM_LIABILITY", parentCode: "2500", isSystem: false },
  { code: "2520", name: "Long-Term Loans (قروض طويلة الأجل)", accountType: "LIABILITY", accountSubType: "LONG_TERM_LIABILITY", parentCode: "2500", isSystem: false },

  // Equity (parent: 3000)
  { code: "3150", name: "Statutory Reserve (الاحتياطي النظامي)", accountType: "EQUITY", accountSubType: "OTHER_EQUITY", parentCode: "3000", isSystem: false },
  { code: "3300", name: "Owner's Drawings (المسحوبات الشخصية)", accountType: "EQUITY", accountSubType: "OTHER_EQUITY", parentCode: "3000", isSystem: false },

  // Revenue (parent: 4000)
  { code: "4300", name: "Sales Returns and Allowances (مردودات ومسموحات المبيعات)", accountType: "REVENUE", accountSubType: "OTHER_REVENUE", parentCode: "4000", isSystem: false },

  // Operating Expenses (parent: 5200)
  { code: "5270", name: "Maintenance and Repairs (الصيانة والإصلاح)", accountType: "EXPENSE", accountSubType: "OPERATING_EXPENSE", parentCode: "5200", isSystem: false },
  { code: "5280", name: "Communication Expenses (مصروفات الاتصالات)", accountType: "EXPENSE", accountSubType: "OPERATING_EXPENSE", parentCode: "5200", isSystem: false },
  { code: "5290", name: "Professional Fees (أتعاب مهنية)", accountType: "EXPENSE", accountSubType: "OPERATING_EXPENSE", parentCode: "5200", isSystem: false },

  // Payroll Expenses (parent: 5300)
  { code: "5310", name: "GOSI Contribution (اشتراك التأمينات الاجتماعية)", accountType: "EXPENSE", accountSubType: "PAYROLL_EXPENSE", parentCode: "5300", isSystem: false },
  { code: "5320", name: "End of Service Benefit Expense (مصروف مكافأة نهاية الخدمة)", accountType: "EXPENSE", accountSubType: "PAYROLL_EXPENSE", parentCode: "5300", isSystem: false },
  { code: "5330", name: "Employee Benefits (مزايا الموظفين)", accountType: "EXPENSE", accountSubType: "PAYROLL_EXPENSE", parentCode: "5300", isSystem: false },
  { code: "5340", name: "Medical Insurance (التأمين الطبي)", accountType: "EXPENSE", accountSubType: "PAYROLL_EXPENSE", parentCode: "5300", isSystem: false },
  { code: "5350", name: "Housing Allowance (بدل السكن)", accountType: "EXPENSE", accountSubType: "PAYROLL_EXPENSE", parentCode: "5300", isSystem: false },
  { code: "5360", name: "Transportation Allowance (بدل المواصلات)", accountType: "EXPENSE", accountSubType: "PAYROLL_EXPENSE", parentCode: "5300", isSystem: false },

  // Government Fees & Zakat (parent: 5000, with 5700 as sub-parent)
  { code: "5700", name: "Government Fees (الرسوم الحكومية)", accountType: "EXPENSE", accountSubType: "OPERATING_EXPENSE", parentCode: "5000", isSystem: false },
  { code: "5710", name: "Iqama Fees (رسوم الإقامة)", accountType: "EXPENSE", accountSubType: "OPERATING_EXPENSE", parentCode: "5700", isSystem: false },
  { code: "5720", name: "Municipality Fees (رسوم البلدية)", accountType: "EXPENSE", accountSubType: "OPERATING_EXPENSE", parentCode: "5700", isSystem: false },
  { code: "5730", name: "Chamber of Commerce Fees (رسوم الغرفة التجارية)", accountType: "EXPENSE", accountSubType: "OPERATING_EXPENSE", parentCode: "5700", isSystem: false },
  { code: "5800", name: "Zakat Expense (مصروف الزكاة)", accountType: "EXPENSE", accountSubType: "OTHER_EXPENSE", parentCode: "5000", isSystem: false },
  { code: "5810", name: "Income Tax Expense (مصروف ضريبة الدخل)", accountType: "EXPENSE", accountSubType: "OTHER_EXPENSE", parentCode: "5000", isSystem: false },
];

export async function seedSaudiStandardAccounts(
  tx: PrismaTransactionClient,
  organizationId: string
) {
  // Sort so parents (e.g. 5700) come before children (5710/5720/5730)
  const sorted = [...SAUDI_STANDARD_ACCOUNTS].sort((a, b) => a.code.localeCompare(b.code));
  const accountMap = new Map<string, string>(); // code -> id (for new parents like 5700)

  for (const acct of sorted) {
    // Find parent: check local map first (for new parents like 5700), then DB
    let parentId: string | null = null;
    if (acct.parentCode) {
      if (accountMap.has(acct.parentCode)) {
        parentId = accountMap.get(acct.parentCode)!;
      } else {
        const parent = await tx.account.findFirst({ where: { organizationId, code: acct.parentCode } });
        parentId = parent?.id ?? null;
      }
    }

    const created = await tx.account.upsert({
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

    accountMap.set(acct.code, created.id);
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
    const existingCashAccount = await tx.cashBankAccount.findFirst({
      where: { accountId: cashAccountId },
      select: { id: true },
    });

    if (!existingCashAccount) {
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
  }

  // Create default Bank account (linked to COA 1200)
  const bankAccountId = accountMap.get("1200");
  if (bankAccountId) {
    const existingBankAccount = await tx.cashBankAccount.findFirst({
      where: { accountId: bankAccountId },
      select: { id: true },
    });

    if (!existingBankAccount) {
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
  }

  return accountMap;
}
