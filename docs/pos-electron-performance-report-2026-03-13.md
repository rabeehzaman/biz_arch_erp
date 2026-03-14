# POS Electron Performance Report

Date: 2026-03-13
Latest update: 2026-03-14
Scope: Windows Electron POS, Next.js POS terminal, checkout transaction, thermal printing, reprint behavior

## Executive Summary

The POS can be made much snappier, but the biggest wins are architectural, not cosmetic.

Top priorities:

1. Stop treating reprint as "rebuild everything from memory". Persist receipt snapshots and print-ready artifacts at checkout time.
2. Reduce the amount of work done on every checkout. The current transaction is correct, but it is very chatty and heavily sequential.
3. Reduce POS terminal cold-start weight. The terminal route currently loads about 656 KB of client JS across 12 chunks in production build output.
4. Avoid refetching and rerendering the entire product catalog after every sale.
5. Since Arabic-heavy receipts rule out `escposText` for this project, optimize the existing HTML/image -> raster -> ESC/POS pipeline by pre-rendering, caching, and spooling artifacts instead of regenerating them on every print.

If only one thing is implemented first, it should be receipt persistence plus local print spool/cache. That directly improves reprint speed, reduces printer latency, and removes a major user-visible pain point.

## Implementation Tracking

- [x] Receipt spool/cache added for rendered Electron receipts on 2026-03-13
- [x] Reprint now targets latest cached receipt artifact before React-state fallback on 2026-03-13
- [x] Add checkout client/server timing instrumentation on 2026-03-14
- [x] Stop blocking checkout on full product refetch on 2026-03-14
- [x] Add optimistic session and stock updates after checkout on 2026-03-14
- [ ] Split and lighten `/api/pos/products` payload
- [ ] Add virtualized product grid
- [ ] Batch checkout-side DB lookups and sequence generation
- [ ] Reuse hidden print windows and skip regeneration when cached artifacts exist
- [ ] Auto-route POS-only users with an already-open session directly to `/pos/terminal`
- [ ] Trim POS-only dashboard/data work before terminal entry

## What Was Reviewed

- Electron shell and print bridge:
  - `electron/main.js`
  - `electron/printer-service.js`
  - `src/lib/electron-print.ts`
  - `src/lib/print-receipt.ts`
- POS renderer:
  - `src/app/(pos)/pos/terminal/page.tsx`
  - `src/components/pos/product-grid.tsx`
  - `src/components/pos/product-tile.tsx`
- POS server APIs:
  - `src/app/api/pos/checkout/route.ts`
  - `src/app/api/pos/products/route.ts`
  - `src/lib/inventory/fifo.ts`
- Verification:
  - `npm run build` completed successfully
  - `npm run lint` was noisy because generated `.vercel/output` artifacts are being linted

## Important Constraint

- `escposText` is not a practical option for this POS because receipts contain significant Arabic content and layout fidelity matters.
- The realistic print path for this project is the existing HTML/image-based pipeline, especially for raw USB printers.
- Because of that, the optimization plan should focus on making the current raster/image workflow faster and more durable, not on replacing it with text-mode ESC/POS.

## Evidence Collected

- Electron loads the remote ERP URL directly instead of a packaged local POS shell:
  - `electron/main.js:15`
  - `electron/main.js:367`
- Main window can wait up to 30 seconds before splash fallback:
  - `electron/main.js:401-402`
- Reprint only uses in-memory `lastReceiptData`:
  - `src/app/(pos)/pos/terminal/page.tsx:402-403`
  - `src/app/(pos)/pos/terminal/page.tsx:717`
  - `src/app/(pos)/pos/terminal/page.tsx:816-824`
- After checkout, the UI awaits full refetch of session, held orders, and products:
  - `src/app/(pos)/pos/terminal/page.tsx:719-723`
- POS products endpoint fetches all active products with nested stock lots and bundle component stock lots:
  - `src/app/api/pos/products/route.ts:23-49`
- Product grid filters and renders the full list with no virtualization:
  - `src/components/pos/product-grid.tsx:33-42`
  - `src/components/pos/product-grid.tsx:109-116`
- Checkout transaction has multiple sequential loops and per-item queries:
  - sequence generation: `src/app/api/pos/checkout/route.ts:25-67`
  - stock validation loop: `src/app/api/pos/checkout/route.ts:300-353`
  - FIFO loop: `src/app/api/pos/checkout/route.ts:467-531`
  - payment loop: `src/app/api/pos/checkout/route.ts:697-870`
  - final invoice reload: `src/app/api/pos/checkout/route.ts:898-912`
- FIFO itself performs per-lot create/update roundtrips:
  - `src/lib/inventory/fifo.ts:225-254`
