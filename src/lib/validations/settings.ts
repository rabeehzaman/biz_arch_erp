import { z } from "zod";
import { DEFAULT_ROUND_OFF_MODE, ROUND_OFF_MODES } from "@/lib/round-off";

// Base schema without edition-specific validation
const baseFields = {
  companyName: z.string().min(1, "Company name is required"),
  companyAddress: z.string().optional(),
  companyCity: z.string().optional(),
  companyState: z.string().optional(),
  companyZipCode: z.string().optional(),
  companyCountry: z.string().optional(),
  companyPhone: z.string().optional(),
  companyEmail: z
    .string()
    .email("Invalid email address")
    .optional()
    .or(z.literal("")),
  companyGstNumber: z.string().optional().or(z.literal("")),
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankIfscCode: z.string().optional().or(z.literal("")),
  bankBranch: z.string().optional(),
  roundOffMode: z.enum(ROUND_OFF_MODES).default(DEFAULT_ROUND_OFF_MODE),
};

// India edition: strict GST and IFSC validation
export const companySettingsSchemaIndia = z.object({
  ...baseFields,
  companyGstNumber: z
    .string()
    .regex(
      /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
      "Invalid GST number format"
    )
    .optional()
    .or(z.literal("")),
  bankIfscCode: z
    .string()
    .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC code format")
    .optional()
    .or(z.literal("")),
});

// Saudi edition: no GST/IFSC validation
export const companySettingsSchemaSaudi = z.object({
  ...baseFields,
});

// Default schema (backward compatible — uses India validation)
export const companySettingsSchema = companySettingsSchemaIndia;

export function getCompanySettingsSchema(edition?: string) {
  if (edition === "SAUDI") return companySettingsSchemaSaudi;
  return companySettingsSchemaIndia;
}

export type CompanySettingsFormData = z.infer<typeof companySettingsSchema>;

export const POS_RECEIPT_PRINTING_KEY = "pos_receipt_printing";
export const POS_SESSION_REPORT_LANGUAGE_KEY = "pos_session_report_language";
export const POS_RECEIPT_RENDER_CONFIG_KEY = "pos_receipt_render_config";

// --- Receipt render mode org-level configuration ---

export type ElectronRenderMode = "htmlDriver" | "htmlRaster" | "escposText" | "bitmapCanvas";
export type MobileRenderMode = "htmlImage" | "bitmapCanvas" | "escposText";

export const ALL_ELECTRON_RENDER_MODES: ElectronRenderMode[] = [
  "htmlDriver", "htmlRaster", "escposText", "bitmapCanvas",
];

export const ALL_MOBILE_RENDER_MODES: MobileRenderMode[] = [
  "htmlImage", "bitmapCanvas", "escposText",
];

export interface PosReceiptRenderConfig {
  electron: {
    allowedModes: ElectronRenderMode[];
    defaultMode: ElectronRenderMode | null;
  };
  mobile: {
    renderMode: MobileRenderMode;
  };
}

export const DEFAULT_POS_RECEIPT_RENDER_CONFIG: PosReceiptRenderConfig = {
  electron: {
    allowedModes: [...ALL_ELECTRON_RENDER_MODES],
    defaultMode: null,
  },
  mobile: {
    renderMode: "htmlImage",
  },
};

export function parsePosReceiptRenderConfig(raw: string | null | undefined): PosReceiptRenderConfig {
  if (!raw) return { ...DEFAULT_POS_RECEIPT_RENDER_CONFIG };
  try {
    const parsed = JSON.parse(raw);
    const allowedModes = Array.isArray(parsed?.electron?.allowedModes)
      ? parsed.electron.allowedModes.filter((m: string) => ALL_ELECTRON_RENDER_MODES.includes(m as ElectronRenderMode))
      : [...ALL_ELECTRON_RENDER_MODES];
    const defaultMode = parsed?.electron?.defaultMode && ALL_ELECTRON_RENDER_MODES.includes(parsed.electron.defaultMode)
      ? parsed.electron.defaultMode
      : null;
    const renderMode = parsed?.mobile?.renderMode && ALL_MOBILE_RENDER_MODES.includes(parsed.mobile.renderMode)
      ? parsed.mobile.renderMode
      : "htmlImage";
    return {
      electron: { allowedModes, defaultMode },
      mobile: { renderMode },
    };
  } catch {
    return { ...DEFAULT_POS_RECEIPT_RENDER_CONFIG };
  }
}

export const DEFAULT_SETTINGS: CompanySettingsFormData = {
  companyName: "",
  companyAddress: "",
  companyCity: "",
  companyState: "",
  companyZipCode: "",
  companyCountry: "India",
  companyPhone: "",
  companyEmail: "",
  companyGstNumber: "",
  bankName: "",
  bankAccountNumber: "",
  bankIfscCode: "",
  bankBranch: "",
  roundOffMode: DEFAULT_ROUND_OFF_MODE,
};
