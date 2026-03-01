import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      organizationId?: string | null;
      gstEnabled?: boolean;
      eInvoicingEnabled?: boolean;
      multiUnitEnabled?: boolean;
      multiBranchEnabled?: boolean;
      isMobileShopModuleEnabled?: boolean;
      gstStateCode?: string | null;
      saudiEInvoiceEnabled?: boolean;
      language?: string;
    } & DefaultSession["user"];
  }

  interface User {
    role?: string;
    organizationId?: string | null;
    gstEnabled?: boolean;
    eInvoicingEnabled?: boolean;
    multiUnitEnabled?: boolean;
    multiBranchEnabled?: boolean;
    isMobileShopModuleEnabled?: boolean;
    gstStateCode?: string | null;
    saudiEInvoiceEnabled?: boolean;
    language?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    organizationId?: string | null;
    gstEnabled?: boolean;
    eInvoicingEnabled?: boolean;
    multiUnitEnabled?: boolean;
    multiBranchEnabled?: boolean;
    isMobileShopModuleEnabled?: boolean;
    gstStateCode?: string | null;
    saudiEInvoiceEnabled?: boolean;
    language?: string;
  }
}