- HTML and raster printing both regenerate receipt output on every print:
  - renderer HTML generation: `src/lib/electron-print.ts:102-122`
  - HTML rendering template: `src/lib/print-receipt.ts:12-53`
  - hidden BrowserWindow and temp-file pipeline: `electron/main.js:166-229`
  - HTML driver print: `electron/main.js:483-539`
  - raster capture and PNG conversion: `electron/main.js:272-296`
  - image dithering and ESC * conversion: `electron/printer-service.js:302-402`

Production build evidence:

- `/pos/terminal` loads 12 client JS chunks totaling about 656 KB uncompressed from the build manifest.
- `npm run build` completed successfully on 2026-03-13.
- A direct DB timing probe was attempted, but local Prisma access returned `ECONNREFUSED`, so live query timings could not be collected from this shell.

## Highest-Priority Findings

### P0. Reprint is not persistent and cannot be instant

Current behavior:

- Reprint depends on `lastReceiptData` stored in React state.
- If the app reloads, session changes, or Electron restarts, the fast reprint path is gone.
- Even when reprint works, the app rebuilds receipt output again before sending it to the printer.

Impact:

- Reprint is not durable.
- Reprint speed depends on full regeneration cost.
- Support cases become harder because "same invoice, same print output" is not guaranteed unless the exact renderer state still exists.

Recommendation:

Persist three layers at checkout time:

1. Canonical receipt snapshot JSON.
2. Render artifact for the selected render mode.
3. Local print spool metadata.

Suggested schema:

- `invoiceId`
- `templateVersion`
- `printerMode`
- `printerProfileHash`
- `receiptSnapshotJson`
- `receiptHtml`
- `receiptPng`
- `receiptEscposBase64`
- `createdAt`
- `lastPrintedAt`

Best path for your current raw USB + HTML/image setup:

- Generate the raster/ESC/POS bytes once, immediately after successful checkout.
- Save the final print-ready ESC/POS buffer locally in Electron `userData` and optionally in the backend.
- Reprint button should send that buffer directly if printer profile matches.

Expected gain:

- Reprint becomes near-instant.
- Reprint works after restart.
- Printer failures become retryable from spool without regenerating invoice output.

### P0. Electron startup is still network-bound

Current behavior:

- Electron is a wrapper over `https://erp.bizarch.in`.
- App startup speed depends on DNS, TLS, network latency, server response time, and web bundle download.

Impact:

- A Windows POS machine can feel slow even when local code is fine.
- Poor internet or backend slowness looks like "Electron is slow".

Recommendation:

Choose one of these paths:

1. Best UX: ship a local packaged POS shell and keep only data APIs remote.
2. Safer short-term: aggressively cache the POS shell and preload `/pos/terminal`.
3. Minimum change: restore the last POS route immediately and show cached UI while data revalidates.

Specific ideas:

- After login or session selection, prefetch `/pos/terminal`.
- Keep a lightweight cached shell in IndexedDB or Electron cache.
- Persist last session id and reopen directly into terminal mode.
- Show product grid skeleton immediately instead of waiting on multiple SWR calls.

Expected gain:

- Better cold-start perception.
- Less dependence on remote asset timing.

## Important Findings

### P1. Checkout does too much synchronous work in one user-visible path

The checkout route is business-correct, but it is expensive:

- invoice number lookup scans latest invoice by prefix
- payment number lookup repeats per payment
- stock validation does product lookup per item
- FIFO consumption does nested per-item and per-lot writes
- account lookups happen inline
- journal entries are posted inline
- final invoice is fetched again before response

This is visible in:

- `src/app/api/pos/checkout/route.ts:159-913`
- `src/lib/inventory/fifo.ts:176-254`

What should remain synchronous:

- invoice creation
- payment allocation
- stock consumption
- essential balance updates

What can be optimized without changing business safety:

- Replace `findFirst(orderBy desc)` sequence generation with a dedicated counter table.
- Prefetch all products for stock validation in one query using `where: { id: { in: [...] } }`.
- Prefetch all system accounts once instead of repeated `getSystemAccount` calls.
- Batch bundle component metadata instead of fetching bundle product info per invoice item.
- Remove final invoice reload if response data is already sufficient.
- Add structured timing logs around stock validation, FIFO, journals, and payments.

Potential medium-risk optimization:

- Move journal posting to an outbox worker after the financial source record is committed.
- Only do this if you are comfortable with eventual consistency and retry semantics.

### P1. Product catalog endpoint over-fetches

Current behavior:

- `/api/pos/products` returns all active products.
- It also includes nested stock lots and bundle component stock lots for each product.
- The terminal refetches this full dataset after every checkout.

