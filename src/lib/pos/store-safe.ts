// Auto-creates a Store Safe account + POS register config for a new branch or warehouse.
// Called from branch and warehouse creation APIs (clearing-mode-aware setup).

import { buildPOSLocationKey } from "./register-config";

type Tx = any;

/**
 * Creates:
 *  1. An Account (ASSET / CASH) for the Store Safe
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
    branchId: string;
    branchCode: string;
    branchName: string;
    warehouseId?: string;
    warehouseCode?: string;
    warehouseName?: string;
  }
): Promise<void> {
  const { branchId, branchCode, branchName, warehouseId, warehouseCode, warehouseName } = options;

  // Build unique identifiers for this location
  const accountCode = warehouseCode
    ? `SAFE-${branchCode}-${warehouseCode}`
    : `SAFE-${branchCode}`;

  const accountName = warehouseCode
    ? `Store Safe - ${branchName} (${warehouseName})`
    : `Store Safe - ${branchName}`;

  const locationKey = buildPOSLocationKey(branchId, warehouseId ?? null);

  // 1. Create the Account (skip if already exists — idempotent)
  const existing = await tx.account.findFirst({
    where: { organizationId, code: accountCode },
    select: { id: true },
  });

  let accountId: string;
  if (existing) {
    accountId = existing.id;
  } else {
    const account = await tx.account.create({
      data: {
        organizationId,
        code: accountCode,
        name: accountName,
        accountType: "ASSET",
        accountSubType: "CASH",
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
        branchId,
        balance: 0,
        isActive: true,
      },
      select: { id: true },
    });
    cashBankAccountId = cba.id;
  }

  // 3. Upsert POSRegisterConfig to assign the Store Safe as the default cash account
  await tx.pOSRegisterConfig.upsert({
    where: { organizationId_locationKey: { organizationId, locationKey } },
    create: {
      organizationId,
      locationKey,
      branchId,
      warehouseId: warehouseId ?? null,
      defaultCashAccountId: cashBankAccountId,
      defaultBankAccountId: null,
    },
    update: {
      // Only set the cash account if not already customised (don't overwrite manual assignments)
      defaultCashAccountId: cashBankAccountId,
    },
  });
}
