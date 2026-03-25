# Restaurant module implementation plan for a Next.js ERP/POS system

**This plan covers every layer—from Prisma schema to component hierarchy to phased roadmap—for adding a toggle-able Restaurant module with KOT printing, table management, and restaurant theming to an existing Next.js 16 / React 19 ERP.** The architecture follows patterns proven in Odoo POS, Floreant POS, and SambaPOS while respecting the specified tech stack. The plan is structured for a team to execute in four phases over roughly 10–12 weeks.

---

## Module toggle and feature flag architecture

The Restaurant module needs a clean enable/disable mechanism at the business level, with sub-features (table management, reservations, tips) that can be toggled independently. The recommended pattern uses a **dedicated junction table** rather than JSON or Boolean columns—this keeps things queryable, auditable, and extensible.

**Three layers of control work together.** First, a `BusinessModule` table records which modules each business has activated, with timestamps for audit. Second, a `BusinessFeatureFlag` table handles granular sub-features within modules (e.g., `restaurant.table_management`, `restaurant.tips`). Third, a `RestaurantSettings` model stores restaurant-specific configuration in a 1:1 relationship with the business.

On the Next.js side, the toggle system operates at three levels simultaneously:

- **Server-side (layouts/pages)**: An async `getModuleEnabled(businessId, 'RESTAURANT')` function queries the database and gates access to restaurant route segments. Pages redirect to `/dashboard` when the module is disabled.
- **Middleware**: Route-level protection prevents navigation to `/restaurant/*`, `/tables/*`, or `/kot/*` paths when the module is off, catching direct URL access.
- **Client-side context**: A `<ModuleProvider>` wraps the dashboard layout, passing enabled modules as a React context. Components call `useModule('RESTAURANT')` to conditionally render restaurant-specific UI like KOT buttons, table selectors, and theme pickers in the sidebar.

```
┌─────────────────────────────────────────────┐
│  middleware.ts                               │
│  Blocks routes for disabled modules          │
├─────────────────────────────────────────────┤
│  Server Layout (getModuleEnabled check)      │
│  Passes feature flags → ModuleProvider       │
├─────────────────────────────────────────────┤
│  Client Components                           │
│  useModule('RESTAURANT') for conditional UI  │
│  useFeatureFlag('restaurant.table_mgmt')     │
└─────────────────────────────────────────────┘
```

---

## Database schema in Prisma

The schema below covers all restaurant entities. It follows Floreant's approach of treating **KOT as a first-class entity** (not just order line status), Odoo's **Floor→Table hierarchy** with visual positioning, and a clean module toggle pattern. All models include `businessId` paths for multi-tenant isolation.

### Core module toggle models

```prisma
enum ModuleType {
  RESTAURANT
  INVENTORY
  CRM
  LOYALTY
  DELIVERY
  RESERVATION
}

model Module {
  id          String           @id @default(cuid())
  code        ModuleType       @unique
  name        String
  description String?
  isDefault   Boolean          @default(false)
  businesses  BusinessModule[]
}

model BusinessModule {
  id         String    @id @default(cuid())
  businessId String
  business   Business  @relation(fields: [businessId], references: [id])
  moduleId   String
  module     Module    @relation(fields: [moduleId], references: [id])
  isEnabled  Boolean   @default(true)
  enabledAt  DateTime  @default(now())
  disabledAt DateTime?
  config     Json?

  @@unique([businessId, moduleId])
  @@index([businessId])
}

model FeatureFlag {
  id          String                @id @default(cuid())
  moduleCode  ModuleType
  code        String                @unique  // "restaurant.table_management"
  name        String
  description String?
  businesses  BusinessFeatureFlag[]
}

model BusinessFeatureFlag {
  id            String      @id @default(cuid())
  businessId    String
  business      Business    @relation(fields: [businessId], references: [id])
  featureFlagId String
  featureFlag   FeatureFlag @relation(fields: [featureFlagId], references: [id])
  isEnabled     Boolean     @default(false)

  @@unique([businessId, featureFlagId])
  @@index([businessId])
}
```

### Restaurant settings (1:1 with Business)

```prisma
model RestaurantSettings {
  id                 String   @id @default(cuid())
  businessId         String   @unique
  business           Business @relation(fields: [businessId], references: [id])
  enableTableMgmt    Boolean  @default(true)
  enableKOT          Boolean  @default(true)
  enableTips         Boolean  @default(false)
  enableCourses      Boolean  @default(false)
  enableReservations Boolean  @default(false)
  enableBillSplit    Boolean  @default(true)
  autoSendToKitchen  Boolean  @default(true)
  defaultGuestCount  Int      @default(1)
  themePreset        String   @default("warm")  // warm|elegant|cafe|bold
  kotPrinterConfig   Json?    // { electron: { printerName }, android: { ip, port } }
  createdAt          DateTime @default(now())
  updatedAt          DateTime @updatedAt
}
```

### Floor plan and table models

