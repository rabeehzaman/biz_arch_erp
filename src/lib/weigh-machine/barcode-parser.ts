export interface WeighMachineConfig {
  prefix: string;         // e.g. "77"
  productCodeLen: number; // e.g. 5
  weightDigits: number;   // e.g. 5
  decimalPlaces: number;  // e.g. 3
}

export interface ParsedWeightBarcode {
  productCode: string; // e.g. "12345"
  weightKg: number;    // e.g. 1.25
  rawBarcode: string;
}

export function parseWeightBarcode(
  barcode: string,
  config: WeighMachineConfig
): ParsedWeightBarcode | null {
  const { prefix, productCodeLen, weightDigits, decimalPlaces } = config;
  // EAN-13: prefix + productCode + weight + 1 check digit
  const expectedLen = prefix.length + productCodeLen + weightDigits + 1;
  if (barcode.length !== expectedLen) return null;
  if (!barcode.startsWith(prefix)) return null;

  const productCode = barcode.slice(prefix.length, prefix.length + productCodeLen);
  const weightRaw = barcode.slice(
    prefix.length + productCodeLen,
    prefix.length + productCodeLen + weightDigits
  );

  const intDigits = weightDigits - decimalPlaces;
  const intPart = parseInt(weightRaw.slice(0, intDigits), 10);
  const fracPart = parseInt(weightRaw.slice(intDigits), 10);
  const weightKg = intPart + fracPart / Math.pow(10, decimalPlaces);

  return { productCode, weightKg, rawBarcode: barcode };
}
