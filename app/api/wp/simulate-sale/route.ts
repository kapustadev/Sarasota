import { NextResponse } from 'next/server';
import { WooCommerceClient } from '@/lib/woocommerce';
import { prisma } from '@/lib/prisma';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { wpProductId, quantity } = body; // { wpProductId: 101, quantity: 1 }

    const qty = parseFloat(quantity) || 1;

    // 1. Fetch WooCommerce Products tree to locate parent or nested variation
    const allWpProducts = await WooCommerceClient.getProducts();
    let wpProduct: any = null;
    let isVariation = false;
    let parentProduct: any = null;

    for (const p of allWpProducts) {
      if (p.id === wpProductId) {
        wpProduct = p;
        break;
      }
      if (p.variations && p.variations.length > 0) {
        const foundVar = p.variations.find((v: any) => v.id === wpProductId);
        if (foundVar) {
          wpProduct = foundVar;
          parentProduct = p;
          isVariation = true;
          break;
        }
      }
    }

    if (!wpProduct) {
      return NextResponse.json({ error: 'Product or Variation not found in WooCommerce' }, { status: 404 });
    }

    // 2. Fetch the recipe if it exists
    const recipeRecord = await prisma.wpProductRecipe.findUnique({
      where: { wpProductId }
    });

    const deductions: Array<{
      productId: string;
      productName: string;
      sku: string;
      unit: string;
      quantityDeducted: number;
      oldStock: number;
      newStock: number;
    }> = [];

    let saleMethod = '';

    if (recipeRecord) {
      // METHOD A: Recipe Link (Composite Bouquet)
      saleMethod = 'RECIPE';
      const ingredients = JSON.parse(recipeRecord.recipe); // [{"productId": "...", "quantity": 10}]

      // We will perform updates in a transaction
      await prisma.$transaction(async (tx) => {
        for (const ing of ingredients) {
          const warehouseProduct = await tx.product.findUnique({
            where: { id: ing.productId }
          });

          if (!warehouseProduct) continue;

          const deductionQty = ing.quantity * qty;
          const updated = await tx.product.update({
            where: { id: ing.productId },
            data: {
              quantity: {
                decrement: deductionQty
              }
            }
          });

          deductions.push({
            productId: warehouseProduct.id,
            productName: warehouseProduct.name,
            sku: warehouseProduct.sku,
            unit: warehouseProduct.unit,
            quantityDeducted: deductionQty,
            oldStock: warehouseProduct.quantity,
            newStock: updated.quantity
          });
        }

        // Record a transaction
        await tx.transaction.create({
          data: {
            type: 'WP_SALE',
            items: JSON.stringify(deductions.map(d => ({ id: d.productId, quantity: d.quantityDeducted }))),
            totalAmount: (parseFloat(wpProduct.price) || 0) * qty,
            userId: 'SYSTEM'
          }
        });

        // Record a log
        await tx.log.create({
          data: {
            action: 'WP_SALE',
            details: `Продажа через сайт: ${wpProduct.name} (x${qty}). Списаны расходники со склада: ${deductions.map(d => `${d.productName} (${d.quantityDeducted} ${d.unit})`).join(', ')}`,
            userId: 'SYSTEM'
          }
        });
      });
    } else {
      // METHOD B: Direct match 1-to-1 via SKU or Barcode
      const internalProducts = await prisma.product.findMany({});
      let matchedWarehouseProduct = null;

      if (wpProduct.sku) {
        matchedWarehouseProduct = internalProducts.find(p => p.sku.toLowerCase() === wpProduct.sku.toLowerCase());
      }
      if (!matchedWarehouseProduct && wpProduct.barcode) {
        matchedWarehouseProduct = internalProducts.find(p => p.barcode?.toLowerCase() === wpProduct.barcode?.toLowerCase());
      }

      if (matchedWarehouseProduct) {
        saleMethod = 'DIRECT_LINK';
        
        await prisma.$transaction(async (tx) => {
          const updated = await tx.product.update({
            where: { id: matchedWarehouseProduct.id },
            data: {
              quantity: {
                decrement: qty
              }
            }
          });

          deductions.push({
            productId: matchedWarehouseProduct.id,
            productName: matchedWarehouseProduct.name,
            sku: matchedWarehouseProduct.sku,
            unit: matchedWarehouseProduct.unit,
            quantityDeducted: qty,
            oldStock: matchedWarehouseProduct.quantity,
            newStock: updated.quantity
          });

          // Record a transaction
          await tx.transaction.create({
            data: {
              type: 'WP_SALE',
              items: JSON.stringify([{ id: matchedWarehouseProduct.id, quantity: qty }]),
              totalAmount: (parseFloat(wpProduct.price) || 0) * qty,
              userId: 'SYSTEM'
            }
          });

          // Record a log
          await tx.log.create({
            data: {
              action: 'WP_SALE',
              details: `Продажа через сайт (1-к-1): ${wpProduct.name} (x${qty}). Остаток товара ${matchedWarehouseProduct.name} уменьшен на ${qty} ${matchedWarehouseProduct.unit}.`,
              userId: 'SYSTEM'
            }
          });
        });
      } else {
        return NextResponse.json({
          error: 'Этот товар не связан со складским рецептом и не имеет прямого соответствия по SKU/штрихкоду.',
          success: false
        }, { status: 400 });
      }
    }

    // 3. Update stock quantity in WooCommerce
    let newWcStock = wpProduct.stock_quantity;
    if (wpProduct.manage_stock && wpProduct.stock_quantity !== null) {
      newWcStock = Math.max(0, wpProduct.stock_quantity - qty);
      await WooCommerceClient.updateProduct(wpProductId, {
        stock_quantity: newWcStock
      });
    }

    return NextResponse.json({
      success: true,
      product: {
        id: wpProduct.id,
        name: wpProduct.name,
        sku: wpProduct.sku,
        oldStock: wpProduct.stock_quantity,
        newStock: newWcStock
      },
      saleMethod,
      deductions
    });
  } catch (error: any) {
    console.error('Error simulating WP sale:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