```prisma
enum TableShape {
  SQUARE
  ROUND
  RECTANGLE
  BOOTH
}

enum TableStatus {
  AVAILABLE
  RESERVED
  SEATED
  OCCUPIED
  SERVED
  BILLING
  CLEANING
}

model Floor {
  id              String   @id @default(cuid())
  businessId      String
  business        Business @relation(fields: [businessId], references: [id])
  name            String   // "Main Dining", "Patio", "Bar"
  sequence        Int      @default(0)
  backgroundColor String?
  backgroundImage String?
  width           Float    @default(1200)
  height          Float    @default(800)
  gridSize        Int      @default(20)
  isActive        Boolean  @default(true)
  tables          Table[]
  decorations     Json?    // Array of { type, x, y, width, height, rotation, label }
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt

  @@index([businessId])
}

model Table {
  id          String      @id @default(cuid())
  floorId     String
  floor       Floor       @relation(fields: [floorId], references: [id], onDelete: Cascade)
  number      Int
  name        String?
  seats       Int         @default(4)
  shape       TableShape  @default(SQUARE)
  positionX   Float       @default(0)
  positionY   Float       @default(0)
  width       Float       @default(100)
  height      Float       @default(100)
  rotation    Float       @default(0)
  color       String?
  status      TableStatus @default(AVAILABLE)
  combinable  Boolean     @default(false)
  isActive    Boolean     @default(true)
  orders      Order[]     @relation("TableOrders")
  createdAt   DateTime    @default(now())
  updatedAt   DateTime    @updatedAt

  @@unique([floorId, number])
  @@index([floorId])
}
```

### KOT models (first-class entities)

```prisma
enum OrderType {
  DINE_IN
  TAKE_OUT
  DELIVERY
}

enum KOTStatus {
  NEW
  SENT_TO_KITCHEN
  IN_PREPARATION
  PARTIALLY_READY
  READY
  SERVED
  CANCELLED
  VOID
}

enum KOTType {
  STANDARD
  FOLLOWUP      // Additional items for same order
  VOID          // Cancellation ticket
  DUPLICATE     // Reprint
}

model KOT {
  id             String     @id @default(cuid())
  kotNumber      Int        // Sequential, daily reset per business
  orderId        String
  order          Order      @relation(fields: [orderId], references: [id])
  kotType        KOTType    @default(STANDARD)
  stationId      String?
  station        KitchenStation? @relation(fields: [stationId], references: [id])
  status         KOTStatus  @default(NEW)
  orderType      OrderType
  tableNumber    String?
  sectionName    String?
  waiterName     String
  waiterId       String
  customerName   String?
  guestCount     Int?
  orderNotes     String?
  items          KOTItem[]
  printedAt      DateTime?
  prepStartedAt  DateTime?
  readyAt        DateTime?
  servedAt       DateTime?
  createdAt      DateTime   @default(now())
  updatedAt      DateTime   @updatedAt

  @@index([orderId])
  @@index([stationId])
  @@index([status])
}

model KOTItem {
  id                  String    @id @default(cuid())
  kotId               String
  kot                 KOT       @relation(fields: [kotId], references: [id], onDelete: Cascade)
  orderItemId         String
  orderItem           OrderItem @relation(fields: [orderItemId], references: [id])
  itemName            String
  itemNameAr          String?   // Arabic name for bilingual KOT
  quantity            Int
  modifiers           Json?     // ["No onions", "Extra cheese"]
  specialInstructions String?
  category            String?
  isVoid              Boolean   @default(false)
  isNew               Boolean   @default(true) // For follow-up KOTs
  status              KOTStatus @default(NEW)

  @@index([kotId])
}
```

### Kitchen station and printer routing

```prisma
model KitchenStation {
  id         String   @id @default(cuid())
  businessId String
  business   Business @relation(fields: [businessId], references: [id])
  name       String   // "Hot Kitchen", "Cold Kitchen", "Bar"
  printerIp  String?
  printerPort Int     @default(9100)
  printerName String? // For Electron system printer name
  isActive   Boolean  @default(true)
  categories KitchenStationCategory[]
  kots       KOT[]

  @@index([businessId])
}

model KitchenStationCategory {
  stationId  String
  station    KitchenStation @relation(fields: [stationId], references: [id])
  categoryId String
  // category   MenuCategory @relation(fields: [categoryId], references: [id])

  @@id([stationId, categoryId])
}
```

**Key schema decisions**: KOT is a separate entity from Order because a single order can generate multiple KOTs over its lifetime (initial order, additions, modifications, voids). Each KOT has its own sequence number, routing, and status. The `kotNumber` resets daily per business for kitchen readability. Table status is stored directly on the Table model and updated via server actions when orders progress through their lifecycle.

---

## API routes and server actions structure

The API layer uses **Next.js App Router route handlers** for data fetching (consumed by SWR) and **Server Actions** for mutations. This keeps reads cacheable and mutations type-safe.

```
app/api/
├── restaurant/
│   ├── settings/
│   │   └── route.ts              GET/PUT restaurant settings
│   ├── floors/
│   │   ├── route.ts              GET all floors, POST new floor
│   │   └── [floorId]/
│   │       ├── route.ts          GET/PUT/DELETE floor
│   │       └── tables/
│   │           └── route.ts      GET tables for floor, POST new table
│   ├── tables/
│   │   ├── route.ts              GET all tables (with filters)
│   │   ├── [tableId]/
│   │   │   ├── route.ts          GET/PUT/DELETE table
│   │   │   └── status/
│   │   │       └── route.ts      PATCH table status
│   │   └── layout/
│   │       └── route.ts          PUT batch-update table positions
│   ├── kot/
│   │   ├── route.ts              GET KOTs (filterable by status), POST new KOT
│   │   ├── [kotId]/
│   │   │   ├── route.ts          GET/PATCH KOT (status updates)
│   │   │   └── print/
│   │   │       └── route.ts      POST trigger print (returns formatted data)
│   │   └── next-number/
│   │       └── route.ts          GET next KOT number for today
│   └── stations/
│       ├── route.ts              GET/POST kitchen stations
│       └── [stationId]/
│           └── route.ts          GET/PUT/DELETE station
└── modules/
    ├── route.ts                  GET enabled modules for current business
    └── toggle/
        └── route.ts              POST enable/disable a module
```

