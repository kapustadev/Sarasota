import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export interface SupplierProfile {
  id: string;
  name: string;
  country: string;
  legalAddress: string;
  taxId: string;
  phone: string;
  email: string;
  notes: string;
}

const DEFAULT_SUPPLIERS: SupplierProfile[] = [
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

export async function GET() {
  try {
    const config = await prisma.wpConfig.findUnique({
      where: { key: 'suppliers_profiles' }
    });

    let suppliers: SupplierProfile[] = [];
    if (config) {
      try {
        suppliers = JSON.parse(config.value);
      } catch (e) {
        suppliers = [];
      }
    } else {
      // First time initialization, save defaults to db
      suppliers = DEFAULT_SUPPLIERS;
      await prisma.wpConfig.create({
        data: {
          key: 'suppliers_profiles',
          value: JSON.stringify(suppliers)
        }
      });
    }

    // 2. Fetch suppliers from previous purchases to auto-import legacy supplier names if any
    const transactions = await prisma.transaction.findMany({
      where: { type: 'PURCHASE' }
    });

    const historicalNames = transactions.map(t => {
      try {
        const parsed = JSON.parse(t.items);
        return parsed.supplier?.trim();
      } catch (e) {
        return null;
      }
    }).filter((s): s is string => !!s);

    const uniqueHistoricalNames = Array.from(new Set(historicalNames));

    // For any historical supplier not in the profiles, auto-generate a profile stub
    let updatedNeeded = false;
    uniqueHistoricalNames.forEach(name => {
      if (!suppliers.some(s => s.name.toLowerCase() === name.toLowerCase())) {
        suppliers.push({
          id: Math.random().toString(36).substr(2, 9),
          name,
          country: 'Неизвестно',
          legalAddress: 'Не указан',
          taxId: 'Не указан',
          phone: '',
          email: '',
          notes: 'Авто-импортирован из истории накладных'
        });
        updatedNeeded = true;
      }
    });

    if (updatedNeeded) {
      await prisma.wpConfig.update({
        where: { key: 'suppliers_profiles' },
        data: { value: JSON.stringify(suppliers) }
      });
    }

    suppliers.sort((a, b) => a.name.localeCompare(b.name));

    return NextResponse.json(suppliers);
  } catch (error: any) {
    console.error('Error fetching suppliers profiles:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, country, legalAddress, taxId, phone, email, notes, userId } = body;

    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Название поставщика обязательно' }, { status: 400 });
    }

    const trimmedName = name.trim();

    // Fetch existing registered profiles
    const config = await prisma.wpConfig.findUnique({
      where: { key: 'suppliers_profiles' }
    });

    let suppliers: SupplierProfile[] = [];
    if (config) {
      try {
        suppliers = JSON.parse(config.value);
      } catch (e) {
        suppliers = [];
      }
    } else {
      suppliers = DEFAULT_SUPPLIERS;
    }

    // Add if not already present
    if (suppliers.some(s => s.name.toLowerCase() === trimmedName.toLowerCase())) {
      return NextResponse.json({ error: 'Поставщик с таким названием уже существует' }, { status: 400 });
    }

    const newProfile: SupplierProfile = {
      id: Math.random().toString(36).substr(2, 9),
      name: trimmedName,
      country: country?.trim() || 'США',
      legalAddress: legalAddress?.trim() || 'Не указан',
      taxId: taxId?.trim() || 'Не указан',
      phone: phone?.trim() || '',
      email: email?.trim() || '',
      notes: notes?.trim() || ''
    };

    suppliers.push(newProfile);

    // Save back to db
    await prisma.wpConfig.upsert({
      where: { key: 'suppliers_profiles' },
      update: { value: JSON.stringify(suppliers) },
      create: { key: 'suppliers_profiles', value: JSON.stringify(suppliers) }
    });

    // Log the event
    await prisma.log.create({
      data: {
        action: 'ADD_SUPPLIER',
        details: `Зарегистрирован новый поставщик: "${trimmedName}" (${newProfile.country}, Код: ${newProfile.taxId})`,
        userId: userId || 'SYSTEM'
      }
    });

    return NextResponse.json({ success: true, suppliers });
  } catch (error: any) {
    console.error('Error adding supplier profile:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { id, name, country, legalAddress, taxId, phone, email, notes, userId } = body;

    if (!id) {
      return NextResponse.json({ error: 'ID поставщика обязателен' }, { status: 400 });
    }
    if (!name || !name.trim()) {
      return NextResponse.json({ error: 'Название поставщика обязательно' }, { status: 400 });
    }

    const config = await prisma.wpConfig.findUnique({
      where: { key: 'suppliers_profiles' }
    });

    if (!config) {
      return NextResponse.json({ error: 'Поставщики не найдены' }, { status: 404 });
    }

    let suppliers: SupplierProfile[] = JSON.parse(config.value);
    const index = suppliers.findIndex(s => s.id === id);

    if (index === -1) {
      return NextResponse.json({ error: 'Поставщик не найден' }, { status: 404 });
    }

    // Update fields
    suppliers[index] = {
      id,
      name: name.trim(),
      country: country?.trim() || 'США',
      legalAddress: legalAddress?.trim() || 'Не указан',
      taxId: taxId?.trim() || 'Не указан',
      phone: phone?.trim() || '',
      email: email?.trim() || '',
      notes: notes?.trim() || ''
    };

    await prisma.wpConfig.update({
      where: { key: 'suppliers_profiles' },
      data: { value: JSON.stringify(suppliers) }
    });

    await prisma.log.create({
      data: {
        action: 'EDIT_SUPPLIER',
        details: `Отредактирован поставщик: "${name}" (${country})`,
        userId: userId || 'SYSTEM'
      }
    });

    return NextResponse.json({ success: true, suppliers });
  } catch (error: any) {
    console.error('Error updating supplier profile:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const userId = searchParams.get('userId') || 'SYSTEM';

    if (!id) {
      return NextResponse.json({ error: 'ID поставщика обязателен' }, { status: 400 });
    }

    const config = await prisma.wpConfig.findUnique({
      where: { key: 'suppliers_profiles' }
    });

    if (!config) {
      return NextResponse.json({ error: 'Поставщики не найдены' }, { status: 404 });
    }

    let suppliers: SupplierProfile[] = JSON.parse(config.value);
    const supplierToDelete = suppliers.find(s => s.id === id);

    if (!supplierToDelete) {
      return NextResponse.json({ error: 'Поставщик не найден' }, { status: 404 });
    }

    // Remove from array
    suppliers = suppliers.filter(s => s.id !== id);

    await prisma.wpConfig.update({
      where: { key: 'suppliers_profiles' },
      data: { value: JSON.stringify(suppliers) }
    });

    await prisma.log.create({
      data: {
        action: 'DELETE_SUPPLIER',
        details: `Удален поставщик: "${supplierToDelete.name}" (${supplierToDelete.country})`,
        userId
      }
    });

    return NextResponse.json({ success: true, suppliers });
  } catch (error: any) {
    console.error('Error deleting supplier profile:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
