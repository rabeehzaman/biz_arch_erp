# Building a BOM and manufacturing module for multi-tenant cloud ERP

**A materials-only manufacturing module serving restaurant recipe deduction and light assembly can ship as a focused V1 by combining a versioned BOM schema, backflush-by-default production orders, and async POS ingredient deduction.** The design draws directly from ERPNext's BOM/Work Order doctypes, Odoo's `mrp.bom`/`mrp.production` models, and SAP Business One's OITT/ITT1 tables — all three converge on remarkably similar patterns. The recommendations below are specific to a Next.js 16 + PostgreSQL (Neon) + Prisma 7 stack with existing FIFO inventory, multi-warehouse support, and feature-flag module isolation.

---

## A. Schema design: the Prisma BOM model

The three major open-source/commercial ERPs model BOMs almost identically: a **header table** linking to the finished product with output quantity and status, and a **line table** with component references, quantities, UOM, and optional sub-BOM links. ERPNext's `BOM` doctype carries ~40 fields including `item`, `quantity`, `is_active`, `is_default`, `rm_cost_as_per`, and cost rollup fields. Odoo's `mrp.bom` uses `product_tmpl_id`, `product_qty`, `type` (normal vs phantom), and a `consumption` field controlling material flexibility. SAP B1's `OITT` header has `Code` (item), `Qauntity`, and `TreeType` (Production/Sales/Template/Assembly), with lines in `ITT1` carrying `Father`, `Code`, `Quantity`, and `Warehouse`.

**For versioning, use separate rows with a version number field** — not a revision history table. ERPNext uses an amendment mechanism where each version is a new document (BOM-Widget-001, BOM-Widget-002) with an `amended_from` link. Odoo simply creates new BOMs and archives old ones. A dedicated `version` integer on the BOM header is the cleanest approach for a modern schema — it avoids ERPNext's naming complexity while keeping a single queryable table.

### Recommended Prisma schema

```prisma
model Bom {
  id               String      @id @default(cuid())
  organizationId   String
  productId        String      // finished good
  name             String?     // e.g. "Standard Pizza Dough Recipe"
  version          Int         @default(1)
  status           BomStatus   @default(DRAFT) // DRAFT, ACTIVE, ARCHIVED
  isDefault        Boolean     @default(true)
  outputQuantity   Decimal     @default(1)  // units this BOM produces
  outputUomId      String?
  bomType          BomType     @default(MANUFACTURING)
  // MANUFACTURING, KIT (phantom — explodes on sale/delivery), RECIPE (auto-consume on POS)
  autoConsumeOnSale Boolean    @default(false) // recipe mode flag
  
  // Cost
  costingMethod    CostingMethod @default(VALUATION_RATE)
  totalMaterialCost Decimal?
  
  // Process loss
  processLossPercent Decimal?  @default(0)
  
  // Warehousing defaults
  defaultSourceWarehouseId String?
  defaultTargetWarehouseId String?
  
  // Extensibility
  metadata         Json        @default("{}")
  
  createdAt        DateTime    @default(now())
  updatedAt        DateTime    @updatedAt
  
  lines            BomLine[]
  byProducts       BomByProduct[]
  productionOrders ProductionOrder[]
  product          Product     @relation(fields: [productId], references: [id])
  organization     Organization @relation(fields: [organizationId], references: [id])
  
  @@unique([organizationId, productId, version])
  @@index([organizationId, productId, isDefault, status])
  @@index([organizationId, status])
}

model BomLine {
  id               String   @id @default(cuid())
  bomId            String
  componentId      String   // raw material or sub-assembly
  quantity         Decimal  // per BOM output quantity
  uomId            String?
  unitConversion   Decimal  @default(1) // stock UOM → line UOM factor
  wastagePercent   Decimal  @default(0) // planned waste (e.g. 5% = 0.05)
  position         Int      @default(0) // sort order
  isPhantom        Boolean  @default(false) // pass-through to parent
  subBomId         String?  // if component is sub-assembly, link its BOM
  
  // Cost snapshot
  unitCost         Decimal? 
  lineCost         Decimal? // quantity × unitCost × (1 + wastagePercent)
  
  // Backflush control per component
  issueMethod      IssueMethod @default(BACKFLUSH) // BACKFLUSH or MANUAL
  
  metadata         Json     @default("{}")
  
  bom              Bom      @relation(fields: [bomId], references: [id], onDelete: Cascade)
  component        Product  @relation(fields: [componentId], references: [id])
  subBom           Bom?     @relation("SubAssemblyBom", fields: [subBomId], references: [id])
  
  @@index([bomId])
  @@index([componentId])
}

model BomByProduct {
  id               String   @id @default(cuid())
  bomId            String
  productId        String
  quantity         Decimal
  uomId            String?
  costSharePercent Decimal  @default(0) // % of production cost allocated
  
  bom              Bom      @relation(fields: [bomId], references: [id], onDelete: Cascade)
  product          Product  @relation(fields: [productId], references: [id])
}

enum BomStatus { DRAFT ACTIVE ARCHIVED }
enum BomType { MANUFACTURING KIT RECIPE }
enum CostingMethod { VALUATION_RATE LAST_PURCHASE PRICE_LIST }
enum IssueMethod { BACKFLUSH MANUAL }
```

