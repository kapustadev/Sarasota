import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    const fortyEightHoursAgo = new Date(Date.now() - 48 * 60 * 60 * 1000);

    // 1. Fetch products with low stock (quantity <= minStock)
    const products = await prisma.product.findMany({
      orderBy: { quantity: 'asc' }
    });

    const lowStockAlerts = products
      .filter(p => p.quantity <= p.minStock)
      .map(p => ({
        id: `low-stock-${p.id}`,
        type: 'LOW_STOCK',
        title: {
          RU: 'Мало товара на складе!',
          EN: 'Low Stock Alert!'
        },
        message: {
          RU: `Товар "${p.name}" (${p.sku}) заканчивается. Осталось: ${p.quantity} ${p.unit} (порог: ${p.minStock})`,
          EN: `Product "${p.name}" (${p.sku}) is running low. Left: ${p.quantity} ${p.unit} (threshold: ${p.minStock})`
        },
        metadata: {
          productId: p.id,
          sku: p.sku,
          quantity: p.quantity,
          minStock: p.minStock,
          category: p.category
        },
        createdAt: p.updatedAt
      }));

    // 2. Fetch transactions from last 48 hours (Sales & Purchases)
    const transactions = await prisma.transaction.findMany({
      where: {
        createdAt: { gte: fortyEightHoursAgo }
      },
      orderBy: { createdAt: 'desc' }
    });

    const transactionAlerts: any[] = [];
    
    transactions.forEach(t => {
      let parsedData: any = {};
      try {
        parsedData = JSON.parse(t.items);
      } catch (e) {
        parsedData = {};
      }

      if (t.type === 'PURCHASE') {
        const supplier = parsedData.supplier || 'Поставщик';
        const itemsCount = Array.isArray(parsedData.items) ? parsedData.items.length : 0;
        
        transactionAlerts.push({
          id: `purchase-${t.id}`,
          type: 'OPERATIONS',
          title: {
            RU: '📦 Новое поступление',
            EN: '📦 New Purchase'
          },
          message: {
            RU: `Принята поставка от "${supplier}" на сумму $${t.totalAmount.toFixed(2)} (${itemsCount} поз.)`,
            EN: `Received supply from "${supplier}" for $${t.totalAmount.toFixed(2)} (${itemsCount} items)`
          },
          metadata: {
            transactionId: t.id,
            totalAmount: t.totalAmount,
            supplier
          },
          createdAt: t.createdAt
        });
      } else if (['SALE', 'WP_AUTO_SYNC', 'WP_ORDER_WEBHOOK', 'WP_SALE'].includes(t.type)) {
        const customer = parsedData.billing ? `${parsedData.billing.first_name} ${parsedData.billing.last_name || ''}` : 'Покупатель';
        const itemsCount = Array.isArray(parsedData.line_items) 
          ? parsedData.line_items.length 
          : (Array.isArray(parsedData.items) ? parsedData.items.length : 1);

        transactionAlerts.push({
          id: `sale-${t.id}`,
          type: 'NEW_SALE',
          title: {
            RU: 'Новая продажа! 🎉',
            EN: 'New Sale! 🎉'
          },
          message: {
            RU: `Получен заказ на сумму $${t.totalAmount.toFixed(2)} (${itemsCount} поз.). ${t.type.startsWith('WP') ? 'Сайт' : 'Витрина'}`,
            EN: `Received order for $${t.totalAmount.toFixed(2)} (${itemsCount} items). ${t.type.startsWith('WP') ? 'Website' : 'Showcase'}`
          },
          metadata: {
            transactionId: t.id,
            totalAmount: t.totalAmount,
            customer,
            source: t.type.startsWith('WP') ? 'ONLINE' : 'PHYSICAL'
          },
          createdAt: t.createdAt
        });
      }
    });

    // 3. Fetch audit logs from last 48 hours (Deletions, resets, write-offs)
    const logs = await prisma.log.findMany({
      where: {
        createdAt: { gte: fortyEightHoursAgo },
        action: { in: ['DELETE_PURCHASE', 'EDIT_PURCHASE', 'WRITE_OFF', 'SYSTEM_HARD_RESET', 'ADD_SUPPLIER'] }
      },
      orderBy: { createdAt: 'desc' }
    });

    const logAlerts = logs.map(l => {
      let ruTitle = '⚙️ Действие в системе';
      let enTitle = '⚙️ System Log Event';

      if (l.action === 'DELETE_PURCHASE') {
        ruTitle = '🗑️ Закупка аннулирована';
        enTitle = '🗑️ Purchase Voided';
      } else if (l.action === 'EDIT_PURCHASE') {
        ruTitle = '✏️ Накладная изменена';
        enTitle = '✏️ Invoice Corrected';
      } else if (l.action === 'WRITE_OFF') {
        ruTitle = '⚠️ Списание товара';
        enTitle = '⚠️ Stock Write-off';
      } else if (l.action === 'SYSTEM_HARD_RESET') {
        ruTitle = '⚡ Сброс базы данных';
        enTitle = '⚡ Database Hard Reset';
      } else if (l.action === 'ADD_SUPPLIER') {
        ruTitle = '🤝 Новый поставщик';
        enTitle = '🤝 Supplier Added';
      }

      return {
        id: `log-${l.id}`,
        type: 'OPERATIONS',
        title: {
          RU: ruTitle,
          EN: enTitle
        },
        message: {
          RU: l.details,
          EN: l.details // System details logged directly
        },
        metadata: {
          logId: l.id,
          action: l.action,
          userId: l.userId
        },
        createdAt: l.createdAt
      };
    });

    // 4. Fetch bookkeeping expenses in the last 48 hours
    const expenses = await prisma.expense.findMany({
      where: {
        createdAt: { gte: fortyEightHoursAgo }
      },
      orderBy: { createdAt: 'desc' }
    });

    const expenseAlerts = expenses.map(e => ({
      id: `expense-${e.id}`,
      type: 'OPERATIONS',
      title: {
        RU: '💸 Зафиксирован расход',
        EN: '💸 Expense Logged'
      },
      message: {
        RU: `Проведен расход "${e.description}" на сумму $${e.amount.toFixed(2)} (${e.category} / ${e.channel === 'ONLINE' ? 'Онлайн' : 'Магазин'})`,
        EN: `Logged expense "${e.description}" for $${e.amount.toFixed(2)} (${e.category} / ${e.channel})`
      },
      metadata: {
        expenseId: e.id,
        amount: e.amount,
        category: e.category
      },
      createdAt: e.createdAt
    }));

    // 5. Fetch bouquet assemblies in the last 48 hours (Showcase creations)
    const showcaseItems = await prisma.showcaseItem.findMany({
      where: {
        createdAt: { gte: fortyEightHoursAgo }
      },
      orderBy: { createdAt: 'desc' }
    });

    const showcaseAlerts = showcaseItems.map(s => ({
      id: `showcase-${s.id}`,
      type: 'OPERATIONS',
      title: {
        RU: s.status === 'DEFECT' ? '🥀 Брак на витрине' : '💐 Букет выставлен',
        EN: s.status === 'DEFECT' ? '🥀 Bouquet Defect' : '💐 Bouquet Assembled'
      },
      message: {
        RU: s.status === 'DEFECT' 
          ? `Букет "${s.name}" списан в брак из-за увядания или дефекта ($${s.retailPrice.toFixed(2)})`
          : `Букет "${s.name}" собран и выставлен на витрину за $${s.retailPrice.toFixed(2)}`,
        EN: s.status === 'DEFECT' 
          ? `Showcase bouquet "${s.name}" written off as defect ($${s.retailPrice.toFixed(2)})`
          : `Showcase bouquet "${s.name}" assembled and placed for sale at $${s.retailPrice.toFixed(2)}`
      },
      metadata: {
        showcaseId: s.id,
        status: s.status,
        retailPrice: s.retailPrice
      },
      createdAt: s.createdAt
    }));

    // 6. Combine all notifications and sort by date (newest first)
    const combinedNotifications = [
      ...lowStockAlerts, 
      ...transactionAlerts, 
      ...logAlerts, 
      ...expenseAlerts,
      ...showcaseAlerts
    ].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );

    return NextResponse.json(combinedNotifications);
  } catch (error: any) {
    console.error('Error fetching notifications:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
