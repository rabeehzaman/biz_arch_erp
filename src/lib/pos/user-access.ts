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
  // Admins and superadmins bypass filtering
  if (role === "admin" || role === "superadmin") {
    return null;
  }

  // Check if the feature is configured (any access records exist for this org)
  const totalRecords = await prismaClient.userWarehouseAccess.count({
    where: { organizationId },
  });

  if (totalRecords === 0) {
    // Feature not configured — no filtering (opt-in)
    return null;
  }

  // Get this user's specific access records
  const userAccess = await prismaClient.userWarehouseAccess.findMany({
    where: { organizationId, userId },
    select: { branchId: true, warehouseId: true },
  });

  return userAccess;
}
