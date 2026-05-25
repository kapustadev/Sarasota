// Assembly Page Rewrite
'use client';

import { useState, useMemo, useEffect } from 'react';
import type { Product } from '@prisma/client';
import { useLanguage } from '../components/LanguageContext';
import { useAuth } from '../components/AuthProvider';
import Modal from '../components/Modal';

interface AssemblyItem {
  productId: string;
  quantity: number;
}

export default function AssemblyPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [templates, setTemplates] = useState<any[]>([]);
  const [items, setItems] = useState<AssemblyItem[]>([]);
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState<'MATERIALS'|'TEMPLATES'>('MATERIALS');
  const [searchQuery, setSearchQuery] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [mobileView, setMobileView] = useState<'catalog' | 'workspace'>('catalog');
  
  // Template Modal State
  const [isTemplateModalOpen, setIsTemplateModalOpen] = useState(false);
  const [templateName, setTemplateName] = useState('');
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [customPrice, setCustomPrice] = useState<string>('');
  const [scanInput, setScanInput] = useState('');
  
  const { t } = useLanguage();
  const { user } = useAuth();

  const handleBarcodeScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const code = scanInput.trim();
      if (!code) return;

      const found = products.find(
        p => (p as any).barcode?.toLowerCase() === code.toLowerCase() || p.sku.toLowerCase() === code.toLowerCase()
      );

      if (found) {
        addItem(found.id);
        setScanInput('');
      } else {
        alert(`Товар со штрихкодом/артикулом "${code}" не найден на складе`);
        setScanInput('');
      }
    }
  };
  const userRole = user?.role || 'EMPLOYEE';

  useEffect(() => {
    Promise.all([
      fetch('/api/products').then(res => res.json()),
      fetch('/api/templates').then(res => res.json())
    ]).then(([productsData, templatesData]) => {
      setProducts(Array.isArray(productsData) ? productsData : []);
      setTemplates(Array.isArray(templatesData) ? templatesData : []);
      setLoading(false);
    });
  }, []);

  const selectedProducts = useMemo(() => {
    return items.map(item => {
      const product = products.find(p => p.id === item.productId);
      return { ...product, selectedQty: item.quantity } as Product & { selectedQty: number };
    }).filter(p => !!p.id);
  }, [items, products]);

  const totals = useMemo(() => {
    return selectedProducts.reduce((acc, p) => ({
      cost: acc.cost + ((p.costPrice || 0) * p.selectedQty),
      retail: acc.retail + ((p.retailPrice || 0) * p.selectedQty)
    }), { cost: 0, retail: 0 });
  }, [selectedProducts]);

  const addItem = (productId: string) => {
    setItems(prev => {
      const existing = prev.find(i => i.productId === productId);
      if (existing) {
        return prev.map(i => i.productId === productId ? { ...i, quantity: i.quantity + 1 } : i);
      }
      return [...prev, { productId, quantity: 1 }];
    });
  };

  const removeItem = (productId: string) => {
    setItems(prev => prev.filter(i => i.productId !== productId));
  };

  const updateQty = (productId: string, qty: number) => {
    if (qty <= 0) return removeItem(productId);
    setItems(prev => prev.map(i => i.productId === productId ? { ...i, quantity: qty } : i));
  };

  const handleCreate = async (finalStatus = 'AVAILABLE') => {
    if (items.length === 0) return;
    const finalRetailPrice = customPrice !== '' ? parseFloat(customPrice) : totals.retail;
    if (isNaN(finalRetailPrice) || finalRetailPrice < 0) {
      alert('Пожалуйста, введите корректную розничную цену');
      return;
    }
    
    if (finalRetailPrice < totals.cost) {
      alert(`Ошибка: Розничная цена ($${finalRetailPrice.toFixed(2)}) не может быть ниже цены закупки ($${totals.cost.toFixed(2)}). Пожалуйста, укажите цену выше закупки.`);
      return;
    }

    try {
      const res = await fetch('/api/assembly/complete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: `Букет от ${new Date().toLocaleDateString()}`,
          retailPrice: finalRetailPrice,
          items: items.map(i => ({ id: i.productId, quantity: i.quantity })),
          releaseReserved: false,
          status: finalStatus
        })
      });
      if (res.ok) {
        alert(finalStatus === 'SOLD' ? 'Букет успешно продан!' : 'Букет успешно перенесен на витрину!');
        setItems([]);
        setCustomPrice('');
      } else {
        alert('Ошибка при переносе на витрину');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleSaveTemplate = () => {
    if (items.length === 0) return;
    setTemplateName('');
    setIsTemplateModalOpen(true);
  };

  const confirmSaveTemplate = async () => {
    if (!templateName.trim()) return;
    setSavingTemplate(true);
    try {
      const res = await fetch('/api/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: templateName,
          totalCost: totals.cost,
          totalRetail: totals.retail,
          items: items.map(i => ({ id: i.productId, quantity: i.quantity }))
        })
      });
      if (res.ok) {
         const { template } = await res.json();
         setTemplates(prev => [template, ...prev]);
         setIsTemplateModalOpen(false);
         alert('Шаблон успешно сохранен!');
      }
    } catch(e) {
      console.error(e);
      alert('Ошибка при сохранении шаблона');
    } finally {
      setSavingTemplate(false);
    }
  };

  const handleDeleteTemplate = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation(); // Don't load the template when clicking delete
    if (!confirm('Вы уверены, что хотите удалить этот шаблон?')) return;

    try {
      const res = await fetch(`/api/templates/${id}`, { method: 'DELETE' });
      if (res.ok) {
        setTemplates(prev => prev.filter(t => t.id !== id));
      } else {
        alert('Ошибка при удалении шаблона');
      }
    } catch (e) {
      console.error(e);
    }
  };

  const loadTemplate = (template: any) => {
    const parsed = JSON.parse(template.items);
    // Overwrite the cart with the template's components
    setItems(parsed.map((p: any) => ({ productId: p.id, quantity: p.quantity })));
  };

  const filteredProducts = products.filter(p => {
    const s = searchQuery.toLowerCase();
    const matchesSearch = 
      p.name.toLowerCase().includes(s) || 
      p.sku.toLowerCase().includes(s) || 
      (p as any).barcode?.toLowerCase().includes(s);
    const matchesCategory = categoryFilter === 'ALL' || p.category === categoryFilter;
    return matchesSearch && matchesCategory;
  });
  const filteredTemplates = templates.filter(t => t.name.toLowerCase().includes(searchQuery.toLowerCase()));

  if (loading) return (
    <div className="loader fade-in">
      <div className="spinner"></div>
      <span>{t('assembly.loading')}</span>
    </div>
  );

  return (
    <>
      <div className="assembly-container fade-in">
      <header className="page-header">
        <div className="title-section">
          <h1>{t('assembly.title')}</h1>
          <p className="subtitle">{t('assembly.subtitle')}</p>
        </div>
        <div className="header-actions">
          {/* Removed manual role selector */}
        </div>
      </header>

      {/* Mobile View Toggle Tabs */}
      <div className="mobile-assembly-tabs">
        <button 
          onClick={() => setMobileView('catalog')} 
          className={`tab-btn ${mobileView === 'catalog' ? 'active' : ''}`}
        >
          🌸 Каталог ({products.length})
        </button>
        <button 
          onClick={() => setMobileView('workspace')} 
          className={`tab-btn ${mobileView === 'workspace' ? 'active' : ''}`}
        >
          💐 Букет ({items.length})
        </button>
      </div>

      <div className="assembly-grid">
        <section className={`catalog scrollable ${mobileView === 'catalog' ? 'active-mobile' : 'hidden-mobile'}`}>
          <div className="catalog-header">
            <div style={{display:'flex', gap:'1rem'}}>
              <h2 
                style={{ cursor:'pointer', color: activeTab === 'MATERIALS' ? 'var(--text-main)' : 'var(--text-muted)' }} 
                onClick={() => setActiveTab('MATERIALS')}
              >
                Материалы
              </h2>
              <h2 
                style={{ cursor:'pointer', color: activeTab === 'TEMPLATES' ? 'var(--text-main)' : 'var(--text-muted)' }} 
                onClick={() => setActiveTab('TEMPLATES')}
              >
                Шаблоны
              </h2>
            </div>
            {activeTab === 'MATERIALS' && (
              <div className="catalog-filters">
                <span 
                  className={`badge badge-all ${categoryFilter === 'ALL' ? 'active' : ''}`}
                  onClick={() => setCategoryFilter('ALL')}
                >
                  Все
                </span>
                <span 
                  className={`badge badge-violet ${categoryFilter === 'FLOWER' ? 'active' : ''}`}
                  onClick={() => setCategoryFilter('FLOWER')}
                >
                  Цветы
                </span>
                <span 
                  className={`badge badge-pink ${categoryFilter === 'GIFT' ? 'active' : ''}`}
                  onClick={() => setCategoryFilter('GIFT')}
                >
                  Подарки
                </span>
                <span 
                  className={`badge badge-orange ${categoryFilter === 'PACKAGING' ? 'active' : ''}`}
                  onClick={() => setCategoryFilter('PACKAGING')}
                >
                  Упаковка
                </span>
                <span 
                  className={`badge badge-green ${categoryFilter === 'MATERIAL' ? 'active' : ''}`}
                  onClick={() => setCategoryFilter('MATERIAL')}
                >
                  Материалы
                </span>
              </div>
            )}
          </div>

          <div className="assembly-search-row" style={{ marginBottom: '1rem', display: 'flex', gap: '0.75rem' }}>
            <input 
              type="text" 
              placeholder={activeTab === 'MATERIALS' ? "Поиск по материалам..." : "Поиск по шаблонам..."} 
              className="input-field" 
              style={{ flex: 2 }}
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
            />
            {activeTab === 'MATERIALS' && (
              <div style={{ position: 'relative', flex: 1, display: 'flex' }}>
                <input 
                  type="text" 
                  placeholder="📟 Сканировать штрих-код..." 
                  className="input-field" 
                  style={{
                    paddingLeft: '2.2rem',
                    border: '1px solid var(--primary)',
                    boxShadow: '0 0 5px rgba(230, 92, 141, 0.1)'
                  }}
                  value={scanInput}
                  onChange={e => setScanInput(e.target.value)}
                  onKeyDown={handleBarcodeScan}
                />
                <span style={{ position: 'absolute', left: '0.75rem', top: '50%', transform: 'translateY(-50%)', opacity: 0.6, pointerEvents: 'none' }}>
                  🏷️
                </span>
              </div>
            )}
          </div>
          
          <div className="catalog-list">
            {activeTab === 'MATERIALS' ? (
              filteredProducts.map((p, i) => (
                <div key={p.id} className={`catalog-item glass-card fade-in-up delay-${(i % 3) + 1}`} onClick={() => addItem(p.id)}>
                  <div className="item-info">
                    <span className="item-name">{p.name}</span>
                    <span className="item-stock text-muted">{t('table.balance')}: {(p.quantity || 0).toFixed(1)} {p.unit}</span>
                  </div>
                  <div className="item-action">
                    <span className="item-price">${(p.retailPrice || 0).toFixed(2)}</span>
                    <button className="add-btn-circle">+</button>
                  </div>
                </div>
              ))
            ) : (
              filteredTemplates.map((tmp, i) => (
                <div key={tmp.id} className={`catalog-item glass-card template-card fade-in-up delay-${(i % 3) + 1}`} onClick={() => loadTemplate(tmp)}>
                  <div className="item-info">
                    <span className="item-name">{tmp.name}</span>
                    <div className="template-contents text-muted">
                      {(() => {
                        try {
                          const parsed = JSON.parse(tmp.items);
                          return parsed.map((pi: any) => {
                            const prod = products.find(p => p.id === pi.id);
                            return `${prod?.name || '...'} (${pi.quantity})`;
                          }).join(', ');
                        } catch (e) { return ''; }
                      })()}
                    </div>
                    <div className="template-pricing">
                      {userRole !== 'EMPLOYEE' && (
                        <div className="price-row cost-row-small">
                          <span className="label">Себест:</span>
                          <span className="value cost">${tmp.totalCost.toFixed(2)}</span>
                        </div>
                      )}
                      <div className="price-row">
                        <span className="label">Розница:</span>
                        <span className="value retail">${tmp.totalRetail.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                  <div className="item-action">
                    <button 
                      className="delete-template-btn" 
                      onClick={(e) => handleDeleteTemplate(e, tmp.id)}
                      title="Удалить шаблон"
                    >
                      🗑️
                    </button>
                    <button className="add-btn-circle" title="Загрузить шаблон">↓</button>
                  </div>
                </div>
              ))
            )}
          </div>
        </section>

        <section className={`workspace glass-card ${mobileView === 'workspace' ? 'active-mobile' : 'hidden-mobile'}`}>
          <div className="workspace-header">
            <h2>{t('assembly.materials')}</h2>
            <span className="item-count">{items.length} поз.</span>
          </div>
          
          {items.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">💐</div>
              <p>{t('assembly.materials_desc')}</p>
            </div>
          ) : (
            <div className="selected-list">
              {selectedProducts.map((p, i) => (
                <div key={p.id} className="selected-item fade-in">
                  <div className="item-details">
                    <span className="name">{p.name}</span>
                    <span className="price">${p.retailPrice.toFixed(2)} / {p.unit}</span>
                  </div>
                  <div className="item-controls">
                    <div className="qty-control">
                      <button onClick={() => updateQty(p.id, p.selectedQty - 1)}>-</button>
                      <input 
                        type="number" 
                        value={p.selectedQty} 
                        onChange={(e) => updateQty(p.id, parseInt(e.target.value) || 0)}
                      />
                      <button onClick={() => updateQty(p.id, p.selectedQty + 1)}>+</button>
                    </div>
                    <span className="row-total font-bold">${(p.retailPrice * p.selectedQty).toFixed(2)}</span>
                    <button className="remove-btn" onClick={() => removeItem(p.id)}>×</button>
                  </div>
                </div>
              ))}
            </div>
          )}

          <div className="totals-section">
            <div className="total-row main" style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
              <span>{t('table.retail')}:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.25rem', marginLeft: 'auto' }}>
                <span style={{ fontSize: '1rem', color: 'var(--primary)', fontWeight: 700 }}>$</span>
                <input 
                  type="number"
                  step="0.01"
                  value={customPrice !== '' ? customPrice : totals.retail.toFixed(2)}
                  onChange={(e) => setCustomPrice(e.target.value)}
                  style={{
                    width: '110px',
                    padding: '0.35rem 0.5rem',
                    borderRadius: 'var(--radius-sm)',
                    border: '1px solid var(--surface-border)',
                    textAlign: 'right',
                    fontWeight: 700,
                    fontSize: '1.1rem',
                    color: 'var(--primary)',
                    background: 'rgba(255, 255, 255, 0.8)',
                    outline: 'none'
                  }}
                  placeholder={totals.retail.toFixed(2)}
                />
                {customPrice !== '' && (
                  <button 
                    onClick={() => setCustomPrice('')} 
                    style={{
                      background: 'none',
                      border: 'none',
                      cursor: 'pointer',
                      fontSize: '0.9rem',
                      color: 'var(--text-muted)',
                      padding: '0 0.25rem',
                      display: 'flex',
                      alignItems: 'center'
                    }}
                    title="Сбросить на расчетную цену"
                  >
                    🔄
                  </button>
                )}
              </div>
            </div>
            {userRole !== 'EMPLOYEE' && (
              <div className="total-row cost-row">
                <span>{t('table.cost')}:</span>
                <span>${totals.cost.toFixed(2)}</span>
              </div>
            )}
            {userRole !== 'EMPLOYEE' && (
              <div className="total-row profit-row">
                <span>{t('analytics.profit')}:</span>
                <span className="text-success">${(totals.retail - totals.cost).toFixed(2)}</span>
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '1rem' }}>
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <button 
                  className="btn btn-secondary" 
                  style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem' }} 
                  disabled={items.length === 0} 
                  onClick={handleSaveTemplate}
                  title="Сохранить как шаблон"
                >
                  💾 Шаблон
                </button>
                <button 
                  className="btn btn-primary" 
                  style={{ flex: 1.5, background: 'var(--success)', padding: '0.5rem', fontSize: '0.85rem' }} 
                  disabled={items.length === 0} 
                  onClick={() => handleCreate('AVAILABLE')}
                >
                  🌸 На витрину
                </button>
              </div>
              <button 
                className="btn btn-primary" 
                style={{ width: '100%', background: 'var(--primary)', padding: '0.5rem', fontSize: '0.85rem' }} 
                disabled={items.length === 0} 
                onClick={() => handleCreate('SOLD')}
              >
                💰 Продать сразу
              </button>
            </div>

          </div>
        </section>
      </div>

      <style jsx>{`
        .loader { height: 60vh; display: flex; flex-direction: column; gap: 1rem; align-items: center; justify-content: center; font-weight: 600; color: var(--primary); }
        .spinner { width: 30px; height: 30px; border: 2px solid rgba(0,0,0,0.1); border-top-color: var(--primary); border-radius: 50%; animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        .assembly-container { display: flex; flex-direction: column; gap: 1.5rem; }
        .page-header { display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 1rem; }
        .title-section h1 { font-size: 2rem; margin-bottom: 0.25rem; color: var(--text-main); }
        .subtitle { color: var(--text-muted); font-size: 0.95rem; }
        
        .role-select { width: auto; min-width: 180px; }
        
        .assembly-grid { display: grid; grid-template-columns: 1fr 380px; gap: 1.5rem; align-items: start; }
        
        .catalog { display: flex; flex-direction: column; gap: 1rem; }
        .catalog-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.25rem; }
        .catalog-header h2 { font-size: 1.25rem; transition: var(--transition); }
        .catalog-filters { display: flex; gap: 0.5rem; }

        .catalog-list { display: grid; grid-template-columns: repeat(auto-fill, minmax(200px, 1fr)); gap: 0.75rem; }
        .catalog-item { 
          padding: 1rem; display: flex; flex-direction: column; gap: 0.75rem; cursor: pointer; 
        }
        .catalog-item .item-info { display: flex; flex-direction: column; gap: 0.1rem; }
        .catalog-item .item-name { font-family: 'Outfit', sans-serif; font-size: 1rem; font-weight: 600; color: var(--text-main); }
        .catalog-item .item-stock { font-size: 0.8rem; }
        
        .catalog-item .item-action { display: flex; justify-content: space-between; align-items: center; margin-top: auto; padding-top: 0.5rem; border-top: 1px solid var(--surface-border); }
        .catalog-item .item-price { font-family: 'Outfit', sans-serif; font-weight: 700; color: var(--primary); font-size: 1rem; }
        
        .add-btn-circle { width: 28px; height: 28px; border-radius: 50%; background: var(--secondary); color: var(--text-main); display: flex; align-items: center; justify-content: center; font-size: 1.1rem; transition: var(--transition); border: 1px solid var(--surface-border); }
        .catalog-item:hover .add-btn-circle { background: var(--primary); color: #fff; transform: scale(1.05); border-color: transparent; }
        
        .workspace { padding: 1.25rem; display: flex; flex-direction: column; gap: 1rem; min-height: 400px; position: sticky; top: 100px; background: #fff; }
        .workspace-header { display: flex; justify-content: space-between; align-items: center; padding-bottom: 0.75rem; border-bottom: 1px solid var(--surface-border); }
        .workspace-header h2 { font-size: 1.15rem; color: var(--text-main); }
        .item-count { background: var(--secondary); padding: 0.2rem 0.5rem; border-radius: var(--radius-pill); font-size: 0.75rem; font-weight: 600; color: var(--text-main); border: 1px solid var(--surface-border); }

        .empty-state { flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center; gap: 0.5rem; color: var(--text-muted); font-size: 0.9rem; text-align: center; opacity: 0.8; }
        .empty-icon { font-size: 3rem; filter: grayscale(1) opacity(0.5); }

        .selected-list { display: flex; flex-direction: column; gap: 0.5rem; flex: 1; overflow-y: auto; max-height: calc(100vh - 400px); padding-right: 0.5rem; }
        .selected-item { 
          display: flex; flex-direction: column; gap: 0.5rem;
          padding: 0.75rem; background: var(--bg-deep); border-radius: var(--radius-md); 
          border: 1px solid var(--surface-border); transition: var(--transition);
        }
        .selected-item:hover { background: #fff; }
        
        .item-details { display: flex; justify-content: space-between; align-items: center; }
        .item-details .name { font-weight: 600; color: var(--text-main); font-family: 'Outfit', sans-serif; font-size: 0.9rem; }
        .item-details .price { font-size: 0.8rem; color: var(--text-muted); }
        
        .item-controls { display: flex; justify-content: space-between; align-items: center; }
        .qty-control { display: flex; align-items: center; background: #fff; border-radius: var(--radius-sm); border: 1px solid var(--surface-border); overflow: hidden; height: 26px; }
        .qty-control button { width: 26px; height: 100%; display: flex; align-items: center; justify-content: center; background: var(--secondary); color: var(--text-main); font-weight: 700; transition: var(--transition); font-size: 0.9rem; }
        .qty-control button:hover { background: var(--surface-border); }
        .qty-control input { width: 35px; text-align: center; border: none; font-weight: 600; background: #fff; color: var(--text-main); border-left: 1px solid var(--surface-border); border-right: 1px solid var(--surface-border); outline: none; font-size: 0.8rem;}
        
        .row-total { margin-left: auto; margin-right: 0.75rem; font-family: 'Outfit', sans-serif; color: var(--text-main); font-size: 0.9rem; }
        
        .remove-btn { color: var(--error); font-size: 1.1rem; width: 26px; height: 26px; display: flex; align-items: center; justify-content: center; border-radius: var(--radius-sm); opacity: 0.8; transition: var(--transition); background: hsl(0, 80%, 95%); }
        .remove-btn:hover { opacity: 1; background: hsl(0, 80%, 90%); transform: scale(1.05); }

        .totals-section { margin-top: 1rem; padding-top: 1rem; border-top: 1px solid var(--surface-border); }
        .total-row { display: flex; justify-content: space-between; margin-bottom: 0.25rem; font-size: 0.85rem; }
        .total-row.main { font-weight: 700; font-size: 1.15rem; color: var(--text-main); margin-bottom: 0.75rem; font-family: 'Outfit', sans-serif;}
        .price-value { color: var(--primary); }
        
        .cost-row { color: var(--text-muted); font-size: 0.85rem; }
        .profit-row { margin-top: 0.25rem; font-weight: 600; }
        .text-success { color: var(--success); }

        .mobile-assembly-tabs {
          display: none;
        }
        @media (max-width: 768px) {
          .mobile-assembly-tabs {
            display: flex !important;
            gap: 0.5rem;
            margin-bottom: 1rem;
            background: rgba(0, 0, 0, 0.03);
            padding: 0.25rem;
            border-radius: var(--radius-pill);
            border: 1px solid rgba(0, 0, 0, 0.05);
          }
          .tab-btn {
            flex: 1;
            padding: 0.5rem 1rem;
            border-radius: var(--radius-pill);
            font-size: 0.85rem;
            font-weight: 600;
            border: none;
            cursor: pointer;
            background: transparent;
            color: var(--text-muted);
            transition: all 0.2s;
          }
          .tab-btn.active {
            background: #fff;
            color: var(--text-main);
            box-shadow: 0 2px 5px rgba(0,0,0,0.05);
          }
          .hidden-mobile {
            display: none !important;
          }
          .active-mobile {
            display: flex !important;
            flex-direction: column !important;
            width: 100% !important;
            height: auto !important;
          }
          .assembly-grid {
            grid-template-columns: 1fr !important;
            gap: 0.5rem !important;
          }
          .workspace {
            position: static !important;
            min-height: auto !important;
          }
        }
        @media (max-width: 576px) {
          .assembly-search-row {
            flex-direction: column !important;
            gap: 0.5rem !important;
          }
          .assembly-search-row > * {
            width: 100% !important;
            flex: none !important;
          }
        }
        @media (min-width: 769px) and (max-width: 992px) {
          .assembly-grid { grid-template-columns: 1fr; }
          .workspace { position: static; min-height: auto; }
        }

        .modal-actions { display: flex; gap: 1rem; margin-top: 0.75rem; }
        .modal-actions button { flex: 1; }

        .delete-template-btn {
          opacity: 0.7; transition: var(--transition);
          padding: 0.25rem; border-radius: var(--radius-sm);
          font-size: 0.9rem;
        }
        .delete-template-btn:hover { opacity: 1; background: hsla(0, 0%, 0%, 0.05); }

        .catalog-filters .badge { cursor: pointer; transition: var(--transition); border: 1px solid transparent; }
        .catalog-filters .badge:hover { transform: translateY(-1px); }
        .catalog-filters .badge.active { 
          border-color: currentColor; 
          box-shadow: 0 2px 4px rgba(0,0,0,0.1);
          font-weight: 800;
        }
        .badge-all { background: #eee; color: #555; }
        .badge-all.active { background: #333; color: #fff; }

        .template-card { min-height: 140px; }
        .template-contents { 
          font-size: 0.75rem; line-height: 1.25; 
          display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; 
          overflow: hidden; margin-bottom: 0.5rem;
        }
        .template-pricing { display: flex; flex-direction: column; gap: 0.15rem; }
        .price-row { display: flex; justify-content: space-between; align-items: center; }
        .price-row .label { font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.02em; }
        .price-row .value { font-weight: 700; font-size: 0.95rem; }
        .price-row .value.retail { color: var(--success); }
        .price-row .value.cost { color: var(--text-muted); font-size: 0.85rem; }
        .cost-row-small { margin-top: 0.1rem; border-top: 1px dashed var(--surface-border); padding-top: 0.2rem; }
        
        .analytics-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
            gap: 1.5rem;
            margin-bottom: 2rem;
        }
        .glass-card {
            background: rgba(255, 255, 255, 0.8);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.3);
            padding: 1.5rem;
            border-radius: 1rem;
            box-shadow: 0 4px 6px rgba(0, 0, 0, 0.05);
        }
        .stat-card h3 { font-size: 0.9rem; color: var(--text-muted); margin-bottom: 0.5rem; }
        .stat-value { font-size: 1.75rem; font-weight: 700; color: var(--text-main); }
        .stat-footer { margin-top: 1rem; padding-top: 0.5rem; border-top: 1px solid var(--surface-border); }
        .fade-in-up { animation: fadeInUp 0.6s ease-out forwards; opacity: 0; }
        .delay-1 { animation-delay: 0.1s; }
        .delay-2 { animation-delay: 0.2s; }
        .delay-3 { animation-delay: 0.3s; }
        @keyframes fadeInUp {
            from { opacity: 0; transform: translateY(20px); }
            to { opacity: 1; transform: translateY(0); }
        }
      `}</style>
      </div>
      <Modal 
        isOpen={isTemplateModalOpen} 
        onClose={() => setIsTemplateModalOpen(false)}
        title="Сохранить как шаблон"
      >
        <p className="subtitle">Введите название для нового шаблона (например "101 Роза")</p>
        <input 
          type="text" 
          className="input-field" 
          placeholder="Название шаблона..." 
          value={templateName}
          onChange={e => setTemplateName(e.target.value)}
          autoFocus
          onKeyDown={e => e.key === 'Enter' && confirmSaveTemplate()}
        />
        <div className="modal-actions">
          <button className="btn btn-secondary" onClick={() => setIsTemplateModalOpen(false)}>Отмена</button>
          <button 
            className="btn btn-primary" 
            onClick={confirmSaveTemplate} 
            disabled={!templateName.trim() || savingTemplate}
          >
            {savingTemplate ? 'Сохранение...' : 'Сохранить'}
          </button>
        </div>
      </Modal>
    </>
  );
}
