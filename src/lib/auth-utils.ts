import { Session } from "next-auth";
import { NextResponse } from "next/server";
import { getEditionConfig as getEditionConfigFromRegistry, type EditionConfig, type EditionId } from "./edition";
import prisma from "./prisma";
import { isSubscriptionExpired } from "./subscription";

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

export function isJewelleryModuleEnabled(session: Session): boolean {
  return (session.user as { isJewelleryModuleEnabled?: boolean }).isJewelleryModuleEnabled === true;
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

export function isPriceListEnabled(session: Session): boolean {
  return (session.user as { isPriceListEnabled?: boolean }).isPriceListEnabled === true;
}

export function getPriceListId(session: Session): string | null {
  return (session.user as { priceListId?: string | null }).priceListId ?? null;
}

/**
 * Check subscription status for API routes. Returns a 402 response if expired, or null if OK.
 * Superadmin is always exempt.
 */
export async function checkSubscriptionForApi(
  session: Session
): Promise<NextResponse | null> {
  const role = (session.user as { role?: string }).role;
  if (role === "superadmin") return null;

  try {
    const orgId = (session.user as { organizationId?: string }).organizationId;
    if (!orgId) return null;

    const org = await prisma.organization.findUnique({
      where: { id: orgId },
      select: { subscriptionStatus: true, subscriptionEndDate: true },
    });

    if (org && isSubscriptionExpired(org)) {
      return NextResponse.json(
        { error: "Subscription expired. Please contact your administrator." },
        { status: 402 }
      );
    }
  } catch {
    // Don't block on check failure
  }

  return null;
}
