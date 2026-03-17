import { Font } from "@react-pdf/renderer";
import path from "path";

// Register local Arial font for PDF rendering (supports Arabic text)
const regularFontPath = path.join(process.cwd(), "public/fonts/Arial.ttf");
const boldFontPath = path.join(process.cwd(), "public/fonts/Arial Bold.ttf");

Font.register({
  family: "Arial",
  fonts: [
    { src: regularFontPath, fontWeight: 400 },
    { src: boldFontPath, fontWeight: 700 },
  ],
});

export const ARABIC_FONT_FAMILY = "Arial";
export const PDF_FONT_FAMILY = "Arial";