The **`autoConsumeOnSale`** flag (combined with `bomType: RECIPE`) is the key differentiator for the restaurant use case — it tells the POS checkout pipeline to fire ingredient deduction. The **`bomType`** enum mirrors Odoo's `type` field (`normal` vs `phantom`) but adds `RECIPE` as a first-class type for the food-service vertical. ERPNext's `is_phantom_bom` flag maps to the `isPhantom` boolean on `BomLine`, while Odoo's phantom behavior maps to `bomType: KIT` on the header.

---

## B. Production orders follow a five-state workflow

Every mature ERP converges on essentially the same manufacturing order lifecycle. ERPNext uses **Draft → Not Started → In Process → Completed → Stopped/Cancelled**. Odoo uses **Draft → Confirmed → In Progress → To Close → Done/Cancel**. SAP B1 uses **Planned → Released → Closed → Cancelled**. Dolibarr uses numeric states 0→1→2→3→9.

### Recommended status flow for V1

```
DRAFT → CONFIRMED → IN_PROGRESS → COMPLETED
  ↓         ↓            ↓
CANCELLED  CANCELLED   CANCELLED
```

```prisma
model ProductionOrder {
  id                String        @id @default(cuid())
  organizationId    String
  orderNumber       String        // auto-generated: MFG-WO-2026-0001
  bomId             String
  productId         String        // finished good (denormalized for fast query)
  
  plannedQuantity   Decimal
  completedQuantity Decimal       @default(0)
  scrapQuantity     Decimal       @default(0)
  
  status            ProductionStatus @default(DRAFT)
  
  sourceWarehouseId String        // raw materials
  targetWarehouseId String        // finished goods
  
  scheduledDate     DateTime?
  startedAt         DateTime?
  completedAt       DateTime?
  
  notes             String?
  metadata          Json          @default("{}")
  
  // V2 nullable FKs (extensibility)
  workCenterId      String?
  routingId         String?
  
  materialLines     ProductionMaterial[]
  bom               Bom           @relation(fields: [bomId], references: [id])
  organization      Organization  @relation(fields: [organizationId], references: [id])
  
  @@index([organizationId, status])
  @@index([organizationId, scheduledDate])
}

model ProductionMaterial {
  id                String   @id @default(cuid())
  productionOrderId String
  componentId       String
  plannedQuantity   Decimal  // from BOM × production qty
  consumedQuantity  Decimal  @default(0) // actual
  issueMethod       IssueMethod @default(BACKFLUSH)
  warehouseId       String?
  
  productionOrder   ProductionOrder @relation(fields: [productionOrderId], references: [id], onDelete: Cascade)
  component         Product  @relation(fields: [componentId], references: [id])
  
  @@index([productionOrderId])
}

enum ProductionStatus { DRAFT CONFIRMED IN_PROGRESS COMPLETED CANCELLED }
```

