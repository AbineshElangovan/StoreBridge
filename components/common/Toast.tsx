"use client";

import React, { useEffect } from 'react';

export interface ToastProps {
  content: string;
  error?: boolean;
  onDismiss: () => void;
  duration?: number;
}

export function Toast({
  content,
  error = false,
  onDismiss,
  duration = 3500,
}: ToastProps) {
  useEffect(() => {
    if (duration > 0) {
      const timer = setTimeout(() => {
        onDismiss();
      }, duration);
      return () => clearTimeout(timer);
    }
  }, [duration, onDismiss]);

  return (
    <div
      style={{
        position: 'fixed',
        bottom: '24px',
        right: '24px',
        zIndex: 9999,
        backgroundColor: error ? '#dc2626' : '#16a34a',
        color: '#ffffff',
        padding: '12px 20px',
        borderRadius: '8px',
        boxShadow: '0 4px 14px rgba(0,0,0,0.18)',
        display: 'flex',
        alignItems: 'center',
        gap: '10px',
        fontSize: '14px',
        fontWeight: 500,
        animation: 'storebridgeToastSlideIn 0.3s ease-out',
        border: '1px solid rgba(255,255,255,0.2)',
      }}
    >
      <style>{`
        @keyframes storebridgeToastSlideIn {
          from { transform: translateY(40px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }
      `}</style>
      <span>{content}</span>
      <button
        type="button"
        onClick={onDismiss}
        style={{
          background: 'transparent',
          border: 'none',
          color: '#ffffff',
          cursor: 'pointer',
          marginLeft: '8px',
          fontSize: '14px',
          opacity: 0.85,
          lineHeight: 1,
          padding: 0,
        }}
        aria-label="Close"
      >
        ✕
      </button>
    </div>
  );
}
