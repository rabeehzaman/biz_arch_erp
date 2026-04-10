# BOM and Manufacturing Module Design for a Multi‑Tenant Cloud ERP

## Context and design goals

You’re not “adding a module.” You’re adding a second, **manufacturing-shaped interpretation** of inventory movement, where a single business event (a work order completion or a POS sale) can expand into many stock movements, each of which must obey FIFO lots and remain auditable across tenants and branches. Mature ERPs tend to treat BOMs as *blueprints* (often immutable once used), and production orders as *stock-movement orchestrators* with clear “commit points” where inventory is reserved/issued/produced. citeturn1view0turn2view0turn21view0turn12view0

Two design anchors from the systems you referenced:

- **ERPNext**: BOMs are submitted documents (not freely editable) and the manufacturing workflow is heavily tied to stock entries/warehouse movements (e.g., WIP → Finished Goods), plus explicit work order statuses. citeturn1view0turn2view0turn16view1  
- **Odoo**: Manufacturing Orders have explicit states (Draft → Confirmed → In Progress → To Close → Done/Cancelled), BOMs include configuration that controls component availability/consumption strictness, and partial completion is handled through manufacturing backorders. citeturn12view0turn8view0turn4view0

For your stack (Next.js + Postgres + Prisma) and your existing FIFO stock-lot system, the **core goal** is: *every inventory-impacting event must be recorded as a deterministic, idempotent set of stock movements derived from BOM/production logic; and those derived movements must remain reproducible for audit, even when BOMs change later.* This mirrors the “don’t edit what has already been used; create a new revision” philosophy you see in both ERPNext and Odoo. citeturn1view0turn14view1

## BOM data model and versioning strategy

### Recommended schema shape

Use **(1) a BOM “header” per revision** plus **(2) BOM component/operation child tables**, and treat revisions as **immutable after activation/use**. This aligns closely with how ERPNext and Odoo behave in practice: they strongly discourage in-place edits once a BOM has been used, and lean toward “archive and create a new BOM” or “cancel/amend” patterns. citeturn1view0turn14view1turn16view0

A practical Postgres schema (conceptual) for your multi-tenant case:

```sql
-- BOM revision (one row per revision)
bom_revision (
  id uuid pk,
  org_id uuid not null,
  produced_product_id uuid not null,        -- your product/variant id
  produced_uom_id uuid not null,
  output_qty numeric not null default 1,    -- batch size / yield basis
  status text not null,                     -- DRAFT | ACTIVE | ARCHIVED
  revision_no int not null,                 -- 1..N per product
  amended_from_id uuid null,                -- lineage
  effective_from timestamptz null,
  effective_to timestamptz null,
  auto_consume_on_sale bool not null default false,
  is_phantom bool not null default false,   -- "kit/phantom" behavior
  allow_negative_consumption bool not null default false,
  consumption_policy text not null default 'warning', -- allowed|warning|blocked (see notes)
  notes text null,
  created_at timestamptz not null,
  created_by uuid not null
);

-- Component lines
bom_component (
  id uuid pk,
  org_id uuid not null,
  bom_revision_id uuid not null fk,
  line_no int not null,
  component_product_id uuid not null,
  component_uom_id uuid not null,
  qty_per_output numeric not null,
  wastage_pct numeric not null default 0,   -- planned scrap/yield loss
  issue_method text not null default 'auto',-- auto|manual (or pick/backflush)
  consumed_in_operation_id uuid null,       -- optional (routing)
  allow_substitute bool not null default false,
  is_optional bool not null default false,
  notes text null
);

-- Optional: byproducts / secondary outputs
bom_byproduct (
  id uuid pk,
  org_id uuid not null,
  bom_revision_id uuid not null fk,
  byproduct_product_id uuid not null,
  byproduct_uom_id uuid not null,
  qty_per_output numeric not null,
  produced_in_operation_id uuid null
);

-- Optional: routing/operations
bom_operation (
  id uuid pk,
  org_id uuid not null,
  bom_revision_id uuid not null fk,
  sequence int not null,
  name text not null,
  work_center_id uuid null,
  planned_minutes numeric null,
  cost_rate numeric null
);
```

