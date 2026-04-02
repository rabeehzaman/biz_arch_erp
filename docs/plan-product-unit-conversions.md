# Product-Level Unit Conversions — Implementation Plan

## Problem Statement

Currently, unit conversions (e.g., 1 CARTON = 12 PCS) are **global** — defined once and applied to every product. This causes two issues:

1. **Wrong conversions silently apply** — If CARTON = 12 globally, but Product X's carton is 10 pcs, users get wrong billing
2. **Dropdown clutter** — Every product shows ALL unit conversions, even irrelevant ones

## Design Decision

After evaluating Zoho Inventory's "Unit Groups" approach and other ERPs:

- **No global fallback on invoice dropdown** — each product explicitly defines its own alternate units
- **If a product has no alternate units defined**, invoice dropdown shows only the base unit
- **Global conversions remain** as a settings feature but are NOT used to auto-populate invoice dropdowns
- **Bulk assign tool** to reduce setup effort across many products

## Data Model

### New Table: `product_unit_conversions`

```
ProductUnitConversion
├── id              (String, CUID, PK)
├── productId       (FK → products.id, CASCADE delete)
├── unitId          (FK → units.id)        // The alternate unit (e.g., CARTON)
├── conversionFactor (Decimal 10,4)        // How many base units = 1 of this unit
├── barcode         (String, optional)      // Separate barcode for this pack size
├── price           (Decimal 10,2, optional) // Override price (for volume discounts)
├── organizationId  (FK → organizations.id)
├── createdAt
├── updatedAt
│
├── @@unique([productId, unitId])          // One conversion per unit per product
├── @@index([organizationId])
├── @@index([productId])
└── @@map("product_unit_conversions")
```

### Example Data

```
Product: "Chocolate Bar" (base unit: PCS, price: ₹10)

product_unit_conversions:
┌──────────┬─────────┬──────────────────┬───────────┬───────┐
│ productId│ unitId  │ conversionFactor │ barcode   │ price │
├──────────┼─────────┼──────────────────┼───────────┼───────┤
│ choc-1   │ outer   │ 6                │ 890123001 │ 55.00 │
│ choc-1   │ carton  │ 60               │ 890123002 │ 500.00│
└──────────┴─────────┴──────────────────┴───────────┴───────┘
```

### Relations

- `Product` → has many `ProductUnitConversion`
- `Unit` → has many `ProductUnitConversion`
- `Organization` → has many `ProductUnitConversion`

## How It Works

### On Invoice / Quotation / POS

```
1. User selects product "Chocolate Bar"
2. System checks: does this product have ProductUnitConversions?
   → YES: dropdown shows base unit + defined alternate units ONLY
   → NO:  dropdown shows only the base unit (no global fallback)
3. User selects CARTON
4. If product has override price (₹500): use that
   Else: auto-calculate base price × conversionFactor (₹10 × 60 = ₹600)
5. User enters quantity: 3
6. Line total: 3 × ₹500 = ₹1,500
7. Stock deduction: 3 × 60 = 180 PCS from inventory
```

### Barcode Scanning (POS + Invoice)

```
1. User scans barcode "890123002"
2. System looks up:
   a. Check product barcodes → no match
   b. Check product_unit_conversions.barcode → match! Product "Chocolate Bar", unit: CARTON
3. Auto-add to cart: Chocolate Bar × 1 CARTON @ ₹500
```

### Stock Always Tracked in Base Unit

No matter the billing unit, stock is always in base unit (PCS):
- Sell 3 CARTON → deduct 3 × 60 = 180 PCS
- Sell 2 OUTER → deduct 2 × 6 = 12 PCS
- Sell 5 PCS → deduct 5 × 1 = 5 PCS

---

## Implementation Phases

### Phase 1: Schema + API (Backend)

#### 1.1 Prisma Schema
**File:** `prisma/schema.prisma`
- Add `ProductUnitConversion` model (see Data Model above)
- Add `unitConversions ProductUnitConversion[]` relation to `Product` model
- Add `productUnitConversions ProductUnitConversion[]` relation to `Unit` model (named relation)
- Add `productUnitConversions ProductUnitConversion[]` relation to `Organization` model

#### 1.2 Migration
**File:** `prisma/migrations/YYYYMMDD_add_product_unit_conversions/migration.sql`
- CREATE TABLE `product_unit_conversions`
- CREATE UNIQUE INDEX on `(productId, unitId)`
- CREATE INDEX on `organizationId` and `productId`
- ADD FOREIGN KEY constraints

