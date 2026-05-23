export type Category = 'flower' | 'material' | 'packaging';

export interface Product {
  id: string;
  name: string;
  sku: string;
  category: Category;
  quantity: number;
  unit: string;
  costPrice: number;
  retailPrice: number;
  minStock: number;
}

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: '1',
    name: 'Троянда Червона (60см)',
    sku: 'FL-001',
    category: 'flower',
    quantity: 150,
    unit: 'шт',
    costPrice: 25.00,
    retailPrice: 65.00,
    minStock: 50
  },
  {
    id: '2',
    name: 'Тюльпан Жовтий',
    sku: 'FL-002',
    category: 'flower',
    quantity: 80,
    unit: 'шт',
    costPrice: 15.00,
    retailPrice: 40.00,
    minStock: 30
  },
  {
    id: '3',
    name: 'Евкаліпт',
    sku: 'FL-003',
    category: 'flower',
    quantity: 45,
    unit: 'гілка',
    costPrice: 45.00,
    retailPrice: 110.00,
    minStock: 10
  },
  {
    id: '4',
    name: 'Упаковка Крафт',
    sku: 'PA-001',
    category: 'packaging',
    quantity: 200,
    unit: 'метр',
    costPrice: 5.50,
    retailPrice: 15.00,
    minStock: 20
  },
  {
    id: '5',
    name: 'Лента Атласна (Червона)',
    sku: 'MA-001',
    category: 'material',
    quantity: 500,
    unit: 'метр',
    costPrice: 2.00,
    retailPrice: 8.00,
    minStock: 50
  }
];
