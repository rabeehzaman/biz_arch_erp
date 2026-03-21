import type { CapacitorConfig } from "@capacitor/cli";

const ERP_URL = process.env.ERP_URL || "https://erp.bizarch.in";
const allowNavigationHost = (() => {
  try {
    return [new URL(ERP_URL).host];
  } catch {
    return ["erp.bizarch.in"];
  }
})();

const config: CapacitorConfig = {
  appId: "com.bizarch.mobile",
  appName: "BizArch Mobile",
  webDir: "www",
  server: {
    url: ERP_URL,
    cleartext: ERP_URL.startsWith("http://"),
    allowNavigation: allowNavigationHost,
    errorPath: "offline.html",
  },
  android: {
    allowMixedContent: ERP_URL.startsWith("http://"),
  },
  plugins: {
    SplashScreen: {
      launchAutoHide: false,
    },
    Keyboard: {
      resize: "body",
    },
  },
};

export default config;
