import { Session } from "next-auth";
import { getEditionConfig as getEditionConfigFromRegistry, type EditionConfig, type EditionId } from "./edition";

export function getOrgId(session: Session): string {
  const orgId = session.user.organizationId;
  if (!orgId) throw new Error("No organization context");
  return orgId;
}

export function getEdition(session: Session): EditionId {
  const edition = (session.user as { edition?: string }).edition;
  return (edition === "INDIA" || edition === "SAUDI") ? edition : "INDIA";
}

export function getSessionEditionConfig(session: Session): EditionConfig {
  return getEditionConfigFromRegistry(getEdition(session));
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

export function isMobileShopModuleEnabled(session: Session): boolean {
  return (session.user as { isMobileShopModuleEnabled?: boolean }).isMobileShopModuleEnabled === true;
}

export function isSaudiEInvoiceEnabled(session: Session): boolean {
  return (session.user as { saudiEInvoiceEnabled?: boolean }).saudiEInvoiceEnabled === true;
}

export function isWeighMachineEnabled(session: Session): boolean {
  return (session.user as { isWeighMachineEnabled?: boolean }).isWeighMachineEnabled === true;
}

export function isTaxInclusivePrice(session: Session): boolean {
  return (session.user as { isTaxInclusivePrice?: boolean }).isTaxInclusivePrice === true;
}
