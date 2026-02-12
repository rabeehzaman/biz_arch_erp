import { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      role: string;
      organizationId: string;
    } & DefaultSession["user"];
  }

  interface User {
    role?: string;
    organizationId?: string;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id?: string;
    role?: string;
    organizationId?: string;
  }
}
