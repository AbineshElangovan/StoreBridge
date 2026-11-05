'use client';
import React from 'react';

export interface PageHeaderProps {
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  badge?: React.ReactNode;
  actions?: React.ReactNode;
  children?: React.ReactNode;
  bordered?: boolean;
  className?: string;
}

/**
 * Standardized PageHeader component ensuring consistent typography and hierarchy across all pages.
 * Supports title, subtitle, optional badge, action buttons/components, and a clean divider line.
 */
export function PageHeader({
  title,
  subtitle,
  badge,
  actions,
  children,
  bordered = true,
  className = '',
}: PageHeaderProps) {
  return (
    <div
      className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${
        bordered ? 'pb-6 border-b border-gray-200' : ''
      } ${className}`}
    >
      <div className="min-w-0">
        <div className="flex items-center gap-3 flex-wrap">
          <h1 className="page-title text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight m-0">
            {title}
          </h1>
          {badge && <div className="flex items-center">{badge}</div>}
        </div>
        {subtitle && (
          <p className="page-subtitle text-lg sm:text-xl font-medium text-slate-500 mt-1.5 m-0">
            {subtitle}
          </p>
        )}
      </div>
      {(actions || children) && (
        <div className="flex items-center gap-3 flex-wrap flex-shrink-0">
          {actions}
          {children}
        </div>
      )}
    </div>
  );
}

export default PageHeader;
