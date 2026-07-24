import type { Metadata } from "next";
import { Inter, Outfit } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "./components/LanguageContext";
import { AuthProvider } from "./components/AuthProvider";
import Header from "./components/Header";

const inter = Inter({ subsets: ["latin", "cyrillic"] });
const outfit = Outfit({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Sarasota Flowers - Dashboard",
  description: "Advanced warehouse accounting and bouquet assembly system",
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="ru">
      <head>
        <script dangerouslySetInnerHTML={{ __html: `
          (function() {
            try {
              const theme = localStorage.getItem('sarasota_theme') || 'light';
              document.documentElement.setAttribute('data-theme', theme);
            } catch (e) {}
          })();
        `}} />
      </head>
      <body className={inter.className}>
        <LanguageProvider>
          <AuthProvider>
            <div className="layout-wrapper">
              <Header />
              <main className="main-content container fade-in delay-2">
                {children}
              </main>
            </div>
          </AuthProvider>
        </LanguageProvider>
        <style dangerouslySetInnerHTML={{ __html: `
          .layout-wrapper { display: flex; flex-direction: column; min-height: 100vh; position: relative; z-index: 1; }
          
          .main-header { position: sticky; top: 1.5rem; z-index: 100; margin: 0 auto 3rem auto; max-width: 1200px; width: calc(100% - 3rem); padding: 0.6rem 1rem; }
          .container { width: 100%; max-width: 1200px; margin: 0 auto; padding: 0 1.5rem; }
          
          .header-content { display: flex; align-items: center; justify-content: space-between; padding: 0; }
          .logo { display: flex; align-items: center; gap: 0.75rem; font-family: 'Outfit', sans-serif; font-weight: 800; font-size: 1.35rem; letter-spacing: -0.03em; color: var(--text-main); padding-left: 0.5rem; }
          .logo-icon.glow-pulse { border-radius: 50%; }
          
          .main-nav { display: flex; align-items: center; gap: 0.25rem; background: rgba(0,0,0,0.03); padding: 0.35rem; border-radius: var(--radius-pill); border: 1px solid rgba(0,0,0,0.05); }
          .nav-item { font-size: 0.9rem; font-weight: 500; color: var(--text-muted); padding: 0.45rem 1.25rem; border-radius: var(--radius-pill); transition: var(--transition-bounce); }
          .nav-item:hover { color: var(--text-main); background: rgba(0,0,0,0.05); }
          .nav-item.active { color: var(--text-main); background: #fff; box-shadow: 0 2px 5px rgba(0,0,0,0.05); }
          
          .user-profile { display: flex; align-items: center; padding-right: 0.5rem; }
          .role-badge { display: flex; align-items: center; gap: 0.5rem; padding: 0.45rem 1rem; border-radius: var(--radius-pill); font-size: 0.75rem; font-weight: 700; text-transform: uppercase; background: rgba(0,0,0,0.05); border: 1px solid var(--surface-border); font-family: 'Outfit', sans-serif;}
          .role-badge .dot { width: 8px; height: 8px; border-radius: 50%; background: var(--success); box-shadow: 0 0 5px var(--success); }
          
          .main-content { flex: 1; padding-bottom: 4rem; }
          
          @media (min-width: 769px) and (max-width: 1150px) {
            .logo-text { display: none; }
            .main-header {
              width: calc(100% - 1.5rem);
              margin-bottom: 2rem;
              padding: 0.5rem 0.75rem;
            }
            .nav-item {
              padding: 0.4rem 0.65rem;
              font-size: 0.78rem;
            }
            .role-badge {
              padding: 0.4rem 0.7rem;
              font-size: 0.7rem;
            }
            .main-nav {
              gap: 0.1rem;
            }
          }
          
          @media (max-width: 768px) {
            .header-content {
              display: flex;
              align-items: center;
              justify-content: space-between;
              position: relative;
              width: 100%;
              padding: 0 0.5rem;
            }
            .logo {
              position: absolute;
              left: 50%;
              transform: translateX(-50%);
              display: flex;
              align-items: center;
              gap: 0.4rem;
              z-index: 10;
            }
            .logo-text {
              display: inline !important; /* Force text to appear on mobile! */
              font-size: 1.2rem;
            }
            .hamburger-btn {
              display: flex !important;
              align-items: center;
              justify-content: center;
              background: rgba(0,0,0,0.03);
              border: 1px solid rgba(0,0,0,0.05);
              border-radius: 50%;
              width: 36px;
              height: 36px;
              cursor: pointer;
              z-index: 102;
              color: var(--text-main);
              padding: 0;
              transition: all 0.2s;
            }
            .hamburger-btn:hover {
              background: rgba(0,0,0,0.08);
            }
            .user-profile {
              margin-left: auto;
              gap: 0.5rem !important;
            }
            .desktop-user-section {
              display: none !important;
            }
            .main-nav {
              display: none !important;
              position: absolute;
              top: calc(100% + 0.75rem);
              left: 0;
              width: 100%;
              background: rgba(255, 255, 255, 0.98);
              backdrop-filter: blur(20px);
              -webkit-backdrop-filter: blur(20px);
              box-shadow: var(--shadow-lg), 0 20px 25px -5px rgba(0,0,0,0.1);
              border-radius: var(--radius-lg);
              border: 1px solid var(--surface-border);
              flex-direction: column;
              padding: 0.75rem;
              gap: 0.35rem !important;
              z-index: 999;
              margin: 0;
            }
            .main-nav.open {
              display: flex !important;
              animation: slideDown 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards;
            }
            .mobile-user-info {
              display: flex !important;
            }
            .nav-item {
              width: 100%;
              text-align: center;
              padding: 0.65rem 1rem !important;
              font-size: 0.95rem !important;
              border-radius: var(--radius-md) !important;
              margin: 0 !important;
            }
            .main-header {
              padding: 0.5rem;
              width: 100%;
              margin: 0 0 1rem 0;
              border-radius: 0;
              top: 0;
              position: sticky;
            }
            
            @keyframes slideDown {
              from { opacity: 0; transform: translateY(-10px); }
              to { opacity: 1; transform: translateY(0); }
            }
          }
        `}} />
      </body>
    </html>
  );
}