#### 1.3 Product API — Include Unit Conversions in Responses
**Files:**
- `src/app/api/products/route.ts` — GET (compact mode): include `unitConversions` in select
- `src/app/api/products/route.ts` — POST: accept `unitConversions` array, create via `createMany`
- `src/app/api/products/[id]/route.ts` — GET: include `unitConversions` in response
- `src/app/api/products/[id]/route.ts` — PUT: accept `unitConversions`, delete-and-recreate pattern

#### 1.4 Dedicated Product Unit Conversions API (for standalone management)
**New file:** `src/app/api/products/[id]/unit-conversions/route.ts`
- GET — fetch conversions for a specific product
- PUT — replace all conversions for a product (full replacement pattern)

#### 1.5 Bulk Apply API
**New file:** `src/app/api/product-unit-conversions/bulk/route.ts`
- POST — apply a unit conversion (e.g., CARTON = 12 PCS) to multiple products at once
- Body: `{ unitId, conversionFactor, barcode?, price?, productIds: string[] }`
- Uses `createMany` with `skipDuplicates` for efficiency

---

### Phase 2: Product Form UI

#### 2.1 Product Form Dialog — Add Conversions Section
**File:** `src/components/products/product-form-dialog.tsx`

Add a new section (below bundle items, above IMEI tracking) when `multiUnitEnabled`:

```
┌─────────────────────────────────────────────────┐
│ ↔ Alternate Units                    [+ Add]    │
│                                                  │
│ Defines how this product can be sold in          │
│ different pack sizes.                            │
│                                                  │
│ ┌────────────────────────────────────────────┐   │
│ │ Unit: [OUTER ▾]  Qty: [6] pcs             │   │
│ │ Barcode: [890123001]  Price: [55.00]  [🗑] │   │
│ └────────────────────────────────────────────┘   │
│ ┌────────────────────────────────────────────┐   │
│ │ Unit: [CARTON ▾]  Qty: [60] pcs           │   │
│ │ Barcode: [890123002]  Price: [500.00] [🗑] │   │
│ └────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────┘
```

