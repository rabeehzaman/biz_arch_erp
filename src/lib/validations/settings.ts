import { z } from "zod";

export const companySettingsSchema = z.object({
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
  companyGstNumber: z
    .string()
    .regex(
      /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/,
      "Invalid GST number format"
    )
    .optional()
    .or(z.literal("")),
  bankName: z.string().optional(),
  bankAccountNumber: z.string().optional(),
  bankIfscCode: z
    .string()
    .regex(/^[A-Z]{4}0[A-Z0-9]{6}$/, "Invalid IFSC code format")
    .optional()
    .or(z.literal("")),
  bankBranch: z.string().optional(),
});

export type CompanySettingsFormData = z.infer<typeof companySettingsSchema>;

export const SETTINGS_KEY_MAP: Record<keyof CompanySettingsFormData, string> = {
  companyName: "company_name",
  companyAddress: "company_address",
  companyCity: "company_city",
  companyState: "company_state",
  companyZipCode: "company_zipCode",
  companyCountry: "company_country",
  companyPhone: "company_phone",
  companyEmail: "company_email",
  companyGstNumber: "company_gstNumber",
  bankName: "company_bankName",
  bankAccountNumber: "company_bankAccountNumber",
  bankIfscCode: "company_bankIfscCode",
  bankBranch: "company_bankBranch",
};

export const POS_RECEIPT_PRINTING_KEY = "pos_receipt_printing";

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
};
