-- CreateEnum
CREATE TYPE "RestaurantTableStatus" AS ENUM ('AVAILABLE', 'OCCUPIED', 'RESERVED', 'CLEANING');

-- CreateEnum
CREATE TYPE "KOTStatus" AS ENUM ('PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "KOTType" AS ENUM ('STANDARD', 'FOLLOWUP', 'VOID');

-- CreateEnum
CREATE TYPE "RestaurantOrderType" AS ENUM ('DINE_IN', 'TAKEAWAY');

-- AlterTable
ALTER TABLE "organizations" ADD COLUMN     "isRestaurantModuleEnabled" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "restaurantKotPrintingEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "restaurantTablesEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "restaurantThemeColor" TEXT DEFAULT '#c0392b',
ADD COLUMN     "restaurantThemeEnabled" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "restaurantThemePreset" TEXT DEFAULT 'bistro';

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
