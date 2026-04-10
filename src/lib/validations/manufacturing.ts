import { z } from "zod";

// ── BOM Validation Schemas ──────────────────────────────────────

export const bomItemSchema = z.object({
  productId: z.string().min(1, "Component product is required"),
  quantity: z.number().positive("Quantity must be positive"),
  quantityType: z.enum(["ABSOLUTE", "PERCENTAGE"]).default("ABSOLUTE"),
  unitId: z.string().optional().nullable(),
  wastagePercent: z.number().min(0).max(100).default(0),
  issueMethod: z.enum(["BACKFLUSH", "MANUAL"]).default("BACKFLUSH"),
  isPhantom: z.boolean().default(false),
  sortOrder: z.number().int().min(0).default(0),
  notes: z.string().optional().nullable(),
});

export const createBOMSchema = z.object({
  productId: z.string().min(1, "Output product is required"),
  name: z.string().min(1, "BOM name is required"),
  bomType: z.enum(["MANUFACTURING", "RECIPE", "KIT"]).default("MANUFACTURING"),
  outputQuantity: z.number().positive("Output quantity must be positive").default(1),
  autoConsumeOnSale: z.boolean().default(false),
  consumptionPolicy: z.enum(["ALLOW_NEGATIVE", "WARN", "BLOCK"]).default("WARN"),
  processLossPercent: z.number().min(0).max(100).default(0),
  unitId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  items: z.array(bomItemSchema).min(1, "At least one component is required"),
});

export const updateBOMSchema = createBOMSchema.partial().omit({ productId: true });

// ── Production Order Validation Schemas ─────────────────────────

export const createProductionOrderSchema = z.object({
  bomId: z.string().min(1, "BOM is required"),
  plannedQuantity: z.number().positive("Planned quantity must be positive"),
  plannedDate: z.string().optional().nullable(),
  sourceWarehouseId: z.string().optional().nullable(),
  outputWarehouseId: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
});

export const completeProductionSchema = z.object({
  completionQuantity: z.number().positive("Completion quantity must be positive"),
  scrapQuantity: z.number().min(0).default(0),
});

export type CreateBOMInput = z.infer<typeof createBOMSchema>;
export type UpdateBOMInput = z.infer<typeof updateBOMSchema>;
export type BOMItemInput = z.infer<typeof bomItemSchema>;
export type CreateProductionOrderInput = z.infer<typeof createProductionOrderSchema>;
export type CompleteProductionInput = z.infer<typeof completeProductionSchema>;
