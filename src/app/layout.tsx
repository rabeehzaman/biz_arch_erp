import type { Metadata } from "next";
import { cookies } from "next/headers";
import { Inter, Outfit, Noto_Naskh_Arabic } from "next/font/google";
import { Toaster } from "@/components/ui/sonner";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const notoNaskhArabic = Noto_Naskh_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "BizArch ERP",
  description: "Simple invoicing and customer management",
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const cookieStore = await cookies();
  const lang = cookieStore.get("preferred-language")?.value === "ar" ? "ar" : "en";

  return (
    <html lang={lang} dir={lang === "ar" ? "rtl" : "ltr"} suppressHydrationWarning>
      <body
        className={`${inter.variable} ${outfit.variable} ${notoNaskhArabic.variable} antialiased font-sans`}
      >
        {children}
        <Toaster richColors position="top-right" />
      </body>
    </html>
  );
}
