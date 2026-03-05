import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";

import pg from "pg";
import { PrismaPg } from "@prisma/adapter-pg";

// Next.js uses standard env resolution. Prisma uses standard as well.
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding large invoice...");

  const user = await prisma.user.findUnique({
    where: { email: "saudi@gmail.com" },
    include: { organization: true }
  });

  if (!user || !user.organizationId) {
    console.error("User saudi@gmail.com not found or has no org");
    return;
  }

  const orgId = user.organizationId;

  // Find or create a customer
  let customer = await prisma.customer.findFirst({
    where: { organizationId: orgId }
  });

  if (!customer) {
    customer = await prisma.customer.create({
      data: {
        name: "Test Customer for Large Invoice",
        email: "test@example.com",
        organizationId: orgId,
      }
    });
  }

  // Create 30 products if we don't have enough
  const products = [];
  for (let i = 1; i <= 30; i++) {
    const p = await prisma.product.upsert({
      where: {
        organizationId_sku: {
          organizationId: orgId,
          sku: `ITEM-${i}`
        }
      },
      update: {},
      create: {
        name: `Automated Item ${i}`,
        sku: `ITEM-${i}`,
        price: 15 * i,
        organizationId: orgId,
        isActive: true
      }
    });
    products.push(p);
  }

  // Create an invoice with 30 items
  const invNumber = `INV-LARGE-${Date.now().toString().slice(-6)}`;

  // First create the standard empty invoice
  const invoice = await prisma.invoice.create({
    data: {
      invoiceNumber: invNumber,
      customerId: customer.id,
      createdById: user.id,
      organizationId: orgId,
      issueDate: new Date(),
      dueDate: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      subtotal: 0,
      total: 0,
      balanceDue: 0,
    }
  });

  console.log("Invoice created:", invoice.id);

  // Now create the 30 items in a transaction or individually
  let totalval = 0;
  for (const product of products) {
    const qty = 2;
    const price = Number(product.price);
    const lineTotal = qty * price;
    totalval += lineTotal;

    await prisma.invoiceItem.create({
      data: {
        invoiceId: invoice.id,
        organizationId: orgId,
        productId: product.id,
        description: product.name,
        quantity: qty,
        unitPrice: price,
        total: lineTotal,
      }
    });
  }

  // Update total
  await prisma.invoice.update({
    where: { id: invoice.id },
    data: {
      subtotal: totalval,
      total: totalval,
      balanceDue: totalval,
    }
  });

  console.log(`Updated Invoice ${invNumber} with 30 items.`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
