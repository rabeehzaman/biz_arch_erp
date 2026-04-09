import type { NextAuthConfig } from "next-auth";
import Credentials from "next-auth/providers/credentials";

// This is the edge-compatible auth config (no DB access)
export const authConfig: NextAuthConfig = {
  trustHost: true,
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
          // Use per-user landing page if set, otherwise dashboard
          const userLandingPage = (auth?.user as { landingPage?: string | null })?.landingPage;
          return Response.redirect(new URL(userLandingPage || "/", nextUrl));
        }
        return true; // Allow access to login page when not logged in
      }

      // For all other pages, require login
      if (!isLoggedIn) {
        return Response.redirect(new URL("/login", nextUrl));
      }

      const role = (auth?.user as { role?: string })?.role;
      const isApi = nextUrl.pathname.startsWith("/api");
      const isSubscriptionExpiredPage = nextUrl.pathname === "/subscription-expired";

      // Allow any logged-in user to access the subscription-expired page
      // (superadmin will be redirected away by the page itself)
      if (isSubscriptionExpiredPage) {
        return true;
      }

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
        token.edition = (user as { edition?: string }).edition ?? "INDIA";
        token.gstEnabled = (user as { gstEnabled?: boolean }).gstEnabled ?? false;
        token.eInvoicingEnabled = (user as { eInvoicingEnabled?: boolean }).eInvoicingEnabled ?? false;
        token.multiUnitEnabled = (user as { multiUnitEnabled?: boolean }).multiUnitEnabled ?? false;
        token.multiBranchEnabled = (user as { multiBranchEnabled?: boolean }).multiBranchEnabled ?? false;
        token.isMobileShopModuleEnabled = (user as { isMobileShopModuleEnabled?: boolean }).isMobileShopModuleEnabled ?? false;
        token.isWeighMachineEnabled = (user as { isWeighMachineEnabled?: boolean }).isWeighMachineEnabled ?? false;
        token.isJewelleryModuleEnabled = (user as { isJewelleryModuleEnabled?: boolean }).isJewelleryModuleEnabled ?? false;
        token.isRestaurantModuleEnabled = (user as { isRestaurantModuleEnabled?: boolean }).isRestaurantModuleEnabled ?? false;
        token.isPriceListEnabled = (user as { isPriceListEnabled?: boolean }).isPriceListEnabled ?? false;
        token.priceListId = (user as { priceListId?: string | null }).priceListId ?? null;
        token.weighMachineBarcodePrefix = (user as { weighMachineBarcodePrefix?: string | null }).weighMachineBarcodePrefix ?? "77";
        token.weighMachineProductCodeLen = (user as { weighMachineProductCodeLen?: number | null }).weighMachineProductCodeLen ?? 5;
        token.weighMachineWeightDigits = (user as { weighMachineWeightDigits?: number | null }).weighMachineWeightDigits ?? 5;
        token.weighMachineDecimalPlaces = (user as { weighMachineDecimalPlaces?: number | null }).weighMachineDecimalPlaces ?? 3;
        token.gstStateCode = (user as { gstStateCode?: string | null }).gstStateCode ?? null;
        token.saudiEInvoiceEnabled = (user as { saudiEInvoiceEnabled?: boolean }).saudiEInvoiceEnabled ?? false;
        token.isTaxInclusivePrice = (user as { isTaxInclusivePrice?: boolean }).isTaxInclusivePrice ?? false;
        token.language = (user as { language?: string }).language ?? "en";
        token.currency = (user as { currency?: string }).currency ?? "INR";
        token.landingPage = (user as { landingPage?: string | null }).landingPage ?? null;
        token.userOrganizations = (user as { userOrganizations?: Array<{ organizationId: string; name: string; role: string }> }).userOrganizations ?? [];
      }
      // Handle client-side session updates (e.g. language switch, org switch)
      if (trigger === "update" && sessionUpdate) {
        if ((sessionUpdate as { language?: string }).language) {
          token.language = (sessionUpdate as { language: string }).language;
        }
        // Handle organization switch — overwrite all org-specific fields
        const update = sessionUpdate as Record<string, unknown>;
        if (update.switchOrgContext) {
          const ctx = update.switchOrgContext as Record<string, unknown>;
          token.organizationId = ctx.organizationId as string;
          token.role = ctx.role as string;
          token.edition = ctx.edition as string ?? "INDIA";
          token.gstEnabled = ctx.gstEnabled as boolean ?? false;
          token.eInvoicingEnabled = ctx.eInvoicingEnabled as boolean ?? false;
          token.multiUnitEnabled = ctx.multiUnitEnabled as boolean ?? false;
          token.multiBranchEnabled = ctx.multiBranchEnabled as boolean ?? false;
          token.isMobileShopModuleEnabled = ctx.isMobileShopModuleEnabled as boolean ?? false;
          token.isWeighMachineEnabled = ctx.isWeighMachineEnabled as boolean ?? false;
          token.isJewelleryModuleEnabled = ctx.isJewelleryModuleEnabled as boolean ?? false;
          token.isRestaurantModuleEnabled = ctx.isRestaurantModuleEnabled as boolean ?? false;
          token.isPriceListEnabled = ctx.isPriceListEnabled as boolean ?? false;
          token.priceListId = ctx.priceListId as string | null ?? null;
          token.weighMachineBarcodePrefix = ctx.weighMachineBarcodePrefix as string ?? "77";
          token.weighMachineProductCodeLen = ctx.weighMachineProductCodeLen as number ?? 5;
          token.weighMachineWeightDigits = ctx.weighMachineWeightDigits as number ?? 5;
          token.weighMachineDecimalPlaces = ctx.weighMachineDecimalPlaces as number ?? 3;
          token.gstStateCode = ctx.gstStateCode as string | null ?? null;
          token.saudiEInvoiceEnabled = ctx.saudiEInvoiceEnabled as boolean ?? false;
          token.isTaxInclusivePrice = ctx.isTaxInclusivePrice as boolean ?? false;
          token.language = ctx.language as string ?? "en";
          token.currency = ctx.currency as string ?? "INR";
        }
      }
      return token;
    },
    async session({ session, token }) {
      if (session.user) {
        session.user.id = token.id as string;
        (session.user as { role?: string }).role = token.role as string;
        (session.user as { organizationId?: string }).organizationId = token.organizationId as string;
        (session.user as { edition?: string }).edition = token.edition as string ?? "INDIA";
        (session.user as { gstEnabled?: boolean }).gstEnabled = token.gstEnabled as boolean;
        (session.user as { eInvoicingEnabled?: boolean }).eInvoicingEnabled = token.eInvoicingEnabled as boolean;
        (session.user as { multiUnitEnabled?: boolean }).multiUnitEnabled = token.multiUnitEnabled as boolean;
        (session.user as { multiBranchEnabled?: boolean }).multiBranchEnabled = token.multiBranchEnabled as boolean;
        (session.user as { isMobileShopModuleEnabled?: boolean }).isMobileShopModuleEnabled = token.isMobileShopModuleEnabled as boolean;
        (session.user as { isWeighMachineEnabled?: boolean }).isWeighMachineEnabled = token.isWeighMachineEnabled as boolean;
        (session.user as { isJewelleryModuleEnabled?: boolean }).isJewelleryModuleEnabled = token.isJewelleryModuleEnabled as boolean;
        (session.user as { isRestaurantModuleEnabled?: boolean }).isRestaurantModuleEnabled = token.isRestaurantModuleEnabled as boolean;
        (session.user as { isPriceListEnabled?: boolean }).isPriceListEnabled = token.isPriceListEnabled as boolean;
        (session.user as { priceListId?: string | null }).priceListId = token.priceListId as string | null;
        (session.user as { weighMachineBarcodePrefix?: string | null }).weighMachineBarcodePrefix = token.weighMachineBarcodePrefix as string | null;
        (session.user as { weighMachineProductCodeLen?: number | null }).weighMachineProductCodeLen = token.weighMachineProductCodeLen as number | null;
        (session.user as { weighMachineWeightDigits?: number | null }).weighMachineWeightDigits = token.weighMachineWeightDigits as number | null;
        (session.user as { weighMachineDecimalPlaces?: number | null }).weighMachineDecimalPlaces = token.weighMachineDecimalPlaces as number | null;
        (session.user as { gstStateCode?: string | null }).gstStateCode = token.gstStateCode as string | null;
        (session.user as { saudiEInvoiceEnabled?: boolean }).saudiEInvoiceEnabled = token.saudiEInvoiceEnabled as boolean;
        (session.user as { isTaxInclusivePrice?: boolean }).isTaxInclusivePrice = token.isTaxInclusivePrice as boolean;
        (session.user as { language?: string }).language = token.language as string ?? "en";
        (session.user as { currency?: string }).currency = token.currency as string ?? "INR";
        (session.user as { userOrganizations?: Array<{ organizationId: string; name: string; role: string }> }).userOrganizations = (Array.isArray(token.userOrganizations) ? token.userOrganizations : []) as Array<{ organizationId: string; name: string; role: string }>;
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
