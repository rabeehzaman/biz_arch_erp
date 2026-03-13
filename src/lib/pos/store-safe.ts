// Auto-creates a Store Safe account + POS register config for a new branch or warehouse.
// Called from branch and warehouse creation APIs (clearing-mode-aware setup).

import {
  findPrimaryCashParentAccount,
  getNextChildAccountCode,
} from "@/lib/accounting/account-codes";
import { buildPOSLocationKey } from "./register-config";

type Tx = any;

/**
 * Creates:
 *  1. An Account (ASSET / CASH) for the Store Safe under Assets > Cash
 *  2. A CashBankAccount linked to it
 *  3. A POSRegisterConfig for this location pointing to the Store Safe
 *
 * Safe to call inside a Prisma transaction. Does nothing if the account
 * code already exists (idempotent).
 */
export async function provisionStoreSafe(
  tx: Tx,
  organizationId: string,
  options: {
    branchId?: string | null;
    branchCode: string;
    branchName: string;
    warehouseId?: string | null;
    warehouseCode?: string;
    warehouseName?: string;
  }
): Promise<void> {
  const { branchId, branchCode, branchName, warehouseId, warehouseCode, warehouseName } = options;

  // Legacy SAFE-* codes are still used to detect and repair older auto-created accounts.
  const legacyAccountCode = warehouseCode
    ? `SAFE-${branchCode}-${warehouseCode}`
    : `SAFE-${branchCode}`;

  const accountName = warehouseCode
    ? `Store Safe - ${branchName} (${warehouseName})`
    : `Store Safe - ${branchName}`;

  const locationKey = buildPOSLocationKey(branchId, warehouseId ?? null);
  const cashParentAccount = await findPrimaryCashParentAccount(tx, organizationId);

  const existingConfig = await tx.pOSRegisterConfig.findUnique({
    where: { organizationId_locationKey: { organizationId, locationKey } },
    select: { id: true, defaultCashAccountId: true },
  });

  let managedStoreSafe:
    | {
      id: string;
      accountId: string;
      name: string;
      account: { code: string; parentId: string | null };
    }
    | null = null;

  if (existingConfig?.defaultCashAccountId) {
    const configuredCashAccount = await tx.cashBankAccount.findFirst({
      where: {
        id: existingConfig.defaultCashAccountId,
        organizationId,
        branchId: branchId ?? null,
        accountSubType: "CASH",
      },
      select: {
        id: true,
        accountId: true,
        name: true,
        account: {
          select: {
            code: true,
            parentId: true,
          },
        },
      },
    });

    if (
      configuredCashAccount &&
      (configuredCashAccount.name === accountName ||
        configuredCashAccount.name.startsWith("Store Safe - ") ||
        configuredCashAccount.account.code === legacyAccountCode)
    ) {
      managedStoreSafe = configuredCashAccount;
    }
  }

  if (!managedStoreSafe) {
    managedStoreSafe = await tx.cashBankAccount.findFirst({
      where: {
        organizationId,
        branchId: branchId ?? null,
        accountSubType: "CASH",
        OR: [
          { name: accountName },
          { account: { code: legacyAccountCode } },
        ],
      },
      select: {
        id: true,
        accountId: true,
        name: true,
        account: {
          select: {
            code: true,
            parentId: true,
          },
        },
      },
    });
  }

  let accountId: string;
  if (managedStoreSafe) {
    accountId = managedStoreSafe.accountId;

    const keepCurrentCode =
      managedStoreSafe.account.parentId === cashParentAccount?.id &&
      /^\d+$/.test(managedStoreSafe.account.code);

    const nextCode =
      keepCurrentCode || !cashParentAccount
        ? managedStoreSafe.account.code
        : await getNextChildAccountCode(tx, organizationId, cashParentAccount.id, {
          currentAccountId: managedStoreSafe.accountId,
        });

    await tx.account.update({
      where: { id: managedStoreSafe.accountId },
      data: {
        code: nextCode,
        name: accountName,
        accountType: "ASSET",
        accountSubType: "CASH",
        parentId: cashParentAccount?.id ?? null,
        isSystem: false,
        isActive: true,
      },
    });

    await tx.cashBankAccount.update({
      where: { id: managedStoreSafe.id },
      data: {
        name: accountName,
        branchId: branchId ?? null,
        accountSubType: "CASH",
        isActive: true,
      },
    });
  } else {
    const accountCode = cashParentAccount
      ? await getNextChildAccountCode(tx, organizationId, cashParentAccount.id)
      : legacyAccountCode;

    const account = await tx.account.create({
      data: {
        organizationId,
        code: accountCode,
        name: accountName,
        accountType: "ASSET",
        accountSubType: "CASH",
        parentId: cashParentAccount?.id ?? null,
        isSystem: false,
        isActive: true,
      },
      select: { id: true },
    });
    accountId = account.id;
  }

  // 2. Create the CashBankAccount (skip if already linked to this account)
  const existingCBA = await tx.cashBankAccount.findFirst({
    where: { organizationId, accountId },
    select: { id: true },
  });

  let cashBankAccountId: string;
  if (existingCBA) {
    cashBankAccountId = existingCBA.id;
  } else {
    const cba = await tx.cashBankAccount.create({
      data: {
        organizationId,
        name: accountName,
        accountId,
        accountSubType: "CASH",
        branchId: branchId ?? null,
        balance: 0,
        isActive: true,
      },
      select: { id: true },
    });
    cashBankAccountId = cba.id;
  }

  // 3. Create or backfill the POSRegisterConfig without overwriting manual assignments
  if (!existingConfig) {
    await tx.pOSRegisterConfig.create({
      data: {
        organizationId,
        locationKey,
        branchId: branchId ?? null,
        warehouseId: warehouseId ?? null,
        defaultCashAccountId: cashBankAccountId,
        defaultBankAccountId: null,
      },
    });
    return;
  }

  if (!existingConfig.defaultCashAccountId) {
    await tx.pOSRegisterConfig.update({
      where: { id: existingConfig.id },
      data: { defaultCashAccountId: cashBankAccountId },
    });
  }
}

