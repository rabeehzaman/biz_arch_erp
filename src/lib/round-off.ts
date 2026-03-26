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
    organization: {
      findUnique: (args: {
        where: { id: string };
        select: { roundOffMode: true };
      }) => Promise<{ roundOffMode: string } | null>;
    };
  },
  organizationId: string
): Promise<RoundOffMode> {
  const org = await tx.organization.findUnique({
    where: { id: organizationId },
    select: { roundOffMode: true },
  });

  return normalizeRoundOffMode(org?.roundOffMode);
}
