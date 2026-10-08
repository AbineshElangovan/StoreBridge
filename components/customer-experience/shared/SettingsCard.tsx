'use client';
import React from 'react';

export interface SettingsCardProps {
  title: string;
  description?: string;
  badge?: React.ReactNode;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export function SettingsCard({ title, description, badge, children, footer }: SettingsCardProps) {
  return (
    <div className="bg-white rounded-2xl border border-[var(--theme-border-accent,rgba(0,0,0,0.08))] shadow-xs overflow-hidden transition-all duration-200 hover:shadow-md">
      <div className="px-6 py-5 border-b border-gray-100 flex items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2.5">
            <h3 className="text-base font-bold text-gray-900 leading-snug">{title}</h3>
            {badge}
          </div>
          {description && (
            <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{description}</p>
          )}
        </div>
      </div>
      <div className="p-6 space-y-5">{children}</div>
      {footer && (
        <div className="px-6 py-4 bg-gray-50/80 border-t border-gray-100 flex items-center justify-between">
          {footer}
        </div>
      )}
    </div>
  );
}
