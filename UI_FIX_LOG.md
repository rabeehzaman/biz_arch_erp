# UI Fix Log

Updated: 2026-03-12

## Scope

This file tracks the ongoing full UI audit and fix pass across the BizArch ERP app.
Each completed fix should be added here immediately after the code change lands.

## Audit Notes

- Goal: improve mobile and general UI reliability, reduce layout glitches, simplify heavy shell UI, and keep performance-oriented changes documented.
- Method: shared-shell audit, Playwright CLI sweep, Playwright MCP visual checks, route-by-route fixes.

## Fixes

### 1. Shared shell simplification

- Reduced heavy global visual effects in `/src/app/globals.css` to a simpler light background and lighter shadows.
- Removed global smooth scrolling to avoid mobile scroll reset glitches.
- Reduced page/stagger animation intensity in `/src/components/ui/page-animation.tsx`.
- Simplified shared dashboard shell styling in `/src/app/(dashboard)/client-layout.tsx`.
- Simplified sidebar visuals in `/src/components/sidebar.tsx`.
- Simplified dashboard cards and hero density in `/src/components/dashboard/dashboard-content.tsx`.
- Result: lighter rendering cost, less visual jitter, less UI chrome competing with content.

### 2. Mobile bottom navigation reliability

- Replaced the Konsta bottom tabbar in `/src/components/mobile-layout.tsx` with a custom 5-column fixed nav.
- Ensured all five items, including `More`, stay visible on narrow phones like `360px`.
- Result: bottom navigation no longer clips the last tab on small screens.

### 3. Mobile route scroll reset

- Added route-change scroll reset in `/src/components/mobile-layout.tsx`.
- Result: mobile page navigation now opens new pages from the top instead of preserving previous scroll offsets.

### 4. Invoice detail mobile compaction

- Reduced spacing and header density in `/src/app/(dashboard)/invoices/[id]/page.tsx`.
- Converted top actions into a tighter mobile-friendly grid with shorter labels.
- Reduced tab and header vertical footprint so invoice content appears sooner.
- Result: invoice detail pages show more useful content above the fold on small screens.

### 5. POS landing bottom navigation

- Added a POS route shell in `/src/components/pos-shell.tsx`.
- Updated `/src/app/(pos)/layout.tsx` to use the POS shell.
- Bottom navigation is now visible on the POS landing page at `/pos`.
- The actual POS terminal flow at `/pos/terminal` remains full-screen without the bottom nav.
- Result: POS landing matches the rest of the mobile app shell without interfering with the selling screen.

### 6. Detail page header compaction family

- Applied the compact mobile header/action pattern to:
  - `/src/app/(dashboard)/quotations/[id]/page.tsx`
  - `/src/app/(dashboard)/purchase-invoices/[id]/page.tsx`
  - `/src/app/(dashboard)/credit-notes/[id]/page.tsx`
  - `/src/app/(dashboard)/debit-notes/[id]/page.tsx`
- Reduced header spacing, smaller back button, smaller action buttons, shorter mobile labels, and tighter top document spacing.
- Result: these detail pages now show more useful content before first scroll on small phones.

### 7. Broad route-sweep audit harness

- Added `/e2e/route-sweep.spec.ts`.
- The sweep opens a broad admin route set plus key dynamic detail routes and a superadmin subset on a `360x800` mobile viewport.
- It checks for page-level horizontal overflow, empty bodies, fatal error text, and clipped navigation items.
- Result: gives a repeatable crawl to surface the next batch of route-level UI breakages during this cleanup pass.

### 8. Route-sweep stability hardening

- Updated `/e2e/route-sweep.spec.ts` to wait for late-loading routes to settle and retry around redirect-time execution-context resets.
- Result: the mobile crawl can continue through redirecting or background-loading pages instead of failing early on a navigation race.

### 9. Superadmin organization detail mobile reliability

- Updated `/src/app/(dashboard)/admin/organizations/[id]/page.tsx`.
- Added a visible loading state so the page no longer appears blank while organization data is loading.
- Converted the users area to mobile cards on small screens while keeping the table on desktop.
- Tightened the mobile header, stabilized the horizontal tab strip, and made maintenance/danger actions stack cleanly on phones.
- Result: the organization detail page is readable and actionable on mobile without wide tables or blank initial states.

