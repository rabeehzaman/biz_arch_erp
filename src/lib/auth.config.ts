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
          const isSuperadmin = (auth?.user as { role?: string })?.role === "superadmin";
          return Response.redirect(new URL(isSuperadmin ? "/admin/organizations" : "/", nextUrl));
        }
        return true; // Allow access to login page when not logged in
      }

      // For all other pages, require login
      if (!isLoggedIn) {
        return Response.redirect(new URL("/login", nextUrl));
      }

      // Superadmin should only access /admin/* paths (API routes are always allowed)
      const isSuperadmin = (auth?.user as { role?: string })?.role === "superadmin";
      const isApi = nextUrl.pathname.startsWith("/api");
      if (isSuperadmin && !isApi && !nextUrl.pathname.startsWith("/admin")) {
        return Response.redirect(new URL("/admin/organizations", nextUrl));
      }

      return true;
    },
    async jwt({ token, user }) {
      if (user) {
        token.id = user.id;
        token.role = (user as { role?: string }).role;
        token.organizationId = (user as { organizationId?: string | null }).organizationId ?? null;
        token.gstEnabled = (user as { gstEnabled?: boolean }).gstEnabled ?? false;
        token.eInvoicingEnabled = (user as { eInvoicingEnabled?: boolean }).eInvoicingEnabled ?? false;
        token.multiUnitEnabled = (user as { multiUnitEnabled?: boolean }).multiUnitEnabled ?? false;
        token.multiBranchEnabled = (user as { multiBranchEnabled?: boolean }).multiBranchEnabled ?? false;
        token.isMobileShopModuleEnabled = (user as { isMobileShopModuleEnabled?: boolean }).isMobileShopModuleEnabled ?? false;
        token.gstStateCode = (user as { gstStateCode?: string | null }).gstStateCode ?? null;
        token.saudiEInvoiceEnabled = (user as { saudiEInvoiceEnabled?: boolean }).saudiEInvoiceEnabled ?? false;
        token.language = (user as { language?: string }).language ?? "en";
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
        (session.user as { gstStateCode?: string | null }).gstStateCode = token.gstStateCode as string | null;
        (session.user as { saudiEInvoiceEnabled?: boolean }).saudiEInvoiceEnabled = token.saudiEInvoiceEnabled as boolean;
        (session.user as { language?: string }).language = token.language as string ?? "en";
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
