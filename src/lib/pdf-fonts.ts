import { Font } from "@react-pdf/renderer";

// Register Noto Naskh Arabic — same font used in the web UI
const NOTO_BASE = "https://cdn.jsdelivr.net/npm/@fontsource/noto-naskh-arabic@5/files";

Font.register({
  family: "Noto Naskh Arabic",
  fonts: [
    { src: `${NOTO_BASE}/noto-naskh-arabic-arabic-400-normal.woff`, fontWeight: 400 },
    { src: `${NOTO_BASE}/noto-naskh-arabic-arabic-700-normal.woff`, fontWeight: 700 },
  ],
});

export const ARABIC_FONT_FAMILY = "Noto Naskh Arabic";
