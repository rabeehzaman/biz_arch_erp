// Generic auto-number generator: PREFIX-YYYYMMDD-XXX
// Reusable for JV (journal vouchers), EXP (expenses), etc.


export async function generateAutoNumber(
  model: any,
  numberField: string,
  prefix: string,
  organizationId: string,
  tx?: any
): Promise<string> {
  const today = new Date();
  const dateStr = today.toISOString().slice(0, 10).replace(/-/g, "");
  const fullPrefix = `${prefix}-${dateStr}`;

  // Use raw SQL to find the true numeric max sequence (avoids string sort issues
  // where "999" > "1000" in lexicographic order).
  const prisma = tx || model;
  if (prisma.$queryRawUnsafe) {
    try {
      const tableName = getTableName(numberField);
      const result: any[] = await prisma.$queryRawUnsafe(
        `SELECT MAX(CAST(REVERSE(SPLIT_PART(REVERSE("${numberField}"), '-', 1)) AS INTEGER)) as max_seq ` +
        `FROM "${tableName}" ` +
        `WHERE "${numberField}" LIKE $1 AND "organizationId" = $2`,
        `${fullPrefix}-%`,
        organizationId
      );
      const maxSeq = Number(result[0]?.max_seq ?? 0);
      return `${fullPrefix}-${(maxSeq + 1).toString().padStart(3, "0")}`;
    } catch (e) {
      console.error("[auto-number] Raw SQL failed, using fallback:", (e as Error).message);
    }
  }

  // Fallback: load all matching number fields and find numeric max.
  // This is slower but always correct regardless of string sort order.
  const all = await model.findMany({
    where: { [numberField]: { startsWith: fullPrefix }, organizationId },
    select: { [numberField]: true },
    take: 5000,
  });

  let maxSequence = 0;
  for (const entry of all) {
    const seq = parseInt((entry[numberField] as string).split("-").pop() || "0");
    if (seq > maxSequence) maxSequence = seq;
  }

  return `${fullPrefix}-${(maxSequence + 1).toString().padStart(3, "0")}`;
}

function getTableName(numberField: string): string {
  const fieldToTable: Record<string, string> = {
    journalNumber: "journal_entries",
    expenseNumber: "expenses",
    transferNumber: "stock_transfers",
    adjustmentNumber: "inventory_adjustments",
    productionNumber: "production_orders",
    movementNumber: "pos_cash_movements",
  };
  return fieldToTable[numberField] || "journal_entries";
}
