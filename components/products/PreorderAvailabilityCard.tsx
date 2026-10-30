'use client';

import React from 'react';
import Link from 'next/link';

export interface PreorderInfo {
  enabled: boolean;
  isTargeted: boolean;
  isAvailable: boolean;
  status: string;
  inventoryThreshold: number;
  discountType: 'none' | 'percentage' | 'fixed' | string;
  discountValue: number;
  allowHalfPayment?: boolean;
  allowFullPayment?: boolean;
  defaultPaymentOption?: string;
  customerMessage?: string;
  shippingMessage?: string;
  selectionMode?: string;
}

interface PreorderAvailabilityCardProps {
  preorder: PreorderInfo | null;
  currentStock: number;
}

export function PreorderAvailabilityCard() {
  return null;
}