### 10. Accounting and statement mobile overflow cleanup

- Updated `/src/app/(dashboard)/accounting/cash-bank/page.tsx` to stack header actions on mobile, collapse dialog form grids, switch account cards to a single-column phone layout, and add safer text wrapping for balances and labels.
- Updated `/src/app/(dashboard)/customers/[id]/statement/page.tsx` to replace the transaction table with mobile cards on phones, compact the summary metrics, and stack the date filters/download action cleanly.
- Tightened `/src/app/(dashboard)/admin/organizations/[id]/page.tsx` further with `min-w-0` containment and safer text wrapping so one wide child cannot stretch the full card grid off-screen.
- Result: these routes stop pushing the document wider than the viewport and keep the mobile bottom nav inside the screen.

### 11. Supplier statement mobile compaction

- Updated `/src/app/(dashboard)/suppliers/[id]/statement/page.tsx`.
- Replaced the mobile transaction table with stacked statement cards, compacted the summary cards, and stacked the filter/download controls for narrow screens.
- Result: supplier statements now match the customer-statement mobile treatment and no longer force page width beyond the viewport.

### 12. Sweep coverage expansion

- Expanded `/e2e/route-sweep.spec.ts` to include `/pos/terminal` plus additional edit/detail routes for credit notes, debit notes, and journal entries.
- Result: the cleanup crawl now covers more of the real route tree instead of leaving those pages outside the mobile audit.

### 13. Public login mobile coverage

- Added `/e2e/public-mobile-ui.spec.ts` to verify the unauthenticated login page on a `360x800` viewport.
- Result: the only non-authenticated page file in the route inventory is now covered by an automated mobile overflow check too.

### 14. Mobile POS label shortening

- Updated `/src/components/mobile-layout.tsx` and `/src/components/pos-shell.tsx` so the bottom-nav item uses a dedicated mobile label key.
- Added `nav.posShort` in `/src/locales/en.json` and `/src/locales/ar.json`.
- Updated `/e2e/mobile-ui.spec.ts` to assert the mobile nav now shows `POS`.
- Result: on phones the bottom nav is shorter and clearer, while desktop wording can still stay `POS Terminal`.

### 15. Core list pages switched from tables to mobile cards

- Updated `/src/app/(dashboard)/quotations/page.tsx`, `/src/app/(dashboard)/purchase-invoices/page.tsx`, `/src/app/(dashboard)/credit-notes/page.tsx`, and `/src/app/(dashboard)/debit-notes/page.tsx` to use stacked mobile cards while keeping the table on `sm+`.
- Updated `/src/app/(dashboard)/customers/page.tsx`, `/src/app/(dashboard)/suppliers/page.tsx`, `/src/app/(dashboard)/payments/page.tsx`, `/src/app/(dashboard)/supplier-payments/page.tsx`, and `/src/app/(dashboard)/accounting/expenses/page.tsx` with the same mobile-card treatment.
- Added a mobile regression in `/e2e/mobile-ui.spec.ts` to ensure these list pages do not render visible tables on phone-sized viewports.
- Result: the main day-to-day sales, purchase, party, payment, and expense lists now behave like mobile-first screens instead of compressed desktop grids.

### 16. Report, admin, and inventory list pages switched from tables to mobile cards

- Updated `/src/app/(dashboard)/reports/customer-balances/page.tsx` and `/src/app/(dashboard)/reports/supplier-balances/page.tsx` so balance reports show stacked party cards with quick statement access on phones.
- Updated `/src/app/(dashboard)/inventory/branches/page.tsx` to convert both the branches tab and the warehouses tab into mobile card lists with full-size action buttons.
- Updated `/src/app/(dashboard)/inventory/opening-stock/page.tsx` and `/src/app/(dashboard)/inventory/stock-transfers/page.tsx` so stock rows become compact cards that surface the most important quantities and actions without horizontal squeeze.
- Updated `/src/app/(dashboard)/admin/organizations/page.tsx`, `/src/app/(dashboard)/accounting/journal-entries/page.tsx`, and `/src/app/(dashboard)/mobile-shop/device-inventory/page.tsx` to keep organization, journal, and device lists in card form on phone screens.
- Expanded `/e2e/mobile-ui.spec.ts` with a dedicated regression covering the above routes and the warehouse tab variant.
- Result: the next tier of admin, inventory, and accounting list screens now behave consistently with the earlier invoice/customer card treatment on mobile.

