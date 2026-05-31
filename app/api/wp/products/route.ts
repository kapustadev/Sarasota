export const dynamic = 'force-dynamic';

import { NextResponse } from 'next/server';
import { WooCommerceClient } from '@/lib/woocommerce';
import { prisma } from '@/lib/prisma';

export async function GET() {
  try {
    // 1. Fetch WooCommerce Products (Mock or Real Site)
    const wpProducts = await WooCommerceClient.getProducts();

    // 2. Fetch Local Recipes
    const localRecipes = await prisma.wpProductRecipe.findMany({});
    const recipeMap = new Map(localRecipes.map(r => [r.wpProductId, r]));

    // 3. Fetch Internal Warehouse Products to match SKU/Barcode
    const internalProducts = await prisma.product.findMany({});
    
    // Create fast lookup maps for internal products
    const skuMap = new Map(internalProducts.map(p => [p.sku.toLowerCase(), p]));
    
    const barcodeMap = new Map();
    internalProducts.forEach(p => {
      if (p.barcode) {
        barcodeMap.set(p.barcode.toLowerCase(), p);
      }
    });

    // 4. Enrich WooCommerce products with match & recipe details
    const enrichedProducts = wpProducts.map(p => {
      const recipeRecord = recipeMap.get(p.id);
      
      // Determine if there's an automatic 1-to-1 link via SKU or Barcode
      let matchedWarehouseProduct = null;
      if (p.sku) {
        matchedWarehouseProduct = skuMap.get(p.sku.toLowerCase());
      }
      if (!matchedWarehouseProduct && p.barcode) {
        matchedWarehouseProduct = barcodeMap.get(p.barcode.toLowerCase());
      }

      // Process nested variations if present
      let enrichedVariations = [];
      if (p.variations && p.variations.length > 0) {
        enrichedVariations = p.variations.map((v: any) => {
          const varRecipe = recipeMap.get(v.id);
          let matchedVarProduct = null;
          if (v.sku) {
            matchedVarProduct = skuMap.get(v.sku.toLowerCase());
          }
          if (!matchedVarProduct && v.barcode) {
            matchedVarProduct = barcodeMap.get(v.barcode.toLowerCase());
          }

          return {
            ...v,
            recipe: varRecipe ? JSON.parse(varRecipe.recipe) : [],
            isLinked: !!varRecipe || !!matchedVarProduct,
            directMatch: matchedVarProduct ? {
              id: matchedVarProduct.id,
              name: matchedVarProduct.name,
              sku: matchedVarProduct.sku,
              barcode: matchedVarProduct.barcode,
              quantity: matchedVarProduct.quantity,
              unit: matchedVarProduct.unit
            } : null
          };
        });
      }

      return {
        ...p,
        recipe: recipeRecord ? JSON.parse(recipeRecord.recipe) : [],
        supplier: recipeRecord?.supplier || null,
        isLinked: !!recipeRecord || !!matchedWarehouseProduct || (enrichedVariations.length > 0 && enrichedVariations.every((ev: any) => ev.isLinked)),
        directMatch: matchedWarehouseProduct ? {
          id: matchedWarehouseProduct.id,
          name: matchedWarehouseProduct.name,
          sku: matchedWarehouseProduct.sku,
          barcode: matchedWarehouseProduct.barcode,
          quantity: matchedWarehouseProduct.quantity,
          unit: matchedWarehouseProduct.unit
        } : null,
        variations: enrichedVariations
      };
    });

    return NextResponse.json(enrichedProducts);
  } catch (error: any) {
    console.error('Error fetching enriched WP products:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { 
      name, 
      type = 'simple',
      sku, 
      price, 
      sale_price,
      stock_quantity, 
      manage_stock = true,
      barcode, 
      description,
      short_description,
      status = 'publish',
      categories,
      imageUrl, // Simple image URL string
      attributeName,
      attributeOptions, // array of strings e.g. ["Mini", "Standard"]
      variationPrice,
      variationStock,
      recipe 
    } = body;

    // Build categories array for WooCommerce
    const mappedCategories = categories && Array.isArray(categories) 
      ? categories.map((catId: any) => ({ id: parseInt(catId) })) 
      : [];

    // Build images array
    const mappedImages = imageUrl ? [{ src: imageUrl.trim() }] : [];

    if (type === 'simple') {
      // 1. Create simple WooCommerce Product
      const newWpProd = await WooCommerceClient.createProduct({
        name,
        type: 'simple',
        sku: sku || '',
        price: price || '0.00',
        regular_price: price || '0.00',
        sale_price: sale_price || '',
        description: description || '',
        short_description: short_description || '',
        status: status,
        manage_stock: !!manage_stock,
        stock_quantity: manage_stock ? (parseInt(stock_quantity) || 0) : null,
        barcode: barcode || '',
        categories: mappedCategories as any,
        images: mappedImages
      } as any);

      // 2. Save Recipe locally if provided
      let recipeRecord = null;
      if (recipe && Array.isArray(recipe) && recipe.length > 0) {
        recipeRecord = await prisma.wpProductRecipe.create({
          data: {
            wpProductId: newWpProd.id,
            wpProductName: newWpProd.name,
            sku: newWpProd.sku,
            barcode: barcode || null,
            recipe: JSON.stringify(recipe)
          }
        });
      }

      return NextResponse.json({
        ...newWpProd,
        recipe: recipeRecord ? JSON.parse(recipeRecord.recipe) : [],
        supplier: recipeRecord?.supplier || null,
        isLinked: !!recipeRecord,
        variations: []
      });
    } else {
      // 2. Create variable parent product
      // Build WooCommerce Attributes format
      const attributesPayload = attributeName && attributeOptions && Array.isArray(attributeOptions) && attributeOptions.length > 0
        ? [
            {
              name: attributeName.trim(),
              position: 0,
              visible: true,
              variation: true,
              options: attributeOptions.map(o => o.trim())
            }
          ]
        : [];

      const newWpProd = await WooCommerceClient.createProduct({
        name,
        type: 'variable',
        sku: sku || '',
        description: description || '',
        short_description: short_description || '',
        status: status,
        manage_stock: false, // Variable parent does not manage stock directly
        stock_quantity: null,
        barcode: barcode || '',
        categories: mappedCategories as any,
        images: mappedImages,
        attributes: attributesPayload
      } as any);

      // 3. Auto-generate variation children
      const createdVariations: any[] = [];
      if (attributeName && attributeOptions && Array.isArray(attributeOptions)) {
        for (const option of attributeOptions) {
          const trimmedOption = option.trim();
          if (!trimmedOption) continue;

          // Generate variation payload
          const varPayload = {
            sku: sku ? `${sku}-${trimmedOption.toUpperCase()}` : '',
            regular_price: variationPrice || price || '0.00',
            manage_stock: true,
            stock_quantity: parseInt(variationStock) || 0,
            attributes: [
              {
                name: attributeName.trim(),
                option: trimmedOption
              }
            ]
          };

          try {
            const createdVar = await WooCommerceClient.createVariation(newWpProd.id, varPayload);
            // Format to WcProductVariation structure
            const attrString = createdVar.attributes && Array.isArray(createdVar.attributes)
              ? createdVar.attributes.map((a: any) => a.option).join(', ')
              : '';

            createdVariations.push({
              id: createdVar.id,
              parent_id: newWpProd.id,
              name: `${newWpProd.name} (${attrString || trimmedOption})`,
              sku: createdVar.sku || '',
              price: createdVar.price || '0.00',
              regular_price: createdVar.regular_price || createdVar.price || '0.00',
              sale_price: createdVar.sale_price || '',
              description: createdVar.description || '',
              manage_stock: !!createdVar.manage_stock,
              stock_quantity: createdVar.stock_quantity !== undefined ? createdVar.stock_quantity : null,
              barcode: '',
              permalink: createdVar.permalink || '',
              recipe: [],
              isLinked: false
            });
          } catch (varError) {
            console.error(`Failed to create variation for option "${trimmedOption}":`, varError);
          }
        }
      }

      return NextResponse.json({
        ...newWpProd,
        recipe: [],
        isLinked: false,
        variations: createdVariations
      });
    }
  } catch (error: any) {
    console.error('Error creating WP product:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
