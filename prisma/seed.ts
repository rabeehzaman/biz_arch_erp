import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";
import { hash } from "bcryptjs";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  // Create admin user
  const hashedPassword = await hash("admin123", 12);

  const admin = await prisma.user.upsert({
    where: { email: "admin@bizarch.com" },
    update: {},
    create: {
      email: "admin@bizarch.com",
      password: hashedPassword,
      name: "Admin",
      role: "admin",
    },
  });

  console.log("Created admin user:", admin.email);

  // Create Dilshad user
  const dilshadPassword = await hash("dilshad123", 12);
  const dilshad = await prisma.user.upsert({
    where: { email: "dilshad@bizarch.com" },
    update: {},
    create: {
      email: "dilshad@bizarch.com",
      password: dilshadPassword,
      name: "Dilshad",
      role: "user",
    },
  });
  console.log("Created user:", dilshad.email);

  // Create Faljas user
  const faljasPassword = await hash("faljas123", 12);
  const faljas = await prisma.user.upsert({
    where: { email: "faljas@bizarch.com" },
    update: {},
    create: {
      email: "faljas@bizarch.com",
      password: faljasPassword,
      name: "Faljas",
      role: "user",
    },
  });
  console.log("Created user:", faljas.email);

  // Create default settings
  const settings = [
    { key: "company_name", value: "BizArch ERP" },
    { key: "currency", value: "INR" },
    { key: "currency_symbol", value: "₹" },
    { key: "tax_rate", value: "18" },
    { key: "invoice_prefix", value: "INV-" },
    { key: "payment_prefix", value: "PAY-" },
  ];

  for (const setting of settings) {
    await prisma.setting.upsert({
      where: { key: setting.key },
      update: { value: setting.value },
      create: setting,
    });
  }

  console.log("Created default settings");

  // Create sample customers
  const customer1 = await prisma.customer.create({
    data: {
      name: "Acme Corporation",
      email: "contact@acme.com",
      phone: "+91 9876543210",
      address: "123 Business Park",
      city: "Mumbai",
      state: "Maharashtra",
      zipCode: "400001",
    },
  });

  const customer2 = await prisma.customer.create({
    data: {
      name: "TechStart Solutions",
      email: "info@techstart.com",
      phone: "+91 9876543211",
      address: "456 Tech Hub",
      city: "Bangalore",
      state: "Karnataka",
      zipCode: "560001",
    },
  });

  console.log("Created sample customers:", customer1.name, customer2.name);

  // Create default units
  const units = [
    { code: "pcs", name: "Piece" },
    { code: "kg", name: "Kilogram" },
    { code: "mtr", name: "Meter" },
    { code: "ltr", name: "Liter" },
    { code: "box", name: "Box" },
    { code: "hour", name: "Hour" },
    { code: "day", name: "Day" },
    { code: "month", name: "Month" },
    { code: "project", name: "Project" },
  ];

  const createdUnits: Record<string, any> = {};
  for (const unit of units) {
    const createdUnit = await prisma.unit.upsert({
      where: { code: unit.code },
      update: {},
      create: unit,
    });
    createdUnits[unit.code] = createdUnit;
  }

  console.log("Created default units");

  // Create sample products
  const products = [
    {
      name: "Web Development Service",
      description: "Professional web development service",
      price: 50000,
      unitId: createdUnits["project"].id,
      sku: "WEB-001",
    },
    {
      name: "Mobile App Development",
      description: "iOS and Android app development",
      price: 100000,
      unitId: createdUnits["project"].id,
      sku: "MOB-001",
    },
    {
      name: "Consulting Hour",
      description: "Professional consulting service",
      price: 2500,
      unitId: createdUnits["hour"].id,
      sku: "CON-001",
    },
    {
      name: "Server Maintenance",
      description: "Monthly server maintenance",
      price: 15000,
      unitId: createdUnits["month"].id,
      sku: "SRV-001",
    },
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { sku: product.sku },
      update: {},
      create: product,
    });
  }

  console.log("Created sample products");

  console.log("Seeding complete!");
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
