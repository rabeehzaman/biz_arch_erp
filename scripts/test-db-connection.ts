import prisma from '../src/lib/prisma'

async function main() {
  const count = await prisma.invoice.count()
  console.log("Total invoices:", count)
  
  const posCount = await prisma.invoice.count({ where: { sourceType: "POS" } })
  console.log("POS invoices:", posCount)

  const manualCount = await prisma.invoice.count({ where: { sourceType: "MANUAL" } })
  console.log("Manual invoices:", manualCount)

  const revenues = await prisma.journalEntryLine.findMany({
    where: { account: { accountType: "REVENUE" } },
    include: { journalEntry: true, account: true }
  })
  
  console.log("Revenue Journal Entry Lines:", revenues.length)
  for (const r of revenues.slice(0, 5)) {
    console.log(`- ${r.journalEntry.description} | Date: ${r.journalEntry.date} | Status: ${r.journalEntry.status} | Account: ${r.account.code} | CR: ${r.credit} DR: ${r.debit}`)
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
