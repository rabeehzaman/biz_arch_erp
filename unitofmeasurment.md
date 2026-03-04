# Multi-UoM in a Node.js ERP: schema, logic, and battle-tested patterns

**Store all inventory in the smallest indivisible base unit, convert at transaction boundaries, and use decimal arithmetic everywhere.** This single architectural principle — proven across ERPNext, Odoo, Oracle, SAP, and JD Edwards — prevents the majority of rounding errors, simplifies inventory queries, and keeps valuation accurate. The recommended approach combines Odoo's category-based global conversions with ERPNext's product-specific conversion overrides, implemented in TypeScript with `decimal.js` for precision. Below is a complete implementation guide with production-ready schemas, conversion services, and API patterns.

## Database schema: categories, units, and product-specific conversions

The schema follows a hybrid pattern used by Oracle Inventory and Microsoft Dynamics 365: a **base-unit-per-category** system for standard physical conversions (kg → g, m → cm) layered with **product-specific overrides** for packaging units where "1 box" means different quantities per product. Every transaction table stores dual quantities — the user-facing transaction UoM and the computed base-unit equivalent — so inventory aggregation never requires runtime conversion.

### Core UoM tables

```sql
-- Groups related units: Weight, Volume, Count/Unit, Length
CREATE TABLE uom_category (
    id              SERIAL PRIMARY KEY,
    name            VARCHAR(100) NOT NULL UNIQUE,
    description     TEXT,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Individual units, each belonging to one category.
-- Exactly ONE reference (base) unit per category where factor_to_base = 1.0
CREATE TABLE uom (
    id              SERIAL PRIMARY KEY,
    category_id     INTEGER NOT NULL REFERENCES uom_category(id) ON DELETE RESTRICT,
    name            VARCHAR(100) NOT NULL,
    symbol          VARCHAR(20) NOT NULL,
    uom_type        VARCHAR(20) NOT NULL DEFAULT 'bigger'
                        CHECK (uom_type IN ('reference', 'bigger', 'smaller')),
    -- How many BASE units equal 1 of THIS unit
    -- Example: if base = gram, then kg factor_to_base = 1000.0
    factor_to_base  NUMERIC(20, 10) NOT NULL DEFAULT 1.0
                        CHECK (factor_to_base > 0),
    -- Minimum rounding granularity (1.0 for pieces, 0.001 for kg)
    rounding        NUMERIC(12, 6) NOT NULL DEFAULT 0.001,
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (category_id, symbol),
    UNIQUE (category_id, name)
);

-- Enforce exactly one reference unit per category
CREATE UNIQUE INDEX uom_one_reference_per_category
    ON uom (category_id) WHERE uom_type = 'reference';

-- Reference unit must have factor = 1.0
ALTER TABLE uom ADD CONSTRAINT chk_reference_factor
    CHECK (
        (uom_type = 'reference' AND factor_to_base = 1.0)
        OR uom_type != 'reference'
    );
```

**`NUMERIC(20, 10)` is non-negotiable for conversion factors.** Odoo historically used floats and encountered bugs where a factor of 3000 drifted to 3003.003 through inverse calculations. PostgreSQL's `NUMERIC` type provides exact decimal arithmetic. Use `NUMERIC(18, 6)` for quantities and `NUMERIC(18, 4)` for monetary amounts.

### Product tables with triple-UoM linkage

```sql
CREATE TABLE product (
    id              SERIAL PRIMARY KEY,
    sku             VARCHAR(50) NOT NULL UNIQUE,
    name            VARCHAR(255) NOT NULL,
    stock_uom_id    INTEGER NOT NULL REFERENCES uom(id),    -- base inventory unit
    purchase_uom_id INTEGER NOT NULL REFERENCES uom(id),    -- default for PO lines
    sales_uom_id    INTEGER NOT NULL REFERENCES uom(id),    -- default for SO lines
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Product-specific conversion factors override global category conversions.
-- This is what makes "1 box of Product A = 12 pcs" while
-- "1 box of Product B = 24 pcs" work correctly.
CREATE TABLE product_uom_conversion (
    id              SERIAL PRIMARY KEY,
    product_id      INTEGER NOT NULL REFERENCES product(id) ON DELETE CASCADE,
    from_uom_id     INTEGER NOT NULL REFERENCES uom(id),
    to_uom_id       INTEGER NOT NULL REFERENCES uom(id),
    factor          NUMERIC(20, 10) NOT NULL CHECK (factor > 0),
    -- 1 from_uom = factor × to_uom
    is_active       BOOLEAN NOT NULL DEFAULT TRUE,
    effective_date  DATE,
    expiry_date     DATE,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (product_id, from_uom_id, to_uom_id)
);
```

