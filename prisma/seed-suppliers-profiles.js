const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DEFAULT_SUPPLIERS = [
  {
    id: '1',
    name: 'Florist Hub LLC',
    country: 'США',
    legalAddress: '1200 Brickell Ave, Suite 450, Miami, FL 33131',
    taxId: 'EIN-45-9876543',
    phone: '+1 (305) 555-0144',
    email: 'orders@floristhub.com',
    notes: 'Главный дистрибьютор свежих цветов в США'
  },
  {
    id: '2',
    name: 'Эквадор Фарм',
    country: 'Эквадор',
    legalAddress: 'Floricola La Rinconada, Cayambe 170202',
    taxId: 'RUC-1791234567001',
    phone: '+593 2 236-0150',
    email: 'info@ecuadorfarm.ec',
    notes: 'Прямые поставки премиальных роз высокогорного выращивания'
  },
  {
    id: '3',
    name: 'Квіти України ТОВ',
    country: 'Украина',
    legalAddress: 'ул. Крещатик, 15, Киев, 01001',
    taxId: 'ЕГРПОУ-38472910',
    phone: '+380 (44) 222-3344',
    email: 'contact@flowers-ukraine.ua',
    notes: 'Поставщик отечественной сезонной зелени и декоративных растений'
  }
];

async function main() {
  console.log('Seeding rich supplier profiles in WpConfig...');

  await prisma.wpConfig.upsert({
    where: { key: 'suppliers_profiles' },
    update: { value: JSON.stringify(DEFAULT_SUPPLIERS) },
    create: { key: 'suppliers_profiles', value: JSON.stringify(DEFAULT_SUPPLIERS) }
  });

  console.log('Successfully seeded rich supplier profiles in WpConfig table.');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