Key multi-tenant constraints and indexes you’ll want:

- `unique (org_id, produced_product_id, revision_no)` and `unique (org_id, produced_product_id) where status='ACTIVE'` (enforce only one active revision per product per org).  
- `index (org_id, produced_product_id, status)` for “find active BOM fast”.  
- `index (org_id, bom_revision_id, line_no)` for deterministic ordering.  

This matches the “one active/default BOM” idea in ERPNext (`is_active`, `is_default`) and Odoo’s “active BOM + selection/finding logic,” but adapted to your explicit state machine. citeturn16view1turn14view0turn12view0

### Separate rows vs revision-history table

**Recommendation: separate rows for each revision (immutable), plus a lineage pointer (`amended_from`)**.

Reasons (practical, not philosophical):

- **Audit reproducibility**: a production order or sale should point to a specific BOM revision row so you can reproduce the exploded components forever, even if the “current” recipe changes. ERPNext explicitly uses an “Amended From” link field on BOM, which supports this lineage approach. citeturn16view0  
- **Operational safety**: Odoo warns that editing a used BOM/kit structure can create “undesirable behaviours,” and suggests archiving/creating a new one instead. That’s basically “new row, new revision.” citeturn14view1  
- **Query simplicity**: “give me active BOM for product X” stays a simple indexed query, not “latest row in history + join to history lines.”

A fully separate “revision history table” (append-only change log) is still useful—but only as an *optional audit trail* of edits in draft, not as the canonical versioning mechanism.

### How major ERPs model BOMs

**ERPNext**  
ERPNext’s BOM DocType includes flags like **Is Active**, **Is Default**, and **Is Phantom BOM**, and has an **Amended From** field for lineage. citeturn16view1turn17view0turn16view0  
The user docs emphasize that after submission you typically can’t just freely edit; changes are handled via cancel/duplicate/resubmit patterns. citeturn1view0  
ERPNext also models **operations/routing** and cost breakdown fields (raw material cost, operating cost, “secondary items” tables) directly on the BOM and related manufacturing docs. citeturn1view0turn17view2turn17view0

**Odoo**  
Odoo’s `mrp.bom` model has an `active` flag and a `type` field with values **normal (“Manufacture this product”)** and **phantom (“Kit”)**, plus `bom_line_ids`, `operation_ids`, and `byproduct_ids`. citeturn14view0  
Odoo also performs explicit **BOM cycle detection** at the model constraint level and raises a blocking error if a cycle would be created. citeturn38view1

**SAP Business One**  
SAP Business One represents BOMs as “product trees” (BOMs) in the DI API: **ProductTrees** maps to source table **OITT**, and **ProductTrees_Lines** maps to **ITT1**. citeturn24view3turn24view2  
SAP’s official learning material also describes multi-level BOMs, phantom items (subassemblies not stocked but expanded into components in production orders), and multiple BOM “types” (Production vs Sales/Assembly/Template) that affect whether the BOM is used for manufacturing or just sales/marketing documents. citeturn21view0

**Dolibarr**  
Dolibarr’s BOM + Manufacturing Orders modules are explicitly positioned as **BOMs + MRP**, where manufacturing orders can be generated from predefined BOMs, produced in one or several steps, and “virtual stock” is recalculated considering open manufacturing orders. citeturn27view0turn27view1turn27view2

## Manufacturing execution workflow and inventory posting

### Status workflow you should implement

Your proposed workflow (DRAFT → PLANNED → IN_PROGRESS → COMPLETED) is a solid spine. The “mature ERP” upgrade is to add one or two statuses that represent real operational checkpoints:

**Recommended statuses (small/mid-market friendly):**