**State additions:**
- `unitConversionEntries: UnitConversionEntry[]` — managed like `bundleItems`
- Fetch `allUnits` from `/api/units` for the unit dropdown (exclude the product's base unit)

**Payload changes:**
- Include `unitConversions` array in the POST/PUT body

#### 2.2 Product Interface Update
**File:** `src/components/products/product-form-dialog.tsx`
- Add `unitConversions` to the `Product` interface
- Load existing conversions when editing (`productToEdit.unitConversions`)

---

### Phase 3: Bulk Assign UI

#### 3.1 Products Page — Bulk Unit Conversion Action
**File:** `src/app/(dashboard)/products/page.tsx`

Add a bulk action button (alongside existing bulk delete) when products are selected:

```
[Selected: 15]  [Assign Unit Conversion]  [Delete]
```

Opens a dialog:
```
┌──────────────────────────────────────────┐
│ Assign Unit Conversion to 15 Products    │
│                                          │
│ Unit:        [CARTON ▾]                  │
│ = How many:  [12] (base units)           │
│ Barcode:     [optional]                  │
│ Price:       [optional]                  │
│                                          │
│              [Cancel]  [Apply to 15]     │
└──────────────────────────────────────────┘
```

#### 3.2 Bulk Assign Dialog Component
**New file:** `src/components/products/bulk-unit-conversion-dialog.tsx`
- Unit selector (exclude base unit of selected products — only show if all share same base unit)
- Conversion factor input
- Optional barcode and price
- Calls POST `/api/product-unit-conversions/bulk`

---

### Phase 4: Invoice / Document Forms

#### 4.1 Update Unit Options Builder (All 10 Form Pages)

**Core logic change** — in every form page where the unit dropdown is rendered:

```typescript
// BEFORE (current — uses global conversions):
const alternateOptions = unitConversions
  .filter(uc => uc.toUnitId === product.unitId)
  .map(uc => ({
    id: uc.fromUnitId,
    name: uc.fromUnit.name,
    conversionFactor: Number(uc.conversionFactor)
  }));
return [baseOption, ...alternateOptions];

// AFTER (new — uses product-level conversions):
const productConversions = product.unitConversions || [];
if (productConversions.length > 0) {
  const alternateOptions = productConversions.map(pc => ({
    id: pc.unitId,
    name: pc.unit.name,
    conversionFactor: Number(pc.conversionFactor),
    price: pc.price != null ? Number(pc.price) : null,
  }));
  return [baseOption, ...alternateOptions];
}
return [baseOption]; // No alternate units — just base
```

**Files to update (10 pages):**
1. `src/app/(dashboard)/invoices/new/page.tsx` — lines ~953-964 and ~1318-1321
2. `src/app/(dashboard)/invoices/[id]/edit/page.tsx` — similar block
3. `src/app/(dashboard)/quotations/new/page.tsx`
4. `src/app/(dashboard)/quotations/[id]/edit/page.tsx`
5. `src/app/(dashboard)/purchase-invoices/new/page.tsx`
6. `src/app/(dashboard)/purchase-invoices/[id]/edit/page.tsx`
7. `src/app/(dashboard)/credit-notes/new/page.tsx`
8. `src/app/(dashboard)/credit-notes/[id]/edit/page.tsx`
9. `src/app/(dashboard)/debit-notes/new/page.tsx`
10. `src/app/(dashboard)/debit-notes/[id]/edit/page.tsx`

#### 4.2 Update Price Calculation on Unit Change

When user selects an alternate unit:

```typescript
// BEFORE:
unitPrice: Number(product.price) * Number(altConversion.conversionFactor)

// AFTER:
const pc = product.unitConversions?.find(c => c.unitId === selectedUnitId);
if (pc) {
  unitPrice: pc.price != null
    ? Number(pc.price)                                       // Use override price
    : Number(product.price) * Number(pc.conversionFactor)    // Auto-calculate
}
```

#### 4.3 Remove Global Conversion Dependency from Forms

The `useUnitConversions()` hook is currently imported in all 10 form pages. After this change:
- **Remove** `useUnitConversions()` from invoice/quotation/purchase/credit/debit forms
- The hook and the `/api/unit-conversions` endpoint remain for the **Settings page** (managing global conversion rules for reference/template purposes)

---

### Phase 5: POS Terminal

#### 5.1 POS Products API — Include Unit Conversions
**File:** `src/app/api/pos/products/route.ts`
- Include `unitConversions` (with unit name, conversionFactor, barcode, price) in the product response

#### 5.2 POS Barcode Scanner — Support Alt-Unit Barcodes
**File:** `src/app/(pos)/pos/terminal/page.tsx`

Update `scanCodeIndex` to include product unit conversion barcodes:

```typescript
// BEFORE (lines 499-512):
const scanCodeIndex = useMemo(() => {
  const index = new Map<string, POSProduct>();
  for (const product of products) {
    if (product.barcode) index.set(product.barcode, product);
    if (product.sku) index.set(product.sku, product);
  }
  return index;
}, [products]);

// AFTER:
const scanCodeIndex = useMemo(() => {
  const index = new Map<string, { product: POSProduct; unitId?: string; conversionFactor?: number; price?: number }>();
  for (const product of products) {
    if (product.barcode) index.set(product.barcode, { product });
    if (product.sku) index.set(product.sku, { product });
    // Index alt-unit barcodes
    for (const uc of product.unitConversions || []) {
      if (uc.barcode) {
        index.set(uc.barcode, {
          product,
          unitId: uc.unitId,
          conversionFactor: Number(uc.conversionFactor),
          price: uc.price != null ? Number(uc.price) : null,
        });
      }
    }
  }
  return index;
}, [products]);
```

Update `addToCart` dispatch to support unit info when scanned via alt-unit barcode.

#### 5.3 POS Unit Selection in Cart (Optional — Phase 5b)

If POS needs to let cashier manually switch units (e.g., tap CARTON instead of PCS):
- Add unit selector on the cart item row
- Show only units defined for that product

---

### Phase 6: Stock & Backend Logic

#### 6.1 Stock Consumption (Already Correct)
**Files:**
- `src/app/api/invoices/route.ts` (line 482)
- `src/app/api/purchase-invoices/route.ts`

Current logic already uses `conversionFactor` from the line item:
```typescript
const baseQuantity = Number(invoiceItem.quantity) * Number(invoiceItem.conversionFactor);
```
This is **already correct** — the `conversionFactor` stored on the line item IS the product-level factor. No change needed here.

#### 6.2 Org Duplication
**File:** `src/app/api/admin/organizations/[id]/duplicate/route.ts`
- After duplicating products, also duplicate their `productUnitConversions`
- Map old productId → new productId, old unitId → new unitId

---

### Phase 7: i18n & Cleanup

#### 7.1 Translation Keys
**Files:** `src/locales/en.json`, `src/locales/ar.json`

New keys needed:
```json
{
  "products.alternateUnits": "Alternate Units",
  "products.addAlternateUnit": "Add Unit",
  "products.alternateUnitsDescription": "Define how this product can be sold in different pack sizes",
  "products.conversionFactor": "Qty in base unit",
  "products.overridePrice": "Pack price",
  "products.packBarcode": "Pack barcode",
  "products.noAlternateUnits": "No alternate units defined. Product will only be sold in base unit.",
  "products.bulkAssignConversion": "Assign Unit Conversion",
  "products.bulkAssignDescription": "Apply a unit conversion to selected products",
  "products.applyToN": "Apply to {n} products",
  "products.unitConversionApplied": "Unit conversion applied to {n} products"
}
```

#### 7.2 Cleanup
- Global `useUnitConversions()` hook — **keep** for settings page, **remove** from document form pages
- Global `/api/unit-conversions` — **keep** for settings management
- `ItemUnitSelect` component — no changes needed (already receives options as props)

---

## File Change Summary

| File | Action | Phase |
|------|--------|-------|
| `prisma/schema.prisma` | Add model + relations | 1 |
| `prisma/migrations/YYYYMMDD_.../migration.sql` | New migration | 1 |
| `src/app/api/products/route.ts` | Include unitConversions in GET/POST | 1 |
| `src/app/api/products/[id]/route.ts` | Include unitConversions in GET/PUT | 1 |
| `src/app/api/products/[id]/unit-conversions/route.ts` | **New** — CRUD for product conversions | 1 |
| `src/app/api/product-unit-conversions/bulk/route.ts` | **New** — Bulk assign endpoint | 1 |
| `src/components/products/product-form-dialog.tsx` | Add alternate units section | 2 |
| `src/app/(dashboard)/products/page.tsx` | Add bulk action button | 3 |
| `src/components/products/bulk-unit-conversion-dialog.tsx` | **New** — Bulk assign dialog | 3 |
| `src/app/(dashboard)/invoices/new/page.tsx` | Use product-level conversions | 4 |
| `src/app/(dashboard)/invoices/[id]/edit/page.tsx` | Use product-level conversions | 4 |
| `src/app/(dashboard)/quotations/new/page.tsx` | Use product-level conversions | 4 |
| `src/app/(dashboard)/quotations/[id]/edit/page.tsx` | Use product-level conversions | 4 |
| `src/app/(dashboard)/purchase-invoices/new/page.tsx` | Use product-level conversions | 4 |
| `src/app/(dashboard)/purchase-invoices/[id]/edit/page.tsx` | Use product-level conversions | 4 |
| `src/app/(dashboard)/credit-notes/new/page.tsx` | Use product-level conversions | 4 |
| `src/app/(dashboard)/credit-notes/[id]/edit/page.tsx` | Use product-level conversions | 4 |
| `src/app/(dashboard)/debit-notes/new/page.tsx` | Use product-level conversions | 4 |
| `src/app/(dashboard)/debit-notes/[id]/edit/page.tsx` | Use product-level conversions | 4 |
| `src/app/api/pos/products/route.ts` | Include unitConversions | 5 |
| `src/app/(pos)/pos/terminal/page.tsx` | Alt-unit barcode scanning | 5 |
| `src/app/api/invoices/route.ts` | No change (already correct) | 6 |
| `src/app/api/admin/organizations/[id]/duplicate/route.ts` | Copy product conversions | 6 |
| `src/locales/en.json` | New translation keys | 7 |
| `src/locales/ar.json` | New translation keys | 7 |
| `src/hooks/use-unit-conversions.ts` | Keep (settings only) | 7 |

**Total: 22 modified files, 3 new files**

---

## Migration Path for Existing Data

Existing global unit conversions and invoice line items are **not affected**:
- Old invoices keep their stored `conversionFactor` values (immutable once saved)
- Global conversions stay in the Settings page for reference
- New invoices will use product-level conversions going forward
- No data migration needed — purely additive

## Risk Assessment

| Risk | Mitigation |
|------|-----------|
| Users forget to set up conversions for a product | Dropdown shows only base unit — clear signal that no alternates are configured |
| Bulk apply overwrites existing per-product conversions | Bulk apply uses `skipDuplicates` — only adds missing ones |
| POS performance with extra barcode index | Trivial — just a few more Map entries per product |
| Old invoices with global conversion factors | Untouched — `conversionFactor` is stored on the line item at creation time |