### 17. Core financial summary reports switched from tables to mobile cards

- Updated `/src/app/(dashboard)/reports/trial-balance/page.tsx`, `/src/app/(dashboard)/reports/profit-loss/page.tsx`, `/src/app/(dashboard)/reports/cash-flow/page.tsx`, and `/src/app/(dashboard)/reports/expense-report/page.tsx`.
- Stacked the filter controls more safely on phones and replaced the main report tables with compact card summaries on small screens while preserving the desktop tables on `sm+`.
- Added a focused regression in `/e2e/mobile-ui.spec.ts` to ensure these report routes keep all tables hidden on mobile and stay inside the viewport width.
- Result: the primary accounting summary reports are now readable on phones without pinch-zooming or horizontal table squeeze.

### 18. Inventory valuation and balance-sheet reports switched from tables to mobile cards

- Updated `/src/app/(dashboard)/reports/stock-summary/page.tsx` so stock rows become compact inventory cards with quantity, cost, value, warehouse, lots, and status visible on phones.
- Updated `/src/app/(dashboard)/reports/balance-sheet/page.tsx` so asset/liability/equity sections render as expandable mobile cards while keeping the grouped desktop table experience on larger screens.
- Expanded the financial-report mobile regression in `/e2e/mobile-ui.spec.ts` to cover both routes.
- Result: two of the densest finance/inventory report screens now read like mobile reports instead of shrunken spreadsheets.

### 19. Final read-only report and maintenance table cleanup

- Updated `/src/app/(dashboard)/reports/profit-by-items/page.tsx` so invoice profit rows and expanded item rows render as stacked mobile cards instead of a compressed expandable table.
- Updated `/src/app/(dashboard)/admin/fix-balances/page.tsx` so all customer-balance and product-cost issue/result tables now render as compact mobile cards, with the action buttons stacked more safely on phones.
- Updated `/src/app/(dashboard)/reports/ledger/page.tsx` to show ledger transactions as mobile cards.
- Tightened `/src/app/(dashboard)/customers/[id]/statement/page.tsx`, `/src/app/(dashboard)/suppliers/[id]/statement/page.tsx`, and `/src/app/(dashboard)/admin/organizations/[id]/page.tsx` so their mobile card layouts switch at the phone-friendly `sm` breakpoint instead of waiting until `md`.
- Expanded `/e2e/mobile-ui.spec.ts` to cover the profit-by-items report and the superadmin fix-balances flow.
- Result: the remaining read-only table-heavy pages now have mobile-first card behavior, leaving mainly editable line-item builders as the remaining special-case table surfaces.

### 20. Journal entry edit mobile overflow fix

- Updated `/src/app/(dashboard)/accounting/journal-entries/[id]/edit/page.tsx` so the account selector in each mobile line card is forced to stay within the card width and truncate long account names instead of growing the page.
- Added `min-w-0` containment around the line grid and mobile card wrapper so long selected values cannot stretch the entire document and push the bottom nav out of frame.
- Verified with a targeted mobile audit on `/accounting/journal-entries/[id]/edit` that document width is back to `360px` and all five bottom-nav items stay inside the viewport.
- Result: the last route-sweep overflow found in the editable journal-entry flow is fixed without changing the desktop editing layout.

### 21. Product add/edit modal mobile stability pass

- Updated `/src/components/ui/dialog.tsx` so mobile dialogs use a single reliable inner scroll container, a taller sheet height, and less fragile sticky header/footer behavior instead of competing nested scroll areas.
- Updated `/src/components/products/product-form-dialog.tsx` to tighten the mobile spacing, keep the close/title area clear, turn the service/bundle/IMEI toggles into larger mobile-safe rows, and rebuild bundle component rows as stacked cards instead of a cramped single-line flex row.
- Updated `/src/components/products/category-select.tsx` and `/src/components/units/unit-select.tsx` so the form selects stay full-width on phones rather than shrinking or growing based on the selected label.
- Updated `/src/components/scanner/global-scanner.tsx` so the floating scanner FAB automatically hides whenever any dialog, sheet, or alert dialog is open, preventing it from covering product-modal controls.
- Expanded `/e2e/mobile-ui.spec.ts` with dedicated mobile regressions for the product add modal and product edit modal, including bundle-mode coverage and scanner-hidden assertions.
- Result: the most-used product modal now scrolls predictably on mobile, keeps fields aligned to the dialog width, leaves the submit bar unobstructed, and no longer gets covered by the floating scanner button.

