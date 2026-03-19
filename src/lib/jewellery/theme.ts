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
}

const PRESETS: Record<string, ThemeColors> = {
  gold: {
    primary: "43 76% 38%",        // dark goldenrod #b8860b
    accent: "43 58% 55%",         // #d4a843
    sidebarTint: "43 30% 15%",    // warm gold tint
    foreground: "43 10% 95%",
  },
  "rose-gold": {
    primary: "350 30% 59%",       // #b76e79
    accent: "0 55% 77%",          // #e8a0a0
    sidebarTint: "350 20% 15%",   // pink-copper tint
    foreground: "350 10% 95%",
  },
  platinum: {
    primary: "213 13% 49%",       // #6b7b8d
    accent: "210 30% 70%",        // #9fb3c8
    sidebarTint: "213 15% 15%",   // cool silver tint
    foreground: "213 10% 95%",
  },
  emerald: {
    primary: "155 46% 33%",       // #2e7d5b
    accent: "140 50% 55%",        // #50c878
    sidebarTint: "155 30% 12%",   // deep green tint
    foreground: "155 10% 95%",
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
 * Get theme CSS variable overrides for a given preset or custom color.
 */
export function getJewelleryThemeVars(
  preset: string | null,
  customColor: string | null
): Record<string, string> {
  // Custom color
  if (preset === "custom" && customColor && /^#[0-9a-fA-F]{6}$/.test(customColor)) {
    const hsl = hexToHSL(customColor);
    return {
      "--jewellery-primary": hsl,
      "--jewellery-accent": hsl,
      "--jewellery-sidebar-tint": hsl,
    };
  }

  // Preset
  const colors = PRESETS[preset || "gold"] || PRESETS.gold;
  return {
    "--jewellery-primary": colors.primary,
    "--jewellery-accent": colors.accent,
    "--jewellery-sidebar-tint": colors.sidebarTint,
  };
}

export { PRESETS };
