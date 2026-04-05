import { DefaultSession } from "next-auth";

interface UserOrgMembership {
  organizationId: string;
  name: string;
  role: string;
}

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      organizationId?: string | null;
      edition?: string;
      gstEnabled?: boolean;
      eInvoicingEnabled?: boolean;
      multiUnitEnabled?: boolean;
      multiBranchEnabled?: boolean;
      isScannerEnabled?: boolean;
      isMobileShopModuleEnabled?: boolean;
      isJewelleryModuleEnabled?: boolean;
      isRestaurantModuleEnabled?: boolean;
      isPriceListEnabled?: boolean;
      priceListId?: string | null;
      gstStateCode?: string | null;
      saudiEInvoiceEnabled?: boolean;
      language?: string;
      currency?: string;
      userOrganizations?: UserOrgMembership[];
    } & DefaultSession["user"];
  }

  interface User {
    role?: string;
    organizationId?: string | null;
    edition?: string;
    gstEnabled?: boolean;
    eInvoicingEnabled?: boolean;
    multiUnitEnabled?: boolean;
    multiBranchEnabled?: boolean;
    isScannerEnabled?: boolean;
    isMobileShopModuleEnabled?: boolean;
    isJewelleryModuleEnabled?: boolean;
    isRestaurantModuleEnabled?: boolean;
    isPriceListEnabled?: boolean;
    priceListId?: string | null;
    gstStateCode?: string | null;
    saudiEInvoiceEnabled?: boolean;
    language?: string;
    currency?: string;
    userOrganizations?: UserOrgMembership[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    organizationId?: string | null;
    edition?: string;
    gstEnabled?: boolean;
    eInvoicingEnabled?: boolean;
    multiUnitEnabled?: boolean;
    multiBranchEnabled?: boolean;
    isScannerEnabled?: boolean;
    isMobileShopModuleEnabled?: boolean;
    isJewelleryModuleEnabled?: boolean;
    isRestaurantModuleEnabled?: boolean;
    isPriceListEnabled?: boolean;
    priceListId?: string | null;
    gstStateCode?: string | null;
    saudiEInvoiceEnabled?: boolean;
    language?: string;
    currency?: string;
    userOrganizations?: UserOrgMembership[];
  }
}
