'use client';
import React from 'react';
import { Icon } from '@shopify/polaris';

export interface StatCardProps {
  title: string;
  value: string | number;
  description?: string;
  icon?: React.ComponentProps<typeof Icon>['source'];
  color?: 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'purple';
  loading?: boolean;
  compact?: boolean;
}

export function StatCard({ title, value, description, icon, color = 'primary', loading, compact = false }: StatCardProps) {
  const colorMap = {
    primary: { bg: 'var(--color-primary-light)', text: 'var(--color-primary-dark)' },
    success: { bg: '#dcfce7', text: 'var(--color-success)' },
    warning: { bg: '#fef3c7', text: 'var(--color-warning)' },
    danger: { bg: '#fee2e2', text: 'var(--color-danger)' },
    info: { bg: '#dbeafe', text: 'var(--color-info)' },
    purple: { bg: '#f3e8ff', text: '#7e22ce' },
  };

  const theme = colorMap[color] || colorMap.primary;

  return (
    <div
      className="ys-card"
      style={{
        padding: compact ? '16px' : '24px',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        gap: compact ? '10px' : '16px',
        height: '100%',
        minHeight: compact ? '120px' : '140px',
        transition: 'box-shadow 0.2s ease, transform 0.2s ease',
      }}
      onMouseEnter={(e) => {
        e.currentTarget.style.transform = 'translateY(-2px)';
        e.currentTarget.style.boxShadow = '0 8px 30px rgba(0,0,0,0.08)';
      }}
      onMouseLeave={(e) => {
        e.currentTarget.style.transform = 'none';
        e.currentTarget.style.boxShadow = 'var(--shadow-card)';
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '8px' }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <h3
            style={{
              color: 'var(--text-secondary)',
              fontSize: compact ? '0.8125rem' : '0.875rem',
              fontWeight: 600,
              margin: 0,
              whiteSpace: 'nowrap',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
            }}
            title={title}
          >
            {title}
          </h3>
          {description && (
            <p
              style={{
                color: 'var(--text-secondary)',
                fontSize: compact ? '0.7rem' : '0.75rem',
                marginTop: '3px',
                lineHeight: 1.3,
                opacity: 0.85,
              }}
            >
              {description}
            </p>
          )}
        </div>

        {icon && (
          <div
            style={{
              backgroundColor: theme.bg,
              color: theme.text,
              width: compact ? '32px' : '40px',
              height: compact ? '32px' : '40px',
              borderRadius: 'var(--radius-sm)',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
            }}
          >
            <Icon source={icon} tone="base" />
          </div>
        )}
      </div>

      <div>
        {loading ? (
          <div
            style={{
              height: compact ? '28px' : '36px',
              width: '60%',
              backgroundColor: 'var(--bg-hover)',
              borderRadius: 'var(--radius-sm)',
            }}
            className="animate-pulse"
          />
        ) : (
          <p
            style={{
              color: 'var(--text-primary)',
              fontSize: compact ? '1.5rem' : '2rem',
              fontWeight: 800,
              margin: 0,
              lineHeight: 1,
              letterSpacing: '-0.02em',
            }}
          >
            {value}
          </p>
        )}
      </div>
    </div>
  );
}