This mirrors ERPNext's `UOM Conversion Detail` child table, where each item carries its own conversions. ERPNext stores conversion_factor with **9 decimal places of precision** and defines the factor as: `1 [transaction UoM] = conversion_factor × [stock_uom]`. Odoo takes a different approach — conversions are globally fixed per UoM relative to a category reference unit, forcing workarounds like creating "Pallet(500kg)" and "Pallet(1080kg)" as separate UoMs when packaging varies by product. The product-specific override table eliminates this limitation.

### Transaction tables with dual-quantity storage

Every transaction line stores both the user-entered quantity in the transaction UoM and the auto-calculated base quantity. This pattern is universal across Oracle, JD Edwards, Dynamics 365, SAP, and ERPNext.

```sql
CREATE TABLE purchase_order_line (
    id              SERIAL PRIMARY KEY,
    po_id           INTEGER NOT NULL REFERENCES purchase_order(id) ON DELETE CASCADE,
    product_id      INTEGER NOT NULL REFERENCES product(id),
    -- What the user entered
    quantity        NUMERIC(18, 6) NOT NULL CHECK (quantity > 0),
    uom_id          INTEGER NOT NULL REFERENCES uom(id),
    -- Auto-calculated base equivalent
    base_quantity   NUMERIC(18, 6) NOT NULL CHECK (base_quantity > 0),
    base_uom_id     INTEGER NOT NULL REFERENCES uom(id),
    -- Conversion factor snapshot (frozen at transaction time)
    conversion_factor NUMERIC(20, 10) NOT NULL,
    unit_price      NUMERIC(18, 6) NOT NULL,
    line_total      NUMERIC(18, 4) GENERATED ALWAYS AS (quantity * unit_price) STORED,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Inventory always stores base-unit quantities only
CREATE TABLE inventory_stock (
    id              SERIAL PRIMARY KEY,
    product_id      INTEGER NOT NULL REFERENCES product(id),
    warehouse_id    INTEGER NOT NULL,
    quantity_on_hand    NUMERIC(18, 6) NOT NULL DEFAULT 0,
    uom_id              INTEGER NOT NULL REFERENCES uom(id),
    avg_cost_per_unit   NUMERIC(18, 6),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    UNIQUE (product_id, warehouse_id)
);

-- FIFO layers for cost tracking
CREATE TABLE inventory_layer (
    id              SERIAL PRIMARY KEY,
    product_id      INTEGER NOT NULL REFERENCES product(id),
    warehouse_id    INTEGER NOT NULL,
    date_received   TIMESTAMPTZ NOT NULL,
    quantity_remaining  NUMERIC(18, 6) NOT NULL,
    cost_per_unit       NUMERIC(18, 6) NOT NULL,
    source_document_type VARCHAR(50),
    source_document_id   INTEGER
);
```

**Snapshotting the `conversion_factor` on each transaction line** is critical. ERPNext does this explicitly — every `Purchase Invoice Item` and `Sales Order Item` stores the conversion factor used at transaction time. If a conversion factor changes later (e.g., a supplier changes box sizes), historical transactions remain accurate and auditable.

### Barcode-to-UoM mapping table

Each barcode maps to a specific (product, UoM) tuple, not just a product. Per GS1 standards, every packaging level requires a unique GTIN — the same product at consumer-unit, inner-pack, case, and pallet levels gets different barcodes.

