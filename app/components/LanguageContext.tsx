'use client';

import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';

type Language = 'RU' | 'EN';

interface LanguageContextType {
  language: Language;
  setLanguage: (lang: Language) => void;
  t: (key: string, variables?: Record<string, string | number>) => string;
}

const translations: Record<Language, Record<string, string>> = {
  RU: {
    'nav.stock': 'Склад',
    'nav.wp-products': 'Товары',
    'nav.assembly': 'Сборка',
    'nav.purchases': 'Закупки',
    'nav.showcase': 'Витрина',
    'nav.analytics': 'Аналитика',
    'nav.expenses': 'Расходы',
    'header.online': 'Онлайн',
    'role.owner': 'Владелец (Все цены)',
    'role.accountant': 'Бухгалтер (Все цены)',
    'role.employee': 'Сотрудник (Только розница)',
    'action.export': 'Экспорт QB',
    'action.add': 'Добавить',
    'action.save': 'Сохранить',
    'action.delete': 'Удалить',
    'action.edit': 'Редактировать',
    'stock.title': 'Складские Запасы',
    'stock.subtitle': 'Текущее состояние цветов и материалов',
    'stock.loading': 'Загрузка склада...',
    'stock.low': 'Низкий запас',
    'stock.left': 'осталось',
    'table.sku': 'Артикул',
    'table.name': 'Название',
    'table.category': 'Категория',
    'table.balance': 'Остаток',
    'table.units': 'Единицы',
    'table.cost': 'Себестоимость',
    'table.retail': 'Розница',
    'table.actions': 'Действия',
    'assembly.title': 'Сборка Букетов',
    'assembly.subtitle': 'Новый букет и списание материалов',
    'assembly.worker': 'Сотрудник (Сборщик)',
    'assembly.name': 'Название букета',
    'assembly.name_placeholder': 'Напр., Весенний рассвет',
    'assembly.price': 'Розничная цена продажи',
    'assembly.photo': 'URL фото (необязательно)',
    'assembly.photo_placeholder': 'https://...',
    'assembly.materials': 'Использованные материалы',
    'assembly.materials_desc': 'Выберите цветы и упаковку, которые ушли на этот букет',
    'assembly.select_material': '-- Выберите материал --',
    'assembly.qty': 'Кол-во',
    'assembly.add_material': 'Добавить материал',
    'assembly.create': 'Собрать букет',
    'assembly.history': 'История Сборок',
    'assembly.history_desc': 'Последние собранные букеты',
    'assembly.loading': 'Загрузка истории и склада...',
    'purchases.title': 'Закупки & Поступления',
    'purchases.subtitle': 'Регистрация новых партий товара',
    'purchases.loading': 'Загрузка истории закупок...',
    'purchases.supplier': 'Поставщик',
    'purchases.supplier_placeholder': 'Напр. Эквадор Фарм',
    'purchases.invoice': 'Номер накладной (опционально)',
    'purchases.items': 'Товары в партии',
    'purchases.items_desc': 'Выберите существующий товар или введите новый',
    'purchases.select_product': '-- Выберите товар --',
    'purchases.cost_price': 'Закупочная цена',
    'purchases.retail_price': 'Розничная цена (если меняется)',
    'purchases.add_item': 'Добавить товар в накладную',
    'purchases.total': 'Итого по накладной: {total}',
    'purchases.register': 'Зарегистрировать партию',
    'purchases.history': 'История Закупок',
    'purchases.history_desc': 'Недавние поступления на склад',
    'purchases.date': 'Дата',
    'purchases.total_table': 'Сумма',
    'analytics.title': 'Финансовая Аналитика',
    'analytics.subtitle': 'Основные показатели бизнеса',
    'analytics.loading': 'Загрузка аналитики...',
    'analytics.revenue': 'Выручка',
    'analytics.revenue_desc': 'за последние 30 дней',
    'analytics.profit': 'Маржинальная прибыль',
    'analytics.profit_desc': 'расчетная от продаж',
    'analytics.top_product': 'Топ продаж',
    'analytics.top_product_desc': 'самый популярный товар',
    'analytics.sales_chart': 'Динамика Продаж (тест)',
    'analytics.chart_desc': 'Визуализация выручки по дням',
    'showcase.title': 'Витрина',
    'showcase.subtitle': 'Управление готовыми букетами',
    'showcase.loading': 'Загрузка витрины...',
    'showcase.sell': 'Продать',
    'showcase.decompose': 'Разобрать / Списать',
    'showcase.empty': 'На витрине пока нет букетов',
  },
  EN: {
    'nav.stock': 'Stock',
    'nav.wp-products': 'Products',
    'nav.assembly': 'Assembly',
    'nav.purchases': 'Purchases',
    'nav.showcase': 'Showcase',
    'nav.analytics': 'Analytics',
    'nav.expenses': 'Expenses',
    'header.online': 'Online',
    'role.owner': 'Owner (All prices)',
    'role.accountant': 'Accountant (All prices)',
    'role.employee': 'Employee (Retail only)',
    'action.export': 'Export QB',
    'action.add': 'Add',
    'action.save': 'Save',
    'action.delete': 'Delete',
    'action.edit': 'Edit',
    'stock.title': 'Inventory',
    'stock.subtitle': 'Current status of flowers and materials',
    'stock.loading': 'Loading inventory...',
    'stock.low': 'Low stock',
    'stock.left': 'left',
    'table.sku': 'SKU',
    'table.name': 'Name',
    'table.category': 'Category',
    'table.balance': 'Balance',
    'table.units': 'Units',
    'table.cost': 'Cost Price',
    'table.retail': 'Retail Price',
    'table.actions': 'Actions',
    'assembly.title': 'Bouquet Assembly',
    'assembly.subtitle': 'New bouquet and material deduction',
    'assembly.worker': 'Employee (Assembler)',
    'assembly.name': 'Bouquet Name',
    'assembly.name_placeholder': 'E.g., Spring Dawn',
    'assembly.price': 'Retail Sale Price',
    'assembly.photo': 'Photo URL (optional)',
    'assembly.photo_placeholder': 'https://...',
    'assembly.materials': 'Materials Used',
    'assembly.materials_desc': 'Select flowers and packaging used for this bouquet',
    'assembly.select_material': '-- Select Material --',
    'assembly.qty': 'Qty',
    'assembly.add_material': 'Add Material',
    'assembly.create': 'Assemble Bouquet',
    'assembly.history': 'Assembly History',
    'assembly.history_desc': 'Recently assembled bouquets',
    'assembly.loading': 'Loading history and stock...',
    'purchases.title': 'Purchases & Receipts',
    'purchases.subtitle': 'Register new incoming shipments',
    'purchases.loading': 'Loading purchase history...',
    'purchases.supplier': 'Supplier',
    'purchases.supplier_placeholder': 'E.g. Ecuador Farms',
    'purchases.invoice': 'Invoice Number (Optional)',
    'purchases.items': 'Items in Shipment',
    'purchases.items_desc': 'Select an existing product or enter a new one',
    'purchases.select_product': '-- Select Product --',
    'purchases.cost_price': 'Cost Price',
    'purchases.retail_price': 'Retail Price (if modifying)',
    'purchases.add_item': 'Add Item to Invoice',
    'purchases.total': 'Total for Invoice: {total}',
    'purchases.register': 'Register Shipment',
    'purchases.history': 'Purchase History',
    'purchases.history_desc': 'Recent stock arrivals',
    'purchases.date': 'Date',
    'purchases.total_table': 'Total',
    'analytics.title': 'Financial Analytics',
    'analytics.subtitle': 'Key Business Metrics',
    'analytics.loading': 'Loading analytics...',
    'analytics.revenue': 'Revenue',
    'analytics.revenue_desc': 'last 30 days',
    'analytics.profit': 'Gross Profit',
    'analytics.profit_desc': 'estimated from sales',
    'analytics.top_product': 'Top Sale',
    'analytics.top_product_desc': 'most popular item',
    'analytics.sales_chart': 'Sales Dynamics (test)',
    'analytics.chart_desc': 'Revenue visualization by day',
    'showcase.title': 'Showcase',
    'showcase.subtitle': 'Manage finished bouquets',
    'showcase.loading': 'Loading showcase...',
    'showcase.sell': 'Sell',
    'showcase.decompose': 'Decompose / Defect',
    'showcase.empty': 'Showcase is empty',
  }
};

const LanguageContext = createContext<LanguageContextType | undefined>(undefined);

export const LanguageProvider = ({ children }: { children: ReactNode }) => {
  const [language, setLanguageState] = useState<Language>('RU');

  useEffect(() => {
    const saved = localStorage.getItem('language');
    if (saved === 'RU' || saved === 'EN') {
      setLanguageState(saved);
    }
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    localStorage.setItem('language', lang);
  };

  const t = (key: string, variables?: Record<string, string | number>) => {
    let str = translations[language][key] || key;
    if (variables) {
      for (const [k, v] of Object.entries(variables)) {
        str = str.replace(`{${k}}`, String(v));
      }
    }
    return str;
  };

  return (
    <LanguageContext.Provider value={{ language, setLanguage, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => {
  const context = useContext(LanguageContext);
  if (!context) {
    throw new Error('useLanguage must be used within a LanguageProvider');
  }
  return context;
};
