const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function main() {
  const items = [];
  for (let i = 1; i <= 100; i++) {
    items.push({
      productId: `test-prod-id-${i}`,
      name: `Тестовый товар ${i}`,
      sku: `TEST-${i}`,
      barcode: `100000000${i}`,
      category: i % 2 === 0 ? 'FLOWER' : 'PACKAGING',
      unit: i % 2 === 0 ? 'шт' : 'м',
      quantity: Math.floor(Math.random() * 50) + 1,
      costPrice: Number((Math.random() * 10).toFixed(2)) + 1,
      retailPrice: Number((Math.random() * 20).toFixed(2)) + 10,
    });
  }

  // Calculate total amount
  const totalAmount = items.reduce((acc, item) => acc + (item.quantity * item.costPrice), 0);

  const transactionPayload = {
    supplier: 'Тестовый поставщик 100',
    invoiceNumber: 'TEST-100-ITEMS',
    items: items
  };

  const newPurchase = await prisma.transaction.create({
    data: {
      type: 'PURCHASE',
      items: JSON.stringify(transactionPayload),
      totalAmount,
      userId: 'Директор'
    }
  });

  console.log('Successfully created test invoice. ID:', newPurchase.id);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
