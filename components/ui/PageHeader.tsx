import React from 'react';

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  children?: React.ReactNode;
  className?: string;
}

/**
 * Standardized PageHeader component ensuring consistent typography hierarchy across all pages:
 * - Title: <h1> tag, bold text-2xl sm:text-3xl text-gray-900 tracking-tight
 * - Subtitle: <h3> tag, text-sm font-normal text-gray-500
 */
export function PageHeader({ title, subtitle, children, className = '' }: PageHeaderProps) {
  return (
    <div className={`flex flex-col sm:flex-row sm:items-center justify-between gap-4 ${className}`}>
      <div>
        <h1 className="page-title text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight m-0">
          {title}
        </h1>
        {subtitle && (
          <p className="page-subtitle text-lg sm:text-xl font-medium text-slate-500 mt-1.5 m-0">
            {subtitle}
          </p>
        )}
      </div>
      {children && (
        <div className="flex items-center gap-3 flex-wrap">
          {children}
        </div>
      )}
    </div>
  );
}

export default PageHeader;
