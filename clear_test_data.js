const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function clearTestData() {
  console.log('Clearing test data from Supabase...');

  try {
    // Delete test data added for analytics, warehouse, expenses, etc.
    const logs = await prisma.log.deleteMany();
    console.log(`Deleted ${logs.count} logs.`);

    const expenses = await prisma.expense.deleteMany();
    console.log(`Deleted ${expenses.count} expenses.`);

    const showcase = await prisma.showcaseItem.deleteMany();
    console.log(`Deleted ${showcase.count} showcase items.`);

    const transactions = await prisma.transaction.deleteMany();
    console.log(`Deleted ${transactions.count} transactions.`);

    const products = await prisma.product.deleteMany();
    console.log(`Deleted ${products.count} warehouse products.`);

    const templates = await prisma.template.deleteMany();
    console.log(`Deleted ${templates.count} templates.`);

    // Keep WpProductRecipe (вкладка "Товары")
    // Keep User (Admin login)
    // Keep WpConfig (System settings & supplier profiles)

    console.log('Test data successfully removed! The "Products" tab remains untouched.');
  } catch (error) {
    console.error('Error clearing test data:', error);
  } finally {
    await prisma.$disconnect();
  }
}

clearTestData();
