import { Session } from "next-auth";

export function getOrgId(session: Session): string {
  const orgId = session.user.organizationId;
  if (!orgId) throw new Error("No organization context");
  return orgId;
}

export function isGstEnabled(session: Session): boolean {
  return (session.user as { gstEnabled?: boolean }).gstEnabled === true;
}

export function getOrgStateCode(session: Session): string | null {
  return (session.user as { gstStateCode?: string | null }).gstStateCode ?? null;
}

export function isEInvoicingEnabled(session: Session): boolean {
  return (session.user as { eInvoicingEnabled?: boolean }).eInvoicingEnabled === true;
}
