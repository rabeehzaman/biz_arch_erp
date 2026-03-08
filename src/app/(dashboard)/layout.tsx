import { redirect } from "next/navigation";
import { auth } from "@/lib/auth";
import prisma from "@/lib/prisma";
import ClientDashboardLayout from "./client-layout";
import { getOrgId } from "@/lib/auth-utils";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  if (!session) {
    redirect("/login");
  }

  // Pre-fetch disabled sidebar items to prevent flicker
  let disabledSidebarItems: string[] = [];
  try {
    if (session.user && session.user.role !== "superadmin") {
      let organizationId;
      try {
        organizationId = getOrgId(session);
      } catch (_error) {
        // ignore
      }

      if (organizationId) {
        const setting = await prisma.setting.findFirst({
          where: {
            organizationId,
            key: "disabledSidebarItems",
          },
        });

        if (setting && setting.value) {
          try {
            disabledSidebarItems = JSON.parse(setting.value);
          } catch (_error) {
            // ignore
          }
        }
      }
    }
  } catch (error) {
    console.error("Failed to pre-fetch disabled sidebar items:", error);
  }

  // Extract language from session to prevent en→ar flash
  const initialLang = (session.user as { language?: string })?.language || "en";

  return (
    <ClientDashboardLayout
      session={session}
      swrFallback={{
        "/api/sidebar": disabledSidebarItems,
      }}
      initialLang={initialLang}
    >
      {children}
    </ClientDashboardLayout>
  );
}
