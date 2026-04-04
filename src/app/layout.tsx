import type { Metadata, Viewport } from "next";
import { cookies } from "next/headers";
import { Inter, Outfit, Noto_Naskh_Arabic, Playfair_Display } from "next/font/google";
import { ClientScripts } from "@/components/client-scripts";
import { StandaloneShellGuard } from "@/components/pwa/standalone-shell-guard";
import { CapacitorBootstrap } from "@/components/capacitor-bootstrap";
import { Toaster } from "@/components/ui/sonner";
import { ThemeProvider } from "@/components/theme-provider";
import "./globals.css";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const playfairDisplay = Playfair_Display({
  variable: "--font-playfair",
  subsets: ["latin"],
});

const notoNaskhArabic = Noto_Naskh_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  applicationName: "BizArch ERP",
  title: "BizArch ERP",
  description: "Simple invoicing and customer management",
  manifest: "/manifest.json",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "BizArch ERP",
  },
  icons: {
    icon: "/favicon.ico",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  colorScheme: "light",
  themeColor: "#ffffff",
};

const standaloneShellBootstrap = `
  (function () {
    var baseViewport = "width=device-width, initial-scale=1, viewport-fit=cover, interactive-widget=resizes-content";
    var standaloneViewport = baseViewport + ", maximum-scale=1, user-scalable=no";
    var isStandalone = false;

    if (window.Capacitor && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()) {
      isStandalone = true;
    }

    if (!isStandalone && window.matchMedia) {
      isStandalone =
        window.matchMedia("(display-mode: standalone)").matches ||
        window.matchMedia("(display-mode: fullscreen)").matches;
    }

    if (!isStandalone && navigator.standalone === true) {
      isStandalone = true;
    }

    var isLandscape = window.matchMedia && window.matchMedia("(orientation: landscape)").matches;
    var viewportMeta = document.querySelector('meta[name="viewport"]');

    if (!viewportMeta) {
      viewportMeta = document.createElement("meta");
      viewportMeta.setAttribute("name", "viewport");
      document.head.prepend(viewportMeta);
    }

    viewportMeta.setAttribute("content", isStandalone ? standaloneViewport : baseViewport);
    document.documentElement.dataset.appDisplayMode = isStandalone ? "standalone" : "browser";
    document.documentElement.dataset.appOrientation = isLandscape ? "landscape" : "portrait";
  })();
`;

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
        className={`${inter.variable} ${outfit.variable} ${playfairDisplay.variable} ${notoNaskhArabic.variable} min-h-screen antialiased font-sans`}
        suppressHydrationWarning
      >
        <ThemeProvider>
          <StandaloneShellGuard />
          <CapacitorBootstrap />
          <ClientScripts standaloneBootstrap={standaloneShellBootstrap} />
          {children}
          <Toaster richColors />
        </ThemeProvider>
      </body>
    </html>
  );
}
