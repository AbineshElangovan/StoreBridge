import React from 'react';
import { Card } from './Card';

export interface ChartCardProps {
  title?: string;
  description?: string;
  headerAction?: React.ReactNode;
  height?: string | number;
  children: React.ReactNode;
  className?: string;
}

export function ChartCard({ title, description, headerAction, height, children, className = '' }: ChartCardProps) {
  return (
    <Card title={title} description={description} headerAction={headerAction} padding="24px" className={className}>
      <div className="w-full min-w-0 overflow-hidden flex-1 flex flex-col" style={{ minHeight: height || '300px' }}>
        {children}
      </div>
    </Card>
  );
}
