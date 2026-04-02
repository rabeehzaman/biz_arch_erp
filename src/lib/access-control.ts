import prisma from "@/lib/prisma";

export function isAdminRole(role: string): boolean {
  return role === "admin" || role === "superadmin";
}

/**
 * Check if a non-admin user can access a specific customer
 * via the CustomerAssignment table. Admins always pass.
 */
export async function canAccessCustomer(
  customerId: string,
  organizationId: string,
  userId: string,
  isAdmin: boolean
): Promise<boolean> {
  if (isAdmin) return true;

  const assignment = await prisma.customerAssignment.findFirst({
    where: { customerId, userId, organizationId },
    select: { id: true },
  });

  return !!assignment;
}