**Server Actions** live colocated with their route segments:

```
app/(dashboard)/restaurant/
├── _actions/
│   ├── settings.actions.ts       updateRestaurantSettings()
│   ├── floor.actions.ts          createFloor(), updateFloor(), deleteFloor()
│   ├── table.actions.ts          createTable(), updateTable(), moveTable(), 
│   │                             updateTableStatus(), transferOrder()
│   ├── kot.actions.ts            createKOT(), updateKOTStatus(), voidKOT(),
│   │                             reprintKOT()
│   └── station.actions.ts        createStation(), updateStation()
```

**SWR hooks** for client-side data:

```typescript
// hooks/use-floors.ts
export function useFloors(businessId: string) {
  return useSWR(`/api/restaurant/floors?businessId=${businessId}`, fetcher);
}

// hooks/use-tables.ts  
export function useTables(floorId: string) {
  return useSWR(`/api/restaurant/floors/${floorId}/tables`, fetcher, {
    refreshInterval: 5000,  // Poll every 5s for status changes
  });
}

// hooks/use-kots.ts
export function useKOTs(filters: { status?: KOTStatus; orderId?: string }) {
  const params = new URLSearchParams(filters as Record<string, string>);
  return useSWR(`/api/restaurant/kot?${params}`, fetcher, {
    refreshInterval: 3000,  // Near-real-time for kitchen
  });
}
```

---

## KOT printing flow across platforms

The printing architecture uses a **unified KOT formatter** that produces platform-agnostic structured data, which platform-specific printer services then consume. This is the single most complex cross-platform challenge in the module.

### Unified KOT formatter service

```typescript
// lib/kot/kot-formatter.ts
export interface FormattedKOT {
  header: { kotNumber: string; orderType: string; kotType: string };
  meta: { tableNumber?: string; section?: string; waiter: string; 
          guests?: number; timestamp: string };
  items: Array<{ quantity: number; name: string; nameAr?: string; 
                  modifiers: string[]; instructions?: string }>;
  footer: { orderNotes?: string; orderNumber: string; printTime: string };
}

export function formatKOT(kot: KOTWithItems): FormattedKOT {
  // Transform database KOT into structured print-ready format
  // This function is shared between Electron and Capacitor
}
```

### Electron (Windows) printing flow

The Electron path uses **`node-thermal-printer`** for ESC/POS control when the printer is network-connected, or **`electron-pos-printer`** (which uses Electron's `webContents.print()`) for system-installed printers. The existing printer settings in the ERP are reused.

```
┌──────────────┐     ┌──────────────┐     ┌─────────────────┐     ┌──────────┐
│ POS UI       │────▶│ KOT Formatter│────▶│ Electron IPC     │────▶│ Thermal  │
│ (React)      │     │ (shared TS)  │     │ Print Service    │     │ Printer  │
│ "Send to     │     │              │     │ (node-thermal-   │     │ (TCP or  │
│  Kitchen"    │     │              │     │  printer / canvas │     │  System) │
└──────────────┘     └──────────────┘     │  for Arabic)     │     └──────────┘
                                          └─────────────────┘
```

**For Arabic text**, the Electron service renders the entire KOT as a bitmap using `node-canvas` (server-side Canvas API) with RTL text direction, `Noto Sans Arabic` font, then sends it via `printer.printImageBuffer()`. For English-only KOTs, direct ESC/POS text commands are faster and sharper.

```typescript
// electron/services/kot-printer.ts (runs in Electron main process)
import { ThermalPrinter, PrinterTypes } from 'node-thermal-printer';
import { createCanvas } from 'canvas';

export async function printKOT(formatted: FormattedKOT, config: PrinterConfig) {
  const hasArabic = formatted.items.some(item => item.nameAr);
  
  if (hasArabic) {
    // Full bitmap rendering for Arabic support
    const imageBuffer = renderKOTToBitmap(formatted, 576); // 80mm @ 203dpi
    const printer = new ThermalPrinter({
      type: PrinterTypes.EPSON,
      interface: config.printerName 
        ? `printer:${config.printerName}` 
        : `tcp://${config.ip}:${config.port}`,
    });
    await printer.printImageBuffer(imageBuffer);
    printer.cut();
    await printer.execute();
  } else {
    // Direct ESC/POS text commands (faster, sharper)
    await printKOTAsText(formatted, config);
  }
}
```

### Capacitor (Android) printing flow

The Android path uses a **custom Capacitor plugin** wrapping the DantSu `ESCPOS-ThermalPrinter-Android` library. Network printing connects via TCP to the printer's IP address on port 9100.

```
┌──────────────┐     ┌──────────────┐     ┌─────────────────┐     ┌──────────┐
│ POS UI       │────▶│ KOT Formatter│────▶│ Capacitor Plugin │────▶│ Thermal  │
│ (React)      │     │ (shared TS)  │     │ (Java/DantSu)   │     │ Printer  │
│ "Send to     │     │              │     │ TcpConnection    │     │ (Network │
│  Kitchen"    │     │              │     │ + Canvas bitmap  │     │  TCP)    │
└──────────────┘     └──────────────┘     │  for Arabic      │     └──────────┘
                                          └─────────────────┘
