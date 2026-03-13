type Tx = any;

function parseNumericCode(code: string | null | undefined): number | null {
  if (!code || !/^\d+$/.test(code)) return null;
  return Number.parseInt(code, 10);
}

export async function findPrimaryCashParentAccount(
  tx: Tx,
  organizationId: string
): Promise<{ id: string; code: string } | null> {
  const primaryCash = await tx.account.findFirst({
    where: {
      organizationId,
      code: "1100",
      accountType: "ASSET",
      accountSubType: "CASH",
    },
    select: { id: true, code: true },
  });

  if (primaryCash) return primaryCash;

  return tx.account.findFirst({
    where: {
      organizationId,
      accountType: "ASSET",
      accountSubType: "CASH",
    },
    orderBy: { code: "asc" },
    select: { id: true, code: true },
  });
}

export async function getNextChildAccountCode(
  tx: Tx,
  organizationId: string,
  parentId: string,
  options: {
    currentAccountId?: string | null;
  } = {}
): Promise<string> {
  const parent = await tx.account.findFirst({
    where: { id: parentId, organizationId },
    select: { code: true },
  });

  if (!parent) {
    throw new Error("PARENT_ACCOUNT_NOT_FOUND");
  }

  const siblingAccounts = await tx.account.findMany({
    where: {
      organizationId,
      parentId,
      ...(options.currentAccountId ? { id: { not: options.currentAccountId } } : {}),
    },
    orderBy: { code: "asc" },
    select: { code: true },
  });

  const siblingNumbers = siblingAccounts
    .map((account: { code: string }) => parseNumericCode(account.code))
    .filter((value: number | null): value is number => value !== null);

  const parentNumber = parseNumericCode(parent.code);
  let nextCode =
    siblingNumbers.length > 0
      ? Math.max(...siblingNumbers) + 1
      : (parentNumber ?? 0) + 1;

  if (nextCode <= 0) {
    nextCode = 1;
  }

  while (true) {
    const conflict = await tx.account.findFirst({
      where: {
        organizationId,
        code: String(nextCode),
        ...(options.currentAccountId ? { id: { not: options.currentAccountId } } : {}),
      },
      select: { id: true },
    });

    if (!conflict) {
      return String(nextCode);
    }

    nextCode += 1;
  }
}
