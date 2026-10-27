"use client";
import React from 'react';
import { PolarisSelect, PolarisSelectProps } from '@/components/common/PolarisSelect';

export type SelectProps = PolarisSelectProps;

export function Select(props: SelectProps) {
  return (
    <PolarisSelect {...props} />
  );
}
