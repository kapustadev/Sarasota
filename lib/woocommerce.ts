import { prisma } from './prisma';

export interface WcProductVariation {
  id: number;
  parent_id?: number;
  name: string;
  sku: string;
  price: string;
  regular_price: string;
  sale_price?: string;
  description?: string;
  manage_stock: boolean;
  stock_quantity: number | null;
  barcode?: string;
  permalink?: string;
  attributes?: Array<{ name: string; option: string }>;
  recipe?: any[]; // Local ingredients recipe
  directMatch?: any; // Local direct match
  isLinked?: boolean;
  images?: Array<{ id: number; src: string; alt?: string }>;
}

export interface WcProduct {
  id: number;
  name: string;
  type?: string; // 'simple' | 'variable' etc.
  sku: string;
  price: string;
  regular_price: string;
  sale_price?: string;
  description?: string;
  short_description?: string;
  status?: string;
  manage_stock: boolean;
  stock_quantity: number | null;
  barcode?: string;
  permalink?: string;
  categories?: Array<{ id: number; name: string; slug: string }>;
  variations?: WcProductVariation[];
  images?: Array<{ id: number; src: string; alt?: string }>;
}

const WP_URL = 'https://sarasotaflowersgifts.com/';
const CK = process.env.WP_CONSUMER_KEY || 'ck_0681c831858d16e8cbe03ed88e68bea5210f8cbe';
const CS = process.env.WP_CONSUMER_SECRET || 'cs_ce9fd3d97bf03a9d0763ba175688221cbba32cbb';

// Helper to make authenticated requests
async function wcFetch(path: string, options: RequestInit = {}) {
  // Query custom URL and credentials from database if configured
  const dbUrlConfig = await prisma.wpConfig.findUnique({ where: { key: 'wordpress_url' } });
  const dbCkConfig = await prisma.wpConfig.findUnique({ where: { key: 'wordpress_ck' } });
  const dbCsConfig = await prisma.wpConfig.findUnique({ where: { key: 'wordpress_cs' } });

  const baseUrl = dbUrlConfig ? dbUrlConfig.value : WP_URL;
  const ck = dbCkConfig ? dbCkConfig.value : CK;
  const cs = dbCsConfig ? dbCsConfig.value : CS;

  const url = `${baseUrl.replace(/\/$/, '')}/wp-json/wc/v3/${path}`;
  const authHeader = `Basic ${Buffer.from(`${ck}:${cs}`).toString('base64')}`;

  const headers = {
    'Authorization': authHeader,
    'Content-Type': 'application/json',
    ...(options.headers || {})
  };

  const response = await fetch(url, { ...options, headers });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`WooCommerce API Error (${response.status}): ${errText}`);
  }
  return response.json();
}

// Map WooCommerce metadata to barcode
function extractBarcode(wpProd: any): string {
  if (wpProd.meta_data && Array.isArray(wpProd.meta_data)) {
    const meta = wpProd.meta_data.find((m: any) => m.key === '_barcode' || m.key === 'barcode');
    if (meta) return String(meta.value);
  }
  return '';
}

// Format WooCommerce product variation to internal model
function formatWcVariation(v: any, parentName: string, parentId: number): WcProductVariation {
  const attrString = v.attributes && Array.isArray(v.attributes)
    ? v.attributes.map((a: any) => a.option).join(', ')
    : '';

  return {
    id: v.id,
    parent_id: parentId,
    name: `${parentName}${attrString ? ` (${attrString})` : ''}`,
    sku: v.sku || '',
    price: v.price || '0.00',
    regular_price: v.regular_price || v.price || '0.00',
    sale_price: v.sale_price || '',
    description: v.description || '',
    manage_stock: !!v.manage_stock,
    stock_quantity: v.stock_quantity !== undefined ? v.stock_quantity : null,
    barcode: extractBarcode(v),
    permalink: v.permalink || '',
    attributes: v.attributes && Array.isArray(v.attributes) ? v.attributes.map((a: any) => ({ name: a.name, option: a.option })) : [],
    images: v.images && Array.isArray(v.images) ? v.images.map((img: any) => ({ id: img.id, src: img.src, alt: img.alt })) : []
  };
}

// Format WooCommerce product to internal model
function formatWcProduct(p: any): WcProduct {
  return {
    id: p.id,
    name: p.name,
    type: p.type || 'simple',
    sku: p.sku || '',
    price: p.price || '0.00',
    regular_price: p.regular_price || p.price || '0.00',
    sale_price: p.sale_price || '',
    description: p.description || '',
    short_description: p.short_description || '',
    status: p.status || 'publish',
    manage_stock: !!p.manage_stock,
    stock_quantity: p.stock_quantity !== undefined ? p.stock_quantity : null,
    barcode: extractBarcode(p),
    permalink: p.permalink || '',
    categories: p.categories && Array.isArray(p.categories) ? p.categories.map((c: any) => ({ id: c.id, name: c.name, slug: c.slug })) : [],
    images: p.images && Array.isArray(p.images) ? p.images.map((img: any) => ({ id: img.id, src: img.src, alt: img.alt })) : []
  };
}

export class WooCommerceClient {
  static async getProductVariations(productId: number): Promise<any[]> {
    return wcFetch(`products/${productId}/variations?per_page=100`);
  }

