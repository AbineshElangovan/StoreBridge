import React from 'react';

export interface CardProps {
  title?: string;
  description?: string;
  children: React.ReactNode;
  padding?: string;
  headerAction?: React.ReactNode;
}

export function Card({ title, description, children, padding, headerAction }: CardProps) {
  return (
    <div className="ys-card w-full overflow-hidden">
      {(title || description || headerAction) && (
        <div className="p-4 sm:p-5 border-b border-[var(--border-color)] flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
          <div>
            {title && <h2 className="text-base sm:text-lg font-bold text-[var(--text-primary)] m-0">{title}</h2>}
            {description && <p className="text-xs sm:text-sm text-[var(--text-secondary)] mt-1 m-0">{description}</p>}
          </div>
          {headerAction && <div className="self-start sm:self-auto shrink-0">{headerAction}</div>}
        </div>
      )}
      <div style={{ padding: padding !== undefined ? padding : undefined }} className={padding === undefined ? 'p-4 sm:p-6' : ''}>
        {children}
      </div>
    </div>
  );
}