- **DRAFT**: editable; no stock impact; BOM snapshot not frozen yet.  
- **PLANNED**: “intent recorded”; optionally reserve stock; schedule date set.  
- **RELEASED** (optional but valuable): commitment point—BOM revision frozen, component list frozen (unless you allow substitutions), and you can start issuing/picking. This maps conceptually to SAP B1’s “Planned vs Released” distinction. citeturn29view0  
- **IN_PROGRESS**: production started; partially issued/consumed/produced allowed. Odoo explicitly uses “In Progress” and ERPNext uses “In Process.” citeturn12view0turn2view0  
- **TO_CLOSE** (optional): everything is produced but needs review/close (Odoo uses “To Close”). citeturn12view0  
- **COMPLETED**: finished goods lots created, inventory posted.  
- **CANCELLED**: terminal state; no further posting. Odoo and SAP B1 both treat cancel as terminal. citeturn12view0turn29view0

If you implement only one “extra” state, pick **RELEASED** (or “CONFIRMED”) because it gives you a clean moment to: freeze the BOM revision, lock the component set, and prevent silent cost/movement surprises later. Odoo’s MO state help text is basically this idea: *Confirmed triggers reordering/stock rules; In Progress means started; Done means moves posted.* citeturn12view0

### Partial completion and backorders

If you support partial completion, don’t treat it as a weird edge case—treat it as a first-class workflow that creates *a continuation order* for the remainder.

Odoo’s documented approach is: when a user produces less than demand, Odoo splits the MO and creates a **backorder** for the remaining quantity, keeping per-order traceability. citeturn8view0

Actionable recommendation:

- Add **`completed_qty`** and **`remaining_qty`** fields and a “Create Backorder” action that clones the order with the remaining quantity and links it via `parent_mo_id`.  
- Freeze the same BOM revision (or require re-confirmation if the BOM revision changed and you want to allow updating). Odoo tracks “Outdated BoM” flags to signal BOM changed since MO creation. citeturn12view0

### Backflushing vs manual issue

You should support both, but default to one for v1.

What mature systems do:

- Odoo supports configuration that effectively spans the spectrum:
  - “one-step manufacturing” where transfers aren’t tracked as separate pick/store documents (inventory counts still update),  
  - “two-step” with a **pick components** transfer,  
  - plus BOM settings like **Manual Consumption** and flexible/strict consumption policies. citeturn37view0turn37view4turn4view0  
- ERPNext can separate “Material Transfer” and “Manufacture” entries, and scrap-from-BOM behavior depends on how manufacture entries are created (indicating different consumption paths). citeturn36view0turn2view0

**Recommendation for your v1:**
- Implement **Issue-at-start (pick/issue)** as the default for manufacturing orders (especially for multi-warehouse/branch), because it makes FIFO allocation and “what’s on the floor/WIP” auditable.
- Also implement **Backflush-at-completion** as an optional mode (per BOM or per production order) for simple shops/food prep where operators don’t want to click “issue” for every order—*but keep the posting moment explicit at completion so you can still compute actual FIFO costs.* Odoo’s distinction between MO “cost” vs “real cost” reinforces the idea that “estimated plan” and “actual consumption” can diverge. citeturn35view2turn35view0

### Scrap/waste and by-products

Treat “scrap” as two different things:

- **Planned scrap/wastage** (a BOM attribute: wastage %, expected yield loss). ERPNext explicitly supports scrap estimates in BOM and accounts scrap into scrap warehouses at completion. citeturn36view0turn1view0  
- **Actual scrap events** (operator records what was scrapped, when, and from where). Odoo models scrap as a movement to a virtual scrap location and supports scrapping components during Draft/Confirmed, and scrapping finished goods after Done. citeturn31view1turn31view2

For by-products, you *either* model them in v1 or you don’t—half-support is painful. If your user base includes bakeries, butchers, or any process that naturally outputs secondary goods, by-products quickly become “not optional.”

- Odoo supports by-products by configuring them on a BOM; when an MO is marked Done, it registers quantities and shows them in product moves. citeturn33view0  
- ERPNext’s BOM schema includes “secondary items” and related cost fields, which can serve a similar purpose (secondary outputs/cost allocation). citeturn17view2turn17view0

**Recommendation (small/mid-market pragmatic):**
- v1: implement **planned wastage %** on BOM lines + **actual scrap posting** as a simple “scrap stock entry” event.  
- v1.5: implement **by-products** only if you can also answer “how do we allocate cost across outputs?” (see costing section). Odoo handles by-products operationally, but cost allocation still needs business rules. citeturn33view0turn35view2

