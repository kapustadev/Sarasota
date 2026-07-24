'use client';

import { useState, useEffect, useMemo, useRef } from 'react';
import { createPortal } from 'react-dom';
import { useLanguage } from '../components/LanguageContext';
import { useAuth } from '../components/AuthProvider';

interface PurchaseItem {
  productId?: string;
  name: string;
  sku: string;
  barcode: string;
  category: string;
  unit: string;
  quantity: number;
  costPrice: number;
  retailPrice: number;
}

interface PurchaseTransaction {
  id: string;
  createdAt: string;
  totalAmount: number;
  userId: string;
  supplier: string;
  invoiceNumber: string;
  status: string;
  items: PurchaseItem[];
}

interface WarehouseProduct {
  id: string;
  name: string;
  sku: string;
  barcode: string | null;
  category: string;
  unit: string;
  costPrice: number;
  retailPrice: number;
  quantity: number;
}

export interface SupplierProfile {
  id: string;
  name: string;
  country: string;
  legalAddress: string;
  taxId: string;
  phone: string;
  email: string;
  notes: string;
}

export default function PurchasesPage() {
  const [mounted, setMounted] = useState(false);
  const [purchases, setPurchases] = useState<PurchaseTransaction[]>([]);
  const [products, setProducts] = useState<WarehouseProduct[]>([]);
  const [suppliers, setSuppliers] = useState<SupplierProfile[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters and Search
  const [searchQuery, setSearchQuery] = useState('');
  const [supplierFilter, setSupplierFilter] = useState('ALL');
  const [dateFilter, setDateFilter] = useState('ALL');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [minAmount, setMinAmount] = useState('');
  const [maxAmount, setMaxAmount] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('ALL');

  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [editingPurchaseId, setEditingPurchaseId] = useState<string | null>(null);
  const [selectedPurchaseDetails, setSelectedPurchaseDetails] = useState<PurchaseTransaction | null>(null);

  const [isSupplierModalOpen, setIsSupplierModalOpen] = useState(false);
  const [editingSupplierId, setEditingSupplierId] = useState<string | null>(null);
  const [supplierSearchQuery, setSupplierSearchQuery] = useState('');
  const [selectedSupplierView, setSelectedSupplierView] = useState<{ profile: SupplierProfile, purchases: PurchaseTransaction[] } | null>(null);

  const openSupplierDetailsModal = (profile: SupplierProfile, supPurchases: PurchaseTransaction[]) => {
    setSelectedSupplierView({ profile, purchases: supPurchases });
  };
  
  const [newSupplierName, setNewSupplierName] = useState('');
  const [newSupplierCountry, setNewSupplierCountry] = useState('США');
  const [newSupplierAddress, setNewSupplierAddress] = useState('');
  const [newSupplierTaxId, setNewSupplierTaxId] = useState('');
  const [newSupplierPhone, setNewSupplierPhone] = useState('');
  const [newSupplierEmail, setNewSupplierEmail] = useState('');
  const [newSupplierNotes, setNewSupplierNotes] = useState('');
  const [savingSupplier, setSavingSupplier] = useState(false);

  // New Purchase Form State
  const [supplierName, setSupplierName] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [purchaseStatus, setPurchaseStatus] = useState<'IN_TRANSIT' | 'DELIVERED'>('DELIVERED');
  const [purchaseItems, setPurchaseItems] = useState<PurchaseItem[]>([]);
  const [modalScannerInput, setModalScannerInput] = useState('');

  const scannerInputRef = useRef<HTMLInputElement>(null);

  const { t, language } = useLanguage();
  const { user } = useAuth();
  const userRole = user?.role || 'EMPLOYEE';

  useEffect(() => {
    fetchData();
    setMounted(true);
  }, []);

  const fetchData = async () => {
    setLoading(true);
    try {
      const [purchasesRes, productsRes, suppliersRes] = await Promise.all([
        fetch('/api/purchases'),
        fetch('/api/products'),
        fetch('/api/suppliers')
      ]);

      if (purchasesRes.ok) {
        const purchasesData = await purchasesRes.json();
        setPurchases(purchasesData);
      }
      if (productsRes.ok) {
        const productsData = await productsRes.json();
        setProducts(productsData);
      }
      if (suppliersRes.ok) {
        const suppliersData = await suppliersRes.json();
        setSuppliers(suppliersData);
      }
    } catch (e) {
      console.error('Error fetching data:', e);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveSupplier = async () => {
    if (userRole === 'DESIGNER') { alert('Действие недоступно для вашей роли.'); return; }
        if (!newSupplierName.trim()) {
      alert('Укажите имя поставщика');
      return;
    }
    setSavingSupplier(true);
    try {
      const isEditing = !!editingSupplierId;
      const url = '/api/suppliers';
      const method = isEditing ? 'PUT' : 'POST';
      const body = {
        id: editingSupplierId || undefined,
        name: newSupplierName.trim(),
        country: newSupplierCountry.trim(),
        legalAddress: newSupplierAddress.trim(),
        taxId: newSupplierTaxId.trim(),
        phone: newSupplierPhone.trim(),
        email: newSupplierEmail.trim(),
        notes: newSupplierNotes.trim(),
        userId: user?.name || 'SYSTEM'
      };

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body)
      });

      if (res.ok) {
        alert(isEditing ? 'Информация о поставщике успешно обновлена!' : 'Поставщик успешно зарегистрирован!');
        handleCancelSupplierEdit();
        fetchData();
      } else {
        const data = await res.json();
        alert(`Ошибка при сохранении: ${data.error}`);
      }
    } catch (e) {
      console.error(e);
      alert('Сетевая ошибка при сохранении поставщика');
    } finally {
      setSavingSupplier(false);
    }
  };

  const handleStartEditSupplier = (sup: SupplierProfile) => {
    setEditingSupplierId(sup.id);
    setNewSupplierName(sup.name);
    setNewSupplierCountry(sup.country);
    setNewSupplierAddress(sup.legalAddress);
    setNewSupplierTaxId(sup.taxId);
    setNewSupplierPhone(sup.phone);
    setNewSupplierEmail(sup.email);
    setNewSupplierNotes(sup.notes);
  };

  const handleCancelSupplierEdit = () => {
    setEditingSupplierId(null);
    setNewSupplierName('');
    setNewSupplierCountry('США');
    setNewSupplierAddress('');
    setNewSupplierTaxId('');
    setNewSupplierPhone('');
    setNewSupplierEmail('');
    setNewSupplierNotes('');
  };

  const handleDeleteSupplier = async (id: string, name: string) => {
    if (!confirm(`Вы уверены, что хотите удалить поставщика "${name}"?\nЭто действие нельзя отменить.`)) {
      return;
    }
    try {
      const res = await fetch(`/api/suppliers?id=${id}&userId=${encodeURIComponent(user?.name || 'SYSTEM')}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        alert('Поставщик успешно удален!');
        if (editingSupplierId === id) {
          handleCancelSupplierEdit();
        }
        fetchData();
      } else {
        const data = await res.json();
        alert(`Ошибка при удалении: ${data.error}`);
      }
    } catch (e) {
      console.error(e);
      alert('Сетевая ошибка при удалении поставщика');
    }
  };

  const handleDeletePurchase = async (id: string, supplier: string, invoiceNumber: string) => {
    const confirmMessage = language === 'RU'
      ? `Вы уверены, что хотите удалить закупку от поставщика "${supplier}" (Накладная: ${invoiceNumber || 'б/н'})?\nЭто действие уменьшит количество товаров на складе на оприходованные значения. Действие необратимо!`
      : `Are you sure you want to delete the purchase from supplier "${supplier}" (Invoice: ${invoiceNumber || 'n/a'})?\nThis action will decrease warehouse stock quantities by the received amounts. This action is irreversible!`;

    if (!confirm(confirmMessage)) {
      return;
    }

    try {
      const res = await fetch(`/api/purchases/${id}?userId=${encodeURIComponent(user?.name || 'SYSTEM')}`, {
        method: 'DELETE'
      });
      if (res.ok) {
        alert(language === 'RU' ? 'Закупка успешно удалена, складские остатки пересчитаны!' : 'Purchase successfully deleted, inventory recalculated!');
        fetchData();
      } else {
        const data = await res.json();
        alert(`Ошибка при удалении: ${data.error}`);
      }
    } catch (e) {
      console.error(e);
      alert(language === 'RU' ? 'Сетевая ошибка при удалении' : 'Network error during deletion');
    }
  };


  // Get unique list of suppliers for filter dropdown
  const uniqueSuppliers = useMemo(() => {
    const historical = purchases.map(p => p.supplier.trim());
    const registered = suppliers.map(s => s.name.trim());
    const merged = Array.from(new Set([...registered, ...historical]));
    return ['ALL', ...merged.filter(s => s.length > 0).sort((a, b) => a.localeCompare(b))];
  }, [purchases, suppliers]);

  const selectedSupplierProfile = useMemo(() => {
    return suppliers.find(s => s.name === supplierName);
  }, [suppliers, supplierName]);

  // Filter purchase history list
  const filteredPurchases = useMemo(() => {
    return purchases.filter(p => {
      // 1. Supplier filter
      const matchSupplier = supplierFilter === 'ALL' || p.supplier === supplierFilter;

      // 2. Search query filter
      const s = searchQuery.toLowerCase();
      const matchSearch = 
        p.supplier.toLowerCase().includes(s) ||
        p.invoiceNumber.toLowerCase().includes(s) ||
        p.items.some(item => item.name.toLowerCase().includes(s) || item.sku.toLowerCase().includes(s));

      // 3. Date filter
      const pDate = new Date(p.createdAt);
      const now = new Date();
      let matchDate = true;

      if (dateFilter === 'THIS_MONTH') {
        matchDate = pDate.getMonth() === now.getMonth() && pDate.getFullYear() === now.getFullYear();
      } else if (dateFilter === 'LAST_MONTH') {
        const prevMonth = now.getMonth() === 0 ? 11 : now.getMonth() - 1;
        const prevYear = now.getMonth() === 0 ? now.getFullYear() - 1 : now.getFullYear();
        matchDate = pDate.getMonth() === prevMonth && pDate.getFullYear() === prevYear;
      } else if (dateFilter === 'LAST_30_DAYS') {
        const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        matchDate = pDate >= thirtyDaysAgo;
      } else if (dateFilter === 'LAST_90_DAYS') {
        const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
        matchDate = pDate >= ninetyDaysAgo;
      } else if (dateFilter === 'CUSTOM') {
        const start = startDate ? new Date(startDate) : null;
        const end = endDate ? new Date(endDate) : null;
        if (start) {
          start.setHours(0, 0, 0, 0);
          matchDate = matchDate && pDate >= start;
        }
        if (end) {
          end.setHours(23, 59, 59, 999);
          matchDate = matchDate && pDate <= end;
        }
      }

      // 4. Amount range filter
      let matchAmount = true;
      if (minAmount) {
        const minVal = parseFloat(minAmount);
        if (!isNaN(minVal)) {
          matchAmount = matchAmount && p.totalAmount >= minVal;
        }
      }
      if (maxAmount) {
        const maxVal = parseFloat(maxAmount);
        if (!isNaN(maxVal)) {
          matchAmount = matchAmount && p.totalAmount <= maxVal;
        }
      }

      // 5. Category filter
      let matchCategory = true;
      if (selectedCategory !== 'ALL') {
        matchCategory = p.items.some(item => item.category === selectedCategory);
      }

      return matchSupplier && matchSearch && matchDate && matchAmount && matchCategory;
    });
  }, [purchases, supplierFilter, searchQuery, dateFilter, startDate, endDate, minAmount, maxAmount, selectedCategory]);

  // Calculations for stats
  const stats = useMemo(() => {
    const totalSpent = filteredPurchases.reduce((sum, p) => sum + p.totalAmount, 0);
    const totalInvoices = filteredPurchases.length;
    
    let totalItemsCount = 0;
    filteredPurchases.forEach(p => {
      p.items.forEach(item => {
        totalItemsCount += item.quantity;
      });
    });

    return {
      totalSpent,
      totalInvoices,
      totalItemsCount
    };
  }, [filteredPurchases]);

  const openNewPurchaseModal = () => {
    setEditingPurchaseId(null);
    setSupplierName('');
    setInvoiceNumber('');
    setPurchaseItems([]);
    setModalScannerInput('');
    setIsModalOpen(true);
  };

  const openEditPurchaseModal = (p: PurchaseTransaction) => {
    setEditingPurchaseId(p.id);
    setSupplierName(p.supplier);
    setInvoiceNumber(p.invoiceNumber);
    setPurchaseItems(p.items.map(item => ({
      productId: item.productId || '',
      name: item.name,
      sku: item.sku,
      barcode: item.barcode || '',
      category: item.category || 'FLOWER',
      unit: item.unit || 'шт',
      quantity: item.quantity,
      costPrice: item.costPrice,
      retailPrice: item.retailPrice
    })));
    setModalScannerInput('');
    setIsModalOpen(true);
  };

  const addEmptyItemRow = () => {
    setPurchaseItems(prev => [
      ...prev,
      {
        name: '',
        sku: '',
        barcode: '',
        category: 'FLOWER',
        unit: 'шт',
        quantity: 1,
        costPrice: 0,
        retailPrice: 0
      }
    ]);
  };

  const removePurchaseItem = (index: number) => {
    setPurchaseItems(prev => prev.filter((_, idx) => idx !== index));
  };

  const updatePurchaseItemField = (index: number, field: keyof PurchaseItem, value: any) => {
    setPurchaseItems(prev => prev.map((item, idx) => {
      if (idx !== index) return item;
      
      const updated = { ...item, [field]: value };
      
      // If we change existing product ID, autofill details
      if (field === 'productId') {
        const matched = products.find(p => p.id === value);
        if (matched) {
          updated.name = matched.name;
          updated.sku = matched.sku;
          updated.barcode = matched.barcode || '';
          updated.category = matched.category;
          updated.unit = matched.unit;
          updated.costPrice = matched.costPrice;
          updated.retailPrice = matched.retailPrice;
        }
      }
      return updated;
    }));
  };

  // Barcode scanning inside the purchase modal
  const handleModalBarcodeScan = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const code = modalScannerInput.trim();
      if (!code) return;

      // 1. Check if the scanned barcode or SKU is already in our list of items
      const existingInListIndex = purchaseItems.findIndex(
        item => item.barcode?.toLowerCase() === code.toLowerCase() || item.sku?.toLowerCase() === code.toLowerCase()
      );

      if (existingInListIndex !== -1) {
        // Increment quantity by 1
        setPurchaseItems(prev => prev.map((item, idx) => 
          idx === existingInListIndex ? { ...item, quantity: item.quantity + 1 } : item
        ));
        setModalScannerInput('');
        return;
      }

      // 2. Look up in the database of existing warehouse products
      const dbProduct = products.find(
        p => p.barcode?.toLowerCase() === code.toLowerCase() || p.sku.toLowerCase() === code.toLowerCase()
      );

      if (dbProduct) {
        // Product exists - autofill details and add a new row
        setPurchaseItems(prev => [
          ...prev,
          {
            productId: dbProduct.id,
            name: dbProduct.name,
            sku: dbProduct.sku,
            barcode: dbProduct.barcode || '',
            category: dbProduct.category,
            unit: dbProduct.unit,
            quantity: 1,
            costPrice: dbProduct.costPrice,
            retailPrice: dbProduct.retailPrice
          }
        ]);
      } else {
        // Product DOES NOT exist - add new row with barcode pre-set to let them auto-create it
        setPurchaseItems(prev => [
          ...prev,
          {
            name: '',
            sku: code, // Pre-fill sku with code as a default
            barcode: code,
            category: 'FLOWER',
            unit: 'шт',
            quantity: 1,
            costPrice: 0,
            retailPrice: 0
          }
        ]);
      }
      setModalScannerInput('');
    }
  };

  const handleRegisterPurchase = async () => {
    if (!supplierName.trim()) {
      alert('Пожалуйста, выберите поставщика');
      return;
    }
    if (purchaseItems.length === 0) {
      alert('Пожалуйста, добавьте хотя бы один товар в закупку');
      return;
    }

    // Validation checks
    for (const item of purchaseItems) {
      if (!item.name.trim()) {
        alert('У всех товаров в закупке должно быть название');
        return;
      }
      if (!item.sku.trim()) {
        alert(`Для товара "${item.name}" не указан артикул (SKU)`);
        return;
      }
      if (item.quantity <= 0) {
        alert(`Количество для товара "${item.name}" должно быть больше нуля`);
        return;
      }
      if (item.costPrice < 0 || item.retailPrice < 0) {
        alert(`Цены для товара "${item.name}" не могут быть отрицательными`);
        return;
      }
    }

    setSubmitting(true);
    try {
      const url = editingPurchaseId ? `/api/purchases/${editingPurchaseId}` : '/api/purchases';
      const method = editingPurchaseId ? 'PUT' : 'POST';

      const res = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          supplier: supplierName.trim(),
          invoiceNumber: invoiceNumber.trim(),
          userId: user?.name || 'SYSTEM',
          status: purchaseStatus,
          items: purchaseItems
        })
      });

      if (res.ok) {
        alert(editingPurchaseId ? 'Накладная успешно отредактирована! Складские остатки скорректированы.' : 'Закупка успешно проведена! Складские запасы обновлены.');
        setIsModalOpen(false);
        setEditingPurchaseId(null);
        fetchData();
      } else {
        const data = await res.json();
        alert(`Ошибка при сохранении закупки: ${data.error}`);
      }
    } catch (e) {
      console.error(e);
      alert('Сетевая ошибка при проведении закупки');
    } finally {
      setSubmitting(false);
    }
  };

  const handleReceivePurchase = async (purchase: PurchaseTransaction) => {
    if (!confirm(`Вы уверены, что хотите отметить накладную "${purchase.invoiceNumber || 'б/н'}" как доставленную?\nТовары будут зачислены на склад.`)) {
      return;
    }
    
    try {
      const res = await fetch(`/api/purchases/${purchase.id}/status`, {
        method: 'PUT'
      });
      if (res.ok) {
        alert('Закупка успешно получена! Складские остатки обновлены.');
        fetchData();
      } else {
        const data = await res.json();
        alert(`Ошибка: ${data.error}`);
      }
    } catch (e) {
      console.error(e);
      alert('Сетевая ошибка при изменении статуса');
    }
  };

  return (
    <div className="purchases-dashboard fade-in">
      <header className="page-header">
        <div className="title-section">
          <h1>{t('purchases.title')}</h1>
          <p className="subtitle">Поступления от поставщиков, аналитика и автоматическое оприходование</p>
        </div>
        <div className="header-actions">
          <button 
            className="btn btn-secondary" 
           
            onClick={() => setIsSupplierModalOpen(true)} 
            style={{ height: '38px', padding: '0 1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600, border: '1px solid var(--surface-border)', color: 'var(--text-main)' }}
          >
            ➕ Поставщик
          </button>
          <button className="btn btn-primary" onClick={openNewPurchaseModal} style={{ height: '38px', padding: '0 1.25rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontWeight: 600 }}>
            <span style={{ fontSize: '1.2rem' }}>➕</span> Новая закупка
          </button>
        </div>
      </header>

      {/* Stats Section */}
      <div className="purchases-grid">
        <div className="glass-card stat-card fade-in delay-1">
          <h3>Всего закуплено</h3>
          <p className="stat-value text-success">${stats.totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          <p className="stat-sub">За выбранный период / фильтры</p>
        </div>
        <div className="glass-card stat-card fade-in delay-2">
          <h3>Количество накладных</h3>
          <p className="stat-value">{stats.totalInvoices}</p>
          <p className="stat-sub">Проведенных поставок</p>
        </div>
        <div className="glass-card stat-card fade-in delay-3">
          <h3>Принято единиц товара</h3>
          <p className="stat-value font-bold">{stats.totalItemsCount.toFixed(0)} шт</p>
          <p className="stat-sub">Поступило на склад</p>
        </div>
      </div>

      {/* Suppliers Grid Block */}
      <div className="glass-card p-6 mt-6 fade-in delay-2">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🏢 Справочник поставщиков</span>
          </h2>
        </div>
        
        {suppliers.length === 0 ? (
          <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '1rem' }}>
            Поставщики не найдены.
          </div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(250px, 1fr))', gap: '1rem' }}>
            {suppliers.map(sup => {
              // Calculate stats for this supplier from purchases
              const supplierPurchases = purchases.filter(p => p.supplier.toLowerCase() === sup.name.toLowerCase());
              const inTransitCount = supplierPurchases.filter(p => p.status === 'IN_TRANSIT').length;
              const totalSpent = supplierPurchases.reduce((sum, p) => sum + p.totalAmount, 0);

              return (
                <div 
                  key={sup.id} 
                  className="supplier-card"
                  onClick={() => openSupplierDetailsModal(sup, supplierPurchases)}
                  style={{ 
                    padding: '1.25rem', 
                    background: 'var(--surface-base)', 
                    border: '1px solid var(--surface-border)', 
                    borderRadius: 'var(--radius-lg)',
                    cursor: 'pointer',
                    transition: 'all 0.2s',
                    position: 'relative',
                    boxShadow: '0 2px 5px rgba(0,0,0,0.02)'
                  }}
                  onMouseOver={(e) => { e.currentTarget.style.transform = 'translateY(-2px)'; e.currentTarget.style.boxShadow = '0 6px 12px rgba(0,0,0,0.05)'; }}
                  onMouseOut={(e) => { e.currentTarget.style.transform = 'translateY(0)'; e.currentTarget.style.boxShadow = '0 2px 5px rgba(0,0,0,0.02)'; }}
                >
                  <div style={{ fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)', marginBottom: '0.25rem', paddingRight: '3rem' }}>
                    {sup.name}
                  </div>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>
                    🌍 {sup.country}
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem', fontSize: '0.85rem' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Сумма закупок:</span>
                      <span style={{ fontWeight: 600 }}>${totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                      <span style={{ color: 'var(--text-muted)' }}>Накладных:</span>
                      <span style={{ fontWeight: 600 }}>{supplierPurchases.length}</span>
                    </div>
                  </div>
                  {inTransitCount > 0 && (
                    <div style={{ position: 'absolute', top: '1rem', right: '1rem', background: 'hsl(40, 90%, 50%)', color: 'white', fontSize: '0.65rem', fontWeight: 700, padding: '0.25rem 0.5rem', borderRadius: 'var(--radius-pill)', boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}>
                      🚚 В пути: {inTransitCount}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Extensive Advanced Filters Panel */}
      <div className="glass-card p-6 mt-6 fade-in delay-3" style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--surface-border)', paddingBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
          <h2 style={{ margin: 0, fontSize: '1.2rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <span>🔍 Расширенная фильтрация поставок</span>
          </h2>
          <button 
            onClick={() => {
              setSupplierFilter('ALL');
              setSearchQuery('');
              setDateFilter('ALL');
              setStartDate('');
              setEndDate('');
              setMinAmount('');
              setMaxAmount('');
              setSelectedCategory('ALL');
            }}
            style={{
              background: 'none',
              border: 'none',
              color: 'var(--primary)',
              cursor: 'pointer',
              fontSize: '0.85rem',
              fontWeight: 600,
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              padding: 0
            }}
          >
            🔄 Сбросить все фильтры
          </button>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1.25rem' }}>
          {/* Column 1: Supplier & Category */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Поставщик</label>
              <select 
                value={supplierFilter} 
                onChange={(e) => setSupplierFilter(e.target.value)}
                className="input-field"
                style={{ padding: '0.45rem', fontSize: '0.85rem', backgroundColor: 'var(--surface-base)' }}
              >
                {uniqueSuppliers.map(sup => (
                  <option key={sup} value={sup}>
                    {sup === 'ALL' ? 'Все поставщики' : sup}
                  </option>
                ))}
              </select>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Категория в накладной</label>
              <select 
                value={selectedCategory} 
                onChange={(e) => setSelectedCategory(e.target.value)}
                className="input-field"
                style={{ padding: '0.45rem', fontSize: '0.85rem', backgroundColor: 'var(--surface-base)' }}
              >
                <option value="ALL">Все категории</option>
                <option value="FLOWER">Цветы</option>
                <option value="PACKAGING">Упаковка</option>
                <option value="MATERIAL">Материалы</option>
                <option value="GIFT">Подарки</option>
              </select>
            </div>
          </div>

          {/* Column 2: Time Period & Date Range */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Временной период</label>
              <select 
                value={dateFilter} 
                onChange={(e) => setDateFilter(e.target.value)}
                className="input-field"
                style={{ padding: '0.45rem', fontSize: '0.85rem', backgroundColor: 'var(--surface-base)' }}
              >
                <option value="ALL">За всё время</option>
                <option value="THIS_MONTH">Этот месяц</option>
                <option value="LAST_MONTH">Прошлый месяц</option>
                <option value="LAST_30_DAYS">Последние 30 дней</option>
                <option value="LAST_90_DAYS">Последние 90 дней</option>
                <option value="CUSTOM">Выбрать даты... 📅</option>
              </select>
            </div>

            {dateFilter === 'CUSTOM' && (
              <div style={{ display: 'flex', gap: '0.5rem' }}>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)' }}>С</label>
                  <input 
                    type="date" 
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="input-field"
                    style={{ padding: '0.35rem', fontSize: '0.8rem', backgroundColor: 'var(--surface-base)' }}
                  />
                </div>
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '0.65rem', fontWeight: 600, color: 'var(--text-muted)' }}>По</label>
                  <input 
                    type="date" 
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="input-field"
                    style={{ padding: '0.35rem', fontSize: '0.8rem', backgroundColor: 'var(--surface-base)' }}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Column 3: Amount Range */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Сумма накладной ($)</label>
              <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                <input 
                  type="number" 
                  placeholder="От"
                  value={minAmount}
                  onChange={(e) => setMinAmount(e.target.value)}
                  className="input-field"
                  style={{ padding: '0.45rem', fontSize: '0.85rem', backgroundColor: 'var(--surface-base)', flex: 1 }}
                />
                <span style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>—</span>
                <input 
                  type="number" 
                  placeholder="До"
                  value={maxAmount}
                  onChange={(e) => setMaxAmount(e.target.value)}
                  className="input-field"
                  style={{ padding: '0.45rem', fontSize: '0.85rem', backgroundColor: 'var(--surface-base)', flex: 1 }}
                />
              </div>
            </div>
          </div>

          {/* Column 4: Quick Search */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              <label style={{ fontSize: '0.7rem', fontWeight: 700, color: 'var(--text-muted)', marginBottom: '0.35rem', textTransform: 'uppercase', letterSpacing: '0.03em' }}>Текстовый поиск</label>
              <input 
                type="text" 
                placeholder="Поиск по накладной, артикулу, товару..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="input-field"
                style={{ padding: '0.45rem', fontSize: '0.85rem', backgroundColor: 'var(--surface-base)' }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* History table */}
      <div className="table-wrapper glass-card mt-6 fade-in delay-3">
        <div className="table-header p-6">
          <h2>{t('purchases.history')}</h2>
        </div>
        {loading ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--primary)' }}>
            <div className="spinner" style={{ margin: '0 auto 1rem auto' }}></div>
            Загрузка закупок...
          </div>
        ) : filteredPurchases.length === 0 ? (
          <div style={{ padding: '3rem', textAlign: 'center', color: 'var(--text-muted)' }}>
            История закупок пуста или ничего не найдено по фильтрам.
          </div>
        ) : (
          <>
            <div className="desktop-table-container" style={{ overflowX: 'auto', width: '100%' }}>
              <table className="purchases-table" style={{ minWidth: '950px' }}>
                <thead>
                  <tr>
                    <th>Дата поступления</th>
                    <th>Поставщик</th>
                    <th>Накладная</th>
                    <th>Кол-во позиций</th>
                    <th>Сумма закупки</th>
                    <th>Принял</th>
                    <th>Действие</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredPurchases.map((p) => (
                    <tr key={p.id} className="fade-in purchase-row">
                      <td className="date-cell" style={{ fontSize: '0.85rem' }}>{new Date(p.createdAt).toLocaleString()}</td>
                      <td className="supplier-cell">
                        <div style={{ fontWeight: 600 }}>{p.supplier}</div>
                        {(() => {
                          const profile = suppliers.find(s => s.name.toLowerCase() === p.supplier.toLowerCase());
                          if (profile) {
                            return (
                              <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.15rem', display: 'flex', flexDirection: 'column', gap: '0.05rem' }}>
                                <span>🌍 {profile.country} | 📄 Код: {profile.taxId}</span>
                                <span style={{ fontSize: '0.7rem', opacity: 0.85, whiteSpace: 'nowrap', overflow: 'hidden', direction: 'ltr', textOverflow: 'ellipsis', maxWidth: '200px' }} title={profile.legalAddress}>📍 {profile.legalAddress}</span>
                              </div>
                            );
                          }
                          return null;
                        })()}
                      </td>
                      <td>
                        {p.invoiceNumber ? (
                          <span className="badge badge-orange">{p.invoiceNumber}</span>
                        ) : (
                          <span className="text-muted" style={{ fontSize: '0.8rem' }}>б/н</span>
                        )}
                        {p.status === 'IN_TRANSIT' ? (
                          <span className="badge" style={{ background: 'hsl(40, 90%, 50%)', color: 'white', marginLeft: '0.5rem' }}>🚚 В дороге</span>
                        ) : (
                          <span className="badge" style={{ background: 'var(--success)', color: 'white', marginLeft: '0.5rem' }}>📦 Доставлена</span>
                        )}
                      </td>
                      <td>{p.items.length} шт.</td>
                      <td className="amount-cell text-success">${p.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                      <td><span className="role-badge worker" style={{ display: 'inline-flex', fontSize: '0.7rem', padding: '0.2rem 0.6rem', whiteSpace: 'nowrap', alignItems: 'center' }}>👤 {p.userId}</span></td>
                      <td>
                        <div style={{ display: 'flex', gap: '0.35rem', flexWrap: 'wrap' }}>
                          <button 
                            className="btn btn-secondary btn-sm"
                            onClick={() => setSelectedPurchaseDetails(p)}
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', whiteSpace: 'nowrap', fontWeight: 600, border: '1px solid var(--surface-border)', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
                            title="Показать подробный состав"
                          >
                            🔍 Подробнее
                          </button>
                          {p.status === 'IN_TRANSIT' && (
                            <button 
                              className="btn btn-primary btn-sm" 
                             
                              onClick={() => handleReceivePurchase(p)} 
                              style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', whiteSpace: 'nowrap', fontWeight: 600, border: 'none', background: 'var(--success)', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
                              title="Принять товары на склад"
                            >
                              📦 Получить
                            </button>
                          )}
                          <button 
                            className="btn btn-secondary btn-sm" 
                           
                            onClick={() => openEditPurchaseModal(p)} 
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', whiteSpace: 'nowrap', fontWeight: 600, border: '1px solid var(--surface-border)', display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
                            title="Редактировать накладную"
                          >
                            ✏️ Изменить
                          </button>
                          <button 
                            className="btn btn-danger btn-sm" 
                           
                            onClick={() => handleDeletePurchase(p.id, p.supplier, p.invoiceNumber)} 
                            style={{ padding: '0.3rem 0.6rem', fontSize: '0.8rem', whiteSpace: 'nowrap', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.2rem' }}
                            title="Удалить накладную"
                          >
                            🗑️ Удалить
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mobile-cards-container">
              {filteredPurchases.map((p) => (
                <div key={p.id} className="glass-card purchase-mobile-card fade-in delay-1" style={{ padding: '1rem', display: 'flex', flexDirection: 'column', gap: '0.75rem', marginBottom: '1rem' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', borderBottom: '1px solid var(--surface-border)', paddingBottom: '0.5rem' }}>
                    <div>
                      <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(p.createdAt).toLocaleDateString()}</span>
                      <div style={{ fontSize: '1rem', fontWeight: 700, color: 'var(--text-main)', marginTop: '0.15rem' }}>{p.supplier}</div>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.25rem' }}>
                      {p.invoiceNumber ? (
                        <span className="badge badge-orange">{p.invoiceNumber}</span>
                      ) : (
                        <span className="text-muted" style={{ fontSize: '0.75rem' }}>б/н</span>
                      )}
                      {p.status === 'IN_TRANSIT' ? (
                        <span className="badge" style={{ background: 'hsl(40, 90%, 50%)', color: 'white', marginTop: '0.25rem' }}>🚚 В дороге</span>
                      ) : (
                        <span className="badge" style={{ background: 'var(--success)', color: 'white', marginTop: '0.25rem' }}>📦 Доставлена</span>
                      )}
                      <span className="amount-cell text-success" style={{ fontSize: '1.05rem' }}>${p.totalAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                    </div>
                  </div>
                  
                  {/* Supplier Profile Info if found */}
                  {(() => {
                    const profile = suppliers.find(s => s.name.toLowerCase() === p.supplier.toLowerCase());
                    if (profile) {
                      return (
                        <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', background: 'rgba(0,0,0,0.01)', padding: '0.5rem', borderRadius: 'var(--radius-sm)', border: '1px solid var(--surface-border)' }}>
                          <div>🌍 {profile.country} | 📄 Код: {profile.taxId}</div>
                          <div style={{ marginTop: '0.2rem' }}>📍 {profile.legalAddress}</div>
                        </div>
                      );
                    }
                    return null;
                  })()}

                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8rem', color: 'var(--text-muted)' }}>
                    <span>Количество позиций: <strong>{p.items.length} шт.</strong></span>
                    <span>Принял: <span className="role-badge worker" style={{ display: 'inline-flex', fontSize: '0.65rem', padding: '0.1rem 0.4rem', border: 'none', whiteSpace: 'nowrap', alignItems: 'center' }}>👤 {p.userId}</span></span>
                  </div>

                    <button 
                      className="btn btn-secondary" 
                      onClick={() => setSelectedPurchaseDetails(p)}
                      style={{ padding: '0.5rem', fontSize: '0.85rem', fontWeight: 600, width: '100%', marginBottom: '0.5rem' }}
                    >
                      🔍 Подробнее о составе ({p.items.length} шт.)
                    </button>

                    {p.status === 'IN_TRANSIT' && (
                      <button 
                        className="btn btn-primary" 
                       
                        onClick={() => handleReceivePurchase(p)} 
                        style={{ padding: '0.5rem', fontSize: '0.85rem', fontWeight: 600, width: '100%', background: 'var(--success)', border: 'none', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', marginBottom: '0.5rem' }}
                      >
                        📦 Получить на склад
                      </button>
                    )}

                    <div style={{ display: 'flex', gap: '0.5rem', width: '100%' }}>
                    <button 
                      className="btn btn-secondary" 
                     
                      onClick={() => openEditPurchaseModal(p)} 
                      style={{ flex: 1, padding: '0.5rem', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}
                    >
                      ✏️ Редактировать
                    </button>
                    <button 
                      className="btn btn-danger" 
                     
                      onClick={() => handleDeletePurchase(p.id, p.supplier, p.invoiceNumber)} 
                      style={{ padding: '0.5rem 1rem', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem' }}
                    >
                      🗑️ Удалить
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </div>

      {/* New / Edit Purchase Modal */}
      {isModalOpen && mounted && createPortal(
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '1000px', width: '95vw', color: 'var(--text-main)' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e5e7eb', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--text-main)' }}>
                {editingPurchaseId ? `✏️ Редактирование закупки #${invoiceNumber || 'б/н'}` : '📈 Оприходование новой закупки'}
              </h2>
              <button onClick={() => { setIsModalOpen(false); setEditingPurchaseId(null); }} style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' }}>&times;</button>
            </div>

            <div className="modal-body" style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem', maxHeight: '70vh', overflowY: 'auto', paddingRight: '0.5rem' }}>
              {/* Supplier & Invoice metadata */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '1rem' }}>
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#4b5563', marginBottom: '0.25rem', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Поставщик <span style={{ color: 'red' }}>*</span></span>
                    <button 
                      type="button" 
                      onClick={() => setIsSupplierModalOpen(true)}
                      style={{ background: 'none', border: 'none', color: 'var(--primary)', cursor: 'pointer', fontSize: '0.75rem', textTransform: 'none', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.15rem', padding: 0 }}
                    >
                      ➕ Новый поставщик
                    </button>
                  </label>
                  <select 
                    value={supplierName}
                    onChange={(e) => setSupplierName(e.target.value)}
                    className="modal-input"
                    required
                  >
                    <option value="">-- Выберите поставщика --</option>
                    {suppliers.map(sup => (
                      <option key={sup.id} value={sup.name}>{sup.name}</option>
                    ))}
                  </select>

                  {/* Selected Supplier Profile Details Card */}
                  {selectedSupplierProfile && (
                    <div style={{ 
                      marginTop: '0.5rem', 
                      padding: '0.6rem 0.8rem', 
                      background: '#f3f4f6', 
                      border: '1px solid #e5e7eb', 
                      borderRadius: 'var(--radius-sm)', 
                      fontSize: '0.75rem',
                      color: '#4b5563',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '0.25rem'
                    }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontWeight: 600 }}>
                        <span>🌍 Страна: {selectedSupplierProfile.country}</span>
                        <span>📄 Код: {selectedSupplierProfile.taxId}</span>
                      </div>
                      <div><strong>Юр. Адрес:</strong> {selectedSupplierProfile.legalAddress}</div>
                      {(selectedSupplierProfile.phone || selectedSupplierProfile.email) && (
                        <div><strong>Контакты:</strong> {selectedSupplierProfile.phone} {selectedSupplierProfile.email ? `(${selectedSupplierProfile.email})` : ''}</div>
                      )}
                      {selectedSupplierProfile.notes && (
                        <div style={{ fontStyle: 'italic', borderTop: '1px dashed #d1d5db', paddingTop: '0.25rem', marginTop: '0.25rem', fontSize: '0.7rem' }}>
                          <strong>Заметка:</strong> {selectedSupplierProfile.notes}
                        </div>
                      )}
                    </div>
                  )}
                </div>
                
                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#4b5563', marginBottom: '0.25rem' }}>Номер накладной</label>
                  <input 
                    type="text" 
                    placeholder="Например: INV-98745 (необязательно)"
                    value={invoiceNumber}
                    onChange={(e) => setInvoiceNumber(e.target.value)}
                    className="modal-input"
                  />
                </div>

                <div style={{ display: 'flex', flexDirection: 'column' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#4b5563', marginBottom: '0.25rem' }}>
                    Статус поставки <span style={{ color: 'red' }}>*</span>
                  </label>
                  <select
                    value={purchaseStatus}
                    onChange={(e) => setPurchaseStatus(e.target.value as any)}
                    className="modal-input"
                    style={{ background: purchaseStatus === 'IN_TRANSIT' ? 'hsl(40, 100%, 97%)' : 'hsl(140, 100%, 97%)', fontWeight: 600, color: purchaseStatus === 'IN_TRANSIT' ? 'hsl(40, 90%, 40%)' : 'var(--success)' }}
                    disabled={!!editingPurchaseId} // Status change is done separately
                  >
                    <option value="DELIVERED">📦 Доставлена (Добавить на склад)</option>
                    <option value="IN_TRANSIT">🚚 В дороге (Не добавлять на склад)</option>
                  </select>
                </div>
              </div>

              {/* Barcode scanner box for quick adding */}
              <div style={{ background: 'hsl(330, 70%, 97%)', border: '1px dashed hsl(330, 70%, 80%)', padding: '1rem', borderRadius: 'var(--radius-lg)', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <label style={{ fontSize: '0.8rem', fontWeight: 700, color: 'hsl(330, 70%, 45%)', textTransform: 'uppercase', display: 'flex', alignItems: 'center', gap: '0.25rem' }}>
                  📟 Быстрое сканирование штрих-кода
                </label>
                <p style={{ margin: 0, fontSize: '0.75rem', color: '#6b7280' }}>
                  Отсканируйте штрих-код товара. Если он есть на складе, данные заполнятся автоматически. Если штрих-кода нет, создастся новая строка, и вы сможете ввести название для автоматического добавления на склад!
                </p>
                <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                  <input 
                    ref={scannerInputRef}
                    type="text"
                    placeholder="Отсканируйте штрих-код и нажмите Enter..."
                    value={modalScannerInput}
                    onChange={(e) => setModalScannerInput(e.target.value)}
                    onKeyDown={handleModalBarcodeScan}
                    className="modal-input"
                    style={{ border: '1px solid hsl(330, 70%, 75%)', flex: 1 }}
                  />
                </div>
              </div>

              {/* Items checklist table */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <h3 style={{ margin: 0, fontSize: '1.1rem', fontWeight: 700, color: 'var(--text-main)' }}>📦 Содержимое поставки</h3>
                  <button className="btn btn-secondary" onClick={addEmptyItemRow} style={{ padding: '0.35rem 0.75rem', fontSize: '0.8rem', border: '1px solid #d1d5db', color: '#374151' }}>
                    ➕ Добавить вручную
                  </button>
                </div>

                {purchaseItems.length === 0 ? (
                  <div style={{ padding: '2rem', textAlign: 'center', background: '#f9fafb', border: '1px dashed #d1d5db', borderRadius: 'var(--radius-lg)', color: '#6b7280', fontSize: '0.9rem' }}>
                    Товары в накладную не добавлены. Отсканируйте штрих-код или нажмите «Добавить вручную».
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
                    {purchaseItems.map((item, idx) => (
                      <div key={idx} style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr)) 40px', gap: '0.5rem', alignItems: 'end', padding: '0.75rem', background: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 'var(--radius-md)' }}>
                        
                        {/* Product type selector: existing or new */}
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <label className="item-label">Тип товара</label>
                          <select 
                            value={item.productId || ''} 
                            onChange={(e) => updatePurchaseItemField(idx, 'productId', e.target.value)}
                            className="modal-select"
                          >
                            <option value="">-- Новый товар --</option>
                            {products.map(p => (
                              <option key={p.id} value={p.id}>{p.name} ({p.sku})</option>
                            ))}
                          </select>
                        </div>

                        {/* Name */}
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <label className="item-label">Название товара <span style={{ color: 'red' }}>*</span></label>
                          <input 
                            type="text" 
                            placeholder="Гортензия, Игрушка..."
                            value={item.name}
                            onChange={(e) => updatePurchaseItemField(idx, 'name', e.target.value)}
                            className="modal-input-sm"
                            disabled={!!item.productId}
                            required
                          />
                        </div>

                        {/* SKU */}
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <label className="item-label">Артикул (SKU) <span style={{ color: 'red' }}>*</span></label>
                          <input 
                            type="text" 
                            placeholder="SKU-123"
                            value={item.sku}
                            onChange={(e) => updatePurchaseItemField(idx, 'sku', e.target.value)}
                            className="modal-input-sm"
                            disabled={!!item.productId}
                            required
                          />
                        </div>

                        {/* Barcode */}
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <label className="item-label">Штрих-код</label>
                          <input 
                            type="text" 
                            placeholder="Штрих-код"
                            value={item.barcode}
                            onChange={(e) => updatePurchaseItemField(idx, 'barcode', e.target.value)}
                            className="modal-input-sm"
                            disabled={!!item.productId}
                          />
                        </div>

                        {/* Category */}
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <label className="item-label">Категория</label>
                          <select
                            value={item.category}
                            onChange={(e) => updatePurchaseItemField(idx, 'category', e.target.value)}
                            className="modal-select"
                            disabled={!!item.productId}
                          >
                            <option value="FLOWER">Цветы</option>
                            <option value="PACKAGING">Упаковка</option>
                            <option value="MATERIAL">Материал</option>
                            <option value="GIFT">Подарки</option>
                          </select>
                        </div>

                        {/* Unit */}
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <label className="item-label">Ед. изм.</label>
                          <input 
                            type="text" 
                            placeholder="шт, м..."
                            value={item.unit}
                            onChange={(e) => updatePurchaseItemField(idx, 'unit', e.target.value)}
                            className="modal-input-sm"
                            disabled={!!item.productId}
                          />
                        </div>

                        {/* Quantity */}
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <label className="item-label" style={{ fontWeight: 700, color: 'var(--primary)' }}>Кол-во <span style={{ color: 'red' }}>*</span></label>
                          <input 
                            type="number" 
                            min="1"
                            step="any"
                            value={item.quantity}
                            onChange={(e) => updatePurchaseItemField(idx, 'quantity', parseFloat(e.target.value) || 0)}
                            className="modal-input-sm"
                            style={{ fontWeight: 700, border: '1px solid #9ca3af' }}
                            required
                          />
                        </div>

                        {/* Cost Price */}
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <label className="item-label">Закупка ($) <span style={{ color: 'red' }}>*</span></label>
                          <input 
                            type="number" 
                            min="0"
                            step="0.01"
                            value={item.costPrice}
                            onChange={(e) => updatePurchaseItemField(idx, 'costPrice', parseFloat(e.target.value) || 0)}
                            className="modal-input-sm"
                            required
                          />
                        </div>

                        {/* Retail Price */}
                        <div style={{ display: 'flex', flexDirection: 'column' }}>
                          <label className="item-label">Розница ($) <span style={{ color: 'red' }}>*</span></label>
                          <input 
                            type="number" 
                            min="0"
                            step="0.01"
                            value={item.retailPrice}
                            onChange={(e) => updatePurchaseItemField(idx, 'retailPrice', parseFloat(e.target.value) || 0)}
                            className="modal-input-sm"
                            required
                          />
                        </div>

                        {/* Delete row */}
                        <button 
                          onClick={() => removePurchaseItem(idx)}
                          style={{
                            background: 'transparent',
                            border: 'none',
                            fontSize: '1.25rem',
                            color: '#dc2626',
                            cursor: 'pointer',
                            paddingBottom: '0.45rem',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center'
                          }}
                          title="Удалить строку"
                        >
                          🗑️
                        </button>

                      </div>
                    ))}

                    {/* Total invoice preview */}
                    <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #e5e7eb', paddingTop: '1rem', marginTop: '0.5rem' }}>
                      <span style={{ fontSize: '1.2rem', fontWeight: 800, color: 'var(--text-main)' }}>
                        Итоговая сумма накладной: <span style={{ color: 'var(--success)' }}>
                          ${purchaseItems.reduce((sum, item) => sum + (item.quantity * item.costPrice), 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </span>
                    </div>
                  </div>
                )}
              </div>
            </div>

            <div className="modal-footer" style={{ borderTop: '1px solid #e5e7eb', paddingTop: '1rem', marginTop: '1.5rem', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => { setIsModalOpen(false); setEditingPurchaseId(null); }}
                style={{ padding: '0.5rem 1rem', fontSize: '0.9rem', border: '1px solid #d1d5db', color: '#374151' }}
              >
                Отмена
              </button>
              <button 
                className="btn btn-primary" 
                onClick={handleRegisterPurchase}
                disabled={submitting}
                style={{ padding: '0.5rem 1.25rem', fontSize: '0.9rem', fontWeight: 600 }}
              >
                {submitting ? 'Сохранение...' : (editingPurchaseId ? '💾 Сохранить изменения' : '✅ Провести на склад')}
              </button>
            </div>

          </div>
        </div>,
        document.body
      )}

      {/* Add / Manage Supplier Modal */}
      {isSupplierModalOpen && mounted && createPortal(
        <div className="modal-backdrop">
          <div className="modal-content" style={{ maxWidth: '900px', width: '95vw', background: '#ffffff', color: 'var(--text-main)' }}>
            <div className="modal-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e5e7eb', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.35rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span>👥 Управление поставщиками</span>
              </h2>
              <button onClick={() => { setIsSupplierModalOpen(false); handleCancelSupplierEdit(); }} style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' }}>&times;</button>
            </div>
            
            <div className="supplier-modal-body" style={{ display: 'flex', gap: '1.5rem', overflow: 'hidden', flex: 1, minHeight: '350px' }}>
              
              {/* LEFT PANEL: Registered Suppliers List */}
              <div style={{ flex: '1 1 40%', display: 'flex', flexDirection: 'column', borderRight: '1px solid #e5e7eb', paddingRight: '1.5rem', overflowY: 'auto' }}>
                <div style={{ marginBottom: '1rem' }}>
                  <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#4b5563', marginBottom: '0.35rem', display: 'block' }}>🔍 Поиск по базе</label>
                  <input 
                    type="text" 
                    placeholder="Поиск поставщика..."
                    value={supplierSearchQuery}
                    onChange={(e) => setSupplierSearchQuery(e.target.value)}
                    className="modal-input"
                    style={{ padding: '0.45rem 0.6rem', fontSize: '0.85rem' }}
                  />
                </div>
                
                <div style={{ flex: 1, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: '0.5rem', paddingRight: '0.25rem' }}>
                  {(() => {
                    const filtered = suppliers.filter(s => {
                      const query = supplierSearchQuery.toLowerCase();
                      return s.name.toLowerCase().includes(query) || 
                             s.country.toLowerCase().includes(query) || 
                             s.taxId.toLowerCase().includes(query) ||
                             s.phone.toLowerCase().includes(query);
                    });
                    
                    if (filtered.length === 0) {
                      return (
                        <div style={{ textAlign: 'center', color: '#9ca3af', fontSize: '0.85rem', padding: '2rem 0' }}>
                          Поставщики не найдены
                        </div>
                      );
                    }
                    
                    return filtered.map(sup => {
                      const isEditingThis = editingSupplierId === sup.id;
                      return (
                        <div 
                          key={sup.id} 
                          style={{ 
                            padding: '0.75rem', 
                            borderRadius: 'var(--radius-md)', 
                            border: isEditingThis ? '2px solid var(--primary)' : '1px solid #e5e7eb', 
                            background: isEditingThis ? 'hsl(330, 70%, 97%)' : '#f9fafb',
                            display: 'flex',
                            justifyContent: 'space-between',
                            alignItems: 'center',
                            gap: '0.5rem',
                            transition: 'all 0.2s ease'
                          }}
                        >
                          <div style={{ display: 'flex', flexDirection: 'column', gap: '0.15rem', overflow: 'hidden' }}>
                            <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text-main)', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }} title={sup.name}>
                              {sup.name}
                            </div>
                            <div style={{ fontSize: '0.75rem', color: '#6b7280', display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                              <span>🌍 {sup.country}</span>
                              <span>📄 Код: {sup.taxId}</span>
                            </div>
                            {sup.phone && (
                              <div style={{ fontSize: '0.7rem', color: '#6b7280' }}>
                                📞 {sup.phone}
                              </div>
                            )}
                          </div>
                          
                          <div style={{ display: 'flex', gap: '0.25rem', flexShrink: 0 }}>
                            <button 
                              onClick={() => handleStartEditSupplier(sup)}
                             
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: '0.25rem', opacity: 0.85 }}
                              title="Редактировать поставщика"
                            >
                              ✏️
                            </button>
                            <button 
                              onClick={() => handleDeleteSupplier(sup.id, sup.name)}
                             
                              style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1rem', padding: '0.25rem', opacity: 0.85 }}
                              title="Удалить поставщика"
                            >
                              🗑️
                            </button>
                          </div>
                        </div>
                      );
                    });
                  })()}
                </div>
              </div>
              
              {/* RIGHT PANEL: Add or Edit Form */}
              <div style={{ flex: '1 1 60%', display: 'flex', flexDirection: 'column', overflowY: 'auto' }}>
                <h3 style={{ margin: '0 0 1rem 0', fontSize: '1.05rem', fontWeight: 700, color: 'var(--text-main)', borderBottom: '1px dashed #e5e7eb', paddingBottom: '0.5rem' }}>
                  {editingSupplierId ? `✏️ Редактирование поставщика: ${newSupplierName}` : '➕ Регистрация нового поставщика'}
                </h3>
                
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem', paddingBottom: '1.5rem' }}>
                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#4b5563', marginBottom: '0.25rem' }}>Имя поставщика <span style={{ color: 'red' }}>*</span></label>
                    <input 
                      type="text" 
                      placeholder="Например: Florist Hub LLC, ТОВ Квіти України"
                      value={newSupplierName}
                      onChange={(e) => setNewSupplierName(e.target.value)}
                      className="modal-input"
                      required
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#4b5563', marginBottom: '0.25rem' }}>Страна</label>
                      <select 
                        value={newSupplierCountry}
                        onChange={(e) => setNewSupplierCountry(e.target.value)}
                        className="modal-select"
                        style={{ padding: '0.5rem', height: '38px', fontSize: '0.85rem' }}
                      >
                        <option value="США">США (USA)</option>
                        <option value="Украина">Украина (Ukraine)</option>
                        <option value="Эквадор">Эквадор (Ecuador)</option>
                        <option value="Нидерланды">Нидерланды (Netherlands)</option>
                        <option value="Колумбия">Колумбия (Colombia)</option>
                        <option value="Кения">Кения (Kenya)</option>
                        <option value="Другая">Другая страна</option>
                      </select>
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#4b5563', marginBottom: '0.25rem' }}>Код фирмы (EIN/ЕГРПОУ)</label>
                      <input 
                        type="text" 
                        placeholder="Например: EIN-123456789 или 38472910"
                        value={newSupplierTaxId}
                        onChange={(e) => setNewSupplierTaxId(e.target.value)}
                        className="modal-input"
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#4b5563', marginBottom: '0.25rem' }}>Юридический адрес</label>
                    <input 
                      type="text" 
                      placeholder="Полный юр. адрес для накладных"
                      value={newSupplierAddress}
                      onChange={(e) => setNewSupplierAddress(e.target.value)}
                      className="modal-input"
                    />
                  </div>

                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#4b5563', marginBottom: '0.25rem' }}>Телефон</label>
                      <input 
                        type="text" 
                        placeholder="+380... / +1..."
                        value={newSupplierPhone}
                        onChange={(e) => setNewSupplierPhone(e.target.value)}
                        className="modal-input"
                      />
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#4b5563', marginBottom: '0.25rem' }}>Email</label>
                      <input 
                        type="email" 
                        placeholder="orders@supplier.com"
                        value={newSupplierEmail}
                        onChange={(e) => setNewSupplierEmail(e.target.value)}
                        className="modal-input"
                      />
                    </div>
                  </div>

                  <div style={{ display: 'flex', flexDirection: 'column' }}>
                    <label style={{ fontSize: '0.75rem', fontWeight: 700, textTransform: 'uppercase', color: '#4b5563', marginBottom: '0.25rem' }}>Заметки / Особенности</label>
                    <textarea 
                      placeholder="Дополнительные условия, контактные лица, особенности логистики..."
                      value={newSupplierNotes}
                      onChange={(e) => setNewSupplierNotes(e.target.value)}
                      className="modal-input"
                      rows={2}
                      style={{ fontFamily: 'inherit', resize: 'vertical' }}
                    />
                  </div>
                  
                  <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '0.5rem' }}>
                    {editingSupplierId && (
                      <button 
                        type="button"
                        className="btn btn-secondary"
                        onClick={handleCancelSupplierEdit}
                        style={{ padding: '0.45rem 1rem', fontSize: '0.85rem', border: '1px solid #d1d5db', color: '#374151' }}
                      >
                        ❌ Сбросить
                      </button>
                    )}
                    <button 
                      className="btn btn-primary" 
                      onClick={handleSaveSupplier}
                      disabled={savingSupplier}
                      style={{ padding: '0.45rem 1.25rem', fontSize: '0.85rem', fontWeight: 600 }}
                    >
                      {savingSupplier ? 'Сохранение...' : (editingSupplierId ? '💾 Сохранить изменения' : '➕ Зарегистрировать')}
                    </button>
                  </div>
                </div>
              </div>
              
            </div>
            
            <div className="modal-footer" style={{ borderTop: '1px solid #e5e7eb', paddingTop: '1rem', marginTop: '1.5rem', display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
              <button 
                className="btn btn-secondary" 
                onClick={() => { setIsSupplierModalOpen(false); handleCancelSupplierEdit(); }}
                style={{ padding: '0.5rem 1rem', fontSize: '0.9rem', border: '1px solid #d1d5db', color: '#374151' }}
              >
                Закрыть
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Purchase Details Modal */}
      {selectedPurchaseDetails && mounted && createPortal(
        <div className="modal-backdrop fade-in" style={{ zIndex: 1000, background: 'rgba(0,0,0,0.5)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div className="modal-content glass-card fade-in-up" style={{ maxWidth: '600px', width: '95vw', background: '#ffffff', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--surface-border)', paddingBottom: '1rem', marginBottom: '1rem' }}>
              <h2 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700 }}>Подробный состав накладной</h2>
              <button onClick={() => setSelectedPurchaseDetails(null)} style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' }}>&times;</button>
            </div>
            
            <div style={{ paddingBottom: '1rem', borderBottom: '1px dashed var(--surface-border)', marginBottom: '1rem', display: 'flex', justifyContent: 'space-between' }}>
              <div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Поставщик: <strong style={{ color: 'var(--text-main)' }}>{selectedPurchaseDetails.supplier}</strong></div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Накладная: <strong style={{ color: 'var(--text-main)' }}>{selectedPurchaseDetails.invoiceNumber || 'б/н'}</strong></div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Дата: <strong style={{ color: 'var(--text-main)' }}>{new Date(selectedPurchaseDetails.createdAt).toLocaleString()}</strong></div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Сумма: <strong style={{ color: 'var(--success)', fontSize: '1.1rem' }}>${selectedPurchaseDetails.totalAmount.toFixed(2)}</strong></div>
              </div>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, paddingRight: '0.5rem' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', textAlign: 'left', fontSize: '0.85rem' }}>
                <thead style={{ background: 'rgba(0,0,0,0.02)' }}>
                  <tr>
                    <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--surface-border)' }}>Товар (Артикул)</th>
                    <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--surface-border)' }}>Кол-во</th>
                    <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--surface-border)' }}>Закупка</th>
                    <th style={{ padding: '0.5rem', borderBottom: '1px solid var(--surface-border)' }}>Розница</th>
                  </tr>
                </thead>
                <tbody>
                  {selectedPurchaseDetails.items.map((item, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid var(--surface-border)' }}>
                      <td style={{ padding: '0.5rem', fontWeight: 600 }}>{item.name} <span style={{ color: 'var(--text-muted)', fontSize: '0.75rem', fontWeight: 400 }}>({item.sku})</span></td>
                      <td style={{ padding: '0.5rem' }}>{item.quantity} {item.unit}</td>
                      <td style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>${item.costPrice.toFixed(2)}</td>
                      <td style={{ padding: '0.5rem', color: 'var(--text-muted)' }}>${item.retailPrice.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>,
        document.body
      )}

      {/* Supplier Details & Analytics Modal */}
      {selectedSupplierView && mounted && createPortal(
        <div className="modal-backdrop" onClick={() => setSelectedSupplierView(null)}>
          <div className="modal-content" onClick={e => e.stopPropagation()} style={{ maxWidth: '800px', width: '95vw', background: '#ffffff', color: 'var(--text-main)', padding: '1.5rem', maxHeight: '85vh', display: 'flex', flexDirection: 'column' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid #e5e7eb', paddingBottom: '1rem', marginBottom: '1.5rem' }}>
              <div>
                <h2 style={{ margin: 0, fontSize: '1.5rem', fontWeight: 800, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  🏢 Досье поставщика: {selectedSupplierView.profile.name}
                </h2>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.25rem' }}>
                  🌍 {selectedSupplierView.profile.country} | 📄 ИНН/Код: {selectedSupplierView.profile.taxId}
                </div>
              </div>
              <button onClick={() => setSelectedSupplierView(null)} style={{ background: 'transparent', border: 'none', fontSize: '1.5rem', cursor: 'pointer', color: '#6b7280' }}>&times;</button>
            </div>

            <div style={{ overflowY: 'auto', flex: 1, paddingRight: '0.5rem' }}>
              {/* Supplier Info Block */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginBottom: '1.5rem', background: '#f9fafb', padding: '1rem', borderRadius: 'var(--radius-lg)', border: '1px solid #e5e7eb' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Юридический Адрес</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{selectedSupplierView.profile.legalAddress || 'Не указан'}</div>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Контакты</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{selectedSupplierView.profile.phone || 'Нет телефона'}</div>
                  <div style={{ fontSize: '0.9rem', fontWeight: 500 }}>{selectedSupplierView.profile.email || 'Нет email'}</div>
                </div>
                {selectedSupplierView.profile.notes && (
                  <div style={{ gridColumn: '1 / -1', borderTop: '1px dashed #d1d5db', paddingTop: '0.5rem', marginTop: '0.5rem' }}>
                    <div style={{ fontSize: '0.75rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase' }}>Заметки</div>
                    <div style={{ fontSize: '0.85rem', fontStyle: 'italic' }}>{selectedSupplierView.profile.notes}</div>
                  </div>
                )}
              </div>

              <h3 style={{ fontSize: '1.1rem', marginBottom: '1rem', borderBottom: '1px solid #e5e7eb', paddingBottom: '0.5rem' }}>📦 История накладных</h3>
              
              {selectedSupplierView.purchases.length === 0 ? (
                <div style={{ textAlign: 'center', color: 'var(--text-muted)', padding: '2rem' }}>
                  Накладных от этого поставщика пока нет.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                  {selectedSupplierView.purchases.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()).map(p => (
                    <div key={p.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem', border: '1px solid #e5e7eb', borderRadius: 'var(--radius-md)', backgroundColor: 'var(--surface-base)' }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.25rem' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.95rem' }}>{p.invoiceNumber ? `Накладная ${p.invoiceNumber}` : 'б/н'}</span>
                          {p.status === 'IN_TRANSIT' ? (
                            <span className="badge" style={{ background: 'hsl(40, 90%, 50%)', color: 'white', fontSize: '0.65rem' }}>🚚 В дороге</span>
                          ) : (
                            <span className="badge" style={{ background: 'var(--success)', color: 'white', fontSize: '0.65rem' }}>📦 Доставлена</span>
                          )}
                        </div>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>{new Date(p.createdAt).toLocaleString()}</span>
                        <span style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Позиций: {p.items.length} шт.</span>
                      </div>
                      
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
                        <span style={{ fontWeight: 800, color: 'var(--success)', fontSize: '1.1rem' }}>${p.totalAmount.toFixed(2)}</span>
                        {p.status === 'IN_TRANSIT' && (
                          <button 
                            className="btn btn-primary btn-sm" 
                            onClick={() => {
                              handleReceivePurchase(p);
                              setSelectedSupplierView(null);
                            }} 
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', fontWeight: 600, background: 'var(--success)' }}
                          >
                            📦 Принять товар
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>,
        document.body
      )}

      <style jsx>{`
        .purchases-dashboard { display: flex; flex-direction: column; gap: 1.5rem; }
        .page-header { display: flex; justify-content: space-between; align-items: flex-end; flex-wrap: wrap; gap: 1rem; }
        .title-section h1 { font-size: 2rem; margin-bottom: 0.25rem; color: var(--text-main); }
        .subtitle { color: var(--text-muted); font-size: 0.95rem; }
        .header-actions { display: flex; gap: 1rem; align-items: center; }

        .purchases-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1.25rem; }
        .stat-card { padding: 1.25rem; display: flex; flex-direction: column; gap: 0.25rem; }
        .stat-card h3 { font-size: 0.95rem; color: var(--text-muted); font-weight: 500; font-family: 'Inter', sans-serif; }
        .stat-value { font-size: 2rem; font-family: 'Outfit', sans-serif; font-weight: 700; color: var(--text-main); }
        .stat-sub { font-size: 0.8rem; color: var(--text-muted); }

        .mt-6 { margin-top: 1rem; }
        .p-6 { padding: 1.25rem; border-bottom: 1px solid var(--surface-border); }

        .table-wrapper { overflow-x: auto; border-radius: var(--radius-xl); padding-bottom: 1px; }
        .table-header h2 { font-size: 1.15rem; color: var(--text-main); }
        
        .purchases-table { width: 100%; border-collapse: collapse; text-align: left; background: #fff; }
        .purchases-table th, .purchases-table td { padding: 0.75rem 1rem; border-bottom: 1px solid var(--surface-border); }
        .purchases-table th { font-family: 'Outfit', sans-serif; font-size: 0.8rem; font-weight: 600; text-transform: uppercase; color: var(--text-muted); letter-spacing: 0.05em; background: rgba(0,0,0,0.02); }
        .purchases-table tr { transition: var(--transition); }
        .purchases-table tr:hover { background: rgba(0,0,0,0.01); }

        .purchase-row { border-left: 3px solid transparent; }
        .purchase-row:hover { border-left: 3px solid var(--success); }

        .id-cell { font-family: monospace; font-weight: 600; color: var(--text-muted); font-size: 0.85rem; }
        .date-cell, .supplier-cell { color: var(--text-main); font-size: 0.9rem; }
        .amount-cell { font-family: 'Outfit', sans-serif; font-weight: 700; color: var(--text-main); }

        .purchase-items-preview { display: flex; flex-direction: column; gap: 0.25rem; max-height: 120px; overflow-y: auto; padding-right: 0.25rem; }
        .preview-item { font-size: 0.8rem; color: var(--text-muted); border-bottom: 1px dashed rgba(0,0,0,0.04); padding-bottom: 0.2rem; }
        .preview-item:last-child { border-bottom: none; }

        /* Modal Styles */
        .modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          width: 100vw;
          height: 100vh;
          background: rgba(0, 0, 0, 0.5);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }

        .modal-content {
          border-radius: var(--radius-xl);
          box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 10px 10px -5px rgba(0, 0, 0, 0.04);
          padding: 1.5rem;
          display: flex;
          flex-direction: column;
          max-height: 90vh;
        }

        .modal-input {
          padding: 0.5rem 0.75rem;
          border: 1px solid #d1d5db;
          border-radius: var(--radius-md);
          font-size: 0.9rem;
          outline: none;
          color: var(--text-main);
          width: 100%;
        }
        .modal-input:focus {
          border-color: var(--primary);
          box-shadow: 0 0 0 2px rgba(var(--primary-rgb), 0.1);
        }

        .modal-input-sm {
          padding: 0.35rem 0.5rem;
          border: 1px solid #d1d5db;
          border-radius: var(--radius-sm);
          font-size: 0.8rem;
          outline: none;
          color: var(--text-main);
          width: 100%;
        }
        .modal-input-sm:focus {
          border-color: var(--primary);
        }
        .modal-input-sm:disabled {
          background-color: #f3f4f6;
          color: #9ca3af;
          cursor: not-allowed;
        }

        .modal-select {
          padding: 0.35rem 0.5rem;
          border: 1px solid #d1d5db;
          border-radius: var(--radius-sm);
          font-size: 0.8rem;
          outline: none;
          color: var(--text-main);
          width: 100%;
          background: white;
        }
        .modal-select:disabled {
          background-color: #f3f4f6;
          color: #9ca3af;
          cursor: not-allowed;
        }

        .item-label {
          font-size: 0.7rem;
          font-weight: 600;
          color: #4b5563;
          margin-bottom: 0.15rem;
          text-transform: uppercase;
        }

        .mobile-cards-container { display: none; }
        .desktop-table-container { display: block; }

        .spinner { width: 30px; height: 30px; border: 2px solid rgba(0,0,0,0.1); border-top-color: var(--primary); border-radius: 50%; animation: spin 1s linear infinite; }
        @keyframes spin { to { transform: rotate(360deg); } }

        @media (max-width: 768px) {
          .mobile-cards-container { display: block; }
          .desktop-table-container { display: none; }
          .page-header { flex-direction: column; align-items: stretch; gap: 0.75rem; }
          .header-actions { justify-content: stretch; width: 100%; }
          .header-actions button { flex: 1; }
          .stat-value { font-size: 1.6rem; }
          .table-wrapper { border-radius: var(--radius-md); }
          .purchases-table th, .purchases-table td { padding: 0.5rem 0.75rem; font-size: 0.8rem; }
          .modal-content { width: 98vw; padding: 1rem; }
          
          .supplier-modal-body {
            flex-direction: column !important;
            height: auto !important;
            max-height: 60vh !important;
            overflow-y: auto !important;
          }
          .supplier-modal-body > div:first-child {
            border-right: none !important;
            border-bottom: 1px solid #e5e7eb;
            padding-right: 0 !important;
            padding-bottom: 1.5rem;
            flex: 1 1 auto !important;
          }
          .supplier-modal-body > div:last-child {
            flex: 1 1 auto !important;
            padding-top: 1rem;
          }
        }
      `}</style>
    </div>
  );
}