### 22. Shared dialog shell and tall-form modal scroll audit

- Updated `/src/components/ui/dialog.tsx` so the shared mobile dialog shell uses a safer viewport-height buffer and more reliable sticky chrome behavior on shorter phones, preventing bottom action bars from getting clipped while the sheet animates or settles.
- Reworked tall form dialogs in `/src/components/customers/customer-form-dialog.tsx`, `/src/components/suppliers/supplier-form-dialog.tsx`, `/src/app/(dashboard)/payments/page.tsx`, `/src/app/(dashboard)/supplier-payments/page.tsx`, `/src/app/(dashboard)/accounting/chart-of-accounts/page.tsx`, `/src/app/(dashboard)/accounting/cash-bank/page.tsx`, `/src/components/settings/units-settings.tsx`, `/src/components/settings/unit-conversions-settings.tsx`, `/src/components/units/unit-form-dialog.tsx`, `/src/app/(dashboard)/customers/page.tsx`, and `/src/app/(dashboard)/suppliers/page.tsx` so the dialog header/footer attach to the shared scroll area instead of moving with the entire form on mobile.
- Removed legacy `overflow-y-auto max-h-[90vh]` overrides from `/src/app/(dashboard)/inventory/stock-transfers/page.tsx` and `/src/app/(dashboard)/admin/organizations/sidebar-config-dialog.tsx`, letting those dialogs use the same stable mobile shell as the rest of the app.
- Expanded `/e2e/mobile-ui.spec.ts` with a short-phone dialog sweep covering customers, suppliers, payments, supplier payments, stock transfers, chart of accounts, device inventory, and the superadmin sidebar-configuration dialog.
- Result: the main tall dialogs now behave like proper mobile sheets, with anchored titles/actions and a single predictable scroll region instead of the header, footer, or entire modal drifting during long-form editing.

### 23. Installed web-app shell tightened for home-screen mode

- Updated `/src/app/manifest.ts` to declare `scope: "/"` and `orientation: "portrait"` so Android-installed home-screen launches stay locked to portrait mode at the manifest level.
- Updated `/src/app/layout.tsx` with explicit base viewport metadata, Apple web-app metadata, and a `beforeInteractive` bootstrap so standalone launches apply the stricter mobile viewport before hydration.
- Added `/src/components/pwa/standalone-shell-guard.tsx` to detect standalone/home-screen mode, disable zoom only for the installed app, attempt a portrait lock where the browser allows it, and show a full-screen rotate-to-portrait blocker when iPhone-style standalone mode opens in landscape.
- Updated `/src/app/globals.css` so standalone landscape mode hides background scrolling while the rotate blocker is active.
- Added `/e2e/pwa-shell.spec.ts` to verify three cases: normal browser mode keeps zoom unrestricted, standalone portrait mode adds the zoom lock, and standalone landscape mode shows the rotate blocker.
- Result: the installed BizArch web app now behaves more like a native shell on both iPhone and Android, while normal browser tabs keep the more flexible web behavior for accessibility and general use.

### 24. Bottom-nav bleed and installed-app status-bar color cleanup

