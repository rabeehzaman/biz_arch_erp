import { isAdminRole } from "@/lib/access-control";

/**
 * Helper to determine which POS locations a user can access.
 * Returns null when no filtering should be applied (admin/superadmin or feature not configured).
 * Returns an array of allowed { branchId, warehouseId } pairs for normal users.
 */
export async function getUserAllowedLocations(
  prismaClient: any,
  organizationId: string,
  userId: string,
  role: string
): Promise<{ branchId: string; warehouseId: string }[] | null> {
  if (isAdminRole(role)) return null;

  const totalRecords = await prismaClient.userWarehouseAccess.count({
    where: { organizationId },
  });

  if (totalRecords === 0) return null;

  const userAccess = await prismaClient.userWarehouseAccess.findMany({
    where: { organizationId, userId },
    select: { branchId: true, warehouseId: true },
  });

  return userAccess;
}

/**
 * Returns deduplicated branch IDs the user can access.
 * Returns null for admins or when the feature is not configured (0 records in org).
 */
export async function getUserAllowedBranchIds(
  prismaClient: any,
  organizationId: string,
  userId: string,
  role: string
): Promise<string[] | null> {
  if (isAdminRole(role)) return null;

  const totalRecords = await prismaClient.userWarehouseAccess.count({
    where: { organizationId },
  });

  if (totalRecords === 0) return null;

  const userAccess = await prismaClient.userWarehouseAccess.findMany({
    where: { organizationId, userId },
    select: { branchId: true },
  });

  return [...new Set(userAccess.map((a: { branchId: string }) => a.branchId))] as string[];
}

/**
 * Builds a Prisma where fragment for branch filtering.
 * Returns {} when no filtering needed, { branchId: { in: [...] } } otherwise.
 */
export function buildBranchWhereClause(
  allowedBranchIds: string[] | null,
  options?: { includeNullBranch?: boolean }
): Record<string, unknown> {
  if (allowedBranchIds === null) return {};
  if (allowedBranchIds.length === 0) return { branchId: "__NONE__" };

  if (options?.includeNullBranch) {
    return {
      OR: [{ branchId: { in: allowedBranchIds } }, { branchId: null }],
    };
  }
  return { branchId: { in: allowedBranchIds } };
}

/**
 * Returns cash/bank account IDs the user can access.
 * Returns null for admins or when the feature is not configured (0 records in org).
 */
export async function getUserAllowedCashBankAccountIds(
  prismaClient: any,
  organizationId: string,
  userId: string,
  role: string
): Promise<string[] | null> {
  if (isAdminRole(role)) return null;

  const totalRecords = await prismaClient.userCashBankAccess.count({
    where: { organizationId },
  });

  if (totalRecords === 0) return null;

  const userAccess = await prismaClient.userCashBankAccess.findMany({
    where: { organizationId, userId },
    select: { cashBankAccountId: true },
  });

  return userAccess.map((a: { cashBankAccountId: string }) => a.cashBankAccountId);
}

/**
 * Builds a Prisma where fragment for cash/bank account filtering.
 * Returns {} when no filtering needed, { id: { in: [...] } } otherwise.
 */
export function buildCashBankAccessWhereClause(
  allowedAccountIds: string[] | null
): Record<string, unknown> {
  if (allowedAccountIds === null) return {};
  if (allowedAccountIds.length === 0) return { id: "__NONE__" };
  return { id: { in: allowedAccountIds } };
}
