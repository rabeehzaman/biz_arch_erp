# Mobile Fix Status

Updated: 2026-03-09

## Fixed / Implemented

### Shared shell and reusable UI
- Mobile sidebar sheet semantics and sizing improved in `src/components/sidebar.tsx`.
- Header hydration/mount handling improved and mobile search trigger added in `src/components/header.tsx`.
- Shared table wrapper/cells made safer on phones in `src/components/ui/table.tsx`.
- Mobile table/card skeleton support added in `src/components/table-skeleton.tsx`.
- Branch/warehouse selector stacked for mobile in `src/components/inventory/branch-warehouse-selector.tsx`.
- IMEI camera scanner made hydration-safe in `src/components/mobile-devices/imei-camera-scanner.tsx`.

### Core pages covered
- `src/app/(dashboard)/settings/page.tsx`
- `src/app/(pos)/pos/page.tsx`
- `src/app/(pos)/pos/terminal/page.tsx`
- `src/app/(dashboard)/mobile-shop/imei-lookup/page.tsx`
- `src/app/(dashboard)/mobile-shop/device-inventory/page.tsx`
- `src/app/(dashboard)/reports/branch-pl/page.tsx`

### Create / edit / detail pages updated for mobile layout
- Sales:
  - `src/app/(dashboard)/invoices/new/page.tsx`
  - `src/app/(dashboard)/invoices/[id]/edit/page.tsx`
  - `src/app/(dashboard)/invoices/[id]/page.tsx`
  - `src/app/(dashboard)/quotations/new/page.tsx`
  - `src/app/(dashboard)/quotations/[id]/edit/page.tsx`
  - `src/app/(dashboard)/quotations/[id]/page.tsx`
  - `src/app/(dashboard)/credit-notes/[id]/edit/page.tsx`
  - `src/app/(dashboard)/credit-notes/[id]/page.tsx`
- Purchases / inventory:
  - `src/app/(dashboard)/purchase-invoices/new/page.tsx`
  - `src/app/(dashboard)/purchase-invoices/[id]/edit/page.tsx`
  - `src/app/(dashboard)/purchase-invoices/[id]/page.tsx`
  - `src/app/(dashboard)/debit-notes/[id]/page.tsx`
  - `src/app/(dashboard)/inventory/stock-transfers/[id]/page.tsx`
- Accounting / admin:
  - `src/app/(dashboard)/accounting/expenses/new/page.tsx`
  - `src/app/(dashboard)/accounting/expenses/[id]/page.tsx`
  - `src/app/(dashboard)/accounting/journal-entries/new/page.tsx`
  - `src/app/(dashboard)/accounting/journal-entries/[id]/edit/page.tsx`
  - `src/app/(dashboard)/accounting/journal-entries/[id]/page.tsx`
  - `src/app/(dashboard)/accounting/cash-bank/[id]/page.tsx`
  - `src/app/(dashboard)/admin/organizations/[id]/page.tsx`

### Dialog / sheet fixes
- POS held-orders sheet now includes a proper screen-reader description in `src/app/(pos)/pos/terminal/page.tsx`.
- Mobile dialog/footer stacking was already applied for:
  - POS register accounts dialog
  - POS close-session dialog
  - POS session history dialog
  - invoice payment dialog
  - purchase invoice payment dialog
  - expense pay dialog
  - expense approve/void alert dialog
  - journal post/void alert dialog
  - cash/bank deposit-withdrawal dialog
  - admin organization confirmation dialogs

## Live Verification Completed

### Mobile viewport route sweep
- Verified at `390x844` with seeded records and no horizontal overflow:
  - invoice detail/edit
  - quotation detail/edit
  - credit note detail/edit
  - purchase invoice detail/edit
  - debit note detail
  - stock transfer detail
  - expense detail
  - journal entry detail/edit
  - cash/bank account detail

### POS flow
- Verified on mobile:
  - open register
  - add product to cart
  - hold order
  - restore held order
  - single-payment checkout
  - split-payment UI and checkout
  - close session in clearing-account mode
  - session history list view
  - session history detail view
  - register accounts dialog
- Verified console warnings are clean for the POS dialogs after the held-orders sheet fix.

### Build / lint
- `npx eslint 'src/app/(pos)/pos/terminal/page.tsx'`: passed
- `npm run build`: passed

## Remaining / Not Fully Verifiable

### Permission-limited route
- `src/app/(dashboard)/admin/organizations/[id]/page.tsx` was code-updated but could not be live-verified with the current Qimma user session because the route redirects back to `/`.

### Native print path
- POS "Reprint last receipt" could not be fully verified in Playwright because it enters the native print path and blocks the browser harness. The surrounding mobile UI is verified, but the native print action itself is still unconfirmed in-browser.

### Optional follow-up coverage
- Additional viewport pass for `360x800`, `430x932`, and tablet widths can still be done later if needed.
