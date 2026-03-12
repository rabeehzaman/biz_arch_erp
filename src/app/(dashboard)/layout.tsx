import { cookies } from "next/headers";
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
  const cookieStore = await cookies();

  if (!session) {
    redirect("/login");
  }

  // POS users shouldn't be in the dashboard layout at all
  if (session.user && (session.user as any).role === "pos") {
    redirect("/pos");
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

  // Prefer the browser-stored language so Arabic loads immediately on refresh.
  const cookieLanguage = cookieStore.get("preferred-language")?.value;
  const initialLang =
    cookieLanguage === "ar" || cookieLanguage === "en"
      ? cookieLanguage
      : (session.user as { language?: string })?.language || "en";

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
