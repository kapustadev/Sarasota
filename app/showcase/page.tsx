'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '../components/LanguageContext';

export default function ShowcasePage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  
  const [decomposeModalOpen, setDecomposeModalOpen] = useState(false);
  const [selectedDecomposeItem, setSelectedDecomposeItem] = useState<any>(null);
  const [decomposeReason, setDecomposeReason] = useState('Defective');
  const [decomposeCustomReason, setDecomposeCustomReason] = useState('');

  const WRITE_OFF_REASONS = [
    "Theft", "TransportDamage", "Expired", "Defective", "Shortage", "Obsolete",
    "Lost", "Damaged", "SupplierReturn", "ProductionWaste", "Disaster", "AdminWriteOff",
    "QualityFailure", "Spoilage", "BadStorage", "PromoGiveaway", "GiftToCustomer",
    "Complimentary", "FOC", "Marketing", "PromoWriteOff", "GiftWriteOff", "CUSTOM"
  ];

  const { t, language } = useLanguage();

  // Show all active showcase items (AVAILABLE + RESERVED), filter out SOLD/DEFECT/DECOMPOSED
  const activeItems = items.filter(i => i.status === 'AVAILABLE' || i.status === 'RESERVED');
  const filteredItems = activeItems.filter(i =>
    i.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  useEffect(() => {
    Promise.all([
      fetch('/api/showcase').then(res => res.json()),
      fetch('/api/products').then(res => res.json())
    ]).then(([showcaseData, productData]) => {
      const itemsData = Array.isArray(showcaseData) ? showcaseData : [];
      setItems(itemsData);
      setProducts(productData);
      setLoading(false);
    });
  }, []);

  const handleSell = async (id: string) => {
    await fetch('/api/showcase/sell', {
      method: 'POST',
      body: JSON.stringify({ id }),
      headers: { 'Content-Type': 'application/json' }
    });
    setItems(items.map(i => i.id === id ? { ...i, status: 'SOLD' } : i));
  };

  // isDefect=false → "Разобрать": returns stock, NOT a defect, not in write-off analytics
  // isDefect=true  → "Списать":   goods lost, IS a defect, counted in analytics write-offs
  const handleDecompose = async (item: any, isDefect: boolean, reasonText?: string) => {
    const components = JSON.parse(item.components);
    const actions: Record<string, { returnQty: number, defectQty: number }> = {};
    for (const comp of components) {
      if (isDefect) {
        actions[comp.id] = { returnQty: 0, defectQty: comp.quantity };
      } else {
        actions[comp.id] = { returnQty: comp.quantity, defectQty: 0 };
      }
    }

    await fetch('/api/showcase/decompose', {
      method: 'POST',
      body: JSON.stringify({ id: item.id, actions, isDefect, reason: reasonText }),
      headers: { 'Content-Type': 'application/json' }
    });
    setItems(items.filter(i => i.id !== item.id));
  };

  const executeWriteOff = () => {
    if (!selectedDecomposeItem) return;
    const finalReason = decomposeReason === 'CUSTOM' ? decomposeCustomReason : t(`reason.${decomposeReason}`);
    handleDecompose(selectedDecomposeItem, true, finalReason);
    setDecomposeModalOpen(false);
  };

  const getProductName = (id: string) => {
    const p = products.find(p => p.id === id);
    if (!p) return 'Unknown Item';
    return language === 'EN' && p.nameEn ? p.nameEn : p.name;
  };

  if (loading) return (
    <div className="loader fade-in">
      <div className="spinner"></div>
      <span>{t('showcase.loading')}</span>
    </div>
  );

  return (
    <div className="fade-in">
      <header className="page-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div className="title-section" style={{ flex: '1 1 auto' }}>
          <h1 style={{ margin: 0 }}>{t('showcase.title')}</h1>
          <p className="subtitle" style={{ margin: '0.25rem 0 0 0' }}>{t('showcase.subtitle')}</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span className="badge badge-green" style={{ textTransform: 'none', fontWeight: 600 }}>
            💐 На витрине: {activeItems.length} букетов
          </span>
        </div>
      </header>

      <div style={{ display: 'flex', gap: '1rem', marginBottom: '1.5rem', flexWrap: 'wrap', alignItems: 'center' }}>
        <input
          type="text"
          placeholder="Поиск по букетам..."
          className="input-field"
          style={{ flex: 1, minWidth: '200px' }}
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
        />
      </div>

      {filteredItems.length === 0 ? (
        <div className="glass-card" style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
          <div style={{ fontSize: '3rem', marginBottom: '1rem', opacity: 0.5 }}>💐</div>
          <p>{searchQuery ? 'Ничего не найдено' : t('showcase.empty')}</p>
        </div>
      ) : (
        <div className="showcase-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: '1.5rem' }}>
          {filteredItems.map((item: any, index: number) => {
            const components = JSON.parse(item.components);
            return (
              <div key={item.id} className={`glass-card fade-in delay-${(index % 3) + 1}`} style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <h3 style={{ fontSize: '1.25rem', margin: 0 }}>{item.name}</h3>
                  <span style={{ fontSize: '1.25rem', fontWeight: 'bold', color: 'var(--primary)' }}>
                    ${item.retailPrice.toFixed(2)}
                  </span>
                </div>

                <div style={{ background: 'rgba(0,0,0,0.02)', padding: '1rem', borderRadius: 'var(--radius-sm)' }}>
                  <h4 style={{ fontSize: '0.8rem', textTransform: 'uppercase', color: 'var(--text-muted)', marginBottom: '0.5rem' }}>Состав:</h4>
                  <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.9rem' }}>
                    {components.map((comp: any, i: number) => (
                      <li key={i} style={{ display: 'flex', justifyContent: 'space-between' }}>
                        <span>{getProductName(comp.id)}</span>
                        <span style={{ fontWeight: 600, color: 'var(--text-muted)' }}>x{comp.quantity}</span>
                      </li>
                    ))}
                  </ul>
                </div>

                <div className="showcase-buttons" style={{ display: 'flex', gap: '0.5rem', marginTop: 'auto', flexWrap: 'wrap' }}>
                  <button
                    onClick={() => handleDecompose(item, false)}
                    className="btn btn-secondary"
                    style={{ flex: 1, padding: '0.5rem', minWidth: '100px' }}
                    title="Разобрать букет — ингредиенты вернутся на склад"
                  >
                    📦 Разобрать
                  </button>
                  <button
                    onClick={() => {
                      setSelectedDecomposeItem(item);
                      setDecomposeReason('Defective');
                      setDecomposeCustomReason('');
                      setDecomposeModalOpen(true);
                    }}
                    className="btn btn-secondary"
                    style={{ flex: 1, padding: '0.5rem', minWidth: '100px', color: 'var(--error)' }}
                    title="Списать в брак — ингредиенты не возвращаются, фиксируется в аналитике"
                  >
                    🗑️ Списать
                  </button>
                  <button
                    onClick={() => handleSell(item.id)}
                    className="btn btn-primary"
                    style={{ flex: '1 1 100%', padding: '0.5rem' }}
                  >
                    💳 Продать
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {decomposeModalOpen && (
        <div className="modal-overlay fade-in">
          <div className="modal-content glass-card" style={{ maxWidth: '400px' }}>
            <h2>🗑️ Списание букета</h2>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '1rem' }}>
              Вы собираетесь списать букет <strong>{selectedDecomposeItem?.name}</strong>. Выберите причину списания.
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div>
                <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                  Причина списания
                </label>
                <select 
                  value={decomposeReason} 
                  onChange={e => setDecomposeReason(e.target.value)} 
                  className="input-field"
                  style={{ width: '100%' }}
                >
                  {WRITE_OFF_REASONS.map(r => (
                    <option key={r} value={r}>{t(`reason.${r}`)}</option>
                  ))}
                </select>
              </div>

              {decomposeReason === 'CUSTOM' && (
                <div>
                  <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: '0.35rem' }}>
                    Укажите причину (свой вариант)
                  </label>
                  <input 
                    type="text" 
                    placeholder="Введите причину..." 
                    value={decomposeCustomReason} 
                    onChange={e => setDecomposeCustomReason(e.target.value)} 
                    className="input-field" 
                    style={{ width: '100%' }}
                  />
                </div>
              )}
            </div>

            <div className="modal-actions" style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.75rem', marginTop: '1.5rem', paddingTop: '1rem', borderTop: '1px solid var(--surface-border)' }}>
              <button className="btn btn-secondary" onClick={() => setDecomposeModalOpen(false)}>Отмена</button>
              <button 
                className="btn btn-primary" 
                onClick={executeWriteOff}
                style={{ background: 'hsl(350, 75%, 50%)', borderColor: 'hsl(350, 75%, 45%)', color: '#fff', fontWeight: 600 }}
              >
                Подтвердить списание
              </button>
            </div>
          </div>
        </div>
      )}

      <style jsx>{`
        .loader { height: 60vh; display: flex; flex-direction: column; gap: 1rem; align-items: center; justify-content: center; font-weight: 600; color: var(--primary); }
        .spinner { width: 30px; height: 30px; border: 2px solid rgba(0,0,0,0.1); border-top-color: var(--primary); border-radius: 50%; animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
        
        @media (max-width: 768px) {
          .showcase-grid { grid-template-columns: 1fr !important; }
        }
        @media (max-width: 480px) {
          .showcase-buttons { flex-direction: column !important; }
          .showcase-buttons button { width: 100% !important; margin: 0 !important; }
        }
        .modal-overlay { position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.6); display: flex; align-items: center; justify-content: center; z-index: 1000; padding: 1rem; }
        .modal-content { padding: 2rem; width: 100%; max-width: 600px; display: flex; flex-direction: column; gap: 1.5rem; background: #ffffff; border-radius: var(--radius-lg); box-shadow: 0 10px 30px rgba(0,0,0,0.2); }
        .modal-content h2 { font-size: 1.5rem; margin: 0; color: var(--text-main); font-family: 'Outfit', sans-serif; }
      `}</style>
    </div>
  );
}
