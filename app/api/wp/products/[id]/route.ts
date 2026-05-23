import { NextResponse } from 'next/server';
import { WooCommerceClient } from '@/lib/woocommerce';
import { prisma } from '@/lib/prisma';

export async function PUT(req: Request, props: { params: Promise<{ id: string }> }) {
  try {
    const params = await props.params;
    const id = parseInt(params.id);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid product ID' }, { status: 400 });
    }

    const body = await req.json();
    const { 
      name, 
      sku, 
      price, 
      regular_price, 
      sale_price, 
      stock_quantity, 
      manage_stock, 
      barcode, 
      description, 
      short_description, 
      status, 
      categories, 
      recipe 
    } = body;

    const parentId = parseInt(body.parent_id || body.parentId);

    // 1. Update WooCommerce Product or Variation Fields
    let updatedWcProd;
    if (parentId && !isNaN(parentId)) {
      updatedWcProd = await WooCommerceClient.updateVariation(parentId, id, {
        sku,
        regular_price: regular_price || price || undefined,
        sale_price,
        stock_quantity: stock_quantity !== undefined ? parseInt(stock_quantity) : undefined,
        manage_stock: manage_stock !== undefined ? !!manage_stock : undefined,
        barcode,
        description
      });
    } else {
      updatedWcProd = await WooCommerceClient.updateProduct(id, {
        name,
        sku,
        price,
        regular_price: regular_price || price,
        sale_price,
        stock_quantity: stock_quantity !== undefined ? parseInt(stock_quantity) : undefined,
        manage_stock: manage_stock !== undefined ? !!manage_stock : undefined,
        barcode,
        description,
        short_description,
        status,
        categories
      });
    }

    // 2. Upsert Recipe Locally in WpProductRecipe
    let recipeRecord = null;
    if (recipe && Array.isArray(recipe)) {
      // Check if a recipe already exists
      const existing = await prisma.wpProductRecipe.findUnique({
        where: { wpProductId: id }
      });

      if (existing) {
        recipeRecord = await prisma.wpProductRecipe.update({
          where: { wpProductId: id },
          data: {
            wpProductName: name || updatedWcProd.name,
            sku: sku !== undefined ? sku : updatedWcProd.sku,
            barcode: barcode !== undefined ? barcode : (updatedWcProd.barcode || null),
            recipe: JSON.stringify(recipe)
          }
        });
      } else if (recipe.length > 0) {
        recipeRecord = await prisma.wpProductRecipe.create({
          data: {
            wpProductId: id,
            wpProductName: name || updatedWcProd.name,
            sku: sku || updatedWcProd.sku || null,
            barcode: barcode || updatedWcProd.barcode || null,
            recipe: JSON.stringify(recipe)
          }
        });
      }
    }

    return NextResponse.json({
      ...updatedWcProd,
      recipe: recipeRecord ? JSON.parse(recipeRecord.recipe) : [],
      isLinked: !!recipeRecord || recipe?.length > 0
    });
  } catch (error: any) {
    console.error('Error updating WP product:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
