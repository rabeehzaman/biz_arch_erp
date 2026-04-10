import { prisma } from "@/lib/prisma";

const MAX_BOM_DEPTH = 10;

/**
 * Validate that adding the given component product IDs to a BOM for `productId`
 * does not create a circular reference. Uses DFS at save time.
 *
 * Throws an Error with a descriptive message if a cycle is detected.
 */
export async function validateNoCycle(
  organizationId: string,
  productId: string,
  componentProductIds: string[]
): Promise<void> {
  for (const componentId of componentProductIds) {
    // Direct self-reference
    if (componentId === productId) {
      throw new Error(
        `Circular reference: product cannot be a component of itself`
      );
    }

    // Check if this component's BOM tree leads back to productId
    const cyclePath = await findCycleDFS(
      organizationId,
      productId,
      componentId,
      [productId],
      0
    );

    if (cyclePath) {
      const pathStr = cyclePath.join(" → ");
      throw new Error(
        `Circular reference detected: ${pathStr}`
      );
    }
  }
}

/**
 * DFS traversal to detect if `currentProductId`'s BOM tree contains `targetProductId`.
 * Returns the cycle path if found, null otherwise.
 */
async function findCycleDFS(
  organizationId: string,
  targetProductId: string,
  currentProductId: string,
  path: string[],
  depth: number
): Promise<string[] | null> {
  if (depth >= MAX_BOM_DEPTH) return null;

  // Find active default BOM for this component
  const bom = await prisma.billOfMaterials.findFirst({
    where: {
      organizationId,
      productId: currentProductId,
      status: "ACTIVE",
      isDefault: true,
    },
    select: {
      items: {
        select: { productId: true },
      },
    },
  });

  if (!bom) return null;

  for (const item of bom.items) {
    const newPath = [...path, item.productId];

    if (item.productId === targetProductId) {
      return newPath;
    }

    const result = await findCycleDFS(
      organizationId,
      targetProductId,
      item.productId,
      newPath,
      depth + 1
    );

    if (result) return result;
  }

  return null;
}
