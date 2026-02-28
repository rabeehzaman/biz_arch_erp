/**
 * Detects whether the input string is (or is becoming) a valid IMEI number.
 * IMEI is exactly 15 digits.
 */
export function isIMEI(input: string): boolean {
  const cleaned = input.replace(/[\s\-]/g, "");
  return /^\d{15}$/.test(cleaned);
}

/**
 * Returns true if the input looks like a partial IMEI (10-14 consecutive digits).
 * Used to show a "keep typing" hint.
 */
export function isPartialIMEI(input: string): boolean {
  const cleaned = input.replace(/[\s\-]/g, "");
  return /^\d{10,14}$/.test(cleaned);
}

/**
 * Extracts and normalises an IMEI from the input.
 */
export function extractIMEI(input: string): string | null {
  const cleaned = input.replace(/[\s\-]/g, "");
  return /^\d{15}$/.test(cleaned) ? cleaned : null;
}

/**
 * Detects whether the input looks like a barcode (8–13 digits, not 15).
 */
export function isBarcode(input: string): boolean {
  const cleaned = input.replace(/[\s\-]/g, "");
  return /^\d{8,13}$/.test(cleaned);
}
