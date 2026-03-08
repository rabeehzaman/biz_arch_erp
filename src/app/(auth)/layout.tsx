import { cookies } from "next/headers";
import { SessionProvider } from "next-auth/react";
import { LanguageProvider } from "@/lib/i18n";

export default async function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const cookieStore = await cookies();
  const initialLang = cookieStore.get("preferred-language")?.value;

  return (
    <SessionProvider>
      <LanguageProvider initialLang={initialLang}>{children}</LanguageProvider>
    </SessionProvider>
  );
}
