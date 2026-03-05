import { chromium } from 'playwright';

const BASE_URL = 'http://localhost:3000';
const EMAIL = 'saudi@gmail.com';
const PASSWORD = 'admin123';

async function main() {
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();

  page.setDefaultTimeout(60000);
  console.log('Logging in...');
  await page.goto(`${BASE_URL}/login`, { waitUntil: 'networkidle' });
  await page.fill('input[type="email"]', EMAIL);
  await page.fill('input[type="password"]', PASSWORD);
  await page.click('button[type="submit"]');
  await page.waitForURL((url) => !url.toString().includes('/login'), { timeout: 30000 });
  console.log('Logged in!');

  async function apiPost(path: string, body: object) {
    return await page.evaluate(
      async ({ path, body }) => {
        const r = await fetch(path, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(body),
        });
        return { status: r.status, data: await r.json() };
      },
      { path, body }
    );
  }

  async function apiGet(path: string) {
    return await page.evaluate(async (path) => {
      const r = await fetch(path);
      return { status: r.status, data: await r.json() };
    }, path);
  }

  // Get unit
  const unitsRes = await apiGet('/api/units');
  let unitId: string;
  const unitsList = Array.isArray(unitsRes.data) ? unitsRes.data : [];
  if (unitsList.length > 0) {
    unitId = unitsList[0].id;
    console.log('Using unit:', unitsList[0].name);
  } else {
    const r = await apiPost('/api/units', { name: 'Piece', abbreviation: 'PC', isActive: true });
    unitId = (r.data as any).id;
    console.log('Created unit:', unitId);
  }

  // Get category
  const catsRes = await apiGet('/api/product-categories');
  let categoryId: string;
  const catsList = Array.isArray(catsRes.data) ? catsRes.data : [];
  if (catsList.length > 0) {
    categoryId = catsList[0].id;
    console.log('Using category:', catsList[0].name);
  } else {
    const r = await apiPost('/api/categories', { name: 'General' });
    categoryId = (r.data as any).id;
    console.log('Created category:', categoryId);
  }

  // Get customer
  const custsRes = await apiGet('/api/customers?limit=1');
  let customerId: string;
  const custData = custsRes.data as any;
  const custsList = Array.isArray(custData) ? custData : (custData?.customers || custData?.data || []);
  if (custsList.length > 0) {
    customerId = custsList[0].id;
    console.log('Using customer:', custsList[0].name);
  } else {
    const r = await apiPost('/api/customers', { name: 'Walk-in Customer', phone: '0000000000' });
    customerId = (r.data as any).id;
    console.log('Created customer:', customerId);
  }

  // Create 32 products
  const productNames = [
    'Apple', 'Banana', 'Cherry', 'Date', 'Elderberry',
    'Fig', 'Grape', 'Honeydew', 'Iceberry', 'Jackfruit',
    'Kiwi', 'Lemon', 'Mango', 'Nectarine', 'Orange',
    'Papaya', 'Quince', 'Raspberry', 'Strawberry', 'Tangerine',
    'Ugli Fruit', 'Vanilla Bean', 'Watermelon', 'Ximenia', 'Yuzu',
    'Zucchini', 'Artichoke', 'Beetroot', 'Carrot', 'Daikon',
    'Eggplant', 'Fennel',
  ];

  console.log(`Creating ${productNames.length} products...`);
  const productItems: { productId: string; unitPrice: number }[] = [];

  for (let i = 0; i < productNames.length; i++) {
    const name = productNames[i];
    const sku = `AUTO-${String(i + 1).padStart(3, '0')}`;
    const sellingPrice = parseFloat((Math.random() * 90 + 10).toFixed(2));
    const res = await apiPost('/api/products', {
      name,
      sku,
      categoryId,
      unitId,
      sellingPrice,
      costPrice: parseFloat((sellingPrice * 0.6).toFixed(2)),
      isActive: true,
    });
    const d = res.data as any;
    if (res.status === 200 || res.status === 201) {
      productItems.push({ productId: d.id, unitPrice: sellingPrice });
      console.log(`  [${i + 1}/${productNames.length}] ${name} - $${sellingPrice}`);
    } else {
      // Product might already exist; try to find by SKU
      console.log(`  [${i + 1}] ${name} failed (${res.status}): ${JSON.stringify(d).substring(0, 80)}`);
    }
  }

  console.log(`\nCreated ${productItems.length} products`);

  if (productItems.length < 30) {
    console.error('Need at least 30 products. Aborting.');
    await browser.close();
    return;
  }

  // Build invoice with 30 items
  const items = productItems.slice(0, 30).map(({ productId, unitPrice }) => ({
    productId,
    quantity: Math.floor(Math.random() * 5) + 1,
    unitPrice,
    discount: 0,
    taxRate: 0,
    conversionFactor: 1,
    unitId,
  }));

  console.log('\nCreating invoice with 30 items...');
  const today = new Date().toISOString().split('T')[0];
  const due = new Date(Date.now() + 30 * 86400000).toISOString().split('T')[0];

  const invoiceRes = await apiPost('/api/invoices', {
    customerId,
    invoiceDate: today,
    dueDate: due,
    status: 'draft',
    notes: 'Auto-generated 30-item invoice via headless Playwright',
    items,
  });

  if (invoiceRes.status === 200 || invoiceRes.status === 201) {
    const inv = invoiceRes.data as any;
    console.log('\n✅ Invoice created successfully!');
    console.log('   Invoice Number:', inv.invoiceNumber);
    console.log('   Invoice ID    :', inv.id);
    console.log('   Total Amount  :', inv.totalAmount);
    console.log('   Item Count    :', inv.items?.length ?? 30);
    console.log(`   View at: ${BASE_URL}/invoices/${inv.id}`);
  } else {
    console.log('\n❌ Invoice creation failed:', JSON.stringify(invoiceRes.data, null, 2));
  }

  await browser.close();
}

main().catch(console.error);
