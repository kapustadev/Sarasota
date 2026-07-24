'use client';

import { useState, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../components/LanguageContext';
import { useAuth } from '../components/AuthProvider';

interface ExpenseItem {
  id: string;
  description: string;
  amount: number;
  category: string;
  channel: 'PHYSICAL' | 'ONLINE';
  createdAt: string;
}

interface ExpenseMetrics {
  total: number;
  physical: number;
  online: number;
}

export default function ExpensesPage() {
  const { t, language } = useLanguage();
  const { user } = useAuth();
  
  const [mounted, setMounted] = useState(false);
  const [expenses, setExpenses] = useState<ExpenseItem[]>([]);
  const [metrics, setMetrics] = useState<ExpenseMetrics>({ total: 0, physical: 0, online: 0 });
  const [loading, setLoading] = useState(true);

  // Form State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [description, setDescription] = useState('');
  const [amount, setAmount] = useState('');
  const [channel, setChannel] = useState<'PHYSICAL' | 'ONLINE'>('PHYSICAL');
  const [category, setCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [isCustomCategory, setIsCustomCategory] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [channelFilter, setChannelFilter] = useState<'ALL' | 'PHYSICAL' | 'ONLINE'>('ALL');
  const [categoryFilter, setCategoryFilter] = useState('ALL');
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    fetchExpenses();
    setMounted(true);
  }, []);

  const fetchExpenses = async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/expenses');
      if (res.ok) {
        const data = await res.json();
        setExpenses(data.expenses || []);
        setMetrics(data.metrics || { total: 0, physical: 0, online: 0 });
      }
    } catch (e) {
      console.error('Error fetching expenses:', e);
    } finally {
      setLoading(false);
    }
  };

  // Preset categories for easy selection
  const presetCategories = {
    PHYSICAL: [
      { id: 'rent', RU: 'Аренда помещения', EN: 'Premises Rent' },
      { id: 'utilities', RU: 'Коммунальные услуги', EN: 'Utilities & Power' },
      { id: 'salaries', RU: 'Оплата труда (ЗП)', EN: 'Staff Salaries' },
      { id: 'equipment', RU: 'Инвентарь и упаковка', EN: 'Equipment & Deco' },
      { id: 'marketing_offline', RU: 'Локальная реклама', EN: 'Local Marketing' },
      { id: 'other', RU: 'Другое', EN: 'Other' }
    ],
    ONLINE: [
      { id: 'hosting', RU: 'Хостинг и домены', EN: 'Hosting & Domains' },
      { id: 'gateway', RU: 'Комиссии платежных шлюзов', EN: 'Gateway Commissions' },
      { id: 'ads', RU: 'Контекстная реклама (Google/FB)', EN: 'Online Ads Campaigns' },
      { id: 'saas', RU: 'Подписки на SaaS / API', EN: 'SaaS Software Fees' },
      { id: 'other', RU: 'Другое', EN: 'Other' }
    ]
  };

  // Get unique list of registered categories for filter dropdown
  const registeredCategories = useMemo(() => {
    const categories = expenses.map(e => e.category);
    return ['ALL', ...Array.from(new Set(categories)).sort()];
  }, [expenses]);

  // Filter history log
  const filteredExpenses = useMemo(() => {
    return expenses.filter(e => {
      const matchSearch = e.description.toLowerCase().includes(searchQuery.toLowerCase()) || 
                          e.category.toLowerCase().includes(searchQuery.toLowerCase());
      const matchChannel = channelFilter === 'ALL' || e.channel === channelFilter;
      const matchCategory = categoryFilter === 'ALL' || e.category === categoryFilter;
      return matchSearch && matchChannel && matchCategory;
    });
  }, [expenses, searchQuery, channelFilter, categoryFilter]);

  const handleOpenAddModal = () => {
    setDescription('');
    setAmount('');
    setChannel('PHYSICAL');
    const firstCat = presetCategories.PHYSICAL[0][language === 'RU' ? 'RU' : 'EN'];
    setCategory(firstCat);
    setCustomCategory('');
    setIsCustomCategory(false);
    setIsModalOpen(true);
  };

  const handleChannelChange = (selectedChannel: 'PHYSICAL' | 'ONLINE') => {
    setChannel(selectedChannel);
    // Autofill with the first category of that channel
    const firstCat = presetCategories[selectedChannel][0][language === 'RU' ? 'RU' : 'EN'];
    setCategory(firstCat);
    setIsCustomCategory(false);
  };

  const handleCategoryChange = (val: string) => {
    if (val === 'CUSTOM') {
      setIsCustomCategory(true);
      setCategory('');
    } else {
      setIsCustomCategory(false);
      setCategory(val);
    }
  };

  const handleSaveExpense = async () => {
    const finalCategory = isCustomCategory ? customCategory.trim() : category;

    if (!description.trim()) {
      alert(language === 'RU' ? 'Укажите описание расхода' : 'Please provide description');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      alert(language === 'RU' ? 'Укажите корректную сумму расхода' : 'Please specify a valid amount');
      return;
    }
    if (!finalCategory.trim()) {
      alert(language === 'RU' ? 'Укажите категорию расхода' : 'Please specify a category');
      return;
    }

    setSubmitting(true);
    try {
      const res = await fetch('/api/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          description: description.trim(),
          amount: parseFloat(amount),
          category: finalCategory,
          channel,
          userId: user?.name || 'SYSTEM'
        })
      });

      if (res.ok) {
        setIsModalOpen(false);
        fetchExpenses();
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch (e) {
      console.error(e);
      alert('Error connecting to server');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteExpense = async (id: string, desc: string, amt: number) => {
    const confirmMsg = language === 'RU'
      ? `Вы уверены, что хотите удалить расход "${desc}" на сумму $${amt.toFixed(2)}?\nЭто действие нельзя отменить.`
      : `Are you sure you want to delete the expense "${desc}" for $${amt.toFixed(2)}?\nThis action cannot be undone.`;

    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch(`/api/expenses/${id}?userId=${encodeURIComponent(user?.name || 'SYSTEM')}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        fetchExpenses();
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch (e) {
      console.error(e);
      alert('Network error during deletion');
    }
  };

  const handleExportExcel = async () => {
    setExporting(true);
    try {
      const ExcelJS = (await import('exceljs')).default;
      const { saveAs } = await import('file-saver');

      const workbook = new ExcelJS.Workbook();
      
      const sheet = workbook.addWorksheet(language === 'RU' ? 'Расходы' : 'Expenses');
      sheet.columns = [
        { header: language === 'RU' ? 'Дата записи' : 'Log Date', key: 'date', width: 20 },
        { header: language === 'RU' ? 'Канал' : 'Channel', key: 'channel', width: 20 },
        { header: language === 'RU' ? 'Категория' : 'Category', key: 'category', width: 25 },
        { header: language === 'RU' ? 'Описание' : 'Description', key: 'desc', width: 40 },
        { header: language === 'RU' ? 'Сумма ($)' : 'Amount ($)', key: 'amount', width: 15 },
      ];
      sheet.getRow(1).font = { bold: true };
      
      filteredExpenses.forEach(e => {
        sheet.addRow({
          date: new Date(e.createdAt).toLocaleString(language === 'RU' ? 'ru-RU' : 'en-US'),
          channel: e.channel === 'PHYSICAL' ? (language === 'RU' ? 'Магазин' : 'Retail') : (language === 'RU' ? 'Интернет-магазин' : 'Online'),
          category: e.category,
          desc: e.description,
          amount: e.amount
        });
      });

      const buffer = await workbook.xlsx.writeBuffer();
      const filePrefix = language === 'RU' ? 'Расходы' : 'Expenses';
      saveAs(new Blob([buffer]), `${filePrefix}_${new Date().toLocaleDateString(language === 'RU' ? 'ru-RU' : 'en-US')}.xlsx`);
    } catch (e) {
      console.error('Export failed:', e);
      alert(language === 'RU' ? 'Ошибка при экспорте в Excel' : 'Error exporting to Excel');
    } finally {
      setExporting(false);
    }
  };
 
  // Visual Chart Details
  const physicalPercent = metrics.total > 0 ? (metrics.physical / metrics.total) * 100 : 50;
  const onlinePercent = metrics.total > 0 ? (metrics.online / metrics.total) * 100 : 50;
 
  return (
    <div className="expenses-dashboard fade-in" style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
      
      {/* Header */}
      <header style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem' }}>
        <div>
          <h1 style={{ fontSize: '2.2rem', marginBottom: '0.25rem', color: 'var(--text-main)' }}>
            {language === 'RU' ? 'Учет Затрат & Расходов' : 'Expense & Costs Ledger'}
          </h1>
          <p className="subtitle">
            {language === 'RU' ? 'Операционные расходы физической витрины и интернет-магазина' : 'Operational costs of retail storefront and web channels'}
          </p>
        </div>
        <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
          <button 
            className="btn btn-primary" 
            style={{ height: '38px', padding: '0 1.25rem', display: 'flex', alignItems: 'center', gap: '0.35rem', fontWeight: 600, background: 'var(--success)' }}
            onClick={handleExportExcel}
            disabled={loading || exporting}
          >
            {exporting ? (language === 'RU' ? '⏳ Формируем...' : '⏳ Exporting...') : ('📊 ' + (language === 'RU' ? 'Экспорт в Excel' : 'Export to Excel'))}
          </button>
          <button className="btn btn-primary" onClick={handleOpenAddModal} style={{ height: '38px', padding: '0 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
            <span style={{ fontSize: '1.2rem' }}>➕</span> {language === 'RU' ? 'Добавить расход' : 'Log Expense'}
          </button>
        </div>
      </header>

      {/* KPI Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: '1.5rem' }}>
        
        {/* Total Cost card */}
        <div className="glass-card" style={{ padding: '1.75rem', borderBottom: '4px solid var(--accent)' }}>
          <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.5rem' }}>
            {language === 'RU' ? 'Общие расходы' : 'Consolidated Expenses'}
          </h3>
          <p style={{ fontSize: '2.6rem', fontFamily: 'Outfit, sans-serif', fontWeight: 800, color: 'var(--text-main)' }}>
            ${metrics.total.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {language === 'RU' ? 'Всего затрат по обоим каналам' : 'Total operational costs recorded'}
          </p>
        </div>

        {/* Physical Store Costs card */}
        <div className="glass-card" style={{ padding: '1.75rem', borderBottom: '4px solid hsl(330, 70%, 45%)' }}>
          <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.5rem' }}>
            {language === 'RU' ? 'Расходы магазина (Витрина)' : 'Physical Storefront Holding'}
          </h3>
          <p style={{ fontSize: '2.6rem', fontFamily: 'Outfit, sans-serif', fontWeight: 800, color: 'hsl(330, 70%, 45%)' }}>
            ${metrics.physical.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {language === 'RU' ? 'Аренда, коммунальные, зарплаты сотрудников' : 'Premises rent, utilities, local staff wages'}
          </p>
        </div>

        {/* Online Store Costs card */}
        <div className="glass-card" style={{ padding: '1.75rem', borderBottom: '4px solid hsl(270, 60%, 40%)' }}>
          <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', fontWeight: 600, marginBottom: '0.5rem' }}>
            {language === 'RU' ? 'Интернет-магазин (Сайт)' : 'E-commerce Website Fees'}
          </h3>
          <p style={{ fontSize: '2.6rem', fontFamily: 'Outfit, sans-serif', fontWeight: 800, color: 'hsl(270, 60%, 40%)' }}>
            ${metrics.online.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </p>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
            {language === 'RU' ? 'Хостинг, платежный шлюз, реклама Google/FB' : 'Hosting servers, stripe gateway, AdWords campaign'}
          </p>
        </div>

      </div>

      {/* SVG Splits Visual Analytics */}
      <section className="glass-card" style={{ padding: '1.5rem', display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <h2 style={{ fontSize: '1.1rem', textTransform: 'uppercase', letterSpacing: '0.05em', color: 'var(--text-muted)', fontWeight: 600 }}>
          {language === 'RU' ? 'Долевое разделение расходов' : 'Expense Distribution split ratio'}
        </h2>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.9rem', fontWeight: 600 }}>
            <span style={{ color: 'hsl(330, 70%, 45%)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              🌸 {language === 'RU' ? 'Магазин' : 'Retail'}: {physicalPercent.toFixed(1)}% (${metrics.physical.toFixed(2)})
            </span>
            <span style={{ color: 'hsl(270, 60%, 40%)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
              🌐 {language === 'RU' ? 'Интернет-магазин' : 'Online Website'}: {onlinePercent.toFixed(1)}% (${metrics.online.toFixed(2)})
            </span>
          </div>

          {/* Premium CSS gradient ratio bar */}
          <div style={{ 
            height: '24px', 
            width: '100%', 
            background: '#e5e7eb', 
            borderRadius: 'var(--radius-pill)', 
            overflow: 'hidden', 
            display: 'flex', 
            border: '1px solid var(--surface-border)',
            boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.06)'
          }}>
            {metrics.total === 0 ? (
              <div style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                {language === 'RU' ? 'Нет данных для разделения' : 'No cost logs recorded'}
              </div>
            ) : (
              <>
                <div 
                  style={{ 
                    width: `${physicalPercent}%`, 
                    background: 'linear-gradient(90deg, hsl(330, 80%, 75%) 0%, hsl(330, 70%, 45%) 100%)', 
                    transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: 'inset 0 -4px 8px rgba(0,0,0,0.1)'
                  }} 
                />
                <div 
                  style={{ 
                    width: `${onlinePercent}%`, 
                    background: 'linear-gradient(90deg, hsl(270, 75%, 70%) 0%, hsl(270, 60%, 40%) 100%)', 
                    transition: 'width 0.8s cubic-bezier(0.4, 0, 0.2, 1)',
                    boxShadow: 'inset 0 -4px 8px rgba(0,0,0,0.1)'
                  }} 
                />
              </>
            )}
          </div>
        </div>
      </section>

      {/* Bookkeeping Filter Controls */}
      <div className="glass-card fade-in flex-wrap-mobile" style={{ padding: '1.25rem', display: 'flex', gap: '1rem', alignItems: 'flex-end', zIndex: 10 }}>
        
        {/* Quick Search */}
        <div style={{ flex: 2, minWidth: '220px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            {language === 'RU' ? 'Текстовый поиск' : 'Search expense'}
          </label>
          <input 
            type="text" 
            placeholder={language === 'RU' ? 'Поиск по описанию или категории...' : 'Search by description or category...'}
            className="input-field"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Channel Switch */}
        <div style={{ flex: 1, minWidth: '150px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            {language === 'RU' ? 'Канал расходов' : 'Channel filter'}
          </label>
          <select 
            className="input-field" 
            value={channelFilter} 
            onChange={(e) => setChannelFilter(e.target.value as any)}
          >
            <option value="ALL">{language === 'RU' ? 'Все каналы' : 'All channels'}</option>
            <option value="PHYSICAL">🌸 {language === 'RU' ? 'Магазин' : 'Retail'}</option>
            <option value="ONLINE">🌐 {language === 'RU' ? 'Интернет-магазин' : 'Online'}</option>
          </select>
        </div>

        {/* Category checklist */}
        <div style={{ flex: 1.5, minWidth: '180px', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
          <label style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>
            {language === 'RU' ? 'Фильтр по категориям' : 'Category filter'}
          </label>
          <select 
            className="input-field" 
            value={categoryFilter} 
            onChange={(e) => setCategoryFilter(e.target.value)}
          >
            <option value="ALL">{language === 'RU' ? 'Все категории' : 'All categories'}</option>
            {registeredCategories.filter(c => c !== 'ALL').map(cat => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>

        {/* Clear Filters */}
        {(searchQuery || channelFilter !== 'ALL' || categoryFilter !== 'ALL') && (
          <button 
            className="btn btn-secondary" 
            onClick={() => { setSearchQuery(''); setChannelFilter('ALL'); setCategoryFilter('ALL'); }}
            style={{ height: '36px', padding: '0 1rem', fontSize: '0.85rem', display: 'flex', alignItems: 'center', gap: '0.25rem', fontWeight: 600 }}
          >
            🔄 {language === 'RU' ? 'Сбросить' : 'Clear'}
          </button>
        )}
      </div>

      {/* History table */}
      <div className="table-wrapper glass-card">
        <div className="table-header p-6" style={{ borderBottom: '1px solid var(--surface-border)', paddingBottom: '1rem' }}>
          <h2 style={{ fontSize: '1.25rem', color: 'var(--text-main)' }}>
            {language === 'RU' ? 'Журнал расходов' : 'Expenses Ledger Log'}
          </h2>
        </div>

        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--primary)' }}>
            <div className="spinner" style={{ width: '24px', height: '24px', border: '2px solid rgba(0,0,0,0.1)', borderTopColor: 'var(--primary)', borderRadius: '50%', animation: 'spin 1s linear infinite', margin: '0 auto 1rem auto' }}></div>
            {language === 'RU' ? 'Загрузка затрат...' : 'Loading expense list...'}
          </div>
        ) : filteredExpenses.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
            {language === 'RU' ? 'Журнал расходов пуст или ничего не найдено по фильтрам' : 'Expenses list is empty or matches no filters.'}
          </div>
        ) : (
          <div style={{ overflowX: 'auto', width: '100%' }}>
            <table className="purchases-table" style={{ width: '100%', minWidth: '700px', borderCollapse: 'collapse', textAlign: 'left' }}>
              <thead>
                <tr style={{ background: 'rgba(0,0,0,0.01)', borderBottom: '1px solid var(--surface-border)' }}>
                  <th style={{ padding: '1rem' }}>{language === 'RU' ? 'Дата записи' : 'Log Date'}</th>
                  <th style={{ padding: '1rem' }}>{language === 'RU' ? 'Канал' : 'Channel'}</th>
                  <th style={{ padding: '1rem' }}>{language === 'RU' ? 'Категория' : 'Category'}</th>
                  <th style={{ padding: '1rem' }}>{language === 'RU' ? 'Описание' : 'Description'}</th>
                  <th style={{ padding: '1rem' }}>{language === 'RU' ? 'Сумма затрат' : 'Amount'}</th>
                  <th style={{ padding: '1rem', width: '100px', textAlign: 'center' }}>{language === 'RU' ? 'Действие' : 'Action'}</th>
                </tr>
              </thead>
              <tbody>
                {filteredExpenses.map((e) => (
                  <tr key={e.id} style={{ borderBottom: '1px solid var(--surface-border)', transition: 'background 0.2s' }}>
                    <td style={{ padding: '1rem', fontSize: '0.85rem' }}>{new Date(e.createdAt).toLocaleString()}</td>
                    <td style={{ padding: '1rem' }}>
                      <span className={`badge ${e.channel === 'PHYSICAL' ? 'badge-pink' : 'badge-violet'}`} style={{ display: 'inline-flex', fontSize: '0.7rem' }}>
                        {e.channel === 'PHYSICAL' 
                          ? (language === 'RU' ? 'Магазин' : 'Retail') 
                          : (language === 'RU' ? 'Сайт' : 'Online')}
                      </span>
                    </td>
                    <td style={{ padding: '1rem', fontWeight: 600, fontSize: '0.85rem' }}>{e.category}</td>
                    <td style={{ padding: '1rem', fontSize: '0.9rem' }}>{e.description}</td>
                    <td style={{ padding: '1rem', fontFamily: 'Outfit, sans-serif', fontWeight: 700, color: 'var(--error)', fontSize: '0.95rem' }}>
                      -${e.amount.toFixed(2)}
                    </td>
                    <td style={{ padding: '1rem', textAlign: 'center' }}>
                      <button 
                        className="btn btn-danger btn-sm" 
                        onClick={() => handleDeleteExpense(e.id, e.description, e.amount)}
                        style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                        title={language === 'RU' ? 'Удалить запись' : 'Delete cost entry'}
                      >
                        🗑️ {language === 'RU' ? 'Удалить' : 'Delete'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Log Expense Modal */}
      {isModalOpen && mounted && createPortal(
        <div className="modal-backdrop" style={{ position: 'fixed', top: 0, left: 0, right: 0, bottom: 0, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 }}>
          <div className="modal-content" style={{ maxWidth: '520px', width: '90vw', backgroundColor: 'var(--surface-base)', color: 'var(--text-main)', padding: '1.75rem', borderRadius: 'var(--radius-xl)', boxShadow: '0 20px 25px -5px rgba(0,0,0,0.15)' }}>
            
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.75rem', marginBottom: '1.25rem' }}>
              <h2 style={{ fontSize: '1.35rem', fontWeight: 800, margin: 0, fontFamily: 'Outfit, sans-serif' }}>
                ✏️ {language === 'RU' ? 'Внести операционные расходы' : 'Log Storefront Cost'}
              </h2>
              <button onClick={() => setIsModalOpen(false)} style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#9ca3af' }}>&times;</button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              
              {/* Channel Switch buttons */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label className="item-label" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4b5563', textTransform: 'uppercase' }}>
                  {language === 'RU' ? 'Канал расходов (Где тратится?)' : 'Operational Cost Channel'}
                </label>
                <div style={{ display: 'flex', gap: '0.5rem', background: '#f3f4f6', padding: '0.25rem', borderRadius: 'var(--radius-lg)' }}>
                  <button 
                    onClick={() => handleChannelChange('PHYSICAL')}
                    style={{ 
                      flex: 1, 
                      padding: '0.45rem', 
                      fontSize: '0.85rem', 
                      fontWeight: 600, 
                      borderRadius: 'var(--radius-md)', 
                      background: channel === 'PHYSICAL' ? '#fff' : 'transparent',
                      color: channel === 'PHYSICAL' ? 'hsl(330, 70%, 45%)' : '#6b7280',
                      boxShadow: channel === 'PHYSICAL' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      transition: 'all 0.2s'
                    }}
                  >
                    🌸 {language === 'RU' ? 'Физический магазин' : 'Physical Retail'}
                  </button>
                  <button 
                    onClick={() => handleChannelChange('ONLINE')}
                    style={{ 
                      flex: 1, 
                      padding: '0.45rem', 
                      fontSize: '0.85rem', 
                      fontWeight: 600, 
                      borderRadius: 'var(--radius-md)', 
                      background: channel === 'ONLINE' ? '#fff' : 'transparent',
                      color: channel === 'ONLINE' ? 'hsl(270, 60%, 40%)' : '#6b7280',
                      boxShadow: channel === 'ONLINE' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
                      transition: 'all 0.2s'
                    }}
                  >
                    🌐 {language === 'RU' ? 'Интернет-магазин' : 'Online E-com'}
                  </button>
                </div>
              </div>

              {/* Description */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label className="item-label" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4b5563', textTransform: 'uppercase' }}>
                  {language === 'RU' ? 'Описание операции' : 'Transaction description'}
                </label>
                <input 
                  type="text" 
                  placeholder={channel === 'PHYSICAL' ? (language === 'RU' ? 'Например: Аренда за май' : 'E.g. Rent for May') : (language === 'RU' ? 'Например: Хостинг серверов AWS' : 'E.g. AWS server hosting')}
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{ padding: '0.55rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 'var(--radius-md)', width: '100%', outline: 'none' }}
                  required
                />
              </div>

              {/* Amount */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label className="item-label" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4b5563', textTransform: 'uppercase' }}>
                  {language === 'RU' ? 'Сумма затрат ($)' : 'Cost amount ($)'}
                </label>
                <input 
                  type="number" 
                  min="0.01" 
                  step="0.01" 
                  placeholder="0.00"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  style={{ padding: '0.55rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 'var(--radius-md)', width: '100%', outline: 'none', fontWeight: 700 }}
                  required
                />
              </div>

              {/* Category */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label className="item-label" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4b5563', textTransform: 'uppercase' }}>
                  {language === 'RU' ? 'Категория расхода' : 'Cost Category'}
                </label>
                <select 
                  className="input-field"
                  onChange={(e) => handleCategoryChange(e.target.value)}
                  style={{ padding: '0.55rem 0.75rem', width: '100%', outline: 'none' }}
                >
                  {presetCategories[channel].map(cat => (
                    <option key={cat.id} value={cat[language === 'RU' ? 'RU' : 'EN']}>
                      {cat[language === 'RU' ? 'RU' : 'EN']}
                    </option>
                  ))}
                  <option value="CUSTOM">{language === 'RU' ? '✍️ Своя категория...' : '✍️ Write custom category...'}</option>
                </select>
              </div>

              {/* Custom Category Input if selected */}
              {isCustomCategory && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem', animation: 'fadeIn 0.2s' }}>
                  <label className="item-label" style={{ fontSize: '0.75rem', fontWeight: 700, color: '#4b5563', textTransform: 'uppercase' }}>
                    {language === 'RU' ? 'Введите новую категорию' : 'Enter custom category name'}
                  </label>
                  <input 
                    type="text" 
                    placeholder={language === 'RU' ? 'Например: Логистика, Упаковка' : 'E.g. Logistics, Materials'}
                    value={customCategory}
                    onChange={(e) => setCustomCategory(e.target.value)}
                    style={{ padding: '0.55rem 0.75rem', border: '1px solid #d1d5db', borderRadius: 'var(--radius-md)', width: '100%', outline: 'none' }}
                    required
                  />
                </div>
              )}

              {/* Action buttons */}
              <div style={{ display: 'flex', gap: '0.75rem', marginTop: '0.75rem' }}>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="btn btn-secondary"
                  style={{ flex: 1, padding: '0.65rem' }}
                  disabled={submitting}
                >
                  {language === 'RU' ? 'Отмена' : 'Cancel'}
                </button>
                <button 
                  onClick={handleSaveExpense}
                  className="btn btn-primary"
                  style={{ flex: 1, padding: '0.65rem', fontWeight: 600 }}
                  disabled={submitting}
                >
                  {submitting ? '...' : (language === 'RU' ? 'Сохранить' : 'Save')}
                </button>
              </div>

            </div>

          </div>
        </div>,
        document.body
      )}

    </div>
  );
}
