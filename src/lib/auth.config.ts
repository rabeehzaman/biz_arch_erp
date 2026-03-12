import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

// This is the edge-compatible auth config (no DB access)
export const authConfig: NextAuthConfig = {
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      // Authorization happens in the full auth.ts
      authorize: async () => null,
    }),
  ],
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = !!auth?.user;
      const isOnLogin = nextUrl.pathname === "/login";
      const isAuthApi = nextUrl.pathname.startsWith("/api/auth");

      if (isAuthApi) return true;

      if (isOnLogin) {
        // If logged in and on login page, redirect to appropriate dashboard
        if (isLoggedIn) {
          const role = (auth?.user as { role?: string })?.role;
          if (role === "superadmin") return Response.redirect(new URL("/admin/organizations", nextUrl));
          if (role === "pos") return Response.redirect(new URL("/pos", nextUrl));
          return Response.redirect(new URL("/", nextUrl));
        }
        return true; // Allow access to login page when not logged in
      }

      // For all other pages, require login
      if (!isLoggedIn) {
        return Response.redirect(new URL("/login", nextUrl));
      }

      const role = (auth?.user as { role?: string })?.role;
      const isApi = nextUrl.pathname.startsWith("/api");

      // Superadmin should only access /admin/* paths (API routes are always allowed)
      if (role === "superadmin" && !isApi && !nextUrl.pathname.startsWith("/admin")) {
        return Response.redirect(new URL("/admin/organizations", nextUrl));
      }

      // POS user should only access /pos paths (API routes are always allowed)
      if (role === "pos" && !isApi && !nextUrl.pathname.startsWith("/pos")) {
        return Response.redirect(new URL("/pos", nextUrl));
      }

      return true;
    },
    async jwt({ token, user, trigger, session: sessionUpdate }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
        token.organizationId = (user as { organizationId?: string | null }).organizationId ?? null;
        token.gstEnabled = (user as { gstEnabled?: boolean }).gstEnabled ?? false;
        token.eInvoicingEnabled = (user as { eInvoicingEnabled?: boolean }).eInvoicingEnabled ?? false;
        token.multiUnitEnabled = (user as { multiUnitEnabled?: boolean }).multiUnitEnabled ?? false;
        token.multiBranchEnabled = (user as { multiBranchEnabled?: boolean }).multiBranchEnabled ?? false;
        token.isMobileShopModuleEnabled = (user as { isMobileShopModuleEnabled?: boolean }).isMobileShopModuleEnabled ?? false;
        token.isWeighMachineEnabled = (user as { isWeighMachineEnabled?: boolean }).isWeighMachineEnabled ?? false;
        token.weighMachineBarcodePrefix = (user as { weighMachineBarcodePrefix?: string | null }).weighMachineBarcodePrefix ?? "77";
        token.weighMachineProductCodeLen = (user as { weighMachineProductCodeLen?: number | null }).weighMachineProductCodeLen ?? 5;
        token.weighMachineWeightDigits = (user as { weighMachineWeightDigits?: number | null }).weighMachineWeightDigits ?? 5;
        token.weighMachineDecimalPlaces = (user as { weighMachineDecimalPlaces?: number | null }).weighMachineDecimalPlaces ?? 3;
        token.gstStateCode = (user as { gstStateCode?: string | null }).gstStateCode ?? null;
        token.saudiEInvoiceEnabled = (user as { saudiEInvoiceEnabled?: boolean }).saudiEInvoiceEnabled ?? false;
        token.isTaxInclusivePrice = (user as { isTaxInclusivePrice?: boolean }).isTaxInclusivePrice ?? false;
        token.language = (user as { language?: string }).language ?? "en";
        token.currency = (user as { currency?: string }).currency ?? "INR";
      }
      // Handle client-side session updates (e.g. language switch)
      if (trigger === "update" && sessionUpdate) {
        if ((sessionUpdate as { language?: string }).language) {
          token.language = (sessionUpdate as { language: string }).language;
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
        (session.user as { organizationId?: string }).organizationId = token.organizationId as string;
        (session.user as { gstEnabled?: boolean }).gstEnabled = token.gstEnabled as boolean;
        (session.user as { eInvoicingEnabled?: boolean }).eInvoicingEnabled = token.eInvoicingEnabled as boolean;
        (session.user as { multiUnitEnabled?: boolean }).multiUnitEnabled = token.multiUnitEnabled as boolean;
        (session.user as { multiBranchEnabled?: boolean }).multiBranchEnabled = token.multiBranchEnabled as boolean;
        (session.user as { isMobileShopModuleEnabled?: boolean }).isMobileShopModuleEnabled = token.isMobileShopModuleEnabled as boolean;
        (session.user as { isWeighMachineEnabled?: boolean }).isWeighMachineEnabled = token.isWeighMachineEnabled as boolean;
        (session.user as { weighMachineBarcodePrefix?: string | null }).weighMachineBarcodePrefix = token.weighMachineBarcodePrefix as string | null;
        (session.user as { weighMachineProductCodeLen?: number | null }).weighMachineProductCodeLen = token.weighMachineProductCodeLen as number | null;
        (session.user as { weighMachineWeightDigits?: number | null }).weighMachineWeightDigits = token.weighMachineWeightDigits as number | null;
        (session.user as { weighMachineDecimalPlaces?: number | null }).weighMachineDecimalPlaces = token.weighMachineDecimalPlaces as number | null;
        (session.user as { gstStateCode?: string | null }).gstStateCode = token.gstStateCode as string | null;
        (session.user as { saudiEInvoiceEnabled?: boolean }).saudiEInvoiceEnabled = token.saudiEInvoiceEnabled as boolean;
        (session.user as { isTaxInclusivePrice?: boolean }).isTaxInclusivePrice = token.isTaxInclusivePrice as boolean;
        (session.user as { language?: string }).language = token.language as string ?? "en";
        (session.user as { currency?: string }).currency = token.currency as string ?? "INR";
      }
      return session;
    },
  },
  pages: {
    signIn: "/login",
  },
  session: {
    strategy: "jwt",
  },
};