- Updated `/src/components/mobile-layout.tsx` and `/src/components/pos-shell.tsx` so the shared phone bottom nav uses a fully opaque white surface instead of a blurred/translucent layer, which was letting invoice/product cards show through under the nav after normal scrolling and after closing the product add/edit dialog.
- Kept the existing bottom safe-area padding but removed the backdrop blur from the nav surface, making the shell cheaper to render and visually stable across pages after the product modal is opened and closed.
- Updated `/src/app/layout.tsx`, `/src/app/manifest.ts`, and `/src/app/globals.css` so the installed web app advertises a white theme color and paints the standalone safe-area top strip white, helping the iPhone notch area and Android installed-app status bar blend with the app instead of picking up the old blue accent.
- Expanded `/e2e/mobile-ui.spec.ts` to assert that the bottom nav stays opaque after the product modal closes and remains stable when moving to invoices, and expanded `/e2e/pwa-shell.spec.ts` to assert the generated theme-color metadata and manifest colors are white.
- Result: the shared mobile shell no longer shows page content ghosting under the bottom nav, and the installed PWA chrome now matches the app’s light surface on both iPhone and Android.

### 25. Mobile dialog keyboard/viewport reset for product add-edit flow

- Updated `/src/components/ui/dialog.tsx` so mobile dialogs no longer auto-focus the first form field on open, which prevents iPhone from immediately raising the keyboard and leaving the viewport in a lifted state after the product add/edit dialog closes.
- Added shared close-time cleanup in the same dialog shell to blur the active element, remove any leftover body pointer-event lock, and force a couple of resize passes after close so Safari can settle the fixed bottom nav back against the physical bottom edge.
- Expanded `/e2e/mobile-ui.spec.ts` so the product add-modal test now asserts the mobile dialog does not auto-focus the name field on open, keeping this keyboard-trigger path covered in regression checks.
- Result: product add/edit and other mobile dialogs now open as stable sheets without instantly summoning the keyboard, which reduces the Safari-only bottom-nav lift that was showing content beneath the nav after close.

### 26. Scanner fallback for mobile localhost and insecure camera contexts

- Updated `/src/components/scanner/global-scanner.tsx` so the floating scanner button no longer disappears when the browser blocks camera APIs. It now stays visible and explains that camera scanning on phones needs HTTPS or same-device localhost instead of silently returning `null`.
- Added shared camera-context detection in `/src/lib/camera-support.ts` and reused it in `/src/components/mobile-devices/imei-camera-scanner.tsx`, so the IMEI camera button gets the same fallback behavior instead of vanishing on insecure mobile sessions.
- Expanded `/e2e/mobile-ui.spec.ts` with a mobile regression that simulates missing camera APIs and verifies the scanner button is still visible and shows an HTTPS/help message when tapped.
- Result: when you open the dev app from a phone over a local-network HTTP URL, the scanner now tells you why it cannot open instead of looking like the feature is gone.

### 27. Arabic preference reliability and shared translation coverage sweep

- Updated `/src/app/(dashboard)/layout.tsx` and `/src/lib/i18n.tsx` so the dashboard now prefers the browser-stored language before the session default. That prevents Arabic from silently falling back to English after reload when the user has already chosen Arabic on this device.
- Expanded `/src/lib/i18n.tsx` with Saudi-Arabic translations for the remaining hardcoded shared UI strings across customer/supplier/product/device dialogs, scanners, statement/detail screens, balance reports, inventory summaries, and settings/report helper copy. I also added pattern-based translation for common English date strings and prefixes such as `Created on`, `Dated`, `Valid until`, `GL:`, `Off by`, and count-style labels like `82 transactions`.
- Updated `/src/components/journal-entry-tab.tsx` to route its labels/messages through the language layer directly instead of relying on raw English strings.
- Added the missing locale keys discovered by the translation-key audit to `/src/locales/en.json` and `/src/locales/ar.json`, covering keys like `common.noResultsFound`, `common.searchAccount`, `suppliers.supplier`, `accounting.noAccountsFound`, and `validation.accountRequired`.
- Added `/e2e/arabic-ui.spec.ts` to keep key admin routes under Arabic regression coverage, including settings, inventory, reports, accounting, mobile-shop pages, and the main detail/statement routes.
- Result: Arabic now sticks reliably on reload for the dashboard shell, the shared hardcoded English leaks are translated centrally, the translation-key audit is clean, and the focused Arabic route sweep is passing.

### 28. Desktop shell and POS performance hardening pass