```

**The Capacitor plugin exposes three methods:**

```typescript
// plugins/thermal-printer/definitions.ts
export interface ThermalPrinterPlugin {
  printFormatted(options: { ip: string; port?: number; text: string }): Promise<{ success: boolean }>;
  printBitmap(options: { ip: string; port?: number; imageBase64: string }): Promise<{ success: boolean }>;
  testConnection(options: { ip: string; port?: number }): Promise<{ connected: boolean }>;
}
```

**For Arabic on Android**, the Java plugin renders text using Android's native `Canvas` and `Paint` APIs (which handle Arabic glyph shaping and RTL natively), converts the `Bitmap` to hex using DantSu's `PrinterTextParserImg.bitmapToHexadecimalString()`, and embeds it in the formatted text as `<img>hex</img>`.

### Platform detection and routing

```typescript
// lib/kot/kot-print-service.ts
import { Capacitor } from '@capacitor/core';

export async function printKOTToStation(kot: KOTWithItems, station: KitchenStation) {
  const formatted = formatKOT(kot);
  const platform = Capacitor.getPlatform(); // 'web' | 'android' | 'ios'
  
  if (platform === 'android') {
    const { ThermalPrinter } = await import('@/plugins/thermal-printer');
    const hasArabic = formatted.items.some(i => i.nameAr);
    if (hasArabic) {
      const bitmap = await renderKOTToBitmapBase64(formatted);
      await ThermalPrinter.printBitmap({ ip: station.printerIp!, imageBase64: bitmap });
    } else {
      const text = formatKOTForDantSu(formatted); // DantSu [C][L][R] syntax
      await ThermalPrinter.printFormatted({ ip: station.printerIp!, text });
    }
  } else {
    // Electron/Web: send via IPC to main process
    window.electronAPI?.printKOT(formatted, {
      printerName: station.printerName,
      ip: station.printerIp,
      port: station.printerPort,
    });
  }
}
```

### KOT ticket layout

The standard **80mm thermal KOT** follows this structure, optimized for kitchen readability:

```
════════════════════════════════════════
         KITCHEN ORDER TICKET
              KOT #045
════════════════════════════════════════
 Type: DINE-IN          Table: 5
 Section: Main Hall     Guests: 4
 Waiter: Ahmed          14:32
════════════════════════════════════════
 ** NEW ORDER **
────────────────────────────────────────
  2x  Chicken Burger
       >> No onions
       >> Extra cheese
  1x  Caesar Salad
       >> Dressing on side
  3x  French Fries
  1x  Grilled Salmon
       >> Well done
────────────────────────────────────────
 NOTES: Rush order — VIP guest
════════════════════════════════════════
 Printed: 2026-03-24 14:32:05
 Order #1234
════════════════════════════════════════
```

**Bold, large KOT number** is the most critical element for kitchen staff. Modifiers are indented with `>>` arrows. Void/cancellation KOTs print in inverse (white-on-black) with "CANCELLED" prominently displayed.

---

## Table management UI flow

The table management system uses **react-konva** (Konva.js) for the floor plan canvas, supporting both an **editor mode** (for managers to design layouts) and a **viewer mode** (for runtime POS operations). This is the industry-standard approach used by Toast, Lightspeed, Square, and Odoo.

### Table-first ordering workflow

The dominant POS pattern across all major restaurant systems is **table-first**: the server selects a table on the floor plan, then the system opens the order panel for that table. Here is the complete flow:

1. Server opens the **Tables** screen → sees floor plan with color-coded tables
2. Taps an **available table** (green) → prompted for guest count → table turns **occupied** (amber) → order panel opens
3. Adds items to order → hits **"Send to Kitchen"** → system generates KOTs routed to appropriate kitchen stations → KOTs print
4. For additional items, server taps the **occupied table** → existing order opens → adds items → sends follow-up KOT
5. Guest requests bill → server hits **"Print Bill"** → table turns **billing** (red)
6. Payment processed → table returns to **available** (green) or **cleaning** (gray)

**Table transfers**: Select occupied table → "Transfer" action → pick destination table → order FK updates, old table goes available.

**Split bills**: Open payment → "Split" → choose method (by item, by equal parts, by seat) → process separate payments.

### Table status color scheme

The color system follows industry consensus across Toast, Lightspeed, Square, and Odoo:

| Status | Color | Tailwind Class | Meaning |
|--------|-------|---------------|---------|
| Available | Green | `bg-green-500` | Ready for seating |
| Reserved | Blue | `bg-blue-500` | Reservation held |
| Seated | Cyan | `bg-cyan-500` | Guests seated, no order yet |
| Occupied | Amber | `bg-amber-500` | Active order in progress |
| Served | Violet | `bg-violet-500` | Food delivered, lingering |
| Billing | Red | `bg-red-500` | Check printed, awaiting payment |
| Cleaning | Gray | `bg-gray-400` | Being cleared |

### Floor plan component architecture

**react-konva** is the primary library because it provides canvas-based 2D rendering with built-in drag-and-drop, resize handles via `<Transformer>`, and React declarative API. It must be loaded with `next/dynamic` and `ssr: false` since Konva requires browser canvas.

```tsx
// Simplified FloorPlanViewer structure
<Stage width={floor.width} height={floor.height}>
  <Layer>
    {/* Grid overlay (editor mode only) */}
    {isEditing && <GridOverlay gridSize={floor.gridSize} />}
    
    {/* Tables */}
    {tables.map(table => (
      <TableShape
        key={table.id}
        table={table}
        isSelected={selectedId === table.id}
        onSelect={() => setSelectedId(table.id)}
        draggable={isEditing}
        onDragEnd={handleTableMove}
      />
    ))}
    
    {/* Transformer for selected table (editor mode) */}
    {isEditing && selectedId && <Transformer ref={transformerRef} />}
  </Layer>
