'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../components/LanguageContext';
import { useAuth } from '../components/AuthProvider';

export default function WpProductsPage() {
  const [mounted, setMounted] = useState(false);
  
  useEffect(() => {
    setMounted(true);
  }, []);

  const [products, setProducts] = useState<any[]>([]); // Internal warehouse products
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [wpProducts, setWpProducts] = useState<any[]>([]); // WordPress products
  const [categories, setCategories] = useState<any[]>([]); // WordPress categories
  const [wpLoading, setWpLoading] = useState(true);
  const [wpSearchQuery, setWpSearchQuery] = useState('');
  const [wpFilterCategory, setWpFilterCategory] = useState('ALL');
  const [connectionError, setConnectionError] = useState<string | null>(null);

  // WooCommerce Edit Modal State (WooCommerce Fields)
  const [isWpModalOpen, setIsWpModalOpen] = useState(false);
  
  // Recipe Modal State (Warehouse Binding)
  const [isRecipeModalOpen, setIsRecipeModalOpen] = useState(false);
  
  const [editingWpProduct, setEditingWpProduct] = useState<any | null>(null);
  
  // Local states for variable variations editing inside the modal
  const [savingVariationId, setSavingVariationId] = useState<number | null>(null);
  const [expandedVariationId, setExpandedVariationId] = useState<number | null>(null);
  const [selectedVariationId, setSelectedVariationId] = useState<number | null>(null);

  const [wpFormData, setWpFormData] = useState({
    id: 0,
    parentId: 0,
    name: '',
    sku: '',
    price: '',
    regular_price: '',
    sale_price: '',
    manage_stock: true,
    stock_quantity: 0,
    barcode: '',
    description: '',
    short_description: '',
    status: 'publish',
    categories: [] as Array<{ id: number; name: string }>,
    recipe: [] as Array<{ productId: string; quantity: number }>,
    supplier: ''
  });

  // Creation State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [createLoading, setCreateLoading] = useState(false);
  const [createFormData, setCreateFormData] = useState({
    name: '',
    type: 'simple', // 'simple' | 'variable'
    sku: '',
    price: '',
    sale_price: '',
    stock_quantity: 0,
    manage_stock: true,
    barcode: '',
    description: '',
    short_description: '',
    status: 'publish',
    categories: [] as number[],
    imageUrl: '',
    attributeName: 'Размер',
    attributeOptions: 'Mini, Standard, Premium',
    variationPrice: '',
    variationStock: '0'
  });

  // WooCommerce Categories Modal State
  const [isCategoriesModalOpen, setIsCategoriesModalOpen] = useState(false);
  const [newCategoryName, setNewCategoryName] = useState('');
  const [newCategoryParent, setNewCategoryParent] = useState<string>('');
  const [isSavingCategory, setIsSavingCategory] = useState(false);

  const { t } = useLanguage();
  const { user } = useAuth();
  const userRole = user?.role || 'EMPLOYEE';

  // Fetch internal warehouse products for recipe selector
  const fetchWarehouseProducts = async () => {
    try {
      const res = await fetch('/api/products');
      if (res.ok) {
        const data = await res.json();
        setProducts(data);
      }
    } catch (e) {
      console.error(e);
    }
  };

  const fetchSuppliers = async () => {
    try {
      const res = await fetch('/api/suppliers');
      if (res.ok) {
        const data = await res.json();
        setSuppliers(data);
      }
    } catch (e) {
      console.error(e);
    }
  };


  // Fetch WooCommerce products from secure proxy
  const fetchWpProducts = async () => {
    setWpLoading(true);
    setConnectionError(null);
    try {
      const res = await fetch('/api/wp/products');
      if (res.ok) {
        const data = await res.json();
        if (data.error) {
          setConnectionError(data.error);
          setWpProducts([]);
        } else {
          setWpProducts(data);
        }
      } else {
        const err = await res.json();
        setConnectionError(err.error || 'Не удалось связаться с WooCommerce API');
        setWpProducts([]);
      }
    } catch (e) {
      setConnectionError('Сетевая ошибка при запросе товаров WooCommerce');
      setWpProducts([]);
    } finally {
      setWpLoading(false);
    }
  };

  const handlePrintBarcode = (wpProd: any) => {
    if (!wpProd.sku) {
      alert('У этого товара нет штрихкода/артикула для печати!');
      return;
    }
    const qtyStr = prompt(`Сколько этикеток напечатать для "${wpProd.name}"?`, '2');
    if (qtyStr === null) return;
    const copies = parseInt(qtyStr) || 1;
    if (copies <= 0) return;

    let iframe = document.getElementById('barcode-print-iframe') as HTMLIFrameElement;
    if (iframe) {
      document.body.removeChild(iframe);
    }

    iframe = document.createElement('iframe');
    iframe.id = 'barcode-print-iframe';
    iframe.style.position = 'absolute';
    iframe.style.width = '0px';
    iframe.style.height = '0px';
    iframe.style.border = 'none';
    document.body.appendChild(iframe);

    const doc = iframe.contentWindow?.document || iframe.contentDocument;
    if (doc) {
      let labelsHtml = '';
      const price = wpProd.sale_price || wpProd.regular_price || wpProd.price || 0;
      for (let i = 0; i < copies; i++) {
        labelsHtml += `
          <div class="label-page">
            <div class="product-name">Name: ${wpProd.name}</div>
            <div class="product-price-supplier">
              <span class="product-price">Price: $${parseFloat(price.toString()).toFixed(2)}</span>
              ${wpProd.supplier ? `<span class="supplier">Supplier: ${wpProd.supplier}</span>` : ''}
            </div>
            <div class="barcode-img"></div>
            <div class="barcode-number">${wpProd.sku}</div>
          </div>
        `;
      }

      doc.write(`
        <html>
          <head>
            <title>Печать штрихкодов</title>
            <style>
              @page {
                size: 2.25in 1.25in;
                margin: 0;
              }
              html, body {
                margin: 0;
                padding: 0;
                background: #fff;
              }
              body {
                width: 2.25in;
              }
              .label-page {
                width: 2.25in;
                height: 1.25in;
                box-sizing: border-box;
                display: flex;
                flex-direction: column;
                justify-content: center;
                align-items: center;
                padding: 6px;
                overflow: hidden;
                page-break-after: always;
                text-align: center;
              }
              .label-page:last-child {
                page-break-after: avoid;
              }
              .product-name {
                font-family: Arial, sans-serif;
                font-size: 10px;
                font-weight: bold;
                margin-bottom: 2px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                width: 100%;
                color: #000;
              }
              .product-price-supplier {
                display: flex;
                flex-direction: column;
                align-items: center;
                justify-content: center;
                width: 100%;
                font-family: Arial, sans-serif;
                font-size: 9px;
                margin-bottom: 3px;
                color: #000;
              }
              .product-price {
                font-weight: bold;
                font-size: 11px;
                margin-bottom: 2px;
              }
              .supplier {
                font-style: italic;
                font-size: 8px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                max-width: 60%;
              }
              .barcode-img {
                width: 150px;
                height: 32px;
                background: repeating-linear-gradient(90deg, #000, #000 2px, #fff 2px, #fff 4px, #000 4px, #000 5px, #fff 5px, #fff 8px);
                margin-bottom: 4px;
              }
              .barcode-number {
                font-family: monospace;
                font-size: 9px;
                font-weight: bold;
                letter-spacing: 1.5px;
                color: #000;
              }
            </style>
          </head>
          <body>
            ${labelsHtml}
            <script>
              window.focus();
              window.print();
            </script>
          </body>
        </html>
      `);
      doc.close();
    }
  };


  // Sync / Deduct outstanding WooCommerce orders
  const syncWpOrders = async (silent = false) => {
    try {
      const res = await fetch('/api/wp/sync-orders', { method: 'POST' });
      if (res.ok) {
        const data = await res.json();
        if (data.processed && data.processed.length > 0) {
          alert(`[Авто-Синхронизация] Обнаружены и списаны новые заказы с сайта:\n${data.processed.map((o: any) => `Заказ #${o.orderId} на сумму $${o.total.toFixed(2)}`).join('\n')}`);
          fetchWarehouseProducts();
        }
      }
    } catch (e) {
      console.error('Order sync error:', e);
    }
  };

  const fetchCategories = async () => {
    try {
      const res = await fetch('/api/wp/categories');
      if (res.ok) {
        const data = await res.json();
        setCategories(data);
      }
    } catch (e) {
      console.error('Error fetching categories:', e);
    }
  };

  const openCategoriesModal = () => {
    setIsCategoriesModalOpen(true);
    setNewCategoryName('');
    setNewCategoryParent('');
  };

  const handleCreateCategory = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newCategoryName.trim()) return;
    setIsSavingCategory(true);
    try {
      const res = await fetch('/api/wp/categories', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: newCategoryName.trim(),
          parent: newCategoryParent ? parseInt(newCategoryParent, 10) : 0
        })
      });
      if (res.ok) {
        setNewCategoryName('');
        setNewCategoryParent('');
        // Refresh categories
        fetchCategories();
      } else {
        const err = await res.json();
        alert(`Ошибка при создании категории: ${err.error || 'Неизвестная ошибка'}`);
      }
    } catch (e) {
      console.error(e);
      alert('Сетевая ошибка при создании категории');
    } finally {
      setIsSavingCategory(false);
    }
  };

  const handleDeleteCategory = async (id: number, name: string) => {
    if (!confirm(`Вы уверены, что хотите ПОЛНОСТЬЮ удалить категорию "${name}" с сайта? Это действие нельзя отменить!`)) return;
    try {
      const res = await fetch(`/api/wp/categories/${id}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchCategories();
      } else {
        const err = await res.json();
        alert(`Ошибка при удалении категории: ${err.error || 'Неизвестная ошибка'}`);
      }
    } catch (e) {
      console.error(e);
      alert('Сетевая ошибка при удалении категории');
    }
  };

  useEffect(() => {
    fetchWarehouseProducts();
    fetchSuppliers();
    fetchWpProducts();
    fetchCategories();
  }, []);

  // Poll for background orders every 5 minutes
  useEffect(() => {
    const interval = setInterval(() => {
      syncWpOrders(true);
      // Keep product listings in sync with stock changes
      fetchWpProducts();
    }, 300000);

    return () => clearInterval(interval);
  }, []);

  // Simulate warehouse deduction
  const handleSimulateSale = async (wpProductId: number) => {
    try {
      const res = await fetch('/api/wp/simulate-sale', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ wpProductId, quantity: 1 })
      });
      if (res.ok) {
        const result = await res.json();
        alert(`Списание успешно!\nСпособ: ${result.saleMethod === 'RECIPE' ? 'Списание расходников со склада' : 'Прямая связь 1-к-1'}.\nСписано: ${result.deductions.map((d: any) => `${d.productName} (${d.quantityDeducted} ${d.unit})`).join(', ')}`);
        
        fetchWarehouseProducts();
        fetchWpProducts();
      } else {
        const err = await res.json();
        alert(`Ошибка списания: ${err.error}`);
      }
    } catch (e) {
      console.error(e);
      alert('Сетевая ошибка при симуляции');
    }
  };

  // Variation local update helper
  const handleUpdateLocalVariationField = (varId: number, field: string, value: any) => {
    setEditingWpProduct((prev: any) => {
      if (!prev) return prev;
      return {
        ...prev,
        variations: prev.variations.map((v: any) => 
          v.id === varId ? { ...v, [field]: value } : v
        )
      };
    });
  };

  // Variation API save helper
  const handleSaveVariation = async (variationId: number, variationData: any) => {
    setSavingVariationId(variationId);
    try {
      const res = await fetch(`/api/wp/products/${variationId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...variationData,
          parentId: editingWpProduct.id
        })
      });
      if (res.ok) {
        const updatedVar = await res.json();
        
        // Update in the main list of products
        setWpProducts(prevProducts => prevProducts.map(p => {
          if (p.id === editingWpProduct.id) {
            return {
              ...p,
              variations: p.variations?.map((v: any) => v.id === variationId ? { ...v, ...updatedVar } : v) || []
            };
          }
          return p;
        }));

        // Also update local modal state
        setEditingWpProduct((prev: any) => {
          if (!prev) return prev;
          return {
            ...prev,
            variations: prev.variations?.map((v: any) => v.id === variationId ? { ...v, ...updatedVar } : v) || []
          };
        });

        alert('Вариация успешно сохранена!');
      } else {
        alert('Ошибка при сохранении вариации');
      }
    } catch (e) {
      console.error(e);
      alert('Сетевая ошибка при сохранении вариации');
    } finally {
      setSavingVariationId(null);
    }
  };

  // Edit modal handlers
  const openEditWpModal = (wpProd: any) => {
    setEditingWpProduct(wpProd);
    setExpandedVariationId(null);
    setWpFormData({
      id: wpProd.id,
      parentId: wpProd.parent_id || wpProd.parentId || 0,
      name: wpProd.name,
      sku: wpProd.sku || '',
      price: wpProd.price || '',
      regular_price: wpProd.regular_price || wpProd.price || '',
      sale_price: wpProd.sale_price || '',
      manage_stock: wpProd.manage_stock ?? true,
      stock_quantity: wpProd.stock_quantity || 0,
      barcode: wpProd.barcode || '',
      description: wpProd.description || '',
      short_description: wpProd.short_description || '',
      status: wpProd.status || 'publish',
      categories: wpProd.categories || [],
      recipe: wpProd.recipe || [],
      supplier: wpProd.supplier || ''
    });
    setIsWpModalOpen(true);
  };

  const openRecipeModal = (wpProd: any) => {
    setEditingWpProduct(wpProd);
    if (wpProd.type === 'variable' && wpProd.variations && wpProd.variations.length > 0) {
      const firstVar = wpProd.variations[0];
      setSelectedVariationId(firstVar.id);
      setWpFormData({
        id: firstVar.id,
        parentId: wpProd.id,
        name: firstVar.name,
        sku: firstVar.sku || '',
        price: firstVar.price || '',
        regular_price: firstVar.regular_price || firstVar.price || '',
        sale_price: firstVar.sale_price || '',
        manage_stock: firstVar.manage_stock ?? true,
        stock_quantity: firstVar.stock_quantity || 0,
        barcode: firstVar.barcode || '',
        description: firstVar.description || '',
        short_description: firstVar.short_description || '',
        status: firstVar.status || 'publish',
        categories: firstVar.categories || [],
        recipe: firstVar.recipe || [],
        supplier: firstVar.supplier || ''
      });
    } else {
      setSelectedVariationId(null);
      setWpFormData({
        id: wpProd.id,
        parentId: wpProd.parent_id || wpProd.parentId || 0,
        name: wpProd.name,
        sku: wpProd.sku || '',
        price: wpProd.price || '',
        regular_price: wpProd.regular_price || wpProd.price || '',
        sale_price: wpProd.sale_price || '',
        manage_stock: wpProd.manage_stock ?? true,
        stock_quantity: wpProd.stock_quantity || 0,
        barcode: wpProd.barcode || '',
        description: wpProd.description || '',
        short_description: wpProd.short_description || '',
        status: wpProd.status || 'publish',
        categories: wpProd.categories || [],
        recipe: wpProd.recipe || [],
        supplier: wpProd.supplier || ''
      });
    }
    setIsRecipeModalOpen(true);
  };

  const saveWpProduct = async (type: 'fields' | 'recipe') => {
    try {
      const payload = {
        ...wpFormData,
        updateLocalOnly: type === 'recipe'
      };

      const res = await fetch(`/api/wp/products/${wpFormData.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
      if (res.ok) {
        const updated = await res.json();
        
        // Dynamically update either simple product or a nested variation in state
        setWpProducts(wpProducts.map(p => {
          if (p.id === updated.parent_id || p.id === updated.parentId) {
            return {
              ...p,
              variations: p.variations?.map((v: any) => v.id === updated.id ? { ...v, ...updated } : v) || []
            };
          }
          if (p.id === updated.id) {
            return { ...p, ...updated };
          }
          return p;
        }));

        setEditingWpProduct((prev: any) => {
          if (!prev) return prev;
          if (prev.id === updated.parent_id || prev.id === updated.parentId) {
            return {
              ...prev,
              variations: prev.variations?.map((v: any) => v.id === updated.id ? { ...v, ...updated } : v) || []
            };
          }
          return prev;
        });

        if (type === 'fields') {
          setIsWpModalOpen(false);
          alert('Товар обновлен на сайте WordPress!');
        } else {
          setIsRecipeModalOpen(false);
          alert('Рецепт списания сохранен!');
        }
      } else {
        alert('Ошибка при сохранении на WordPress');
      }
    } catch (e) {
      console.error(e);
      alert('Сетевая ошибка при сохранении');
    }
  };

  const addRecipeRow = () => {
    setWpFormData({
      ...wpFormData,
      recipe: [...wpFormData.recipe, { productId: products[0]?.id || '', quantity: 1 }]
    });
  };

  const updateRecipeRow = (index: number, field: 'productId' | 'quantity', value: any) => {
    const newRecipe = [...wpFormData.recipe];
    newRecipe[index] = {
      ...newRecipe[index],
      [field]: field === 'quantity' ? parseFloat(value) || 0 : value
    };
    setWpFormData({ ...wpFormData, recipe: newRecipe });
  };

  const removeRecipeRow = (index: number) => {
    const newRecipe = wpFormData.recipe.filter((_, i) => i !== index);
    setWpFormData({ ...wpFormData, recipe: newRecipe });
  };

  const handleToggleCategory = (catId: number, catName: string) => {
    const isSelected = wpFormData.categories.some((c: any) => c.id === catId);
    if (isSelected) {
      setWpFormData({
        ...wpFormData,
        categories: wpFormData.categories.filter((c: any) => c.id !== catId)
      });
    } else {
      setWpFormData({
        ...wpFormData,
        categories: [...wpFormData.categories, { id: catId, name: catName }]
      });
    }
  };

  const openCreateModal = () => {
    setCreateFormData({
      name: '',
      type: 'simple',
      sku: '',
      price: '',
      sale_price: '',
      stock_quantity: 0,
      manage_stock: true,
      barcode: '',
      description: '',
      short_description: '',
      status: 'publish',
      categories: [],
      imageUrl: '',
      attributeName: 'Размер',
      attributeOptions: 'Mini, Standard, Premium',
      variationPrice: '',
      variationStock: '0'
    });
    setIsCreateModalOpen(true);
  };

  const handleToggleCreateCategory = (catId: number) => {
    setCreateFormData(prev => {
      const isChecked = prev.categories.includes(catId);
      const newCats = isChecked 
        ? prev.categories.filter(id => id !== catId)
        : [...prev.categories, catId];
      return { ...prev, categories: newCats };
    });
  };

  const handleCreateProduct = async () => {
    if (!createFormData.name.trim()) {
      alert('Пожалуйста, введите название товара');
      return;
    }
    setCreateLoading(true);
    try {
      const optionsArray = createFormData.attributeOptions
        ? createFormData.attributeOptions.split(',').map(o => o.trim()).filter(o => o.length > 0)
        : [];

      const payload = {
        ...createFormData,
        attributeOptions: optionsArray
      };

      const res = await fetch('/api/wp/products', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        const createdProduct = await res.json();
        setWpProducts([createdProduct, ...wpProducts]);
        setIsCreateModalOpen(false);
        alert('Товар успешно создан на сайте WooCommerce!');
      } else {
        const errData = await res.json();
        alert(`Ошибка при создании товара: ${errData.error || 'Неизвестная ошибка'}`);
      }
    } catch (e) {
      console.error(e);
      alert('Сетевая ошибка при создании товара');
    } finally {
      setCreateLoading(false);
    }
  };

  return (
    <div className="fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', flexWrap: 'wrap', gap: '1rem' }}>
        <div className="title-section">
          <h1 style={{ fontSize: '2rem', margin: 0 }}>Товары на сайте</h1>
          <p className="subtitle" style={{ color: 'var(--text-muted)', fontSize: '0.95rem', margin: '0.25rem 0 0 0' }}>
            Управление витриной интернет-магазина WooCommerce и связь со складом
          </p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          <span className="badge badge-green" style={{ textTransform: 'none', fontWeight: 600 }}>
            {connectionError ? '🔴 WooCommerce Offline' : '🟢 WooCommerce API Active'}
          </span>
          <span className="badge badge-pink" style={{ textTransform: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
            <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: 'hsl(330, 70%, 45%)', boxShadow: '0 0 4px hsl(330, 70%, 45%)', display: 'inline-block' }}></span>
            Авто-отслеживание (5м)
          </span>
          <button className="btn btn-secondary" onClick={() => { fetchWpProducts(); fetchCategories(); syncWpOrders(false); }} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>
            🔄 Обновить
          </button>
          <button className="btn btn-secondary" onClick={openCategoriesModal} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}>
            📁 Категории
          </button>
          <button className="btn btn-primary" onClick={openCreateModal} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600 }}>
            ➕ Добавить товар
          </button>
        </div>
      </header>

      {/* Error Warnings */}
      {connectionError && (
        <section className="glass-card" style={{ padding: '1.5rem', borderLeft: '4px solid var(--error)', background: 'rgba(255, 0, 0, 0.02)' }}>
          <h4 style={{ color: 'var(--error)', margin: '0 0 0.5rem 0', fontSize: '1rem' }}>⚠️ Ошибка подключения к сайту</h4>
          <p style={{ fontSize: '0.9rem', margin: 0, color: 'var(--text-muted)' }}>
            Не удалось загрузить товары с сайта https://sarasotaflowersgifts.com/. Проверьте доступность сайта, а также то, включен ли WooCommerce REST API.
          </p>
          <div style={{ marginTop: '0.75rem', fontSize: '0.8rem', fontFamily: 'monospace', color: 'var(--text-main)', background: 'rgba(0,0,0,0.03)', padding: '0.5rem', borderRadius: '4px' }}>
            Подробности: {connectionError}
          </div>
        </section>
      )}

      {/* WooCommerce Products Grid */}
      <section>
        <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <input 
            type="text" 
            placeholder="Поиск товаров на сайте по названию или SKU..." 
            className="input-field" 
            style={{ flex: 2, minWidth: '250px' }}
            value={wpSearchQuery}
            onChange={e => setWpSearchQuery(e.target.value)}
          />
          <select 
            className="input-field" 
            style={{ flex: 1, minWidth: '180px' }}
            value={wpFilterCategory}
            onChange={e => setWpFilterCategory(e.target.value)}
          >
            <option value="ALL">Все категории сайта</option>
            {categories.length > 0 ? (
              categories.map((cat: any) => (
                <option key={cat.id} value={cat.name}>
                  {cat.parent ? `   ↳ ${cat.name} (${cat.count})` : `${cat.name} (${cat.count})`}
                </option>
              ))
            ) : (
              Array.from(
                new Set(wpProducts.flatMap(p => p.categories?.map((c: any) => c.name) || []))
              )
                .sort()
                .map((catName: any) => (
                  <option key={catName} value={catName}>
                    {catName}
                  </option>
                ))
            )}
          </select>
        </div>

        {wpLoading ? (
          <div className="loader fade-in" style={{ height: '30vh', display: 'flex', flexDirection: 'column', gap: '1rem', alignItems: 'center', justifyContent: 'center' }}>
            <div className="spinner" style={{ width: '30px', height: '30px', border: '2px solid rgba(0,0,0,0.1)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
            <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>Загрузка товаров WooCommerce...</span>
          </div>
        ) : wpProducts.length === 0 ? (
          <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>🛍️</div>
            <p>{connectionError ? 'Не удалось связаться с сайтом' : 'На сайте не найдено подходящих товаров'}</p>
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: '1.5rem' }}>
            {wpProducts
              .filter(p => {
                const matchesSearch = p.name.toLowerCase().includes(wpSearchQuery.toLowerCase()) || p.sku.toLowerCase().includes(wpSearchQuery.toLowerCase());
                const matchesCategory = wpFilterCategory === 'ALL' || p.categories?.some((c: any) => c.name === wpFilterCategory);
                return matchesSearch && matchesCategory;
              })
              .map((wpProd, idx) => {
                const isVariable = wpProd.type === 'variable';

                // Calculate prices and link status if variable
                let priceStr = '—';
                let varLabels: string[] = [];
                let linkedCount = 0;
                let totalCount = 0;

                if (isVariable && wpProd.variations && wpProd.variations.length > 0) {
                  let minPrice = Infinity;
                  let maxPrice = -Infinity;
                  totalCount = wpProd.variations.length;

                  wpProd.variations.forEach((v: any) => {
                    const p = parseFloat(v.price) || 0;
                    if (p < minPrice) minPrice = p;
                    if (p > maxPrice) maxPrice = p;
                    if (v.isLinked) linkedCount++;

                    const varLabel = v.name.replace(wpProd.name, '').replace(/^\s*-\s*/, '').trim() || v.name;
                    if (varLabel) varLabels.push(varLabel);
                  });

                  if (minPrice !== Infinity) {
                    priceStr = minPrice === maxPrice 
                      ? `$${minPrice.toFixed(2)}` 
                      : `$${minPrice.toFixed(2)} – $${maxPrice.toFixed(2)}`;
                  }
                }

                const getWarehouseStatusText = () => {
                  if (linkedCount === totalCount) {
                    return (
                      <div style={{ color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span>🟢</span> Все вариации привязаны ({linkedCount}/{totalCount})
                      </div>
                    );
                  } else if (linkedCount > 0) {
                    return (
                      <div style={{ color: 'hsl(35, 80%, 45%)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span>🟡</span> Частичная привязка ({linkedCount}/{totalCount})
                      </div>
                    );
                  } else {
                    return (
                      <div style={{ color: 'var(--error)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                        <span>❌</span> Нет связи со складом (0/{totalCount})
                      </div>
                    );
                  }
                };

                const calculateCostPrice = (itemWithRecipe: any) => {
                  if (!itemWithRecipe.recipe || !Array.isArray(itemWithRecipe.recipe)) return 0;
                  return itemWithRecipe.recipe.reduce((total: number, row: any) => {
                    const p = products.find(prod => prod.id === row.productId);
                    return total + (p ? p.costPrice * row.quantity : 0);
                  }, 0);
                };

                return (
                  <div key={wpProd.id} className="glass-card fade-in wp-product-card" style={{ padding: '1.5rem', background: '#fff', border: '1px solid var(--surface-border)', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '0.5rem' }}>
                      <div style={{ width: '100%' }}>
                        {wpProd.images && wpProd.images.length > 0 && (
                          <div style={{ marginBottom: '0.75rem', width: '60px', height: '60px', borderRadius: 'var(--radius-sm)', overflow: 'hidden', border: '1px solid var(--surface-border)', float: 'left', marginRight: '0.75rem' }}>
                            <img src={wpProd.images[0].src} alt={wpProd.name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} onError={(e) => { (e.target as any).style.display = 'none'; }} />
                          </div>
                        )}
                        <h3 style={{ fontSize: '1.15rem', margin: 0, fontWeight: 800, color: 'var(--text-main)', paddingTop: wpProd.images?.length ? '0.2rem' : '0' }}>{wpProd.name}</h3>
                        {wpProd.categories && wpProd.categories.length > 0 && (
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.2rem', marginTop: '0.25rem' }}>
                            {wpProd.categories.map((c: any) => {
                              // Find full category data to check parent
                              const fullCat = categories.find((cat: any) => cat.id === c.id);
                              const label = fullCat?.parentName
                                ? `${fullCat.parentName} → ${c.name}`
                                : c.name;
                              return (
                                <span key={c.id} style={{ fontSize: '0.65rem', background: fullCat?.parent ? 'rgba(100,50,200,0.07)' : 'rgba(0,0,0,0.05)', color: fullCat?.parent ? 'var(--primary)' : 'var(--text-muted)', padding: '0.05rem 0.3rem', borderRadius: '2px', fontWeight: fullCat?.parent ? 600 : 400 }}>
                                  {label}
                                </span>
                              );
                            })}
                          </div>
                        )}
                      </div>
                      {isVariable ? (
                        <span className="badge badge-orange" style={{ textTransform: 'none', fontWeight: 700 }}>🏷️ Вариативный</span>
                      ) : (
                        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.2rem' }}>
                          <span style={{ fontWeight: 800, color: 'var(--success)', fontSize: '1.15rem' }}>${parseFloat(wpProd.price).toFixed(2)}</span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Закупка: <strong style={{ color: '#333' }}>${calculateCostPrice(wpProd).toFixed(2)}</strong></span>
                        </div>
                      )}
                    </div>

                    {!isVariable ? (
                      <>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span>Штрихкод: <strong style={{ color: '#333' }}>{wpProd.sku || '—'}</strong></span>
                            {wpProd.sku && (
                              <button onClick={() => handlePrintBarcode(wpProd)} style={{ background: 'none', border: 'none', cursor: 'pointer', opacity: 0.6, padding: '0.2rem', transition: 'all 0.2s', display: 'flex', alignItems: 'center' }} title="Печать штрихкода">🖨️</button>
                            )}
                          </div>
                          <div>Остаток на сайте: <strong style={{ color: '#333' }}>{wpProd.stock_quantity !== null ? wpProd.stock_quantity : '—'} шт</strong></div>
                          <div>Поставщик: <strong style={{ color: wpProd.supplier ? 'var(--primary)' : 'var(--text-muted)' }}>{wpProd.supplier || 'Не указан'}</strong></div>
                        </div>

                        {/* Linking & Recipe Status */}
                        <div style={{ background: 'rgba(0,0,0,0.03)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', fontSize: '0.85rem' }}>
                          {wpProd.recipe && wpProd.recipe.length > 0 ? (
                            <div>
                              <div style={{ color: 'var(--primary)', fontWeight: 700, marginBottom: '0.4rem', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                                <span>🧪</span> Состав списания (Рецепт):
                              </div>
                              <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                                {wpProd.recipe.map((ing: any, i: number) => {
                                  const p = products.find(prod => prod.id === ing.productId);
                                  return (
                                    <span key={i} className="badge badge-violet" style={{ fontSize: '0.75rem', padding: '0.2rem 0.5rem', textTransform: 'none' }}>
                                      {p ? p.name : '—'} (x{ing.quantity})
                                    </span>
                                  );
                                })}
                              </div>
                            </div>
                          ) : wpProd.directMatch ? (
                            <div style={{ color: 'var(--success)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <span>🔗</span> Связан 1-к-1: <strong>{wpProd.directMatch.name}</strong> (остаток: {wpProd.directMatch.quantity} {wpProd.directMatch.unit})
                            </div>
                          ) : (
                            <div style={{ color: 'var(--error)', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                              <span>❌</span> Нет связи со складом (расходники не привязаны)
                            </div>
                          )}
                        </div>
                      </>
                    ) : (
                      <>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
                          <div>Диапазон цен: <strong style={{ color: 'var(--success)', fontWeight: 700 }}>{priceStr}</strong></div>
                          <div>Вариаций: <strong style={{ color: '#333' }}>{totalCount} шт</strong></div>
                          {varLabels.length > 0 && (
                            <div>Опции: <strong style={{ color: '#333' }}>{varLabels.join(', ')}</strong></div>
                          )}
                          <div>Поставщик: <strong style={{ color: wpProd.supplier ? 'var(--primary)' : 'var(--text-muted)' }}>{wpProd.supplier || 'Не указан'}</strong></div>
                        </div>

                        {/* Linking & Recipe Status for Variable */}
                        <div style={{ background: 'rgba(0,0,0,0.03)', padding: '0.75rem 1rem', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                          <div style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', fontWeight: 600, marginBottom: '0.2rem' }}>
                            Связь вариаций со складом:
                          </div>
                          {getWarehouseStatusText()}
                        </div>
                      </>
                    )}

                    <div style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto', paddingTop: '0.75rem', borderTop: '1px dashed var(--surface-border)', flexWrap: 'wrap' }}>
                      <button className="btn btn-primary" style={{ flex: '1 1 auto', padding: '0.4rem 0.6rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }} onClick={() => openEditWpModal(wpProd)}>
                        ✏️ Редактировать
                      </button>
                      <button className="btn btn-secondary" style={{ flex: '1 1 auto', padding: '0.4rem 0.6rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.25rem' }} onClick={() => openRecipeModal(wpProd)}>
                        🧪 Состав
                      </button>
                    </div>
                  </div>
                );
              })}
          </div>
        )}
      </section>

      {/* WooCommerce Product Fields Edit Modal */}
      {isWpModalOpen && mounted && createPortal(
        <div className="modal-overlay fade-in">
          <div className="modal-content glass-card" style={{ maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2>✏️ Редактировать товар на сайте: {editingWpProduct?.name}</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div className="form-grid">
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Название товара</label>
                  <input type="text" placeholder="Название на сайте" value={wpFormData.name} onChange={e => setWpFormData({...wpFormData, name: e.target.value})} className="input-field" />
                </div>
                
                {editingWpProduct?.type === 'variable' ? (
                  <div style={{ gridColumn: 'span 2', padding: '0.75rem 1rem', background: 'rgba(100,50,200,0.05)', border: '1px solid rgba(100,50,200,0.1)', borderRadius: 'var(--radius-sm)', fontSize: '0.85rem', color: 'var(--primary)', fontWeight: 600 }}>
                    ℹ️ Это вариативный товар. Цены, артикулы, штрихкоды и остатки настраиваются индивидуально для каждой вариации в секции «Варианты товара» ниже.
                  </div>
                ) : (
                  <>
                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Артикул/Штрихкод</label>
                      <input type="text" placeholder="Артикул/Штрихкод товара" value={wpFormData.sku} onChange={e => setWpFormData({...wpFormData, sku: e.target.value})} className="input-field" />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Обычная цена ($)</label>
                      <input type="text" placeholder="Цена" value={wpFormData.regular_price} onChange={e => setWpFormData({...wpFormData, regular_price: e.target.value})} className="input-field" />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Акционная цена ($)</label>
                      <input type="text" placeholder="Акционная цена (опционально)" value={wpFormData.sale_price} onChange={e => setWpFormData({...wpFormData, sale_price: e.target.value})} className="input-field" />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Остаток на сайте</label>
                      <input type="number" placeholder="Остаток на сайте" value={wpFormData.stock_quantity} onChange={e => setWpFormData({...wpFormData, stock_quantity: parseInt(e.target.value) || 0})} className="input-field" disabled={!wpFormData.manage_stock} />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Управление запасами</label>
                      <div style={{ display: 'flex', alignItems: 'center', height: '40px', gap: '0.5rem' }}>
                        <input type="checkbox" id="manage_stock_chk" checked={wpFormData.manage_stock} onChange={e => setWpFormData({...wpFormData, manage_stock: e.target.checked})} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                        <label htmlFor="manage_stock_chk" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>Включить учет на сайте</label>
                      </div>
                    </div>
                  </>
                )}

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Статус товара</label>
                  <select value={wpFormData.status} onChange={e => setWpFormData({...wpFormData, status: e.target.value})} className="input-field">
                    <option value="publish">Опубликован (Publish)</option>
                    <option value="draft">Черновик (Draft)</option>
                    <option value="pending">На удержании (Pending)</option>
                    <option value="private">Личный (Private)</option>
                  </select>
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Поставщик (опционально)</label>
                  <select value={wpFormData.supplier || ''} onChange={e => setWpFormData({...wpFormData, supplier: e.target.value})} className="input-field" style={{ width: '100%' }}>
                    <option value="">Не указан</option>
                    {suppliers.map(s => (
                      <option key={s.id} value={s.name}>{s.name}</option>
                    ))}
                  </select>
                  <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', display: 'block', marginTop: '0.35rem' }}>
                    💡 Этот поставщик будет отображаться для товара на сайте. Не передается в WooCommerce, хранится только в программе.
                  </span>
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>Категории товара на сайте</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', maxHeight: '150px', overflowY: 'auto', border: '1px solid var(--surface-border)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.01)' }}>
                    {categories.length > 0 ? (
                      categories.map((cat: any) => {
                        const isChecked = wpFormData.categories.some((c: any) => c.id === cat.id);
                        const isChild = cat.parent && cat.parent !== 0;
                        return (
                          <label key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', cursor: 'pointer', padding: '0.25rem 0.4rem', paddingLeft: isChild ? '1.5rem' : '0.4rem', borderRadius: '4px', background: isChecked ? 'rgba(0, 0, 0, 0.04)' : 'transparent', transition: 'all 0.15s' }}>
                            <input type="checkbox" checked={isChecked} onChange={() => handleToggleCategory(cat.id, cat.name)} style={{ cursor: 'pointer', flexShrink: 0 }} />
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', overflow: 'hidden' }}>
                              {isChild && <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', opacity: 0.6 }}>↳</span>}
                              <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontWeight: isChild ? 400 : 600, color: isChild ? 'var(--text-muted)' : 'var(--text-main)' }}>{cat.name}</span>
                              {cat.parentName && <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', opacity: 0.7, flexShrink: 0 }}>({cat.parentName})</span>}
                            </span>
                          </label>
                        );
                      })
                    ) : (
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center' }}>Загрузка категорий...</div>
                    )}
                  </div>
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Краткое описание</label>
                  <textarea placeholder="Краткое описание товара" value={wpFormData.short_description} onChange={e => setWpFormData({...wpFormData, short_description: e.target.value})} className="input-field" style={{ minHeight: '50px', fontFamily: 'inherit', resize: 'vertical' }} />
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Полное описание товара</label>
                  <textarea placeholder="Описание товара на сайте" value={wpFormData.description} onChange={e => setWpFormData({...wpFormData, description: e.target.value})} className="input-field" style={{ minHeight: '90px', fontFamily: 'inherit', resize: 'vertical' }} />
                </div>
              </div>

              {/* Variations Editor inside Parent Product Edit Modal */}
              {editingWpProduct?.type === 'variable' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem', marginTop: '1rem', borderTop: '1px solid var(--surface-border)', paddingTop: '1.25rem' }}>
                  <h3 style={{ fontSize: '1rem', color: 'var(--text-main)', margin: 0, fontWeight: 700 }}>
                    ⚙️ Варианты товара (Вариации)
                  </h3>
                  <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                    Нажмите на название варианта, чтобы раскрыть его свойства и отредактировать. Каждую вариацию нужно сохранять отдельно.
                  </p>
                  
                  {editingWpProduct.variations && editingWpProduct.variations.length > 0 ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      {editingWpProduct.variations.map((v: any) => {
                        const isExpanded = expandedVariationId === v.id;
                        const varLabel = v.name.replace(editingWpProduct.name, '').replace(/^\s*-\s*/, '').trim() || v.name;
                        
                        return (
                          <div key={v.id} style={{ border: '1px solid var(--surface-border)', borderRadius: 'var(--radius-md)', overflow: 'hidden', background: isExpanded ? 'rgba(0,0,0,0.015)' : '#fff' }}>
                            {/* Variation Header */}
                            <div 
                              onClick={() => setExpandedVariationId(isExpanded ? null : v.id)}
                              style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.75rem 1rem', cursor: 'pointer', background: isExpanded ? 'rgba(0,0,0,0.03)' : 'transparent', transition: 'background 0.2s' }}
                            >
                              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                                <span style={{ fontSize: '0.95rem', fontWeight: 700, color: 'var(--text-main)' }}>{varLabel}</span>
                                <span className="badge badge-secondary" style={{ fontSize: '0.7rem' }}>ID: {v.id}</span>
                              </div>
                              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                                <span style={{ fontWeight: 800, color: 'var(--success)', fontSize: '0.9rem' }}>${parseFloat(v.price || '0').toFixed(2)}</span>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Остаток: {v.stock_quantity !== null ? v.stock_quantity : '—'} шт</span>
                                <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{isExpanded ? '▲' : '▼'}</span>
                              </div>
                            </div>

                            {/* Variation Form Body */}
                            {isExpanded && (
                              <div style={{ padding: '1rem', borderTop: '1px solid var(--surface-border)', display: 'flex', flexDirection: 'column', gap: '1rem', background: '#fff' }}>
                                <div className="form-grid">
                                  <div>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Артикул (SKU)</label>
                                    <input 
                                      type="text" 
                                      className="input-field" 
                                      value={v.sku || ''} 
                                      onChange={e => handleUpdateLocalVariationField(v.id, 'sku', e.target.value)} 
                                    />
                                  </div>
                                  <div>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Штрихкод (Barcode)</label>
                                    <input 
                                      type="text" 
                                      className="input-field" 
                                      value={v.barcode || ''} 
                                      onChange={e => handleUpdateLocalVariationField(v.id, 'barcode', e.target.value)} 
                                    />
                                  </div>
                                  <div>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Обычная цена ($)</label>
                                    <input 
                                      type="text" 
                                      className="input-field" 
                                      value={v.regular_price || v.price || ''} 
                                      onChange={e => handleUpdateLocalVariationField(v.id, 'regular_price', e.target.value)} 
                                    />
                                  </div>
                                  <div>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Акционная цена ($)</label>
                                    <input 
                                      type="text" 
                                      className="input-field" 
                                      value={v.sale_price || ''} 
                                      onChange={e => handleUpdateLocalVariationField(v.id, 'sale_price', e.target.value)} 
                                    />
                                  </div>
                                  <div>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Остаток</label>
                                    <input 
                                      type="number" 
                                      className="input-field" 
                                      value={v.stock_quantity || 0} 
                                      disabled={!v.manage_stock}
                                      onChange={e => handleUpdateLocalVariationField(v.id, 'stock_quantity', parseInt(e.target.value) || 0)} 
                                    />
                                  </div>
                                  <div>
                                    <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Управление запасами</label>
                                    <div style={{ display: 'flex', alignItems: 'center', height: '40px', gap: '0.5rem' }}>
                                      <input 
                                        type="checkbox" 
                                        id={`manage_stock_chk_${v.id}`} 
                                        checked={v.manage_stock ?? true} 
                                        onChange={e => handleUpdateLocalVariationField(v.id, 'manage_stock', e.target.checked)} 
                                        style={{ width: '18px', height: '18px', cursor: 'pointer' }} 
                                      />
                                      <label htmlFor={`manage_stock_chk_${v.id}`} style={{ fontSize: '0.85rem', cursor: 'pointer' }}>Включить учет запасов</label>
                                    </div>
                                  </div>
                                </div>
                                <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.5rem' }}>
                                  <button 
                                    className="btn btn-secondary btn-sm" 
                                    onClick={() => setExpandedVariationId(null)}
                                  >
                                    Закрыть
                                  </button>
                                  <button 
                                    className="btn btn-primary btn-sm" 
                                    disabled={savingVariationId === v.id}
                                    onClick={() => handleSaveVariation(v.id, {
                                      sku: v.sku,
                                      barcode: v.barcode,
                                      regular_price: v.regular_price,
                                      price: v.regular_price,
                                      sale_price: v.sale_price,
                                      stock_quantity: v.stock_quantity,
                                      manage_stock: v.manage_stock
                                    })}
                                  >
                                    {savingVariationId === v.id ? 'Сохранение...' : '💾 Сохранить вариацию'}
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem' }}>Нет доступных вариаций для настройки.</div>
                  )}
                </div>
              )}
            </div>

            <div className="modal-actions" style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--surface-border)' }}>
              <button className="btn btn-secondary" onClick={() => setIsWpModalOpen(false)}>Отмена</button>
              <button className="btn btn-primary" onClick={() => saveWpProduct('fields')}>Сохранить на WordPress</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Warehouse Compositions Recipe Modal */}
      {isRecipeModalOpen && mounted && createPortal(
        <div className="modal-overlay fade-in">
          <div className="modal-content glass-card" style={{ maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2>🧪 Связать расходники со склада</h2>
            <h4 style={{ margin: '0 0 0.5rem 0', color: 'var(--text-main)' }}>
              Товар: {editingWpProduct?.name}
            </h4>
            
            {editingWpProduct?.type === 'variable' && (
              <div style={{ marginBottom: '1.5rem', background: 'rgba(0,0,0,0.02)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--surface-border)' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>
                  Выберите вариант товара для настройки рецепта списания:
                </label>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.4rem' }}>
                  {editingWpProduct.variations?.map((v: any) => {
                    const varLabel = v.name.replace(editingWpProduct.name, '').replace(/^\s*-\s*/, '').trim() || v.name;
                    const isActive = selectedVariationId === v.id;
                    return (
                      <button 
                        key={v.id} 
                        onClick={() => {
                          setSelectedVariationId(v.id);
                          setWpFormData({
                            id: v.id,
                            parentId: editingWpProduct.id,
                            name: v.name,
                            sku: v.sku || '',
                            price: v.price || '',
                            regular_price: v.regular_price || v.price || '',
                            sale_price: v.sale_price || '',
                            manage_stock: v.manage_stock ?? true,
                            stock_quantity: v.stock_quantity || 0,
                            barcode: v.barcode || '',
                            description: v.description || '',
                            short_description: v.short_description || '',
                            status: v.status || 'publish',
                            categories: v.categories || [],
                            recipe: v.recipe || [],
                            supplier: v.supplier || ''
                          });
                        }}
                        className={`btn ${isActive ? 'btn-primary' : 'btn-secondary'}`}
                        style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', textTransform: 'none' }}
                      >
                        {varLabel} {v.recipe?.length > 0 ? '🧪' : ''}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <h3 style={{ fontSize: '0.9rem', textTransform: 'uppercase', color: 'var(--text-muted)', margin: 0 }}>
                  Состав списания при продаже {editingWpProduct?.type === 'variable' ? `варианта «${wpFormData.name.replace(editingWpProduct.name, '').replace(/^\s*-\s*/, '').trim()}»` : ''}
                </h3>
                <button className="btn btn-secondary btn-sm" onClick={addRecipeRow} style={{ padding: '0.2rem 0.5rem', fontSize: '0.75rem' }}>
                  + Добавить позицию
                </button>
              </div>

              <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', margin: 0 }}>
                Укажите, какие цветы и упаковочные материалы списывать со склада при каждой продаже этого товара на сайте. Если рецепт пуст, система попробует связать товар 1-к-1 по совпадению SKU/Штрихкода.
              </p>

              {wpFormData.recipe.length === 0 ? (
                <div style={{ padding: '2rem', border: '1px dashed var(--surface-border)', borderRadius: 'var(--radius-sm)', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                  Рецепт пуст. Будет использоваться автосвязь 1-к-1 по совпадению SKU или Штрихкода.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {wpFormData.recipe.map((row, index) => (
                    <div key={index} style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                      <select 
                        value={row.productId} 
                        onChange={e => updateRecipeRow(index, 'productId', e.target.value)} 
                        className="input-field"
                        style={{ flex: 2 }}
                      >
                        {products.map(p => (
                          <option key={p.id} value={p.id}>
                            {p.name} (остаток: {p.quantity} {p.unit})
                          </option>
                        ))}
                      </select>
                      <input 
                        type="number" 
                        step="0.1" 
                        value={row.quantity} 
                        onChange={e => updateRecipeRow(index, 'quantity', e.target.value)} 
                        className="input-field" 
                        style={{ flex: 0.8, minWidth: '60px' }} 
                        placeholder="Кол-во"
                      />
                      <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', width: '30px' }}>
                        {products.find(p => p.id === row.productId)?.unit || 'шт'}
                      </span>
                      <button className="remove-btn" onClick={() => removeRecipeRow(index)} style={{ padding: '0.2rem', color: 'var(--error)' }}>
                        ×
                      </button>
                    </div>
                  ))}
                </div>
              )}

            </div>

            <div className="modal-actions" style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--surface-border)' }}>
              <button className="btn btn-secondary" onClick={() => setIsRecipeModalOpen(false)}>Отмена</button>
              <button className="btn btn-primary" onClick={() => saveWpProduct('recipe')}>Сохранить Рецепт</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* WooCommerce Categories Modal */}
      {isCategoriesModalOpen && mounted && createPortal(
        <div className="modal-overlay fade-in">
          <div className="modal-content glass-card" style={{ maxWidth: '600px', maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>📁 Категории сайта</h2>
              <button className="btn btn-secondary" onClick={() => setIsCategoriesModalOpen(false)} style={{ padding: '0.4rem 0.8rem', fontSize: '0.85rem' }}>✕ Закрыть</button>
            </div>
            <p style={{ margin: 0, fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              Управляйте категориями WooCommerce прямо отсюда, без необходимости заходить на сайт.
            </p>

            {/* Add Category Form */}
            <form onSubmit={handleCreateCategory} style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem', padding: '1rem', background: 'rgba(0,0,0,0.02)', borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)' }}>
              <h4 style={{ margin: 0, fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>➕ Добавить новую категорию</h4>
              <div className="form-grid">
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Название категории *</label>
                  <input
                    type="text"
                    placeholder="Например: Букеты, Свадебные, Праздничные..."
                    value={newCategoryName}
                    onChange={e => setNewCategoryName(e.target.value)}
                    className="input-field"
                    required
                  />
                </div>
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Родительская категория (опционально)</label>
                  <select
                    value={newCategoryParent}
                    onChange={e => setNewCategoryParent(e.target.value)}
                    className="input-field"
                  >
                    <option value="">— Без родительской категории (корневая) —</option>
                    {categories.map((cat: any) => (
                      <option key={cat.id} value={cat.id}>{cat.name}</option>
                    ))}
                  </select>
                </div>
              </div>
              <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
                <button type="submit" className="btn btn-primary" disabled={isSavingCategory} style={{ padding: '0.5rem 1.25rem' }}>
                  {isSavingCategory ? 'Создание...' : '✅ Создать категорию'}
                </button>
              </div>
            </form>

            {/* Existing Categories List */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              <h4 style={{ margin: '0 0 0.25rem 0', fontSize: '0.9rem', fontWeight: 700, color: 'var(--text-main)' }}>📋 Все категории ({categories.length})</h4>
              {categories.length === 0 ? (
                <div style={{ padding: '2rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', border: '1px dashed var(--surface-border)', borderRadius: 'var(--radius-md)' }}>
                  Нет категорий. Создайте первую выше.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem', maxHeight: '300px', overflowY: 'auto' }}>
                  {categories.map((cat: any) => {
                    const isChild = cat.parent && cat.parent !== 0;
                    return (
                      <div key={cat.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.55rem 1rem', paddingLeft: isChild ? '2rem' : '1rem', background: isChild ? 'rgba(100,50,200,0.03)' : '#fff', border: `1px solid ${isChild ? 'rgba(100,50,200,0.12)' : 'var(--surface-border)'}`, borderRadius: 'var(--radius-sm)', position: 'relative' }}>
                        {isChild && (
                          <span style={{ position: 'absolute', left: '0.75rem', color: 'var(--text-muted)', fontSize: '0.8rem', opacity: 0.5 }}>↳</span>
                        )}
                        <div style={{ display: 'flex', flex: 1, flexDirection: 'column', gap: '0.1rem' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                            <span style={{ fontWeight: isChild ? 500 : 700, fontSize: isChild ? '0.85rem' : '0.9rem', color: isChild ? 'var(--text-muted)' : 'var(--text-main)' }}>{cat.name}</span>
                            {isChild && cat.parentName && (
                              <span style={{ fontSize: '0.65rem', background: 'rgba(100,50,200,0.08)', color: 'var(--primary)', padding: '0.05rem 0.35rem', borderRadius: '3px', fontWeight: 600 }}>
                                {cat.parentName}
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                            {cat.count} {cat.count === 1 ? 'товар' : cat.count >= 2 && cat.count <= 4 ? 'товара' : 'товаров'}
                            {isChild ? ` · Подкатегория в «${cat.parentName}»` : ' · Корневая категория'}
                          </span>
                        </div>
                        <button
                          className="btn btn-danger"
                          onClick={() => handleDeleteCategory(cat.id, cat.name)}
                          style={{ padding: '0.3rem 0.65rem', fontSize: '0.8rem', flexShrink: 0 }}
                          title={`Удалить категорию "${cat.name}" с сайта`}
                        >
                          🗑️ Удалить
                        </button>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* WooCommerce Create Product Modal */}
      {isCreateModalOpen && mounted && createPortal(
        <div className="modal-overlay fade-in">
          <div className="modal-content glass-card" style={{ maxWidth: '650px', maxHeight: '90vh', overflowY: 'auto' }}>
            <h2>➕ Добавить новый товар на сайт</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Type Switcher */}
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>Тип товара</label>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem', cursor: 'pointer' }}>
                    <input 
                      type="radio" 
                      name="product_type" 
                      value="simple" 
                      checked={createFormData.type === 'simple'} 
                      onChange={() => setCreateFormData({ ...createFormData, type: 'simple' })} 
                      style={{ cursor: 'pointer' }}
                    />
                    Обычный товар
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.9rem', cursor: 'pointer' }}>
                    <input 
                      type="radio" 
                      name="product_type" 
                      value="variable" 
                      checked={createFormData.type === 'variable'} 
                      onChange={() => setCreateFormData({ ...createFormData, type: 'variable' })} 
                      style={{ cursor: 'pointer' }}
                    />
                    Вариативный товар
                  </label>
                </div>
              </div>

              <div className="form-grid">
                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Название товара</label>
                  <input type="text" placeholder="Например: Букет с пионами Сарасота" value={createFormData.name} onChange={e => setCreateFormData({...createFormData, name: e.target.value})} className="input-field" />
                </div>
                
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Артикул/Штрихкод</label>
                  <input type="text" placeholder="Артикул/Штрихкод" value={createFormData.sku} onChange={e => setCreateFormData({...createFormData, sku: e.target.value})} className="input-field" />
                </div>

                {createFormData.type === 'simple' ? (
                  <>
                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Цена ($)</label>
                      <input type="text" placeholder="Цена" value={createFormData.price} onChange={e => setCreateFormData({...createFormData, price: e.target.value})} className="input-field" />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Акционная цена ($)</label>
                      <input type="text" placeholder="Опционально" value={createFormData.sale_price} onChange={e => setCreateFormData({...createFormData, sale_price: e.target.value})} className="input-field" />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Остаток</label>
                      <input type="number" placeholder="Остаток" value={createFormData.stock_quantity} onChange={e => setCreateFormData({...createFormData, stock_quantity: parseInt(e.target.value) || 0})} className="input-field" disabled={!createFormData.manage_stock} />
                    </div>

                    <div>
                      <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Учет запасов</label>
                      <div style={{ display: 'flex', alignItems: 'center', height: '40px', gap: '0.5rem' }}>
                        <input type="checkbox" id="create_manage_stock_chk" checked={createFormData.manage_stock} onChange={e => setCreateFormData({...createFormData, manage_stock: e.target.checked})} style={{ width: '18px', height: '18px', cursor: 'pointer' }} />
                        <label htmlFor="create_manage_stock_chk" style={{ fontSize: '0.85rem', cursor: 'pointer' }}>Включить учет</label>
                      </div>
                    </div>
                  </>
                ) : (
                  <>
                    <div style={{ gridColumn: 'span 2', padding: '1rem', background: 'rgba(0,0,0,0.02)', borderRadius: 'var(--radius-sm)', border: '1px solid var(--surface-border)', display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                      <h4 style={{ margin: 0, fontSize: '0.85rem', textTransform: 'uppercase', color: 'var(--text-muted)' }}>⚙️ Настройки вариаций</h4>
                      
                      <div className="form-grid">
                        <div>
                          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Название атрибута</label>
                          <input type="text" placeholder="Например: Размер или Цвет" value={createFormData.attributeName} onChange={e => setCreateFormData({...createFormData, attributeName: e.target.value})} className="input-field" />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Опции (через запятую)</label>
                          <input type="text" placeholder="Mini, Standard, Premium" value={createFormData.attributeOptions} onChange={e => setCreateFormData({...createFormData, attributeOptions: e.target.value})} className="input-field" />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Дефолтная цена вариации ($)</label>
                          <input type="text" placeholder="Цена вариации" value={createFormData.variationPrice} onChange={e => setCreateFormData({...createFormData, variationPrice: e.target.value})} className="input-field" />
                        </div>
                        <div>
                          <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Дефолтный остаток вариации</label>
                          <input type="number" placeholder="Остаток вариации" value={createFormData.variationStock} onChange={e => setCreateFormData({...createFormData, variationStock: e.target.value})} className="input-field" />
                        </div>
                      </div>
                    </div>
                  </>
                )}

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>URL-адрес изображения</label>
                  <input type="text" placeholder="Вставьте прямую ссылку на картинку (https://...)" value={createFormData.imageUrl} onChange={e => setCreateFormData({...createFormData, imageUrl: e.target.value})} className="input-field" />
                  {createFormData.imageUrl && (
                    <div style={{ marginTop: '0.5rem', display: 'flex', alignItems: 'center', gap: '1rem', border: '1px solid var(--surface-border)', padding: '0.5rem', borderRadius: '4px' }}>
                      <img src={createFormData.imageUrl} alt="Превью" style={{ width: '48px', height: '48px', objectFit: 'cover', borderRadius: '4px' }} onError={(e) => { (e.target as any).style.display = 'none'; }} />
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Предпросмотр изображения</span>
                    </div>
                  )}
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Статус товара</label>
                  <select value={createFormData.status} onChange={e => setCreateFormData({...createFormData, status: e.target.value})} className="input-field">
                    <option value="publish">Опубликован (Publish)</option>
                    <option value="draft">Черновик (Draft)</option>
                  </select>
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.4rem' }}>Категории товара</label>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2rem', maxHeight: '150px', overflowY: 'auto', border: '1px solid var(--surface-border)', padding: '0.75rem', borderRadius: 'var(--radius-sm)', background: 'rgba(0,0,0,0.01)' }}>
                    {categories.length > 0 ? (
                      categories.map((cat: any) => {
                        const isChecked = createFormData.categories.includes(cat.id);
                        const isChild = cat.parent && cat.parent !== 0;
                        return (
                          <label key={cat.id} style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.8rem', cursor: 'pointer', padding: '0.25rem 0.4rem', paddingLeft: isChild ? '1.5rem' : '0.4rem', borderRadius: '4px', background: isChecked ? 'rgba(0, 0, 0, 0.04)' : 'transparent', transition: 'all 0.15s' }}>
                            <input type="checkbox" checked={isChecked} onChange={() => handleToggleCreateCategory(cat.id)} style={{ cursor: 'pointer', flexShrink: 0 }} />
                            <span style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', overflow: 'hidden' }}>
                              {isChild && <span style={{ color: 'var(--text-muted)', fontSize: '0.7rem', opacity: 0.6 }}>↳</span>}
                              <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', fontWeight: isChild ? 400 : 600, color: isChild ? 'var(--text-muted)' : 'var(--text-main)' }}>{cat.name}</span>
                              {cat.parentName && <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)', opacity: 0.7, flexShrink: 0 }}>({cat.parentName})</span>}
                            </span>
                          </label>
                        );
                      })
                    ) : (
                      <div style={{ color: 'var(--text-muted)', fontSize: '0.8rem', textAlign: 'center' }}>Загрузка категорий...</div>
                    )}
                  </div>
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Краткое описание</label>
                  <textarea placeholder="Краткое описание товара" value={createFormData.short_description} onChange={e => setCreateFormData({...createFormData, short_description: e.target.value})} className="input-field" style={{ minHeight: '50px', fontFamily: 'inherit', resize: 'vertical' }} />
                </div>

                <div style={{ gridColumn: 'span 2' }}>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.25rem' }}>Полное описание товара</label>
                  <textarea placeholder="Описание товара на сайте" value={createFormData.description} onChange={e => setCreateFormData({...createFormData, description: e.target.value})} className="input-field" style={{ minHeight: '90px', fontFamily: 'inherit', resize: 'vertical' }} />
                </div>
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--surface-border)' }}>
              <button className="btn btn-secondary" onClick={() => setIsCreateModalOpen(false)}>Отмена</button>
              <button className="btn btn-primary" onClick={handleCreateProduct} disabled={createLoading}>
                {createLoading ? 'Создание...' : 'Создать товар'}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      <style jsx>{`
        @keyframes spin { to { transform: rotate(360deg); } }
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
        .modal-content { padding: 2rem; width: 100%; max-width: 650px; display: flex; flex-direction: column; gap: 1.5rem; background: #ffffff; border-radius: var(--radius-lg); box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
        .modal-content h2 { font-size: 1.5rem; margin: 0; color: var(--text-main); font-family: 'Outfit', sans-serif; }
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .modal-actions { display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1rem; }
        .remove-btn { color: var(--error); font-size: 1.25rem; cursor: pointer; transition: all 0.2s; border-radius: 4px; padding: 0.25rem 0.5rem; background: hsl(0, 80%, 97%); border: 1px solid transparent; }
        .remove-btn:hover { background: hsl(0, 80%, 93%); border-color: rgba(255,0,0,0.1); }
        
        .wp-product-card { grid-column: span 1; }
        @media (max-width: 768px) {
          .form-grid { grid-template-columns: 1fr; }
          .modal-content { padding: 1.25rem; gap: 1rem; }
          .modal-content h2 { font-size: 1.2rem; }
        }
      `}</style>
    </div>
  );
}