- Updated `/src/components/ui/page-animation.tsx` so the shared `PageAnimation`, `StaggerContainer`, and `StaggerItem` wrappers now render immediately instead of paying for route-level motion on every dashboard/report/POS mount.
- Updated `/src/hooks/use-dashboard.ts` to back off dashboard polling from every 5 seconds to every 60 seconds, keep previous data between refreshes, and avoid revalidating while the tab is hidden or offline.
- Updated `/src/app/(pos)/pos/terminal/page.tsx` so the POS terminal now memoizes cart totals and scan indexes, defers search updates before they hit the product grid, keeps receipt/session handlers stable, and still preserves the keyed cart refresh boundaries that the desktop cart UI needs for reliable quantity/total repainting.
- Updated `/src/components/pos/product-grid.tsx`, `/src/components/pos/product-tile.tsx`, `/src/components/pos/cart-item.tsx`, and `/src/components/pos/pos-header.tsx` to trim hover-heavy card effects, isolate the live clock to its own component, and keep the POS interaction surfaces lighter without disturbing cart correctness.
- Updated `/src/app/(pos)/pos/page.tsx` so the POS landing page now uses deferred register search, memoized filtering/session lookup, and flatter card hover treatment for large desktop register lists.
- Updated `/src/components/header.tsx` to replace the heavier glass/gradient desktop header treatment with a simpler white surface, flatter search trigger, and lower-cost account menu styling.
- Added `/e2e/desktop-ui.spec.ts` to keep the desktop dashboard shell, products shell, and POS landing page under desktop regression coverage, and re-ran `/e2e/pos-cart-visibility.spec.ts` to confirm POS cart quantity and total updates still behave correctly after the performance pass.
- Result: desktop routes render more immediately, background dashboard work is quieter, the POS terminal remains responsive under repeated cart updates, and the desktop shell is cleaner and cheaper to paint.

### 29. Desktop-wide shell simplification, lazy settings loading, and full route audit

- Updated `/src/components/ui/button.tsx`, `/src/components/ui/tabs.tsx`, `/src/app/globals.css`, `/src/app/(dashboard)/client-layout.tsx`, `/src/components/sidebar.tsx`, and `/src/components/dashboard/dashboard-content.tsx` to flatten the desktop shell: the app background is now a solid surface instead of a full-page gradient, the dashboard/sidebar no longer render redundant backdrop layers, buttons and tabs now use cheaper solid fills and `transition-colors` instead of gradient-heavy shadowed states, and the dashboard stat icons now use plain tinted surfaces rather than per-card gradients.
- Updated `/src/app/(dashboard)/settings/page.tsx` so desktop settings panels are dynamically imported and only loaded when their tab is opened, while still preserving already-visited tabs in the session. This removes the eager desktop cost of pulling company, units, accounting, POS, and user-warehouse settings code up front on the first settings visit.
- Updated `/src/components/pos/customer-select.tsx` and `/src/app/(pos)/pos/page.tsx` so the POS desktop flow does less repeated work: the customer picker now fetches its compact customer list only once and reuses it on subsequent opens, and the POS landing/session-history surfaces were flattened from glassy shadow-heavy cards into simpler bordered panels that are cheaper to paint and easier to scan.
- Updated `/src/app/(auth)/login/page.tsx` to remove the older blur-heavy desktop hero treatment and replace it with a lighter public shell that keeps the same structure but drops the large blurred shapes, glass layers, and gradient/shadow stack.
- Expanded `/e2e/desktop-ui.spec.ts` with a desktop settings lazy-load regression and a public desktop login-shell audit, and added `/e2e/desktop-route-sweep.spec.ts` to walk the full current admin and superadmin page inventory at desktop width and catch route-level overflow, fixed-nav leakage, empty-body failures, and delayed shell state.
- Result: the desktop app now starts from a lighter shared shell, settings no longer load every large panel on first visit, the busiest POS desktop picker no longer refetches on every open, the login page is materially cheaper to render, and the current full desktop route sweep is passing across admin and superadmin.

### 30. Desktop sidebar scroll reachability fix

- Updated `/src/components/sidebar.tsx` so the desktop and mobile sidebar shells now use `min-h-0`/`shrink-0` at the right flex levels, making the navigation column the real scroll container instead of letting the full sidebar stack fight for height.
- Added `overscroll-contain` to the nav area and marked the logo/footer blocks as non-shrinking, which keeps the bottom settings/sign-out block reachable even when long sections like Sales, Purchases, Accounting, Reports, and inventory are all expanded.
- Expanded `/e2e/desktop-ui.spec.ts` with a desktop sidebar regression that expands the long sidebar, scrolls the nav container, and asserts the footer still stays inside the viewport.
- Result: the sidebar can now scroll through long navigation sets without trapping the bottom actions out of reach.