</Stage>
```

The **viewer mode** (runtime POS) renders tables with status colors, elapsed-time badges, server initials, and cover counts. Clicking a table opens the order panel. The **editor mode** adds a toolbar sidebar with shape buttons (round, square, rectangle, booth), enables drag-and-drop repositioning and resize, and shows a properties panel for the selected table.

---

## Theming architecture for restaurant mode

The theming system uses a **two-dimensional approach**: `next-themes` handles light/dark mode (dimension 1), while a custom `RestaurantThemeProvider` handles the color palette "flavor" (dimension 2). This keeps the existing dark mode working while layering restaurant-specific visual identity.

### How the two dimensions compose

```tsx
// app/layout.tsx
<ThemeProvider attribute="class" defaultTheme="system" enableSystem>
  <RestaurantThemeProvider>
    {children}
  </RestaurantThemeProvider>
</ThemeProvider>
```

The `RestaurantThemeProvider` sets a `data-restaurant-theme` attribute on the `<html>` element. CSS variables are defined for each combination:

```css
/* globals.css */
@import 'tailwindcss';

@theme inline {
  --color-background: var(--background);
  --color-foreground: var(--foreground);
  --color-primary: var(--primary);
  --color-primary-foreground: var(--primary-foreground);
  --color-secondary: var(--secondary);
  --color-secondary-foreground: var(--secondary-foreground);
  --color-accent: var(--accent);
  --color-accent-foreground: var(--accent-foreground);
  --color-muted: var(--muted);
  --color-muted-foreground: var(--muted-foreground);
  --color-destructive: var(--destructive);
  --color-border: var(--border);
  --color-card: var(--card);
  --color-card-foreground: var(--card-foreground);
  --color-ring: var(--ring);
}
```

### Four restaurant palette presets

**Warm Trattoria** (default for restaurant mode) — terracotta primary, olive secondary, warm cream background. Best for Mediterranean, farm-to-table, bistro.

**Fine Dining** — gold primary on deep charcoal-navy, burgundy accents. Sophisticated, minimal, premium feel. This preset is itself a dark theme, so it overrides the light/dark dimension.

**Casual Café** — fresh green primary, warm orange secondary, light sage background. Friendly, healthy, welcoming.

**Fast Casual** — bold red primary, bright yellow-gold secondary. Energetic, appetite-stimulating, high-throughput.

Each preset defines all **16 shadcn/ui CSS variable tokens** (background, foreground, primary, secondary, accent, muted, destructive, border, card, ring, input, popover, plus sidebar variants). Since shadcn/ui components reference these via Tailwind utilities (`bg-primary`, `text-muted-foreground`), swapping the `data-restaurant-theme` attribute re-skins every component instantly with zero code changes.

```css
[data-restaurant-theme="warm"] {
  --background: oklch(0.97 0.008 60);
  --foreground: oklch(0.18 0.04 50);
  --primary: oklch(0.52 0.14 30);          /* Terracotta */
  --primary-foreground: oklch(0.96 0.01 60);
  --secondary: oklch(0.48 0.10 135);       /* Olive */
  --accent: oklch(0.68 0.15 80);           /* Amber */
  /* ... remaining tokens */
}

[data-restaurant-theme="warm"].dark {
  --background: oklch(0.15 0.02 50);
  --foreground: oklch(0.92 0.02 60);
  --primary: oklch(0.62 0.14 30);          /* Lighter terracotta for dark */
  /* ... dark variants of warm theme */
}

