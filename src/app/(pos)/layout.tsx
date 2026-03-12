import { cookies } from "next/headers";
import { SessionProvider } from "next-auth/react";
import { SWRProvider } from "@/lib/swr-config";
import { LanguageProvider } from "@/lib/i18n";
import { POSShell } from "@/components/pos-shell";

export default async function POSLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const initialLang = cookieStore.get("preferred-language")?.value;

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