**Backflushing should be the default, with manual override per component.** ERPNext offers both modes via Manufacturing Settings (`backflush_raw_materials_based_on: "BOM"` vs `"Material Transferred for Manufacture"`), plus a `skip_transfer` flag that enables pure backflush. Odoo pre-fills quantities from the BOM but lets operators adjust before validation — a practical hybrid. For small/mid-market manufacturers, pure backflush eliminates the two-step transfer-then-consume workflow that confuses users. The `issueMethod` field on `BomLine` and `ProductionMaterial` allows flagging expensive or critical components as `MANUAL` while commodity items auto-consume.

### Scrap and waste tracking

ERPNext tracks planned waste via `scrap` percentage on BOM items and `process_loss_percentage` on the BOM header. Actual waste is captured through Stock Entry documents where `is_scrap_item = true`. Odoo uses the `stock.scrap` model attached to manufacturing orders and controls consumption tolerance via the `consumption` field (flexible/warning/strict). For V1, **store planned wastage on the BOM line (`wastagePercent`) and actual scrap on the production order (`scrapQuantity`)**. The variance between `plannedQuantity × (1 + wastagePercent)` and `consumedQuantity` gives waste analysis without a separate scrap model.

### By-products and partial completion

Odoo's `mrp.bom.byproduct` model with a **`cost_share`** percentage field is the cleanest pattern — it allocates a portion of production cost to secondary outputs. ERPNext's newer `BOMSecondaryItem` doctype follows the same pattern with `cost_allocation_per`. The `BomByProduct` model above handles this.

For partial completion, Odoo creates a **backorder** manufacturing order for the remaining quantity when a user produces less than planned. ERPNext tracks `produced_qty` against `qty` and allows the order to stay `In Process` until full completion. **For V1, support partial completion by allowing `completedQuantity < plannedQuantity` while keeping status as `IN_PROGRESS`** — simpler than Odoo's backorder splitting.

### Skip work centers and routing for V1

**Work centers, routing, and operation sequences are over-engineering for a materials-only MVP.** Katana MRP launched without them and added operations years later. Odoo gates routing behind a Settings toggle (`with_operations` flag on BOM). ERPNext makes operations optional. The nullable `workCenterId` and `routingId` FKs on `ProductionOrder` provide the extension point without V1 implementation cost.

---

## C. Auto-consumption on POS sale: async deduction with cached recipes

Research across Toast, Square, Lightspeed, and Odoo reveals two dominant patterns for restaurant ingredient deduction, and a clear winner for POS performance.

**Toast** deducts ingredient counts when an order fires to the kitchen (not at payment), uses xtraCHEF for deep recipe tracking, and **allows negative stock** — orders are never blocked. Their menu sync to third-party platforms runs on a **3–5 minute eventual consistency** cycle. **Lightspeed Restaurant** has the tightest integration: ingredients deduct automatically at sale with support for nested recipes (pizza dough as sub-recipe of pizza) and automatic 86ing when stock hits zero. **Square** has no native ingredient tracking — it delegates entirely to MarketMan, which deducts ingredients asynchronously when sales events arrive. **Odoo** recommends using **Kit-type BOMs** (phantom) for restaurant POS, where components are exploded into stock moves on order completion, with an explicit warning that "component reduction occurs without monitoring component availability."

### Recommended architecture: synchronous order + asynchronous deduction

```
POS Sale Submitted
  → [SYNC] Persist order + line items (single DB transaction, <100ms)
  → [SYNC] Return success to POS terminal immediately
  → [ASYNC] Emit "OrderCompleted" event to job queue
  → [ASYNC] Worker: resolve recipe BOMs from cache, compute deductions
  → [ASYNC] Worker: batch-UPDATE ingredient stock (single SQL statement)
  → [ASYNC] Worker: check low-stock thresholds, emit alerts
```

This keeps POS checkout under **200ms** while handling the potentially heavy work of resolving multi-level recipes and updating 5–20 ingredient rows asynchronously. Use **pgBoss** or **graphile-worker** as the job queue — both run on PostgreSQL directly, avoiding additional infrastructure on Neon.