[data-restaurant-theme="elegant"] {
  --background: oklch(0.13 0.02 260);      /* Deep navy (always dark) */
  --foreground: oklch(0.92 0.02 80);
  --primary: oklch(0.68 0.14 85);          /* Warm gold */
  --secondary: oklch(0.35 0.08 350);       /* Deep burgundy */
  /* ... */
}
```

The `RestaurantThemeProvider` persists the selected flavor to `localStorage` and to the `RestaurantSettings.themePreset` database field. When the restaurant module is disabled, the provider becomes a no-op, and the default ERP theme (no `data-restaurant-theme` attribute) is used.

---

## Settings pages structure

The settings architecture nests restaurant configuration under the existing business settings, with clear sub-sections:

```
/settings
├── /general                     # Existing ERP settings
├── /modules                     # Module management page
│   └── Toggle RESTAURANT on/off
│   └── Toggle INVENTORY on/off
│   └── etc.
├── /restaurant                  # Only visible when restaurant module enabled
│   ├── /general                 # RestaurantSettings form
│   │   ├── Default guest count
│   │   ├── Auto-send to kitchen toggle
│   │   ├── Enable tips, courses, bill splitting
│   │   └── Theme preset selector (visual cards with previews)
│   ├── /tables                  # Table management sub-toggle + floor plan editor
│   │   ├── Enable/disable table management
│   │   └── Floor plan editor (when enabled)
│   │       ├── Floor selector (tabs) + Add Floor
│   │       ├── Konva canvas editor (drag-and-drop tables)
│   │       └── Table properties sidebar
│   ├── /kitchen-stations        # Printer routing configuration
│   │   ├── List of stations (Hot Kitchen, Cold Kitchen, Bar)
│   │   ├── Add/edit station dialog
│   │   ├── Printer IP / system printer name per station
│   │   ├── Category → station mapping
│   │   └── Test print button
│   └── /kot                     # KOT settings
│       ├── KOT numbering (daily reset toggle)
│       ├── Printer configuration per platform
│       │   ├── Electron: select from system printers (dropdown)
│       │   └── Android: network printer IP + port fields
│       ├── Arabic text toggle
│       └── Test KOT print button
```

Each settings page uses **React Hook Form + Zod** for validation and **Server Actions** for persistence. The settings form for restaurant general configuration would look like:

```typescript
// Zod schema for restaurant settings
const restaurantSettingsSchema = z.object({
  enableTableMgmt: z.boolean(),
  enableKOT: z.boolean(),
  enableTips: z.boolean(),
  enableCourses: z.boolean(),
  enableReservations: z.boolean(),
  enableBillSplit: z.boolean(),
  autoSendToKitchen: z.boolean(),
  defaultGuestCount: z.number().int().min(1).max(50),
  themePreset: z.enum(['warm', 'elegant', 'cafe', 'bold']),
});
```

---

## Complete file and folder structure

```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/page.tsx
│   │   └── layout.tsx
│   ├── (dashboard)/
│   │   ├── layout.tsx                          # Dashboard shell (sidebar, nav, providers)
│   │   ├── dashboard/page.tsx
│   │   │
│   │   ├── pos/
│   │   │   ├── page.tsx                        # Main POS page
│   │   │   └── _components/
│   │   │       ├── POSLayout.tsx
│   │   │       ├── KOTButton.tsx               # Shown when restaurant module enabled
│   │   │       ├── TableSelector.tsx           # Shown when table mgmt enabled
│   │   │       └── OrderPanel.tsx
│   │   │
│   │   ├── restaurant/                         # Restaurant module routes
│   │   │   ├── layout.tsx                      # Module guard layout
│   │   │   ├── tables/
│   │   │   │   ├── page.tsx                    # Floor plan viewer (runtime POS)
│   │   │   │   └── _components/
│   │   │   │       ├── FloorPlanViewer.tsx
│   │   │   │       ├── TableShape.tsx
│   │   │   │       ├── TableStatusBadge.tsx
│   │   │   │       ├── TableTimer.tsx
│   │   │   │       ├── TableContextMenu.tsx
│   │   │   │       └── FloorSelector.tsx
│   │   │   ├── kot/
│   │   │   │   ├── page.tsx                    # KOT queue/dashboard
│   │   │   │   └── _components/
│   │   │   │       ├── KOTQueue.tsx
│   │   │   │       ├── KOTCard.tsx
│   │   │   │       ├── KOTDetail.tsx
│   │   │   │       └── KOTStatusBadge.tsx
│   │   │   └── _actions/
│   │   │       ├── settings.actions.ts
│   │   │       ├── floor.actions.ts
│   │   │       ├── table.actions.ts
│   │   │       ├── kot.actions.ts
│   │   │       └── station.actions.ts
│   │   │
│   │   └── settings/
│   │       ├── page.tsx
│   │       ├── modules/page.tsx                # Module toggle page
│   │       ├── restaurant/
│   │       │   ├── page.tsx                    # General restaurant settings
│   │       │   ├── tables/
│   │       │   │   ├── page.tsx                # Floor plan editor
│   │       │   │   └── _components/
│   │       │   │       ├── FloorPlanEditor.tsx
│   │       │   │       ├── EditorToolbar.tsx
│   │       │   │       ├── TablePropertiesPanel.tsx
│   │       │   │       └── FloorFormDialog.tsx
│   │       │   ├── kitchen-stations/page.tsx
│   │       │   └── kot/page.tsx
│   │       └── _components/
│   │           └── SettingsNav.tsx
│   │
│   ├── api/
│   │   ├── restaurant/
│   │   │   ├── settings/route.ts
│   │   │   ├── floors/
│   │   │   │   ├── route.ts
│   │   │   │   └── [floorId]/
│   │   │   │       ├── route.ts
│   │   │   │       └── tables/route.ts
│   │   │   ├── tables/
│   │   │   │   ├── route.ts
│   │   │   │   ├── [tableId]/
│   │   │   │   │   ├── route.ts
│   │   │   │   │   └── status/route.ts
│   │   │   │   └── layout/route.ts
│   │   │   ├── kot/
│   │   │   │   ├── route.ts
│   │   │   │   ├── [kotId]/
│   │   │   │   │   ├── route.ts
│   │   │   │   │   └── print/route.ts
│   │   │   │   └── next-number/route.ts
│   │   │   └── stations/
│   │   │       ├── route.ts
│   │   │       └── [stationId]/route.ts
│   │   └── modules/
│   │       ├── route.ts
│   │       └── toggle/route.ts
│   │
│   ├── layout.tsx                              # Root layout
│   ├── globals.css                             # Theme tokens + Tailwind
│   └── middleware.ts                           # Module route guards
│
├── components/
│   ├── ui/                                     # shadcn/ui primitives (existing)
│   ├── floor-plan/                             # Shared floor plan components
│   │   ├── FloorPlanCanvas.tsx                 # Base Konva Stage wrapper
│   │   ├── GridOverlay.tsx
│   │   ├── TableTransformer.tsx
│   │   └── DecorativeElement.tsx
│   ├── kot/
│   │   ├── KOTPreview.tsx                      # Visual KOT preview (React)
│   │   └── KOTPrintDialog.tsx
│   └── restaurant/
│       ├── ModuleGuard.tsx                     # Wraps content, checks module enabled
│       ├── FeatureGuard.tsx                    # Wraps content, checks feature flag
│       └── ThemeSelector.tsx                   # Visual theme picker cards
│
├── hooks/
│   ├── use-module.ts                           # useModule('RESTAURANT') hook
│   ├── use-feature-flag.ts                     # useFeatureFlag('restaurant.table_mgmt')
│   ├── use-floors.ts                           # SWR hook for floors
│   ├── use-tables.ts                           # SWR hook for tables (with polling)
│   ├── use-kots.ts                             # SWR hook for KOT queue
│   ├── use-table-actions.ts                    # Transfer, split, merge handlers
│   └── use-restaurant-theme.ts                 # Restaurant flavor theme hook
│
├── lib/
│   ├── modules/
│   │   ├── module-service.ts                   # getModuleEnabled(), getFeatureFlags()
│   │   └── module-constants.ts                 # Module codes, feature flag codes
│   ├── kot/
│   │   ├── kot-formatter.ts                    # Platform-agnostic KOT formatter
│   │   ├── kot-print-service.ts                # Platform router (Electron/Capacitor)
│   │   ├── kot-dantsu-formatter.ts             # DantSu [C][L][R] syntax builder
│   │   ├── kot-escpos-formatter.ts             # ESC/POS command builder
│   │   └── kot-bitmap-renderer.ts              # Arabic bitmap rendering (canvas)
│   ├── table/
│   │   ├── table-status.ts                     # Status constants, colors, transitions
│   │   └── floor-plan-utils.ts                 # Geometry, snapping, collision
│   └── theme/
│       ├── restaurant-themes.ts                # Theme preset definitions
│       └── theme-utils.ts                      # Theme application helpers
│
├── providers/
│   ├── module-provider.tsx                     # React context for enabled modules
│   └── restaurant-theme-provider.tsx           # Restaurant flavor theme provider
│
├── plugins/                                    # Capacitor plugins
│   └── thermal-printer/
│       ├── definitions.ts                      # TypeScript interface
│       ├── index.ts                            # Plugin registration
│       └── android/                            # Native Android code
│           ├── ThermalPrinterPlugin.java       # Capacitor plugin class
│           └── build.gradle                    # DantSu dependency
│
├── prisma/
│   └── schema/
│       ├── base.prisma                         # Datasource, generator
│       ├── auth.prisma                         # User, Session, Account
│       ├── business.prisma                     # Business, BusinessModule, FeatureFlag
│       ├── restaurant.prisma                   # Floor, Table, KitchenStation, RestaurantSettings
│       ├── kot.prisma                          # KOT, KOTItem
│       └── order.prisma                        # Order, OrderItem (extended with tableId)
│
├── tests/
│   └── e2e/
│       ├── restaurant-module.spec.ts           # Module toggle E2E
│       ├── table-management.spec.ts            # Floor plan + table workflow
│       ├── kot-flow.spec.ts                    # KOT creation and status updates
│       └── restaurant-theme.spec.ts            # Theme switching
│
└── electron/                                   # Electron-specific code
    ├── main.ts
    ├── preload.ts                              # Expose printKOT via contextBridge
    └── services/
        ├── kot-printer-service.ts              # node-thermal-printer integration
        └── arabic-renderer.ts                  # node-canvas Arabic bitmap
