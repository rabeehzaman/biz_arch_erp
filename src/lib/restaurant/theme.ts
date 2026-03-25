/**
 * Restaurant Module Theme System
 *
 * Maps preset names to HSL color sets for dynamic CSS variable injection.
 * Applied ERP-wide when isRestaurantModuleEnabled = true and restaurantThemeEnabled = true.
 */

export interface ThemeColors {
  primary: string;       // HSL values without hsl() wrapper
  accent: string;
  sidebarTint: string;   // subtle background tint for sidebar section
  foreground: string;    // text color for contrast
}

const PRESETS: Record<string, ThemeColors> = {
  bistro: {
    primary: "0 65% 45%",           // warm red #b83030
    accent: "15 70% 55%",           // burnt orange
    sidebarTint: "0 30% 15%",       // deep warm tint
    foreground: "0 10% 95%",
  },
  "olive-garden": {
    primary: "85 35% 35%",          // olive green
    accent: "60 40% 50%",           // warm yellow-green
    sidebarTint: "85 20% 12%",      // deep olive tint
    foreground: "85 10% 95%",
  },
  "midnight-diner": {
    primary: "220 40% 30%",         // deep navy
    accent: "200 50% 55%",          // steel blue
    sidebarTint: "220 25% 12%",     // dark navy tint
    foreground: "220 10% 95%",
  },
  terracotta: {
    primary: "15 55% 45%",          // warm terracotta
    accent: "25 60% 60%",           // sandy orange
    sidebarTint: "15 25% 14%",      // earth tint
    foreground: "15 10% 95%",
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
export function getRestaurantThemeVars(
  preset: string | null,
  customColor: string | null
): Record<string, string> {
  // Custom color
  if (preset === "custom" && customColor && /^#[0-9a-fA-F]{6}$/.test(customColor)) {
    const hsl = hexToHSL(customColor);
    return {
      "--restaurant-primary": hsl,
      "--restaurant-accent": hsl,
      "--restaurant-sidebar-tint": hsl,
    };
  }

  // Preset
  const colors = PRESETS[preset || "bistro"] || PRESETS.bistro;
  return {
    "--restaurant-primary": colors.primary,
    "--restaurant-accent": colors.accent,
    "--restaurant-sidebar-tint": colors.sidebarTint,
  };
}

export { PRESETS };
