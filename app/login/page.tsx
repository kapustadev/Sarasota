'use client';

import { useState } from 'react';
import { useAuth } from '../components/AuthProvider';

export default function LoginPage() {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);
  const { login } = useAuth();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });

      const data = await res.json();
      
      if (!res.ok) {
        setError(data.error || 'Ошибка входа');
      } else {
        login(data.user);
      }
    } catch (e) {
      setError('Ошибка сети. Проверьте подключение.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container fade-in">
      <div className="login-card glass-card">
        <div className="login-header">
          <div className="logo-icon">🌿</div>
          <h1>Sarasota Flowers</h1>
          <p>Вход в систему управления</p>
        </div>

        <form onSubmit={handleLogin} className="login-form">
          {error && <div className="error-message">{error}</div>}
          
          <div className="form-group">
            <label>Логин</label>
            <input 
              type="text" 
              className="input-field" 
              placeholder="Введите ваш логин"
              value={username}
              onChange={e => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Пароль</label>
            <input 
              type="password" 
              className="input-field" 
              placeholder="Введите ваш пароль"
              value={password}
              onChange={e => setPassword(e.target.value)}
              required
            />
          </div>

          <button type="submit" className="btn btn-primary w-full" disabled={loading}>
            {loading ? 'Вход...' : 'Войти'}
          </button>
        </form>
      </div>

      <style jsx>{`
        .login-container { min-height: 100vh; display: flex; align-items: center; justify-content: center; background: var(--bg-deep); padding: 1rem; }
        .login-card { width: 100%; max-width: 400px; padding: 2.5rem; display: flex; flex-direction: column; gap: 2rem; background: #fff; box-shadow: var(--shadow-lg); }
        
        .login-header { text-align: center; }
        .logo-icon { font-size: 3rem; margin-bottom: 0.5rem; }
        .login-header h1 { font-family: 'Outfit', sans-serif; font-size: 1.8rem; color: var(--text-main); font-weight: 700; margin-bottom: 0.25rem; }
        .login-header p { color: var(--text-muted); font-size: 0.9rem; }
        
        .login-form { display: flex; flex-direction: column; gap: 1.25rem; }
        .form-group { display: flex; flex-direction: column; gap: 0.5rem; }
        .form-group label { font-size: 0.85rem; font-weight: 600; color: var(--text-muted); text-transform: uppercase; letter-spacing: 0.05em; }
        
        .error-message { background: hsla(0, 80%, 50%, 0.1); color: var(--error); padding: 0.75rem; border-radius: var(--radius-sm); font-size: 0.85rem; font-weight: 600; text-align: center; border: 1px solid hsla(0, 80%, 50%, 0.2); }
        
        .w-full { width: 100%; padding: 0.85rem; font-size: 1rem; margin-top: 0.5rem;}
      `}</style>
    </div>
  );
}
