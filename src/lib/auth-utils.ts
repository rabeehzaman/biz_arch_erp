import { Session } from "next-auth";

export function getOrgId(session: Session): string {
  const orgId = session.user.organizationId;
  if (!orgId) throw new Error("No organization context");
  return orgId;
}