  static async getProducts(): Promise<WcProduct[]> {
    const rawProducts: any[] = [];
    let page = 1;
    let keepFetching = true;

    // Fetch all products across all pages (crucial for loading 260+ products)
    while (keepFetching) {
      const data = await wcFetch(`products?per_page=100&page=${page}`);
      if (data && Array.isArray(data) && data.length > 0) {
        rawProducts.push(...data);
        if (data.length < 100) {
          keepFetching = false;
        } else {
          page++;
        }
      } else {
        keepFetching = false;
      }
    }

    const allProducts: WcProduct[] = rawProducts.map(formatWcProduct);

    // Parallel fetch variations for variable products
    await Promise.all(
      allProducts.map(async (prod) => {
        if (prod.type === 'variable') {
          try {
            const varsData = await this.getProductVariations(prod.id);
            if (Array.isArray(varsData)) {
              prod.variations = varsData.map(v => formatWcVariation(v, prod.name, prod.id));
            }
          } catch (e) {
            console.error(`Error loading variations for product ${prod.id}:`, e);
            prod.variations = [];
          }
        }
      })
    );

    return allProducts;
  }

  static async getProduct(id: number): Promise<WcProduct | null> {
    const data = await wcFetch(`products/${id}`);
    return formatWcProduct(data);
  }

  static async getCategories(): Promise<any[]> {
    const allCategories: any[] = [];
    let page = 1;
    let keepFetching = true;

    while (keepFetching) {
      const data = await wcFetch(`products/categories?per_page=100&page=${page}&orderby=id&order=asc`);
      if (data && Array.isArray(data) && data.length > 0) {
        allCategories.push(...data);
        if (data.length < 100) {
          keepFetching = false;
        } else {
          page++;
        }
      } else {
        keepFetching = false;
      }
    }

    return allCategories;
  }

  static async createCategory(data: { name: string; parent?: number }): Promise<any> {
    return wcFetch('products/categories', {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  static async deleteCategory(id: number): Promise<any> {
    return wcFetch(`products/categories/${id}?force=true`, {
      method: 'DELETE'
    });
  }

  static async updateProduct(id: number, data: Partial<WcProduct>): Promise<WcProduct> {
    const payload: any = {};

    if (data.name !== undefined) payload.name = data.name;
    if (data.sku !== undefined) payload.sku = data.sku;
    if (data.regular_price !== undefined) payload.regular_price = data.regular_price;
    if (data.sale_price !== undefined) payload.sale_price = data.sale_price;
    if (data.description !== undefined) payload.description = data.description;
    if (data.short_description !== undefined) payload.short_description = data.short_description;
    if (data.status !== undefined) payload.status = data.status;

    if (data.categories !== undefined) {
      payload.categories = data.categories.map((cat: any) => ({ id: cat.id }));
    }

    if (data.stock_quantity !== undefined) {
      payload.manage_stock = data.manage_stock !== undefined ? data.manage_stock : true;
      payload.stock_quantity = data.stock_quantity;
    } else if (data.manage_stock !== undefined) {
      payload.manage_stock = data.manage_stock;
    }

    if (data.barcode !== undefined) {
      payload.meta_data = [
        {
          key: '_barcode',
          value: data.barcode
        }
      ];
    }

    const response = await wcFetch(`products/${id}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });

    return formatWcProduct(response);
  }

  static async createProduct(data: Omit<WcProduct, 'id'> & { type?: string; attributes?: any[]; images?: any[] }): Promise<WcProduct> {
    const payload: any = {
      name: data.name,
      type: data.type || 'simple',
      sku: data.sku,
      regular_price: data.regular_price || data.price,
      sale_price: data.sale_price,
      description: data.description,
      short_description: data.short_description,
      status: data.status || 'publish',
      manage_stock: data.manage_stock !== undefined ? data.manage_stock : true,
      stock_quantity: data.stock_quantity,
    };

    if (data.categories) {
      payload.categories = data.categories.map((cat: any) => ({ id: cat.id }));
    }

    if (data.barcode) {
      payload.meta_data = [
        {
          key: '_barcode',
          value: data.barcode
        }
      ];
    }

    if (data.attributes) {
      payload.attributes = data.attributes;
    }

    if (data.images) {
      payload.images = data.images;
    }

    const response = await wcFetch('products', {
      method: 'POST',
      body: JSON.stringify(payload)
    });

    return formatWcProduct(response);
  }

  static async createVariation(parentId: number, data: any): Promise<any> {
    return wcFetch(`products/${parentId}/variations`, {
      method: 'POST',
      body: JSON.stringify(data)
    });
  }

  static async updateVariation(parentId: number, variationId: number, data: any): Promise<WcProductVariation> {
    const payload: any = {};

    if (data.sku !== undefined) payload.sku = data.sku;
    if (data.regular_price !== undefined) payload.regular_price = data.regular_price;
    if (data.sale_price !== undefined) payload.sale_price = data.sale_price;
    if (data.description !== undefined) payload.description = data.description;

    if (data.stock_quantity !== undefined) {
      payload.manage_stock = data.manage_stock !== undefined ? data.manage_stock : true;
      payload.stock_quantity = data.stock_quantity;
    } else if (data.manage_stock !== undefined) {
      payload.manage_stock = data.manage_stock;
    }

    if (data.barcode !== undefined) {
      payload.meta_data = [
        {
          key: '_barcode',
          value: data.barcode
        }
      ];
    }

    const response = await wcFetch(`products/${parentId}/variations/${variationId}`, {
      method: 'PUT',
      body: JSON.stringify(payload)
    });

    return formatWcVariation(response, '', parentId);
  }

  static async getOrders(): Promise<any[]> {
    return wcFetch('orders?status=processing,completed&per_page=50');
  }

  static async getActiveOrders(): Promise<any[]> {
    return wcFetch('orders?status=processing,pending,on-hold&per_page=50');
  }
}
