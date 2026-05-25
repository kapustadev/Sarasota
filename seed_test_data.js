const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  console.log('Seeding test data to Supabase...');

  // Clear existing data
  await prisma.log.deleteMany();
  await prisma.expense.deleteMany();
  await prisma.showcaseItem.deleteMany();
  await prisma.transaction.deleteMany();
  await prisma.product.deleteMany();

  // 1. Create a few products
  const p1 = await prisma.product.create({
    data: {
      sku: 'FL-ROSE-RED',
      name: 'Красная роза (Эквадор)',
      nameEn: 'Red Rose (Ecuador)',
      category: 'Цветы',
      unit: 'шт',
      quantity: 150,
      costPrice: 1.20,
      retailPrice: 4.50,
      supplier: 'Ecuador Farms LLC'
    }
  });

  const p2 = await prisma.product.create({
    data: {
      sku: 'FL-TULIP-MIX',
      name: 'Тюльпаны микс',
      category: 'Цветы',
      unit: 'шт',
      quantity: 300,
      costPrice: 0.80,
      retailPrice: 2.50,
      supplier: 'Dutch Flora'
    }
  });

  const p3 = await prisma.product.create({
    data: {
      sku: 'PKG-WRAP-01',
      name: 'Упаковочная бумага Крафт',
      category: 'Упаковка',
      unit: 'м',
      quantity: 50,
      costPrice: 0.50,
      retailPrice: 1.00,
      supplier: 'PackPro Ltd'
    }
  });

  // 2. Create some purchase transactions
  const txData1 = {
    supplier: 'Ecuador Farms LLC',
    invoiceNumber: 'INV-2023-001',
    status: 'DELIVERED',
    items: [
      { id: p1.id, name: 'Красная роза (Эквадор)', sku: 'FL-ROSE-RED', quantity: 150, unit: 'шт', costPrice: 1.20, retailPrice: 4.50 }
    ]
  };
  await prisma.transaction.create({
    data: {
      type: 'PURCHASE',
      items: JSON.stringify(txData1),
      totalAmount: 180, // 150 * 1.2
      userId: 'admin'
    }
  });

  const txData2 = {
    supplier: 'Dutch Flora',
    invoiceNumber: 'INV-2023-002',
    status: 'DELIVERED',
    items: [
      { id: p2.id, name: 'Тюльпаны микс', sku: 'FL-TULIP-MIX', quantity: 300, unit: 'шт', costPrice: 0.80, retailPrice: 2.50 },
      { id: p3.id, name: 'Упаковочная бумага Крафт', sku: 'PKG-WRAP-01', quantity: 50, unit: 'м', costPrice: 0.50, retailPrice: 1.00 }
    ]
  };
  await prisma.transaction.create({
    data: {
      type: 'PURCHASE',
      items: JSON.stringify(txData2),
      totalAmount: 265, // 300*0.8 + 50*0.5 = 240 + 25 = 265
      userId: 'admin'
    }
  });

  // 3. Create a Showcase Item
  await prisma.showcaseItem.create({
    data: {
      name: 'Букет "Весенний"',
      status: 'READY',
      retailPrice: 35.00,
      components: JSON.stringify([
        { id: p2.id, productId: p2.id, name: p2.name, quantity: 11, costPrice: 0.80, retailPrice: 2.50 },
        { id: p3.id, productId: p3.id, name: p3.name, quantity: 2, costPrice: 0.50, retailPrice: 1.00 }
      ])
    }
  });

  // 4. Create an Expense
  await prisma.expense.create({
    data: {
      description: 'Реклама в Instagram',
      amount: 150.00,
      category: 'Маркетинг',
      channel: 'ONLINE'
    }
  });

  // 5. Create some logs
  await prisma.log.create({
    data: {
      action: 'ADD_PRODUCT',
      details: 'Добавлен товар: Красная роза (Эквадор)',
      userId: 'admin'
    }
  });

  await prisma.log.create({
    data: {
      action: 'ADD_EXPENSE',
      details: 'Добавлен расход: Реклама в Instagram ($150.00)',
      userId: 'admin'
    }
  });

  console.log('Seeding completed successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