### Cache recipe/BOM data aggressively

A typical restaurant has **100–300 menu items × 5–8 ingredients each = 500–2,400 recipe lines**. This fits trivially in memory or Redis. Load all active recipes with `autoConsumeOnSale = true` at POS session start. Invalidate on recipe updates. The async worker reads from this cache, not the database, for recipe resolution.

### Batch ingredient deductions into one SQL statement

Instead of N separate UPDATE queries per order line, use PostgreSQL's `UPDATE ... FROM (VALUES ...)` pattern:

```sql
UPDATE stock_lots
SET quantity = quantity - d.amount, updated_at = NOW()
FROM (VALUES ($1::uuid, $2::numeric), ($3::uuid, $4::numeric), ...) 
  AS d(lot_id, amount)
WHERE stock_lots.id = d.lot_id;
```

This collapses 15+ ingredient updates into **one round-trip** to the database.

### Out-of-stock handling: allow negative, warn staff

Toast, Odoo Kit BOMs, and the majority of restaurant POS systems **allow negative stock** because blocking a sale when the cook has already prepped the dish creates worse problems than a negative inventory count. **Default to allowing negative stock for recipe-type BOMs**, with a configurable policy per ingredient:

- **`ALLOW_NEGATIVE`** (default for restaurants): Sale goes through; negative stock logged for variance reporting
- **`WARN_LOW`**: POS shows a yellow indicator when ingredient is below threshold; staff decides
- **`BLOCK_AT_ZERO`**: Item auto-86'd from POS menu and online ordering channels

The real value lies in **Actual vs. Theoretical (AvT) variance reporting** — comparing theoretical consumption (from recipes × sales) against actual counted stock.

### Modifier-based recipe variations