```sql
CREATE TABLE product_barcode (
    id          SERIAL PRIMARY KEY,
    product_id  INTEGER NOT NULL REFERENCES product(id),
    uom_id      INTEGER NOT NULL REFERENCES uom(id),
    barcode     VARCHAR(50) NOT NULL UNIQUE,
    barcode_type VARCHAR(20) DEFAULT 'EAN13'
                    CHECK (barcode_type IN ('EAN13','UPC_A','ITF14','GS1_128','DATAMATRIX')),
    is_primary  BOOLEAN NOT NULL DEFAULT FALSE,
    created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
```

When a barcode is scanned at POS or receiving, the system auto-populates both product and UoM — no manual unit selection needed. Oracle Cloud SCM's 2025 release implements exactly this: scanning a GTIN populates item number and UoM simultaneously. For products where multiple packages share the same EAN (common with store brands), implement a disambiguation prompt.

## Conversion logic: hub-and-spoke with product overrides

The recommended conversion architecture follows a three-tier priority system used by Oracle Inventory and JD Edwards:

1. **Product-specific conversion** — check first (e.g., 1 box of Product A = 12 pcs)
2. **Global category-based conversion** — fall back to base-unit hub-and-spoke (e.g., 1 kg = 1000 g)
3. **Error** — never silently assume 1:1

All conversions within a category route through the base unit: Source UoM → Base UoM → Target UoM. This requires only N-1 conversion factors instead of N×(N-1)/2 direct pairs. Odoo's core conversion formula captures this cleanly: `amount = qty / self.factor * to_unit.factor`, where each factor is relative to the category's reference unit.

### PostgreSQL conversion function

```sql
CREATE OR REPLACE FUNCTION convert_quantity(
    p_product_id    INTEGER,
    p_from_uom_id   INTEGER,
    p_to_uom_id     INTEGER,
    p_quantity       NUMERIC
) RETURNS NUMERIC AS $$
DECLARE
    v_factor        NUMERIC;
    v_from_uom      RECORD;
    v_to_uom        RECORD;
BEGIN
    IF p_from_uom_id = p_to_uom_id THEN RETURN p_quantity; END IF;

    -- Priority 1: Product-specific direct conversion
    SELECT factor INTO v_factor
    FROM product_uom_conversion
    WHERE product_id = p_product_id
      AND from_uom_id = p_from_uom_id AND to_uom_id = p_to_uom_id
      AND is_active = TRUE
      AND (effective_date IS NULL OR effective_date <= CURRENT_DATE)
      AND (expiry_date IS NULL OR expiry_date >= CURRENT_DATE);
    IF v_factor IS NOT NULL THEN RETURN p_quantity * v_factor; END IF;

    -- Check reverse direction
    SELECT factor INTO v_factor
    FROM product_uom_conversion
    WHERE product_id = p_product_id
      AND from_uom_id = p_to_uom_id AND to_uom_id = p_from_uom_id
      AND is_active = TRUE;
    IF v_factor IS NOT NULL THEN RETURN p_quantity / v_factor; END IF;

    -- Priority 2: Global category-based conversion via base unit
    SELECT * INTO v_from_uom FROM uom WHERE id = p_from_uom_id;
    SELECT * INTO v_to_uom FROM uom WHERE id = p_to_uom_id;
    IF v_from_uom.category_id != v_to_uom.category_id THEN
        RAISE EXCEPTION 'Cannot convert between categories % and %',
            v_from_uom.name, v_to_uom.name;
    END IF;
    RETURN p_quantity * v_from_uom.factor_to_base / v_to_uom.factor_to_base;
END;
$$ LANGUAGE plpgsql STABLE;
```

### Rounding: the "decimal dust" problem

The most pervasive real-world UoM bug is **rounding error accumulation**. A documented SAP case: when a 6-unit case is the base UoM, selling one unit = 1/6 = 0.167 cases. After 6 individual sales, residual "decimal dust" of −0.002 cases appears as phantom negative inventory. The fix is straightforward: **always make the smallest sellable unit the base UoM**. Converting upward to cases always yields clean integers; converting downward from cases to pieces is exact multiplication.

