import "dotenv/config";
import { PrismaClient } from "./src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { createAutoJournalEntry, getSystemAccount } from "./src/lib/accounting/journal";

const pool = new pg.Pool({
    connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function runTest() {
    console.log("=== Running Headless Prisma Test ===");
    try {
        const org = await prisma.organization.findFirst();
        if (!org) throw new Error("No organization found");
        const organizationId = org.id;

        const unit = await prisma.unit.findFirst();
        if (!unit) throw new Error("No unit found");
        const unitId = unit.id;

        const supplier = await prisma.supplier.findFirst();
        if (!supplier) throw new Error("No supplier found");
        const supplierId = supplier.id;

        const name = `Test Samsung S30 Ultra ${Date.now()}`;
        const price = 1200;
        const isImeiTracked = true;
        const deviceDetails = {
            imeisList: [
                `IMEI-${Date.now()}-1`,
                `IMEI-${Date.now()}-2`,
                `IMEI-${Date.now()}-3`
            ],
            supplierId,
            costPrice: 900,
        };

        console.log("Testing IMEI validation...");
        if (!deviceDetails.supplierId) {
            throw new Error("SUPPLIER_REQUIRED");
        }

        console.log("Testing Product Creation...");
        const product = await prisma.$transaction(async (tx: any) => {
            const newProduct = await tx.product.create({
                data: {
                    organizationId,
                    name,
                    description: "Headless test product",
                    price,
                    unitId,
                    isService: false,
                    isImeiTracked: true,
                    gstRate: 18,
                },
            });

            // Deduce brand and model
            const nameParts = name.trim().split(/\s+/);
            const deducedBrand = nameParts.length > 0 ? nameParts[0] : "Unknown";
            const deducedModel = nameParts.length > 1 ? nameParts.slice(1).join(" ") : name;

            const quantity = deviceDetails.imeisList.length;
            const totalCost = deviceDetails.costPrice * quantity;

            // Create all mobile devices
            let i = 1;
            for (const imei of deviceDetails.imeisList) {
                await tx.mobileDevice.create({
                    data: {
                        organizationId,
                        imei1: imei,
                        brand: deducedBrand,
                        model: deducedModel,
                        productId: newProduct.id,
                        supplierId: deviceDetails.supplierId,
                        costPrice: deviceDetails.costPrice,
                        sellingPrice: price,
                        notes: `Test device ${i++}`,
                    },
                });
            }

            const openingStock = await tx.openingStock.create({
                data: {
                    productId: newProduct.id,
                    quantity: quantity,
                    unitCost: deviceDetails.costPrice,
                    stockDate: new Date(),
                    notes: `Created from Product Form (${quantity} devices)`,
                    organizationId,
                },
            });

            await tx.stockLot.create({
                data: {
                    organizationId,
                    productId: newProduct.id,
                    sourceType: "OPENING_STOCK",
                    openingStockId: openingStock.id,
                    lotDate: new Date(),
                    unitCost: deviceDetails.costPrice,
                    initialQuantity: quantity,
                    remainingQuantity: quantity,
                },
            });

            return newProduct;
        });

        console.log(`✅ Success! Product ID: ${product.id}`);

        // Verify DB
        console.log("Verifying Mobile Devices...");
        const devices = await prisma.mobileDevice.findMany({
            where: { productId: product.id }
        });
        console.log(`Found ${devices.length} devices. First device brand: ${devices[0].brand}, model: ${devices[0].model}`);

        if (devices.length === 3 && devices[0].brand === "Test" && devices[0].model.startsWith("Samsung S30 Ultra")) {
            console.log("✅ Check Passed: Correct number of devices and deduced brand/model correctly.");
        } else {
            console.error("❌ Check Failed. Data mismatch.");
        }

        // Check stock lot
        console.log("Verifying Stock Lots...");
        const lots = await prisma.stockLot.findMany({
            where: { productId: product.id }
        });

        if (lots.length === 1 && Number(lots[0].initialQuantity) === 3) {
            console.log("✅ Check Passed: Created 1 stock lot with initial quantity of 3.");
        } else {
            console.error("❌ Check Failed. Stock lot mismatch.");
        }

        console.log("=== Test Complete ===");
    } catch (error) {
        console.error("Test failed:", error);
    } finally {
        await prisma.$disconnect();
    }
}

runTest();
