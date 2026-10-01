import React from 'react';

export const ThemedSection = ({
  title,
  description,
  bgColor,
  borderColor,
  stripeColor,
  titleColor,
  descColor,
  children
}: {
  title: string;
  description?: string;
  bgColor?: string;
  borderColor?: string;
  stripeColor?: string;
  titleColor?: string;
  descColor?: string;
  children: React.ReactNode;
}) => (
  <div
    className="w-full p-4 sm:p-6 rounded-xl sm:rounded-2xl transition-all"
    style={{
      backgroundColor: bgColor || 'var(--theme-card-bg, rgba(255, 255, 255, 0.95))',
      border: `1px solid ${borderColor || 'var(--border-color, #e2e8f0)'}`,
      boxShadow: '0 4px 6px -1px rgba(0, 0, 0, 0.05)'
    }}
  >
    <div
      className="mb-4 sm:mb-5 pl-3 border-l-4"
      style={{ borderLeftColor: stripeColor || 'var(--color-primary, #047857)' }}
    >
      <h2
        className="text-base sm:text-lg md:text-xl font-bold tracking-tight m-0"
        style={{ color: titleColor || 'var(--color-primary-dark, #022c22)' }}
      >
        {title}
      </h2>
      {description && (
        <p
          className="mt-1 text-xs sm:text-sm leading-relaxed m-0"
          style={{ color: descColor || 'var(--text-secondary, #64748b)' }}
        >
          {description}
        </p>
      )}
    </div>
    {children}
  </div>
);
