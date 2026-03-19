import prisma from "@/lib/prisma";
import type { Decimal } from "@/generated/prisma/runtime/library";

export interface JewelleryConfig {
  // Core toggles
  isJewelleryModuleEnabled: boolean;
  jewelleryHuidMandatory: boolean;
  jewellerySasoMandatory: boolean;
  jewelleryConsignmentEnabled: boolean;
  jewellerySchemesEnabled: boolean;
  jewelleryOldGoldEnabled: boolean;
  jewelleryRepairsEnabled: boolean;
  jewelleryKarigarsEnabled: boolean;

  // Tax & Compliance
  jewelleryGoldTaxRate: number;
  jewelleryMakingChargeTaxRate: number;
  jewelleryStoneTaxRate: number;
  jewelleryInvestmentGoldTaxRate: number;
  jewelleryPanRequired: boolean;
  jewelleryPanThreshold: number;
  jewelleryCashLimitEnabled: boolean;
  jewelleryCashLimitAmount: number;
  jewelleryTcsEnabled: boolean;
  jewelleryTcsRate: number;
  jewelleryTcsThreshold: number;

  // Business Rules
  jewelleryDefaultWastagePercent: number;
  jewelleryKarigarWastageTolerance: number;
  jewelleryWeightTolerance: number;
  jewelleryBuyRateSpread: number;
  jewelleryAutoDerivePurities: boolean;
  jewelleryAgingAlertDays: number;
  jewelleryReconciliationTolerance: number;
  jewelleryDefaultMakingChargeType: string;

  // Scheme Settings
  jewellerySchemeMaxDuration: number;
  jewellerySchemeBonusMonths: number;
  jewellerySchemeEnforce365Days: boolean;
  jewellerySchemeRedemptionDiscount: number;

  // Theme
  jewelleryThemeEnabled: boolean;
  jewelleryThemeColor: string | null;
  jewelleryThemePreset: string | null;

  // Enabled purities & metals
  jewelleryEnabledPurities: string[];
  jewelleryEnabledMetals: string[];

  // Org context
  edition: string;
}

function decimalToNumber(val: Decimal | number | null | undefined, fallback: number = 0): number {
  if (val === null || val === undefined) return fallback;
  return typeof val === "number" ? val : Number(val);
}

const JEWELLERY_SELECT = {
  isJewelleryModuleEnabled: true,
  jewelleryHuidMandatory: true,
  jewellerySasoMandatory: true,
  jewelleryConsignmentEnabled: true,
  jewellerySchemesEnabled: true,
  jewelleryOldGoldEnabled: true,
  jewelleryRepairsEnabled: true,
  jewelleryKarigarsEnabled: true,
  jewelleryGoldTaxRate: true,
  jewelleryMakingChargeTaxRate: true,
  jewelleryStoneTaxRate: true,
  jewelleryInvestmentGoldTaxRate: true,
  jewelleryPanRequired: true,
  jewelleryPanThreshold: true,
  jewelleryCashLimitEnabled: true,
  jewelleryCashLimitAmount: true,
  jewelleryTcsEnabled: true,
  jewelleryTcsRate: true,
  jewelleryTcsThreshold: true,
  jewelleryDefaultWastagePercent: true,
  jewelleryKarigarWastageTolerance: true,
  jewelleryWeightTolerance: true,
  jewelleryBuyRateSpread: true,
  jewelleryAutoDerivePurities: true,
  jewelleryAgingAlertDays: true,
  jewelleryReconciliationTolerance: true,
  jewelleryDefaultMakingChargeType: true,
  jewellerySchemeMaxDuration: true,
  jewellerySchemeBonusMonths: true,
  jewellerySchemeEnforce365Days: true,
  jewellerySchemeRedemptionDiscount: true,
  jewelleryThemeEnabled: true,
  jewelleryThemeColor: true,
  jewelleryThemePreset: true,
  jewelleryEnabledPurities: true,
  jewelleryEnabledMetals: true,
  edition: true,
} as const;