```

---

## Implementation phases and roadmap

### Phase 1 — Foundation (weeks 1–3)

**Goal**: Module toggle system, database schema, and restaurant settings CRUD.

- **Week 1**: Prisma schema for all restaurant entities. Run migrations. Seed `Module` records. Build `BusinessModule` and `BusinessFeatureFlag` CRUD. Create `module-service.ts` with `getModuleEnabled()` and `getFeatureFlags()`.
- **Week 2**: `ModuleProvider` context, `useModule` hook, `ModuleGuard` component. Middleware route protection. Settings → Modules page with toggle switches. Settings → Restaurant general page with React Hook Form + Zod.
- **Week 3**: `RestaurantSettings` CRUD (server actions + API routes). Kitchen station management page (CRUD for stations, category mapping). Wire up feature flags for sub-features (`restaurant.table_management`, `restaurant.kot`). Sidebar navigation conditional rendering based on module state.

**Deliverable**: An ERP where the Restaurant module can be toggled on/off at the business level, with settings pages for restaurant configuration, and kitchen station setup.

### Phase 2 — KOT system (weeks 4–6)

**Goal**: Full KOT lifecycle from order entry to kitchen printing on both platforms.

- **Week 4**: KOT data model implementation. `kot-formatter.ts` for structured KOT data. KOT creation from POS order (server action that splits order items by category → routes to stations → creates KOT records). KOT API routes for CRUD and status updates. KOT queue dashboard page with SWR polling.
- **Week 5**: Electron printing — integrate `node-thermal-printer` in Electron main process. IPC bridge from renderer to main. `kot-escpos-formatter.ts` for text-mode printing. Arabic bitmap rendering with `node-canvas` and `kot-bitmap-renderer.ts`. Test print flow end-to-end on Windows.
- **Week 6**: Capacitor plugin — scaffold with `@capacitor/cli`, implement Java `ThermalPrinterPlugin` wrapping DantSu, TCP connection to network printers. Arabic rendering using Android `Canvas` + `Paint`. TypeScript definitions and platform-routing in `kot-print-service.ts`. KOT settings page with printer config (Electron dropdown, Android IP input, test print button).

**Deliverable**: Orders in the POS generate KOTs that print on thermal printers (both Windows and Android), with Arabic support, category-based kitchen routing, and a live KOT queue dashboard.

### Phase 3 — Table management (weeks 7–9)

**Goal**: Floor plan editor and runtime table management integrated with POS ordering.

- **Week 7**: Floor plan editor — `react-konva` canvas with `next/dynamic` SSR-off loading. Table shapes (round, square, rectangle, booth) with drag-and-drop placement. `<Transformer>` for resize. Grid snapping. Properties sidebar (table number, capacity, shape, color). Save/load floor layout via server actions. Multi-floor support with tabs.
- **Week 8**: Runtime floor plan viewer — table status colors, elapsed-time timers (using `date-fns`), cover count badges. Click table → open order panel. Table status transitions tied to order lifecycle. SWR polling for multi-terminal sync (every 5 seconds). `TableContextMenu` with transfer, split, merge, print bill actions.
- **Week 9**: Table operations — transfer order between tables (update FK + status), split bill dialog (by item, by equal parts), merge tables for large parties. Wire table selector into the existing POS page (table-first workflow). Guest count dialog on table selection. Reservation basics if `restaurant.reservations` feature flag is enabled.

**Deliverable**: A visual floor plan where managers can design table layouts and servers can manage tables in real-time, fully integrated with the POS ordering and KOT flow.

### Phase 4 — Theming and polish (weeks 10–12)

**Goal**: Restaurant theming system, E2E tests, performance optimization, and production hardening.

- **Week 10**: Theming implementation — `RestaurantThemeProvider` with `data-restaurant-theme` attribute. All four palette presets defined in `globals.css` with OKLCH tokens for both light and dark modes. Theme selector component with visual preview cards. Persist theme preference to database and localStorage. Verify all shadcn/ui components render correctly across all theme × mode combinations.
- **Week 11**: E2E tests with Playwright — module toggle flow, floor plan editor interactions, KOT creation and status progression, table management workflow, theme switching. Print flow integration tests (mock printer for CI). Error handling for offline printers (retry queue with Sonner toast notifications). KOT print queue in IndexedDB for offline resilience.
- **Week 12**: Performance audit — optimize SWR polling intervals, add `React.memo` to Konva table shapes, ensure floor plan canvas doesn't re-render on unrelated state changes. Responsive layout for tablet POS (floor plan scales to viewport). Documentation. Production deployment checklist. Load testing with concurrent orders.

**Deliverable**: A production-ready restaurant module with four themed visual presets, comprehensive test coverage, error resilience for printing, and optimized performance.

---

## Key architectural decisions and their rationale

**KOT as a first-class entity rather than order line status** was chosen following Floreant POS's pattern. This supports the reality that a single dine-in order generates multiple KOTs over its lifetime—initial order, follow-up items, modifications, voids. Each KOT has its own sequence number, kitchen routing, and status. Without this separation, tracking "what was sent to the kitchen when" becomes impossible.

**react-konva over DOM-based drag-and-drop** was chosen because restaurant floor plans require freeform 2D positioning of shapes with rotation and resize—something CSS Grid and `@dnd-kit` cannot handle well. Konva's `<Transformer>` component provides Figma-like selection handles out of the box. The trade-off is no SSR (canvas requires browser), mitigated by `next/dynamic` with a skeleton fallback.

**Two-dimensional theming (mode × flavor)** allows restaurants to express brand identity through color while preserving the user's dark/light mode preference. The `@theme inline` pattern in Tailwind v4 resolves CSS variables at runtime, so swapping `data-restaurant-theme` re-skins every component without any JavaScript re-renders—just a CSS variable swap on `<html>`.

**Separate `BusinessModule` table over JSON flags** was chosen because module enablement needs to be queryable across businesses (e.g., "how many businesses use the restaurant module?"), auditable (when was it enabled/disabled?), and extensible without schema migrations for new modules. The slight join overhead is negligible compared to the flexibility gained.

**Platform-agnostic KOT formatter with platform-specific printer services** keeps the formatting logic shared (one source of truth for ticket layout) while isolating platform complexity. The Electron path uses `node-thermal-printer` + `node-canvas` in the main process. The Android path uses a custom Capacitor plugin wrapping DantSu. Both consume the same `FormattedKOT` interface, ensuring visual consistency across platforms.