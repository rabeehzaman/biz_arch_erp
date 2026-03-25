import { DefaultSession } from "next-auth";

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
      isMobileShopModuleEnabled?: boolean;
      isJewelleryModuleEnabled?: boolean;
      isRestaurantModuleEnabled?: boolean;
      gstStateCode?: string | null;
      saudiEInvoiceEnabled?: boolean;
      language?: string;
      currency?: string;
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
    isMobileShopModuleEnabled?: boolean;
    isJewelleryModuleEnabled?: boolean;
    isRestaurantModuleEnabled?: boolean;
    gstStateCode?: string | null;
    saudiEInvoiceEnabled?: boolean;
    language?: string;
    currency?: string;
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
    isMobileShopModuleEnabled?: boolean;
    isJewelleryModuleEnabled?: boolean;
    isRestaurantModuleEnabled?: boolean;
    gstStateCode?: string | null;
    saudiEInvoiceEnabled?: boolean;
    language?: string;
    currency?: string;
  }
}
