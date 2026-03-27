/**
 * Jewellery Module Theme System
 *
 * Maps preset names to HSL color sets for dynamic CSS variable injection.
 * Only applies on /jewellery-shop/* pages when jewelleryThemeEnabled = true.
 */

export interface ThemeColors {
  primary: string;       // HSL values without hsl() wrapper
  accent: string;
  sidebarTint: string;   // subtle background tint for sidebar section
  foreground: string;    // text color for contrast
  
  // Luxury background overrides
  background?: string;
  backgroundForeground?: string;
  card?: string;
  cardForeground?: string;
  muted?: string;
  mutedForeground?: string;
  border?: string;
}

const PRESETS: Record<string, ThemeColors> = {
  gold: {
    primary: "43 74% 49%",        // Classic Gold
    accent: "43 60% 65%",         // Soft Champagne
    sidebarTint: "43 20% 10%",    // Obsidian with gold tint
    foreground: "43 20% 95%",
    background: "43 20% 98%",     // Soft Pearl/Cream
    backgroundForeground: "43 30% 15%", // Deep Charcoal
    card: "0 0% 100%",            // Pure White
    cardForeground: "43 30% 15%",
    muted: "43 20% 94%",
    mutedForeground: "43 10% 40%",
    border: "43 20% 88%",
  },
  "rose-gold": {
    primary: "350 30% 59%",       // #b76e79
    accent: "0 40% 75%",          // softer pink
    sidebarTint: "350 20% 12%",   // dark rose tint
    foreground: "350 10% 98%",
    background: "350 15% 98%",    // soft blush white
    backgroundForeground: "350 30% 15%",
    card: "0 0% 100%",
    cardForeground: "350 30% 15%",
    muted: "350 15% 94%",
    mutedForeground: "350 10% 45%",
    border: "350 15% 88%",
  },
  platinum: {
    primary: "213 13% 49%",       // #6b7b8d
    accent: "210 20% 70%",        // light silver
    sidebarTint: "213 15% 12%",   // cool dark steel
    foreground: "213 10% 98%",
    background: "210 10% 98%",    // cool white
    backgroundForeground: "213 30% 15%",
    card: "0 0% 100%",
    cardForeground: "213 30% 15%",
    muted: "210 10% 94%",
    mutedForeground: "213 10% 45%",
    border: "210 10% 88%",
  },
  emerald: {
    primary: "155 46% 33%",       // #2e7d5b
    accent: "140 40% 55%",        // soft emerald
    sidebarTint: "155 30% 10%",   // deep forest
    foreground: "155 10% 98%",
    background: "155 10% 98%",    // soft mint white
    backgroundForeground: "155 30% 15%",
    card: "0 0% 100%",
    cardForeground: "155 30% 15%",
    muted: "155 10% 94%",
    mutedForeground: "155 10% 40%",
    border: "155 10% 88%",
  },
};

/**
 * Convert hex color to HSL string (without wrapper).
 */
function hexToHSL(hex: string): string {
  const r = parseInt(hex.slice(1, 3), 16) / 255;
  const g = parseInt(hex.slice(3, 5), 16) / 255;
  const b = parseInt(hex.slice(5, 7), 16) / 255;

  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;

  if (max === min) return `0 0% ${Math.round(l * 100)}%`;

  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);

  let h = 0;
  if (max === r) h = ((g - b) / d + (g < b ? 6 : 0)) / 6;
  else if (max === g) h = ((b - r) / d + 2) / 6;
  else h = ((r - g) / d + 4) / 6;

  return `${Math.round(h * 360)} ${Math.round(s * 100)}% ${Math.round(l * 100)}%`;
}

/**
 * Build full set of global CSS variable overrides from theme colors.
 */
function buildGlobalVars(colors: ThemeColors): Record<string, string> {
  const vars: Record<string, string> = {
    "--primary": `hsl(${colors.primary})`,
    "--primary-foreground": `hsl(0 0% 100%)`,
    "--ring": `hsl(${colors.primary})`,
    "--accent": `hsl(${colors.accent})`,
    "--accent-foreground": `hsl(${colors.backgroundForeground || "0 0% 15%"})`,
    "--sidebar": `hsl(${colors.sidebarTint})`,
    "--sidebar-primary": `hsl(${colors.accent})`,
    "--sidebar-primary-foreground": `hsl(${colors.foreground})`,
    "--sidebar-accent": `hsl(${colors.sidebarTint})`,
    "--sidebar-accent-foreground": `hsl(${colors.foreground})`,
    "--sidebar-border": `hsl(${colors.border || colors.sidebarTint})`,
    "--sidebar-ring": `hsl(${colors.accent})`,
    
    // Luxury Structural Overrides
    "--font-heading": `var(--font-playfair), "SaudiRiyal", var(--font-arabic), serif`,
    "--radius": `0.3rem`, // Sharper, more elegant corners
    "--shadow-soft": `0 10px 40px -4px hsla(${colors.primary}, 0.15)`, // Ambient tinted shadow
  };

  if (colors.background) vars["--background"] = `hsl(${colors.background})`;
  if (colors.backgroundForeground) vars["--foreground"] = `hsl(${colors.backgroundForeground})`;
  
  if (colors.card) vars["--card"] = `hsl(${colors.card})`;
  if (colors.card) vars["--popover"] = `hsl(${colors.card})`;
  
  if (colors.cardForeground) vars["--card-foreground"] = `hsl(${colors.cardForeground})`;
  if (colors.cardForeground) vars["--popover-foreground"] = `hsl(${colors.cardForeground})`;
  
  if (colors.muted) vars["--muted"] = `hsl(${colors.muted})`;
  if (colors.mutedForeground) vars["--muted-foreground"] = `hsl(${colors.mutedForeground})`;
  if (colors.border) vars["--border"] = `hsl(${colors.border})`;
  if (colors.border) vars["--input"] = `hsl(${colors.border})`;

  return vars;
}

/**
 * Get theme CSS variable overrides for a given preset or custom color.
 */
export function getJewelleryThemeVars(
  preset: string | null,
  customColor: string | null
): Record<string, string> {
  // Custom color
  if (preset === "custom" && customColor && /^#[0-9a-fA-F]{6}$/.test(customColor)) {
    const hsl = hexToHSL(customColor);
    const colors: ThemeColors = {
      primary: hsl,
      accent: hsl,
      sidebarTint: hsl,
      foreground: "0 0% 95%",
      background: "43 15% 98%",
      backgroundForeground: "0 0% 15%",
      card: "0 0% 100%",
      cardForeground: "0 0% 15%",
      muted: "0 0% 96%",
      mutedForeground: "0 0% 45%",
      border: "0 0% 90%",
    };
    return buildGlobalVars(colors);
  }

  // Preset
  const colors = PRESETS[preset || "gold"] || PRESETS.gold;
  return buildGlobalVars(colors);
}

export { PRESETS };
