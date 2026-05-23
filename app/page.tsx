'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Product } from '@prisma/client';
import { useLanguage } from './components/LanguageContext';
import { useAuth } from './components/AuthProvider';

export default function InventoryPage() {
  const [mounted, setMounted] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    sku: '', name: '', category: 'FLOWER', unit: 'шт', quantity: 0, minStock: 0, costPrice: 0, retailPrice: 0
  });

  // Write-Off States
  const [isWriteOffModalOpen, setIsWriteOffModalOpen] = useState(false);
  const [writeOffBarcode, setWriteOffBarcode] = useState('');
  const [writeOffSelectedProductId, setWriteOffSelectedProductId] = useState('');
  const [writeOffQuantity, setWriteOffQuantity] = useState('1');

  // WooCommerce Integration States
  const { t } = useLanguage();
  const { user } = useAuth();
  const userRole = user?.role || 'EMPLOYEE';

  // Write-off handlers
  const openWriteOffModal = () => {
    setWriteOffBarcode('');
    setWriteOffSelectedProductId('');
    setWriteOffQuantity('1');
    setIsWriteOffModalOpen(true);
  };

  const handleBarcodeScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const code = writeOffBarcode.trim();
      if (!code) return;

      const found = products.find(p => p.barcode?.toLowerCase() === code.toLowerCase() || p.sku?.toLowerCase() === code.toLowerCase());
      if (found) {
        setWriteOffSelectedProductId(found.id);
        setTimeout(() => {
          const qtyInput = document.getElementById('write-off-qty-input');
          if (qtyInput) qtyInput.focus();
        }, 50);
      } else {
        alert(`Товар со штрихкодом/артикулом "${code}" не найден на складе`);
      }
    }
  };

  const handleExecuteWriteOff = async () => {
    const qty = parseFloat(writeOffQuantity);
    if (!writeOffSelectedProductId || isNaN(qty) || qty <= 0) return;

    const prod = products.find(p => p.id === writeOffSelectedProductId);
    if (!prod) return;

    try {
      const res = await fetch(`/api/products/${writeOffSelectedProductId}/write-off`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: qty, userId: user?.name || 'SYSTEM' })
      });
      if (res.ok) {
        const result = await res.json();
        setProducts(products.map(p => p.id === writeOffSelectedProductId ? result.product : p));
        setIsWriteOffModalOpen(false);
        alert(`Успешно списано ${qty} ${prod.unit} товара "${prod.name}"!`);
      } else {
        const err = await res.json();
        alert(`Ошибка при списании: ${err.error || 'Неизвестная ошибка'}`);
      }
    } catch (e) {
      console.error(e);
      alert('Сетевая ошибка при списании');
    }
  };

  // Instant scanner lookup trigger
  useEffect(() => {
    if (!writeOffBarcode) return;
    const code = writeOffBarcode.trim();
    const found = products.find(p => p.barcode?.toLowerCase() === code.toLowerCase() || p.sku?.toLowerCase() === code.toLowerCase());
    if (found) {
      setWriteOffSelectedProductId(found.id);
    }
  }, [writeOffBarcode, products]);

  const filteredProducts = products.filter(p => {
    const s = searchQuery.toLowerCase();
    const matchSearch = p.name.toLowerCase().includes(s) || p.sku.toLowerCase().includes(s);
    const matchCat = filterCategory === 'ALL' || p.category === filterCategory;
    return matchSearch && matchCat;
  });

  useEffect(() => {
    fetch('/api/products')
      .then(res => res.json())
      .then(data => {
        setProducts(data);
        setLoading(false);
      });
    setMounted(true);
  }, []);

  const handleExport = () => {
    window.location.href = '/api/export/quickbooks';
  };

  const handleGenerateBarcode = async (id: string) => {
    try {
      const res = await fetch(`/api/products/${id}/barcode`, { method: 'POST' });
      if (res.ok) {
        const updated = await res.json();
        setProducts(products.map(p => p.id === id ? updated : p));
      } else {
        console.error('Failed to generate barcode');
        alert('Ошибка при генерации штрихкода');
      }
    } catch (e) {
      console.error(e);
      alert('Сетевая ошибка при генерации штрихкода');
    }
  };

  const openAddModal = () => {
    setFormData({ sku: '', name: '', category: 'FLOWER', unit: 'шт', quantity: 0, minStock: 0, costPrice: 0, retailPrice: 0 });
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const openEditModal = (p: Product) => {
    setFormData({
      sku: p.sku, name: p.name, category: p.category, unit: p.unit,
      quantity: p.quantity || 0, minStock: p.minStock || 0, costPrice: p.costPrice || 0, retailPrice: p.retailPrice || 0
    });
    setEditingProduct(p);
    setIsModalOpen(true);
  };

  const saveProduct = async () => {
    try {
      if (editingProduct) {
        const res = await fetch(`/api/products/${editingProduct.id}`, {
          method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData)
        });
        if (res.ok) {
          const updated = await res.json();
          setProducts(products.map(p => p.id === updated.id ? updated : p));
        }
      } else {
        const res = await fetch('/api/products', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(formData)
        });
        if (res.ok) {
          const created = await res.json();
          setProducts([...products, created]);
        }
      }
      setIsModalOpen(false);
    } catch (e) {
      console.error(e);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Вы уверены, что хотите удалить этот товар?')) return;
    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      if (res.ok) setProducts(products.filter(p => p.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  const handlePrintBarcode = (product: Product) => {
    const qtyStr = prompt(`Сколько этикеток напечатать для "${product.name}"?`, '2');
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
      for (let i = 0; i < copies; i++) {
        labelsHtml += `
          <div class="label-page">
            <div class="product-name">${product.name}</div>
            <div class="barcode-img"></div>
            <div class="barcode-number">${(product as any).barcode}</div>
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
                margin-bottom: 4px;
                white-space: nowrap;
                overflow: hidden;
                text-overflow: ellipsis;
                width: 100%;
                color: #000;
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
      
      setTimeout(() => {
        if (iframe && iframe.parentNode) {
          iframe.parentNode.removeChild(iframe);
        }
      }, 5000);
    }
  };

  const handleCustomBarcodePrompt = async (product: Product) => {
    const val = prompt(`Укажите собственный штрих-код для товара "${product.name}":`, (product as any).barcode || '');
    if (val === null) return;
    const trimmed = val.trim();
    
    try {
      const res = await fetch(`/api/products/${product.id}/barcode`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ barcode: trimmed })
      });
      if (res.ok) {
        const updated = await res.json();
        setProducts(products.map(p => p.id === product.id ? updated : p));
      } else {
        const err = await res.json();
        alert(`Ошибка: ${err.error || 'Не удалось сохранить штрих-код'}`);
      }
    } catch (e) {
      console.error(e);
      alert('Сетевая ошибка при сохранении штрих-кода');
    }
  };

  if (loading) return (
    <div className="loader fade-in">
      <div className="spinner"></div>
      <span>{t('stock.loading')}</span>
    </div>
  );

  return (
    <div className="inventory-dashboard fade-in">
      <header className="page-header">
        <div className="title-section">
          <h1>{t('stock.title')}</h1>
          <p className="subtitle">{t('stock.subtitle')}</p>
        </div>
        <div className="header-actions" style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button className="btn btn-secondary" onClick={handleExport} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', height: '38px', padding: '0 1rem', boxSizing: 'border-box', fontWeight: 600 }}>
            <span className="icon" style={{ fontSize: '1rem' }}>📥</span> {t('action.export')}
          </button>
          <button className="btn btn-secondary" onClick={openWriteOffModal} style={{ background: 'hsl(350, 75%, 96%)', color: 'hsl(350, 75%, 35%)', borderColor: 'hsl(350, 70%, 90%)', display: 'flex', alignItems: 'center', gap: '0.35rem', height: '38px', padding: '0 1rem', boxSizing: 'border-box', fontWeight: 600 }}>
            <span className="icon" style={{ fontSize: '1rem' }}>➖</span> Списать
          </button>
          <button className="btn btn-primary" onClick={openAddModal} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', height: '38px', padding: '0 1.25rem', boxSizing: 'border-box', fontWeight: 600 }}>
            <span className="icon" style={{ fontSize: '1.25rem', lineHeight: '1', display: 'inline-block', transform: 'translateY(-1px)' }}>+</span> {t('action.add')}
          </button>
        </div>
      </header>


      {products.filter(p => (p.quantity || 0) <= (p.minStock || 0)).length > 0 && (
        <section className="alerts-section">
          {products.filter(p => (p.quantity || 0) <= (p.minStock || 0)).map((p, i) => (
            <div key={p.id} className={`alert-card glass-card fade-in delay-${(i % 3) + 1}`}>
              <div className="alert-icon">⚠️</div>
              <div className="alert-content">
                <strong>{t('stock.low')}:</strong> <span className="highlight-text">{p.name}</span> ({t('stock.left')} {(p.quantity || 0).toFixed(1)} {p.unit})
              </div>
            </div>
          ))}
        </section>
      )}

      <div className="filters-bar" style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap' }}>
        <input 
          type="text" 
          placeholder="Поиск по названию или артикулу..." 
          className="input-field" 
          style={{ flex: 1, minWidth: '250px' }}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
        <select 
          className="input-field" 
          style={{ minWidth: '150px' }}
          value={filterCategory}
          onChange={e => setFilterCategory(e.target.value)}
        >
          <option value="ALL">Все категории</option>
          <option value="FLOWER">Цветы</option>
          <option value="GIFT">Подарки</option>
          <option value="PACKAGING">Упаковка</option>
          <option value="MATERIAL">Материалы</option>
        </select>
      </div>

      <div className="table-wrapper glass-card">
        <table className="inventory-table">
          <thead>
            <tr>
              <th>{t('table.sku')}</th>
              <th>{t('table.name')}</th>
              <th>{t('table.category')}</th>
              <th>{t('table.balance')}</th>
              <th>{t('table.units')}</th>
              <th>Штрихкод</th>
              {(userRole === 'OWNER' || userRole === 'ACCOUNTANT') && <th>{t('table.cost')}</th>}
              <th>{t('table.retail')}</th>
              <th className="actions-cell">{t('table.actions')}</th>
            </tr>
          </thead>
          <tbody>
            {filteredProducts.map((p, i) => (
              <tr key={p.id} className={`fade-in delay-${(i % 3) + 1} ${(p.quantity || 0) <= (p.minStock || 0) ? 'row-warning' : ''}`}>
                <td className="sku-cell">#{p.sku}</td>
                <td className="name-cell">{p.name}</td>
                <td>
                  <span className={`badge ${p.category === 'FLOWER' ? 'badge-violet' : p.category === 'GIFT' ? 'badge-pink' : p.category === 'PACKAGING' ? 'badge-orange' : 'badge-green'}`}>
                    {p.category === 'FLOWER' ? 'Цветы' : p.category === 'GIFT' ? 'Подарки' : p.category === 'PACKAGING' ? 'Упаковка' : 'Материалы'}
                  </span>
                </td>
                <td className="qty-cell">
                  <span className={(p.quantity || 0) <= (p.minStock || 0) ? 'text-error font-bold' : 'font-bold'}>
                    {(p.quantity || 0).toFixed(1)}
                  </span>
                </td>
                <td className="unit-cell text-muted">{p.unit}</td>
                <td className="barcode-cell">
                  {(p as any).barcode ? (
                    <div className="barcode-display" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span className="barcode-text">{(p as any).barcode}</span>
                      <div className="barcode-actions" style={{ display: 'flex', gap: '0.15rem' }}>
                        <button className="btn-icon-sm" onClick={() => handlePrintBarcode(p)} title="Печать штрихкода">🖨️</button>
                        <button className="btn-icon-sm" onClick={() => handleCustomBarcodePrompt(p)} title="Задать свой штрихкод">✏️</button>
                        <button className="btn-icon-sm" onClick={() => handleGenerateBarcode(p.id)} title="Перегенерировать штрихкод">🔄</button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <button className="btn-secondary btn-sm" onClick={() => handleGenerateBarcode(p.id)} title="Автоматическая генерация">
                        ⚡ Авто
                      </button>
                      <button className="btn-secondary btn-sm" onClick={() => handleCustomBarcodePrompt(p)} title="Задать свой штрихкод">
                        ✏️ Свой
                      </button>
                    </div>
                  )}
                </td>
                {(userRole === 'OWNER' || userRole === 'ACCOUNTANT') && <td className="price-cell cost">${(p.costPrice || 0).toFixed(2)}</td>}
                <td className="price-cell retail">${(p.retailPrice || 0).toFixed(2)}</td>
                <td className="actions-cell">
                  <button className="btn-icon" onClick={() => openEditModal(p)} title={t('action.edit')}>✏️</button>
                  <button className="btn-icon" onClick={() => handleDelete(p.id)} title="Удалить">🗑️</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && mounted && createPortal(
        <div className="modal-overlay fade-in">
          <div className="modal-content glass-card">
            <h2>{editingProduct ? 'Редактировать товар' : 'Новый товар'}</h2>
            <div className="form-grid">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', gridColumn: 'span 2' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Название товара</label>
                <input type="text" placeholder="Название" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="input-field" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Категория</label>
                <select value={formData.category} onChange={e => setFormData({...formData, category: e.target.value})} className="input-field">
                  <option value="FLOWER">Цветы</option>
                  <option value="GIFT">Подарки</option>
                  <option value="PACKAGING">Упаковка</option>
                  <option value="MATERIAL">Материалы</option>
                </select>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Единица измерения</label>
                <input type="text" placeholder="Ед. изм. (шт, кг)" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} className="input-field" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Количество на складе</label>
                <input type="number" placeholder="Количество" value={formData.quantity} onChange={e => setFormData({...formData, quantity: parseFloat(e.target.value) || 0})} className="input-field" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Минимальный остаток</label>
                <input type="number" placeholder="Мин. остаток" value={formData.minStock} onChange={e => setFormData({...formData, minStock: parseFloat(e.target.value) || 0})} className="input-field" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Себестоимость ($)</label>
                <input 
                  type="number" 
                  placeholder="Себестоимость" 
                  value={formData.costPrice} 
                  onChange={e => {
                    const cost = parseFloat(e.target.value) || 0;
                    let retail = formData.retailPrice;
                    try {
                      const savedMarkup = localStorage.getItem('sarasota_default_markup');
                      if (savedMarkup) {
                        const markup = parseFloat(savedMarkup);
                        if (!isNaN(markup) && markup > 0) {
                          retail = parseFloat((cost * (1 + markup / 100)).toFixed(2));
                        }
                      }
                    } catch (err) {}
                    setFormData({...formData, costPrice: cost, retailPrice: retail});
                  }} 
                  className="input-field" 
                />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Цена продажи ($)</label>
                <input type="number" placeholder="Цена продажи" value={formData.retailPrice} onChange={e => setFormData({...formData, retailPrice: parseFloat(e.target.value) || 0})} className="input-field" />
              </div>
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setIsModalOpen(false)}>Отмена</button>
              <button className="btn btn-primary" onClick={saveProduct}>Сохранить</button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Warehouse Write-off Modal */}
      {isWriteOffModalOpen && mounted && createPortal(
        <div className="modal-overlay fade-in">
          <div className="modal-content glass-card" style={{ maxWidth: '480px' }}>
            <h2>➖ Списание товара со склада</h2>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                  Сканировать штрихкод или артикул
                </label>
                <input 
                  type="text" 
                  placeholder="Отсканируйте штрих-код сканером..." 
                  value={writeOffBarcode} 
                  onChange={e => setWriteOffBarcode(e.target.value)} 
                  onKeyDown={handleBarcodeScan}
                  className="input-field" 
                  autoFocus
                  style={{ background: 'rgba(var(--primary-rgb), 0.03)', border: '1px solid var(--primary)', width: '100%' }}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.35rem', display: 'block' }}>
                  💡 Установите курсор в поле выше и отсканируйте штрих-код. Товар выберется автоматически. Вы также можете нажать Enter для быстрого перевода фокуса на поле количества.
                </span>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                  Или выберите товар вручную
                </label>
                <select 
                  value={writeOffSelectedProductId} 
                  onChange={e => {
                    setWriteOffSelectedProductId(e.target.value);
                    const prod = products.find(p => p.id === e.target.value);
                    if (prod && prod.barcode) {
                      setWriteOffBarcode(prod.barcode);
                    }
                  }} 
                  className="input-field"
                  style={{ width: '100%' }}
                >
                  <option value="">-- Выберите товар из списка --</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} (#{p.sku}) [Остаток: {p.quantity} {p.unit}]
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                  Количество для списания
                </label>
                <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <input 
                    id="write-off-qty-input"
                    type="number" 
                    step="0.1" 
                    placeholder="Количество" 
                    value={writeOffQuantity} 
                    onChange={e => setWriteOffQuantity(e.target.value)} 
                    className="input-field" 
                    style={{ flex: 1 }}
                  />
                  <span style={{ fontSize: '0.9rem', color: 'var(--text-main)', fontWeight: 600, minWidth: '40px' }}>
                    {products.find(p => p.id === writeOffSelectedProductId)?.unit || ''}
                  </span>
                </div>
              </div>
            </div>

            <div className="modal-actions" style={{ marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--surface-border)', display: 'flex', justifyContent: 'flex-end', gap: '0.75rem' }}>
              <button className="btn btn-secondary" onClick={() => setIsWriteOffModalOpen(false)}>Отмена</button>
              <button 
                className="btn btn-primary" 
                onClick={handleExecuteWriteOff}
                disabled={!writeOffSelectedProductId || parseFloat(writeOffQuantity) <= 0}
                style={{ background: 'hsl(350, 75%, 50%)', borderColor: 'hsl(350, 75%, 45%)', color: '#fff', fontWeight: 600 }}
              >
                Списать со склада
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}



      <style jsx>{`
        .loader { height: 60vh; display: flex; flex-direction: column; gap: 1rem; align-items: center; justify-content: center; font-weight: 600; color: var(--primary); }
        .spinner { width: 30px; height: 30px; border: 2px solid rgba(0,0,0,0.1); border-top-color: var(--primary); border-radius: 50%; animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .inventory-dashboard { display: flex; flex-direction: column; gap: 1.5rem; }
        
        .page-header { display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 1rem; }
        .title-section h1 { font-size: 2rem; margin-bottom: 0.25rem; color: var(--text-main); }
        .subtitle { color: var(--text-muted); font-size: 0.95rem; }
        
        .header-actions { display: flex; gap: 1rem; align-items: center; }
        .role-select { width: auto; min-width: 180px; }

        .alerts-section { display: grid; grid-template-columns: repeat(auto-fill, minmax(250px, 1fr)); gap: 1rem; }
        .alert-card { display: flex; align-items: center; gap: 1rem; padding: 1rem; border-left: 4px solid var(--warning); background: hsla(35, 90%, 55%, 0.05); }
        .alert-icon { font-size: 1.25rem; }
        .highlight-text { color: var(--text-main); font-weight: 600; }

        .table-wrapper { overflow-x: auto; border-radius: var(--radius-xl); padding: 1px; }
        .inventory-table { width: 100%; border-collapse: collapse; text-align: left; background: #fff; }
        .inventory-table th, .inventory-table td { padding: 0.75rem 1rem; border-bottom: 1px solid var(--surface-border); }
        .inventory-table th { font-family: 'Outfit', sans-serif; font-size: 0.8rem; font-weight: 600; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.05em; background: rgba(0,0,0,0.02); }
        
        .inventory-table tr { transition: var(--transition); }
        .inventory-table tr:hover:not(thead tr) { background: rgba(0,0,0,0.01); }
        
        .sku-cell { font-family: monospace; font-weight: 600; color: var(--text-muted); font-size: 0.85rem; }
        .name-cell { font-family: 'Outfit', sans-serif; font-weight: 600; color: var(--text-main); font-size: 0.95rem; }
        .font-bold { font-weight: 700; }
        .text-error { color: var(--error); }
        .text-muted { color: var(--text-muted); }
        
        .barcode-display { display: flex; align-items: center; gap: 0.5rem; }
        .barcode-text { font-family: monospace; font-size: 0.85rem; font-weight: 600; color: var(--text-main); }
        .btn-sm { padding: 0.25rem 0.5rem; font-size: 0.75rem; border-radius: var(--radius-sm); border: 1px solid rgba(0,0,0,0.1); background: #fff; cursor: pointer; transition: all 0.2s; }
        .btn-sm:hover { background: rgba(0,0,0,0.02); }
        
        .price-cell { font-family: 'Outfit', sans-serif; font-variant-numeric: tabular-nums; font-weight: 600; }
        .price-cell.cost { color: var(--text-muted); }
        .price-cell.retail { color: var(--success); }
        
        .row-warning { background: linear-gradient(90deg, hsla(35, 90%, 55%, 0.05), transparent) !important; }
        
        .actions-cell { text-align: right; white-space: nowrap; }
        .btn-icon { background: rgba(0,0,0,0.02); padding: 0.4rem; border-radius: var(--radius-sm); margin-left: 0.25rem; transition: var(--transition); border: 1px solid transparent; }
        .btn-icon:hover { background: rgba(0,0,0,0.05); transform: translateY(-1px); border-color: rgba(0,0,0,0.1); }
        .btn-icon-sm { background: rgba(0,0,0,0.02); padding: 0.25rem; border-radius: var(--radius-sm); font-size: 0.75rem; transition: var(--transition); border: 1px solid transparent; cursor: pointer; }
        .btn-icon-sm:hover { background: rgba(0,0,0,0.05); transform: translateY(-1px); border-color: rgba(0,0,0,0.1); }

        @media (max-width: 768px) {
          .page-header { flex-direction: column; align-items: flex-start; }
          .header-actions { flex-direction: column; width: 100%; }
          .role-select, .btn { width: 100%; }
          .form-grid { grid-template-columns: 1fr; }
        }

        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
        .modal-content { padding: 2rem; width: 100%; max-width: 600px; display: flex; flex-direction: column; gap: 1.5rem; background: #ffffff; border-radius: var(--radius-lg); box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
        .modal-content h2 { font-size: 1.5rem; margin: 0; color: var(--text-main); font-family: 'Outfit', sans-serif; }
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .modal-actions { display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1rem; }
      `}</style>
    </div>
  );
}
