const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const products = [
    { sku: 'FL-001', name: 'Роза Красная (60см)', category: 'FLOWER', unit: 'шт', quantity: 150, costPrice: 25.0, retailPrice: 65.0, minStock: 50 },
    { sku: 'FL-002', name: 'Тюльпан Желтый', category: 'FLOWER', unit: 'шт', quantity: 80, costPrice: 15.0, retailPrice: 40.0, minStock: 30 },
    { sku: 'FL-003', name: 'Гортензия Голубая', category: 'FLOWER', unit: 'шт', quantity: 45, costPrice: 35.0, retailPrice: 95.0, minStock: 15 },
    { sku: 'FL-004', name: 'Лилия Белая', category: 'FLOWER', unit: 'шт', quantity: 60, costPrice: 22.0, retailPrice: 55.0, minStock: 20 },
    { sku: 'GF-001', name: 'Мишка Тедди (Middle)', category: 'GIFT', unit: 'шт', quantity: 25, costPrice: 85.0, retailPrice: 180.0, minStock: 5 },
    { sku: 'GF-002', name: 'Открытка "Happy Birthday"', category: 'GIFT', unit: 'шт', quantity: 100, costPrice: 2.0, retailPrice: 10.0, minStock: 20 },
    { sku: 'GF-003', name: 'Набор Воздушных Шаров', category: 'GIFT', unit: 'набор', quantity: 40, costPrice: 12.0, retailPrice: 35.0, minStock: 10 },
    { sku: 'PA-001', name: 'Упаковка Крафт (Рулон)', category: 'PACKAGING', unit: 'метр', quantity: 200, costPrice: 5.5, retailPrice: 15.0, minStock: 20 },
    { sku: 'PA-002', name: 'Коробка S (Квадрат)', category: 'PACKAGING', unit: 'шт', quantity: 50, costPrice: 8.0, retailPrice: 25.0, minStock: 10 },
    { sku: 'PA-003', name: 'Лента Атлас (Красная)', category: 'PACKAGING', unit: 'метр', quantity: 150, costPrice: 1.5, retailPrice: 8.0, minStock: 30 },
    { sku: 'PA-004', name: 'Коробка M (Розовая)', category: 'PACKAGING', unit: 'шт', quantity: 40, costPrice: 12.0, retailPrice: 35.0, minStock: 10 },
    { sku: 'PA-005', name: 'Коробка L (Черная)', category: 'PACKAGING', unit: 'шт', quantity: 30, costPrice: 15.0, retailPrice: 45.0, minStock: 5 },
    { sku: 'PA-006', name: 'Бумага Тишью (Белая)', category: 'PACKAGING', unit: 'лист', quantity: 500, costPrice: 0.5, retailPrice: 2.0, minStock: 100 },
    { sku: 'PA-007', name: 'Пленка Матовая (Лаванда)', category: 'PACKAGING', unit: 'метр', quantity: 100, costPrice: 4.0, retailPrice: 12.0, minStock: 20 },
    { sku: 'PA-008', name: 'Лента Шёлк (Бежевая)', category: 'PACKAGING', unit: 'метр', quantity: 80, costPrice: 3.5, retailPrice: 15.0, minStock: 15 },
    { sku: 'MA-001', name: 'Флористическая Губка', category: 'MATERIAL', unit: 'шт', quantity: 90, costPrice: 3.0, retailPrice: 12.0, minStock: 20 },
    { sku: 'MA-002', name: 'Проволока (Зеленая)', category: 'MATERIAL', unit: 'уп', quantity: 35, costPrice: 4.5, retailPrice: 18.0, minStock: 5 }
  ];

  for (const product of products) {
    await prisma.product.upsert({
      where: { sku: product.sku },
      update: { name: product.name },
      create: product,
    });
  }

  await Promise.all([
      prisma.user.upsert({
        where: { username: 'owner' },
        update: { password: '123' },
        create: {
          username: 'owner',
          password: '123',
          role: 'OWNER',
          name: 'Директор'
        }
      }),
      prisma.user.upsert({
        where: { username: 'accountant' },
        update: { password: '123' },
        create: {
          username: 'accountant',
          password: '123',
          role: 'ACCOUNTANT',
          name: 'Бухгалтер'
        }
      }),
      prisma.user.upsert({
        where: { username: 'worker' },
        update: { password: '123' },
        create: {
          username: 'worker',
          password: '123',
          role: 'EMPLOYEE',
          name: 'Флорист'
        }
      })
  ]);
  
  // 3. Generate Random Transactions for Analytics
  console.log('Generating dummy transactions...');
  const allProducts = await prisma.product.findMany();
  const owner = await prisma.user.findFirst({ where: { role: 'OWNER' } });
  
  for (let i = 0; i < 25; i++) {
    const date = new Date();
    date.setDate(date.getDate() - Math.floor(Math.random() * 30));
    
    // Pick 1-3 random products
    const sampleSize = Math.floor(Math.random() * 3) + 1;
    const items = [];
    let total = 0;
    
    for (let j = 0; j < sampleSize; j++) {
      const p = allProducts[Math.floor(Math.random() * allProducts.length)];
      const qty = Math.floor(Math.random() * 5) + 1;
      items.push({ id: p.id, name: p.name, quantity: qty });
      total += (p.retailPrice || 0) * qty;
    }
    
    await prisma.transaction.create({
      data: {
        type: 'SALE',
        items: JSON.stringify(items),
        totalAmount: total,
        userId: owner.id,
        createdAt: date
      }
    });
  }

  console.log('Seed completed!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