Odoo implements per-UoM rounding precision with a configurable rounding method (UP, DOWN, HALF-UP). Every `uom.uom` record carries a `rounding` field (default 0.01) that controls the minimum granularity — you cannot have 0.5 pieces but can have 0.5 kg. This is worth replicating in any custom implementation.

**Round only once, at the final step.** Multiple intermediate rounds cascade errors. If you display 3 decimal places for quantities, use 10+ for conversion factors and intermediate calculations.

## TypeScript conversion service and API patterns for Node.js

### The conversion service

The `UomConversionService` class handles all unit math, using `decimal.js` for precision and BFS for transitive conversions (e.g., pallet → carton → piece through intermediate units). This mirrors the graph-based conversion approach proposed in ERPNext PR #15865.

```typescript
import Decimal from 'decimal.js';

Decimal.set({ precision: 20, rounding: Decimal.ROUND_HALF_UP });

interface ConversionResult {
  originalQuantity: Decimal;
  originalUom: string;
  convertedQuantity: Decimal;
  targetUom: string;
  conversionFactor: Decimal;
}

class UomConversionService {
  private graph: Map<string, Map<string, Decimal>> = new Map();

  registerConversion(fromUom: string, toUom: string, factor: string | number): void {
    const f = new Decimal(factor);
    if (!this.graph.has(fromUom)) this.graph.set(fromUom, new Map());
    if (!this.graph.has(toUom)) this.graph.set(toUom, new Map());
    this.graph.get(fromUom)!.set(toUom, f);
    this.graph.get(toUom)!.set(fromUom, new Decimal(1).div(f));
  }

  convert(quantity: string | number, fromUom: string, toUom: string): ConversionResult {
    if (fromUom === toUom) {
      const qty = new Decimal(quantity);
      return { originalQuantity: qty, originalUom: fromUom,
               convertedQuantity: qty, targetUom: toUom,
               conversionFactor: new Decimal(1) };
    }
    const factor = this.findFactor(fromUom, toUom);
    if (!factor) throw new Error(`No conversion path: ${fromUom} → ${toUom}`);
    const qty = new Decimal(quantity);
    return { originalQuantity: qty, originalUom: fromUom,
             convertedQuantity: qty.times(factor), targetUom: toUom,
             conversionFactor: factor };
  }

  /** Price conversion is the INVERSE of quantity conversion */
  convertPrice(price: string, fromUom: string, toUom: string): Decimal {
    const factor = this.findFactor(fromUom, toUom);
    if (!factor) throw new Error(`No conversion: ${fromUom} → ${toUom}`);
    return new Decimal(price).div(factor);
  }

  /** BFS for transitive conversions (pallet → carton → box → piece) */
  private findFactor(from: string, to: string): Decimal | null {
    const direct = this.graph.get(from)?.get(to);
    if (direct) return direct;
    const visited = new Set<string>([from]);
    const queue: { uom: string; factor: Decimal }[] = [
      { uom: from, factor: new Decimal(1) }
    ];
    while (queue.length > 0) {
      const { uom, factor } = queue.shift()!;
      const neighbors = this.graph.get(uom);
      if (!neighbors) continue;
      for (const [next, nextFactor] of neighbors) {
        if (next === to) return factor.times(nextFactor);
        if (!visited.has(next)) {
          visited.add(next);
          queue.push({ uom: next, factor: factor.times(nextFactor) });
        }
      }
    }
    return null;
  }
}
```

For standard physical unit conversions (kg ↔ lb, m ↔ ft), the **`convert-units`** npm package (~15.7M weekly downloads) supports custom unit definitions via plain JS objects and provides full TypeScript generics. Use it alongside the database-backed service for ERP-specific packaging conversions. For pure decimal arithmetic, **`decimal.js`** (~39.9M weekly downloads) is the standard; `big.js` (6KB) is a lighter alternative if you only need basic math.

### REST API design

API endpoints accept quantities in any valid UoM for a product and return both the transaction quantity and the base-unit equivalent:

