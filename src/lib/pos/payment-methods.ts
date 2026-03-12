export const POS_PAYMENT_METHODS = [
  "CASH",
  "CREDIT_CARD",
  "UPI",
  "BANK_TRANSFER",
] as const;

export type POSPaymentMethod = (typeof POS_PAYMENT_METHODS)[number];

export const DEFAULT_ENABLED_POS_PAYMENT_METHODS: POSPaymentMethod[] = [
  "CASH",
  "CREDIT_CARD",
];

export const POS_PAYMENT_METHODS_KEY = "pos_enabled_payment_methods";

export function filterPOSPaymentMethods(
  methods: readonly string[] | null | undefined
): POSPaymentMethod[] {
  if (!methods) {
    return [];
  }

  return POS_PAYMENT_METHODS.filter((method) => methods.includes(method));
}

export function parseEnabledPOSPaymentMethods(
  rawValue: string | null | undefined
): POSPaymentMethod[] {
  if (!rawValue) {
    return [...DEFAULT_ENABLED_POS_PAYMENT_METHODS];
  }

  try {
    const parsed = JSON.parse(rawValue);
    if (!Array.isArray(parsed)) {
      return [...DEFAULT_ENABLED_POS_PAYMENT_METHODS];
    }

    const methods = filterPOSPaymentMethods(parsed);
    return methods.length > 0
      ? methods
      : [...DEFAULT_ENABLED_POS_PAYMENT_METHODS];
  } catch {
    return [...DEFAULT_ENABLED_POS_PAYMENT_METHODS];
  }
}

export function serializeEnabledPOSPaymentMethods(
  methods: readonly string[]
): string {
  return JSON.stringify(filterPOSPaymentMethods(methods));
}