MarketMan (Square's integration) and Lightspeed both model modifiers with their own ingredient effects. The critical data model pattern uses a **`change_type`** field distinguishing absolute additions from multiplicative scaling:

```prisma
model ModifierIngredientEffect {
  id             String     @id @default(cuid())
  modifierId     String     // "Extra Cheese" modifier
  componentId    String     // cheese ingredient
  quantityChange Decimal    // +30 (grams) or 0.5 (multiplier)
  changeType     ChangeType // ABSOLUTE, MULTIPLY, REPLACE
  uomId          String?
  
  modifier       Modifier   @relation(fields: [modifierId], references: [id])
  component      Product    @relation(fields: [componentId], references: [id])
}

enum ChangeType { ABSOLUTE MULTIPLY REPLACE }
```

**"Extra cheese"** maps to `ABSOLUTE` with `quantityChange = +30g`. **"Half portion"** maps to `MULTIPLY` with `quantityChange = 0.5` applied to all recipe lines. **"No onions"** maps to `REPLACE` with `quantityChange = 0`. This covers the full spectrum of restaurant modifier patterns in a single, clean model.

---

## D. Cost calculation: weighted average with cascading fallback

**Use weighted average (moving average) as the default costing method** for manufactured items, with an optional manual standard cost override. In a materials-only MVP without labor or overhead, the main complexity of standard costing (labor rates, overhead allocation, variance accounting) does not apply. Weighted average auto-updates on each purchase receipt and production completion, requiring zero maintenance from users. ERPNext uses moving average as its default valuation method; Odoo defaults to standard price but auto-recalculates from production for AVCO-configured products.

### Zero-stock cost fallback chain

When computing BOM costs and a component has zero stock on hand (therefore no current valuation rate), apply this cascading fallback — modeled after ERPNext's `rm_cost_as_per` options but with automatic progression:

1. **Current valuation rate** (moving average from stock ledger)
2. **Last purchase price** (most recent purchase order/receipt)
3. **Manual standard cost** (user-defined on product)
4. **Zero** — with a visible warning flag on the BOM cost display

ERPNext does not auto-fallback — it silently uses zero, which corrupts BOM costs. Odoo uses the manually-set Cost field as fallback. The cascading approach prevents silent zero-cost errors.

### Production completion should auto-update moving average cost

When a production order completes, the finished good enters inventory at a cost equal to the sum of consumed materials. For moving average costing: `new_avg_cost = (existing_qty × old_cost + produced_qty × production_cost) / total_qty`. ERPNext does this via its Manufacture stock entry. Odoo recalculates the weighted average for AVCO products. **Add a `costFrozen` boolean on the product** — when true, auto-update is suppressed, giving users an escape hatch for volatile production runs.

### Multi-level cost rollup via recursive CTE

PostgreSQL recursive CTEs handle multi-level BOM cost rollup in a single query with built-in cycle detection:

```sql
WITH RECURSIVE bom_tree AS (
  SELECT bl.component_id AS item_id, bl.quantity AS qty,
         p.valuation_rate AS unit_cost, 1 AS depth,
         ARRAY[b.product_id, bl.component_id] AS path
  FROM boms b
  JOIN bom_lines bl ON bl.bom_id = b.id
  JOIN products p ON p.id = bl.component_id
  WHERE b.product_id = $1 AND b.is_default = true 
    AND b.status = 'ACTIVE' AND b.organization_id = $2
  UNION ALL
  SELECT bl.component_id, bl.quantity * bt.qty,
         p.valuation_rate, bt.depth + 1,
         bt.path || bl.component_id
  FROM bom_tree bt
  JOIN boms b ON b.product_id = bt.item_id AND b.is_default = true
    AND b.status = 'ACTIVE'
  JOIN bom_lines bl ON bl.bom_id = b.id
  JOIN products p ON p.id = bl.component_id
  WHERE bt.depth < 10
    AND NOT (bl.component_id = ANY(bt.path))  -- cycle guard
)
SELECT SUM(qty * unit_cost) AS total_material_cost FROM bom_tree
WHERE NOT EXISTS (
  SELECT 1 FROM boms b WHERE b.product_id = bom_tree.item_id 
    AND b.is_default = true AND b.status = 'ACTIVE'
);  -- only leaf nodes
```

For BOMs queried frequently, **cache the rolled-up cost on the BOM header** (`totalMaterialCost`) and invalidate on BOM edit or component cost change. ERPNext uses a bottom-up propagation pattern — when a child BOM's cost changes, it finds all parent BOMs referencing it and triggers recalculation upward through the tree.

---

## E. Multi-level BOM: cycles, depth limits, and phantom assemblies

### Circular reference detection at save time

Both ERPNext and Odoo validate for circular references **at BOM creation/update time**, not at runtime. ERPNext's `check_recursion()` uses BFS traversal of all child BOMs (cached in Redis) and raises a custom `BOMRecursionError`. Odoo's `_check_bom_cycle()` uses DFS graph-based cycle detection triggered by `@api.constrains` on BOM write.

**Implement DFS validation in application code when saving a BOM**, plus a defensive `NOT (component_id = ANY(path))` guard in all recursive CTEs. The application-layer check gives clear error messages ("Adding Component X would create a circular reference: A → B → C → A"). The CTE guard prevents runaway queries if validation is ever bypassed.

```typescript
async function validateNoCycle(
  organizationId: string, productId: string, componentIds: string[]
): Promise<void> {
  const visited = new Set<string>();
  
  async function dfs(currentId: string): Promise<boolean> {
    if (currentId === productId) return true; // cycle found
    if (visited.has(currentId)) return false;
    visited.add(currentId);
    
    const childBom = await prisma.bom.findFirst({
      where: { organizationId, productId: currentId, isDefault: true, status: 'ACTIVE' },
      include: { lines: { select: { componentId: true } } }
    });
    
    for (const line of childBom?.lines ?? []) {
      if (await dfs(line.componentId)) return true;
    }
    return false;
  }
  
  for (const componentId of componentIds) {
    if (await dfs(componentId)) {
      throw new Error(`Circular reference: ${componentId} leads back to ${productId}`);
    }
  }
}
```

### Depth limits: default to 10

Neither ERPNext nor Odoo enforces an explicit max depth — both rely on cycle detection to prevent infinite recursion. Microsoft Dynamics NAV/Business Central uses a hard limit of **50 levels**. SAP's SQL Server recursive CTEs default to `MAXRECURSION 100`. For small/mid-market manufacturing, **BOMs rarely exceed 3–5 levels**. Set a default limit of **10** (configurable per tenant up to 20), enforced in the recursive CTE's `WHERE depth < max_depth` clause.

### Phantom BOMs pass components through to the parent

Odoo implements phantom BOMs via the `type = 'phantom'` field on `mrp.bom` — when a phantom BOM's product appears as a component, the `explode()` method recursively replaces it with its own components. No manufacturing order is created for phantoms; no stock is maintained. ERPNext has `is_phantom_bom` on the BOM header and `do_not_explode` per line item.

**Model phantoms as `bomType: KIT` on the BOM header or `isPhantom: true` on the BOM line.** During BOM explosion for production orders, any component flagged as phantom is recursively replaced with its sub-components, quantities multiplied through. The SQL pattern adds `WHERE item_type = 'phantom'` to the recursive CTE's join condition so only phantom items are exploded — non-phantom sub-assemblies stop the recursion and appear as line items to manufacture or procure separately.

---

## F. Integration with purchasing and bundle migration

### MRP-lite: reorder points plus production demand

A full MRP net-requirements run is overkill for V1. Instead, implement a **purchase suggestion query** that nets current stock, open purchase orders, and demand from active production orders:

```sql
SELECT p.id, p.name, p.sku,
  COALESCE(stock.qty, 0) AS on_hand,
  COALESCE(po.qty, 0) AS on_order,
  COALESCE(demand.qty, 0) AS production_demand,
  p.reorder_point,
  GREATEST(0, 
    p.reorder_point + COALESCE(demand.qty, 0) 
    - COALESCE(stock.qty, 0) - COALESCE(po.qty, 0)
  ) AS suggested_purchase
FROM products p
LEFT JOIN (...) stock ON ...
LEFT JOIN (...) po ON ...
LEFT JOIN (
  SELECT pm.component_id, SUM(pm.planned_quantity - pm.consumed_quantity) AS qty
  FROM production_materials pm
  JOIN production_orders o ON o.id = pm.production_order_id
  WHERE o.status IN ('CONFIRMED', 'IN_PROGRESS')
  GROUP BY pm.component_id
) demand ON demand.component_id = p.id
WHERE p.organization_id = $1 AND suggested_purchase > 0;
```

This mirrors ERPNext's Production Plan → Material Request flow without the complexity of time-phased netting.

### Migrating bundles to BOM

Since the existing system has product bundles (fixed-quantity component kits that auto-deduct on sale), these map directly to **BOM with `bomType: KIT` and `autoConsumeOnSale: true`**. The migration strategy:

1. **Add `migratedToBomId`** nullable FK to the existing bundle table
2. **Run data migration** creating a BOM per active bundle, with bundle lines → BOM lines
3. **Dual-read period**: API endpoints check BOM first, fall back to bundle
4. **Deprecate bundle endpoints** after verification
5. **Drop bundle tables** in a later release

The `bomType` enum (`MANUFACTURING` vs `KIT` vs `RECIPE`) replaces the separate bundle concept entirely — a KIT-type BOM explodes into components on sale (identical to current bundle behavior), while a RECIPE-type BOM triggers ingredient deduction, and a MANUFACTURING-type BOM requires an explicit production order.

---

## G. UI/UX that works for small manufacturers

### BOM form: inline table with search-as-you-type

Every ERP uses the same core pattern: an **inline editable grid** for BOM components with a typeahead search field for product selection. ERPNext added a dedicated **tree-view BOM Creator** in v15 because users found navigating between multiple BOM forms for multi-level structures tedious. Katana keeps it minimal — BOM lives as a tab within the product card.

**For V1, build the inline table editor** (the universal pattern all users expect). Add a **read-only tree visualization** for multi-level BOMs — defer interactive tree editing to V2. Key columns: Component (typeahead search), Quantity, UOM, Waste %, Unit Cost (auto-filled), Line Cost (computed), and a sub-BOM indicator icon for components that have their own BOMs.

### Production dashboard: list view with Kanban option

Odoo's manufacturing module defaults to a **Kanban view** with columns per status. Katana uses a **visual schedule with color-coded availability**. MRPeasy uses a **list/calendar hybrid**. For V1:

- **Primary view: filterable list** with status badges, product name, quantity, scheduled date, and a material availability indicator (green/yellow/red)
- **Secondary view: 4-column Kanban** (Draft → Confirmed → In Progress → Completed)
- **Defer**: Gantt charts, calendar view, capacity planning

The **material availability indicator** is Katana's most praised feature — an at-a-glance color showing whether all, some, or no required materials are in stock.

### Cost display and mobile

Show cost breakdown as a **table within the BOM form** — each line shows component, quantity, unit cost, waste factor, and extended cost. Summary shows total material cost and cost per unit of output. Odoo and ERPNext both use this table-first approach. Defer pie/waterfall charts to V2.

For mobile, use **responsive web design** (not a native app). Show a simplified production order card view on small screens: product name, quantity, status, and a large "Mark Complete" button. Katana's Shop Floor Control app uses barcode scanning, but this is a V2+ feature.

---

## H. What to skip for V1 and how to stay extensible

Katana MRP launched in 2017 with a 2-developer team shipping only inventory, BOMs, manufacturing orders, and sales order management. Work centers, batch tracking, shop floor apps, and advanced operations were added years later. Odoo gates complex features behind Settings toggles — routing, by-products, quality, and subcontracting each require explicit activation.

### V1 feature classification

**Keep for V1:** Single and multi-level BOMs, BOM versioning, kit/phantom BOMs, recipe-type BOMs with auto-consume, production orders with 5-state workflow, backflush material consumption with manual override, basic scrap tracking, by-products with cost share, weighted average costing with BOM cost rollup, material availability checking, purchase suggestion query, bundle → BOM migration, list + Kanban dashboard, inline BOM editor, responsive mobile layout.

**Defer to V2+:** Work centers and workstations (add nullable FK now), routing and operation sequences (add nullable FK now), labor time tracking, overhead allocation, quality checks and inspections, subcontracting, capacity planning, Gantt scheduling, full MRP net-requirements run, serial number tracking in production, batch/lot traceability through production, shop floor kiosk/terminal mode, barcode scanning, configurable/matrix BOMs, tree-view BOM editor.

### Schema extensibility patterns

Three patterns ensure deferred features bolt on without painful migrations:

- **Nullable foreign keys** on `ProductionOrder` for `workCenterId`, `routingId`, `qualityCheckId` — the columns exist from day one but are unused until the feature activates
- **JSONB `metadata` columns** on every major entity — stores tenant-specific custom fields, integration data, and future feature prototypes without schema changes
- **Feature flag table** (`OrganizationFeature` with `featureKey` + `enabled` + `config JSON`) controlling which modules are visible per tenant, matching the existing feature-flag module isolation pattern

Odoo uses `ir.model.fields` for dynamic field addition; the JSONB approach gives similar flexibility without Odoo's meta-programming complexity, and Prisma supports `Json` type natively.

---

## Conclusion

The core architectural insight is that **restaurant recipe deduction and manufacturing work orders are the same BOM with different consumption triggers**. A recipe-type BOM fires on POS sale (async, queue-based, allowing negative stock). A manufacturing-type BOM fires on explicit production order completion (backflush by default). A kit/phantom-type BOM fires on delivery/sale by exploding components. This unified model — captured in the `bomType` and `autoConsumeOnSale` fields — lets one schema serve bakeries, assembly shops, and restaurants equally.

The Prisma schema above maps directly to patterns proven in production across ERPNext (~15 years), Odoo (~10 years of MRP module), and SAP B1. The key departures from those systems are intentional simplifications: version numbers instead of ERPNext's amendment chains, a single `BomLine` table instead of Odoo's computed `child_bom_id` magic, and explicit `bomType` enum instead of SAP's opaque `TreeType` character codes. These choices optimize for a TypeScript/Prisma developer experience while preserving the data model rigor that makes ERP manufacturing modules reliable.