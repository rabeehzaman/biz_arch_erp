import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { compare } from "bcryptjs";
import { authConfig } from "./auth.config";

// Dynamic import for Prisma to avoid Edge runtime issues
const getPrisma = async () => {
  const { prisma } = await import("./prisma");
  return prisma;
};

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      name: "credentials",
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      async authorize(credentials) {
        if (!credentials?.email || !credentials?.password) {
          return null;
        }

        const prisma = await getPrisma();
        const user = await prisma.user.findUnique({
          where: { email: credentials.email as string },
          include: {
            organization: {
              select: {
                edition: true,
                gstEnabled: true,
                eInvoicingEnabled: true,
                multiUnitEnabled: true,
                multiBranchEnabled: true,
                isMobileShopModuleEnabled: true,
                isWeighMachineEnabled: true,
                isJewelleryModuleEnabled: true,
                isRestaurantModuleEnabled: true,
                isSocketIOEnabled: true,
                isManufacturingModuleEnabled: true,
                isPriceListEnabled: true,
                weighMachineBarcodePrefix: true,
                weighMachineProductCodeLen: true,
                weighMachineWeightDigits: true,
                weighMachineDecimalPlaces: true,
                gstStateCode: true,
                saudiEInvoiceEnabled: true,
                isTaxInclusivePrice: true,
                language: true,
                currency: true,
              },
            },
          },
        });

        if (!user) {
          return null;
        }

        const isPasswordValid = await compare(
          credentials.password as string,
          user.password
        );

        if (!isPasswordValid) {
          return null;
        }

        // Look up assigned price list for this user
        let priceListId: string | null = null;
        if (user.organizationId && user.organization?.isPriceListEnabled) {
          const assignment = await prisma.priceListAssignment.findUnique({
            where: { userId: user.id },
            select: { priceListId: true },
          });
          priceListId = assignment?.priceListId ?? null;
        }

        // Fetch all org memberships for multi-org switching
        const memberships = await prisma.userOrganization.findMany({
          where: { userId: user.id },
          include: { organization: { select: { name: true } } },
          orderBy: { createdAt: "asc" },
        });
        const userOrganizations = memberships.map((m) => ({
          organizationId: m.organizationId,
          name: m.organization.name,
          role: m.role,
        }));

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          role: user.role,
          organizationId: user.organizationId,
          edition: user.organization?.edition ?? "INDIA",
          gstEnabled: user.organization?.gstEnabled ?? false,
          eInvoicingEnabled: user.organization?.eInvoicingEnabled ?? false,
          multiUnitEnabled: user.organization?.multiUnitEnabled ?? false,
          multiBranchEnabled: user.organization?.multiBranchEnabled ?? false,
          isMobileShopModuleEnabled: user.organization?.isMobileShopModuleEnabled ?? false,
          isWeighMachineEnabled: user.organization?.isWeighMachineEnabled ?? false,
          isJewelleryModuleEnabled: user.organization?.isJewelleryModuleEnabled ?? false,
          isRestaurantModuleEnabled: user.organization?.isRestaurantModuleEnabled ?? false,
          isSocketIOEnabled: user.organization?.isSocketIOEnabled ?? false,
          isManufacturingModuleEnabled: user.organization?.isManufacturingModuleEnabled ?? false,
          isPriceListEnabled: user.organization?.isPriceListEnabled ?? false,
          priceListId,
          weighMachineBarcodePrefix: user.organization?.weighMachineBarcodePrefix ?? "77",
          weighMachineProductCodeLen: user.organization?.weighMachineProductCodeLen ?? 5,
          weighMachineWeightDigits: user.organization?.weighMachineWeightDigits ?? 5,
          weighMachineDecimalPlaces: user.organization?.weighMachineDecimalPlaces ?? 3,
          gstStateCode: user.organization?.gstStateCode ?? null,
          saudiEInvoiceEnabled: user.organization?.saudiEInvoiceEnabled ?? false,
          isTaxInclusivePrice: user.organization?.isTaxInclusivePrice ?? false,
          language: user.language ?? user.organization?.language ?? "en",
          currency: user.organization?.currency ?? "INR",
          landingPage: user.landingPage ?? null,
          userOrganizations,
        };
      },
    }),
  ],
});
