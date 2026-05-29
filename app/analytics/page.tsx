'use client';

import { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../components/LanguageContext';

export default function AnalyticsPage() {
  const { t, language } = useLanguage();
  const [range, setRange] = useState('month');
  const [customStart, setCustomStart] = useState('');
  const [customEnd, setCustomEnd] = useState('');
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState({
    stock: { items: 0, retail: 0 },
    showcase: { items: 0, retail: 0 },
    reserved: { items: 0, retail: 0 }
  });
  const [metrics, setMetrics] = useState({
    total: { revenue: 0, cost: 0, profit: 0, margin: 0 },
    online: { revenue: 0, cost: 0, profit: 0, margin: 0 },
    physical: { revenue: 0, cost: 0, profit: 0, margin: 0 }
  });
  const [popularProducts, setPopularProducts] = useState<any[]>([]);
  const [writeOffs, setWriteOffs] = useState({
    totalCost: 0,
    totalRetail: 0,
    count: 0,
    items: [] as any[]
  });

  // Detailed Reservation Modal states
  const [isReservedModalOpen, setIsReservedModalOpen] = useState(false);
  const [activeOrders, setActiveOrders] = useState<any[]>([]);
  const [activeOrdersLoading, setActiveOrdersLoading] = useState(false);
  const [rawProducts, setRawProducts] = useState<any[]>([]);
  const [rawShowcase, setRawShowcase] = useState<any[]>([]);
  const [reservedTab, setReservedTab] = useState<'BOUQUETS' | 'ORDERS' | 'RAW'>('BOUQUETS');
  const [selectedWriteOffDetails, setSelectedWriteOffDetails] = useState<string | null>(null);

  // Advanced Filters State
  const [selectedProduct, setSelectedProduct] = useState('ALL');
  const [selectedCategory, setSelectedCategory] = useState('ALL');
  const [selectedSupplier, setSelectedSupplier] = useState('ALL');
  const [filterLists, setFilterLists] = useState({
    products: [] as Array<{ id: string, name: string, sku: string }>,
    suppliers: [] as string[]
  });
  const [exporting, setExporting] = useState(false);

  // Online Sales Details
  const [onlineSalesModalOpen, setOnlineSalesModalOpen] = useState(false);
  const [onlineSalesDetails, setOnlineSalesDetails] = useState<any[]>([]);
  const [onlineSalesSearch, setOnlineSalesSearch] = useState('');
  const [wpBaseUrl, setWpBaseUrl] = useState('');

  useEffect(() => {
    setLoading(true);
    let url = `/api/analytics?range=${range}&productId=${selectedProduct}&category=${selectedCategory}&supplier=${selectedSupplier}`;
    if (range === 'custom' && customStart && customEnd) {
      url = `/api/analytics?start=${customStart}&end=${customEnd}&productId=${selectedProduct}&category=${selectedCategory}&supplier=${selectedSupplier}`;
    }

    Promise.all([
      fetch('/api/products').then(res => res.json()),
      fetch('/api/showcase').then(res => res.json()),
      fetch(url).then(res => res.json())
    ]).then(([products, showcase, analytics]) => {
      // 1. Snapshot Calculation
      let sItems = 0, sRetail = 0;
      let rItems = 0, rRetail = 0;
      const productItems = Array.isArray(products) ? products : [];
      setRawProducts(productItems);
      productItems.forEach((p: any) => {
        const available = Math.max(0, p.quantity - p.reserved);
        sItems += available;
        sRetail += available * (p.retailPrice || 0);
        rItems += p.reserved || 0;
        rRetail += (p.reserved || 0) * (p.retailPrice || 0);
      });

      let scItems = 0, scRetail = 0;
      const showcaseItems = Array.isArray(showcase) ? showcase : [];
      setRawShowcase(showcaseItems);
      showcaseItems.forEach((item: any) => {
         // Both AVAILABLE (on showcase) and RESERVED count as "in reserve" — showcase = bron
         if (item.status === 'AVAILABLE' || item.status === 'RESERVED') {
            scItems += 1;
            scRetail += item.retailPrice || 0;
         }
      });

      setSnapshot({
        stock: { items: sItems, retail: sRetail },
        showcase: { items: scItems, retail: scRetail },
        reserved: { items: rItems, retail: rRetail }
      });

      // 2. Metrics from Dynamic Analytics
      if (analytics && analytics.metrics) {
        setMetrics(analytics.metrics);
        setPopularProducts(analytics.popularProducts || []);
        if (analytics.writeOffs) {
          setWriteOffs(analytics.writeOffs);
        }
        if (analytics.filterLists) {
          setFilterLists(analytics.filterLists);
        }
        if (analytics.onlineSalesDetails) {
          setOnlineSalesDetails(analytics.onlineSalesDetails);
        }
        if (analytics.wpBaseUrl) {
          setWpBaseUrl(analytics.wpBaseUrl);
        }
      }

      setLoading(false);
    });
  }, [range, customStart, customEnd, selectedProduct, selectedCategory, selectedSupplier]);

  const openReservedDetailsModal = async () => {
    setIsReservedModalOpen(true);
    setActiveOrdersLoading(true);
    try {
      const res = await fetch('/api/wp/active-orders');
      if (res.ok) {
        const data = await res.json();
        if (data && Array.isArray(data)) {
          setActiveOrders(data);
        } else if (data && data.orders) {
          setActiveOrders(data.orders);
        } else {
          setActiveOrders([]);
        }
      }
    } catch (e) {
      console.error(e);
      setActiveOrders([]);
    } finally {
      setActiveOrdersLoading(false);
    }
  };

  const handleDeleteWriteOff = async (id: string, type: string) => {
    if (!confirm('Вы уверены, что хотите удалить это списание? Товар будет возвращен на склад или витрину.')) {
      return;
    }
    try {
      const res = await fetch(`/api/analytics/write-off/${id}?type=${type}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        // Optimistically remove from list
        const newItems = writeOffs.items.filter(item => item.id !== id);
        const removedItem = writeOffs.items.find(item => item.id === id);
        
        setWriteOffs({
          ...writeOffs,
          items: newItems,
          count: writeOffs.count - 1,
          totalCost: writeOffs.totalCost - (removedItem?.totalCost || 0),
          totalRetail: writeOffs.totalRetail - (removedItem?.totalRetail || 0)
        });
      } else {
        const data = await res.json();
        alert(data.error || 'Ошибка при удалении');
      }
    } catch (e) {
      console.error(e);
      alert('Сбой сети при удалении');
    }
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const ExcelJS = (await import('exceljs')).default;
      const { saveAs } = await import('file-saver');

      const workbook = new ExcelJS.Workbook();
      
      const isRu = language === 'RU';
      
      // Sheet 1: Сводка (Summary)
      const summarySheet = workbook.addWorksheet(isRu ? 'Сводка' : 'Summary');
      summarySheet.columns = [
        { header: isRu ? 'Метрика' : 'Metric', key: 'metric', width: 40 },
        { header: isRu ? 'Сумма ($)' : 'Amount ($)', key: 'amount', width: 20 },
      ];
      summarySheet.getRow(1).font = { bold: true };
      summarySheet.addRows([
        { metric: isRu ? '=== ПРОДАЖИ С ВИТРИНЫ ===' : '=== SHOWCASE SALES ===', amount: '' },
        { metric: isRu ? 'Выручка (Витрина)' : 'Revenue (Showcase)', amount: metrics.physical.revenue },
        { metric: isRu ? 'Прибыль (Витрина)' : 'Profit (Showcase)', amount: metrics.physical.profit },
        { metric: isRu ? 'Затраты (Витрина)' : 'Costs (Showcase)', amount: metrics.physical.cost },
        { metric: isRu ? 'Маржа (Витрина) %' : 'Margin (Showcase) %', amount: metrics.physical.margin },
        { metric: '', amount: '' },
        { metric: isRu ? '=== ПРОДАЖИ НА САЙТЕ ===' : '=== WEBSITE SALES ===', amount: '' },
        { metric: isRu ? 'Выручка (Сайт)' : 'Revenue (Website)', amount: metrics.online.revenue },
        { metric: isRu ? 'Прибыль (Сайт)' : 'Profit (Website)', amount: metrics.online.profit },
        { metric: isRu ? 'Затраты (Сайт)' : 'Costs (Website)', amount: metrics.online.cost },
        { metric: isRu ? 'Маржа (Сайт) %' : 'Margin (Website) %', amount: metrics.online.margin },
        { metric: '', amount: '' },
        { metric: isRu ? '=== ОБЩАЯ ВЫРУЧКА ===' : '=== TOTAL REVENUE ===', amount: '' },
        { metric: isRu ? 'Общая выручка' : 'Total Revenue', amount: metrics.total.revenue },
        { metric: isRu ? 'Общая прибыль' : 'Total Profit', amount: metrics.total.profit },
        { metric: isRu ? 'Общие затраты (вкл. списания)' : 'Total Costs (incl. write-offs)', amount: metrics.total.cost },
        { metric: isRu ? 'Общая маржа (%)' : 'Total Margin (%)', amount: metrics.total.margin },
        { metric: '', amount: '' },
        { metric: isRu ? '=== СПИСАНИЯ И ПОТЕРИ ===' : '=== WRITE-OFFS & LOSSES ===', amount: '' },
        { metric: isRu ? 'Сумма убытков по себестоимости' : 'Cost Losses (Purchase Price)', amount: writeOffs.totalCost },
        { metric: isRu ? 'Упущенная розничная выгода' : 'Lost Profit (Retail)', amount: writeOffs.totalRetail },
        { metric: isRu ? 'Количество списаний' : 'Number of write-offs', amount: writeOffs.count },
      ]);
      
      // Make section headers bold
      summarySheet.eachRow((row, rowNumber) => {
        if (row.getCell(1).value && String(row.getCell(1).value).startsWith('===')) {
          row.font = { bold: true };
          row.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F0F0' } };
        }
      });

      // Sheet 2: Топ Товаров (Top Products)
      const topSheet = workbook.addWorksheet(isRu ? 'Топ Товаров' : 'Top Products');
      topSheet.columns = [
        { header: isRu ? 'Товар' : 'Product', key: 'name', width: 50 },
        { header: isRu ? 'Кол-во' : 'Qty', key: 'qty', width: 15 },
        { header: isRu ? 'Выручка ($)' : 'Revenue ($)', key: 'rev', width: 20 },
        { header: isRu ? 'Прибыль ($)' : 'Profit ($)', key: 'profit', width: 20 },
      ];
      topSheet.getRow(1).font = { bold: true };
      popularProducts.forEach(p => {
        topSheet.addRow({ name: p.name, qty: p.quantity, rev: p.revenue, profit: p.profit });
      });

      // Sheet 3: Списания (Write-offs)
      const writeoffSheet = workbook.addWorksheet(isRu ? 'Списания и Брак' : 'Write-offs & Defects');
      writeoffSheet.columns = [
        { header: isRu ? 'Дата' : 'Date', key: 'date', width: 25 },
        { header: isRu ? 'Тип' : 'Type', key: 'type', width: 25 },
        { header: isRu ? 'Название' : 'Name', key: 'name', width: 40 },
        { header: isRu ? 'Кол-во' : 'Qty', key: 'qty', width: 15 },
        { header: isRu ? 'Убыток ($)' : 'Loss ($)', key: 'cost', width: 20 },
        { header: isRu ? 'Причина' : 'Reason', key: 'reason', width: 60 },
      ];
      writeoffSheet.getRow(1).font = { bold: true };
      writeOffs.items.forEach(w => {
        writeoffSheet.addRow({
          date: new Date(w.createdAt).toLocaleString(isRu ? 'ru-RU' : 'en-US'),
          type: w.type === 'SHOWCASE_DEFECT' 
            ? (isRu ? 'Брак витрины' : 'Showcase Defect') 
            : (isRu ? 'Списание со склада' : 'Warehouse Write-off'),
          name: w.name,
          qty: w.quantity,
          cost: w.totalCost,
          reason: w.reason || (w.writeOffReason ? t(`reason.${w.writeOffReason}`) : (isRu ? 'Не указана' : 'Not specified'))
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const rangeLabel = ranges.find(r => r.id === range)?.label || 'Report';
      const filePrefix = isRu ? 'Аналитика' : 'Analytics';
      saveAs(new Blob([buffer]), `${filePrefix}_${rangeLabel}_${new Date().toLocaleDateString(isRu ? 'ru-RU' : 'en-US')}.xlsx`);
    } catch (e) {
      console.error('Export failed:', e);
      alert(language === 'RU' ? 'Ошибка при экспорте в Excel' : 'Error exporting to Excel');
    } finally {
      setExporting(false);
    }
  };

  const ranges = [
    { id: 'today', label: t('analytics.range_today') },
    { id: 'week', label: t('analytics.range_week') },
    { id: 'month', label: t('analytics.range_month') },
    { id: 'year', label: t('analytics.range_year') },
    { id: 'custom', label: t('analytics.range_custom') },
    { id: 'all', label: t('analytics.range_all') }
  ];

  if (loading && !metrics.total.revenue && !snapshot.stock.items) return (
    <div className="loader fade-in">
      <div className="spinner"></div>
      <span>{t('analytics.loading')}</span>
      <style jsx>{`
        .loader { height: 60vh; display: flex; flex-direction: column; gap: 1rem; align-items: center; justify-content: center; font-weight: 600; color: var(--primary); }
        .spinner { width: 30px; height: 30px; border: 2px solid rgba(0,0,0,0.1); border-top-color: var(--primary); border-radius: 50%; animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }
      `}</style>
    </div>
  );

  return (
    <div className="analytics-dashboard fade-in">
      <header className="page-header">
        <div className="title-section">
          <h1>{t('analytics.title')}</h1>
          <p className="subtitle">{t('analytics.report_desc')}</p>
        </div>
        <div className="header-right">

          {range === 'custom' && (
            <div className="custom-date-picker fade-in">
              <input 
                type="date" 
                className="date-input" 
                value={customStart} 
                onChange={e => setCustomStart(e.target.value)} 
              />
              <span className="date-sep">—</span>
              <input 
                type="date" 
                className="date-input" 
                value={customEnd} 
                onChange={e => setCustomEnd(e.target.value)} 
              />
            </div>
          )}
          <div className="range-selector glass-panel">
            {ranges.map(r => (
              <button 
                key={r.id} 
                className={`range-btn ${range === r.id ? 'active' : ''}`}
                onClick={() => setRange(r.id)}
              >
                {r.label}
              </button>
            ))}
            <button 
              className="btn btn-primary" 
              style={{ marginLeft: '1rem', padding: '0.45rem 1.25rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600, background: 'var(--success)' }}
              onClick={handleExportExcel}
              disabled={loading || exporting}
            >
              {exporting ? '⏳ ' + t('analytics.exporting') : '📊 ' + t('analytics.export_excel')}
            </button>
          </div>
        </div>
      </header>

      {/* Advanced Multi-Filters Panel */}
      <div className="glass-card fade-in" style={{ padding: '1.25rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'flex-end', zIndex: 10 }}>
        <div style={{ flex: 1, minWidth: '180px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('analytics.filter_category')}</label>
          <select 
            className="input-field" 
            value={selectedCategory} 
            onChange={(e) => setSelectedCategory(e.target.value)}
            style={{ padding: '0.45rem', fontSize: '0.85rem', background: '#fff' }}
          >
            <option value="ALL">{t('analytics.filter_cat_all')}</option>
            <option value="FLOWER">{language === 'RU' ? 'Цветы 🌸' : 'Flowers 🌸'}</option>
            <option value="PACKAGING">{language === 'RU' ? 'Упаковка 🎀' : 'Packaging 🎀'}</option>
            <option value="MATERIAL">{language === 'RU' ? 'Материалы 🌿' : 'Materials 🌿'}</option>
            <option value="GIFT">{language === 'RU' ? 'Подарки 🎁' : 'Gifts 🎁'}</option>
          </select>
        </div>

        <div style={{ flex: 2, minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('analytics.filter_product')}</label>
          <select 
            className="input-field" 
            value={selectedProduct} 
            onChange={(e) => setSelectedProduct(e.target.value)}
            style={{ padding: '0.45rem', fontSize: '0.85rem', background: '#fff' }}
          >
            <option value="ALL">{t('analytics.filter_prod_all')}</option>
            {filterLists.products.map(p => (
              <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
            ))}
          </select>
        </div>

        <div style={{ flex: 2, minWidth: '200px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>{t('analytics.filter_supplier')}</label>
          <select 
            className="input-field" 
            value={selectedSupplier} 
            onChange={(e) => setSelectedSupplier(e.target.value)}
            style={{ padding: '0.45rem', fontSize: '0.85rem', background: '#fff' }}
          >
            <option value="ALL">{t('analytics.filter_sup_all')}</option>
            <option value="Без поставщика">{t('analytics.filter_sup_none')}</option>
            {filterLists.suppliers.map(s => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </div>

        {(selectedProduct !== 'ALL' || selectedCategory !== 'ALL' || selectedSupplier !== 'ALL') && (
          <button 
            className="btn btn-secondary" 
            onClick={() => { setSelectedProduct('ALL'); setSelectedCategory('ALL'); setSelectedSupplier('ALL'); }}
            style={{ height: '36px', padding: '0 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}
          >
            🔄 {t('analytics.reset')}
          </button>
        )}
      </div>

      <section className="section-group">
        <h2 className="section-title">{t('analytics.financial_metrics_by_channel')} ({ranges.find(r => r.id === range)?.label})</h2>
        <div className="channels-grid">
          
          {/* Column 1: Physical Showcase Sales */}
          <div className="glass-card channel-card">
            <div className="channel-header">
              <span style={{ fontSize: '1.5rem' }}>💐</span>
              <h3>{t('analytics.showcase_sales')}</h3>
              <span className="badge badge-pink">{t('analytics.physical_store')}</span>
            </div>
            <div className="channel-body">
              <div className="metric-row">
                <span className="label">{t('analytics.revenue_label')}</span>
                <span className="value">${metrics.physical.revenue.toFixed(2)}</span>
              </div>
              <div className="metric-row">
                <span className="label">{t('analytics.cost_price_label')}</span>
                <span className="value cost">${metrics.physical.cost.toFixed(2)}</span>
              </div>
              <div className="metric-row profit-row text-success">
                <span className="label font-bold">{t('analytics.profit_label')}</span>
                <span className="value font-bold">${metrics.physical.profit.toFixed(2)}</span>
              </div>
              <div className="metric-row margin-row">
                <span className="label">{t('analytics.margin_label')}</span>
                <span className="badge badge-green">{(metrics.physical.margin || 0).toFixed(1)}%</span>
              </div>
            </div>
          </div>

          {/* Column 2: Online Website Sales */}
          <div 
            className="glass-card channel-card clickable"
            onClick={() => setOnlineSalesModalOpen(true)}
            style={{ cursor: 'pointer', transition: 'all 0.2s', borderLeft: '4px solid var(--primary)' }}
          >
            <div className="channel-header">
              <span style={{ fontSize: '1.5rem' }}>🌐</span>
              <h3>{t('analytics.online_sales')}</h3>
              <span className="badge badge-violet">{t('analytics.website')}</span>
              <span style={{ marginLeft: 'auto', fontSize: '0.8rem', opacity: 0.7 }}>🔍 {t('analytics.btn_details')}</span>
            </div>
            <div className="channel-body">
              <div className="metric-row">
                <span className="label">{t('analytics.revenue_label')}</span>
                <span className="value">${metrics.online.revenue.toFixed(2)}</span>
              </div>
              <div className="metric-row">
                <span className="label">{t('analytics.cost_price_label')}</span>
                <span className="value cost">${metrics.online.cost.toFixed(2)}</span>
              </div>
              <div className="metric-row profit-row text-success">
                <span className="label font-bold">{t('analytics.profit_label')}</span>
                <span className="value font-bold">${metrics.online.profit.toFixed(2)}</span>
              </div>
              <div className="metric-row margin-row">
                <span className="label">{t('analytics.margin_label')}</span>
                <span className="badge badge-violet">{(metrics.online.margin || 0).toFixed(1)}%</span>
              </div>
            </div>
          </div>

          {/* Column 3: Combined Total Consolidation */}
          <div className="glass-card channel-card total-card">
            <div className="channel-header">
              <span style={{ fontSize: '1.5rem' }}>📊</span>
              <h3>{t('analytics.total_revenue')}</h3>
              <span className="badge badge-orange">{t('analytics.total_badge')}</span>
            </div>
            <div className="channel-body">
              <div className="metric-row">
                <span className="label">{t('analytics.total_revenue')}</span>
                <span className="value total-value">${metrics.total.revenue.toFixed(2)}</span>
              </div>
              <div className="metric-row">
                <span className="label">{t('analytics.total_cost_label')}</span>
                <span className="value cost">${metrics.total.cost.toFixed(2)}</span>
              </div>
              <div className="metric-row profit-row text-success-total">
                <span className="label font-bold">{t('analytics.net_profit_label')}</span>
                <span className="value font-bold total-value-profit">${metrics.total.profit.toFixed(2)}</span>
              </div>
              <div className="metric-row margin-row">
                <span className="label">{t('analytics.total_margin_label')}</span>
                <span className="badge badge-orange">{(metrics.total.margin || 0).toFixed(1)}%</span>
              </div>
            </div>
          </div>

          {/* Column 4: Write-offs & Waste Losses */}
          <div className="glass-card channel-card" style={{ border: '1px solid hsl(0, 80%, 90%)', background: 'linear-gradient(180deg, #fff 0%, hsl(0, 80%, 99%) 100%)' }}>
            <div className="channel-header">
              <span style={{ fontSize: '1.5rem' }}>🗑️</span>
              <h3 style={{ fontSize: '1rem', margin: 0, fontWeight: 700, color: 'var(--text-main)' }}>{t('analytics.writeoffs_losses')}</h3>
              <span className="badge badge-pink" style={{ background: 'hsl(0, 80%, 95%)', color: 'var(--error)', borderColor: 'hsl(0, 80%, 90%)' }}>{t('analytics.losses_badge')}</span>
            </div>
            <div className="channel-body">
              <div className="metric-row">
                <span className="label">{t('analytics.lost_revenue_label')}</span>
                <span className="value" style={{ color: 'var(--error)' }}>${writeOffs.totalRetail.toFixed(2)}</span>
              </div>
              <div className="metric-row">
                <span className="label">{t('analytics.cost_loss_label')}</span>
                <span className="value cost" style={{ color: 'var(--error)', fontWeight: 700 }}>${writeOffs.totalCost.toFixed(2)}</span>
              </div>
              <div className="metric-row profit-row" style={{ borderTop: '1px dashed var(--surface-border)', paddingTop: '0.5rem' }}>
                <span className="label font-bold">{t('analytics.writeoffs_count_label')}</span>
                <span className="value font-bold" style={{ color: 'var(--text-main)' }}>{writeOffs.count} {t('analytics.pieces')}</span>
              </div>
              <div className="metric-row margin-row">
                <span className="label">{t('analytics.cost_ratio_label')}</span>
                <span className="badge badge-orange" style={{ background: 'hsl(35, 90%, 95%)', color: 'hsl(35, 90%, 40%)' }}>
                  {metrics.total.cost > 0 ? ((writeOffs.totalCost / metrics.total.cost) * 100).toFixed(1) : '0.0'}%
                </span>
              </div>
            </div>
          </div>

        </div>
      </section>

      <div className="content-grid-split">
        <section className="section-group">
          <h2 className="section-title">{t('analytics.popular')}</h2>
          <div className="glass-card visual-popularity-list">
            {popularProducts.length === 0 ? (
              <div style={{textAlign:'center', padding:'3rem', color:'var(--text-muted)'}}>{t('analytics.no_sales_data')}</div>
            ) : (
              popularProducts.map((p, i) => {
                const maxRevenue = Math.max(...popularProducts.map(x => x.revenue));
                const percentage = (p.revenue / maxRevenue) * 100;
                return (
                  <div key={i} className="popularity-row">
                    <div className="row-bg" style={{ width: `${percentage}%` }}></div>
                    <div className="row-content">
                      <div className="product-info" style={{ display: 'flex', flexDirection: 'column' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.45rem', flexWrap: 'wrap' }}>
                          <span className="product-name" style={{ color: 'var(--text-main)' }}>{p.name}</span>
                          <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.04)', padding: '0.1rem 0.35rem', borderRadius: 'var(--radius-sm)', fontWeight: 500 }}>
                            {p.sku}
                          </span>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.65rem', marginTop: '0.2rem' }}>
                          <span className="product-qty" style={{ fontSize: '0.75rem', fontWeight: 600, color: 'var(--text-muted)' }}>
                            {p.qty.toFixed(0)} {t('analytics.pieces')} {t('analytics.sold')}
                          </span>
                          <span 
                            style={{ 
                              fontSize: '0.7rem', 
                              padding: '0.1rem 0.45rem', 
                              borderRadius: '4px', 
                              fontWeight: 700, 
                              background: p.stock <= p.minStock ? 'rgba(239, 68, 68, 0.08)' : 'rgba(16, 185, 129, 0.08)', 
                              color: p.stock <= p.minStock ? 'rgb(220, 38, 38)' : 'rgb(5, 150, 105)',
                              border: `1px solid ${p.stock <= p.minStock ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)'}`
                            }}
                          >
                            📦 {p.stock} {t('analytics.pieces_in_stock')} {p.stock <= p.minStock ? ` (${t('analytics.low_stock_warn')})` : ''}
                          </span>
                        </div>
                      </div>
                      <div className="product-metrics">
                        <span className="product-revenue">${p.revenue.toFixed(2)}</span>
                      </div>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
 
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          <section className="section-group">
            <h2 className="section-title">{t('analytics.snapshot')}</h2>
            <div className="analytics-vertical-grid">
              <div className="glass-card mini-stat">
                <div className="mini-info">
                  <span className="mini-label">{t('analytics.warehouse_free')}</span>
                  <span className="mini-value">{snapshot.stock.items.toFixed(0)} {t('analytics.units_qty')}</span>
                </div>
                <span className="mini-price">${snapshot.stock.retail.toFixed(0)}</span>
              </div>
              <div className="glass-card mini-stat danger-border clickable" onClick={openReservedDetailsModal} style={{ cursor: 'pointer', transition: 'all 0.2s' }}>
                <div className="mini-info">
                  <span className="mini-label" style={{ display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                    💐 {t('showcase.title')} <span style={{ fontSize: '0.75rem', opacity: 0.8 }}>🔍 {t('analytics.btn_details')}</span>
                  </span>
                  <span className="mini-value">{snapshot.showcase.items.toFixed(0)} {language === 'RU' ? 'букетов' : 'bouquets'}</span>
                </div>
                <span className="mini-price pink-text">${snapshot.showcase.retail.toFixed(0)}</span>
              </div>
              <div className="glass-card mini-stat">
                <div className="mini-info">
                  <span className="mini-label">{t('analytics.raw_reserve')}</span>
                  <span className="mini-value">{snapshot.reserved.items.toFixed(0)} {t('analytics.units_qty')}</span>
                </div>
                <span className="mini-price">${snapshot.reserved.retail.toFixed(0)}</span>
              </div>
            </div>
          </section>
        </div>
      </div>
 
      {/* Detailed Write-offs Logs Section */}
      <section className="section-group">
        <h2 className="section-title">{t('analytics.writeoffs_log')} ({ranges.find(r => r.id === range)?.label})</h2>
        <div className="glass-card table-wrapper" style={{ padding: '0' }}>
          {writeOffs.items.length === 0 ? (
            <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)' }}>
              {t('analytics.no_writeoffs')}
            </div>
          ) : (
            <div style={{ overflowX: 'auto', width: '100%' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', minWidth: '700px' }}>
                <thead>
                  <tr style={{ background: 'rgba(0,0,0,0.01)', borderBottom: '1px solid var(--surface-border)' }}>
                    <th style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{t('analytics.date')}</th>
                    <th style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{t('analytics.writeoff_type')}</th>
                    <th style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{t('analytics.writeoff_nomenclature')}</th>
                    <th style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{t('analytics.writeoff_qty')}</th>
                    <th style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{t('analytics.cost_losses')}</th>
                    <th style={{ padding: '1rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>{t('analytics.details')}</th>
                  </tr>
                </thead>
                <tbody>
                  {writeOffs.items.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--surface-border)', fontSize: '0.9rem' }}>
                      <td style={{ padding: '1rem', whiteSpace: 'nowrap', fontSize: '0.8rem' }}>{new Date(item.createdAt).toLocaleString(language === 'RU' ? 'ru-RU' : 'en-US')}</td>
                      <td style={{ padding: '1rem' }}>
                        <span className={`badge ${item.type === 'WAREHOUSE_RAW' ? 'badge-orange' : 'badge-pink'}`} style={{ display: 'inline-flex', fontSize: '0.7rem' }}>
                          {item.type === 'WAREHOUSE_RAW' ? t('analytics.type_warehouse_raw') : t('analytics.type_showcase_defect')}
                        </span>
                      </td>
                      <td style={{ padding: '1rem', fontWeight: 600 }}>
                        {item.name} {item.sku !== 'BOUQUET' && item.sku !== 'N/A' ? `(${item.sku})` : ''}
                      </td>
                      <td style={{ padding: '1rem' }}>{item.quantity} {item.unit}</td>
                      <td style={{ padding: '1rem', color: 'var(--error)', fontWeight: 700 }}>-${item.totalCost.toFixed(2)}</td>
                      <td style={{ padding: '1rem', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          {item.reason || item.writeOffReason ? (
                            <button 
                              className="btn btn-secondary btn-sm"
                              style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', fontWeight: 600 }}
                              onClick={() => {
                                let text = '';
                                if (item.writeOffReason) {
                                  text = `${language === 'RU' ? 'Причина' : 'Reason'}: ${t(`reason.${item.writeOffReason}`)}`;
                                  if (item.reason) text += `\n\n${language === 'RU' ? 'Подробности' : 'Details'}:\n${item.reason}`;
                                } else {
                                  text = `${language === 'RU' ? 'Причина' : 'Reason'}: ${item.reason || (language === 'RU' ? 'Не указана' : 'Not specified')}`;
                                }
                                setSelectedWriteOffDetails(text);
                              }}
                            >
                              🔍 {t('analytics.btn_details')}
                            </button>
                          ) : (
                            <span>{item.reason || '—'}</span>
                          )}
                          <button
                            className="btn btn-secondary btn-sm"
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', fontWeight: 600, color: 'var(--error)' }}
                            onClick={() => handleDeleteWriteOff(item.id, item.type)}
                            title={t('analytics.cancel_writeoff_title')}
                          >
                            🗑️ {t('analytics.delete_writeoff')}
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </section>
      
      <style jsx>{`
        .analytics-dashboard { display: flex; flex-direction: column; gap: 2.5rem; }
        .page-header { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 1rem; }
        .title-section h1 { font-size: 2.2rem; margin-bottom: 0.25rem; color: var(--text-main); }
        .subtitle { color: var(--text-muted); font-size: 1rem; }

        .header-right { display: flex; align-items: center; gap: 1rem; }
        .custom-date-picker { display: flex; align-items: center; gap: 0.5rem; background: rgba(255,255,255,0.5); padding: 0.35rem 0.75rem; border-radius: var(--radius-lg); border: 1px solid var(--surface-border); }
        .date-input { background: transparent; border: none; font-size: 0.85rem; font-weight: 600; color: var(--text-main); font-family: inherit; outline: none; }
        .date-input::-webkit-calendar-picker-indicator { cursor: pointer; opacity: 0.6; }
        .date-sep { color: var(--text-muted); font-weight: 700; }

        .range-selector { display: flex; padding: 0.35rem; gap: 0.25rem; border-radius: var(--radius-lg); }
        .range-btn { padding: 0.5rem 1rem; border-radius: var(--radius-md); font-size: 0.9rem; font-weight: 500; color: var(--text-muted); transition: var(--transition); }
        .range-btn:hover { background: rgba(0,0,0,0.03); color: var(--text-main); }
        .range-btn.active { background: var(--primary); color: #fff; box-shadow: 0 4px 12px rgba(0,0,0,0.1); }

        .section-group { display: flex; flex-direction: column; gap: 1rem; }
        .section-title { font-size: 1.1rem; text-transform: uppercase; letter-spacing: 0.05em; color: var(--text-muted); font-weight: 600; }

        .channels-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
          gap: 1.5rem;
        }
        .channel-card {
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
          background: #ffffff;
          border-radius: var(--radius-lg);
          box-shadow: 0 4px 6px rgba(0, 0, 0, 0.02);
          border: 1px solid var(--surface-border);
        }
        .channel-header {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          border-bottom: 1px solid var(--surface-border);
          padding-bottom: 0.75rem;
        }
        .channel-header h3 {
          font-size: 1rem;
          margin: 0;
          font-family: 'Outfit', sans-serif;
          color: var(--text-main);
          font-weight: 700;
        }
        .channel-body {
          display: flex;
          flex-direction: column;
          gap: 0.65rem;
        }
        .metric-row {
          display: flex;
          justify-content: space-between;
          align-items: center;
          font-size: 0.9rem;
          color: var(--text-muted);
        }
        .metric-row .value {
          font-family: 'Outfit', sans-serif;
          font-weight: 700;
          color: var(--text-main);
        }
        .metric-row .value.cost {
          color: var(--text-muted);
          font-weight: 500;
        }
        .profit-row {
          padding-top: 0.5rem;
          border-top: 1px dashed var(--surface-border);
        }
        .text-success .value {
          color: var(--success) !important;
        }
        .total-card {
          border: 1px solid hsl(35, 90%, 90%);
          background: linear-gradient(180deg, #fff 0%, hsl(35, 90%, 99%) 100%);
        }
        .text-success-total .value {
          color: var(--success) !important;
          font-size: 1.1rem;
        }
        .total-value {
          font-size: 1.1rem;
        }
        .total-value-profit {
          font-size: 1.2rem;
        }

        .analytics-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 1.5rem; }
        .stat-card { padding: 2rem; position: relative; overflow: hidden; }
        .stat-card h3 { font-size: 0.9rem; color: var(--text-muted); text-transform: uppercase; font-weight: 600; margin-bottom: 0.75rem; }
        .stat-value { font-size: 2.8rem; font-family: 'Outfit', sans-serif; font-weight: 800; color: var(--text-main); letter-spacing: -0.02em; }
        
        .profit-card { border-bottom: 4px solid var(--success); }
        .text-success { color: var(--success); }
        .pink-text { color: hsl(330, 70%, 45%); }

        .content-grid-split { display: grid; grid-template-columns: 1.5fr 1fr; gap: 2rem; }
        @media (max-width: 992px) { .content-grid-split { grid-template-columns: 1fr; } }
        
        @media (max-width: 768px) {
          .page-header { flex-direction: column; align-items: stretch; }
          .header-right { flex-direction: column; align-items: stretch; gap: 0.75rem; width: 100%; }
          .range-selector {
             width: 100%;
             display: flex;
             flex-wrap: wrap;
             gap: 0.25rem;
             padding: 0.25rem;
             border-radius: var(--radius-lg);
           }
           .range-btn {
             flex: 1 1 calc(33.33% - 0.25rem);
             min-width: 80px;
             text-align: center;
             padding: 0.45rem 0.5rem !important;
             font-size: 0.8rem !important;
           }
          .custom-date-picker { width: 100%; display: flex; justify-content: space-between; }
          .stat-value { font-size: 2.2rem !important; }
          .stat-card { padding: 1.25rem !important; }
        }

        .visual-popularity-list { display: flex; flex-direction: column; gap: 0.5rem; padding: 1rem; }
        .popularity-row { 
          position: relative; height: 50px; display: flex; align-items: center; 
          border-radius: var(--radius-md); overflow: hidden; background: var(--bg-deep);
        }
        .row-bg { 
          position: absolute; left: 0; top: 0; bottom: 0; 
          background: linear-gradient(90deg, var(--secondary) 0%, var(--surface-border) 100%); 
          opacity: 0.6; transition: width 0.8s cubic-bezier(0.4, 0, 0.2, 1);
        }
        .row-content { 
          position: relative; z-index: 1; width: 100%; padding: 0 1.25rem; 
          display: flex; justify-content: space-between; align-items: center; 
        }
        .product-info { display: flex; flex-direction: column; }
        .product-name { font-weight: 700; color: var(--text-main); font-size: 0.95rem; }
        .product-qty { font-size: 0.75rem; color: var(--text-muted); font-weight: 500; }
        .product-revenue { font-family: 'Outfit', sans-serif; font-weight: 800; color: var(--primary); font-size: 1rem; }

        .analytics-vertical-grid { display: flex; flex-direction: column; gap: 1rem; }
        .mini-stat { padding: 1.25rem; display: flex; justify-content: space-between; align-items: center; transition: var(--transition); }
        .mini-stat:hover { transform: translateX(5px); }
        .mini-info { display: flex; flex-direction: column; gap: 0.2rem; }
        .mini-label { font-size: 0.8rem; color: var(--text-muted); font-weight: 500; }
        .mini-value { font-size: 1.2rem; font-weight: 700; color: var(--text-main); font-family: 'Outfit', sans-serif; }
        .mini-price { font-family: 'Outfit', sans-serif; font-weight: 800; font-size: 1.1rem; color: var(--primary); }
        .danger-border { border-left: 4px solid hsl(330, 80%, 92%); }

        .stat-footer { margin-top: 1.5rem; padding-top: 1rem; border-top: 1px solid var(--surface-border); }
      `}</style>

      {/* Write-off Details Modal */}
      {selectedWriteOffDetails && typeof window !== 'undefined' && createPortal(
        <div className="modal-overlay fade-in" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="modal-content glass-card fade-in-up" style={{ padding: '2rem', width: '100%', maxWidth: '500px', background: '#ffffff', borderRadius: 'var(--radius-lg)', boxShadow: '0 10px 30px rgba(0,0,0,0.2)' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.25rem', margin: 0, fontWeight: 700 }}>Подробности списания</h2>
              <button className="btn btn-secondary" style={{ padding: '0.4rem 0.6rem', fontSize: '1rem' }} onClick={() => setSelectedWriteOffDetails(null)}>✕</button>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.02)', padding: '1.25rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--surface-border)', whiteSpace: 'pre-wrap', fontSize: '0.9rem', color: 'var(--text-main)', lineHeight: '1.5' }}>
              {selectedWriteOffDetails}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Online Sales Details Modal */}
      {onlineSalesModalOpen && typeof window !== 'undefined' && createPortal(
        <div className="modal-overlay fade-in" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="modal-content glass-card fade-in-up" style={{ padding: '2rem', width: '100%', maxWidth: '750px', maxHeight: '90vh', overflowY: 'auto', background: '#ffffff', borderRadius: 'var(--radius-lg)', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', margin: 0, fontFamily: 'Outfit, sans-serif', fontWeight: 800, color: 'var(--text-main)' }}>
                  {language === 'RU' ? 'Детализация продаж на сайте' : 'Website Sales Details'}
                </h2>
              </div>
              <button 
                className="btn btn-secondary" 
                style={{ padding: '0.4rem 0.6rem', fontSize: '1.2rem', lineHeight: 1 }} 
                onClick={() => setOnlineSalesModalOpen(false)}
              >
                ✕
              </button>
            </div>
            
            <input 
              type="text" 
              className="input-field" 
              placeholder={language === 'RU' ? 'Поиск по номеру заказа или деталям...' : 'Search by order number or details...'}
              value={onlineSalesSearch}
              onChange={(e) => setOnlineSalesSearch(e.target.value)}
              style={{ width: '100%' }}
            />

            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
              {onlineSalesDetails.length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  {language === 'RU' ? 'Нет заказов за этот период' : 'No orders in this period'}
                </div>
              ) : onlineSalesDetails.filter(o => 
                (o.orderId && o.orderId.includes(onlineSalesSearch)) || 
                (o.details && o.details.toLowerCase().includes(onlineSalesSearch.toLowerCase()))
              ).length === 0 ? (
                <div style={{ textAlign: 'center', padding: '2rem', color: 'var(--text-muted)' }}>
                  {language === 'RU' ? 'Ничего не найдено по вашему запросу' : 'Nothing found'}
                </div>
              ) : onlineSalesDetails.filter(o => 
                (o.orderId && o.orderId.includes(onlineSalesSearch)) || 
                (o.details && o.details.toLowerCase().includes(onlineSalesSearch.toLowerCase()))
              ).map((o, idx) => (
                <div key={o.id || idx} style={{ 
                  display: 'flex', 
                  flexDirection: 'column', 
                  gap: '0.5rem', 
                  padding: '1rem', 
                  borderRadius: 'var(--radius-md)', 
                  border: `1px solid ${o.isFullyLinked ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)'}`,
                  background: o.isFullyLinked ? 'rgba(16, 185, 129, 0.03)' : 'rgba(239, 68, 68, 0.03)'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
                      <span style={{ 
                        fontWeight: 800, 
                        fontFamily: 'Outfit, sans-serif', 
                        color: o.isFullyLinked ? 'rgb(5, 150, 105)' : 'rgb(220, 38, 38)',
                        fontSize: '1.1rem' 
                      }}>
                        {language === 'RU' ? 'Заказ' : 'Order'} {o.orderId ? (
                          wpBaseUrl ? (
                            <a 
                              href={`${wpBaseUrl.replace(/\/$/, '')}/wp-admin/post.php?post=${o.orderId}&action=edit`} 
                              target="_blank" 
                              rel="noopener noreferrer"
                              style={{ textDecoration: 'underline', cursor: 'pointer', color: 'inherit' }}
                              onClick={(e) => e.stopPropagation()}
                              title={language === 'RU' ? 'Открыть в WooCommerce' : 'Open in WooCommerce'}
                            >
                              #{o.orderId} ↗
                            </a>
                          ) : (
                            `#${o.orderId}`
                          )
                        ) : ''}
                      </span>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                        {new Date(o.date).toLocaleString(language === 'RU' ? 'ru-RU' : 'en-US')}
                      </span>
                    </div>
                    <span style={{ fontWeight: 800, fontSize: '1.1rem', color: 'var(--text-main)' }}>
                      ${o.total.toFixed(2)}
                    </span>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: o.isFullyLinked ? 'var(--text-main)' : 'var(--error)', whiteSpace: 'pre-wrap', lineHeight: '1.4' }}>
                    {o.details || (language === 'RU' ? 'Нет описания' : 'No description')}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Detailed Reserved Items Modal */}
      {isReservedModalOpen && typeof window !== 'undefined' && createPortal(
        <div className="modal-overlay fade-in" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000, padding: '1rem' }}>
          <div className="modal-content glass-card fade-in-up" style={{ padding: '2rem', width: '100%', maxWidth: '750px', maxHeight: '90vh', overflowY: 'auto', background: '#ffffff', borderRadius: 'var(--radius-lg)', boxShadow: '0 10px 30px rgba(0,0,0,0.2)', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', margin: 0, fontFamily: 'Outfit, sans-serif', fontWeight: 800, color: 'var(--text-main)' }}>
                  {language === 'RU' ? 'Детализация резервов' : 'Reserves Breakdown'}
                </h2>
              </div>
              <button 
                onClick={() => setIsReservedModalOpen(false)}
                style={{ background: 'none', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: 'var(--text-muted)', padding: '0.25rem' }}
              >
                ×
              </button>
            </div>
            <div className="range-selector glass-panel" style={{ display: 'flex', padding: '0.25rem', gap: '0.25rem', borderRadius: 'var(--radius-lg)', background: 'rgba(0,0,0,0.03)', border: '1px solid var(--surface-border)', width: 'fit-content' }}>
              <button 
                className={`range-btn ${reservedTab === 'BOUQUETS' ? 'active' : ''}`}
                onClick={() => setReservedTab('BOUQUETS')}
                style={{ padding: '0.45rem 1.15rem', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', fontWeight: 600, border: 'none', cursor: 'pointer', background: reservedTab === 'BOUQUETS' ? 'hsl(330, 70%, 45%)' : 'transparent', color: reservedTab === 'BOUQUETS' ? '#fff' : 'var(--text-muted)' }}
              >
                {t('analytics.modal_showcase_bouquets_count', { count: rawShowcase.filter(i => i.status === 'AVAILABLE' || i.status === 'RESERVED').length })}
              </button>
              <button 
                className={`range-btn ${reservedTab === 'ORDERS' ? 'active' : ''}`}
                onClick={() => setReservedTab('ORDERS')}
                style={{ padding: '0.45rem 1.15rem', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', fontWeight: 600, border: 'none', cursor: 'pointer', background: reservedTab === 'ORDERS' ? 'var(--primary)' : 'transparent', color: reservedTab === 'ORDERS' ? '#fff' : 'var(--text-muted)' }}
              >
                {t('analytics.modal_website_sales_count', { count: activeOrders.length })}
              </button>
              <button 
                className={`range-btn ${reservedTab === 'RAW' ? 'active' : ''}`}
                onClick={() => setReservedTab('RAW')}
                style={{ padding: '0.45rem 1.15rem', borderRadius: 'var(--radius-md)', fontSize: '0.85rem', fontWeight: 600, border: 'none', cursor: 'pointer', background: reservedTab === 'RAW' ? '#333' : 'transparent', color: reservedTab === 'RAW' ? '#fff' : 'var(--text-muted)' }}
              >
                {t('analytics.modal_raw_warehouse_count', { count: rawProducts.filter(p => p.reserved > 0).length })}
              </button>
            </div>

            {/* Tab content panel */}
            <div style={{ flex: 1, minHeight: '280px', maxHeight: '50vh', overflowY: 'auto', background: 'rgba(0,0,0,0.01)', border: '1px solid var(--surface-border)', borderRadius: 'var(--radius-md)', padding: '1rem' }}>
              
              {reservedTab === 'BOUQUETS' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {rawShowcase.filter(i => i.status === 'AVAILABLE' || i.status === 'RESERVED').length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      {t('analytics.modal_showcase_empty')}
                    </div>
                  ) : (
                    rawShowcase.filter(i => i.status === 'AVAILABLE' || i.status === 'RESERVED').map((item: any) => {
                      const comps = JSON.parse(item.components || '[]');
                      return (
                        <div key={item.id} style={{ background: '#fff', border: '1px solid var(--surface-border)', borderRadius: 'var(--radius-sm)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                              <span style={{ fontWeight: 700, color: 'var(--text-main)', fontSize: '1rem' }}>{item.name}</span>
                              <span style={{ fontSize: '0.65rem', padding: '0.1rem 0.35rem', borderRadius: '3px', fontWeight: 700, background: item.status === 'AVAILABLE' ? 'rgba(16,185,129,0.1)' : 'rgba(230,92,141,0.1)', color: item.status === 'AVAILABLE' ? 'var(--success)' : 'var(--primary)' }}>
                                {item.status === 'AVAILABLE' ? t('analytics.modal_available') : t('analytics.modal_reserved')}
                              </span>
                            </div>
                            <span style={{ fontWeight: 800, color: 'var(--primary)' }}>${item.retailPrice.toFixed(2)}</span>
                          </div>
                          <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                            {t('analytics.modal_created')} {new Date(item.createdAt).toLocaleDateString()} {t('analytics.modal_created_at')} {new Date(item.createdAt).toLocaleTimeString()}
                          </div>
                          <div style={{ background: 'rgba(0,0,0,0.02)', padding: '0.5rem', borderRadius: '4px', marginTop: '0.25rem' }}>
                            <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>{t('analytics.modal_composition')}</div>
                            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.35rem' }}>
                              {comps.map((c: any, idx: number) => {
                                const prod = rawProducts.find((x: any) => x.id === c.id);
                                return (
                                  <span key={idx} style={{ background: 'rgba(230, 92, 141, 0.05)', color: 'var(--primary)', padding: '0.15rem 0.4rem', borderRadius: '2px', fontSize: '0.75rem' }}>
                                    {prod ? (language === 'RU' ? prod.name : prod.nameEn || prod.name) : c.id} (x{c.quantity} {prod ? (language === 'RU' ? prod.unit : prod.unitEn || prod.unit) : (language === 'RU' ? 'шт' : 'pcs')})
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        </div>
                      );
                    })
                  )}
                </div>
              )}

              {reservedTab === 'ORDERS' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {activeOrdersLoading ? (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'center', justifyContent: 'center', height: '180px' }}>
                      <div className="spinner" style={{ width: '24px', height: '24px', border: '2px solid rgba(0,0,0,0.1)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600, color: 'var(--text-muted)' }}>{t('analytics.modal_loading_orders')}</span>
                    </div>
                  ) : activeOrders.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      {t('analytics.modal_no_orders')}
                    </div>
                  ) : (
                    activeOrders.map((order: any) => (
                      <div key={order.id} style={{ background: '#fff', border: '1px solid var(--surface-border)', borderRadius: 'var(--radius-sm)', padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                            <span style={{ fontWeight: 700, color: 'var(--text-main)' }}>{t('analytics.modal_order_num', { id: order.id })}</span>
                            <span style={{ fontSize: '0.7rem', padding: '0.1rem 0.4rem', borderRadius: 'var(--radius-pill)', textTransform: 'uppercase', fontWeight: 700, background: order.status === 'processing' ? 'rgba(0,180,100,0.1)' : 'rgba(255,180,0,0.1)', color: order.status === 'processing' ? 'var(--success)' : 'hsl(35,80%,45%)' }}>
                              {order.status}
                            </span>
                          </div>
                          <span style={{ fontWeight: 800, color: 'var(--primary)' }}>${parseFloat(order.total || '0').toFixed(2)}</span>
                        </div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', display: 'flex', justifyContent: 'space-between' }}>
                          <span>{t('analytics.modal_client')} <strong>{order.billing?.first_name} {order.billing?.last_name || ''}</strong></span>
                          <span>{t('analytics.modal_date')} {new Date(order.date_created).toLocaleDateString()}</span>
                        </div>
                        <div style={{ background: 'rgba(0,0,0,0.02)', padding: '0.5rem', borderRadius: '4px', marginTop: '0.25rem' }}>
                          <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', marginBottom: '0.25rem' }}>{t('analytics.modal_order_items')}</div>
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.2' }}>
                            {order.line_items?.map((item: any, idx: number) => (
                              <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem' }}>
                                <span>🌸 {item.name} <strong style={{ color: 'var(--text-muted)' }}>{item.sku ? `(${item.sku})` : ''}</strong></span>
                                <span style={{ fontWeight: 600 }}>x{item.quantity}</span>
                              </div>
                            ))}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}

              {reservedTab === 'RAW' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                  {rawProducts.filter(p => p.reserved > 0).length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '3rem', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      {t('analytics.modal_no_raw_reserved')}
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                      {rawProducts.filter(p => p.reserved > 0).map((p: any) => (
                        <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0.6rem 0.8rem', background: '#fff', border: '1px solid var(--surface-border)', borderRadius: '4px', fontSize: '0.9rem' }}>
                          <div>
                            <strong style={{ color: 'var(--text-main)' }}>{language === 'RU' ? p.name : p.nameEn || p.name}</strong>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('analytics.modal_sku')} {p.sku} | {t('analytics.modal_category')} {p.category === 'FLOWER' ? (language === 'RU' ? 'Цветы' : 'Flowers') : p.category === 'GIFT' ? (language === 'RU' ? 'Подарки' : 'Gifts') : p.category === 'PACKAGING' ? (language === 'RU' ? 'Упаковка' : 'Packaging') : (language === 'RU' ? 'Материалы' : 'Materials')}</div>
                          </div>
                          <div style={{ textAlign: 'right' }}>
                            <span style={{ fontWeight: 700, color: 'hsl(330, 70%, 45%)', fontSize: '1rem' }}>
                              {p.reserved} {language === 'RU' ? p.unit : p.unitEn || p.unit}
                            </span>
                            <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{t('analytics.modal_retail_value')} ${(p.retailPrice * p.reserved).toFixed(2)}</div>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => setIsReservedModalOpen(false)}
                style={{ padding: '0.5rem 1.5rem', fontWeight: 600 }}
              >
                {t('analytics.modal_close')}
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </div>
  );
}
