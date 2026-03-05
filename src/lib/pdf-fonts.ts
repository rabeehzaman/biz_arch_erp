import { Font } from "@react-pdf/renderer";

// Register Amiri font for Arabic text rendering in PDFs
// Amiri is a high-quality Naskh Arabic font from Google Fonts
const AMIRI_BASE = "https://cdn.jsdelivr.net/npm/@fontsource/amiri@5/files";

Font.register({
  family: "Amiri",
  fonts: [
    { src: `${AMIRI_BASE}/amiri-arabic-400-normal.woff`, fontWeight: 400 },
    { src: `${AMIRI_BASE}/amiri-arabic-700-normal.woff`, fontWeight: 700 },
  ],
});

export const ARABIC_FONT_FAMILY = "Amiri";
