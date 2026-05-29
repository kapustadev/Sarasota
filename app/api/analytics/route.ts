import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const range = searchParams.get('range') || 'month';
    const startParam = searchParams.get('start');
    const endParam = searchParams.get('end');

    // Advanced Filter Params
    const filterProduct = searchParams.get('productId') || 'ALL';
    const filterCategory = searchParams.get('category') || 'ALL';
    const filterSupplier = searchParams.get('supplier') || 'ALL';

    const now = new Date();
    let startDate = new Date();
    let endDate = new Date();

    if (startParam && endParam) {
      startDate = new Date(startParam);
      endDate = new Date(endParam);
      endDate.setHours(23, 59, 59, 999);
    } else {
      if (range === 'today') {
        startDate.setHours(0, 0, 0, 0);
      } else if (range === 'week') {
        startDate.setDate(now.getDate() - 7);
      } else if (range === 'month') {
        startDate.setMonth(now.getMonth() - 1);
      } else if (range === 'year') {
        startDate.setFullYear(now.getFullYear() - 1);
      } else {
        startDate = new Date(0); // All time
      }
    }

    // 0. Fetch Purchases to build Product-to-Supplier Mapping
    const purchases = await prisma.transaction.findMany({
      where: { type: 'PURCHASE' }
    });

    const productSupplierMap = new Map<string, string>();
    purchases.forEach(p => {
      try {
        const payload = JSON.parse(p.items);
        const supplierName = payload.supplier;
        if (payload.items && Array.isArray(payload.items)) {
          payload.items.forEach((item: any) => {
            if (item.productId) {
              productSupplierMap.set(item.productId, supplierName);
            }
          });
        }
      } catch (e) {
        // ignore json errors
      }
    });

    // 1. Fetch Sales and Write-offs Data
    // - Online sales: Transactions where type is SALE or WooCommerce order sync types
    // - Physical sales: ShowcaseItem where status is SOLD
    // - Warehouse Write-offs: Log entries where action is WRITE_OFF
    // - Showcase Defects: ShowcaseItem where status is DEFECT
    const [transactions, soldShowcase, allProducts, writeOffLogs, defectShowcase, wpLogs] = await Promise.all([
      prisma.transaction.findMany({
        where: { 
          type: { in: ['SALE', 'WP_AUTO_SYNC', 'WP_ORDER_WEBHOOK', 'WP_SALE'] }, 
          createdAt: { gte: startDate, lte: endDate } 
        }
      }),
      prisma.showcaseItem.findMany({
        where: { status: 'SOLD', updatedAt: { gte: startDate, lte: endDate } }
      }),
      prisma.product.findMany(),
      prisma.log.findMany({
        where: {
          action: { in: ['WRITE_OFF', 'WRITE_OFF_BOUQUET'] },
          createdAt: { gte: startDate, lte: endDate }
        }
      }),
      prisma.showcaseItem.findMany({
        where: { status: 'DEFECT', updatedAt: { gte: startDate, lte: endDate } }
      }),
      prisma.log.findMany({
        where: {
          action: { in: ['WP_AUTO_SYNC', 'WP_ORDER_WEBHOOK', 'WP_SALE'] },
          createdAt: { gte: startDate, lte: endDate }
        }
      })
    ]);

    const productMap = new Map();
    allProducts.forEach(p => productMap.set(p.id, p));

    let onlineRevenue = 0;
    let onlineCost = 0;
    let physicalRevenue = 0;
    let physicalCost = 0;
    
    const popularProducts: Record<string, { name: string, qty: number, revenue: number, category: string, supplier: string, stock: number, minStock: number, sku: string }> = {};

    const processOnlineSale = (itemsJson: string, price: number) => {
      try {
        const items = JSON.parse(itemsJson);
        
        // Filter items based on products / category / supplier
        const matchingItems = items.filter((item: any) => {
          const product = productMap.get(item.id);
          if (!product) return false;
          
          if (filterProduct !== 'ALL' && item.id !== filterProduct) return false;
          if (filterCategory !== 'ALL' && product.category !== filterCategory) return false;
          
          if (filterSupplier !== 'ALL') {
            const productSupplier = productSupplierMap.get(item.id) || 'Без поставщика';
            if (productSupplier !== filterSupplier) return false;
          }
          
          return true;
        });

        const isFiltered = filterProduct !== 'ALL' || filterCategory !== 'ALL' || filterSupplier !== 'ALL';

        if (isFiltered) {
          if (matchingItems.length === 0) return;
          matchingItems.forEach((item: any) => {
            const product = productMap.get(item.id);
            if (product) {
              const itemRevenue = (product.retailPrice || 0) * item.quantity;
              onlineRevenue += itemRevenue;
              onlineCost += (product.costPrice || 0) * item.quantity;
            }
          });
        } else {
          // If no filters: use actual transaction amount
          onlineRevenue += price;
          matchingItems.forEach((item: any) => {
            const product = productMap.get(item.id);
            if (product) {
              onlineCost += (product.costPrice || 0) * item.quantity;
            }
          });
        }

        // Track popular items
        matchingItems.forEach((item: any) => {
          const product = productMap.get(item.id);
          if (product) {
            if (!popularProducts[item.id]) {
              const supplierName = productSupplierMap.get(item.id) || 'Без поставщика';
              popularProducts[item.id] = { 
                name: product.name, 
                qty: 0, 
                revenue: 0, 
                category: product.category,
                supplier: supplierName,
                stock: product.quantity,
                minStock: product.minStock,
                sku: product.sku
              };
            }
            popularProducts[item.id].qty += item.quantity;
            popularProducts[item.id].revenue += (product.retailPrice || 0) * item.quantity;
          }
        });
      } catch (e) {
        console.error('Error parsing online items', e);
      }
    };

    const processPhysicalSale = (itemsJson: string, price: number) => {
      try {
        const items = JSON.parse(itemsJson);
        
        // Filter items
        const matchingItems = items.filter((item: any) => {
          const product = productMap.get(item.id);
          if (!product) return false;
          
          if (filterProduct !== 'ALL' && item.id !== filterProduct) return false;
          if (filterCategory !== 'ALL' && product.category !== filterCategory) return false;
          
          if (filterSupplier !== 'ALL') {
            const productSupplier = productSupplierMap.get(item.id) || 'Без поставщика';
            if (productSupplier !== filterSupplier) return false;
          }
          
          return true;
        });

        const isFiltered = filterProduct !== 'ALL' || filterCategory !== 'ALL' || filterSupplier !== 'ALL';

        if (isFiltered) {
          if (matchingItems.length === 0) return;
          matchingItems.forEach((item: any) => {
            const product = productMap.get(item.id);
            if (product) {
              const itemRevenue = (product.retailPrice || 0) * item.quantity;
              physicalRevenue += itemRevenue;
              physicalCost += (product.costPrice || 0) * item.quantity;
            }
          });
        } else {
          // No filters: use actual showcase price
          physicalRevenue += price;
          matchingItems.forEach((item: any) => {
            const product = productMap.get(item.id);
            if (product) {
              physicalCost += (product.costPrice || 0) * item.quantity;
            }
          });
        }

        // Track popular items
        matchingItems.forEach((item: any) => {
          const product = productMap.get(item.id);
          if (product) {
            if (!popularProducts[item.id]) {
              const supplierName = productSupplierMap.get(item.id) || 'Без поставщика';
              popularProducts[item.id] = { 
                name: product.name, 
                qty: 0, 
                revenue: 0, 
                category: product.category,
                supplier: supplierName,
                stock: product.quantity,
                minStock: product.minStock,
                sku: product.sku
              };
            }
            popularProducts[item.id].qty += item.quantity;
            popularProducts[item.id].revenue += (product.retailPrice || 0) * item.quantity;
          }
        });
      } catch (e) {
        console.error('Error parsing physical items', e);
      }
    };

    const onlineSalesDetails: any[] = [];

    transactions.forEach(t => {
      processOnlineSale(t.items, t.totalAmount);
      
      if (['WP_AUTO_SYNC', 'WP_ORDER_WEBHOOK', 'WP_SALE'].includes(t.type)) {
        const matchingLog = wpLogs.find(l => 
          Math.abs(new Date(l.createdAt).getTime() - new Date(t.createdAt).getTime()) < 10000
        );

        let orderId = null;
        let detailsText = '';
        let isFullyLinked = true;

        if (matchingLog) {
          detailsText = matchingLog.details;
          const match = detailsText.match(/#(\d+)/);
          if (match) orderId = match[1];

          if (detailsText.includes('Нет привязанных складских товаров')) {
            isFullyLinked = false;
          }
        } else {
          // Если лог не найден, но массив товаров пуст
          if (t.items === '[]') isFullyLinked = false;
        }

        onlineSalesDetails.push({
          id: t.id,
          orderId,
          date: t.createdAt,
          total: t.totalAmount,
          details: detailsText,
          isFullyLinked
        });
      }
    });

    soldShowcase.forEach(s => processPhysicalSale(s.components, s.retailPrice));

    const sortedProducts = Object.values(popularProducts)
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 15);

    // Totals calculations
    const totalRevenue = onlineRevenue + physicalRevenue;
    const totalCost = onlineCost + physicalCost;
    const totalProfit = totalRevenue - totalCost;
    const totalMargin = totalRevenue > 0 ? (totalProfit / totalRevenue) * 100 : 0;

    const onlineProfit = onlineRevenue - onlineCost;
    const onlineMargin = onlineRevenue > 0 ? (onlineProfit / onlineRevenue) * 100 : 0;

    const physicalProfit = physicalRevenue - physicalCost;
    const physicalMargin = physicalRevenue > 0 ? (physicalProfit / physicalRevenue) * 100 : 0;

    // 3. Write-off and Defects Analysis
    let writeOffCost = 0;
    let writeOffRetail = 0;
    const writeOffItemsList: any[] = [];

    const warehouseLogs = writeOffLogs.filter(l => l.action === 'WRITE_OFF');
    const bouquetLogs = writeOffLogs.filter(l => l.action === 'WRITE_OFF_BOUQUET');

    // Parse raw warehouse write-off logs
    warehouseLogs.forEach(log => {
      const skuMatch = log.details.match(/Артикул:\s*([^\)]+)/);
      const qtyMatch = log.details.match(/в количестве\s*([\d\.]+)/);
      const nameMatch = log.details.match(/Списание со склада:\s*(.*?)\s*\(/);
      const reasonMatch = log.details.match(/\. Причина:\s*(.*)$/);

      const sku = skuMatch ? skuMatch[1].trim() : '';
      const qty = qtyMatch ? parseFloat(qtyMatch[1]) : 0;
      const name = nameMatch ? nameMatch[1].trim() : 'Товар со склада';
      const parsedReason = reasonMatch ? reasonMatch[1].trim() : '';

      const product = allProducts.find(p => p.sku === sku);
      const itemCost = product ? (product.costPrice * qty) : 0;
      const itemRetail = product ? (product.retailPrice * qty) : 0;

      writeOffCost += itemCost;
      writeOffRetail += itemRetail;

      writeOffItemsList.push({
        id: log.id,
        name: product ? product.name : name,
        sku: sku || 'N/A',
        type: 'WAREHOUSE_RAW',
        quantity: qty,
        unit: product ? product.unit : 'шт',
        costPrice: product ? product.costPrice : 0,
        retailPrice: product ? product.retailPrice : 0,
        totalCost: itemCost,
        totalRetail: itemRetail,
        createdAt: log.createdAt,
        reason: parsedReason
      });
    });

    // Parse showcase decomposed defect items
    defectShowcase.forEach(item => {
      let itemCost = 0;
      try {
        const comps = JSON.parse(item.components || '[]');
        comps.forEach((c: any) => {
          const prod = allProducts.find(p => p.id === c.id);
          if (prod) {
            itemCost += prod.costPrice * (c.quantity || 0);
          }
        });
      } catch (e) {
        itemCost = item.retailPrice * 0.4;
      }

      writeOffCost += itemCost;
      writeOffRetail += item.retailPrice;

      const matchingLog = bouquetLogs.find(l => 
        l.details.includes(`Списание букета с витрины: ${item.name}`) && 
        Math.abs(new Date(l.createdAt).getTime() - new Date(item.updatedAt).getTime()) < 10000
      );
      
      let parsedReason = '';
      if (matchingLog) {
        const reasonMatch = matchingLog.details.match(/\. Причина:\s*(.*)$/);
        if (reasonMatch) parsedReason = reasonMatch[1].trim();
      }

      writeOffItemsList.push({
        id: item.id,
        name: item.name,
        sku: 'BOUQUET',
        type: 'SHOWCASE_DEFECT',
        quantity: 1,
        unit: 'букет',
        costPrice: itemCost,
        retailPrice: item.retailPrice,
        totalCost: itemCost,
        totalRetail: item.retailPrice,
        createdAt: item.updatedAt,
        reason: parsedReason
      });
    });

    // Sort by newest first
    writeOffItemsList.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

    // Filter lists for frontend
    const filterProductsList = allProducts.map(p => ({ id: p.id, name: p.name, sku: p.sku }));
    const filterSuppliersList = Array.from(new Set(Array.from(productSupplierMap.values()))).filter(Boolean);

    return NextResponse.json({
      writeOffs: {
        totalCost: writeOffCost,
        totalRetail: writeOffRetail,
        count: writeOffItemsList.length,
        items: writeOffItemsList
      },
      metrics: {
        total: {
          revenue: totalRevenue,
          cost: totalCost,
          profit: totalProfit,
          margin: totalMargin
        },
        online: {
          revenue: onlineRevenue,
          cost: onlineCost,
          profit: onlineProfit,
          margin: onlineMargin
        },
        physical: {
          revenue: physicalRevenue,
          cost: physicalCost,
          profit: physicalProfit,
          margin: physicalMargin
        }
      },
      popularProducts: sortedProducts,
      filterLists: {
        products: filterProductsList,
        suppliers: filterSuppliersList
      },
      onlineSalesDetails,
      range
    });
  } catch (error: any) {
    console.error('Error generating detailed analytics:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
