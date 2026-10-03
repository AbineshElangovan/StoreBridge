"use client";

import React, { useEffect } from 'react';
import { Icon } from '@shopify/polaris';
import { XIcon } from '@shopify/polaris-icons';

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
          opacity: 0.85,
          padding: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: '16px',
          height: '16px',
        }}
        aria-label="Close"
      >
        <span style={{ width: '14px', height: '14px', display: 'flex', alignItems: 'center' }}>
          <Icon source={XIcon} tone="inherit" />
        </span>
      </button>
    </div>
  );
}
