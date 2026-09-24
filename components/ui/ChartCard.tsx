import React from 'react';
import { Card } from './Card';

export interface ChartCardProps {
  title?: string;
  description?: string;
  headerAction?: React.ReactNode;
  height?: string | number;
  children: React.ReactNode;
}

export function ChartCard({ title, description, headerAction, height, children }: ChartCardProps) {
  return (
    <Card title={title} description={description} headerAction={headerAction} padding="24px">
      <div style={{ width: '100%', minHeight: height || '300px' }}>
        {children}
      </div>
    </Card>
  );
}
