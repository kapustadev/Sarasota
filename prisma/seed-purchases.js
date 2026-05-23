const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding suppliers and purchase transactions...');

  // 1. Seed suppliers list in WpConfig
  const suppliers = [
    'Holland Flowers BV',
    'Florist Hub LLC',
    'Эквадор Фарм',
    'Цветы Эквадора',
    'Голландский Цветочный Альянс',
    'Игрушечный Рай LLC'
  ];

  await prisma.wpConfig.upsert({
    where: { key: 'suppliers' },
    update: { value: JSON.stringify(suppliers) },
    create: { key: 'suppliers', value: JSON.stringify(suppliers) }
  });
  console.log('Suppliers config successfully seeded.');

  // 2. Fetch existing products to map IDs
  const dbProducts = await prisma.product.findMany();
  const redRose = dbProducts.find(p => p.sku === 'FL-001') || { id: 'temp-rose', name: 'Роза Красная (60см)', sku: 'FL-001', category: 'FLOWER', unit: 'шт', costPrice: 25.0, retailPrice: 65.0 };
  const whiteLily = dbProducts.find(p => p.sku === 'FL-004') || { id: 'temp-lily', name: 'Лилия Белая', sku: 'FL-004', category: 'FLOWER', unit: 'шт', costPrice: 22.0, retailPrice: 55.0 };
  const kraftRoll = dbProducts.find(p => p.sku === 'PA-001') || { id: 'temp-kraft', name: 'Упаковка Крафт (Рулон)', sku: 'PA-001', category: 'PACKAGING', unit: 'метр', costPrice: 5.5, retailPrice: 15.0 };

  // 3. Create purchase 1 (This Month - Today)
  const today = new Date();
  const purchase1Payload = {
    supplier: 'Holland Flowers BV',
    invoiceNumber: 'INV-2026-001',
    items: [
      {
        productId: redRose.id,
        name: redRose.name,
        sku: redRose.sku,
        barcode: '4820012345678',
        category: 'FLOWER',
        unit: 'шт',
        quantity: 120,
        costPrice: 25.0,
        retailPrice: 65.0
      },
      {
        productId: kraftRoll.id,
        name: kraftRoll.name,
        sku: kraftRoll.sku,
        barcode: '4820098765432',
        category: 'PACKAGING',
        unit: 'метр',
        quantity: 15,
        costPrice: 5.5,
        retailPrice: 15.0
      }
    ]
  };

  const totalAmount1 = (120 * 25.0) + (15 * 5.5); // $3082.50

  // Delete existing test purchases to prevent cluttering
  await prisma.transaction.deleteMany({
    where: { type: 'PURCHASE' }
  });

  const p1 = await prisma.transaction.create({
    data: {
      type: 'PURCHASE',
      items: JSON.stringify(purchase1Payload),
      totalAmount: totalAmount1,
      userId: 'Директор',
      createdAt: today
    }
  });

  // Create Log 1
  await prisma.log.create({
    data: {
      action: 'PURCHASE',
      details: `Закупка у поставщика "Holland Flowers BV" (Накладная: INV-2026-001) на сумму $${totalAmount1.toFixed(2)}. Принято 2 поз.`,
      userId: 'Директор',
      createdAt: today
    }
  });

  // 4. Create purchase 2 (Last Month)
  const lastMonthDate = new Date();
  lastMonthDate.setMonth(lastMonthDate.getMonth() - 1);
  if (lastMonthDate.getMonth() === today.getMonth()) {
    // Handle overflow edge case
    lastMonthDate.setDate(0);
  }

  const purchase2Payload = {
    supplier: 'Эквадор Фарм',
    invoiceNumber: 'INV-2026-098',
    items: [
      {
        productId: whiteLily.id,
        name: whiteLily.name,
        sku: whiteLily.sku,
        barcode: '4820011122233',
        category: 'FLOWER',
        unit: 'шт',
        quantity: 80,
        costPrice: 22.0,
        retailPrice: 55.0
      },
      {
        name: 'Плюшевый Медвежонок (Тест)',
        sku: 'GF-TEST-TEDDY',
        barcode: '4820033344455',
        category: 'GIFT',
        unit: 'шт',
        quantity: 25,
        costPrice: 40.0,
        retailPrice: 90.0
      }
    ]
  };

  const totalAmount2 = (80 * 22.0) + (25 * 40.0); // $2760.00

  const p2 = await prisma.transaction.create({
    data: {
      type: 'PURCHASE',
      items: JSON.stringify(purchase2Payload),
      totalAmount: totalAmount2,
      userId: 'Бухгалтер',
      createdAt: lastMonthDate
    }
  });

  // Create Log 2
  await prisma.log.create({
    data: {
      action: 'PURCHASE',
      details: `Закупка у поставщика "Эквадор Фарм" (Накладная: INV-2026-098) на сумму $${totalAmount2.toFixed(2)}. Принято 2 поз.`,
      userId: 'Бухгалтер',
      createdAt: lastMonthDate
    }
  });

  console.log('Seeded 2 rich purchase transactions successfully.');
  console.log('- Invoice 1 (Today): Holland Flowers BV, Total: $' + totalAmount1);
  console.log('- Invoice 2 (Last Month): Эквадор Фарм, Total: $' + totalAmount2);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