## Auto-consumption on sale and recipe mode

### How systems approach “sell the parent, consume the components”

This is where your module overlaps with “kits/bundles,” but the intent is different:

- **Odoo Kits (phantom BOM type)**: sold as a kit, but inventory/delivery is component-based, and kits can’t be sold if a component is out of stock (depending on configuration). citeturn5view0turn14view0  
- **SAP Business One Sales BOM**: selecting the parent in a sales document expands components as sub-items; you can adjust quantities but can’t remove/add components in the sales document (for Sales BOM), and you may hide components on printouts. citeturn21view0  
- **Restaurant inventory platforms**: “stock depletion” based on sales and recipe data is a common pattern; for example entity["company","Toast","restaurant pos company"] documents ingredient stock depletion in real-time based on sales + recipes. citeturn43search0

Your `autoConsumeOnSale` flag is essentially choosing the “kit/sales BOM” semantics at invoice/POS time—except you want FIFO-lot cost correctness and high checkout performance.

### Real-time ingredient deduction patterns in restaurant systems

A few consistent patterns show up across vendor docs:

- Real-time depletion is marketed as “decrement stock on hand based on sales and recipe data,” providing fast low-stock visibility. citeturn43search0turn43search10  
- Recipe systems often distinguish between “made to order” vs “batch” and still automatically update ingredient inventory when the item is ordered on POS. citeturn43search5  
- Costing commonly uses fallback rules when recipe/ingredient cost data is incomplete; for example entity["company","Lightspeed","pos and commerce company"] states a chain like: use recipe cost if available, else average cost price (from purchases), else fixed cost price. citeturn43search9  
- Modifier mapping matters: entity["company","xtraCHEF","restaurant inventory software"] references mapping menu items and modifiers to recipe modifiers to compute theoretical consumption and par levels. citeturn43search16

### Actionable architecture for your POS performance constraints

**Recommendation: don’t do full FIFO allocation inside the POS checkout transaction.** Do the minimum inside checkout, and post the detailed consumption in an idempotent background pipeline *immediately after* sale commit.

A design that stays fast and correct:

1. **At checkout commit** (single DB transaction):
   - Write invoice/POS sale lines (as you do today).
   - For each sale line that has `autoConsumeOnSale`, write a “consumption intent” row:
     - `sale_line_id`, `org_id`, `bom_revision_id`, `qty_sold`, `portion_factor`, `modifiers_hash`, `status='PENDING'`.
   - Optionally do a *lightweight availability check* using a cached “theoretical inventory” view (see below) and apply your policy (block/warn/allow negative). This mirrors Odoo’s idea of configurable “Blocked / Allowed / Allowed with warning” consumption constraints—just applied to sales depletion instead of manufacturing. citeturn4view0turn12view0  

2. **In a fast post-commit worker**:
   - Explode the BOM (base recipe + modifier deltas).
   - Allocate FIFO lots and create the real consumption records + stock movements.
   - Mark the intent row as `POSTED` (idempotent: unique constraint on `sale_line_id`).

This matches how vendor ecosystems often integrate: sales events are captured immediately, then inventory depletion is applied reliably from those events. citeturn43search10turn43search4

### Out-of-stock ingredients: warn vs block vs allow negative

Implement this as a **policy field** because customers vary wildly:

- **BLOCK**: prohibit sale if any required ingredient is unavailable. This is consistent with Odoo kit behavior where kits can’t be sold if a required component is out of stock. citeturn5view0  
- **WARN**: allow sale but display a warning (and optionally tag the ticket/order for kitchen purchasing attention). This mirrors Odoo’s “Allowed with warning” approach to consumption exceptions. citeturn4view0turn14view0  
- **ALLOW_NEGATIVE**: allow sale and let inventory go negative, but require later reconciliation. This is common in high-throughput restaurants where “don’t block checkout” is the prime directive; the real system is periodic counts + variance analysis (theoretical vs actual). citeturn43search8turn43search0

