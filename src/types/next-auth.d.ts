import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      organizationId?: string | null;
      gstEnabled?: boolean;
      eInvoicingEnabled?: boolean;
      gstStateCode?: string | null;
    } & DefaultSession["user"];
  }

  interface User {
    role?: string;
    organizationId?: string | null;
    gstEnabled?: boolean;
    eInvoicingEnabled?: boolean;
    gstStateCode?: string | null;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    organizationId?: string | null;
    gstEnabled?: boolean;
    eInvoicingEnabled?: boolean;
    gstStateCode?: string | null;
  }
}