export async function getJewelleryConfig(orgId: string): Promise<JewelleryConfig> {
  const org = await prisma.organization.findUniqueOrThrow({
    where: { id: orgId },
    select: JEWELLERY_SELECT,
  });

  return {
    isJewelleryModuleEnabled: org.isJewelleryModuleEnabled,
    jewelleryHuidMandatory: org.jewelleryHuidMandatory,
    jewellerySasoMandatory: org.jewellerySasoMandatory,
    jewelleryConsignmentEnabled: org.jewelleryConsignmentEnabled,
    jewellerySchemesEnabled: org.jewellerySchemesEnabled,
    jewelleryOldGoldEnabled: org.jewelleryOldGoldEnabled,
    jewelleryRepairsEnabled: org.jewelleryRepairsEnabled,
    jewelleryKarigarsEnabled: org.jewelleryKarigarsEnabled,
    jewelleryGoldTaxRate: decimalToNumber(org.jewelleryGoldTaxRate, 3),
    jewelleryMakingChargeTaxRate: decimalToNumber(org.jewelleryMakingChargeTaxRate, 5),
    jewelleryStoneTaxRate: decimalToNumber(org.jewelleryStoneTaxRate, 3),
    jewelleryInvestmentGoldTaxRate: decimalToNumber(org.jewelleryInvestmentGoldTaxRate, 3),
    jewelleryPanRequired: org.jewelleryPanRequired,
    jewelleryPanThreshold: decimalToNumber(org.jewelleryPanThreshold, 200000),
    jewelleryCashLimitEnabled: org.jewelleryCashLimitEnabled,
    jewelleryCashLimitAmount: decimalToNumber(org.jewelleryCashLimitAmount, 200000),
    jewelleryTcsEnabled: org.jewelleryTcsEnabled,
    jewelleryTcsRate: decimalToNumber(org.jewelleryTcsRate, 1),
    jewelleryTcsThreshold: decimalToNumber(org.jewelleryTcsThreshold, 500000),
    jewelleryDefaultWastagePercent: decimalToNumber(org.jewelleryDefaultWastagePercent, 5),
    jewelleryKarigarWastageTolerance: decimalToNumber(org.jewelleryKarigarWastageTolerance, 3),
    jewelleryWeightTolerance: decimalToNumber(org.jewelleryWeightTolerance, 0.05),
    jewelleryBuyRateSpread: decimalToNumber(org.jewelleryBuyRateSpread, 5),
    jewelleryAutoDerivePurities: org.jewelleryAutoDerivePurities,
    jewelleryAgingAlertDays: org.jewelleryAgingAlertDays,
    jewelleryReconciliationTolerance: decimalToNumber(org.jewelleryReconciliationTolerance, 1),
    jewelleryDefaultMakingChargeType: org.jewelleryDefaultMakingChargeType,
    jewellerySchemeMaxDuration: org.jewellerySchemeMaxDuration,
    jewellerySchemeBonusMonths: org.jewellerySchemeBonusMonths,
    jewellerySchemeEnforce365Days: org.jewellerySchemeEnforce365Days,
    jewellerySchemeRedemptionDiscount: decimalToNumber(org.jewellerySchemeRedemptionDiscount, 0),
    jewelleryThemeEnabled: org.jewelleryThemeEnabled,
    jewelleryThemeColor: org.jewelleryThemeColor,
    jewelleryThemePreset: org.jewelleryThemePreset,
    jewelleryEnabledPurities: org.jewelleryEnabledPurities,
    jewelleryEnabledMetals: org.jewelleryEnabledMetals,
    edition: org.edition,
  };
}

/** Sensible defaults per edition — used when first enabling the module */
export function getDefaultConfig(edition: "INDIA" | "SAUDI"): Partial<JewelleryConfig> {
  if (edition === "SAUDI") {
    return {
      jewelleryGoldTaxRate: 15,
      jewelleryMakingChargeTaxRate: 15,
      jewelleryStoneTaxRate: 15,
      jewelleryInvestmentGoldTaxRate: 0,
      jewelleryPanRequired: false,
      jewelleryPanThreshold: 0,
      jewelleryCashLimitEnabled: false,
      jewelleryCashLimitAmount: 0,
      jewelleryTcsEnabled: false,
      jewelleryTcsRate: 0,
      jewelleryTcsThreshold: 0,
      jewellerySchemesEnabled: false,
      jewelleryHuidMandatory: false,
      jewellerySasoMandatory: true,
      jewelleryEnabledPurities: ["K24", "K22", "K21", "K18"],
    };
  }
  // India defaults
  return {
    jewelleryGoldTaxRate: 3,
    jewelleryMakingChargeTaxRate: 5,
    jewelleryStoneTaxRate: 3,
    jewelleryInvestmentGoldTaxRate: 3,
    jewelleryPanRequired: true,
    jewelleryPanThreshold: 200000,
    jewelleryCashLimitEnabled: true,
    jewelleryCashLimitAmount: 200000,
    jewelleryTcsEnabled: false,
    jewelleryTcsRate: 1,
    jewelleryTcsThreshold: 500000,
    jewellerySchemesEnabled: true,
    jewelleryHuidMandatory: true,
    jewellerySasoMandatory: false,
    jewelleryEnabledPurities: ["K24", "K22", "K18", "K14", "K9"],
  };
}