### 31. Dashboard stat-card total overflow fix

- Updated `/src/components/dashboard/dashboard-content.tsx` so dashboard stat values now render inside a `min-w-0` flex column, the icon stays `shrink-0`, and long numeric totals scale down when their formatted string gets longer.
- Added `[overflow-wrap:anywhere]` to the value line as a last-resort safety net, so very large currency totals still stay inside the card instead of pushing the icon or bleeding past the card edge on narrow screens.
- Result: long totals like the invoiced amount now stay inside the dashboard stat card instead of overflowing on smaller widths.

### 32. Product modal keyboard-close bottom-nav gap hardening

- Updated `/src/hooks/use-mobile-fixed-ui.ts` so shared mobile fixed-bottom chrome now does a longer recovery sweep after dialog/keyboard close, listens for explicit dialog viewport-reset events, and re-syncs on page scroll as well as `visualViewport` changes. This keeps the bottom nav hidden until Safari/browser viewport state has properly settled instead of remounting too early.
- Updated `/src/components/ui/dialog.tsx` so mobile dialog close now zeroes the shared fixed-ui offset immediately and emits a dedicated `mobile-dialog-viewport-reset` event during its resize cleanup pass, giving the shared mobile shell a reliable signal to redock the nav after the keyboard path.
- Updated `/src/app/globals.css`, `/src/components/mobile-layout.tsx`, and `/src/components/pos-shell.tsx` so mobile safe-area padding now flows through a capped shared CSS variable (`--app-safe-area-bottom`) instead of reading raw `env(safe-area-inset-bottom)` directly inside the nav/content layout. This prevents iPhone/browser keyboard insets from ballooning the bottom nav padding after the product modal closes.
- Expanded `/e2e/mobile-ui.spec.ts` so the product add-modal flow now explicitly focuses the name field, closes the dialog, waits for shell recovery, and asserts that the fixed bottom nav is still opaque, redocked to the viewport bottom, and not inflated in height/padding.
- Result: after opening Add/Edit Product, triggering the keyboard, and closing the modal, the bottom nav now snaps back to the real bottom edge instead of leaving a gap or showing content beneath it.

### 33. Mobile language switcher surfaced in the shared shell

- Added `/src/components/mobile-language-switcher.tsx`, a compact top-right mobile dropdown that uses the same persisted user language preference flow as the desktop profile menu, including saving to `/api/users/me`, updating the session, and reloading into the selected language.
- Updated `/src/components/mobile-layout.tsx` so all dashboard mobile routes, including the superadmin mobile shell, now show this small language button at the top without bringing back the heavier desktop welcome/profile card.
- Updated `/src/components/pos-shell.tsx` so the same compact language switcher is available on the `/pos` landing page on mobile while keeping `/pos/terminal` immersive.
- Expanded `/e2e/mobile-ui.spec.ts` so the dashboard mobile shell test now verifies the switcher is visible and opens with both language choices, and the POS landing mobile test checks that the switcher is present there as well.
- Result: mobile users can now switch between English and Arabic directly from the top of the page instead of having to rely on the desktop-only profile menu pattern.

### 34. Mobile language switcher narrowed to dashboard home only

- Updated `/src/components/mobile-layout.tsx` so the compact mobile language switcher now renders only on the dashboard home route (`/`) instead of every mobile dashboard page.
- Updated `/src/components/pos-shell.tsx` to remove the switcher from the POS landing shell, keeping the button scoped exactly to the dashboard as requested.
- Updated `/e2e/mobile-ui.spec.ts` so the invoices mobile test and POS landing mobile test now assert that the switcher is absent outside the dashboard, while the dashboard shell test still verifies it is visible and openable there.
- Result: the language button now appears only on the mobile dashboard page and nowhere else.

### 35. Bottom nav no longer drifts during end-of-page overscroll

