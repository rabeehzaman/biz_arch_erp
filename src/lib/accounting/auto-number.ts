// Generic auto-number generator: PREFIX-YYYYMMDD-XXX
// Reusable for JV (journal vouchers), EXP (expenses), etc.

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function generateAutoNumber(
  model: any,
  numberField: string,
  prefix: string,
  organizationId: string
): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
  const fullPrefix = `${prefix}-${dateStr}`;

  const last = await model.findFirst({
    where: { [numberField]: { startsWith: fullPrefix }, organizationId },
    orderBy: { [numberField]: "desc" },
  });

  let sequence = 1;
  if (last) {
    const lastNum = last[numberField] as string;
    const lastSequence = parseInt(lastNum.split("-").pop() || "0");
    sequence = lastSequence + 1;
  }

  return `${fullPrefix}-${sequence.toString().padStart(3, "0")}`;
}
