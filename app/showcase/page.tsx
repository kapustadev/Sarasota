'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '../components/LanguageContext';

export default function ShowcasePage() {
  const [items, setItems] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [products, setProducts] = useState<any[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const { t } = useLanguage();

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
  const handleDecompose = async (item: any, isDefect: boolean) => {
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
      body: JSON.stringify({ id: item.id, actions, isDefect }),
      headers: { 'Content-Type': 'application/json' }
    });
    setItems(items.filter(i => i.id !== item.id));
  };

  const getProductName = (id: string) => {
    return products.find(p => p.id === id)?.name || 'Unknown Item';
  };

  if (loading) return (
    <div className="loader fade-in">
      <div className="spinner"></div>
      <span>{t('showcase.loading')}</span>
    </div>
  );

  return (
    <div className="fade-in">
      <header className="page-header">
        <div className="title-section">
          <h1>{t('showcase.title')}</h1>
          <p className="subtitle">{t('showcase.subtitle')}</p>
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
                    onClick={() => handleDecompose(item, true)}
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
      `}</style>
    </div>
  );
}