Implementation detail that matters for FIFO correctness: if you allow negative, you need a costing fallback for “consumption without lots” (see costing section). citeturn43search9turn35view4

### Portion scaling and modifier-based recipe variation

For scaling, do it like manufacturing batch scaling:

- Define the BOM on an **output basis** (e.g., recipe yields 1 portion, or yields 1 tray/pan). Odoo explicitly stores BOM `product_qty` as “the smallest quantity produced in,” which is exactly the scaling anchor you want. citeturn14view0  
- At sale time compute `scale = qty_sold / output_qty`, then multiply each component’s `qty_per_output * scale`, applying wastage. This is straightforward and consistent with BOM semantics in Odoo and ERPNext. citeturn14view0turn1view0

For modifiers, model them as a delta on top of the base explosion:

- `modifier_add(component_id, qty_delta)`  
- `modifier_replace(component_from, component_to, qty_factor)`  
- `modifier_multiplier(component_id, factor)`  

Systems that care about modifier detail explicitly map modifiers to recipe modifiers for theoretical consumption. citeturn43search16  
On the POS data side, modifier combinations can effectively create distinct “menu item variants” (some platforms concatenate modifier selections into distinct item names/rows), which is one realistic way to keep recipe mapping deterministic. citeturn43search3

## Costing and cost rollup

### Standard vs actual vs average for manufactured items

Across the ERPs you cited, you can see three cost “layers”:

- **Expected/standard cost from BOM** (plan cost). SAP Business One explicitly discusses generating/setting product price from component prices and resource cost at the BOM level. citeturn21view0  
- **Actual cost based on what really happened** (real consumption). Odoo distinguishes “MO cost” (what it should cost from BOM config) vs “real cost” (what it actually cost after real time/quantity/cost differences). citeturn35view2turn35view4  
- **Rolling average / ongoing product cost** that updates as more orders complete. Odoo states it tracks average manufacturing cost based on completed MOs and updates the product’s cost field accordingly. citeturn35view4

Given you already have FIFO lots, your best-for-audit baseline is:

- **Actual lot cost** for each finished goods lot = sum(cost of consumed component lots) + optional overhead allocations.

Then you can optionally compute:

- **Product “standard cost”** as either (a) configurable static standard, or (b) moving average of completed lots, or (c) last lot cost.

This aligns with Odoo’s “average manufacturing cost updates over time” idea, but your implementation will be more “ledger-native” because FIFO lots already carry cost. citeturn35view4

### Handling missing stock and fallback costs

You need a deterministic rule when depletion occurs without real lots (negative stock scenarios, or ingredients never received into stock properly).

A vendor-style fallback ladder you can adopt (and expose in settings), inspired by entity["company","Lightspeed","pos and commerce company"]:

1. Use the ingredient’s **recipe cost** (if you support it).  
2. Else use **average cost price** derived from purchases.  
3. Else use a **fixed cost price** configured on the item. citeturn43search9

In manufacturing (not POS), you can tighten this by defaulting to “BLOCK” consumption without stock lots for FIFO-tracked items—your customers who truly need FIFO auditability usually prefer an operational error over silent imputed costing. Odoo’s strict consumption mode is essentially that idea: “Blocked.” citeturn14view0turn12view0

### Should production completion update standard cost?

**Recommendation: yes, but only if the organization chooses an “average/auto-update” costing policy.**

Odoo does exactly this: it updates the product’s cost over time using completed MO costs (average manufacturing cost), and it provides a “Compute Price from BoM” action to reset to expected BOM cost, while warning that future MOs will still update cost. citeturn35view4

So: implement three policies per product category (or per item):

- **Never auto-update standard cost** (manual standard cost users).  
- **Update via moving average of completed lots** (common SMB preference).  
- **Set standard cost to last completed lot cost** (simple, sometimes good enough).

Your FIFO lot costs remain the source of truth for COGS; the “standard cost” is primarily for quoting/margin expectations and reporting. citeturn35view0turn21view0

### Labor and overhead allocation

Whether you include labor/overhead is a product decision, not a technical one—but the systems show you a clean path:

