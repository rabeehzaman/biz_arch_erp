/**
 * Safely evaluates a simple math expression typed by the user.
 * Only allows digits, whitespace, +, -, *, /, (, ), ., %, comma.
 * Returns a formatted result string or null if not a valid expression.
 */
export function tryEvaluate(input: string): string | null {
  const trimmed = input.trim();

  // Must contain at least one operator to be treated as expression
  if (!/[+\-*/]/.test(trimmed)) return null;

  // Only allow safe characters
  if (!/^[\d\s+\-*/().,%]+$/.test(trimmed)) return null;

  // Must contain at least one digit
  if (!/\d/.test(trimmed)) return null;

  try {
    // eslint-disable-next-line no-new-func
    const result = new Function(`"use strict"; return (${trimmed})`)();
    if (typeof result === "number" && isFinite(result)) {
      // Format with Indian locale, up to 4 decimal places
      return result.toLocaleString("en-IN", {
        maximumFractionDigits: 4,
        minimumFractionDigits: 0,
      });
    }
  } catch {
    // Not a valid expression
  }
  return null;
}
