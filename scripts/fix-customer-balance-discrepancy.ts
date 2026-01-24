// Script to check and fix customer balance discrepancies
// Run with: npx tsx scripts/fix-customer-balance-discrepancy.ts

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client.js";
import { PrismaPg } from "@prisma/adapter-pg";
import pg from "pg";

const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
});

const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function checkCustomerBalance(customerId: string) {
  console.log(`\n🔍 Checking customer ${customerId}...\n`);

  const customer = await prisma.customer.findUnique({
    where: { id: customerId },
    include: {
      invoices: {
        select: {
          id: true,
          invoiceNumber: true,
          total: true,
          amountPaid: true,
          balanceDue: true,
        },
      },
      payments: {
        select: {
          id: true,
          paymentNumber: true,
          amount: true,
        },
      },
      transactions: {
        orderBy: { transactionDate: "asc" },
        select: {
          id: true,
          transactionType: true,
          transactionDate: true,
          amount: true,
          description: true,
          runningBalance: true,
        },
      },
    },
  });

  if (!customer) {
    console.log(`❌ Customer not found!`);
    return null;
  }

  console.log(`Customer: ${customer.name}`);
  console.log(`Current Balance in DB: ${customer.balance}\n`);

  // Calculate expected balance from transactions
  let calculatedBalance = 0;
  console.log("Transaction History:");
  console.log("-------------------");

  for (const txn of customer.transactions) {
    calculatedBalance += Number(txn.amount);
    console.log(
      `${txn.transactionDate.toISOString().split("T")[0]} | ${txn.transactionType.padEnd(16)} | ${String(
        txn.amount
      ).padStart(10)} | Running: ${String(calculatedBalance.toFixed(2)).padStart(10)} | Stored: ${
        txn.runningBalance
      } | ${txn.description}`
    );
  }

  console.log("\n-------------------");
  console.log(`Calculated Balance: ${calculatedBalance.toFixed(2)}`);
  console.log(`Stored Balance: ${customer.balance}`);

  const discrepancy = Number(customer.balance) - calculatedBalance;
  if (Math.abs(discrepancy) > 0.01) {
    console.log(`\n⚠️  DISCREPANCY FOUND: ${discrepancy.toFixed(2)}`);
    return { customer, calculatedBalance, discrepancy };
  } else {
    console.log(`\n✅ Balance is correct!`);
    return { customer, calculatedBalance, discrepancy: 0 };
  }
}

async function fixCustomerBalance(customerId: string, correctBalance: number) {
  console.log(`\n🔧 Fixing customer balance to ${correctBalance}...\n`);

  await prisma.$transaction(async (tx) => {
    // Update customer balance
    await tx.customer.update({
      where: { id: customerId },
      data: { balance: correctBalance },
    });

    // Recalculate running balances for all transactions
    const transactions = await tx.customerTransaction.findMany({
      where: { customerId },
      orderBy: { transactionDate: "asc" },
    });

    let runningBalance = 0;
    for (const txn of transactions) {
      runningBalance += Number(txn.amount);
      await tx.customerTransaction.update({
        where: { id: txn.id },
        data: { runningBalance },
      });
    }

    console.log(`✓ Updated customer balance to ${correctBalance}`);
    console.log(`✓ Recalculated ${transactions.length} running balances`);
  });

  console.log(`\n✅ Customer balance fixed!`);
}

async function findCustomerByName(name: string) {
  const customers = await prisma.customer.findMany({
    where: {
      name: {
        contains: name,
        mode: "insensitive",
      },
    },
    select: {
      id: true,
      name: true,
      balance: true,
    },
  });

  if (customers.length === 0) {
    console.log(`❌ No customers found matching "${name}"`);
    return null;
  }

  console.log(`\nFound ${customers.length} customer(s) matching "${name}":`);
  customers.forEach((c, i) => {
    console.log(`${i + 1}. ${c.name} (ID: ${c.id}, Balance: ${c.balance})`);
  });

  return customers;
}

async function checkAllCustomers() {
  console.log(`\n🔍 Checking all customers for balance discrepancies...\n`);

  const customers = await prisma.customer.findMany({
    select: {
      id: true,
      name: true,
      balance: true,
    },
    orderBy: { name: "asc" },
  });

  const issues: Array<{ id: string; name: string; discrepancy: number }> = [];

  for (const customer of customers) {
    // Calculate expected balance from transactions
    const transactions = await prisma.customerTransaction.findMany({
      where: { customerId: customer.id },
    });

    const calculatedBalance = transactions.reduce((sum, txn) => sum + Number(txn.amount), 0);
    const discrepancy = Number(customer.balance) - calculatedBalance;

    if (Math.abs(discrepancy) > 0.01) {
      issues.push({
        id: customer.id,
        name: customer.name,
        discrepancy,
      });
      console.log(
        `⚠️  ${customer.name} (${customer.id}): Stored=${customer.balance}, Calculated=${calculatedBalance.toFixed(
          2
        )}, Diff=${discrepancy.toFixed(2)}`
      );
    }
  }

  if (issues.length === 0) {
    console.log(`✅ All customer balances are correct!`);
  } else {
    console.log(`\n⚠️  Found ${issues.length} customer(s) with balance discrepancies`);
  }

  return issues;
}

// Main function
async function main() {
  const args = process.argv.slice(2);
  const command = args[0];

  if (command === "check-all") {
    await checkAllCustomers();
  } else if (command === "find") {
    const name = args[1];
    if (!name) {
      console.log("Usage: npx tsx scripts/fix-customer-balance-discrepancy.ts find <name>");
      return;
    }
    await findCustomerByName(name);
  } else if (command === "check") {
    const customerId = args[1];
    if (!customerId) {
      console.log("Usage: npx tsx scripts/fix-customer-balance-discrepancy.ts check <customer-id>");
      return;
    }
    await checkCustomerBalance(customerId);
  } else if (command === "fix") {
    const customerId = args[1];
    if (!customerId) {
      console.log("Usage: npx tsx scripts/fix-customer-balance-discrepancy.ts fix <customer-id>");
      return;
    }
    const result = await checkCustomerBalance(customerId);
    if (result && Math.abs(result.discrepancy) > 0.01) {
      await fixCustomerBalance(customerId, result.calculatedBalance);
    }
  } else {
    console.log(`
Customer Balance Checker and Fixer

Usage:
  npx tsx scripts/fix-customer-balance-discrepancy.ts check-all
    - Check all customers for balance discrepancies

  npx tsx scripts/fix-customer-balance-discrepancy.ts find <name>
    - Find customers by name (e.g., "shafeeq")

  npx tsx scripts/fix-customer-balance-discrepancy.ts check <customer-id>
    - Check a specific customer's balance

  npx tsx scripts/fix-customer-balance-discrepancy.ts fix <customer-id>
    - Fix a specific customer's balance discrepancy

Examples:
  npx tsx scripts/fix-customer-balance-discrepancy.ts find "shafeeq"
  npx tsx scripts/fix-customer-balance-discrepancy.ts check cm6abc123
  npx tsx scripts/fix-customer-balance-discrepancy.ts fix cm6abc123
    `);
  }
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