export async function provisionPOSRegisterSetup(
  tx: Tx,
  organizationId: string
): Promise<void> {
  const branches = await tx.branch.findMany({
    where: { organizationId, isActive: true },
    select: {
      id: true,
      code: true,
      name: true,
      warehouses: {
        where: { isActive: true },
        select: { id: true },
      },
    },
    orderBy: { createdAt: "asc" },
  });

  if (branches.length === 0) {
    await provisionStoreSafe(tx, organizationId, {
      branchId: null,
      branchCode: "MAIN",
      branchName: "Main Register",
    });
    return;
  }

  for (const branch of branches) {
    await provisionStoreSafe(tx, organizationId, {
      branchId: branch.id,
      branchCode: branch.code,
      branchName: branch.name,
    });

    const branchConfig = await tx.pOSRegisterConfig.findUnique({
      where: {
        organizationId_locationKey: {
          organizationId,
          locationKey: buildPOSLocationKey(branch.id, null),
        },
      },
      select: { defaultCashAccountId: true, defaultBankAccountId: true },
    });

    for (const warehouse of branch.warehouses) {
      await tx.pOSRegisterConfig.upsert({
        where: {
          organizationId_locationKey: {
            organizationId,
            locationKey: buildPOSLocationKey(branch.id, warehouse.id),
          },
        },
        create: {
          organizationId,
          locationKey: buildPOSLocationKey(branch.id, warehouse.id),
          branchId: branch.id,
          warehouseId: warehouse.id,
          defaultCashAccountId: branchConfig?.defaultCashAccountId ?? null,
          defaultBankAccountId: branchConfig?.defaultBankAccountId ?? null,
        },
        update: {},
      });
    }
  }
}
