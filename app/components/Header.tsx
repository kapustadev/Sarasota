'use client';

import React, { useState, useEffect } from 'react';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLanguage } from './LanguageContext';
import { useAuth } from './AuthProvider';

export default function Header() {
  const { t, language, setLanguage } = useLanguage();
  const pathname = usePathname();
  const { user, logout } = useAuth();
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  
  // Notification states
  const [notifications, setNotifications] = useState<any[]>([]);
  const [isNotifOpen, setIsNotifOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);

  // User Menu States
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Close user dropdown menu when clicking anywhere outside of it
  useEffect(() => {
    if (!isUserMenuOpen) return;

    const handleOutsideClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest('.desktop-user-section')) {
        setIsUserMenuOpen(false);
      }
    };

    document.addEventListener('click', handleOutsideClick);
    return () => {
      document.removeEventListener('click', handleOutsideClick);
    };
  }, [isUserMenuOpen]);

  const fetchNotifications = async () => {
    try {
      const res = await fetch('/api/notifications');
      if (res.ok) {
        const data = await res.json();
        
        // Read directly from localStorage to ensure we use the absolute freshest settings
        let currentSettings = {
          enableSales: true,
          enableLowStock: true,
          enableOperations: true,
          categories: {
            FLOWER: true,
            GIFT: true,
            PACKAGING: true,
            MATERIAL: true
          }
        };

        const saved = localStorage.getItem('sarasota_notification_settings');
        if (saved) {
          try {
            currentSettings = JSON.parse(saved);
          } catch (e) {}
        }

        // Apply filters based on currentSettings
        const filtered = data.filter((n: any) => {
          if (n.type === 'NEW_SALE') {
            return currentSettings.enableSales;
          }
          if (n.type === 'OPERATIONS') {
            return currentSettings.enableOperations !== false;
          }
          if (n.type === 'LOW_STOCK') {
            if (!currentSettings.enableLowStock) return false;
            const cat = n.metadata?.category;
            if (cat && currentSettings.categories) {
              return (currentSettings.categories as any)[cat] !== false;
            }
          }
          return true;
        });

        // Set notifications and check for new ones to play chime
        setNotifications(prev => {
          // If we had notifications, and now we loaded more, play the sound!
          if (prev.length > 0 && filtered.length > prev.length) {
            const soundAlerts = localStorage.getItem('sarasota_sound_alerts') !== 'false';
            if (soundAlerts) {
              try {
                const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
                
                const osc1 = ctx.createOscillator();
                const gain1 = ctx.createGain();
                osc1.connect(gain1);
                gain1.connect(ctx.destination);
                osc1.type = 'sine';
                osc1.frequency.setValueAtTime(587.33, ctx.currentTime); // D5
                gain1.gain.setValueAtTime(0.08, ctx.currentTime);
                gain1.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.3);
                osc1.start(ctx.currentTime);
                osc1.stop(ctx.currentTime + 0.3);

                const osc2 = ctx.createOscillator();
                const gain2 = ctx.createGain();
                osc2.connect(gain2);
                gain2.connect(ctx.destination);
                osc2.type = 'sine';
                osc2.frequency.setValueAtTime(880, ctx.currentTime + 0.12); // A5
                gain2.gain.setValueAtTime(0.08, ctx.currentTime + 0.12);
                gain2.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.42);
                osc2.start(ctx.currentTime + 0.12);
                osc2.stop(ctx.currentTime + 0.42);
              } catch (soundErr) {
                console.error('Audio chime error:', soundErr);
              }
            }
          }
          return filtered;
        });

        const lastViewed = localStorage.getItem('last_notifications_viewed') || '0';
        const unread = filtered.filter((n: any) => new Date(n.createdAt).getTime() > parseInt(lastViewed)).length;
        setUnreadCount(unread);
      }
    } catch (e) {
      console.error('Error fetching notifications:', e);
    }
  };

  useEffect(() => {
    if (user) {
      fetchNotifications();
      const interval = setInterval(fetchNotifications, 45000);

      // Listen for custom 'storage' event to instantly trigger notification refetch when settings update
      const handleStorageUpdate = () => {
        fetchNotifications();
      };
      window.addEventListener('storage', handleStorageUpdate);

      return () => {
        clearInterval(interval);
        window.removeEventListener('storage', handleStorageUpdate);
      };
    }
  }, [user]);

  const handleToggleNotifications = () => {
    setIsNotifOpen(!isNotifOpen);
    if (!isNotifOpen) {
      setUnreadCount(0);
      localStorage.setItem('last_notifications_viewed', String(Date.now()));
    }
  };

  // Auto-close menus when path changes
  useEffect(() => {
    setIsMenuOpen(false);
    setIsNotifOpen(false);
  }, [pathname]);

  if (pathname === '/login') return null;

  return (
    <header className="main-header glass-panel fade-in delay-1">
      <div className="header-content">
        {/* Mobile Hamburger Button */}
        {user && (
          <button 
            className="hamburger-btn" 
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            aria-label="Toggle Menu"
            style={{ display: 'none' }}
          >
            <span style={{ fontSize: '1.5rem', lineHeight: 1 }}>{isMenuOpen ? '✕' : '☰'}</span>
          </button>
        )}

        <Link href="/" className="logo" style={{ textDecoration: 'none' }} onClick={() => setIsMenuOpen(false)}>
          <span className="logo-icon glow-pulse">🌸</span>
          <span className="logo-text">Sarasota</span>
        </Link>
        
        {user && (
          <nav className={`main-nav ${isMenuOpen ? 'open' : ''}`}>
            <Link href="/" className={`nav-item ${pathname === '/' ? 'active' : ''}`}>{t('nav.stock')}</Link>
            <Link href="/wp-products" className={`nav-item ${pathname === '/wp-products' ? 'active' : ''}`}>{t('nav.wp-products')}</Link>
            <Link href="/showcase" className={`nav-item ${pathname === '/showcase' ? 'active' : ''}`}>{t('nav.showcase')}</Link>
            <Link href="/assembly" className={`nav-item ${pathname === '/assembly' ? 'active' : ''}`}>{t('nav.assembly')}</Link>
            <Link href="/purchases" className={`nav-item ${pathname === '/purchases' ? 'active' : ''}`}>{t('nav.purchases')}</Link>
            {user.role !== 'EMPLOYEE' && (
              <>
                <Link href="/analytics" className={`nav-item ${pathname === '/analytics' ? 'active' : ''}`}>{t('nav.analytics')}</Link>
                <Link href="/expenses" className={`nav-item ${pathname === '/expenses' ? 'active' : ''}`}>{t('nav.expenses')}</Link>
              </>
            )}
            
            {/* Mobile-only user profile inside dropdown */}
            <div className="mobile-user-info" style={{ display: 'none', borderTop: '1px solid var(--surface-border)', paddingTop: '0.75rem', marginTop: '0.5rem', flexDirection: 'column', alignItems: 'center', gap: '0.5rem' }}>
              <div className="role-badge worker" style={{ fontSize: '0.75rem', width: '100%', justifyContent: 'center' }}>
                <span className="dot"></span>
                {user.name} ({user.role})
              </div>
              <Link 
                href="/settings"
                onClick={() => setIsMenuOpen(false)}
                className="btn btn-secondary"
                style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem', textDecoration: 'none' }}
              >
                ⚙️ {language === 'RU' ? 'Настройки' : 'Settings'}
              </Link>
              <button 
                onClick={logout} 
                className="btn btn-danger"
                style={{ width: '100%', padding: '0.5rem', fontSize: '0.85rem', fontWeight: 600, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.35rem' }}
              >
                🚪 {language === 'RU' ? 'Выйти' : 'Logout'}
              </button>
            </div>
          </nav>
        )}

        <div className="user-profile" style={{ display: 'flex', gap: '0.75rem', alignItems: 'center' }}>
          <div className="lang-toggle" style={{ display: 'flex', background: 'rgba(0,0,0,0.05)', borderRadius: 'var(--radius-pill)', padding: '2px' }}>
            <button 
              onClick={() => setLanguage('RU')} 
              style={{ padding: '0.2rem 0.45rem', borderRadius: 'var(--radius-pill)', fontSize: '0.7rem', fontWeight: 600, background: language === 'RU' ? '#fff' : 'transparent', boxShadow: language === 'RU' ? '0 2px 5px rgba(0,0,0,0.1)' : 'none', color: language === 'RU' ? 'black' : 'var(--text-muted)', border: 'none', cursor: 'pointer' }}
            >
              RU
            </button>
            <button 
              onClick={() => setLanguage('EN')} 
              style={{ padding: '0.2rem 0.45rem', borderRadius: 'var(--radius-pill)', fontSize: '0.7rem', fontWeight: 600, background: language === 'EN' ? '#fff' : 'transparent', boxShadow: language === 'EN' ? '0 2px 5px rgba(0,0,0,0.1)' : 'none', color: language === 'EN' ? 'black' : 'var(--text-muted)', border: 'none', cursor: 'pointer' }}
            >
              EN
            </button>
          </div>
          
          {/* Notification Bell Component */}
          {user && (
            <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
              <button 
                onClick={handleToggleNotifications}
                className="bell-btn"
                style={{ 
                  display: 'flex', 
                  alignItems: 'center', 
                  justifyContent: 'center', 
                  background: 'rgba(0,0,0,0.03)', 
                  border: '1px solid rgba(0,0,0,0.05)', 
                  borderRadius: '50%', 
                  width: '32px', 
                  height: '32px', 
                  cursor: 'pointer',
                  position: 'relative',
                  transition: 'all 0.2s ease-in-out'
                }}
                title={language === 'RU' ? 'Уведомления' : 'Notifications'}
              >
                <span style={{ fontSize: '1.15rem' }}>🔔</span>
                {unreadCount > 0 && (
                  <span 
                    className="pulse-badge" 
                    style={{ 
                      position: 'absolute', 
                      top: '-1px', 
                      right: '-1px', 
                      width: '9px', 
                      height: '9px', 
                      background: 'var(--error)', 
                      borderRadius: '50%', 
                      boxShadow: '0 0 0 2px #fff, 0 0 8px var(--error)',
                      animation: 'pulse 1.8s infinite'
                    }} 
                  />
                )}
              </button>

              {isNotifOpen && (
                <div 
                  className="notifications-dropdown"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 0.75rem)',
                    right: 0,
                    width: '320px',
                    maxHeight: '400px',
                    overflowY: 'auto',
                    zIndex: 1000,
                    padding: '0.75rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.5rem',
                    animation: 'slideDown 0.2s cubic-bezier(0.16, 1, 0.3, 1) forwards',
                    background: '#ffffff',
                    border: '1px solid var(--surface-border)',
                    boxShadow: '0 10px 30px rgba(0,0,0,0.12), 0 1px 3px rgba(0,0,0,0.05)',
                    borderRadius: 'var(--radius-xl)'
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--surface-border)', paddingBottom: '0.5rem', marginBottom: '0.25rem' }}>
                    <span style={{ fontWeight: 700, fontSize: '0.9rem', color: 'var(--text-main)' }}>
                      {language === 'RU' ? 'Уведомления' : 'Notifications'}
                    </span>
                    <button 
                      onClick={() => setIsNotifOpen(false)}
                      style={{ fontSize: '0.8rem', color: 'var(--text-muted)', cursor: 'pointer', fontWeight: 600 }}
                    >
                      {language === 'RU' ? 'Закрыть' : 'Close'}
                    </button>
                  </div>

                  {notifications.length === 0 ? (
                    <div style={{ padding: '2rem 1rem', textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.85rem' }}>
                      {language === 'RU' ? 'Нет новых уведомлений' : 'No new notifications'}
                    </div>
                  ) : (
                    notifications.map((n) => (
                      <div 
                        key={n.id}
                        style={{
                          padding: '0.65rem',
                          borderRadius: 'var(--radius-md)',
                          background: n.type === 'LOW_STOCK' ? '#fef2f2' : '#f0fdf4',
                          border: `1px solid ${n.type === 'LOW_STOCK' ? '#fee2e2' : '#dcfce7'}`,
                          display: 'flex',
                          flexDirection: 'column',
                          gap: '0.2rem',
                          textAlign: 'left'
                        }}
                      >
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontWeight: 700, fontSize: '0.8rem', color: n.type === 'LOW_STOCK' ? 'var(--error)' : 'var(--success)' }}>
                            {n.title[language]}
                          </span>
                          <span style={{ fontSize: '0.65rem', color: 'var(--text-muted)' }}>
                            {new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                          </span>
                        </div>
                        <p style={{ margin: 0, fontSize: '0.75rem', lineHeight: '1.4', color: 'var(--text-main)', textAlign: 'left' }}>
                          {n.message[language]}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>
          )}

          <style dangerouslySetInnerHTML={{ __html: `
            @keyframes pulse {
              0% { transform: scale(0.9); opacity: 1; box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); }
              70% { transform: scale(1); opacity: 1; box-shadow: 0 0 0 6px rgba(239, 68, 68, 0); }
              100% { transform: scale(0.9); opacity: 1; box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); }
            }
            .user-menu-item:hover {
              background: rgba(0,0,0,0.04);
            }
          `}} />
          
          {user ? (
            <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', position: 'relative' }} className="desktop-user-section">
              <button 
                onMouseDown={(e) => {
                  e.preventDefault();
                  e.stopPropagation();
                  setIsUserMenuOpen(!isUserMenuOpen);
                }}
                className="role-badge worker"
                style={{ 
                  cursor: 'pointer', 
                  transition: 'var(--transition)', 
                  display: 'flex', 
                  alignItems: 'center', 
                  gap: '0.5rem',
                  background: isUserMenuOpen ? 'rgba(0,0,0,0.08)' : 'rgba(0,0,0,0.05)',
                  outline: 'none',
                  border: '1px solid var(--surface-border)'
                }}
              >
                <span className="dot"></span>
                <span>{user.name} ({user.role})</span>
                <span style={{ fontSize: '0.65rem', transform: isUserMenuOpen ? 'rotate(180deg)' : 'rotate(0deg)', transition: 'transform 0.2s', opacity: 0.7 }}>▼</span>
              </button>

              {isUserMenuOpen && (
                <div 
                  className="glass-panel"
                  style={{
                    position: 'absolute',
                    top: 'calc(100% + 0.5rem)',
                    right: 0,
                    width: '180px',
                    zIndex: 1001,
                    padding: '0.5rem',
                    display: 'flex',
                    flexDirection: 'column',
                    gap: '0.25rem',
                    background: '#ffffff',
                    border: '1px solid var(--surface-border)',
                    boxShadow: '0 8px 24px rgba(0,0,0,0.1)',
                    borderRadius: 'var(--radius-md)'
                  }}
                >
                  <Link 
                    href="/settings"
                    onClick={() => setIsUserMenuOpen(false)}
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      textAlign: 'left',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      color: 'var(--text-main)',
                      transition: 'background 0.2s',
                      textDecoration: 'none'
                    }}
                    className="user-menu-item"
                  >
                    ⚙️ {language === 'RU' ? 'Настройки' : 'Settings'}
                  </Link>
                  <button 
                    onClick={logout}
                    style={{
                      width: '100%',
                      padding: '0.55rem 0.75rem',
                      textAlign: 'left',
                      fontSize: '0.85rem',
                      fontWeight: 600,
                      borderRadius: 'var(--radius-sm)',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '0.5rem',
                      color: 'var(--error)',
                      transition: 'background 0.2s'
                    }}
                    className="user-menu-item"
                  >
                    🚪 {language === 'RU' ? 'Выйти' : 'Logout'}
                  </button>
                </div>
              )}
            </div>
          ) : (
            <div className="role-badge worker">
              <span className="dot" style={{ background: 'var(--text-muted)', boxShadow: 'none' }}></span>
              Offline
            </div>
          )}
      </div>
      </div>
    </header>
  );
}
