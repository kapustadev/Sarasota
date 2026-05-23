'use client';

import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';

interface ModalProps {
  isOpen: boolean;
  onClose: () => void;
  children: React.ReactNode;
  title?: string;
  maxWidth?: string;
}

export default function Modal({ isOpen, onClose, children, title, maxWidth = '440px' }: ModalProps) {
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    if (isOpen) {
      document.body.style.overflow = 'hidden';
    } else {
      document.body.style.overflow = '';
    }
    return () => {
      document.body.style.overflow = '';
    };
  }, [isOpen]);

  if (!mounted || !isOpen) return null;

  return createPortal(
    <div className="modal-portal-overlay" onClick={onClose}>
      <div className="modal-portal-content glass-panel" onClick={e => e.stopPropagation()} style={{ maxWidth }}>
        {title && (
          <div className="modal-portal-header">
            <h3>{title}</h3>
            <button className="modal-close-icon" onClick={onClose}>×</button>
          </div>
        )}
        <div className="modal-portal-body">
          {children}
        </div>
      </div>
      <style jsx>{`
        .modal-portal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.45);
          backdrop-filter: blur(12px);
          -webkit-backdrop-filter: blur(12px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10000;
          animation: modalFadeIn 0.3s ease-out forwards;
        }

        .modal-portal-content {
          width: 90%;
          background: #fff;
          border-radius: var(--radius-xl);
          box-shadow: 0 40px 100px rgba(0, 0, 0, 0.4);
          border: 1px solid var(--surface-border);
          position: relative;
          padding: 2.5rem;
          animation: modalPopup 0.4s cubic-bezier(0.34, 1.56, 0.64, 1) forwards;
        }

        .modal-portal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 1.5rem;
        }

        .modal-close-icon {
          font-size: 1.5rem;
          color: var(--text-muted);
          transition: var(--transition);
          line-height: 1;
        }
        .modal-close-icon:hover {
          color: var(--text-main);
          transform: rotate(90deg);
        }

        @keyframes modalFadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        @keyframes modalPopup {
          from { opacity: 0; transform: scale(0.95) translateY(20px); }
          to { opacity: 1; transform: scale(1) translateY(0); }
        }

        .modal-portal-body {
          display: flex;
          flex-direction: column;
          gap: 1.5rem;
        }
      `}</style>
    </div>,
    document.body
  );
}
