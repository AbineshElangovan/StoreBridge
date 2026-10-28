'use client';
import React from 'react';
import { Icon } from '@shopify/polaris';

export interface StatCardProps {
  label: string;
  description?: string;
  value: string;
  icon?: React.ComponentProps<typeof Icon>['source'];
  gradient: string;        // CSS gradient string
  iconBg?: string;          // icon circle bg (defaults to rgba(255,255,255,0.2))
}

export function StatCard({
  label,
  description,
  value,
  icon,
  gradient,

  iconBg = 'rgba(255,255,255,0.2)',
}: StatCardProps) {
  return (
    <div
      style={{
        background: gradient,
        borderRadius: '14px',
        padding: '22px 20px',
        boxShadow: '0 4px 16px rgba(0,0,0,0.12)',
        color: '#fff',
        transition: 'transform 0.2s ease, box-shadow 0.2s ease',
        cursor: 'default',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
      }}
      className="ys-stat-card group cursor-pointer select-none"
    >
      <style>{`
        .ys-stat-card {
          transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        }
        .ys-stat-card:hover {
          transform: translateY(-5px);
          box-shadow: 0 16px 32px rgba(0,0,0,0.22) !important;
        }
        .ys-stat-card:hover .ys-stat-val {
          transform: scale(1.08);
          text-shadow: 0 2px 10px rgba(255,255,255,0.4);
        }
        .ys-stat-card:hover .ys-stat-label {
          opacity: 1;
          letter-spacing: 0.08em;
        }
        .ys-stat-card:hover .ys-stat-icon {
          transform: scale(1.12) rotate(6deg);
        }
      `}</style>

      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
        <div>
          <p
            className="ys-stat-label"
            style={{
              fontSize: '0.78rem',
              fontWeight: 600,
              opacity: 0.85,
              margin: 0,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
              transition: 'all 0.3s ease',
            }}
          >
            {label}
          </p>
          {description && (
            <p style={{ fontSize: '0.72rem', opacity: 0.75, margin: '3px 0 0', maxWidth: '160px', transition: 'opacity 0.3s ease' }}>
              {description}
            </p>
          )}
        </div>
        {icon && (
          <div
            className="ys-stat-icon"
            style={{
              width: 46,
              height: 46,
              borderRadius: '50%',
              backgroundColor: iconBg,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              flexShrink: 0,
              transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
            }}
          >
            <Icon source={icon} />
          </div>
        )}
      </div>

      {/* Value */}
      <div>
        <p
          className="ys-stat-val"
          style={{
            fontSize: '2rem',
            fontWeight: 800,
            margin: 0,
            lineHeight: 1,
            display: 'inline-block',
            transformOrigin: 'left bottom',
            transition: 'transform 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          }}
        >
          {value}
        </p>
      </div>
    </div>
  );
}