File:

- `src/app/api/pos/products/route.ts:23-85`

Impact:

- extra DB work
- larger JSON payload
- extra renderer parsing
- more React rerenders

Recommendation:

Split this into two payload shapes:

1. Terminal list payload:
   - `id`
   - `name`
   - `sku`
   - `barcode`
   - `price`
   - `gstRate`
   - `categoryId`
   - `category`
   - `isBundle`
   - `isService`
   - `stockQuantity`
   - `weighMachineCode`

2. On-demand detail payload for bundle breakdown or drill-down.

Also:

- precompute `stockQuantity` in SQL or store it on product/inventory summary table
- avoid returning raw lot arrays to the terminal
- after sale, update only the affected SKUs in local state instead of refetching everything

### P1. Product grid will slow down with a large catalog

Current behavior:

- The full product list is filtered in memory.
- The full filtered list is rendered to DOM.
- Every cart update changes `selectedQuantities`, which can trigger broad rerenders.

File:

- `src/components/pos/product-grid.tsx:33-42`
- `src/components/pos/product-grid.tsx:102-116`

Impact:

- sluggish scrolling
- slower search
- slower add-to-cart visual response
- heavier renderer thread on low-end Windows hardware

Recommendation:

- Introduce list virtualization.
- Memoize `ProductTile`.
- Keep a stable selection map and update only changed items.
- Consider search indexing by normalized name/SKU/barcode once at load time.

Practical implementation order:

1. `React.memo(ProductTile)`
2. virtualized grid
3. precomputed search index
4. optional server-side search for very large catalogs

### P1. Checkout completion waits for unnecessary revalidation

Current behavior:

- After successful checkout, the UI does:
  - `mutateSession()`
  - `mutateHeldOrders()`
  - `mutateProducts()`
- and it `await`s all three.

File:

- `src/app/(pos)/pos/terminal/page.tsx:719-723`

Impact:

- User feels checkout is not fully done until all background fetches complete.
- Large product catalogs make the sale feel slower than necessary.

Recommendation:

- Update session total optimistically.
- Remove held order locally.
- Decrement sold item quantities locally.
- Revalidate products in the background without blocking checkout completion.

This is a high-value quick win because it improves perceived performance immediately.

### P1. Raw USB raster printing is the slowest print path

Your current described method matches this pipeline:

- React receipt -> static HTML
- hidden offscreen Electron window
- image decode and measure
- capture page to PNG
- Floyd-Steinberg dithering
- ESC * raster conversion
- raw USB send

Files:

- `src/lib/electron-print.ts:115-121`
- `electron/main.js:541-558`
- `electron/printer-service.js:302-402`

Impact:

- CPU-heavy
- memory-heavy
- slower first print
- repeated cost on every reprint

Recommendation:

For this project, the safe path is to keep `htmlRaster` or equivalent image-based rendering and optimize within that constraint:

1. Generate the raster output once at checkout time.
2. Persist the final ESC/POS bytes for reprint.
3. Persist the source HTML and canonical receipt snapshot for recovery or printer-profile changes.
4. Pre-cache static assets such as logos.
5. Avoid re-opening a fresh offscreen rendering pipeline for every reprint when a matching cached artifact already exists.

This keeps Arabic rendering quality intact while removing most of the repeated print cost.

### P2. Print pipeline repeatedly creates temp files and hidden BrowserWindows

Current behavior:

- HTML receipts are written to temp files.
- A hidden BrowserWindow is created for each print.
- HTML driver mode and raster mode both measure height and wait for paint.

Files:

- `electron/main.js:166-189`
- `electron/main.js:191-229`
- `electron/main.js:483-550`

Impact:

- per-print latency
- extra disk I/O
- window creation overhead

Recommendation:

- Reuse a single hidden print window per mode.
- Reuse a persistent offscreen window for raster capture.
- Cache measured page styles where possible.
- Skip regeneration entirely when a print-ready artifact exists.

### P2. Lint signal is polluted by generated build artifacts

Observation:

- `npm run lint` reported thousands of warnings and errors because `.vercel/output` generated files are being linted.

Impact:

- real warnings are harder to see
- performance cleanup work gets harder to track

Recommendation:

- exclude `.vercel`, `.next`, generated chunks, and test throwaway files from ESLint

This is not a runtime performance issue, but it directly affects maintainability and delivery speed.

## Recommended Reprint Architecture

### Goal

When auto-print is off, pressing `Reprint` should be almost immediate and should not depend on React state.

### Recommended flow