- Updated `/src/hooks/use-mobile-fixed-ui.ts` so the shared mobile bottom-nav offset is now applied only during explicit modal/keyboard recovery passes. Normal page scrolling no longer feeds live `visualViewport` deltas directly into the nav transform.
- This prevents the iPhone-style last-scroll rubber-band from pushing the fixed bottom nav downward when the user keeps dragging past the end of the page; the nav now stays visually locked to the bottom edge in normal browsing.
- Expanded `/e2e/mobile-ui.spec.ts` so the shared bottom-nav docking helper also asserts that the nav transform is `none` in its resting state, and the invoices mobile test now scrolls to the bottom before checking that the nav remains docked.
- Result: when a user reaches the bottom of a page and tries to scroll further, the bottom nav stays fixed instead of moving with the overscroll bounce.

### 36. Bottom nav underlay to prevent content bleed below the bar

- Updated `/src/components/mobile-layout.tsx` and `/src/components/pos-shell.tsx` so the mobile bottom nav now renders with a dedicated fixed white underlay beneath it. This layer sits behind the nav controls and fills the bottom edge if Safari/iPhone leaves a temporary gap during bounce or toolbar movement.
- Expanded `/e2e/mobile-ui.spec.ts` so the shared nav-surface assertion now verifies that this underlay is present and opaque, keeping the anti-bleed protection locked in for dashboard, invoices, product-modal recovery, and POS landing flows.
- Result: even if the browser tries to expose space under the fixed nav, users now see a solid white base instead of page content bleeding through below the bar.

### 37. Stock transfer Arabic coverage completed for list, detail, and modal flows

- Updated `/src/app/(dashboard)/inventory/stock-transfers/page.tsx` so the stock transfer list page and the `New Transfer` dialog now use explicit locale keys for the page heading, search field, empty state, mobile cards, table headers, source/destination warehouse selectors, item picker, completion button, status badges, and transfer/reversal toast messages instead of leaking hardcoded English.
- Updated `/src/app/(dashboard)/inventory/stock-transfers/[id]/page.tsx` so the transfer detail route now localizes the title, recorded date, reverse action, PDF actions, stats, transfer note metadata, item table/card labels, and reverse-transfer dialog in Arabic with locale-aware date/number formatting.
- Expanded `/src/locales/en.json` and `/src/locales/ar.json` with the missing stock-transfer and cash-bank transfer vocabulary, including Saudi-style Arabic labels for source/destination warehouses, transfer completion, reverse-transfer states, and transfer modal copy.
- Updated `/src/app/(dashboard)/accounting/cash-bank/page.tsx` so the transfer-between-accounts modal no longer leaks English placeholders or dialog copy when Arabic is active, and its toast messages now use locale-backed strings too.
- Expanded `/e2e/arabic-ui.spec.ts` so the Arabic regression now also covers the stock-transfer detail route, opens the stock-transfer creation dialog, and opens the cash/bank transfer dialog to catch modal-only English copy leaks.
- Result: the inventory transfer flow now stays in Arabic across list, detail, and creation/reversal flows, and the broader modal sweep also closed the extra Arabic leak that was still present in the cash-bank transfer dialog.

### 38. Vercel production build typing hardening

- Fixed `/src/app/(dashboard)/settings/page.tsx` so the settings tab panels only pass `forceMount` when a panel has actually been loaded. Radix types that prop as a presence-only flag, and the previous `boolean` form passed local dev but failed Vercel production typechecking.
- Updated `/src/components/pos/product-tile.tsx` and `/src/components/pos/product-grid.tsx` to share a single POS tile product shape, which removes the callback parameter mismatch that surfaced on the next production build pass.
- Updated `/src/components/pwa/standalone-shell-guard.tsx` to use a lockable orientation helper type before calling `screen.orientation.lock("portrait")`, keeping the runtime behavior while satisfying the stricter build-time DOM typings used during production compilation.
- Result: `npm run build` now completes successfully again, matching the Vercel production build path that had been failing after the previous push.

## Next Targets

- Continue route-by-route sweep across dashboard, sales, purchases, reports, POS, settings, and mobile-shop pages.
- Focus on overflow, sticky/header gaps, action density, table-to-card mobile conversions, and unnecessary visual weight.