```typescript
// POST /api/v1/purchase-orders
interface PurchaseOrderLineRequest {
  productId: string;
  quantity: string;        // '10'
  uomCode: string;         // 'CS' — purchase in cases
  unitPrice: string;       // '45.00' per case
}

// Response includes computed base quantities
interface PurchaseOrderLineResponse {
  id: string;
  productId: string;
  orderedQuantity: { quantity: string; uomCode: string };   // { '10', 'CS' }
  baseQuantity: { quantity: string; uomCode: string };      // { '240', 'EA' }
  conversionFactor: string;                                  // '24'
  unitPrice: string;
  lineTotal: string;
}

// GET /api/v1/inventory/:productId — returns stock in base UoM
// with on-the-fly conversion to all valid alternative UoMs
interface InventoryResponse {
  productId: string;
  baseQuantity: { quantity: string; uomCode: string };
  availableIn: { quantity: string; uomCode: string }[];  // same qty in all UoMs
  unitCost: string;
  totalValue: string;
}
```

**Backward compatibility rule**: if no UoM is specified in an API call, assume the base UoM. This keeps existing integrations working when multi-UoM is added to a system.

## Inventory valuation stays in base units

Whether you use weighted average cost (WAC) or FIFO, **all valuation happens in the base UoM**. The conversion service translates purchase prices to per-base-unit costs at receipt time; the valuation engine never sees alternative units.

**WAC example**: Buy 10 cases at $45/case where 1 case = 24 each. Convert: 240 each at $1.875/each ($45 ÷ 24). Existing stock: 100 each at $2.00. New WAC = (100 × $2.00 + 240 × $1.875) ÷ 340 = **$1.9118/each**. Sale of 5 boxes (1 box = 12 each = 60 each): COGS = 60 × $1.9118 = $114.71.

```typescript
class WeightedAverageCostService {
  recalculateWAC(
    existingQty: string, existingCost: string,
    receivedQty: string, receivedCost: string
  ): string {
    const eQ = new Decimal(existingQty), eC = new Decimal(existingCost);
    const rQ = new Decimal(receivedQty), rC = new Decimal(receivedCost);
    const totalValue = eQ.times(eC).plus(rQ.times(rC));
    const totalQty = eQ.plus(rQ);
    if (totalQty.isZero()) return '0';
    return totalValue.div(totalQty).toFixed(6);
  }
}
```

For FIFO, maintain an `inventory_layer` table where each receipt creates a new layer with its base-unit quantity and cost. Sales consume layers oldest-first, all arithmetic in base units. The multi-UoM aspect is invisible to the valuation engine — it only sees base-unit quantities flowing in and out.

## How ERPNext and Odoo compare architecturally

| Aspect | ERPNext | Odoo (≤18) |
|--------|---------|------------|
| **Conversion scope** | Per-item (each item defines its own factors) | Global (fixed factor per UoM relative to category reference) |
| **Schema** | `UOM Conversion Detail` child table on each Item | `factor` field on `uom.uom` model |
| **Category enforcement** | None — UoMs are flat | Strict same-category-only conversion |
| **Product UoM fields** | `stock_uom`, `purchase_uom`, `sales_uom` | `uom_id` (inventory/sales), `uom_po_id` (purchase) |
| **Transaction line** | Stores `uom`, `conversion_factor`, `stock_qty` | Stores `product_uom_id`, computes via `_compute_quantity()` |
| **Rounding** | 9-decimal precision on factor | Per-UoM `rounding` field + configurable method (UP/DOWN/HALF-UP) |
| **Conversion formula** | `stock_qty = qty × conversion_factor` | `amount = qty / self.factor * to_unit.factor` |

ERPNext's per-item approach is **more flexible for packaging-heavy businesses** where "1 box" varies by product. Odoo's global approach is simpler but forces workarounds. The recommended hybrid schema in this guide combines both: global category-based conversions for standard physical units, product-specific overrides for packaging. No mature Node.js open-source ERP currently implements multi-UoM at this level — IDURAR and EasyERP only support single-unit products, which is why building from these proven patterns matters.

