'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import type { Product } from '@prisma/client';
import { useLanguage } from './components/LanguageContext';
import { useAuth } from './components/AuthProvider';
import { Download, Minus, Plus, AlertTriangle, Printer, Edit, RefreshCw, Zap, Trash2 } from 'lucide-react';

export default function InventoryPage() {
  const [mounted, setMounted] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [suppliers, setSuppliers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterCategory, setFilterCategory] = useState('ALL');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState({
    sku: '', name: '', nameEn: '', category: 'FLOWER', unit: 'шт', unitEn: '', quantity: 0, minStock: 0, costPrice: 0, retailPrice: 0, supplier: ''
  });

  // Write-Off States
  const [isWriteOffModalOpen, setIsWriteOffModalOpen] = useState(false);
  const [writeOffBarcode, setWriteOffBarcode] = useState('');
  const [writeOffSelectedProductId, setWriteOffSelectedProductId] = useState('');
  const [writeOffQuantity, setWriteOffQuantity] = useState('1');
  const [writeOffReason, setWriteOffReason] = useState('Defective');
  const [writeOffCustomReason, setWriteOffCustomReason] = useState('');

  const WRITE_OFF_REASONS = [
    "Theft", "TransportDamage", "Expired", "Defective", "Shortage", "Obsolete",
    "Lost", "Damaged", "SupplierReturn", "ProductionWaste", "Disaster", "AdminWriteOff",
    "QualityFailure", "Spoilage", "BadStorage", "PromoGiveaway", "GiftToCustomer",
    "Complimentary", "FOC", "Marketing", "PromoWriteOff", "GiftWriteOff", "CUSTOM"
  ];

  // WooCommerce Integration States
  const { t, language } = useLanguage();
  const { user } = useAuth();
  const userRole = user?.role || 'EMPLOYEE';

  // WooCommerce Import States
  const [isWpImportModalOpen, setIsWpImportModalOpen] = useState(false);
  const [wpImportProducts, setWpImportProducts] = useState<any[]>([]);
  const [wpImportSearch, setWpImportSearch] = useState('');
  const [isWpImportLoading, setIsWpImportLoading] = useState(false);

  // Write-off handlers
  const openWriteOffModal = () => {
    setWriteOffBarcode('');
    setWriteOffSelectedProductId('');
    setWriteOffQuantity('1');
    setWriteOffReason('Defective');
    setWriteOffCustomReason('');
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
      const finalReason = writeOffReason === 'CUSTOM' ? writeOffCustomReason : t(`reason.${writeOffReason}`);
      const res = await fetch(`/api/products/${writeOffSelectedProductId}/write-off`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ quantity: qty, userId: user?.name || 'SYSTEM', reason: finalReason })
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

  useEffect(() => {
    fetch('/api/products')
      .then(res => res.json())
      .then(data => {
        setProducts(data);
        setLoading(false);
      });
    fetchSuppliers();
    setMounted(true);
  }, []);

  const handleExport = () => {
    window.location.href = '/api/export/quickbooks';
  };

  const handleGenerateBarcode = async (id: string) => {
    if (userRole === 'DESIGNER') { alert('Действие недоступно для вашей роли.'); return; }
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
    setFormData({ sku: '', name: '', nameEn: '', category: 'FLOWER', unit: 'шт', unitEn: '', quantity: 0, minStock: 0, costPrice: 0, retailPrice: 0, supplier: '' });
    setEditingProduct(null);
    setIsModalOpen(true);
  };

  const openWpImportModal = async () => {
    setIsWpImportModalOpen(true);
    if (wpImportProducts.length === 0) {
      setIsWpImportLoading(true);
      try {
        const res = await fetch('/api/wp/products');
        if (res.ok) {
          const data = await res.json();
          setWpImportProducts(data.filter((p: any) => p.type !== 'variation')); // or allow all
        }
      } catch (e) {
        console.error('Failed to fetch WP products', e);
      } finally {
        setIsWpImportLoading(false);
      }
    }
  };

  const handleSelectWpProduct = (wpProd: any) => {
    setFormData({
      ...formData,
      name: wpProd.name,
      sku: wpProd.sku || '',
      retailPrice: parseFloat(wpProd.regular_price) || parseFloat(wpProd.price) || 0
    });
    setIsWpImportModalOpen(false);
  };

  const openEditModal = (p: Product) => {
    setFormData({
      sku: p.sku, name: p.name, nameEn: (p as any).nameEn || '', category: p.category, unit: p.unit, unitEn: (p as any).unitEn || '',
      quantity: p.quantity || 0, minStock: p.minStock || 0, costPrice: p.costPrice || 0, retailPrice: p.retailPrice || 0, supplier: (p as any).supplier || ''
    });
    setEditingProduct(p);
    setIsModalOpen(true);
  };

  const saveProduct = async () => {
    if (userRole === 'DESIGNER') { alert('Действие недоступно для вашей роли.'); return; }
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
    if (userRole === 'DESIGNER') { alert('Действие недоступно для вашей роли.'); return; }
        if (!confirm('Вы уверены, что хотите удалить этот товар?')) return;
    try {
      const res = await fetch(`/api/products/${id}`, { method: 'DELETE' });
      if (res.ok) setProducts(products.filter(p => p.id !== id));
    } catch (e) {
      console.error(e);
    }
  };

  // Generates a complete UPC-A SVG inline — no external libs, scales at any DPI
  const buildUpcASvg = (digits: string): string => {
    const L = ['0001101','0011001','0010011','0111101','0100011','0110001','0101111','0111011','0110111','0001011'];
    const R = L.map(c => c.split('').map(b => b === '0' ? '1' : '0').join(''));

    let enc = '101';
    for (let i = 0; i < 6; i++) enc += L[parseInt(digits[i])];
    enc += '01010';
    for (let i = 6; i < 12; i++) enc += R[parseInt(digits[i])];
    enc += '101';

    // UPC-A: 95 modules total + 9 quiet zone each side
    const mw = 2;       // module width px
    const barH = 40;    // regular bar height
    const guardH = 50;  // guard bar height (start/center/end)
    const qz = 9;       // quiet zone modules
    const W = (enc.length + qz * 2) * mw; // 226
    const H = 62;       // total SVG height (50 guard + 12 for digits)
    const ty = H - 2;   // text baseline y

    let rects = '';
    for (let j = 0; j < enc.length; j++) {
      if (enc[j] === '1') {
        const isGuard = j < 3 || (j >= 45 && j < 50) || j >= 92;
        rects += `<rect x="${(qz + j) * mw}" y="0" width="${mw}" height="${isGuard ? guardH : barH}" fill="#000"/>`;
      }
    }

    // Digit positions (centers of each group)
    const d0x  = (qz - 1.5) * mw;      // system digit — left of start guard
    const dLx  = (qz + 24) * mw;        // digits 1-5 center
    const dRx  = (qz + 71) * mw;        // digits 6-10 center
    const d11x = (qz + 96.5) * mw;      // check digit — right of end guard

    const txt = `<text font-family="Arial,Helvetica,sans-serif" font-size="11" font-weight="bold" fill="#000">`
      + `<tspan x="${d0x}"  y="${ty}" text-anchor="middle">${digits[0]}</tspan>`
      + `<tspan x="${dLx}"  y="${ty}" text-anchor="middle">${digits.slice(1, 6)}</tspan>`
      + `<tspan x="${dRx}"  y="${ty}" text-anchor="middle">${digits.slice(6, 11)}</tspan>`
      + `<tspan x="${d11x}" y="${ty}" text-anchor="middle">${digits[11]}</tspan>`
      + `</text>`;

    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" style="display:block;margin:0 auto">`
      + `<rect width="${W}" height="${H}" fill="white"/>`
      + rects + txt
      + `</svg>`;
  };

  const handlePrintBarcode = (product: Product) => {
    const barcodeValue = (product as any).barcode;
    if (!barcodeValue || !/^\d{12}$/.test(barcodeValue)) {
      alert('У этого товара нет корректного UPC-A штрихкода (12 цифр). Сначала создайте штрихкод.');
      return;
    }
    const qtyStr = prompt(`Сколько этикеток напечатать для "${product.name}"?`, '2');
    if (qtyStr === null) return;
    const copies = parseInt(qtyStr) || 1;
    if (copies <= 0) return;

    const displayName = (product as any).nameEn || product.name;
    const price = product.retailPrice
      ? parseFloat(product.retailPrice.toString()).toFixed(2)
      : parseFloat((product as any).price || 0).toFixed(2);
    const supplier = (product as any).supplier || '';
    const barcodeSvg = buildUpcASvg(barcodeValue);

    let labelsHtml = '';
    for (let i = 0; i < copies; i++) {
      labelsHtml += `<div class="label"><div class="name">${displayName}</div><div class="prc">$${price}${supplier ? ` <span class="sup">${supplier}</span>` : ''}</div>${barcodeSvg}</div>`;
    }

    const win = window.open('', '_blank', 'width=500,height=700');
    if (!win) {
      alert('Разрешите всплывающие окна в браузере (pop-ups) для печати этикеток!');
      return;
    }

    win.document.write(`<!DOCTYPE html><html><head><title>Label</title><style>
@page{size:2.25in 1.25in;margin:0}
html,body{margin:0;padding:0;width:2.25in;height:1.25in;background:#fff;overflow:hidden}
*{box-sizing:border-box}
.label{width:2.25in;height:1.25in;display:flex;flex-direction:column;justify-content:center;align-items:center;padding:3px 2px 2px;page-break-after:always;overflow:hidden;margin:0}
.label:last-child{page-break-after:avoid}
.name{font:800 10px Arial,sans-serif;color:#000;width:100%;text-align:center;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-bottom:1px;line-height:1.2}
.prc{font:800 10px Arial,sans-serif;color:#000;text-align:center;margin-bottom:2px;line-height:1.2}
.sup{font:700 9px Arial,sans-serif;color:#000}
</style></head><body>${labelsHtml}<script>setTimeout(function(){window.print();},150);<\/script></body></html>`);
    win.document.close();
  };

  const handleCustomBarcodePrompt = async (product: Product) => {
    if (userRole === 'DESIGNER') { alert('Действие недоступно для вашей роли.'); return; }
        const val = prompt(`Укажите штрих-код UPC-A (ровно 12 цифр) для "${product.name}":`, (product as any).barcode || '');
    if (val === null) return;
    const trimmed = val.trim();

    if (!/^\d{12}$/.test(trimmed)) {
      alert('Штрих-код должен содержать ровно 12 цифр (формат UPC-A).\nПример: 012345678905');
      return;
    }
    
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
            <Download size={16} /> {t('action.export')}
          </button>
          <button className="btn btn-secondary" onClick={openWriteOffModal} style={{ background: 'hsl(350, 75%, 96%)', color: 'hsl(350, 75%, 35%)', borderColor: 'hsl(350, 70%, 90%)', display: 'flex', alignItems: 'center', gap: '0.35rem', height: '38px', padding: '0 1rem', boxSizing: 'border-box', fontWeight: 600, opacity: 1 }}>
            <Minus size={16} /> Списать
          </button>
          <button className="btn btn-primary" onClick={openAddModal} style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', height: '38px', padding: '0 1.25rem', boxSizing: 'border-box', fontWeight: 600, opacity: 1 }}>
            <Plus size={20} /> {t('action.add')}
          </button>
        </div>
      </header>


      {products.filter(p => (p.quantity || 0) <= (p.minStock || 0)).length > 0 && (
        <section className="alerts-section">
          {products.filter(p => (p.quantity || 0) <= (p.minStock || 0)).map((p, i) => (
            <div key={p.id} className={`alert-card glass-card fade-in delay-${(i % 3) + 1}`}>
              <div className="alert-icon"><AlertTriangle size={24} className="text-warning" /></div>
              <div className="alert-content">
                <strong>{t('stock.low')}:</strong> <span className="highlight-text">{language === 'EN' && (p as any).nameEn ? (p as any).nameEn : p.name}</span> ({t('stock.left')} {(p.quantity || 0).toFixed(1)} {language === 'EN' && (p as any).unitEn ? (p as any).unitEn : p.unit})
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
              <th>№</th>
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
                <td data-label="№" className="sku-cell" style={{ color: 'var(--text-muted)' }}>{i + 1}</td>
                <td data-label={t('table.name')} className="name-cell">{language === 'EN' && (p as any).nameEn ? (p as any).nameEn : p.name}</td>
                <td data-label={t('table.category')}>
                  <span className={`badge ${p.category === 'FLOWER' ? 'badge-violet' : p.category === 'GIFT' ? 'badge-pink' : p.category === 'PACKAGING' ? 'badge-orange' : 'badge-green'}`}>
                    {p.category === 'FLOWER' ? 'Цветы' : p.category === 'GIFT' ? 'Подарки' : p.category === 'PACKAGING' ? 'Упаковка' : 'Материалы'}
                  </span>
                </td>
                <td data-label={t('table.balance')} className="qty-cell">
                  <span className={(p.quantity || 0) <= (p.minStock || 0) ? 'text-error font-bold' : 'font-bold'}>
                    {(p.quantity || 0).toFixed(1)}
                  </span>
                </td>
                <td data-label={t('table.units')} className="unit-cell text-muted">{language === 'EN' && (p as any).unitEn ? (p as any).unitEn : p.unit}</td>
                <td data-label="Штрихкод" className="barcode-cell">
                  {(p as any).barcode ? (
                    <div className="barcode-display" style={{ display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <span className="barcode-text">{(p as any).barcode}</span>
                      <div className="barcode-actions" style={{ display: 'flex', gap: '0.15rem' }}>
                        <button className="btn-icon-sm" onClick={() => handlePrintBarcode(p)} title="Печать штрихкода"><Printer size={14} /></button>
                        <button className="btn-icon-sm" onClick={() => handleCustomBarcodePrompt(p)} title="Задать свой штрихкод"><Edit size={14} /></button>
                        <button className="btn-icon-sm" onClick={() => handleGenerateBarcode(p.id)} title="Перегенерировать штрихкод"><RefreshCw size={14} /></button>
                      </div>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', gap: '0.35rem' }}>
                      <button className="btn-secondary btn-sm" onClick={() => handleGenerateBarcode(p.id)} title="Автоматическая генерация">
                        <Zap size={14} /> Авто
                      </button>
                      <button className="btn-secondary btn-sm" onClick={() => handleCustomBarcodePrompt(p)} title="Задать свой штрихкод">
                        <Edit size={14} /> Свой
                      </button>
                    </div>
                  )}
                </td>
                {(userRole === 'OWNER' || userRole === 'ACCOUNTANT') && (
                  <td data-label={t('table.cost')} className="price-cell cost">
                    ${(p.costPrice || 0).toFixed(2)}
                    {(p as any).supplier && <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: '0.15rem' }}>От: {(p as any).supplier}</div>}
                  </td>
                )}
                <td data-label={t('table.retail')} className="price-cell retail">${(p.retailPrice || 0).toFixed(2)}</td>
                <td data-label={t('table.actions')} className="actions-cell">
                  <button className="btn-icon" onClick={() => openEditModal(p)} title={t('action.edit')}><Edit size={18} /></button>
                  <button className="btn-icon" onClick={() => handleDelete(p.id)} title="Удалить"><Trash2 size={18} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {isModalOpen && mounted && createPortal(
        <div className="modal-overlay fade-in">
          <div className="modal-content glass-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <h2>{editingProduct ? 'Редактировать товар' : 'Новый товар'}</h2>
              {!editingProduct && (
                <button 
                  className="btn btn-secondary btn-sm" 
                  onClick={openWpImportModal}
                 
                  style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', borderColor: 'var(--primary)', color: 'var(--primary)', padding: '0.4rem 0.75rem', fontSize: '0.85rem', opacity: 1 }}
                >
                  <Download size={14} /> Импорт из WooCommerce
                </button>
              )}
            </div>
            <div className="form-grid">
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', gridColumn: 'span 1' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Название товара (RU)</label>
                <input type="text" placeholder="Название на русском" value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="input-field" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', gridColumn: 'span 1' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Название товара (EN)</label>
                <input type="text" placeholder="Product Name in English" value={formData.nameEn} onChange={e => setFormData({...formData, nameEn: e.target.value})} className="input-field" />
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
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Единица измерения (RU)</label>
                <input type="text" placeholder="Ед. изм. (шт, кг)" value={formData.unit} onChange={e => setFormData({...formData, unit: e.target.value})} className="input-field" />
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Единица измерения (EN)</label>
                <input type="text" placeholder="Unit (pcs, kg)" value={formData.unitEn} onChange={e => setFormData({...formData, unitEn: e.target.value})} className="input-field" />
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
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Цена закупки ($)</label>
                <input 
                  type="number" 
                  placeholder="Цена закупки" 
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
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)' }}>Поставщик (опционально)</label>
                <select value={formData.supplier} onChange={e => setFormData({...formData, supplier: e.target.value})} className="input-field">
                  <option value="">Не указан</option>
                  {suppliers.map(s => (
                    <option key={s.id} value={s.name}>{s.name}</option>
                  ))}
                </select>
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
            <h2 style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Minus size={24} /> Списание товара со склада</h2>
            
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

              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                  Причина списания
                </label>
                <select 
                  value={writeOffReason} 
                  onChange={e => setWriteOffReason(e.target.value)} 
                  className="input-field"
                  style={{ width: '100%' }}
                >
                  {WRITE_OFF_REASONS.map(r => (
                    <option key={r} value={r}>{t(`reason.${r}`)}</option>
                  ))}
                </select>
              </div>

              {writeOffReason === 'CUSTOM' && (
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                    Укажите причину (свой вариант)
                  </label>
                  <input 
                    type="text" 
                    placeholder="Введите причину..." 
                    value={writeOffCustomReason} 
                    onChange={e => setWriteOffCustomReason(e.target.value)} 
                    className="input-field" 
                    style={{ width: '100%' }}
                  />
                </div>
              )}
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

      {/* WooCommerce Import Modal */}
      {isWpImportModalOpen && mounted && createPortal(
        <div className="modal-overlay fade-in" style={{ zIndex: 1100 }}>
          <div className="modal-content glass-card" style={{ maxWidth: '600px', maxHeight: '80vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}><Download size={24} /> Выберите товар из WooCommerce</h2>
              <button className="btn btn-secondary btn-sm" onClick={() => setIsWpImportModalOpen(false)}>✕</button>
            </div>
            
            <input 
              type="text" 
              placeholder="Поиск по названию или артикулу..." 
              className="input-field" 
              value={wpImportSearch}
              onChange={e => setWpImportSearch(e.target.value)}
              style={{ marginBottom: '1rem' }}
            />

            <div style={{ flex: 1, overflowY: 'auto', border: '1px solid var(--surface-border)', borderRadius: 'var(--radius-md)', padding: '0.5rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
              {isWpImportLoading ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Загрузка товаров...</div>
              ) : wpImportProducts.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>Товары не найдены</div>
              ) : (
                wpImportProducts
                  .filter(p => p.name.toLowerCase().includes(wpImportSearch.toLowerCase()) || (p.sku && p.sku.toLowerCase().includes(wpImportSearch.toLowerCase())))
                  .slice(0, 50)
                  .map(p => (
                    <div 
                      key={p.id} 
                      onClick={() => handleSelectWpProduct(p)}
                      style={{ padding: '0.75rem', border: '1px solid var(--surface-border)', borderRadius: 'var(--radius-sm)', cursor: 'pointer', transition: 'background 0.2s', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
                      onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.02)'}
                      onMouseLeave={e => e.currentTarget.style.background = 'transparent'}
                    >
                      <div>
                        <div style={{ fontWeight: 600, color: 'var(--text-main)' }}>{p.name}</div>
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Артикул: {p.sku || '—'}</div>
                      </div>
                      <div style={{ fontWeight: 700, color: 'var(--success)' }}>
                        ${parseFloat(p.regular_price || p.price || 0).toFixed(2)}
                      </div>
                    </div>
                  ))
              )}
            </div>
            
            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem', textAlign: 'center' }}>
              Показано до 50 товаров. Используйте поиск для уточнения.
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
        .inventory-table { width: 100%; border-collapse: collapse; text-align: left; background: transparent; }
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
        .btn-sm { padding: 0.25rem 0.5rem; font-size: 0.75rem; border-radius: var(--radius-sm); border: 1px solid rgba(0,0,0,0.1); background: var(--surface-base); cursor: pointer; transition: all 0.2s; }
        .btn-sm:hover { background: rgba(0,0,0,0.05); }
        
        .price-cell { font-family: 'Outfit', sans-serif; font-variant-numeric: tabular-nums; font-weight: 600; }
        .price-cell.cost { color: var(--text-muted); }
        .price-cell.retail { color: var(--success); }
        
        .row-warning { background: linear-gradient(90deg, hsla(35, 90%, 55%, 0.05), transparent) !important; }
        
        .actions-cell { text-align: right; white-space: nowrap; }
        .btn-icon { background: rgba(0,0,0,0.02); padding: 0.4rem; border-radius: var(--radius-sm); margin-left: 0.25rem; transition: var(--transition); border: 1px solid transparent; color: var(--text-main); }
        .btn-icon:hover { background: rgba(0,0,0,0.05); transform: translateY(-1px); border-color: rgba(0,0,0,0.1); }
        .btn-icon-sm { background: rgba(0,0,0,0.02); padding: 0.25rem; border-radius: var(--radius-sm); font-size: 0.75rem; transition: var(--transition); border: 1px solid transparent; cursor: pointer; color: var(--text-main); }
        .btn-icon-sm:hover { background: rgba(0,0,0,0.05); transform: translateY(-1px); border-color: rgba(0,0,0,0.1); }

        @media (max-width: 768px) {
          .stats-grid { grid-template-columns: 1fr; }
          .hero-content h1 { font-size: 2.5rem; }
          .hero-content p { font-size: 1rem; }
          
          /* Table to Cards */
          .inventory-table, .inventory-table tbody, .inventory-table tr, .inventory-table td {
            display: block;
            width: 100%;
          }
          .inventory-table thead {
            display: none;
          }
          .inventory-table tr {
            margin-bottom: 1rem;
            border: 1px solid var(--surface-border);
            border-radius: var(--radius-md);
            background: var(--surface-base) !important;
            padding: 1rem;
          }
          .inventory-table td {
            border-bottom: 1px solid rgba(0,0,0,0.05);
            padding: 0.5rem 0;
            display: flex;
            justify-content: space-between;
            align-items: center;
          }
          .inventory-table td:last-child {
            border-bottom: none;
            padding-bottom: 0;
            justify-content: flex-end;
          }
          .inventory-table td::before {
            content: attr(data-label);
            font-weight: 600;
            color: var(--text-muted);
            font-size: 0.8rem;
            padding-right: 1rem;
          }
          .page-header { flex-direction: column; align-items: flex-start; }
          .header-actions { flex-direction: column; width: 100%; }
          .role-select, .btn { width: 100%; }
          .form-grid { grid-template-columns: 1fr; }
        }

        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
        .modal-content { padding: 2rem; width: 100%; max-width: 600px; display: flex; flex-direction: column; gap: 1.5rem; background: var(--surface-base); border-radius: var(--radius-lg); box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
        .modal-content h2 { font-size: 1.5rem; margin: 0; color: var(--text-main); font-family: 'Outfit', sans-serif; }
        .form-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
        .modal-actions { display: flex; justify-content: flex-end; gap: 1rem; margin-top: 1rem; }
      `}</style>
    </div>
  );
}
