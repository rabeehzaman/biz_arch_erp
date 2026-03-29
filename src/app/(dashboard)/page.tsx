import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { getOrgId } from "@/lib/auth-utils";
import { SETTING_KEYS } from "@/lib/form-config/types";
import { DashboardContent } from "@/components/dashboard/dashboard-content";
import { PageAnimation } from "@/components/ui/page-animation";

export default async function DashboardPage() {
  const session = await auth();

  if (session?.user && session.user.role !== "superadmin") {
    try {
      // Check per-user landing page first
      const user = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { landingPage: true },
      });
      if (user?.landingPage && user.landingPage !== "/") {
        redirect(user.landingPage);
      }

      // Check org-level landing page
      const organizationId = getOrgId(session);
      if (organizationId) {
        const setting = await prisma.setting.findFirst({
          where: {
            organizationId,
            key: SETTING_KEYS.DEFAULT_LANDING_PAGE,
            userId: null,
          },
        });
        if (setting?.value) {
          try {
            const page = JSON.parse(setting.value);
            if (page && page !== "/") {
              redirect(page);
            }
          } catch {
            // ignore parse errors
          }
        }
      }
    } catch (error) {
      // redirect() throws a special Next.js error — re-throw it
      if (error && typeof error === "object" && "digest" in error) throw error;
      // For other errors, just continue to dashboard
    }
  }

  return (
    <PageAnimation>
      <DashboardContent />
    </PageAnimation>
  );
}
