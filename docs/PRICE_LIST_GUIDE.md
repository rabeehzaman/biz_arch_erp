# BizArch ERP — Price List Guide

## Table of Contents
1. [Overview](#overview)
2. [Enabling Price Lists](#enabling)
3. [Creating a Price List](#creating)
4. [Managing Products in a Price List](#managing-items)
5. [Assigning Price Lists to Users & Customers](#assigning)
6. [How Price Resolution Works](#resolution)
7. [Price Lists in Invoices & Quotations](#invoices)
8. [Price Lists in POS](#pos)
9. [Invoice Template Selection](#templates)

---

## 1. Overview <a name="overview"></a>

The Price List feature allows organizations to maintain multiple pricing tiers for their products. Instead of changing a product's base price, you create price lists with overrides and assign them to specific **users** (salespeople) or **customers**.

Key capabilities:
- **Fixed price overrides** — Set a specific price for a product (e.g., Widget = 80.00 instead of 100.00)
- **Percentage offsets** — Adjust prices by a percentage (e.g., -10% = 10% discount, +5% = 5% markup)
- **Default discount** — Apply a blanket discount to all products in a price list
- **User assignments** — A salesperson always sees their assigned pricing
- **Customer assignments** — A specific customer always gets their negotiated pricing
- **Priority system** — Customer price list takes priority over user price list

The feature only activates when enabled for an organization. Non-enabled orgs are completely unaffected.

---

## 2. Enabling Price Lists <a name="enabling"></a>

### Step 1: Super Admin enables the feature
1. Login as **super admin**
2. Go to **Admin > Organizations** and select the organization
3. Scroll to the **Modules** section
4. Toggle **Enable Price Lists** to ON
5. Click **Save**

Once enabled, a **Price Lists** tab appears in the organization's **Settings** page for admin users.

---

## 3. Creating a Price List <a name="creating"></a>

1. Go to **Settings** > **Price Lists** tab
2. Click **Create** (top right)
3. Fill in the form:
   - **Name** (required) — e.g., "Wholesale Pricing", "VIP Customers", "Staff Discount"
   - **Description** (optional) — A note about when this list applies
   - **Default Discount %** — A blanket percentage discount applied to ALL products in this list. Set to 0 if you only want per-product overrides.
   - **Active** toggle — Inactive price lists are ignored during price resolution
4. Click **Create**

The price list now appears in the table showing its name, default discount, item count, assignments, and status.

### Editing a Price List
Click the **pencil icon** on any price list row to edit its name, description, default discount, or active status.

### Deleting a Price List
Click the **trash icon** on any price list row. A confirmation dialog appears. Deleting a price list removes all its items and assignments.

---

## 4. Managing Products in a Price List <a name="managing-items"></a>

Click the **list icon** on a price list row to open the items dialog.

### Adding Products One by One
1. Use the **product dropdown** to select a product
2. Click the **+** button
3. The product is added with its current base price as a FIXED override
4. Adjust the override type or value inline (see below)

### Bulk Add All Products
1. Click **Add All** to expand the bulk panel
2. Enter a **percentage offset** (e.g., -10 for a 10% discount, +5 for a 5% markup)
3. Click **Add All** — every product not already in the list is added with that percentage offset

### Editing Item Prices
Each item row shows:

| Column | Description |
|--------|-------------|
| **Product** | Product name and SKU |
| **Base Price** | The product's original price |
| **Override Type** | Choose **Fixed** or **Percentage** from the dropdown |
| **Value** | For Fixed: the exact price. For Percentage: the offset (e.g., -10 = 10% off) |
| **Effective Price** | The calculated final price the customer/user will see |

- Change the **override type** dropdown to switch between Fixed and Percentage
- Edit the **value** field and click away (blur) to save

### Removing a Product
Click the **red trash icon** on any item row.

### Searching
Use the **search box** to filter products by name — this filters both the items table and the add-product dropdown.

---

## 5. Assigning Price Lists to Users & Customers <a name="assigning"></a>

Click the **users icon** on a price list row to open the assignment dialog.

### Assigning to Users (Salespeople)
1. In the **Users** section, select a user from the dropdown
2. Click **+** to assign
3. The user appears as a badge below

When this user creates invoices, quotations, or uses POS, product prices automatically adjust to the assigned price list.

**Note:** Each user can only be assigned to ONE price list. Assigning to a new list automatically removes the previous assignment.

### Assigning to Customers
1. In the **Customers** section, select a customer from the dropdown
2. Click **+** to assign
3. The customer appears as a badge below

When anyone creates an invoice/quotation for this customer, the customer's price list prices are used.

**Note:** Each customer can only be assigned to ONE price list.

### Removing Assignments
Click the **X** on any user or customer badge to unassign them.

---

## 6. How Price Resolution Works <a name="resolution"></a>

When a user creates an invoice, quotation, or rings up a POS sale, the system resolves product prices in this priority order:

```
1. Customer Price List  (highest priority)
2. User Price List      (fallback)
3. Base Product Price   (default)
```

### Example Scenario

**Setup:**
- Product "Widget" base price: 100.00
- "VIP Customers" price list: Widget = 80.00 (Fixed), assigned to Customer "Acme Corp"
- "Staff Discount" price list: -15% on all products, assigned to User "Ali"

**When Ali creates an invoice for Acme Corp:**
- Widget price = **80.00** (Acme Corp's customer price list wins)

**When Ali creates an invoice for a different customer (no price list):**
- Widget price = **85.00** (Ali's staff discount of -15% applies)

**When another user creates an invoice for a walk-in customer:**
- Widget price = **100.00** (no price list applies, base price used)

### Price Calculation Rules

For **Fixed** overrides:
- The exact fixed price is used, regardless of base price

For **Percentage** overrides:
- Formula: `Base Price x (1 + Offset / 100)`
- Example: Base 100, Offset -10% = 100 x 0.90 = **90.00**
- Example: Base 100, Offset +20% = 100 x 1.20 = **120.00**

For **Default Discount** (no per-product override):
- Formula: `Base Price x (1 - Default Discount / 100)`
- Example: Base 100, Default Discount 5% = 100 x 0.95 = **95.00**

**Note:** Jewellery products are excluded from price list resolution — their prices are calculated from gold rates.

---

## 7. Price Lists in Invoices & Quotations <a name="invoices"></a>

When creating a **new invoice** or **new quotation**:

1. Select a customer
2. If the customer has an assigned price list, OR the logged-in user has an assigned price list, product prices automatically update
3. The adjusted prices appear when you add products to the line items
4. If you change the customer, prices re-resolve automatically

The price shown in the product selector and line items reflects the resolved price — no manual action needed.

---

## 8. Price Lists in POS <a name="pos"></a>

In the POS terminal:

1. The logged-in user's price list is automatically applied to all products
2. Product prices in the POS grid/list reflect the resolved prices
3. If a customer is selected and has their own price list, that takes priority

No configuration is needed in POS — it works automatically based on assignments.

---

## 9. Invoice Template Selection <a name="templates"></a>

This is a separate feature that was shipped alongside price lists.

### How It Works

**Super Admin assigns templates to an organization:**
1. Go to **Admin > Organizations** > select organization
2. In the **PDF Settings** section, check the templates this organization can use:
   - A5 Landscape
   - A4 Portrait
   - A4 GST
   - A4 VAT
   - A4 Bilingual
   - A4 Modern GST
   - A4 Jewellery
3. Set the **default template**
4. Save

**Users select a template when downloading:**
1. Open any invoice detail page
2. The **Download PDF** button uses the organization's default template
3. Click the **dropdown arrow** next to the button to see all assigned templates
4. Click any template to download the invoice in that format

This lets organizations that serve multiple markets (e.g., both local and export customers) quickly switch between invoice formats without changing settings.