1. Checkout succeeds.
2. Server returns invoice id and canonical receipt snapshot data.
3. Electron generates the print artifact once for the active printer mode.
4. Electron saves it to local spool/cache:
   - path example: `%APPDATA%/BizArch ERP/receipt-cache/<invoiceId>-<profileHash>.bin`
5. App stores metadata:
   - invoice id
   - printer profile hash
   - render mode
   - template version
   - checksum
6. Reprint button:
   - first try exact local buffer
   - if missing, try stored HTML/PNG
   - if printer profile changed, regenerate from canonical receipt snapshot

### What to store by mode

- `htmlRaster`:
  - canonical receipt JSON
  - HTML snapshot
  - final ESC/POS buffer
  - optional PNG for diagnostics
- `htmlDriver`:
  - canonical receipt JSON
  - HTML snapshot
  - measured page height

### Safety rules

- include `templateVersion`
- include `printerProfileHash`
- include `organizationId`
- include `checksum`
- fall back to regeneration if any mismatch is detected

### Retention

- keep local spool for 7 to 30 days
- clean up old files on app startup
- keep last 500 or 1000 receipts locally, whichever comes first

## Safe Optimization Plan

### Phase 1: Quick Wins

Target: 1 to 3 days

- Persist `receiptSnapshotJson`, `receiptHtml`, and final `receiptEscposBase64`.
- Make reprint read from persisted artifacts instead of `lastReceiptData`.
- Stop awaiting `mutateProducts()` on checkout.
- Optimistically update session totals and sold item stock in memory.
- Exclude generated artifacts from ESLint.
- Add timing logs for:
  - checkout total
  - stock validation
  - FIFO
  - payment posting
  - HTML generation
  - raster capture
  - buffer send

Expected result:

- noticeably faster checkout completion
- instant reprint path
- better diagnostics

### Phase 2: High-Impact Backend and Renderer Work

Target: 3 to 7 days

- Split `/api/pos/products` into light list payload and detail payload.
- Add virtualized product grid.
- Memoize product tiles.
- Batch stock validation queries.
- Batch account lookups.
- Replace sequence generation with a counter table.
- Reuse hidden print windows and offscreen raster windows.
- Add printer-profile-aware reuse of cached raster/ESC-POS artifacts.

Expected result:

- better large-catalog performance
- lower renderer CPU load
- lower checkout p95

### Phase 3: Architecture Improvements

Target: 1 to 2 weeks

- Add durable print spool manager in Electron main process.
- Add printer-profile-aware artifact cache.
- Package a more local-first POS shell or aggressively pre-cache terminal assets.
- Consider outbox-based post-commit jobs for non-critical side effects.

Expected result:

- much better cold start
- retryable print pipeline
- better offline/poor-network behavior

## Suggested Benchmarks

Measure before and after every phase.

Core metrics:

- Electron launch to first visible frame
- Login/session select to terminal interactive
- Product grid first render
- Search response time with 100, 500, 1000, 5000 products
- Checkout API duration:
  - p50
  - p95
  - p99
- Print dispatch latency:
  - checkout click to bytes sent
- Printer completion latency:
  - checkout click to paper out
- Reprint latency:
  - button click to bytes sent

Recommended instrumentation:

- Renderer:
  - `performance.mark()` around page mount, product fetch, checkout click, toast shown
- Next route:
  - structured timing logs inside `/api/pos/checkout`
- Electron main:
  - timing around `loadReceiptWindow`
  - `prepareHtmlReceiptWindow`
  - `captureReceiptRasterBuffers`
  - `buildImageReceiptBuffer`
  - `sendBuffer`
- Playwright:
  - automated scenario for session open -> add item -> checkout -> reprint

## Suggested Playwright Performance Script

Good scenario:

1. Open POS terminal
2. Wait for product grid ready
3. Search a product
4. Add one item
5. Complete checkout
6. Record time until:
   - success toast
   - print dispatch log
   - reprint dispatch log

Also capture:

- browser trace
- console timing
- network waterfall for POS startup

## Final Priority Order

1. Persistent receipt artifacts plus local spool/reprint cache
2. Stop blocking checkout on full product refetch
3. Lighten `/api/pos/products` payload
4. Virtualize product grid and memoize tiles
5. Batch and cache checkout-side DB lookups
6. Reuse hidden print windows and skip raster regeneration when cached artifacts exist
7. Reduce network dependency of Electron startup

## Notes and Limitations

- Production build verification succeeded locally.
- Live DB timing probes could not be executed from this shell because Prisma returned `ECONNREFUSED`.
- That means the checkout timing section is based on code-path analysis rather than live query timing.
- The findings are still strong because the main bottlenecks are visible directly in the code structure.
