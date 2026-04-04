export interface UnitOption {
  id: string;
  name: string;
  conversionFactor: number;
  price: number | null;
}

interface UnitConversionData {
  unitId: string;
  unit: { name: string; code?: string };
  conversionFactor: number | { toString(): string };
  price?: number | { toString(): string } | null;
  isDefaultUnit?: boolean;
}

/**
 * Builds the unit dropdown options for a product.
 * Returns default unit first (if set), then base unit, then remaining alternates.
 * If no alternate units are defined, returns only the base unit.
 */
export function getProductUnitOptions(
  product: { unitId: string; unit?: { name?: string; code?: string } | null },
  productConversions?: UnitConversionData[] | null
): UnitOption[] {
  const baseOption: UnitOption = {
    id: product.unitId,
    name: product.unit?.name || product.unit?.code || "Base Unit",
    conversionFactor: 1,
    price: null,
  };
  if (!productConversions?.length) return [baseOption];
  const defaultIdx = productConversions.findIndex((pc) => pc.isDefaultUnit);
  const alternates: UnitOption[] = productConversions.map((pc) => ({
    id: pc.unitId,
    name: pc.unit.name,
    conversionFactor: Number(pc.conversionFactor),
    price: pc.price != null ? Number(pc.price) : null,
  }));
  if (defaultIdx >= 0) {
    const [defaultAlt] = alternates.splice(defaultIdx, 1);
    return [defaultAlt, baseOption, ...alternates];
  }
  return [baseOption, ...alternates];
}

/**
 * Returns the default unit for a product, if one is set.
 * Used to pre-select the default unit when adding a product to invoices/POS.
 */
export function getDefaultUnit(
  product: { price: number | { toString(): string }; unitId: string | null },
  productConversions?: UnitConversionData[] | null,
  options?: { basePrice?: number }
): { unitId: string; conversionFactor: number; unitPrice: number } | null {
  const defaultUc = productConversions?.find((uc) => uc.isDefaultUnit);
  if (!defaultUc) return null;
  const factor = Number(defaultUc.conversionFactor);
  const base = options?.basePrice != null ? options.basePrice : Number(product.price);
  const unitPrice =
    options?.basePrice != null
      ? base * factor  // When explicit basePrice (cost) is given, always multiply — don't use override
      : defaultUc.price != null
        ? Number(defaultUc.price)
        : base * factor;
  return { unitId: defaultUc.unitId, conversionFactor: factor, unitPrice };
}

/**
 * Resolves the unit price and conversion factor when a user selects a unit.
 * Checks product-level conversions for override prices.
 *
 * @param basePrice - The product's base price (product.price or product.cost)
 * @param selectedUnitId - The unit the user selected
 * @param productUnitId - The product's base unit ID
 * @param productConversions - The product's unit conversions
 * @returns The resolved unit price and conversion factor
 */
export function resolveUnitPrice(
  basePrice: number,
  selectedUnitId: string,
  productUnitId: string,
  productConversions?: UnitConversionData[] | null,
  options?: { ignoreOverridePrice?: boolean }
): { unitPrice: number; conversionFactor: number } {
  if (selectedUnitId === productUnitId) {
    return { unitPrice: basePrice, conversionFactor: 1 };
  }
  const pc = productConversions?.find((c) => c.unitId === selectedUnitId);
  if (!pc) return { unitPrice: basePrice, conversionFactor: 1 };
  const factor = Number(pc.conversionFactor);
  const unitPrice =
    !options?.ignoreOverridePrice && pc.price != null
      ? Number(pc.price)
      : basePrice * factor;
  return { unitPrice, conversionFactor: factor };
}
