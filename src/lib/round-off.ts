export const ROUND_OFF_MODE_KEY = "company_roundOffMode";

export const ROUND_OFF_MODES = ["NONE", "NEAREST", "UP", "DOWN"] as const;

export type RoundOffMode = (typeof ROUND_OFF_MODES)[number];

export const DEFAULT_ROUND_OFF_MODE: RoundOffMode = "NONE";

export function roundCurrency(amount: number) {
  return Math.round((amount + Number.EPSILON) * 100) / 100;
}

export function normalizeRoundOffMode(value: string | null | undefined): RoundOffMode {
  return ROUND_OFF_MODES.includes(value as RoundOffMode)
    ? (value as RoundOffMode)
    : DEFAULT_ROUND_OFF_MODE;
}

export function calculateRoundOff(
  amount: number,
  mode: RoundOffMode,
  applyRoundOff: boolean
) {
  const normalizedAmount = roundCurrency(amount);

  if (!applyRoundOff || mode === "NONE") {
    return {
      roundOffAmount: 0,
      roundedTotal: normalizedAmount,
    };
  }

  let roundedTarget = normalizedAmount;

  switch (mode) {
    case "UP":
      roundedTarget = Math.ceil(normalizedAmount);
      break;
    case "DOWN":
      roundedTarget = Math.floor(normalizedAmount);
      break;
    case "NEAREST":
      roundedTarget = Math.round(normalizedAmount);
      break;
    default:
      roundedTarget = normalizedAmount;
      break;
  }

  const roundOffAmount = roundCurrency(roundedTarget - normalizedAmount);

  return {
    roundOffAmount,
    roundedTotal: roundCurrency(normalizedAmount + roundOffAmount),
  };
}

export async function getOrganizationRoundOffMode(
  tx: {
    setting: {
      findUnique: (args: {
        where: {
          organizationId_key: {
            organizationId: string;
            key: string;
          };
        };
        select: { value: true };
      }) => Promise<{ value: string } | null>;
    };
  },
  organizationId: string
): Promise<RoundOffMode> {
  const setting = await tx.setting.findUnique({
    where: {
      organizationId_key: {
        organizationId,
        key: ROUND_OFF_MODE_KEY,
      },
    },
    select: { value: true },
  });

  return normalizeRoundOffMode(setting?.value);
}