- Odoo’s manufacturing cost calculation includes components, operations, work center operating costs, and employee costs, and distinguishes estimated vs real. citeturn35view2turn35view3  
- SAP Business One’s BOM examples include resources (machines and employee time) and routed stages; that’s the “full costing” direction. citeturn21view0  
- ERPNext BOM includes operating cost fields and supports operations/routings. citeturn17view0turn1view0

**Recommendation for v1:** ship **materials-only actual cost** (because you already have FIFO lots), and add a **single optional overhead rate** later (e.g., % of materials, or fixed per unit), before you attempt full routings + labor capture. This sequencing matches what many SMB deployments do: they start with inventory + materials costing, then gradually add shop floor time tracking once the basics don’t hurt anymore. citeturn35view2turn42view1turn39view0

## Planning integrations and UX patterns

### Purchase planning and minimum stock alerts

Your manufacturing module becomes dramatically more valuable when it can answer: “If I plan to produce X next week, what do I need to buy or transfer?”

A pattern visible in Odoo and Dolibarr:

- Odoo’s multilevel BOM documentation emphasizes that replenishment planning is vital; it recommends reordering rules (including a “0/0” style approach) or MTO + Manufacture routes to automatically trigger sublevel production. citeturn6view0  
- Dolibarr explicitly describes “virtual stock” computed based on open manufacturing orders. citeturn27view0

**Actionable implementation in your system:**

- Add a “Demand allocator” view that computes:
  - *Gross required components* = sum(planned production * exploded BOM requirements)  
  - *Net required components* = gross – (on-hand – already-reserved – safety stock)  
- Feed net requirements into:
  - Purchase suggestions (PO recommendations),
  - Inter-warehouse transfer suggestions,
  - “Running low soon” alerts.

This is conceptually the same kind of “component status / readiness” data Odoo exposes on manufacturing orders when components must be available to complete. citeturn6view0turn12view0

### Coexistence with existing product bundles

Do not delete bundles. Give them a clean definition boundary.

You already have “product bundles (fixed-quantity component kits that auto-deduct on sale).” That is equivalent to:

- Odoo “Kit” BOM type (phantom) for selling as a kit while managing component stock. citeturn14view0turn5view0  
- SAP Business One Sales/Assembly BOM patterns in marketing documents. citeturn21view0

**Recommendation:**
- Keep **Product Bundles** as the “sales kit” construct (pure sales-oriented explosion, no manufacturing context).
- Use **BOM + Manufacturing Orders** for real production (WIP, finished goods lots, yields, scrap).
- Use **BOM with `autoConsumeOnSale`** for “recipe mode” (consume ingredients, don’t manage the sold menu item as stocked inventory).

This mirrors SAP’s split between Production BOM vs Sales/Assembly/Template BOMs: BOM can exist for sales without going through a production process. citeturn21view0

### UI/UX patterns that reduce user mistakes

Borrow UI ideas from systems that already solved “operators hate data entry”:

- Odoo explicitly encourages a **shop floor tablet** approach (“work center control panel” and real-time work order control). citeturn39view0  
- ERPNext provides a Manufacturing Dashboard with configurable charts, and its job card flow auto-creates job cards from work orders and ties them to operations/workstations. citeturn42view0turn42view1

image_group{"layout":"carousel","aspect_ratio":"16:9","query":["Odoo bill of materials components tab screenshot","Odoo manufacturing order list view screenshot","ERPNext manufacturing dashboard screenshot","ERPNext job card workstation screen screenshot"],"num_per_query":1}

Concrete UI recommendations (that map to your requirements):

- **BOM editor**
  - “Explosion preview” side panel: shows flattened component list with wastage applied and per-level contribution (helps multi-level BOM sanity). The fact that ERPNext includes “Exploded Items” in BOM is a strong precedent. citeturn17view0  
  - “Version strip” header: DRAFT/ACTIVE/ARCHIVED with “Clone as new revision” action (mirrors ERPNext “Amended From” style and Odoo’s archive+new recommendation). citeturn16view0turn14view1  
  - Fast component picker with UOM conversions displayed (you already support conversions; the key is reducing errors at entry time). citeturn14view0

