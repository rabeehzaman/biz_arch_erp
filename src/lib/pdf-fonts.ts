import { Font } from "@react-pdf/renderer";

// Register Cairo font for Arabic text in PDFs
const CAIRO_BASE = "https://cdn.jsdelivr.net/npm/@fontsource/cairo@5/files";

Font.register({
  family: "Cairo",
  fonts: [
    { src: `${CAIRO_BASE}/cairo-arabic-400-normal.woff`, fontWeight: 400 },
    { src: `${CAIRO_BASE}/cairo-arabic-700-normal.woff`, fontWeight: 700 },
  ],
});

export const ARABIC_FONT_FAMILY = "Cairo";
