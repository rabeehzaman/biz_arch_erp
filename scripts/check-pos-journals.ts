import prisma from '../src/lib/prisma'

async function main() {
  const org = await prisma.organization.findFirst()
  if (!org) { console.log("No org"); return; }
  
  const posInvoices = await prisma.invoice.findMany({
    where: { sourceType: "POS" },
    include: { items: true }
  })
  console.log(`Found ${posInvoices.length} POS invoices`)
  
  for (const inv of posInvoices.slice(0, 3)) {
    console.log(`Invoice ${inv.invoiceNumber} Total ${inv.total}`)
    const entries = await prisma.journalEntry.findMany({
      where: { sourceId: inv.id, sourceType: "INVOICE" },
      include: { lines: { include: { account: true } } }
    })
    console.log(`Journals for ${inv.invoiceNumber}: ${entries.length}`)
    for (const je of entries) {
      console.log(`  JE: ${je.journalNumber} Status: ${je.status}`)
      for (const line of je.lines) {
        console.log(`    Line: ${line.account.code} ${line.account.name} DR ${line.debit} CR ${line.credit}`)
      }
    }
  }
}

main().catch(console.error).finally(() => prisma.$disconnect())
