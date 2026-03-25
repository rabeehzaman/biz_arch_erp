-- CreateSchema
CREATE SCHEMA IF NOT EXISTS "public";

-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('TRIAL', 'ACTIVE', 'EXPIRED', 'SUSPENDED');

-- CreateEnum
CREATE TYPE "QuotationStatus" AS ENUM ('SENT', 'CONVERTED', 'CANCELLED', 'EXPIRED');

-- CreateEnum
CREATE TYPE "PurchaseInvoiceStatus" AS ENUM ('DRAFT', 'RECEIVED', 'PAID', 'PARTIALLY_PAID', 'CANCELLED');

-- CreateEnum
CREATE TYPE "PaymentMethod" AS ENUM ('CASH', 'BANK_TRANSFER', 'CHECK', 'CREDIT_CARD', 'UPI', 'OTHER', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "InvoiceSourceType" AS ENUM ('MANUAL', 'POS');

-- CreateEnum
CREATE TYPE "POSSessionStatus" AS ENUM ('OPEN', 'CLOSED');

-- CreateEnum
CREATE TYPE "StockSourceType" AS ENUM ('PURCHASE', 'OPENING_STOCK', 'ADJUSTMENT', 'CREDIT_NOTE', 'STOCK_TRANSFER');

-- CreateEnum
CREATE TYPE "CustomerTransactionType" AS ENUM ('OPENING_BALANCE', 'INVOICE', 'PAYMENT', 'CREDIT_NOTE', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "SupplierTransactionType" AS ENUM ('OPENING_BALANCE', 'PURCHASE_INVOICE', 'PAYMENT', 'DEBIT_NOTE', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "AccountType" AS ENUM ('ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'EXPENSE');

-- CreateEnum
CREATE TYPE "AccountSubType" AS ENUM ('CURRENT_ASSET', 'FIXED_ASSET', 'BANK', 'CASH', 'ACCOUNTS_RECEIVABLE', 'INVENTORY', 'OTHER_ASSET', 'CURRENT_LIABILITY', 'LONG_TERM_LIABILITY', 'ACCOUNTS_PAYABLE', 'OTHER_LIABILITY', 'OWNERS_EQUITY', 'RETAINED_EARNINGS', 'OTHER_EQUITY', 'SALES_REVENUE', 'OTHER_REVENUE', 'COST_OF_GOODS_SOLD', 'OPERATING_EXPENSE', 'PAYROLL_EXPENSE', 'OTHER_EXPENSE');

-- CreateEnum
CREATE TYPE "JournalEntryStatus" AS ENUM ('DRAFT', 'POSTED', 'VOID');

-- CreateEnum
CREATE TYPE "JournalSourceType" AS ENUM ('MANUAL', 'INVOICE', 'PURCHASE_INVOICE', 'PAYMENT', 'SUPPLIER_PAYMENT', 'EXPENSE', 'CREDIT_NOTE', 'DEBIT_NOTE', 'TRANSFER', 'OPENING_BALANCE', 'POS_SESSION_CLOSE', 'POS_SESSION_OPEN');

-- CreateEnum
CREATE TYPE "ExpenseStatus" AS ENUM ('DRAFT', 'APPROVED', 'PAID', 'VOID');

-- CreateEnum
CREATE TYPE "CashBankTransactionType" AS ENUM ('DEPOSIT', 'WITHDRAWAL', 'TRANSFER_IN', 'TRANSFER_OUT', 'OPENING_BALANCE', 'ADJUSTMENT');

-- CreateEnum
CREATE TYPE "StockTransferStatus" AS ENUM ('DRAFT', 'APPROVED', 'IN_TRANSIT', 'COMPLETED', 'CANCELLED', 'REVERSED');

-- CreateEnum
CREATE TYPE "DeviceStatus" AS ENUM ('IN_STOCK', 'RESERVED', 'SOLD', 'IN_REPAIR', 'RMA');

-- CreateEnum
CREATE TYPE "ConditionGrade" AS ENUM ('NEW', 'OPEN_BOX', 'GRADE_A', 'GRADE_B', 'GRADE_C', 'REFURBISHED');

-- CreateEnum
CREATE TYPE "NetworkStatus" AS ENUM ('UNLOCKED', 'LOCKED');

-- CreateEnum
CREATE TYPE "MetalType" AS ENUM ('GOLD', 'SILVER', 'PLATINUM');

-- CreateEnum
CREATE TYPE "GoldPurity" AS ENUM ('K24', 'K22', 'K21', 'K18', 'K14', 'K9');

-- CreateEnum
CREATE TYPE "MakingChargeType" AS ENUM ('PER_GRAM', 'PERCENTAGE', 'FIXED');

-- CreateEnum
CREATE TYPE "JewelleryItemStatus" AS ENUM ('IN_STOCK', 'SOLD', 'IN_REPAIR', 'ON_APPROVAL', 'MELTED', 'IN_DISPLAY', 'CONSIGNMENT');

-- CreateEnum
CREATE TYPE "StoneType" AS ENUM ('DIAMOND', 'RUBY', 'EMERALD', 'SAPPHIRE', 'PEARL', 'ZIRCON', 'OTHER');

-- CreateEnum
CREATE TYPE "KarigarTransactionType" AS ENUM ('ISSUE', 'RETURN', 'WASTAGE', 'SCRAP');

-- CreateEnum
CREATE TYPE "PurityTestMethod" AS ENUM ('XRF', 'FIRE_ASSAY', 'TOUCHSTONE', 'OTHER');

-- CreateEnum
CREATE TYPE "RepairStatus" AS ENUM ('RECEIVED', 'IN_PROGRESS', 'READY', 'DELIVERED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "SchemeStatus" AS ENUM ('ACTIVE', 'COMPLETED', 'WITHDRAWN', 'DEFAULTED');

-- CreateEnum
CREATE TYPE "RestaurantTableStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING');

-- CreateEnum
CREATE TYPE "KOTStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "KOTType" AS ENUM ('STANDARD', 'FOLLOWUP', 'VOID');

-- CreateEnum
CREATE TYPE "RestaurantOrderType" AS ENUM ('DINE_IN', 'TAKEAWAY');

-- CreateTable
CREATE TABLE "organizations" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "gstEnabled" BOOLEAN NOT NULL DEFAULT false,
    "eInvoicingEnabled" BOOLEAN NOT NULL DEFAULT false,
    "multiUnitEnabled" BOOLEAN NOT NULL DEFAULT false,
    "multiBranchEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isMobileShopModuleEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isWeighMachineEnabled" BOOLEAN NOT NULL DEFAULT false,
    "isJewelleryModuleEnabled" BOOLEAN NOT NULL DEFAULT false,
    "jewelleryHuidMandatory" BOOLEAN NOT NULL DEFAULT true,
    "jewellerySasoMandatory" BOOLEAN NOT NULL DEFAULT true,
    "jewelleryConsignmentEnabled" BOOLEAN NOT NULL DEFAULT false,
    "jewellerySchemesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "jewelleryOldGoldEnabled" BOOLEAN NOT NULL DEFAULT true,
    "jewelleryRepairsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "jewelleryKarigarsEnabled" BOOLEAN NOT NULL DEFAULT true,
    "jewelleryGoldTaxRate" DECIMAL(5,2) NOT NULL DEFAULT 3.00,
    "jewelleryMakingChargeTaxRate" DECIMAL(5,2) NOT NULL DEFAULT 5.00,
    "jewelleryStoneTaxRate" DECIMAL(5,2) NOT NULL DEFAULT 3.00,
    "jewelleryInvestmentGoldTaxRate" DECIMAL(5,2) NOT NULL DEFAULT 3.00,
    "jewelleryPanRequired" BOOLEAN NOT NULL DEFAULT true,
    "jewelleryPanThreshold" DECIMAL(15,2) NOT NULL DEFAULT 200000,
    "jewelleryCashLimitEnabled" BOOLEAN NOT NULL DEFAULT true,
    "jewelleryCashLimitAmount" DECIMAL(15,2) NOT NULL DEFAULT 200000,
    "jewelleryTcsEnabled" BOOLEAN NOT NULL DEFAULT false,
    "jewelleryTcsRate" DECIMAL(5,2) NOT NULL DEFAULT 1.00,
    "jewelleryTcsThreshold" DECIMAL(15,2) NOT NULL DEFAULT 500000,
    "jewelleryDefaultWastagePercent" DECIMAL(5,2) NOT NULL DEFAULT 5.00,
    "jewelleryKarigarWastageTolerance" DECIMAL(5,2) NOT NULL DEFAULT 3.00,
    "jewelleryWeightTolerance" DECIMAL(5,3) NOT NULL DEFAULT 0.050,
    "jewelleryBuyRateSpread" DECIMAL(5,2) NOT NULL DEFAULT 5.00,
    "jewelleryAutoDerivePurities" BOOLEAN NOT NULL DEFAULT true,
    "jewelleryAgingAlertDays" INTEGER NOT NULL DEFAULT 180,
    "jewelleryReconciliationTolerance" DECIMAL(5,2) NOT NULL DEFAULT 1.00,
    "jewelleryDefaultMakingChargeType" "MakingChargeType" NOT NULL DEFAULT 'PER_GRAM',
    "jewellerySchemeMaxDuration" INTEGER NOT NULL DEFAULT 11,
    "jewellerySchemeBonusMonths" INTEGER NOT NULL DEFAULT 1,
    "jewellerySchemeEnforce365Days" BOOLEAN NOT NULL DEFAULT true,
    "jewellerySchemeRedemptionDiscount" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "jewelleryThemeEnabled" BOOLEAN NOT NULL DEFAULT true,
    "jewelleryThemeColor" TEXT DEFAULT '#b8860b',
    "jewelleryThemePreset" TEXT DEFAULT 'gold',
    "jewelleryEnabledPurities" TEXT[] DEFAULT ARRAY['K24', 'K22', 'K21', 'K18', 'K14', 'K9']::TEXT[],
    "jewelleryEnabledMetals" TEXT[] DEFAULT ARRAY['GOLD', 'SILVER', 'PLATINUM']::TEXT[],
    "isRestaurantModuleEnabled" BOOLEAN NOT NULL DEFAULT false,
    "restaurantTablesEnabled" BOOLEAN NOT NULL DEFAULT true,
    "restaurantKotPrintingEnabled" BOOLEAN NOT NULL DEFAULT true,
    "restaurantThemeEnabled" BOOLEAN NOT NULL DEFAULT true,
    "restaurantThemeColor" TEXT DEFAULT '#c0392b',
    "restaurantThemePreset" TEXT DEFAULT 'bistro',
    "weighMachineBarcodePrefix" TEXT DEFAULT '77',
    "weighMachineProductCodeLen" INTEGER DEFAULT 5,
    "weighMachineWeightDigits" INTEGER DEFAULT 5,
    "weighMachineDecimalPlaces" INTEGER DEFAULT 3,
    "edition" TEXT NOT NULL DEFAULT 'INDIA',
    "gstin" TEXT,
    "gstStateCode" TEXT,
    "saudiEInvoiceEnabled" BOOLEAN NOT NULL DEFAULT false,
    "vatNumber" TEXT,
    "commercialRegNumber" TEXT,
    "arabicName" TEXT,
    "arabicAddress" TEXT,
    "arabicCity" TEXT,
    "pdfHeaderImageUrl" TEXT,
    "pdfFooterImageUrl" TEXT,
    "brandColor" TEXT,
    "invoiceLogoHeight" INTEGER DEFAULT 60,
    "posReceiptLogoUrl" TEXT,
    "posReceiptLogoHeight" INTEGER DEFAULT 80,
    "posAccountingMode" TEXT NOT NULL DEFAULT 'DIRECT',
    "posDefaultCashAccountId" TEXT,
    "posDefaultBankAccountId" TEXT,
    "isTaxInclusivePrice" BOOLEAN NOT NULL DEFAULT false,
    "language" TEXT NOT NULL DEFAULT 'en',
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "subscriptionStatus" "SubscriptionStatus" NOT NULL DEFAULT 'TRIAL',
    "subscriptionStartDate" TIMESTAMP(3),
    "subscriptionEndDate" TIMESTAMP(3),
    "subscriptionNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "organizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "subscription_logs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "previousStatus" "SubscriptionStatus",
    "newStatus" "SubscriptionStatus" NOT NULL,
    "previousEndDate" TIMESTAMP(3),
    "newEndDate" TIMESTAMP(3),
    "changedBy" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "subscription_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "password" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'user',
    "language" TEXT,
    "organizationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "employees" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "pinCode" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "employees_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "units" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "products" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "arabicName" TEXT,
    "description" TEXT,
    "price" DECIMAL(10,2) NOT NULL,
    "cost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "unitCode" TEXT,
    "unitId" TEXT,
    "sku" TEXT,
    "barcode" TEXT,
    "hsnCode" TEXT,
    "gstRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "isService" BOOLEAN NOT NULL DEFAULT false,
    "isImeiTracked" BOOLEAN NOT NULL DEFAULT false,
    "weighMachineCode" TEXT,
    "isBundle" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "organizationId" TEXT NOT NULL,
    "categoryId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "products_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_bundle_items" (
    "id" TEXT NOT NULL,
    "bundleProductId" TEXT NOT NULL,
    "componentProductId" TEXT NOT NULL,
    "quantity" DECIMAL(10,4) NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_bundle_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "unit_conversions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fromUnitId" TEXT NOT NULL,
    "toUnitId" TEXT NOT NULL,
    "conversionFactor" DECIMAL(10,4) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "unit_conversions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "country" TEXT DEFAULT 'India',
    "gstin" TEXT,
    "gstStateCode" TEXT,
    "arabicName" TEXT,
    "vatNumber" TEXT,
    "ccNo" TEXT,
    "buildingNo" TEXT,
    "addNo" TEXT,
    "district" TEXT,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_assignments" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "assignedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "suppliers" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "zipCode" TEXT,
    "country" TEXT DEFAULT 'India',
    "gstin" TEXT,
    "gstStateCode" TEXT,
    "arabicName" TEXT,
    "vatNumber" TEXT,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "suppliers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoices" (
    "id" TEXT NOT NULL,
    "invoiceNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "createdById" TEXT,
    "organizationId" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "amountPaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "balanceDue" DECIMAL(12,2) NOT NULL,
    "roundOffAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "applyRoundOff" BOOLEAN NOT NULL DEFAULT false,
    "totalCgst" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalSgst" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalIgst" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "placeOfSupply" TEXT,
    "isInterState" BOOLEAN NOT NULL DEFAULT false,
    "eInvoiceIrn" TEXT,
    "eInvoiceAckNo" TEXT,
    "eInvoiceAckDate" TIMESTAMP(3),
    "eInvoiceSignedQr" TEXT,
    "eInvoiceStatus" TEXT,
    "saudiInvoiceType" TEXT,
    "totalVat" DECIMAL(12,2),
    "qrCodeData" TEXT,
    "invoiceUuid" TEXT,
    "invoiceCounterValue" INTEGER,
    "previousInvoiceHash" TEXT,
    "invoiceHash" TEXT,
    "sentAt" TIMESTAMP(3),
    "notes" TEXT,
    "terms" TEXT,
    "sourceType" "InvoiceSourceType" NOT NULL DEFAULT 'MANUAL',
    "posSessionId" TEXT,
    "branchId" TEXT,
    "warehouseId" TEXT,
    "paymentType" TEXT NOT NULL DEFAULT 'CASH',
    "isTaxInclusive" BOOLEAN,
    "idempotencyKey" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "isJewellerySale" BOOLEAN NOT NULL DEFAULT false,
    "oldGoldDeduction" DECIMAL(15,2) NOT NULL DEFAULT 0,

    CONSTRAINT "invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "invoice_items" (
    "id" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT,
    "unitId" TEXT,
    "conversionFactor" DECIMAL(10,4) NOT NULL DEFAULT 1,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "hsnCode" TEXT,
    "gstRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "cgstRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "sgstRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "igstRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "cgstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sgstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "igstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "vatRate" DECIMAL(5,2),
    "vatAmount" DECIMAL(12,2),
    "vatCategory" TEXT,
    "costOfGoodsSold" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "jewelleryItemId" TEXT,
    "goldRate" DECIMAL(12,2),
    "purity" TEXT,
    "metalType" TEXT,
    "grossWeight" DECIMAL(10,3),
    "netWeight" DECIMAL(10,3),
    "fineWeight" DECIMAL(10,3),
    "wastagePercent" DECIMAL(5,2),
    "makingChargeType" TEXT,
    "makingChargeValue" DECIMAL(12,2),
    "stoneValue" DECIMAL(15,2),
    "tagNumber" TEXT,
    "huidNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotations" (
    "id" TEXT NOT NULL,
    "quotationNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "validUntil" TIMESTAMP(3) NOT NULL,
    "status" "QuotationStatus" NOT NULL DEFAULT 'SENT',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "totalCgst" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalSgst" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalIgst" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "placeOfSupply" TEXT,
    "isInterState" BOOLEAN NOT NULL DEFAULT false,
    "totalVat" DECIMAL(12,2),
    "notes" TEXT,
    "terms" TEXT,
    "isTaxInclusive" BOOLEAN,
    "convertedInvoiceId" TEXT,
    "convertedAt" TIMESTAMP(3),
    "branchId" TEXT,
    "warehouseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "quotation_items" (
    "id" TEXT NOT NULL,
    "quotationId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT,
    "unitId" TEXT,
    "conversionFactor" DECIMAL(10,4) NOT NULL DEFAULT 1,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "hsnCode" TEXT,
    "gstRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "cgstRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "sgstRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "igstRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "cgstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sgstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "igstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "jewelleryItemId" TEXT,
    "goldRate" DECIMAL(12,2),
    "purity" TEXT,
    "metalType" TEXT,
    "grossWeight" DECIMAL(10,3),
    "netWeight" DECIMAL(10,3),
    "fineWeight" DECIMAL(10,3),
    "wastagePercent" DECIMAL(5,2),
    "makingChargeType" TEXT,
    "makingChargeValue" DECIMAL(12,2),
    "stoneValue" DECIMAL(15,2),
    "tagNumber" TEXT,
    "huidNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "quotation_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_invoices" (
    "id" TEXT NOT NULL,
    "purchaseInvoiceNumber" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invoiceDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "supplierInvoiceRef" TEXT,
    "status" "PurchaseInvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "subtotal" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "amountPaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "balanceDue" DECIMAL(12,2) NOT NULL,
    "roundOffAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "applyRoundOff" BOOLEAN NOT NULL DEFAULT false,
    "totalCgst" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalSgst" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalIgst" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "placeOfSupply" TEXT,
    "isInterState" BOOLEAN NOT NULL DEFAULT false,
    "totalVat" DECIMAL(12,2),
    "invoiceUuid" TEXT,
    "invoiceCounterValue" INTEGER,
    "previousInvoiceHash" TEXT,
    "invoiceHash" TEXT,
    "notes" TEXT,
    "isTaxInclusive" BOOLEAN,
    "branchId" TEXT,
    "warehouseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_invoices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "purchase_invoice_items" (
    "id" TEXT NOT NULL,
    "purchaseInvoiceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "unitId" TEXT,
    "conversionFactor" DECIMAL(10,4) NOT NULL DEFAULT 1,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unitCost" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "hsnCode" TEXT,
    "gstRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "cgstRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "sgstRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "igstRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "cgstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sgstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "igstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "vatRate" DECIMAL(5,2),
    "vatAmount" DECIMAL(12,2),
    "vatCategory" TEXT,
    "jewelleryItemId" TEXT,
    "goldRate" DECIMAL(12,2),
    "purity" TEXT,
    "metalType" TEXT,
    "grossWeight" DECIMAL(10,3),
    "netWeight" DECIMAL(10,3),
    "fineWeight" DECIMAL(10,3),
    "wastagePercent" DECIMAL(5,2),
    "makingChargeType" TEXT,
    "makingChargeValue" DECIMAL(12,2),
    "stoneValue" DECIMAL(15,2),
    "tagNumber" TEXT,
    "huidNumber" TEXT,
    "karigarId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "purchase_invoice_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_notes" (
    "id" TEXT NOT NULL,
    "creditNoteNumber" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "customerId" TEXT NOT NULL,
    "createdById" TEXT,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "roundOffAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "applyRoundOff" BOOLEAN NOT NULL DEFAULT false,
    "totalCgst" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalSgst" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalIgst" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "placeOfSupply" TEXT,
    "isInterState" BOOLEAN NOT NULL DEFAULT false,
    "totalVat" DECIMAL(12,2),
    "qrCodeData" TEXT,
    "invoiceUuid" TEXT,
    "invoiceCounterValue" INTEGER,
    "previousInvoiceHash" TEXT,
    "invoiceHash" TEXT,
    "appliedToBalance" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT,
    "notes" TEXT,
    "branchId" TEXT,
    "warehouseId" TEXT,
    "posSessionId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credit_note_items" (
    "id" TEXT NOT NULL,
    "creditNoteId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invoiceItemId" TEXT,
    "productId" TEXT,
    "unitId" TEXT,
    "conversionFactor" DECIMAL(10,4) NOT NULL DEFAULT 1,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unitPrice" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "hsnCode" TEXT,
    "gstRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "cgstRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "sgstRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "igstRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "cgstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sgstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "igstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "vatRate" DECIMAL(5,2),
    "vatAmount" DECIMAL(12,2),
    "vatCategory" TEXT,
    "originalCOGS" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "stockLotId" TEXT,
    "jewelleryItemId" TEXT,
    "goldRate" DECIMAL(12,2),
    "purity" TEXT,
    "metalType" TEXT,
    "grossWeight" DECIMAL(10,3),
    "netWeight" DECIMAL(10,3),
    "fineWeight" DECIMAL(10,3),
    "wastagePercent" DECIMAL(5,2),
    "makingChargeType" TEXT,
    "makingChargeValue" DECIMAL(12,2),
    "stoneValue" DECIMAL(15,2),
    "tagNumber" TEXT,
    "huidNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "credit_note_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debit_notes" (
    "id" TEXT NOT NULL,
    "debitNoteNumber" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "purchaseInvoiceId" TEXT,
    "supplierId" TEXT NOT NULL,
    "issueDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "roundOffAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "applyRoundOff" BOOLEAN NOT NULL DEFAULT false,
    "totalCgst" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalSgst" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalIgst" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "placeOfSupply" TEXT,
    "isInterState" BOOLEAN NOT NULL DEFAULT false,
    "totalVat" DECIMAL(12,2),
    "invoiceUuid" TEXT,
    "invoiceCounterValue" INTEGER,
    "previousInvoiceHash" TEXT,
    "invoiceHash" TEXT,
    "appliedToBalance" BOOLEAN NOT NULL DEFAULT true,
    "reason" TEXT,
    "notes" TEXT,
    "branchId" TEXT,
    "warehouseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "debit_notes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debit_note_items" (
    "id" TEXT NOT NULL,
    "debitNoteId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "purchaseInvoiceItemId" TEXT,
    "productId" TEXT NOT NULL,
    "unitId" TEXT,
    "conversionFactor" DECIMAL(10,4) NOT NULL DEFAULT 1,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unitCost" DECIMAL(10,2) NOT NULL,
    "discount" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "total" DECIMAL(12,2) NOT NULL,
    "hsnCode" TEXT,
    "gstRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "cgstRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "sgstRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "igstRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "cgstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sgstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "igstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "vatRate" DECIMAL(5,2),
    "vatAmount" DECIMAL(12,2),
    "vatCategory" TEXT,
    "jewelleryItemId" TEXT,
    "goldRate" DECIMAL(12,2),
    "purity" TEXT,
    "metalType" TEXT,
    "grossWeight" DECIMAL(10,3),
    "netWeight" DECIMAL(10,3),
    "fineWeight" DECIMAL(10,3),
    "wastagePercent" DECIMAL(5,2),
    "makingChargeType" TEXT,
    "makingChargeValue" DECIMAL(12,2),
    "stoneValue" DECIMAL(15,2),
    "tagNumber" TEXT,
    "huidNumber" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "debit_note_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "debit_note_lot_consumptions" (
    "id" TEXT NOT NULL,
    "debitNoteItemId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "stockLotId" TEXT NOT NULL,
    "quantityReturned" DECIMAL(10,2) NOT NULL,
    "unitCost" DECIMAL(10,2) NOT NULL,
    "totalCost" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "debit_note_lot_consumptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payments" (
    "id" TEXT NOT NULL,
    "paymentNumber" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "invoiceId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "discountReceived" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "reference" TEXT,
    "notes" TEXT,
    "adjustmentAccountId" TEXT,
    "branchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "payment_allocations" (
    "id" TEXT NOT NULL,
    "paymentId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_payments" (
    "id" TEXT NOT NULL,
    "paymentNumber" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "purchaseInvoiceId" TEXT,
    "amount" DECIMAL(12,2) NOT NULL,
    "discountGiven" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "reference" TEXT,
    "notes" TEXT,
    "adjustmentAccountId" TEXT,
    "branchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "supplier_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_payment_allocations" (
    "id" TEXT NOT NULL,
    "supplierPaymentId" TEXT NOT NULL,
    "purchaseInvoiceId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_payment_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_lots" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceType" "StockSourceType" NOT NULL,
    "purchaseInvoiceItemId" TEXT,
    "purchaseInvoiceId" TEXT,
    "openingStockId" TEXT,
    "creditNoteItemId" TEXT,
    "stockTransferId" TEXT,
    "warehouseId" TEXT,
    "lotDate" TIMESTAMP(3) NOT NULL,
    "unitCost" DECIMAL(10,2) NOT NULL,
    "initialQuantity" DECIMAL(10,2) NOT NULL,
    "remainingQuantity" DECIMAL(10,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_lots_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_lot_consumptions" (
    "id" TEXT NOT NULL,
    "stockLotId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invoiceItemId" TEXT,
    "stockTransferItemId" TEXT,
    "quantityConsumed" DECIMAL(10,2) NOT NULL,
    "unitCost" DECIMAL(10,2) NOT NULL,
    "totalCost" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_lot_consumptions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "opening_stocks" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unitCost" DECIMAL(10,2) NOT NULL,
    "stockDate" TIMESTAMP(3) NOT NULL,
    "notes" TEXT,
    "warehouseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "opening_stocks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cost_audit_logs" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "invoiceItemId" TEXT NOT NULL,
    "oldCOGS" DECIMAL(12,2) NOT NULL,
    "newCOGS" DECIMAL(12,2) NOT NULL,
    "changeAmount" DECIMAL(12,2) NOT NULL,
    "changeReason" TEXT NOT NULL,
    "triggeredBy" TEXT,
    "changedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cost_audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_transactions" (
    "id" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "transactionType" "CustomerTransactionType" NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT NOT NULL,
    "invoiceId" TEXT,
    "paymentId" TEXT,
    "creditNoteId" TEXT,
    "runningBalance" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "supplier_transactions" (
    "id" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "transactionType" "SupplierTransactionType" NOT NULL,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "description" TEXT NOT NULL,
    "purchaseInvoiceId" TEXT,
    "supplierPaymentId" TEXT,
    "debitNoteId" TEXT,
    "runningBalance" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "supplier_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "product_categories" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "color" TEXT DEFAULT '#6366f1',
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "product_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_sessions" (
    "id" TEXT NOT NULL,
    "sessionNumber" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employeeId" TEXT,
    "status" "POSSessionStatus" NOT NULL DEFAULT 'OPEN',
    "openedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" TIMESTAMP(3),
    "openingCash" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "closingCash" DECIMAL(12,2),
    "expectedCash" DECIMAL(12,2),
    "cashDifference" DECIMAL(12,2),
    "totalSales" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalTransactions" INTEGER NOT NULL DEFAULT 0,
    "totalReturns" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalReturnTransactions" INTEGER NOT NULL DEFAULT 0,
    "notes" TEXT,
    "branchId" TEXT,
    "warehouseId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_held_orders" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "customerId" TEXT,
    "customerName" TEXT,
    "items" JSONB NOT NULL,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "notes" TEXT,
    "heldAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pos_held_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "settings" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "settings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "accounts" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountType" "AccountType" NOT NULL,
    "accountSubType" "AccountSubType" NOT NULL,
    "description" TEXT,
    "parentId" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_bank_accounts" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "accountSubType" "AccountSubType" NOT NULL,
    "bankName" TEXT,
    "accountNumber" TEXT,
    "balance" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "branchId" TEXT,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cash_bank_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cash_bank_transactions" (
    "id" TEXT NOT NULL,
    "cashBankAccountId" TEXT NOT NULL,
    "transactionType" "CashBankTransactionType" NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "runningBalance" DECIMAL(12,2) NOT NULL,
    "description" TEXT NOT NULL,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "transactionDate" TIMESTAMP(3) NOT NULL,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cash_bank_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expenses" (
    "id" TEXT NOT NULL,
    "expenseNumber" TEXT NOT NULL,
    "status" "ExpenseStatus" NOT NULL DEFAULT 'DRAFT',
    "supplierId" TEXT,
    "cashBankAccountId" TEXT,
    "expenseDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "description" TEXT,
    "subtotal" DECIMAL(12,2) NOT NULL,
    "total" DECIMAL(12,2) NOT NULL,
    "totalCgst" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalSgst" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "totalIgst" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "placeOfSupply" TEXT,
    "isInterState" BOOLEAN NOT NULL DEFAULT false,
    "totalVat" DECIMAL(12,2),
    "notes" TEXT,
    "journalEntryId" TEXT,
    "branchId" TEXT,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expenses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "expense_items" (
    "id" TEXT NOT NULL,
    "expenseId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "gstRate" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "cgstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "sgstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "igstAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "expense_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entries" (
    "id" TEXT NOT NULL,
    "journalNumber" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "description" TEXT NOT NULL,
    "status" "JournalEntryStatus" NOT NULL DEFAULT 'DRAFT',
    "sourceType" "JournalSourceType" NOT NULL DEFAULT 'MANUAL',
    "sourceId" TEXT,
    "branchId" TEXT,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "journal_entries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "journal_entry_lines" (
    "id" TEXT NOT NULL,
    "journalEntryId" TEXT NOT NULL,
    "accountId" TEXT NOT NULL,
    "description" TEXT,
    "debit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "journal_entry_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "branches" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "address" TEXT,
    "city" TEXT,
    "state" TEXT,
    "phone" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "branches_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "warehouses" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "address" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "pos_register_configs" (
    "id" TEXT NOT NULL,
    "locationKey" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "branchId" TEXT,
    "warehouseId" TEXT,
    "defaultCashAccountId" TEXT,
    "defaultBankAccountId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pos_register_configs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transfers" (
    "id" TEXT NOT NULL,
    "transferNumber" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sourceBranchId" TEXT NOT NULL,
    "sourceWarehouseId" TEXT NOT NULL,
    "destinationBranchId" TEXT NOT NULL,
    "destinationWarehouseId" TEXT NOT NULL,
    "status" "StockTransferStatus" NOT NULL DEFAULT 'DRAFT',
    "transferDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "approvedAt" TIMESTAMP(3),
    "shippedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "reversedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stock_transfer_items" (
    "id" TEXT NOT NULL,
    "stockTransferId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "warehouseId" TEXT,
    "quantity" DECIMAL(10,2) NOT NULL,
    "unitCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stock_transfer_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_warehouse_access" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "warehouseId" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "organizationId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_warehouse_access_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "mobile_devices" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "imei1" TEXT NOT NULL,
    "imei2" TEXT,
    "serialNumber" TEXT,
    "brand" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "color" TEXT,
    "storageCapacity" TEXT,
    "ram" TEXT,
    "networkStatus" "NetworkStatus" NOT NULL DEFAULT 'UNLOCKED',
    "currentStatus" "DeviceStatus" NOT NULL DEFAULT 'IN_STOCK',
    "conditionGrade" "ConditionGrade" NOT NULL DEFAULT 'NEW',
    "batteryHealthPercentage" INTEGER,
    "includedAccessories" JSONB,
    "productId" TEXT,
    "supplierId" TEXT NOT NULL,
    "purchaseInvoiceId" TEXT,
    "openingStockId" TEXT,
    "inwardDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "costPrice" DECIMAL(10,2) NOT NULL,
    "mrp" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "landedCost" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "sellingPrice" DECIMAL(10,2) NOT NULL DEFAULT 0,
    "customerId" TEXT,
    "salesInvoiceId" TEXT,
    "outwardDate" TIMESTAMP(3),
    "soldPrice" DECIMAL(10,2),
    "salespersonId" TEXT,
    "supplierWarrantyExpiry" TIMESTAMP(3),
    "customerWarrantyExpiry" TIMESTAMP(3),
    "notes" TEXT,
    "photoUrls" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "mobile_devices_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "gold_rates" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "metalType" "MetalType" NOT NULL DEFAULT 'GOLD',
    "purity" "GoldPurity" NOT NULL,
    "buyRate" DECIMAL(12,2) NOT NULL,
    "sellRate" DECIMAL(12,2) NOT NULL,
    "rateLocked" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "gold_rates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jewellery_categories" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "arabicName" TEXT,
    "slug" TEXT NOT NULL,
    "metalType" "MetalType" NOT NULL DEFAULT 'GOLD',
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jewellery_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jewellery_items" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "tagNumber" TEXT NOT NULL,
    "rfidTag" TEXT,
    "categoryId" TEXT,
    "metalType" "MetalType" NOT NULL DEFAULT 'GOLD',
    "purity" "GoldPurity" NOT NULL DEFAULT 'K22',
    "grossWeight" DECIMAL(10,3) NOT NULL,
    "stoneWeight" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "netWeight" DECIMAL(10,3) NOT NULL,
    "fineWeight" DECIMAL(10,3) NOT NULL,
    "makingChargeType" "MakingChargeType" NOT NULL DEFAULT 'PER_GRAM',
    "makingChargeValue" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "wastagePercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "wastageWeight" DECIMAL(10,3) NOT NULL DEFAULT 0,
    "huidNumber" TEXT,
    "hallmarkNumber" TEXT,
    "sasoMark" TEXT,
    "sasoAssayerCode" TEXT,
    "sasoYear" TEXT,
    "status" "JewelleryItemStatus" NOT NULL DEFAULT 'IN_STOCK',
    "isConsignment" BOOLEAN NOT NULL DEFAULT false,
    "consignmentSupplierId" TEXT,
    "consignmentReturnDeadline" TIMESTAMP(3),
    "costPrice" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "goldRateAtPurchase" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "stoneValue" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "productId" TEXT,
    "supplierId" TEXT,
    "karigarId" TEXT,
    "branchId" TEXT,
    "warehouseId" TEXT,
    "photoUrls" TEXT[],
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jewellery_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "stone_details" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "jewelleryItemId" TEXT NOT NULL,
    "stoneType" "StoneType" NOT NULL DEFAULT 'DIAMOND',
    "carat" DECIMAL(8,3) NOT NULL DEFAULT 0,
    "cut" TEXT,
    "color" TEXT,
    "clarity" TEXT,
    "weight" DECIMAL(8,3) NOT NULL DEFAULT 0,
    "value" DECIMAL(15,2) NOT NULL DEFAULT 0,
    "certificationNumber" TEXT,
    "certBody" TEXT,
    "serialNumber" TEXT,
    "isLot" BOOLEAN NOT NULL DEFAULT false,
    "lotCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stone_details_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "karigars" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "specialization" TEXT,
    "address" TEXT,
    "goldIssuedWeight" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "goldReturnedWeight" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "scrapReturnedWeight" DECIMAL(12,3) NOT NULL DEFAULT 0,
    "wastageAllowancePercent" DECIMAL(5,2) NOT NULL DEFAULT 3.00,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "karigars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "karigar_transactions" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "karigarId" TEXT NOT NULL,
    "type" "KarigarTransactionType" NOT NULL,
    "weight" DECIMAL(10,3) NOT NULL,
    "purity" "GoldPurity" NOT NULL DEFAULT 'K22',
    "fineWeight" DECIMAL(10,3) NOT NULL,
    "jewelleryItemId" TEXT,
    "date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "karigar_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "old_gold_purchases" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "customerId" TEXT,
    "customerName" TEXT,
    "weight" DECIMAL(10,3) NOT NULL,
    "testedPurity" "GoldPurity" NOT NULL DEFAULT 'K22',
    "purityPercentage" DECIMAL(5,2) NOT NULL,
    "testReadings" JSONB,
    "testMethod" "PurityTestMethod" NOT NULL DEFAULT 'XRF',
    "meltingLossPercent" DECIMAL(5,2) NOT NULL DEFAULT 0,
    "rate" DECIMAL(12,2) NOT NULL,
    "totalValue" DECIMAL(15,2) NOT NULL,
    "adjustedAgainstInvoiceId" TEXT,
    "panNumber" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "old_gold_purchases_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "jewellery_repairs" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "repairNumber" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "itemDescription" TEXT NOT NULL,
    "repairType" TEXT,
    "estimatedWeight" DECIMAL(10,3),
    "materialUsedWeight" DECIMAL(10,3),
    "materialPurity" "GoldPurity",
    "karigarId" TEXT,
    "status" "RepairStatus" NOT NULL DEFAULT 'RECEIVED',
    "estimatedCost" DECIMAL(15,2),
    "actualCost" DECIMAL(15,2),
    "receivedDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedDate" TIMESTAMP(3),
    "deliveredDate" TIMESTAMP(3),
    "photoUrls" TEXT[],
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "jewellery_repairs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_schemes" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "schemeName" TEXT NOT NULL,
    "customerId" TEXT NOT NULL,
    "monthlyAmount" DECIMAL(12,2) NOT NULL,
    "durationMonths" INTEGER NOT NULL,
    "bonusMonths" INTEGER NOT NULL DEFAULT 1,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "status" "SchemeStatus" NOT NULL DEFAULT 'ACTIVE',
    "totalPaid" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "customer_schemes_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "scheme_payments" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "schemeId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "paymentDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "paymentMethod" "PaymentMethod" NOT NULL DEFAULT 'CASH',
    "monthNumber" INTEGER NOT NULL,
    "reference" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "scheme_payments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "restaurant_tables" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "number" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "capacity" INTEGER NOT NULL DEFAULT 4,
    "floor" TEXT,
    "section" TEXT,
    "status" "RestaurantTableStatus" NOT NULL DEFAULT 'AVAILABLE',
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "guestCount" INTEGER,
    "currentOrderId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "restaurant_tables_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kot_orders" (
    "id" TEXT NOT NULL,
    "kotNumber" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "tableId" TEXT,
    "posSessionId" TEXT,
    "kotType" "KOTType" NOT NULL DEFAULT 'STANDARD',
    "orderType" "RestaurantOrderType" NOT NULL DEFAULT 'DINE_IN',
    "status" "KOTStatus" NOT NULL DEFAULT 'PENDING',
    "serverName" TEXT,
    "specialInstructions" TEXT,
    "guestCount" INTEGER,
    "createdById" TEXT,
    "printedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "cancelledAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "kot_orders_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "kot_order_items" (
    "id" TEXT NOT NULL,
    "kotOrderId" TEXT NOT NULL,
    "productId" TEXT,
    "name" TEXT NOT NULL,
    "nameAr" TEXT,
    "quantity" DECIMAL(10,2) NOT NULL,
    "modifiers" JSONB,
    "notes" TEXT,
    "isNew" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "kot_order_items_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "organizations_slug_key" ON "organizations"("slug");

-- CreateIndex
CREATE INDEX "subscription_logs_organizationId_idx" ON "subscription_logs"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_organizationId_idx" ON "users"("organizationId");

-- CreateIndex
CREATE INDEX "users_organizationId_name_idx" ON "users"("organizationId", "name");

-- CreateIndex
CREATE INDEX "employees_organizationId_idx" ON "employees"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "employees_organizationId_pinCode_key" ON "employees"("organizationId", "pinCode");

-- CreateIndex
CREATE INDEX "units_organizationId_idx" ON "units"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "units_organizationId_code_key" ON "units"("organizationId", "code");

-- CreateIndex
CREATE INDEX "products_organizationId_idx" ON "products"("organizationId");

-- CreateIndex
CREATE INDEX "products_organizationId_name_idx" ON "products"("organizationId", "name");

-- CreateIndex
CREATE INDEX "products_organizationId_categoryId_idx" ON "products"("organizationId", "categoryId");

-- CreateIndex
CREATE UNIQUE INDEX "products_organizationId_sku_key" ON "products"("organizationId", "sku");

-- CreateIndex
CREATE UNIQUE INDEX "products_organizationId_barcode_key" ON "products"("organizationId", "barcode");

-- CreateIndex
CREATE UNIQUE INDEX "products_organizationId_weighMachineCode_key" ON "products"("organizationId", "weighMachineCode");

-- CreateIndex
CREATE INDEX "product_bundle_items_organizationId_idx" ON "product_bundle_items"("organizationId");

-- CreateIndex
CREATE INDEX "product_bundle_items_bundleProductId_idx" ON "product_bundle_items"("bundleProductId");

-- CreateIndex
CREATE UNIQUE INDEX "product_bundle_items_bundleProductId_componentProductId_key" ON "product_bundle_items"("bundleProductId", "componentProductId");

-- CreateIndex
CREATE INDEX "unit_conversions_organizationId_idx" ON "unit_conversions"("organizationId");

-- CreateIndex
CREATE INDEX "unit_conversions_fromUnitId_idx" ON "unit_conversions"("fromUnitId");

-- CreateIndex
CREATE INDEX "unit_conversions_toUnitId_idx" ON "unit_conversions"("toUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "unit_conversions_organizationId_fromUnitId_toUnitId_key" ON "unit_conversions"("organizationId", "fromUnitId", "toUnitId");

-- CreateIndex
CREATE INDEX "customers_organizationId_idx" ON "customers"("organizationId");

-- CreateIndex
CREATE INDEX "customers_organizationId_name_idx" ON "customers"("organizationId", "name");

-- CreateIndex
CREATE INDEX "customer_assignments_organizationId_idx" ON "customer_assignments"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "customer_assignments_customerId_userId_key" ON "customer_assignments"("customerId", "userId");

-- CreateIndex
CREATE INDEX "suppliers_organizationId_idx" ON "suppliers"("organizationId");

-- CreateIndex
CREATE INDEX "suppliers_organizationId_name_idx" ON "suppliers"("organizationId", "name");

-- CreateIndex
CREATE INDEX "invoices_organizationId_idx" ON "invoices"("organizationId");

-- CreateIndex
CREATE INDEX "invoices_organizationId_createdAt_idx" ON "invoices"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "invoices_organizationId_issueDate_idx" ON "invoices"("organizationId", "issueDate" DESC);

-- CreateIndex
CREATE INDEX "invoices_organizationId_customerId_idx" ON "invoices"("organizationId", "customerId");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_organizationId_invoiceNumber_key" ON "invoices"("organizationId", "invoiceNumber");

-- CreateIndex
CREATE UNIQUE INDEX "invoices_organizationId_idempotencyKey_key" ON "invoices"("organizationId", "idempotencyKey");

-- CreateIndex
CREATE INDEX "invoice_items_organizationId_idx" ON "invoice_items"("organizationId");

-- CreateIndex
CREATE INDEX "invoice_items_invoiceId_idx" ON "invoice_items"("invoiceId");

-- CreateIndex
CREATE INDEX "invoice_items_productId_idx" ON "invoice_items"("productId");

-- CreateIndex
CREATE INDEX "invoice_items_jewelleryItemId_idx" ON "invoice_items"("jewelleryItemId");

-- CreateIndex
CREATE UNIQUE INDEX "quotations_convertedInvoiceId_key" ON "quotations"("convertedInvoiceId");

-- CreateIndex
CREATE INDEX "quotations_organizationId_idx" ON "quotations"("organizationId");

-- CreateIndex
CREATE INDEX "quotations_organizationId_createdAt_idx" ON "quotations"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "quotations_organizationId_status_idx" ON "quotations"("organizationId", "status");

-- CreateIndex
CREATE INDEX "quotations_customerId_idx" ON "quotations"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "quotations_organizationId_quotationNumber_key" ON "quotations"("organizationId", "quotationNumber");

-- CreateIndex
CREATE INDEX "quotation_items_organizationId_idx" ON "quotation_items"("organizationId");

-- CreateIndex
CREATE INDEX "quotation_items_quotationId_idx" ON "quotation_items"("quotationId");

-- CreateIndex
CREATE INDEX "quotation_items_productId_idx" ON "quotation_items"("productId");

-- CreateIndex
CREATE INDEX "quotation_items_jewelleryItemId_idx" ON "quotation_items"("jewelleryItemId");

-- CreateIndex
CREATE INDEX "purchase_invoices_organizationId_idx" ON "purchase_invoices"("organizationId");

-- CreateIndex
CREATE INDEX "purchase_invoices_organizationId_createdAt_idx" ON "purchase_invoices"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "purchase_invoices_organizationId_invoiceDate_idx" ON "purchase_invoices"("organizationId", "invoiceDate" DESC);

-- CreateIndex
CREATE INDEX "purchase_invoices_organizationId_supplierId_idx" ON "purchase_invoices"("organizationId", "supplierId");

-- CreateIndex
CREATE INDEX "purchase_invoices_organizationId_status_idx" ON "purchase_invoices"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "purchase_invoices_organizationId_purchaseInvoiceNumber_key" ON "purchase_invoices"("organizationId", "purchaseInvoiceNumber");

-- CreateIndex
CREATE INDEX "purchase_invoice_items_organizationId_idx" ON "purchase_invoice_items"("organizationId");

-- CreateIndex
CREATE INDEX "purchase_invoice_items_purchaseInvoiceId_idx" ON "purchase_invoice_items"("purchaseInvoiceId");

-- CreateIndex
CREATE INDEX "purchase_invoice_items_productId_idx" ON "purchase_invoice_items"("productId");

-- CreateIndex
CREATE INDEX "purchase_invoice_items_jewelleryItemId_idx" ON "purchase_invoice_items"("jewelleryItemId");

-- CreateIndex
CREATE INDEX "credit_notes_organizationId_idx" ON "credit_notes"("organizationId");

-- CreateIndex
CREATE INDEX "credit_notes_organizationId_customerId_idx" ON "credit_notes"("organizationId", "customerId");

-- CreateIndex
CREATE INDEX "credit_notes_invoiceId_idx" ON "credit_notes"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "credit_notes_organizationId_creditNoteNumber_key" ON "credit_notes"("organizationId", "creditNoteNumber");

-- CreateIndex
CREATE UNIQUE INDEX "credit_note_items_stockLotId_key" ON "credit_note_items"("stockLotId");

-- CreateIndex
CREATE INDEX "credit_note_items_organizationId_idx" ON "credit_note_items"("organizationId");

-- CreateIndex
CREATE INDEX "credit_note_items_creditNoteId_idx" ON "credit_note_items"("creditNoteId");

-- CreateIndex
CREATE INDEX "credit_note_items_productId_idx" ON "credit_note_items"("productId");

-- CreateIndex
CREATE INDEX "credit_note_items_jewelleryItemId_idx" ON "credit_note_items"("jewelleryItemId");

-- CreateIndex
CREATE INDEX "debit_notes_organizationId_idx" ON "debit_notes"("organizationId");

-- CreateIndex
CREATE INDEX "debit_notes_organizationId_supplierId_idx" ON "debit_notes"("organizationId", "supplierId");

-- CreateIndex
CREATE INDEX "debit_notes_purchaseInvoiceId_idx" ON "debit_notes"("purchaseInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "debit_notes_organizationId_debitNoteNumber_key" ON "debit_notes"("organizationId", "debitNoteNumber");

-- CreateIndex
CREATE INDEX "debit_note_items_organizationId_idx" ON "debit_note_items"("organizationId");

-- CreateIndex
CREATE INDEX "debit_note_items_debitNoteId_idx" ON "debit_note_items"("debitNoteId");

-- CreateIndex
CREATE INDEX "debit_note_items_productId_idx" ON "debit_note_items"("productId");

-- CreateIndex
CREATE INDEX "debit_note_items_jewelleryItemId_idx" ON "debit_note_items"("jewelleryItemId");

-- CreateIndex
CREATE INDEX "debit_note_lot_consumptions_debitNoteItemId_idx" ON "debit_note_lot_consumptions"("debitNoteItemId");

-- CreateIndex
CREATE INDEX "debit_note_lot_consumptions_stockLotId_idx" ON "debit_note_lot_consumptions"("stockLotId");

-- CreateIndex
CREATE INDEX "debit_note_lot_consumptions_organizationId_idx" ON "debit_note_lot_consumptions"("organizationId");

-- CreateIndex
CREATE INDEX "payments_organizationId_idx" ON "payments"("organizationId");

-- CreateIndex
CREATE INDEX "payments_organizationId_paymentDate_idx" ON "payments"("organizationId", "paymentDate" DESC);

-- CreateIndex
CREATE INDEX "payments_organizationId_createdAt_idx" ON "payments"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "payments_customerId_idx" ON "payments"("customerId");

-- CreateIndex
CREATE UNIQUE INDEX "payments_organizationId_paymentNumber_key" ON "payments"("organizationId", "paymentNumber");

-- CreateIndex
CREATE INDEX "payment_allocations_paymentId_idx" ON "payment_allocations"("paymentId");

-- CreateIndex
CREATE INDEX "payment_allocations_invoiceId_idx" ON "payment_allocations"("invoiceId");

-- CreateIndex
CREATE INDEX "payment_allocations_organizationId_idx" ON "payment_allocations"("organizationId");

-- CreateIndex
CREATE INDEX "supplier_payments_organizationId_idx" ON "supplier_payments"("organizationId");

-- CreateIndex
CREATE INDEX "supplier_payments_organizationId_paymentDate_idx" ON "supplier_payments"("organizationId", "paymentDate" DESC);

-- CreateIndex
CREATE INDEX "supplier_payments_organizationId_createdAt_idx" ON "supplier_payments"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "supplier_payments_supplierId_idx" ON "supplier_payments"("supplierId");

-- CreateIndex
CREATE UNIQUE INDEX "supplier_payments_organizationId_paymentNumber_key" ON "supplier_payments"("organizationId", "paymentNumber");

-- CreateIndex
CREATE INDEX "supplier_payment_allocations_supplierPaymentId_idx" ON "supplier_payment_allocations"("supplierPaymentId");

-- CreateIndex
CREATE INDEX "supplier_payment_allocations_purchaseInvoiceId_idx" ON "supplier_payment_allocations"("purchaseInvoiceId");

-- CreateIndex
CREATE INDEX "supplier_payment_allocations_organizationId_idx" ON "supplier_payment_allocations"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "stock_lots_purchaseInvoiceItemId_key" ON "stock_lots"("purchaseInvoiceItemId");

-- CreateIndex
CREATE UNIQUE INDEX "stock_lots_openingStockId_key" ON "stock_lots"("openingStockId");

-- CreateIndex
CREATE UNIQUE INDEX "stock_lots_creditNoteItemId_key" ON "stock_lots"("creditNoteItemId");

-- CreateIndex
CREATE INDEX "stock_lots_productId_lotDate_idx" ON "stock_lots"("productId", "lotDate");

-- CreateIndex
CREATE INDEX "stock_lots_productId_remainingQuantity_idx" ON "stock_lots"("productId", "remainingQuantity");

-- CreateIndex
CREATE INDEX "stock_lots_organizationId_idx" ON "stock_lots"("organizationId");

-- CreateIndex
CREATE INDEX "stock_lots_organizationId_lotDate_idx" ON "stock_lots"("organizationId", "lotDate" DESC);

-- CreateIndex
CREATE INDEX "stock_lots_organizationId_productId_idx" ON "stock_lots"("organizationId", "productId");

-- CreateIndex
CREATE INDEX "stock_lots_warehouseId_idx" ON "stock_lots"("warehouseId");

-- CreateIndex
CREATE INDEX "stock_lots_purchaseInvoiceId_idx" ON "stock_lots"("purchaseInvoiceId");

-- CreateIndex
CREATE INDEX "stock_lot_consumptions_stockLotId_idx" ON "stock_lot_consumptions"("stockLotId");

-- CreateIndex
CREATE INDEX "stock_lot_consumptions_invoiceItemId_idx" ON "stock_lot_consumptions"("invoiceItemId");

-- CreateIndex
CREATE INDEX "stock_lot_consumptions_stockTransferItemId_idx" ON "stock_lot_consumptions"("stockTransferItemId");

-- CreateIndex
CREATE INDEX "stock_lot_consumptions_organizationId_idx" ON "stock_lot_consumptions"("organizationId");

-- CreateIndex
CREATE INDEX "opening_stocks_organizationId_idx" ON "opening_stocks"("organizationId");

-- CreateIndex
CREATE INDEX "opening_stocks_productId_idx" ON "opening_stocks"("productId");

-- CreateIndex
CREATE INDEX "opening_stocks_warehouseId_idx" ON "opening_stocks"("warehouseId");

-- CreateIndex
CREATE INDEX "cost_audit_logs_productId_changedAt_idx" ON "cost_audit_logs"("productId", "changedAt");

-- CreateIndex
CREATE INDEX "cost_audit_logs_invoiceItemId_idx" ON "cost_audit_logs"("invoiceItemId");

-- CreateIndex
CREATE INDEX "cost_audit_logs_organizationId_idx" ON "cost_audit_logs"("organizationId");

-- CreateIndex
CREATE INDEX "customer_transactions_customerId_transactionDate_idx" ON "customer_transactions"("customerId", "transactionDate");

-- CreateIndex
CREATE INDEX "customer_transactions_organizationId_idx" ON "customer_transactions"("organizationId");

-- CreateIndex
CREATE INDEX "customer_transactions_organizationId_transactionDate_idx" ON "customer_transactions"("organizationId", "transactionDate" DESC);

-- CreateIndex
CREATE INDEX "supplier_transactions_supplierId_transactionDate_idx" ON "supplier_transactions"("supplierId", "transactionDate");

-- CreateIndex
CREATE INDEX "supplier_transactions_organizationId_idx" ON "supplier_transactions"("organizationId");

-- CreateIndex
CREATE INDEX "supplier_transactions_organizationId_transactionDate_idx" ON "supplier_transactions"("organizationId", "transactionDate" DESC);

-- CreateIndex
CREATE INDEX "product_categories_organizationId_idx" ON "product_categories"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "product_categories_organizationId_slug_key" ON "product_categories"("organizationId", "slug");

-- CreateIndex
CREATE INDEX "pos_sessions_organizationId_idx" ON "pos_sessions"("organizationId");

-- CreateIndex
CREATE INDEX "pos_sessions_organizationId_openedAt_idx" ON "pos_sessions"("organizationId", "openedAt" DESC);

-- CreateIndex
CREATE INDEX "pos_sessions_organizationId_branchId_warehouseId_status_idx" ON "pos_sessions"("organizationId", "branchId", "warehouseId", "status");

-- CreateIndex
CREATE INDEX "pos_sessions_userId_idx" ON "pos_sessions"("userId");

-- CreateIndex
CREATE INDEX "pos_sessions_warehouseId_idx" ON "pos_sessions"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "pos_sessions_organizationId_sessionNumber_key" ON "pos_sessions"("organizationId", "sessionNumber");

-- CreateIndex
CREATE INDEX "pos_held_orders_organizationId_idx" ON "pos_held_orders"("organizationId");

-- CreateIndex
CREATE INDEX "pos_held_orders_sessionId_idx" ON "pos_held_orders"("sessionId");

-- CreateIndex
CREATE INDEX "settings_organizationId_idx" ON "settings"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "settings_organizationId_key_key" ON "settings"("organizationId", "key");

-- CreateIndex
CREATE INDEX "accounts_organizationId_idx" ON "accounts"("organizationId");

-- CreateIndex
CREATE INDEX "accounts_parentId_idx" ON "accounts"("parentId");

-- CreateIndex
CREATE UNIQUE INDEX "accounts_organizationId_code_key" ON "accounts"("organizationId", "code");

-- CreateIndex
CREATE UNIQUE INDEX "cash_bank_accounts_accountId_key" ON "cash_bank_accounts"("accountId");

-- CreateIndex
CREATE INDEX "cash_bank_accounts_organizationId_idx" ON "cash_bank_accounts"("organizationId");

-- CreateIndex
CREATE INDEX "cash_bank_accounts_branchId_idx" ON "cash_bank_accounts"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "cash_bank_accounts_organizationId_name_key" ON "cash_bank_accounts"("organizationId", "name");

-- CreateIndex
CREATE INDEX "cash_bank_transactions_cashBankAccountId_transactionDate_idx" ON "cash_bank_transactions"("cashBankAccountId", "transactionDate");

-- CreateIndex
CREATE INDEX "cash_bank_transactions_organizationId_idx" ON "cash_bank_transactions"("organizationId");

-- CreateIndex
CREATE INDEX "cash_bank_transactions_organizationId_transactionDate_idx" ON "cash_bank_transactions"("organizationId", "transactionDate" DESC);

-- CreateIndex
CREATE INDEX "expenses_organizationId_idx" ON "expenses"("organizationId");

-- CreateIndex
CREATE INDEX "expenses_organizationId_expenseDate_idx" ON "expenses"("organizationId", "expenseDate" DESC);

-- CreateIndex
CREATE INDEX "expenses_organizationId_status_idx" ON "expenses"("organizationId", "status");

-- CreateIndex
CREATE INDEX "expenses_supplierId_idx" ON "expenses"("supplierId");

-- CreateIndex
CREATE INDEX "expenses_cashBankAccountId_idx" ON "expenses"("cashBankAccountId");

-- CreateIndex
CREATE UNIQUE INDEX "expenses_organizationId_expenseNumber_key" ON "expenses"("organizationId", "expenseNumber");

-- CreateIndex
CREATE INDEX "expense_items_expenseId_idx" ON "expense_items"("expenseId");

-- CreateIndex
CREATE INDEX "expense_items_accountId_idx" ON "expense_items"("accountId");

-- CreateIndex
CREATE INDEX "expense_items_organizationId_idx" ON "expense_items"("organizationId");

-- CreateIndex
CREATE INDEX "journal_entries_organizationId_idx" ON "journal_entries"("organizationId");

-- CreateIndex
CREATE INDEX "journal_entries_organizationId_date_idx" ON "journal_entries"("organizationId", "date" DESC);

-- CreateIndex
CREATE INDEX "journal_entries_organizationId_status_idx" ON "journal_entries"("organizationId", "status");

-- CreateIndex
CREATE INDEX "journal_entries_sourceType_sourceId_idx" ON "journal_entries"("sourceType", "sourceId");

-- CreateIndex
CREATE INDEX "journal_entries_branchId_idx" ON "journal_entries"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "journal_entries_organizationId_journalNumber_key" ON "journal_entries"("organizationId", "journalNumber");

-- CreateIndex
CREATE INDEX "journal_entry_lines_journalEntryId_idx" ON "journal_entry_lines"("journalEntryId");

-- CreateIndex
CREATE INDEX "journal_entry_lines_accountId_idx" ON "journal_entry_lines"("accountId");

-- CreateIndex
CREATE INDEX "journal_entry_lines_organizationId_idx" ON "journal_entry_lines"("organizationId");

-- CreateIndex
CREATE INDEX "branches_organizationId_idx" ON "branches"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "branches_organizationId_code_key" ON "branches"("organizationId", "code");

-- CreateIndex
CREATE INDEX "warehouses_organizationId_idx" ON "warehouses"("organizationId");

-- CreateIndex
CREATE INDEX "warehouses_branchId_idx" ON "warehouses"("branchId");

-- CreateIndex
CREATE UNIQUE INDEX "warehouses_organizationId_code_key" ON "warehouses"("organizationId", "code");

-- CreateIndex
CREATE INDEX "pos_register_configs_organizationId_idx" ON "pos_register_configs"("organizationId");

-- CreateIndex
CREATE INDEX "pos_register_configs_branchId_idx" ON "pos_register_configs"("branchId");

-- CreateIndex
CREATE INDEX "pos_register_configs_warehouseId_idx" ON "pos_register_configs"("warehouseId");

-- CreateIndex
CREATE UNIQUE INDEX "pos_register_configs_organizationId_locationKey_key" ON "pos_register_configs"("organizationId", "locationKey");

-- CreateIndex
CREATE INDEX "stock_transfers_organizationId_idx" ON "stock_transfers"("organizationId");

-- CreateIndex
CREATE INDEX "stock_transfers_organizationId_transferDate_idx" ON "stock_transfers"("organizationId", "transferDate" DESC);

-- CreateIndex
CREATE INDEX "stock_transfers_organizationId_status_idx" ON "stock_transfers"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "stock_transfers_organizationId_transferNumber_key" ON "stock_transfers"("organizationId", "transferNumber");

-- CreateIndex
CREATE INDEX "stock_transfer_items_stockTransferId_idx" ON "stock_transfer_items"("stockTransferId");

-- CreateIndex
CREATE INDEX "stock_transfer_items_productId_idx" ON "stock_transfer_items"("productId");

-- CreateIndex
CREATE INDEX "stock_transfer_items_organizationId_idx" ON "stock_transfer_items"("organizationId");

-- CreateIndex
CREATE INDEX "user_warehouse_access_userId_idx" ON "user_warehouse_access"("userId");

-- CreateIndex
CREATE INDEX "user_warehouse_access_branchId_idx" ON "user_warehouse_access"("branchId");

-- CreateIndex
CREATE INDEX "user_warehouse_access_organizationId_idx" ON "user_warehouse_access"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "user_warehouse_access_userId_warehouseId_key" ON "user_warehouse_access"("userId", "warehouseId");

-- CreateIndex
CREATE INDEX "mobile_devices_organizationId_idx" ON "mobile_devices"("organizationId");

-- CreateIndex
CREATE INDEX "mobile_devices_organizationId_imei2_idx" ON "mobile_devices"("organizationId", "imei2");

-- CreateIndex
CREATE INDEX "mobile_devices_organizationId_currentStatus_idx" ON "mobile_devices"("organizationId", "currentStatus");

-- CreateIndex
CREATE INDEX "mobile_devices_organizationId_supplierId_idx" ON "mobile_devices"("organizationId", "supplierId");

-- CreateIndex
CREATE INDEX "mobile_devices_organizationId_salesInvoiceId_idx" ON "mobile_devices"("organizationId", "salesInvoiceId");

-- CreateIndex
CREATE INDEX "mobile_devices_productId_idx" ON "mobile_devices"("productId");

-- CreateIndex
CREATE INDEX "mobile_devices_customerId_idx" ON "mobile_devices"("customerId");

-- CreateIndex
CREATE INDEX "mobile_devices_purchaseInvoiceId_idx" ON "mobile_devices"("purchaseInvoiceId");

-- CreateIndex
CREATE UNIQUE INDEX "mobile_devices_organizationId_imei1_key" ON "mobile_devices"("organizationId", "imei1");

-- CreateIndex
CREATE INDEX "gold_rates_organizationId_idx" ON "gold_rates"("organizationId");

-- CreateIndex
CREATE INDEX "gold_rates_organizationId_date_idx" ON "gold_rates"("organizationId", "date" DESC);

-- CreateIndex
CREATE UNIQUE INDEX "gold_rates_organizationId_date_purity_metalType_key" ON "gold_rates"("organizationId", "date", "purity", "metalType");

-- CreateIndex
CREATE INDEX "jewellery_categories_organizationId_idx" ON "jewellery_categories"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "jewellery_categories_organizationId_slug_key" ON "jewellery_categories"("organizationId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX "jewellery_items_productId_key" ON "jewellery_items"("productId");

-- CreateIndex
CREATE INDEX "jewellery_items_organizationId_idx" ON "jewellery_items"("organizationId");

-- CreateIndex
CREATE INDEX "jewellery_items_organizationId_status_idx" ON "jewellery_items"("organizationId", "status");

-- CreateIndex
CREATE INDEX "jewellery_items_organizationId_categoryId_idx" ON "jewellery_items"("organizationId", "categoryId");

-- CreateIndex
CREATE INDEX "jewellery_items_organizationId_purity_idx" ON "jewellery_items"("organizationId", "purity");

-- CreateIndex
CREATE INDEX "jewellery_items_organizationId_metalType_idx" ON "jewellery_items"("organizationId", "metalType");

-- CreateIndex
CREATE INDEX "jewellery_items_productId_idx" ON "jewellery_items"("productId");

-- CreateIndex
CREATE INDEX "jewellery_items_supplierId_idx" ON "jewellery_items"("supplierId");

-- CreateIndex
CREATE INDEX "jewellery_items_karigarId_idx" ON "jewellery_items"("karigarId");

-- CreateIndex
CREATE UNIQUE INDEX "jewellery_items_organizationId_tagNumber_key" ON "jewellery_items"("organizationId", "tagNumber");

-- CreateIndex
CREATE UNIQUE INDEX "jewellery_items_organizationId_huidNumber_key" ON "jewellery_items"("organizationId", "huidNumber");

-- CreateIndex
CREATE INDEX "stone_details_jewelleryItemId_idx" ON "stone_details"("jewelleryItemId");

-- CreateIndex
CREATE INDEX "stone_details_organizationId_idx" ON "stone_details"("organizationId");

-- CreateIndex
CREATE INDEX "karigars_organizationId_idx" ON "karigars"("organizationId");

-- CreateIndex
CREATE UNIQUE INDEX "karigars_organizationId_phone_key" ON "karigars"("organizationId", "phone");

-- CreateIndex
CREATE INDEX "karigar_transactions_karigarId_idx" ON "karigar_transactions"("karigarId");

-- CreateIndex
CREATE INDEX "karigar_transactions_organizationId_idx" ON "karigar_transactions"("organizationId");

-- CreateIndex
CREATE INDEX "karigar_transactions_organizationId_date_idx" ON "karigar_transactions"("organizationId", "date" DESC);

-- CreateIndex
CREATE INDEX "old_gold_purchases_organizationId_idx" ON "old_gold_purchases"("organizationId");

-- CreateIndex
CREATE INDEX "old_gold_purchases_customerId_idx" ON "old_gold_purchases"("customerId");

-- CreateIndex
CREATE INDEX "old_gold_purchases_organizationId_createdAt_idx" ON "old_gold_purchases"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "jewellery_repairs_organizationId_idx" ON "jewellery_repairs"("organizationId");

-- CreateIndex
CREATE INDEX "jewellery_repairs_organizationId_status_idx" ON "jewellery_repairs"("organizationId", "status");

-- CreateIndex
CREATE INDEX "jewellery_repairs_customerId_idx" ON "jewellery_repairs"("customerId");

-- CreateIndex
CREATE INDEX "jewellery_repairs_karigarId_idx" ON "jewellery_repairs"("karigarId");

-- CreateIndex
CREATE UNIQUE INDEX "jewellery_repairs_organizationId_repairNumber_key" ON "jewellery_repairs"("organizationId", "repairNumber");

-- CreateIndex
CREATE INDEX "customer_schemes_organizationId_idx" ON "customer_schemes"("organizationId");

-- CreateIndex
CREATE INDEX "customer_schemes_organizationId_status_idx" ON "customer_schemes"("organizationId", "status");

-- CreateIndex
CREATE INDEX "customer_schemes_customerId_idx" ON "customer_schemes"("customerId");

-- CreateIndex
CREATE INDEX "scheme_payments_schemeId_idx" ON "scheme_payments"("schemeId");

-- CreateIndex
CREATE INDEX "scheme_payments_organizationId_idx" ON "scheme_payments"("organizationId");

-- CreateIndex
CREATE INDEX "restaurant_tables_organizationId_idx" ON "restaurant_tables"("organizationId");

-- CreateIndex
CREATE INDEX "restaurant_tables_organizationId_status_idx" ON "restaurant_tables"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "restaurant_tables_organizationId_number_key" ON "restaurant_tables"("organizationId", "number");

-- CreateIndex
CREATE INDEX "kot_orders_organizationId_idx" ON "kot_orders"("organizationId");

-- CreateIndex
CREATE INDEX "kot_orders_organizationId_createdAt_idx" ON "kot_orders"("organizationId", "createdAt" DESC);

-- CreateIndex
CREATE INDEX "kot_orders_tableId_idx" ON "kot_orders"("tableId");

-- CreateIndex
CREATE INDEX "kot_orders_posSessionId_idx" ON "kot_orders"("posSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "kot_orders_organizationId_kotNumber_key" ON "kot_orders"("organizationId", "kotNumber");

-- CreateIndex
CREATE INDEX "kot_order_items_kotOrderId_idx" ON "kot_order_items"("kotOrderId");

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_posDefaultCashAccountId_fkey" FOREIGN KEY ("posDefaultCashAccountId") REFERENCES "cash_bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "organizations" ADD CONSTRAINT "organizations_posDefaultBankAccountId_fkey" FOREIGN KEY ("posDefaultBankAccountId") REFERENCES "cash_bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "subscription_logs" ADD CONSTRAINT "subscription_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "users" ADD CONSTRAINT "users_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "employees" ADD CONSTRAINT "employees_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "units" ADD CONSTRAINT "units_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "products" ADD CONSTRAINT "products_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "product_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_bundle_items" ADD CONSTRAINT "product_bundle_items_bundleProductId_fkey" FOREIGN KEY ("bundleProductId") REFERENCES "products"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_bundle_items" ADD CONSTRAINT "product_bundle_items_componentProductId_fkey" FOREIGN KEY ("componentProductId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_bundle_items" ADD CONSTRAINT "product_bundle_items_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_conversions" ADD CONSTRAINT "unit_conversions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_conversions" ADD CONSTRAINT "unit_conversions_fromUnitId_fkey" FOREIGN KEY ("fromUnitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "unit_conversions" ADD CONSTRAINT "unit_conversions_toUnitId_fkey" FOREIGN KEY ("toUnitId") REFERENCES "units"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customers" ADD CONSTRAINT "customers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_assignments" ADD CONSTRAINT "customer_assignments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_assignments" ADD CONSTRAINT "customer_assignments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_assignments" ADD CONSTRAINT "customer_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "suppliers" ADD CONSTRAINT "suppliers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_posSessionId_fkey" FOREIGN KEY ("posSessionId") REFERENCES "pos_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_items" ADD CONSTRAINT "invoice_items_jewelleryItemId_fkey" FOREIGN KEY ("jewelleryItemId") REFERENCES "jewellery_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_convertedInvoiceId_fkey" FOREIGN KEY ("convertedInvoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotations" ADD CONSTRAINT "quotations_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_quotationId_fkey" FOREIGN KEY ("quotationId") REFERENCES "quotations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "quotation_items" ADD CONSTRAINT "quotation_items_jewelleryItemId_fkey" FOREIGN KEY ("jewelleryItemId") REFERENCES "jewellery_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoices" ADD CONSTRAINT "purchase_invoices_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_items" ADD CONSTRAINT "purchase_invoice_items_purchaseInvoiceId_fkey" FOREIGN KEY ("purchaseInvoiceId") REFERENCES "purchase_invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_items" ADD CONSTRAINT "purchase_invoice_items_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_items" ADD CONSTRAINT "purchase_invoice_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_items" ADD CONSTRAINT "purchase_invoice_items_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "purchase_invoice_items" ADD CONSTRAINT "purchase_invoice_items_jewelleryItemId_fkey" FOREIGN KEY ("jewelleryItemId") REFERENCES "jewellery_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_notes" ADD CONSTRAINT "credit_notes_posSessionId_fkey" FOREIGN KEY ("posSessionId") REFERENCES "pos_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_note_items" ADD CONSTRAINT "credit_note_items_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "credit_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_note_items" ADD CONSTRAINT "credit_note_items_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_note_items" ADD CONSTRAINT "credit_note_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_note_items" ADD CONSTRAINT "credit_note_items_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credit_note_items" ADD CONSTRAINT "credit_note_items_jewelleryItemId_fkey" FOREIGN KEY ("jewelleryItemId") REFERENCES "jewellery_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_purchaseInvoiceId_fkey" FOREIGN KEY ("purchaseInvoiceId") REFERENCES "purchase_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debit_notes" ADD CONSTRAINT "debit_notes_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debit_note_items" ADD CONSTRAINT "debit_note_items_debitNoteId_fkey" FOREIGN KEY ("debitNoteId") REFERENCES "debit_notes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debit_note_items" ADD CONSTRAINT "debit_note_items_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debit_note_items" ADD CONSTRAINT "debit_note_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debit_note_items" ADD CONSTRAINT "debit_note_items_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debit_note_items" ADD CONSTRAINT "debit_note_items_jewelleryItemId_fkey" FOREIGN KEY ("jewelleryItemId") REFERENCES "jewellery_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debit_note_lot_consumptions" ADD CONSTRAINT "debit_note_lot_consumptions_debitNoteItemId_fkey" FOREIGN KEY ("debitNoteItemId") REFERENCES "debit_note_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debit_note_lot_consumptions" ADD CONSTRAINT "debit_note_lot_consumptions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "debit_note_lot_consumptions" ADD CONSTRAINT "debit_note_lot_consumptions_stockLotId_fkey" FOREIGN KEY ("stockLotId") REFERENCES "stock_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_adjustmentAccountId_fkey" FOREIGN KEY ("adjustmentAccountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payments" ADD CONSTRAINT "payments_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "payment_allocations" ADD CONSTRAINT "payment_allocations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_purchaseInvoiceId_fkey" FOREIGN KEY ("purchaseInvoiceId") REFERENCES "purchase_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_adjustmentAccountId_fkey" FOREIGN KEY ("adjustmentAccountId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payments" ADD CONSTRAINT "supplier_payments_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payment_allocations" ADD CONSTRAINT "supplier_payment_allocations_supplierPaymentId_fkey" FOREIGN KEY ("supplierPaymentId") REFERENCES "supplier_payments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payment_allocations" ADD CONSTRAINT "supplier_payment_allocations_purchaseInvoiceId_fkey" FOREIGN KEY ("purchaseInvoiceId") REFERENCES "purchase_invoices"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_payment_allocations" ADD CONSTRAINT "supplier_payment_allocations_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_lots" ADD CONSTRAINT "stock_lots_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_lots" ADD CONSTRAINT "stock_lots_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_lots" ADD CONSTRAINT "stock_lots_purchaseInvoiceItemId_fkey" FOREIGN KEY ("purchaseInvoiceItemId") REFERENCES "purchase_invoice_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_lots" ADD CONSTRAINT "stock_lots_purchaseInvoiceId_fkey" FOREIGN KEY ("purchaseInvoiceId") REFERENCES "purchase_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_lots" ADD CONSTRAINT "stock_lots_openingStockId_fkey" FOREIGN KEY ("openingStockId") REFERENCES "opening_stocks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_lots" ADD CONSTRAINT "stock_lots_creditNoteItemId_fkey" FOREIGN KEY ("creditNoteItemId") REFERENCES "credit_note_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_lots" ADD CONSTRAINT "stock_lots_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_lot_consumptions" ADD CONSTRAINT "stock_lot_consumptions_stockLotId_fkey" FOREIGN KEY ("stockLotId") REFERENCES "stock_lots"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_lot_consumptions" ADD CONSTRAINT "stock_lot_consumptions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_lot_consumptions" ADD CONSTRAINT "stock_lot_consumptions_invoiceItemId_fkey" FOREIGN KEY ("invoiceItemId") REFERENCES "invoice_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_lot_consumptions" ADD CONSTRAINT "stock_lot_consumptions_stockTransferItemId_fkey" FOREIGN KEY ("stockTransferItemId") REFERENCES "stock_transfer_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opening_stocks" ADD CONSTRAINT "opening_stocks_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opening_stocks" ADD CONSTRAINT "opening_stocks_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "opening_stocks" ADD CONSTRAINT "opening_stocks_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_audit_logs" ADD CONSTRAINT "cost_audit_logs_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_audit_logs" ADD CONSTRAINT "cost_audit_logs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cost_audit_logs" ADD CONSTRAINT "cost_audit_logs_invoiceItemId_fkey" FOREIGN KEY ("invoiceItemId") REFERENCES "invoice_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_transactions" ADD CONSTRAINT "customer_transactions_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_transactions" ADD CONSTRAINT "customer_transactions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_transactions" ADD CONSTRAINT "customer_transactions_creditNoteId_fkey" FOREIGN KEY ("creditNoteId") REFERENCES "credit_notes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_transactions" ADD CONSTRAINT "supplier_transactions_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_transactions" ADD CONSTRAINT "supplier_transactions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "supplier_transactions" ADD CONSTRAINT "supplier_transactions_debitNoteId_fkey" FOREIGN KEY ("debitNoteId") REFERENCES "debit_notes"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "product_categories" ADD CONSTRAINT "product_categories_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_sessions" ADD CONSTRAINT "pos_sessions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_sessions" ADD CONSTRAINT "pos_sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_sessions" ADD CONSTRAINT "pos_sessions_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "employees"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_sessions" ADD CONSTRAINT "pos_sessions_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_sessions" ADD CONSTRAINT "pos_sessions_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_held_orders" ADD CONSTRAINT "pos_held_orders_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_held_orders" ADD CONSTRAINT "pos_held_orders_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "pos_sessions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_held_orders" ADD CONSTRAINT "pos_held_orders_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "settings" ADD CONSTRAINT "settings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "accounts" ADD CONSTRAINT "accounts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_bank_accounts" ADD CONSTRAINT "cash_bank_accounts_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_bank_accounts" ADD CONSTRAINT "cash_bank_accounts_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_bank_accounts" ADD CONSTRAINT "cash_bank_accounts_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_bank_transactions" ADD CONSTRAINT "cash_bank_transactions_cashBankAccountId_fkey" FOREIGN KEY ("cashBankAccountId") REFERENCES "cash_bank_accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cash_bank_transactions" ADD CONSTRAINT "cash_bank_transactions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_cashBankAccountId_fkey" FOREIGN KEY ("cashBankAccountId") REFERENCES "cash_bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expenses" ADD CONSTRAINT "expenses_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_items" ADD CONSTRAINT "expense_items_expenseId_fkey" FOREIGN KEY ("expenseId") REFERENCES "expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_items" ADD CONSTRAINT "expense_items_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "expense_items" ADD CONSTRAINT "expense_items_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entries" ADD CONSTRAINT "journal_entries_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_journalEntryId_fkey" FOREIGN KEY ("journalEntryId") REFERENCES "journal_entries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_accountId_fkey" FOREIGN KEY ("accountId") REFERENCES "accounts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "journal_entry_lines" ADD CONSTRAINT "journal_entry_lines_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "branches" ADD CONSTRAINT "branches_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "warehouses" ADD CONSTRAINT "warehouses_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_register_configs" ADD CONSTRAINT "pos_register_configs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_register_configs" ADD CONSTRAINT "pos_register_configs_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_register_configs" ADD CONSTRAINT "pos_register_configs_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_register_configs" ADD CONSTRAINT "pos_register_configs_defaultCashAccountId_fkey" FOREIGN KEY ("defaultCashAccountId") REFERENCES "cash_bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "pos_register_configs" ADD CONSTRAINT "pos_register_configs_defaultBankAccountId_fkey" FOREIGN KEY ("defaultBankAccountId") REFERENCES "cash_bank_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_sourceBranchId_fkey" FOREIGN KEY ("sourceBranchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_sourceWarehouseId_fkey" FOREIGN KEY ("sourceWarehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_destinationBranchId_fkey" FOREIGN KEY ("destinationBranchId") REFERENCES "branches"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfers" ADD CONSTRAINT "stock_transfers_destinationWarehouseId_fkey" FOREIGN KEY ("destinationWarehouseId") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "stock_transfer_items_stockTransferId_fkey" FOREIGN KEY ("stockTransferId") REFERENCES "stock_transfers"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "stock_transfer_items_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "stock_transfer_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stock_transfer_items" ADD CONSTRAINT "stock_transfer_items_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_warehouse_access" ADD CONSTRAINT "user_warehouse_access_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_warehouse_access" ADD CONSTRAINT "user_warehouse_access_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "branches"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_warehouse_access" ADD CONSTRAINT "user_warehouse_access_warehouseId_fkey" FOREIGN KEY ("warehouseId") REFERENCES "warehouses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_warehouse_access" ADD CONSTRAINT "user_warehouse_access_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_devices" ADD CONSTRAINT "mobile_devices_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_devices" ADD CONSTRAINT "mobile_devices_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_devices" ADD CONSTRAINT "mobile_devices_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_devices" ADD CONSTRAINT "mobile_devices_purchaseInvoiceId_fkey" FOREIGN KEY ("purchaseInvoiceId") REFERENCES "purchase_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_devices" ADD CONSTRAINT "mobile_devices_openingStockId_fkey" FOREIGN KEY ("openingStockId") REFERENCES "opening_stocks"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_devices" ADD CONSTRAINT "mobile_devices_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_devices" ADD CONSTRAINT "mobile_devices_salesInvoiceId_fkey" FOREIGN KEY ("salesInvoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "mobile_devices" ADD CONSTRAINT "mobile_devices_salespersonId_fkey" FOREIGN KEY ("salespersonId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "gold_rates" ADD CONSTRAINT "gold_rates_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jewellery_categories" ADD CONSTRAINT "jewellery_categories_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jewellery_items" ADD CONSTRAINT "jewellery_items_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jewellery_items" ADD CONSTRAINT "jewellery_items_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "jewellery_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jewellery_items" ADD CONSTRAINT "jewellery_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jewellery_items" ADD CONSTRAINT "jewellery_items_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "suppliers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jewellery_items" ADD CONSTRAINT "jewellery_items_karigarId_fkey" FOREIGN KEY ("karigarId") REFERENCES "karigars"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stone_details" ADD CONSTRAINT "stone_details_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stone_details" ADD CONSTRAINT "stone_details_jewelleryItemId_fkey" FOREIGN KEY ("jewelleryItemId") REFERENCES "jewellery_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "karigars" ADD CONSTRAINT "karigars_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "karigar_transactions" ADD CONSTRAINT "karigar_transactions_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "karigar_transactions" ADD CONSTRAINT "karigar_transactions_karigarId_fkey" FOREIGN KEY ("karigarId") REFERENCES "karigars"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "karigar_transactions" ADD CONSTRAINT "karigar_transactions_jewelleryItemId_fkey" FOREIGN KEY ("jewelleryItemId") REFERENCES "jewellery_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "old_gold_purchases" ADD CONSTRAINT "old_gold_purchases_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "old_gold_purchases" ADD CONSTRAINT "old_gold_purchases_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "old_gold_purchases" ADD CONSTRAINT "old_gold_purchases_adjustedAgainstInvoiceId_fkey" FOREIGN KEY ("adjustedAgainstInvoiceId") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jewellery_repairs" ADD CONSTRAINT "jewellery_repairs_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jewellery_repairs" ADD CONSTRAINT "jewellery_repairs_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "jewellery_repairs" ADD CONSTRAINT "jewellery_repairs_karigarId_fkey" FOREIGN KEY ("karigarId") REFERENCES "karigars"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_schemes" ADD CONSTRAINT "customer_schemes_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_schemes" ADD CONSTRAINT "customer_schemes_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "customers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheme_payments" ADD CONSTRAINT "scheme_payments_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "scheme_payments" ADD CONSTRAINT "scheme_payments_schemeId_fkey" FOREIGN KEY ("schemeId") REFERENCES "customer_schemes"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "restaurant_tables" ADD CONSTRAINT "restaurant_tables_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kot_orders" ADD CONSTRAINT "kot_orders_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "organizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kot_orders" ADD CONSTRAINT "kot_orders_tableId_fkey" FOREIGN KEY ("tableId") REFERENCES "restaurant_tables"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kot_orders" ADD CONSTRAINT "kot_orders_posSessionId_fkey" FOREIGN KEY ("posSessionId") REFERENCES "pos_sessions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kot_orders" ADD CONSTRAINT "kot_orders_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kot_order_items" ADD CONSTRAINT "kot_order_items_kotOrderId_fkey" FOREIGN KEY ("kotOrderId") REFERENCES "kot_orders"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "kot_order_items" ADD CONSTRAINT "kot_order_items_productId_fkey" FOREIGN KEY ("productId") REFERENCES "products"("id") ON DELETE SET NULL ON UPDATE CASCADE;