- **Production order dashboard**
  - Use a **list-first** page with strong filters (status, due date, component readiness), and a secondary Kanban view for shop floor supervisors. Odoo’s MO workflow uses “Confirm/Validate” plus explicit states; ERPNext dashboard shows “Not Started/In Process/Stopped/Completed” analytics—these are list/board-friendly axes. citeturn12view0turn42view0turn8view0  
  - Show “Component Status” prominently (ready/late/unavailable). Odoo explicitly computes and surfaces component availability/readiness as part of MO processing and multilevel planning. citeturn6view0turn12view0

- **Mobile-friendly production tracking**
  - Keep the mobile workflow focused on: start/stop operation, report qty produced, report scrap—exactly the kind of “shop floor” approach Odoo documents. citeturn39view0turn31view1

## v1 scope: what to ship, what to defer

You asked for “specific, actionable recommendations” and “what to skip for v1,” so here’s a concrete MVP cut that still feels like “manufacturing,” not “a form that lies.”

### Ship in v1

- **BOM revisions as immutable rows** with DRAFT → ACTIVE → ARCHIVED, with lineage (`amended_from`) and a single active per product/org. This directly matches ERPNext’s “Amended From” concept and Odoo’s archive/new guidance. citeturn16view0turn14view1  
- **Multi-level BOM explosion** with circular detection and a cached flattened view for speed.
  - Odoo treats cycle creation as a hard validation error; do the same. citeturn38view1  
- **Manufacturing order core workflow**: DRAFT → PLANNED/CONFIRMED → IN_PROGRESS → COMPLETED + CANCELLED.
  - Use Odoo’s state semantics as a reference point for what “Confirmed/In Progress/Done” mean in terms of posting moves. citeturn12view0turn35view0  
- **Partial completion via backorders** (split remaining qty into a new order). Odoo’s manufacturing backorder flow is a proven user mental model. citeturn8view0  
- **FIFO consumption + finished good lot creation** at completion, with a frozen BOM revision reference and a stored “exploded components snapshot” on the order for audit. This matches SAP’s “BOM copied to production order” concept and prevents “recipe drift” issues later. citeturn21view0turn12view0  
- **Scrap tracking (simple)**: planned wastage % + actual scrap stock movement event.
  - Odoo’s scrapping model (move to virtual scrap location) and ERPNext’s “scrap warehouses / scrap in BOM” show how mainstream this is. citeturn31view1turn36view0  
- **Recipe mode auto-consumption on sale** with an async posting pipeline (fast checkout, reliable depletion), plus stock policy (block/warn/allow negative).
  - Real-time depletion based on sales + recipes is an explicit pattern in restaurant systems, and cost fallback ladders exist for practical gaps. citeturn43search0turn43search5turn43search9  

### Defer to v2+

These are powerful, but expensive—in both product complexity and support burden:

- **Full routings + work centers + capacity planning** as a required feature (make it optional later).
  - Odoo and ERPNext both have rich advanced layers here (work centers, time tracking, MPS, capacity planning), which signals: yes it’s valuable, but it’s also a whole additional product. citeturn39view0turn42view1turn6view0  
- **By-products with automated cost allocation** (unless your target market screams for it on day one).
  - Odoo supports by-products operationally, but cost allocation policy still needs careful design. citeturn33view0turn35view2  
- **Subcontracting / outside processing** (multi-entity flows, vendor WIP, etc.). Odoo documents subcontracting as a dedicated area, which is a hint that it’s not “small.” citeturn39view0  
- **Deep “variance analytics” (theoretical vs actual) for restaurants** as a full subsystem.
  - Tools like xtraCHEF emphasize theoretical consumption and variance-style analysis, but that’s an analytics layer on top of depletion. Build depletion first. citeturn43search16turn43search8  

If you implement the v1 set above, you’ll have something that feels legitimately “ERP-grade”: revision-safe BOMs, FIFO-correct manufacturing postings, partial completions, scrap handling, and fast POS recipe depletion—without falling into the classic trap of building a routing/capacity/MES monster before anyone can even produce a sandwich. citeturn35view0turn39view0turn27view0