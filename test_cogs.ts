import { prisma } from "./src/lib/prisma";
import { consumeStockFIFO } from "./src/lib/inventory/fifo";

async function main() {
  const org = await prisma.organization.findFirst();
  if (!org) { console.log("no org"); return; }

  // Check if we have any recently added mobile devices
  const recentDevice = await prisma.mobileDevice.findFirst({
    orderBy: { createdAt: 'desc' },
    include: { product: true }
  });

  if (recentDevice) {
    console.log("Recent Device:", recentDevice.imei1, "Cost:", recentDevice.costPrice, "Product:", recentDevice.product?.name);
    
    // Check its Opening Stock
    const os = await prisma.openingStock.findFirst({
      where: { productId: recentDevice.productId! }
    });
    console.log("OS:", os);
    
    // Check its Stock Lot
    const lot = await prisma.stockLot.findFirst({
      where: { productId: recentDevice.productId! }
    });
    console.log("StockLot:", lot);

    // Let's pretend to consume it
    const res = await consumeStockFIFO(
      recentDevice.productId!,
      1,
      "test_ref_123",
      new Date(),
      prisma,
      org.id,
      null, // warehouseId
      "INVOICE"
    );
    console.log("Consume Result:", res);
  } else {
    console.log("No devices found.");
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