Odoo 19 (released 2025) overhauled its UoM model significantly, replacing the `factor`/`uom_type` system with a simpler `relative_uom_id` + `ratio` pair, eliminating the reference/bigger/smaller type system entirely. This suggests the industry is moving toward more direct, less constrained conversion models.

## Pitfalls, migration, and operational considerations

**The five most dangerous mistakes** in multi-UoM implementations, drawn from real-world SAP, ERPNext, and JD Edwards incidents:

- **Using a large unit as the base UoM.** If "case of 6" is your base unit, individual-piece sales produce 0.167 increments that accumulate rounding dust. Always choose the **smallest indivisible unit** as base.
- **Insufficient decimal precision on conversion factors.** ERPNext's conversion_factor field once defaulted to 3 decimal places. For a steel plate where 1 plate = 400 sq ft, the factor 0.0025 stored as 0.003 — a **20% error with no system warning**.
- **Changing conversion factors after transactions exist.** Once a conversion factor is used in a posted transaction, changing it corrupts historical data. Lock factors after first use; version new factors forward-only with effective dates.
- **Scattered conversion logic.** Inline conversion math across modules guarantees inconsistency. Centralize in a single tested service that all modules call.
- **Assuming linear volume/weight scaling.** SAP data shows a pallet of 4 pieces at 0.2 m³ each has volume 1.152 m³ — not 0.8 m³ — because of packaging overhead. Support per-UoM weight/volume overrides.

### Migration strategy for existing single-unit systems

Adding multi-UoM to an existing ERP follows a four-phase approach:

**Phase 1 — Schema extension**: Add `uom_category`, `uom`, and `product_uom_conversion` tables. Add `base_uom_id` to products. Add `uom_id`, `base_quantity`, `base_uom_id`, and `conversion_factor` columns to all transaction line tables. UoM codes must be defined before conversion data — respect dependency ordering.

**Phase 2 — Data backfill**: Set every product's `base_uom_id` to its current implicit unit (usually "each"). Backfill all existing transaction lines with the base UoM and a conversion factor of 1.0. Populate conversion tables with known relationships. Validate rigorously — run the migration multiple times in a test environment before production.

**Phase 3 — Application changes**: Add UoM selectors to all quantity input fields. Route all conversions through the centralized service. Update inventory queries to return base-unit quantities with display-layer conversion.

**Phase 4 — Phased rollout**: Enable multi-UoM in purchasing first (where vendor UoMs are most pressing), then sales, then warehouse. Default all UoM fields to the base unit so existing workflows see no change until users actively select alternative UoMs. If no UoM is specified in API calls, assume base UoM for backward compatibility. Use feature flags to run old and new logic in parallel during validation.

### Stock display and POS scanning

Display stock in the item's default stocking unit with toggleable columns for alternative units, computed on the fly from the single base quantity. **Never pre-compute and store** converted values in multiple UoMs — this creates synchronization issues. For POS, map each barcode to a specific (product, UoM) tuple so scanning auto-populates both fields. Use EAN-13/UPC-A for consumer units, ITF-14 for cases (robust on corrugated board), and GS1-128 for warehouse operations encoding lot and expiry alongside GTIN.

## Conclusion

The multi-UoM problem is fundamentally solved in the ERP industry. The architecture is well-established: category-based global conversions for physical units, product-specific overrides for packaging, dual storage on every transaction line, and base-unit-only inventory. What makes implementations fail is not missing architecture but operational mistakes — insufficient decimal precision, wrong base-unit choices, and scattered conversion logic. A Node.js implementation built on `decimal.js` for arithmetic, the hybrid schema above, and a centralized `UomConversionService` with BFS traversal for transitive conversions gives you the same capabilities as ERPNext and Odoo in a JavaScript stack. The key insight from production systems is that **conversion factors belong to products, not just to units** — "1 box" is meaningless without knowing which product is inside it. Build your schema around that reality, snapshot factors at transaction time, and you'll avoid the pitfalls that plague less disciplined implementations.