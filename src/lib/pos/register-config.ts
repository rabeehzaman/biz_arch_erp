// Shared helpers for identifying a POS register by its branch/warehouse location.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type Tx = any;

export function buildPOSLocationKey(
  branchId?: string | null,
  warehouseId?: string | null
): string {
  return `${branchId ?? "null"}::${warehouseId ?? "null"}`;
}

export async function getPOSRegisterConfig(
  tx: Tx,
  organizationId: string,
  branchId?: string | null,
  warehouseId?: string | null
): Promise<{
  id: string;
  defaultCashAccountId: string | null;
  defaultBankAccountId: string | null;
} | null> {
  return tx.pOSRegisterConfig.findUnique({
    where: {
      organizationId_locationKey: {
        organizationId,
        locationKey: buildPOSLocationKey(branchId, warehouseId),
      },
    },
    select: {
      id: true,
      defaultCashAccountId: true,
      defaultBankAccountId: true,
    },
  });
}
