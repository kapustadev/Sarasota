'use client';

import { useState, useEffect } from 'react';
import { useLanguage } from '../components/LanguageContext';
import { useAuth } from '../components/AuthProvider';
import { Settings, Key, Palette, Sun, Moon, Music, Bell, PartyPopper, AlertTriangle, Flower2, Package, Gift, Hammer, ShoppingCart, Plug, XCircle, Save, CheckCircle2, Upload, Plus, Download, RefreshCw, Trash2, BarChart2 } from 'lucide-react';

export default function SettingsPage() {
  const { language, setLanguage } = useLanguage();
  const { user, login } = useAuth();
  const userRole = user?.role || 'EMPLOYEE';

  // Notification configurations
  const [notifSettings, setNotifSettings] = useState({
    enableSales: true,
    enableLowStock: true,
    enableOperations: true,
    categories: {
      FLOWER: true,
      GIFT: true,
      PACKAGING: true,
      MATERIAL: true
    }
  });

  // Credential forms state
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [credentialError, setCredentialError] = useState('');
  const [credentialSuccess, setCredentialSuccess] = useState('');
  const [isUpdatingCredentials, setIsUpdatingCredentials] = useState(false);

  // Appearance & Theme States
  const [theme, setTheme] = useState('light');
  const [soundEnabled, setSoundEnabled] = useState(true);

  // Default Auto-markup state
  const [defaultMarkup, setDefaultMarkup] = useState('100');

  // WooCommerce Credentials States
  const [wpUrl, setWpUrl] = useState('');
  const [wpCk, setWpCk] = useState('');
  const [wpCs, setWpCs] = useState('');
  const [wpSaveSuccess, setWpSaveSuccess] = useState('');
  const [wpSaveError, setWpSaveError] = useState('');
  const [isSavingWp, setIsSavingWp] = useState(false);
  const [isTestingWp, setIsTestingWp] = useState(false);
  const [wpTestStatus, setWpTestStatus] = useState<'idle' | 'success' | 'failed'>('idle');
  const [wpTestMessage, setWpTestMessage] = useState('');

  // Restore/Reset states
  const [isRestoring, setIsRestoring] = useState(false);
  const [isResetting, setIsResetting] = useState(false);
  const [restoreSuccess, setRestoreSuccess] = useState('');
  const [restoreError, setRestoreError] = useState('');

  // Backup list state
  const [backups, setBackups] = useState<any[]>([]);
  const [backupsLoading, setBackupsLoading] = useState(false);
  const [isCreatingBackup, setIsCreatingBackup] = useState(false);
  const [backupMsg, setBackupMsg] = useState('');

  // Load configurations on mount
  useEffect(() => {
    // 1. Notification toggles
    const savedNotifs = localStorage.getItem('sarasota_notification_settings');
    if (savedNotifs) {
      try {
        setNotifSettings(JSON.parse(savedNotifs));
      } catch (e) {
        console.error('Error parsing notification settings:', e);
      }
    }

    // 2. User info
    if (user) {
      setNewUsername(user.username || '');
    }

    // 3. Theme preference
    const savedTheme = localStorage.getItem('sarasota_theme') || 'light';
    setTheme(savedTheme);

    // 5. Sound preference
    const savedSound = localStorage.getItem('sarasota_sound_alerts');
    if (savedSound !== null) {
      setSoundEnabled(savedSound === 'true');
    }

    // 6. Default Markup
    const savedMarkup = localStorage.getItem('sarasota_default_markup');
    if (savedMarkup) {
      setDefaultMarkup(savedMarkup);
    }

    // 7. Load WooCommerce configuration from DB
    const loadWcConfig = async () => {
      try {
        const res = await fetch('/api/wp/config');
        if (res.ok) {
          const data = await res.json();
          setWpUrl(data.url || '');
          setWpCk(data.ck || '');
          setWpCs(data.cs || '');
        }
      } catch (e) {
        console.error('Error loading WooCommerce configuration:', e);
      }
    };
    loadWcConfig();

    // 8. Load backup list
    loadBackups();
  }, [user]);

  // Handle Theme Switching
  const handleToggleTheme = (newTheme: 'light' | 'dark') => {
    setTheme(newTheme);
    localStorage.setItem('sarasota_theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  // Handle Sound Alerts toggle
  const handleToggleSound = () => {
    const updated = !soundEnabled;
    setSoundEnabled(updated);
    localStorage.setItem('sarasota_sound_alerts', String(updated));
  };

  // Handle default auto-markup updates
  const handleSaveMarkup = (val: string) => {
    setDefaultMarkup(val);
    localStorage.setItem('sarasota_default_markup', val);
  };

  // Synthesized Sound test button using Web Audio API
  const playSynthesizedChime = () => {
    if (typeof window === 'undefined') return;
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      
      const osc1 = ctx.createOscillator();
      const gain1 = ctx.createGain();
      osc1.connect(gain1);
      gain1.connect(ctx.destination);
      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
      gain1.gain.setValueAtTime(0.12, ctx.currentTime);
      gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.35);
      osc1.start(ctx.currentTime);
      osc1.stop(ctx.currentTime + 0.35);

      const osc2 = ctx.createOscillator();
      const gain2 = ctx.createGain();
      osc2.connect(gain2);
      gain2.connect(ctx.destination);
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5
      gain2.gain.setValueAtTime(0.12, ctx.currentTime + 0.12);
      gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.47);
      osc2.start(ctx.currentTime + 0.12);
      osc2.stop(ctx.currentTime + 0.47);
    } catch (e) {
      console.error('AudioContext error:', e);
    }
  };

  // Handle toggling notification channels
  const handleToggleSetting = (key: 'enableSales' | 'enableLowStock' | 'enableOperations') => {
    const updated = {
      ...notifSettings,
      [key]: !notifSettings[key]
    };
    setNotifSettings(updated);
    localStorage.setItem('sarasota_notification_settings', JSON.stringify(updated));
    
    // Dispatch custom event to notify Header/bell component to instantly refetch
    window.dispatchEvent(new Event('storage'));
  };

  // Handle toggling low stock product categories
  const handleToggleCategory = (cat: 'FLOWER' | 'GIFT' | 'PACKAGING' | 'MATERIAL') => {
    const updated = {
      ...notifSettings,
      categories: {
        ...notifSettings.categories,
        [cat]: !notifSettings.categories[cat]
      }
    };
    setNotifSettings(updated);
    localStorage.setItem('sarasota_notification_settings', JSON.stringify(updated));
    
    // Dispatch custom event to notify Header/bell component to instantly refetch
    window.dispatchEvent(new Event('storage'));
  };

  // Handle user credentials update
  const handleUpdateCredentials = async (e: React.FormEvent) => {
    if (userRole === 'DESIGNER') { if (typeof e !== 'undefined' && e.preventDefault) e.preventDefault(); alert('Действие недоступно для вашей роли.'); return; }
        e.preventDefault();
    if (!user) return;
    if (!newUsername.trim() || !newPassword.trim()) {
      setCredentialError(language === 'RU' ? 'Заполните логин и новый пароль!' : 'Please enter login and new password!');
      return;
    }

    setIsUpdatingCredentials(true);
    setCredentialError('');
    setCredentialSuccess('');

    try {
      const res = await fetch('/api/user/update', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          newUsername: newUsername,
          newPassword: newPassword
        })
      });

      if (res.ok) {
        const data = await res.json();
        login(data.user); // update frontend user session state
        setCredentialSuccess(language === 'RU' ? 'Данные авторизации успешно обновлены!' : 'Credentials successfully updated!');
        setNewPassword('');
      } else {
        const data = await res.json();
        setCredentialError(data.error || 'Ошибка при обновлении');
      }
    } catch (e) {
      console.error(e);
      setCredentialError(language === 'RU' ? 'Сетевая ошибка' : 'Network error');
    } finally {
      setIsUpdatingCredentials(false);
    }
  };

  // Handle WooCommerce settings update
  const handleSaveWpConfig = async (e: React.FormEvent) => {
    if (userRole === 'DESIGNER') { if (typeof e !== 'undefined' && e.preventDefault) e.preventDefault(); alert('Действие недоступно для вашей роли.'); return; }
        e.preventDefault();
    setIsSavingWp(true);
    setWpSaveSuccess('');
    setWpSaveError('');

    try {
      const res = await fetch('/api/wp/config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          url: wpUrl,
          ck: wpCk,
          cs: wpCs
        })
      });

      if (res.ok) {
        setWpSaveSuccess(language === 'RU' ? 'Настройки WooCommerce успешно сохранены!' : 'WooCommerce settings successfully saved!');
        setWpTestStatus('idle');
      } else {
        const data = await res.json();
        setWpSaveError(data.error || 'Failed to save WooCommerce configuration');
      }
    } catch (e) {
      console.error(e);
      setWpSaveError(language === 'RU' ? 'Сетевая ошибка' : 'Network error');
    } finally {
      setIsSavingWp(false);
    }
  };

  // Handle Testing WooCommerce Integration Connectivity
  const handleTestWpConfig = async () => {
    setIsTestingWp(true);
    setWpTestStatus('idle');
    setWpTestMessage('');

    try {
      const res = await fetch('/api/wp/active-orders');
      if (res.ok) {
        setWpTestStatus('success');
        setWpTestMessage(language === 'RU' ? 'Соединение успешно установлено! Товары синхронизированы.' : 'Connection successful! Dynamic data synced.');
      } else {
        setWpTestStatus('failed');
        setWpTestMessage(language === 'RU' ? 'Соединение не удалось. Проверьте адрес сайта и API ключи.' : 'Connection failed. Please verify credentials.');
      }
    } catch (e) {
      console.error(e);
      setWpTestStatus('failed');
      setWpTestMessage(language === 'RU' ? 'Сетевая ошибка при проверке' : 'Network failure during test connection');
    } finally {
      setIsTestingWp(false);
    }
  };

  // Load backups list
  const loadBackups = async () => {
    setBackupsLoading(true);
    try {
      const res = await fetch('/api/backups');
      if (res.ok) {
        const data = await res.json();
        setBackups(data.backups || []);
      }
    } catch (e) {
      console.error('Error loading backups:', e);
    } finally {
      setBackupsLoading(false);
    }
  };

  // Create a new backup now
  const handleCreateBackup = async () => {
    if (userRole === 'DESIGNER') { if (typeof e !== 'undefined' && e.preventDefault) e.preventDefault(); alert('Действие недоступно для вашей роли.'); return; }
        setIsCreatingBackup(true);
    setBackupMsg('');
    try {
      const res = await fetch('/api/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create' })
      });
      const data = await res.json();
      if (res.ok) {
        setBackups(data.backups || []);
        setBackupMsg('✅ Бэкап успешно создан!');
      } else {
        setBackupMsg('❌ ' + (data.error || 'Ошибка создания бэкапа'));
      }
    } catch (e) {
      setBackupMsg('❌ Сетевая ошибка');
    } finally {
      setIsCreatingBackup(false);
      setTimeout(() => setBackupMsg(''), 4000);
    }
  };

  // Restore from specific backup
  const handleRestoreFromBackup = async (filename: string, label: string) => {
    if (userRole === 'DESIGNER') { if (typeof e !== 'undefined' && e.preventDefault) e.preventDefault(); alert('Действие недоступно для вашей роли.'); return; }
        const msg = language === 'RU'
      ? `ВНИМАНИЕ! Вы собираетесь восстановить базу из бэкапа: "${label}". Все изменения после этой даты будут стерты. Продолжить?`
      : `WARNING! You are about to restore the database from: "${label}". All changes made after this date will be erased. Proceed?`;
    if (!confirm(msg)) return;

    setIsRestoring(true);
    setRestoreError('');
    setRestoreSuccess('');
    try {
      const res = await fetch('/api/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'restore', filename })
      });
      const data = await res.json();
      if (res.ok) {
        setRestoreSuccess(language === 'RU' ? 'База данных успешно восстановлена! Перезагрузка...' : 'Database successfully restored! Reloading...');
        setTimeout(() => window.location.reload(), 1500);
      } else {
        setRestoreError(data.error || 'Ошибка при восстановлении');
      }
    } catch (e) {
      setRestoreError('Сетевая ошибка');
    } finally {
      setIsRestoring(false);
    }
  };

  const handleDownloadBackup = (filename: string) => {
    window.open(`/api/backups/download?filename=${encodeURIComponent(filename)}`, '_blank');
  };

  const handleDeleteBackup = async (filename: string) => {
    if (userRole === 'DESIGNER') { if (typeof e !== 'undefined' && e.preventDefault) e.preventDefault(); alert('Действие недоступно для вашей роли.'); return; }
        const confirmMsg = language === 'RU'
      ? 'Вы уверены, что хотите удалить этот бэкап?'
      : 'Are you sure you want to delete this backup?';
    if (!confirm(confirmMsg)) return;

    try {
      const res = await fetch('/api/backups', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'delete', filename })
      });
      const data = await res.json();
      if (res.ok) {
        setBackups(data.backups || []);
        alert(language === 'RU' ? 'Бэкап удален!' : 'Backup successfully deleted!');
      } else {
        alert(data.error || 'Ошибка при удалении');
      }
    } catch (e) {
      alert(language === 'RU' ? 'Сетевая ошибка' : 'Network error');
    }
  };

  const handleImportBackup = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const confirmMsg = language === 'RU'
      ? 'ВНИМАНИЕ! Импорт бэкапа полностью ПЕРЕЗАПИШЕТ текущую базу данных. Все несохраненные изменения будут потеряны. Продолжить?'
      : 'WARNING! Importing a backup will completely OVERWRITE the current database. All unsaved changes will be lost. Proceed?';
    if (!confirm(confirmMsg)) {
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onload = async (event) => {
      try {
        const json = JSON.parse(event.target?.result as string);
        
        setIsRestoring(true);
        setRestoreError('');
        setRestoreSuccess('');

        const res = await fetch('/api/backups/upload', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(json)
        });
        
        const data = await res.json();
        
        if (res.ok) {
          setRestoreSuccess(language === 'RU' ? 'База данных успешно импортирована! Перезагрузка...' : 'Database successfully imported! Reloading...');
          setTimeout(() => window.location.reload(), 1500);
        } else {
          setRestoreError(data.error || 'Ошибка при импорте');
        }
      } catch (err) {
        alert(language === 'RU' ? 'Ошибка чтения файла: неверный JSON формат' : 'File read error: invalid JSON format');
      } finally {
        setIsRestoring(false);
        e.target.value = '';
      }
    };
    reader.readAsText(file);
  };

  // Handle database restore from backup (legacy - kept for compatibility)
  const handleRestoreDatabase = async () => {
    if (backups.length > 0) {
      handleRestoreFromBackup(backups[0].filename, backups[0].label);
    } else {
      alert('Нет доступных бэкапов. Сначала создайте бэкап.');
    }
  };

  // Handle developer hard reset (clear all data)
  const handleDevReset = async () => {
    const confirm1 = language === 'RU'
      ? 'Вы уверены, что хотите ПОЛНОСТЬЮ стереть всю базу данных (склад, закупки, поставщиков, расходы и историю)?'
      : 'Are you sure you want to COMPLETELY clear the database (inventory, purchases, suppliers, expenses, and logs)?';

    if (!confirm(confirm1)) return;

    const confirm2 = language === 'RU'
      ? 'ВНИМАНИЕ! Это стрет ВСЕ данные и полностью очистит склад. Это действие абсолютно необратимо. Выполнить сброс?'
      : 'WARNING! This will clear ALL data and reset the warehouse. This action is irreversible. Proceed?';

    if (!confirm(confirm2)) return;

    setIsResetting(true);

    try {
      const res = await fetch('/api/dev-reset', { method: 'POST' });
      if (res.ok) {
        alert(language === 'RU' ? 'База данных успешно очищена! Перезагрузка страницы...' : 'Database successfully reset! Reloading...');
        window.location.reload();
      } else {
        const data = await res.json();
        alert(`Error: ${data.error}`);
      }
    } catch (e) {
      console.error('Reset error:', e);
      alert('Network error during reset');
    } finally {
      setIsResetting(false);
    }
  };

  if (!user) return null;

  return (
    <div style={{ maxWidth: '1000px', margin: '0 auto', padding: '1rem 0' }} className="fade-in">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '2rem' }}>
        <div>
          <h1 style={{ fontSize: '2.25rem', fontWeight: 800, margin: 0, display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
            <Settings size={32} /> {language === 'RU' ? 'Настройки системы' : 'System Settings'}
          </h1>
          <p style={{ margin: '0.4rem 0 0 0', color: 'var(--text-muted)' }}>
            {language === 'RU' ? 'Персонализация, уведомления, интеграция WooCommerce и управление базой данных' : 'Appearance, alert thresholds, WooCommerce dynamic configurations and storage backups'}
          </p>
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '2rem' }} className="settings-grid">
        
        {/* LEFT COLUMN: Account, Appearance & Notifications */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Card 1: User Account */}
          <div className="glass-card" style={{ padding: '1.5rem', background: '#ffffff' }}>
            <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Key size={20} /> {language === 'RU' ? 'Учетные данные' : 'User Credentials'}
            </h3>
            
            <form onSubmit={handleUpdateCredentials} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {credentialError && (
                <div style={{ padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)', background: '#fef2f2', border: '1px solid #fee2e2', color: 'var(--error)', fontSize: '0.85rem', fontWeight: 600 }}>
                  ⚠️ {credentialError}
                </div>
              )}
              {credentialSuccess && (
                <div style={{ padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)', background: '#f0fdf4', border: '1px solid #dcfce7', color: 'var(--success)', fontSize: '0.85rem', fontWeight: 600 }}>
                  🎉 {credentialSuccess}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>{language === 'RU' ? 'Логин / Имя пользователя:' : 'Username:'}</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={newUsername}
                  onChange={e => setNewUsername(e.target.value)}
                  placeholder="Введите логин"
                  style={{ background: '#fcfcfc' }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>{language === 'RU' ? 'Новый пароль:' : 'New Password:'}</label>
                <input 
                  type="password" 
                  className="input-field" 
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder={language === 'RU' ? 'Введите новый пароль' : 'Enter new password'}
                  style={{ background: '#fcfcfc' }}
                />
              </div>

              <button 
                type="submit" 
                disabled={isUpdatingCredentials}
                className="btn btn-primary"
                style={{ width: '100%', marginTop: '0.5rem', fontWeight: 600 }}
              >
                {isUpdatingCredentials ? '...' : <><Save size={16} style={{ display: 'inline' }} /> {language === 'RU' ? 'Сохранить учетные данные' : 'Save Credentials'}</>}
              </button>
            </form>
          </div>

          {/* Card 2: Appearance, sound and calculators */}
          <div className="glass-card" style={{ padding: '1.5rem', background: '#ffffff' }}>
            <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Palette size={20} /> {language === 'RU' ? 'Оформление и Персонализация' : 'Appearance & General'}
            </h3>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
              {/* Theme selector */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {language === 'RU' ? 'Цветовая тема' : 'Interface Theme'}
                </span>
                <div style={{ display: 'flex', gap: '0.5rem' }}>
                  <button 
                    onClick={() => handleToggleTheme('light')}
                    className={`btn ${theme === 'light' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, fontWeight: 600, display: 'flex', gap: '0.35rem', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Sun size={16} /> {language === 'RU' ? 'Светлая' : 'Light'}
                  </button>
                  <button 
                    onClick={() => handleToggleTheme('dark')}
                    className={`btn ${theme === 'dark' ? 'btn-primary' : 'btn-secondary'}`}
                    style={{ flex: 1, fontWeight: 600, display: 'flex', gap: '0.35rem', alignItems: 'center', justifyContent: 'center' }}
                  >
                    <Moon size={16} /> {language === 'RU' ? 'Темная' : 'Dark'}
                  </button>
                </div>
              </div>

              {/* Sound alert triggers */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', borderTop: '1px solid var(--surface-border)', paddingTop: '1rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {language === 'RU' ? 'Звуковое сопровождение' : 'Audio alerts'}
                </span>
                
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', borderRadius: 'var(--radius-md)', background: '#fafafa', border: '1px solid var(--surface-border)' }} className="sound-toggle-box">
                  <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', flex: 1 }}>
                    <input 
                      type="checkbox" 
                      checked={soundEnabled}
                      onChange={handleToggleSound}
                      style={{ width: '1.1rem', height: '1.1rem', cursor: 'pointer' }}
                    />
                    <div style={{ display: 'flex', flexDirection: 'column', marginLeft: '0.25rem' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{language === 'RU' ? 'Звук уведомлений' : 'Enable sound notifications'}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{language === 'RU' ? 'Воспроизводить сигнал при новых продажах' : 'Chime for new sales and low stock alerts'}</span>
                    </div>
                  </label>
                  
                  <button 
                    onClick={playSynthesizedChime}
                    className="btn btn-secondary"
                    style={{ padding: '0.35rem 0.6rem', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.25rem' }}
                  >
                    <Music size={14} /> {language === 'RU' ? 'Тест' : 'Test'}
                  </button>
                </div>
              </div>

            </div>
          </div>

          {/* Card 3: Notifications */}
          <div className="glass-card" style={{ padding: '1.5rem', background: '#ffffff' }}>
            <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Bell size={20} /> {language === 'RU' ? 'Настройка уведомлений' : 'Notifications Settings'}
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  {language === 'RU' ? 'Каналы уведомлений' : 'Alert Channels'}
                </span>
                
                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', borderRadius: 'var(--radius-md)', background: '#fafafa', border: '1px solid var(--surface-border)', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <PartyPopper size={20} color="var(--primary)" />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{language === 'RU' ? 'Продажи' : 'Sales Alerts'}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{language === 'RU' ? 'Покупки на сайте и кассе' : 'Showcase & WooCommerce checkout alerts'}</span>
                    </div>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={notifSettings.enableSales}
                    onChange={() => handleToggleSetting('enableSales')}
                    style={{ width: '1.1rem', height: '1.1rem', cursor: 'pointer' }}
                  />
                </label>

                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', borderRadius: 'var(--radius-md)', background: '#fafafa', border: '1px solid var(--surface-border)', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <AlertTriangle size={20} color="var(--warning)" />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{language === 'RU' ? 'Низкий запас товаров' : 'Low Stock alerts'}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{language === 'RU' ? 'Предупреждения об остатках сырья' : 'Warehouse stock threshold triggers'}</span>
                    </div>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={notifSettings.enableLowStock}
                    onChange={() => handleToggleSetting('enableLowStock')}
                    style={{ width: '1.1rem', height: '1.1rem', cursor: 'pointer' }}
                  />
                </label>

                <label style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.75rem', borderRadius: 'var(--radius-md)', background: '#fafafa', border: '1px solid var(--surface-border)', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <Settings size={20} color="var(--text-main)" />
                    <div style={{ display: 'flex', flexDirection: 'column' }}>
                      <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>{language === 'RU' ? 'Операции на складе' : 'Operational Actions'}</span>
                      <span style={{ fontSize: '0.7rem', color: 'var(--text-muted)' }}>{language === 'RU' ? 'Поставки, расходы и списания брака' : 'Logistics, defects, bookkeeping and assemblies'}</span>
                    </div>
                  </div>
                  <input 
                    type="checkbox" 
                    checked={notifSettings.enableOperations}
                    onChange={() => handleToggleSetting('enableOperations')}
                    style={{ width: '1.1rem', height: '1.1rem', cursor: 'pointer' }}
                  />
                </label>
              </div>

              {notifSettings.enableLowStock && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', marginTop: '0.5rem', paddingLeft: '0.25rem' }}>
                  <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {language === 'RU' ? 'Остатки по категориям' : 'Stock levels by category'}
                  </span>
                  
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)', cursor: 'pointer', background: notifSettings.categories.FLOWER ? 'rgba(124, 58, 237, 0.05)' : '#ffffff' }}>
                      <input 
                        type="checkbox" 
                        checked={notifSettings.categories.FLOWER}
                        onChange={() => handleToggleCategory('FLOWER')}
                        style={{ cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}><Flower2 size={16} /> {language === 'RU' ? 'Цветы' : 'Flowers'}</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)', cursor: 'pointer', background: notifSettings.categories.PACKAGING ? 'rgba(249, 115, 22, 0.05)' : '#ffffff' }}>
                      <input 
                        type="checkbox" 
                        checked={notifSettings.categories.PACKAGING}
                        onChange={() => handleToggleCategory('PACKAGING')}
                        style={{ cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}><Package size={16} /> {language === 'RU' ? 'Упаковка' : 'Packaging'}</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)', cursor: 'pointer', background: notifSettings.categories.GIFT ? 'rgba(236, 72, 153, 0.05)' : '#ffffff' }}>
                      <input 
                        type="checkbox" 
                        checked={notifSettings.categories.GIFT}
                        onChange={() => handleToggleCategory('GIFT')}
                        style={{ cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}><Gift size={16} /> {language === 'RU' ? 'Подарки' : 'Gifts'}</span>
                    </label>

                    <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', padding: '0.5rem', borderRadius: 'var(--radius-md)', border: '1px solid var(--surface-border)', cursor: 'pointer', background: notifSettings.categories.MATERIAL ? 'rgba(16, 185, 129, 0.05)' : '#ffffff' }}>
                      <input 
                        type="checkbox" 
                        checked={notifSettings.categories.MATERIAL}
                        onChange={() => handleToggleCategory('MATERIAL')}
                        style={{ cursor: 'pointer' }}
                      />
                      <span style={{ fontSize: '0.8rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}><Hammer size={16} /> {language === 'RU' ? 'Материалы' : 'Materials'}</span>
                    </label>
                  </div>
                </div>
              )}
            </div>
          </div>

        </div>

        {/* RIGHT COLUMN: WooCommerce, Database & Info */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2rem' }}>
          
          {/* Card 4: WooCommerce Dynamic Integration settings */}
          <div className="glass-card" style={{ padding: '1.5rem', background: '#ffffff' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem' }}>
              <h3 style={{ margin: 0, fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <ShoppingCart size={20} /> WooCommerce Integration
              </h3>
              {wpTestStatus === 'success' && (
                <span className="badge badge-green" style={{ fontSize: '0.65rem' }}>CONNECTED</span>
              )}
              {wpTestStatus === 'failed' && (
                <span className="badge badge-orange" style={{ fontSize: '0.65rem', background: '#fef2f2', color: 'var(--error)' }}>FAILED</span>
              )}
            </div>

            <form onSubmit={handleSaveWpConfig} style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {wpSaveSuccess && (
                <div style={{ padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)', background: '#f0fdf4', border: '1px solid #dcfce7', color: 'var(--success)', fontSize: '0.85rem', fontWeight: 600 }}>
                  🎉 {wpSaveSuccess}
                </div>
              )}
              {wpSaveError && (
                <div style={{ padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)', background: '#fef2f2', border: '1px solid #fee2e2', color: 'var(--error)', fontSize: '0.85rem', fontWeight: 600 }}>
                  ⚠️ {wpSaveError}
                </div>
              )}
              {wpTestMessage && (
                <div style={{ 
                  padding: '0.65rem 0.85rem', 
                  borderRadius: 'var(--radius-md)', 
                  background: wpTestStatus === 'success' ? '#f0fdf4' : '#fef2f2', 
                  border: `1px solid ${wpTestStatus === 'success' ? '#dcfce7' : '#fee2e2'}`, 
                  color: wpTestStatus === 'success' ? 'var(--success)' : 'var(--error)', 
                  fontSize: '0.85rem', 
                  fontWeight: 600 
                }}>
                  {wpTestStatus === 'success' ? '🔌' : '❌'} {wpTestMessage}
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>WooCommerce Store URL:</label>
                <input 
                  type="url" 
                  className="input-field" 
                  value={wpUrl}
                  onChange={e => setWpUrl(e.target.value)}
                  placeholder="https://sarasotaflowersgifts.com"
                  style={{ background: '#fcfcfc' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Consumer Key (CK):</label>
                <input 
                  type="text" 
                  className="input-field" 
                  value={wpCk}
                  onChange={e => setWpCk(e.target.value)}
                  placeholder="ck_..."
                  style={{ background: '#fcfcfc', fontFamily: 'monospace' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.35rem' }}>
                <label style={{ fontSize: '0.85rem', fontWeight: 600 }}>Consumer Secret (CS):</label>
                <input 
                  type="password" 
                  className="input-field" 
                  value={wpCs}
                  onChange={e => setWpCs(e.target.value)}
                  placeholder="cs_..."
                  style={{ background: '#fcfcfc', fontFamily: 'monospace' }}
                  required
                />
              </div>

              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <button 
                  type="submit" 
                  disabled={isSavingWp}
                  className="btn btn-primary"
                  style={{ flex: 1, fontWeight: 600 }}
                >
                  {isSavingWp ? '...' : <><Save size={16} /> {language === 'RU' ? 'Сохранить API ключи' : 'Save API Keys'}</>}
                </button>
                <button 
                  type="button"
                  onClick={handleTestWpConfig}
                  disabled={isTestingWp || !wpUrl}
                  className="btn btn-secondary"
                  style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                >
                  {isTestingWp ? '...' : <><Plug size={16} /> {language === 'RU' ? 'Тест' : 'Test Connection'}</>}
                </button>
              </div>
            </form>
          </div>

          {/* Card 5: Daily Automated Backups */}
          <div className="glass-card" style={{ padding: '1.5rem', background: '#ffffff' }}>
            <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <Save size={20} /> {language === 'RU' ? 'Автоматические бэкапы' : 'Daily Automated Backups'}
            </h3>

            {restoreError && (
              <div style={{ padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)', background: '#fef2f2', border: '1px solid #fee2e2', color: 'var(--error)', fontSize: '0.85rem', fontWeight: 600, marginBottom: '1rem' }}>
                ⚠️ {restoreError}
              </div>
            )}
            {restoreSuccess && (
              <div style={{ padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)', background: '#f0fdf4', border: '1px solid #dcfce7', color: 'var(--success)', fontSize: '0.85rem', fontWeight: 600, marginBottom: '1rem' }}>
                🎉 {restoreSuccess}
              </div>
            )}
            {backupMsg && (
              <div style={{ padding: '0.65rem 0.85rem', borderRadius: 'var(--radius-md)', background: backupMsg.startsWith('✅') ? '#f0fdf4' : '#fef2f2', border: `1px solid ${backupMsg.startsWith('✅') ? '#dcfce7' : '#fee2e2'}`, color: backupMsg.startsWith('✅') ? 'var(--success)' : 'var(--error)', fontSize: '0.85rem', fontWeight: 600, marginBottom: '1rem' }}>
                {backupMsg}
              </div>
            )}

            <div style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
              {/* Status bar */}
              <div style={{ padding: '0.75rem', borderRadius: 'var(--radius-md)', background: 'rgba(16, 185, 129, 0.04)', border: '1px solid rgba(16, 185, 129, 0.1)', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--success)', display: 'flex', alignItems: 'center', gap: '0.35rem' }}>
                  <CheckCircle2 size={16} /> {language === 'RU' ? 'Авто-бэкапы: Активно' : 'Auto-Backups: Active'}
                </span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Макс. 7 дней · 03:00 AM
                </span>
              </div>

              {/* Backup list */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.25rem' }}>
                  <span style={{ fontSize: '0.8rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                    {language === 'RU' ? `Доступные бэкапы (${backups.length}/7)` : `Available Backups (${backups.length}/7)`}
                  </span>
                  <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
                    <input 
                      type="file" 
                      id="import-backup-file" 
                      accept=".json" 
                      onChange={handleImportBackup} 
                      style={{ display: 'none' }} 
                    />
                    <button
                      onClick={() => document.getElementById('import-backup-file')?.click()}
                      className="btn btn-secondary"
                     
                      style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem', fontWeight: 600 }}
                    >
                      <Upload size={14} /> {language === 'RU' ? 'Импортировать' : 'Import'}
                    </button>
                    <button
                      onClick={handleCreateBackup}
                      disabled={isCreatingBackup}
                      className="btn btn-secondary"
                      style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                    >
                      {isCreatingBackup ? '...' : <><Plus size={14} /> {language === 'RU' ? 'Создать сейчас' : 'Create Now'}</>}
                    </button>
                  </div>
                </div>

                {backupsLoading ? (
                  <div style={{ padding: '1.5rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                    {language === 'RU' ? 'Загрузка...' : 'Loading...'}
                  </div>
                ) : backups.length === 0 ? (
                  <div style={{ padding: '1.25rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem', border: '1px dashed var(--surface-border)', borderRadius: 'var(--radius-md)' }}>
                    <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '0.5rem', opacity: 0.5 }}><Package size={24} /></div>
                    {language === 'RU' ? 'Бэкапов пока нет. Нажмите «Создать сейчас» или «Импортировать».' : 'No backups yet. Click "Create Now" or "Import".'}
                  </div>
                ) : (
                  backups.map((backup: any, idx: number) => (
                    <div key={backup.filename} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '0.6rem 0.85rem', borderRadius: 'var(--radius-sm)', background: idx === 0 ? 'rgba(16,185,129,0.04)' : '#fafafa', border: `1px solid ${idx === 0 ? 'rgba(16,185,129,0.15)' : 'var(--surface-border)'}` }}>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '0.1rem' }}>
                        <span style={{ fontSize: '0.85rem', fontWeight: 700, color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                          {idx === 0 && <span style={{ fontSize: '0.65rem', background: 'rgba(16,185,129,0.12)', color: 'var(--success)', padding: '0.05rem 0.3rem', borderRadius: '3px', fontWeight: 800 }}>LATEST</span>}
                          {backup.label}
                        </span>
                        <span style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                          {backup.filename} · {backup.sizeKb} KB
                        </span>
                      </div>
                      <div style={{ display: 'flex', gap: '0.35rem', alignItems: 'center' }}>
                        <button
                          onClick={() => handleDownloadBackup(backup.filename)}
                          className="btn btn-secondary"
                          style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
                          title={language === 'RU' ? 'Скачать файл бэкапа' : 'Download backup file'}
                        >
                          <Download size={14} />
                        </button>
                        <button
                          onClick={() => handleRestoreFromBackup(backup.filename, backup.label)}
                          disabled={isRestoring}
                          className="btn btn-secondary"
                          style={{ padding: '0.3rem 0.65rem', fontSize: '0.75rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.35rem' }}
                          title={language === 'RU' ? `Восстановить из ${backup.label}` : `Restore from ${backup.label}`}
                        >
                          <RefreshCw size={14} /> {language === 'RU' ? 'Восстановить' : 'Restore'}
                        </button>
                        <button
                          onClick={() => handleDeleteBackup(backup.filename)}
                          className="btn btn-secondary"
                         
                          style={{ padding: '0.3rem 0.5rem', fontSize: '0.75rem', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--error)' }}
                          title={language === 'RU' ? 'Удалить бэкап' : 'Delete backup'}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>

          {/* Card 6: System Information */}
          <div className="glass-card" style={{ padding: '1.5rem', background: '#ffffff' }}>
            <h3 style={{ margin: '0 0 1.25rem 0', fontSize: '1.15rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
              <BarChart2 size={20} /> {language === 'RU' ? 'Информация о системе' : 'System Environment'}
            </h3>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '0.85rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f5f5f5', paddingBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{language === 'RU' ? 'Текущий пользователь:' : 'Active Profile:'}</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 700 }}>{user.name} ({user.role})</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f5f5f5', paddingBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{language === 'RU' ? 'База данных:' : 'Database Engine:'}</span>
                <span style={{ fontSize: '0.85rem', fontWeight: 600 }}>Supabase (PostgreSQL)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f5f5f5', paddingBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{language === 'RU' ? 'Синхронизация WooCommerce:' : 'WooCommerce Sync:'}</span>
                <span style={{ fontSize: '0.85rem', color: 'var(--success)', fontWeight: 700 }}>● Active (dynamic)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid #f5f5f5', paddingBottom: '0.5rem' }}>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{language === 'RU' ? 'Регион по умолчанию:' : 'Locale:'}</span>
                <div style={{ display: 'flex', gap: '0.25rem' }}>
                  <button 
                    onClick={() => setLanguage('RU')} 
                    style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.1rem 0.4rem', border: '1px solid var(--surface-border)', borderRadius: '4px', background: language === 'RU' ? 'var(--primary)' : '#fff', color: language === 'RU' ? '#fff' : 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    RU
                  </button>
                  <button 
                    onClick={() => setLanguage('EN')} 
                    style={{ fontSize: '0.75rem', fontWeight: 600, padding: '0.1rem 0.4rem', border: '1px solid var(--surface-border)', borderRadius: '4px', background: language === 'EN' ? 'var(--primary)' : '#fff', color: language === 'EN' ? '#fff' : 'var(--text-muted)', cursor: 'pointer' }}
                  >
                    EN
                  </button>
                </div>
              </div>
            </div>
          </div>

        </div>

      </div>

      <style dangerouslySetInnerHTML={{ __html: `
        @media (max-width: 768px) {
          .settings-grid {
            grid-template-columns: 1fr !important;
            gap: 1.5rem !important;
          }
        }
      `}} />
    </div>
  );
}
