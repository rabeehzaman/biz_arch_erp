import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { SessionProvider } from "next-auth/react";
import { SWRProvider } from "@/lib/swr-config";
import { LanguageProvider } from "@/lib/i18n";
import { POSShell } from "@/components/pos-shell";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { isSubscriptionExpired } from "@/lib/subscription";

export default async function POSLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const initialLang = cookieStore.get("preferred-language")?.value;

  // Check subscription status for POS users
  const session = await auth();
  if (session?.user && (session.user as { role?: string }).role !== "superadmin") {
    const orgId = (session.user as { organizationId?: string }).organizationId;
    if (orgId) {
      try {
        const org = await prisma.organization.findUnique({
          where: { id: orgId },
          select: { subscriptionStatus: true, subscriptionEndDate: true },
        });
        if (org && isSubscriptionExpired(org)) {
          redirect("/subscription-expired");
        }
      } catch (_error) {
        // Don't block if check fails
      }
    }
  }

  return (
    <SessionProvider>
      <SWRProvider>
        <LanguageProvider initialLang={initialLang}>
          <POSShell>
            {children}
          </POSShell>
        </LanguageProvider>
      </SWRProvider>
    </SessionProvider>
  );
}
