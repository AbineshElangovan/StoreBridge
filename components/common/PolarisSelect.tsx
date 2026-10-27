'use client';

import React from 'react';
import { Select } from '@shopify/polaris';

export interface PolarisSelectOption {
  label: string;
  value: string;
  disabled?: boolean;
}

export interface PolarisSelectProps {
  label?: string;
  labelHidden?: boolean;
  options: (string | PolarisSelectOption)[];
  value: string;
  onChange: (selected: string) => void;
  placeholder?: string;
  disabled?: boolean;
  helpText?: React.ReactNode;
  error?: string | boolean;
  className?: string;
}

export function PolarisSelect({
  label = '',
  labelHidden = true,
  options,
  value,
  onChange,
  placeholder,
  disabled = false,
  helpText,
  error,
  className = '',
}: PolarisSelectProps) {
  return (
    <div className={`polaris-select-common w-full text-left ${className}`}>
      <Select
        label={label}
        labelHidden={labelHidden}
        options={options}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        disabled={disabled}
        helpText={helpText}
        error={error}
      />
    </div>
  );
}
