'use client';

import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { shopifyFetch } from '@/lib/shopify/Client';
import { Loading } from '@/components/common/Loading';
import { Toast } from '@/components/common/Toast';
import { Table, ColumnConfig } from '@/components/common/Table';
import { useTheme } from '@/components/providers/ThemeContext';
import { getProductUrl } from '@/lib/utils/productUrl';
import {
  SettingsCard,
  SettingsToggle,
  SettingsInput,
  SettingsTextarea,
  SaveButton,
  PreviewCard,
} from '@/components/customer-experience/shared';
import { PreorderProductSelector } from '@/components/preorder/PreorderProductSelector';
import { PreorderCollectionSelector } from '@/components/preorder/PreorderCollectionSelector';
import { PreorderCountdownTimerCard } from '@/components/preorder/PreorderCountdownTimerCard';
import { StandaloneGuard } from '@/components/ui/StandaloneGuard';
import { useStoreContext } from '@/components/providers/StoreProvider';
import { PageTabs, PageTab } from '@/components/ui/PageTabs';
import { PageHeader } from '@/components/ui/PageHeader';
import { PolarisSelect, RefreshButton } from '@/components/common';
import { PreorderPerformanceCard } from '@/components/dashboard/PreorderPerformanceCard';
import { APP_NAME } from '@/lib/constants/app';
import type { PreorderMetrics } from '@/services/preorder/preorder-service';

export type PreorderTabId = 'general' | 'offers_payment' | 'status_timer' | 'orders';

function toDatetimeLocalString(dateStr?: string | Date | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  const year = d.getFullYear();
  const month = pad(d.getMonth() + 1);
  const day = pad(d.getDate());
  const hours = pad(d.getHours());
  const minutes = pad(d.getMinutes());
  return `${year}-${month}-${day}T${hours}:${minutes}`;
}

function formatHumanDateTime(dateStr?: string | Date | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

function DateTimePicker({
  label,
  value,
  onChange,
  primaryColor,
}: {
  label?: string;
  value: string;
  onChange: (val: string) => void;
  primaryColor?: string;
}) {
  const datePart = value ? value.split('T')[0] : '';
  const timePart = value && value.includes('T') ? value.split('T')[1].slice(0, 5) : '12:00';

  const handleDateChange = (newDate: string) => {
    if (!newDate) {
      onChange('');
      return;
    }
    onChange(`${newDate}T${timePart || '12:00'}`);
  };

  const handleTimeChange = (newTime: string) => {
    const today = new Date().toISOString().split('T')[0];
    const d = datePart || today;
    onChange(`${d}T${newTime || '12:00'}`);
  };

  return (
    <div className="space-y-1.5">
      {label && <label className="block text-xs font-bold text-gray-700">{label}</label>}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
        <div>
          <span className="block text-[10px] font-semibold text-gray-400 mb-0.5">Date</span>
          <input
            type="date"
            value={datePart}
            onChange={(e) => handleDateChange(e.target.value)}
            className="w-full px-3 py-1.5 text-xs font-medium text-gray-900 bg-white border border-gray-300 rounded-lg shadow-2xs focus:ring-1 focus:outline-none cursor-pointer"
            style={{ borderColor: primaryColor }}
          />
        </div>
        <div>
          <span className="block text-[10px] font-semibold text-gray-400 mb-0.5">Time</span>
          <input
            type="time"
            value={timePart}
            onChange={(e) => handleTimeChange(e.target.value)}
            className="w-full px-3 py-1.5 text-xs font-medium text-gray-900 bg-white border border-gray-300 rounded-lg shadow-2xs focus:ring-1 focus:outline-none cursor-pointer"
            style={{ borderColor: primaryColor }}
          />
        </div>
      </div>
      {value && (
        <p className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-1 rounded-md flex items-center gap-1.5">
          <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
          Scheduled: {formatHumanDateTime(value)}
        </p>
      )}
    </div>
  );
}

function ProductThumbnail({ src, alt, href }: { src?: string | null; alt?: string; href?: string }) {
  const [hasError, setHasError] = useState(false);

  const content = (!src || hasError) ? (
    <div className="w-10 h-10 rounded-lg bg-slate-100 border border-slate-200 flex items-center justify-center shrink-0 text-slate-400">
      <svg className="w-5 h-5 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
      </svg>
    </div>
  ) : (
    <img
      src={src}
      alt={alt || 'Product'}
      className="w-10 h-10 rounded-lg object-cover border border-slate-200 shrink-0 bg-slate-50 shadow-xs"
      onError={() => setHasError(true)}
    />
  );

  if (href) {
    return (
      <Link href={href} className="shrink-0 transition-transform duration-150 hover:scale-105 active:scale-95 cursor-pointer block" title="View product details">
        {content}
      </Link>
    );
  }
  return content;
}

export default function PreorderAdminPage() {
  const { isStandalone, currentStore } = useStoreContext();
  const { currentTheme } = useTheme();
  const primaryColor = currentTheme?.primaryColor || '#047857';
  const accentColor = currentTheme?.accentColor || '#d1fae5';
  const darkColor = currentTheme?.darkColor || '#022c22';
  const isLimeTheme = currentTheme?.id === 'emerald_forest';
  const buttonTextColor = isLimeTheme ? '#142403' : '#ffffff';

  // Navigation tab state: 1. Setup & Products, 2. Offer & Payment, 3. Pre-order Orders
  const [activeTab, setActiveTab] = useState<PreorderTabId>('general');

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  // Selection Mode State (Specific Product, Collection-Based, All Products)
  const [selectionMode, setSelectionMode] = useState<'ALL_PRODUCTS' | 'SPECIFIC_PRODUCTS' | 'COLLECTIONS'>('ALL_PRODUCTS');
  const [selectedProductIds, setSelectedProductIds] = useState<string[]>([]);
  const [selectedCollectionIds, setSelectedCollectionIds] = useState<string[]>([]);

  // Form State
  const [enabled, setEnabled] = useState(true);
  const [inventoryThreshold, setInventoryThreshold] = useState('0');
  const [customerMessage, setCustomerMessage] = useState("Pre-order before it's gone.");
  const [shippingMessage, setShippingMessage] = useState('Shipping: As soon as possible');
  const [fulfillmentMessage, setFulfillmentMessage] = useState(
    'We will fulfill the item as soon as it becomes available'
  );
  const [maxQuantity, setMaxQuantity] = useState<string>('');

  // Payment Options State (Full Payment vs Half Payment)
  const [paymentType, setPaymentType] = useState<'FULL' | 'HALF'>('HALF');
  const [allowHalfPayment, setAllowHalfPayment] = useState(true);
  const [allowFullPayment, setAllowFullPayment] = useState(true);
  const [defaultPaymentOption, setDefaultPaymentOption] = useState<'HALF' | 'FULL'>('HALF');
  const [showSavings, setShowSavings] = useState(true);

  // Offer / Discount State
  const [discountType, setDiscountType] = useState<'none' | 'percentage' | 'fixed'>('none');
  const [discountValue, setDiscountValue] = useState<string>('0');
  const [calculation, setCalculation] = useState<any>(null);
  const [sample100, setSample100] = useState<any>(null);
  const [calculating, setCalculating] = useState(false);

  // Status & Scheduling State (End date / Deadline only)
  const [statusScheduleType, setStatusScheduleType] = useState<
    'AVAILABLE_NOW' | 'UNTIL_END_DATE' | 'NOT_AVAILABLE'
  >('AVAILABLE_NOW');
  const [endDate, setEndDate] = useState<string>('');

  // Countdown Timer State (End date / Deadline only)
  const [showTimer, setShowTimer] = useState(false);
  const [timerDisplayMode, setTimerDisplayMode] = useState<'BEFORE_PREORDER' | 'WHILE_PREORDER' | 'BOTH'>('WHILE_PREORDER');
  const [timerDateMode, setTimerDateMode] = useState<'USE_STATUS_DATE' | 'CUSTOM_DATES'>('USE_STATUS_DATE');
  const [timerCustomDate, setTimerCustomDate] = useState<string>('');
  const [timerHeadingStart, setTimerHeadingStart] = useState('Pre-order opening soon');
  const [timerHeadingEnd, setTimerHeadingEnd] = useState('Hurry up! Pre-order ending soon');
  const [timerTextColor, setTimerTextColor] = useState('#000000');
  const [timerBgColor, setTimerBgColor] = useState('#fee2e2');
  const [timerTextColorEnd, setTimerTextColorEnd] = useState('#000000');
  const [timerBgColorEnd, setTimerBgColorEnd] = useState('#fee2e2');
  const [timerBorderRadius, setTimerBorderRadius] = useState<string>('8');
  const [timerShowDays, setTimerShowDays] = useState(true);
  const [timerShowHours, setTimerShowHours] = useState(true);
  const [timerShowMinutes, setTimerShowMinutes] = useState(true);
  const [timerShowSeconds, setTimerShowSeconds] = useState(true);
  const [timerDaysLabel, setTimerDaysLabel] = useState('Days');
  const [timerHoursLabel, setTimerHoursLabel] = useState('Hours');
  const [timerMinutesLabel, setTimerMinutesLabel] = useState('Mins');
  const [timerSecondsLabel, setTimerSecondsLabel] = useState('Secs');
  const [hideStyling, setHideStyling] = useState(false);

  // Track saved snapshot to detect old vs new preorder setting changes
  const [savedSnapshot, setSavedSnapshot] = useState<string>('');

  const buildSnapshotFromCurrent = () => {
    return JSON.stringify({
      enabled: Boolean(enabled),
      inventoryThreshold: String(inventoryThreshold ?? 0),
      selectionMode: selectionMode || 'ALL_PRODUCTS',
      selectedProductIds: [...selectedProductIds].sort(),
      selectedCollectionIds: [...selectedCollectionIds].sort(),
      paymentType,
      allowHalfPayment: Boolean(allowHalfPayment),
      allowFullPayment: Boolean(allowFullPayment),
      discountType: discountType || 'none',
      discountValue: String(discountValue ?? 0),
      customerMessage: customerMessage || '',
      shippingMessage: shippingMessage || '',
      fulfillmentMessage: fulfillmentMessage || '',
      statusScheduleType: statusScheduleType || 'AVAILABLE_NOW',
      endDate: endDate || '',
      showTimer: Boolean(showTimer),
      timerDateMode: timerDateMode || 'USE_STATUS_DATE',
      timerCustomDate: timerCustomDate || '',
      timerHeadingEnd: timerHeadingEnd || '',
      timerTextColorEnd: timerTextColorEnd || '',
      timerBgColorEnd: timerBgColorEnd || '',
      timerBorderRadius: String(timerBorderRadius ?? 8),
      timerShowDays: timerShowDays !== false,
      timerShowHours: timerShowHours !== false,
      timerShowMinutes: timerShowMinutes !== false,
      timerShowSeconds: timerShowSeconds !== false,
      timerDaysLabel: timerDaysLabel || '',
      timerHoursLabel: timerHoursLabel || '',
      timerMinutesLabel: timerMinutesLabel || '',
      timerSecondsLabel: timerSecondsLabel || '',
    });
  };

  const isDirty = Boolean(savedSnapshot && buildSnapshotFromCurrent() !== savedSnapshot);

  // Keep endDate synced with custom date if provided
  useEffect(() => {
    if (!endDate && timerCustomDate) {
      setEndDate(timerCustomDate);
    }
  }, [timerCustomDate, endDate]);

  // Pre-order Orders Records State
  const [records, setRecords] = useState<any[]>([]);
  const [recordsLoading, setRecordsLoading] = useState(false);
  const [recordsPage, setRecordsPage] = useState(1);
  const [recordsTotalPages, setRecordsTotalPages] = useState(1);
  const [recordsTotal, setRecordsTotal] = useState(0);
  const [recordsSearch, setRecordsSearch] = useState('');
  const [recordsStatus, setRecordsStatus] = useState('ALL');
  const [preorderMetrics, setPreorderMetrics] = useState<PreorderMetrics | null>(null);

  useEffect(() => {
    fetchConfig();
    fetchRecords(1, '', 'ALL');
  }, [currentStore?.shopDomain]);

  // Fetch pure calculations from backend API whenever discount settings change
  useEffect(() => {
    let active = true;
    const timer = setTimeout(async () => {
      try {
        setCalculating(true);
        const val = parseFloat(discountValue) || 0;
        const shopParam = currentStore?.shopDomain ? `&shop=${encodeURIComponent(currentStore.shopDomain)}` : '';
        const res = await shopifyFetch(
          `/api/preorder?action=calculate&basePrice=1240&discountType=${discountType}&discountValue=${val}${shopParam}`
        );
        const data = await res.json();
        if (active && data.success) {
          setCalculation(data.calculation);
          setSample100(data.sample100);
        }
      } catch (e) {
        console.warn('API calculation error:', e);
      } finally {
        if (active) setCalculating(false);
      }
    }, 200);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [discountType, discountValue, currentStore?.shopDomain]);

  // Debounced search for Pre-order orders
  useEffect(() => {
    const timer = setTimeout(() => {
      fetchRecords(1, recordsSearch, recordsStatus);
    }, 300);
    return () => clearTimeout(timer);
  }, [recordsSearch, recordsStatus]);

  // Re-fetch records immediately when user switches to 'orders' tab
  useEffect(() => {
    if (activeTab === 'orders') {
      fetchRecords(1, recordsSearch, recordsStatus);
    }
  }, [activeTab]);

  const fetchRecords = async (page = recordsPage, search = recordsSearch, status = recordsStatus, isSilent = false) => {
    try {
      if (!isSilent) setRecordsLoading(true);
      const params = new URLSearchParams({
        type: 'records',
        page: String(page),
        pageSize: '10',
        search: search.trim(),
        paymentStatus: status,
      });
      if (currentStore?.shopDomain) {
        params.set('shop', currentStore.shopDomain);
      }
      const res = await shopifyFetch(`/api/preorder?${params.toString()}`);
      const data = await res.json();
      if (data.success) {
        setRecords(data.data || []);
        if (data.pagination) {
          setRecordsTotal(data.pagination.total || 0);
          setRecordsTotalPages(data.pagination.totalPages || 1);
          setRecordsPage(data.pagination.page || page);
        }
        if (data.metrics) {
          setPreorderMetrics(data.metrics);
        }
      }
    } catch (err) {
      console.error('Failed to fetch preorder records:', err);
    } finally {
      if (!isSilent) setRecordsLoading(false);
    }
  };

  // Sync when tab is active and when window regains focus or visibility
  useEffect(() => {
    if (activeTab !== 'orders') return;

    const handleSync = () => {
      if (typeof document !== 'undefined' && !document.hidden) {
        fetchRecords(recordsPage, recordsSearch, recordsStatus, true);
      }
    };

    window.addEventListener('focus', handleSync);
    document.addEventListener('visibilitychange', handleSync);

    return () => {
      window.removeEventListener('focus', handleSync);
      document.removeEventListener('visibilitychange', handleSync);
    };
  }, [activeTab, recordsPage, recordsSearch, recordsStatus]);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      const url = currentStore?.shopDomain 
        ? `/api/preorder?shop=${encodeURIComponent(currentStore.shopDomain)}&_t=${Date.now()}` 
        : `/api/preorder?_t=${Date.now()}`;
      const res = await shopifyFetch(url);
      const data = await res.json();
      if (data.success && data.config) {
        setEnabled(data.config.enabled);
        setInventoryThreshold(String(data.config.inventoryThreshold ?? 0));
        setCustomerMessage(data.config.customerMessage || "Pre-order before it's gone.");
        setShippingMessage(data.config.shippingMessage || 'Shipping: As soon as possible');
        setFulfillmentMessage(
          data.config.fulfillmentMessage || 'We will fulfill the item as soon as it becomes available'
        );
        setMaxQuantity(data.config.maxQuantity !== null && data.config.maxQuantity !== undefined ? String(data.config.maxQuantity) : '');
        setDiscountType(data.config.discountType || 'none');
        setDiscountValue(String(data.config.discountValue ?? 0));
        setSelectionMode(data.config.selectionMode || 'ALL_PRODUCTS');
        setSelectedProductIds(data.config.selectedProductIds || []);
        setSelectedCollectionIds(data.config.selectedCollectionIds || []);
        const isHalf = data.config.allowHalfPayment !== undefined ? data.config.allowHalfPayment : true;
        setAllowHalfPayment(isHalf);
        setAllowFullPayment(!isHalf);
        setPaymentType(isHalf ? 'HALF' : 'FULL');
        setDefaultPaymentOption(isHalf ? 'HALF' : 'FULL');
        const rawSchedule = data.config.statusScheduleType || 'AVAILABLE_NOW';
        setStatusScheduleType(
          rawSchedule === 'NOT_AVAILABLE' ? 'NOT_AVAILABLE' :
          rawSchedule === 'UNTIL_END_DATE' ? 'UNTIL_END_DATE' :
          'AVAILABLE_NOW'
        );
        let eDate = toDatetimeLocalString(data.config.endDate);
        const cDate = toDatetimeLocalString(data.config.timerCustomDate);
        if (!eDate && cDate) {
          eDate = cDate;
        }
        setEndDate(eDate);
        setTimerDateMode(data.config.timerDateMode || 'USE_STATUS_DATE');
        setTimerCustomDate(cDate || eDate);
        try {
          const raw = data.config.timerHeading || '';
          if (raw.startsWith('{')) {
            const parsed = JSON.parse(raw);
            setTimerHeadingStart(parsed.start || 'Pre-order opening soon');
            setTimerHeadingEnd(data.config.timerHeadingEnd || parsed.end || 'Hurry up! Pre-order ending soon');
          } else if (raw) {
            setTimerHeadingStart(raw);
            setTimerHeadingEnd(data.config.timerHeadingEnd || 'Hurry up! Pre-order ending soon');
          } else {
            setTimerHeadingStart('Pre-order opening soon');
            setTimerHeadingEnd(data.config.timerHeadingEnd || 'Hurry up! Pre-order ending soon');
          }
        } catch {
          setTimerHeadingStart(data.config.timerHeading || 'Pre-order opening soon');
          setTimerHeadingEnd(data.config.timerHeadingEnd || 'Hurry up! Pre-order ending soon');
        }
        const effectiveBg = data.config.timerBgColorEnd || data.config.timerBgColor || '#fee2e2';
        const effectiveText = data.config.timerTextColorEnd || data.config.timerTextColor || '#000000';
        setTimerTextColor(effectiveText);
        setTimerBgColor(effectiveBg);
        setTimerTextColorEnd(effectiveText);
        setTimerBgColorEnd(effectiveBg);
        setTimerBorderRadius(data.config.timerBorderRadius !== null && data.config.timerBorderRadius !== undefined ? String(data.config.timerBorderRadius) : '8');
        setTimerShowDays(data.config.timerShowDays !== false);
        setTimerShowHours(data.config.timerShowHours !== false);
        setTimerShowMinutes(data.config.timerShowMinutes !== false);
        setTimerShowSeconds(data.config.timerShowSeconds !== false);
        setTimerDaysLabel(data.config.timerDaysLabel || 'Days');
        setTimerHoursLabel(data.config.timerHoursLabel || 'Hours');
        setTimerMinutesLabel(data.config.timerMinutesLabel || 'Mins');
        setTimerSecondsLabel(data.config.timerSecondsLabel || 'Secs');
        setShowTimer(Boolean(data.config.showTimer));
        if (data.config.timerDateMode) {
          setTimerDateMode(data.config.timerDateMode);
        }
        if (data.config.timerDisplayMode) {
          setTimerDisplayMode(data.config.timerDisplayMode);
        }

        const baseline = JSON.stringify({
          enabled: Boolean(data.config.enabled),
          inventoryThreshold: String(data.config.inventoryThreshold ?? 0),
          selectionMode: data.config.selectionMode || 'ALL_PRODUCTS',
          selectedProductIds: [...(data.config.selectedProductIds || [])].sort(),
          selectedCollectionIds: [...(data.config.selectedCollectionIds || [])].sort(),
          paymentType: isHalf ? 'HALF' : 'FULL',
          allowHalfPayment: isHalf,
          allowFullPayment: !isHalf,
          discountType: data.config.discountType || 'none',
          discountValue: String(data.config.discountValue ?? 0),
          customerMessage: data.config.customerMessage || "Pre-order before it's gone.",
          shippingMessage: data.config.shippingMessage || 'Shipping: As soon as possible',
          fulfillmentMessage: data.config.fulfillmentMessage || 'We will fulfill the item as soon as it becomes available',
          statusScheduleType: rawSchedule === 'NOT_AVAILABLE' ? 'NOT_AVAILABLE' : rawSchedule === 'UNTIL_END_DATE' ? 'UNTIL_END_DATE' : 'AVAILABLE_NOW',
          endDate: eDate || '',
          showTimer: Boolean(data.config.showTimer),
          timerDateMode: data.config.timerDateMode || 'USE_STATUS_DATE',
          timerCustomDate: cDate || eDate || '',
          timerHeadingEnd: data.config.timerHeadingEnd || 'Hurry up! Pre-order ending soon',
          timerTextColorEnd: effectiveText,
          timerBgColorEnd: effectiveBg,
          timerBorderRadius: data.config.timerBorderRadius !== null && data.config.timerBorderRadius !== undefined ? String(data.config.timerBorderRadius) : '8',
          timerShowDays: data.config.timerShowDays !== false,
          timerShowHours: data.config.timerShowHours !== false,
          timerShowMinutes: data.config.timerShowMinutes !== false,
          timerShowSeconds: data.config.timerShowSeconds !== false,
          timerDaysLabel: data.config.timerDaysLabel || 'Days',
          timerHoursLabel: data.config.timerHoursLabel || 'Hours',
          timerMinutesLabel: data.config.timerMinutesLabel || 'Mins',
          timerSecondsLabel: data.config.timerSecondsLabel || 'Secs',
        });
        setSavedSnapshot(baseline);

        if (data.calculation) {
          setCalculation(data.calculation);
        }
        if (data.sample100) {
          setSample100(data.sample100);
        }
        if (data.metrics) {
          setPreorderMetrics(data.metrics);
        }
      }
    } catch (err: any) {
      setToast({ message: 'Failed to load pre-order settings', type: 'error' });
    } finally {
      setLoading(false);
    }
  };

  const handlePaymentTypeChange = (val: 'FULL' | 'HALF') => {
    setPaymentType(val);
    if (val === 'HALF') {
      setAllowHalfPayment(true);
      setAllowFullPayment(false);
      setDefaultPaymentOption('HALF');
    } else {
      setAllowHalfPayment(false);
      setAllowFullPayment(true);
      setDefaultPaymentOption('FULL');
    }
  };

  const handleSave = async () => {
    try {
      setSaving(true);
      const thresholdNum = parseInt(inventoryThreshold, 10);
      const maxQtyNum = maxQuantity.trim() ? parseInt(maxQuantity, 10) : null;
      const valNum = parseFloat(discountValue);

      const payload = {
        enabled,
        inventoryThreshold: isNaN(thresholdNum) ? 0 : thresholdNum,
        customerMessage: customerMessage.trim(),
        shippingMessage: shippingMessage.trim(),
        fulfillmentMessage: fulfillmentMessage.trim(),
        maxQuantity: maxQtyNum && !isNaN(maxQtyNum) ? maxQtyNum : null,
        discountType,
        discountValue: isNaN(valNum) ? 0 : valNum,
        selectionMode,
        selectedProductIds,
        selectedCollectionIds,
        allowHalfPayment: paymentType === 'HALF',
        allowFullPayment: paymentType === 'FULL',
        defaultPaymentOption: paymentType,
        // Status & Scheduling (End date / Deadline only)
        statusScheduleType,
        startDate: null,
        endDate: endDate ? new Date(endDate).toISOString() : null,
        // Countdown Timer
        showTimer,
        timerDisplayMode: 'WHILE_PREORDER',
        timerDateMode,
        timerCustomDate: timerDateMode === 'CUSTOM_DATES' && timerCustomDate
          ? new Date(timerCustomDate).toISOString()
          : (endDate ? new Date(endDate).toISOString() : (timerCustomDate ? new Date(timerCustomDate).toISOString() : null)),
        timerHeading: timerHeadingStart.trim() || 'Pre-order opening soon',
        timerHeadingEnd: timerHeadingEnd.trim() || 'Hurry up! Pre-order ending soon',
        timerTextColor,
        timerBgColor,
        timerTextColorEnd,
        timerBgColorEnd,
        timerBorderRadius: Math.max(0, parseInt(timerBorderRadius, 10) || 0),
        timerShowDays,
        timerShowHours,
        timerShowMinutes,
        timerShowSeconds,
        timerDaysLabel: timerDaysLabel.trim() || 'Days',
        timerHoursLabel: timerHoursLabel.trim() || 'Hours',
        timerMinutesLabel: timerMinutesLabel.trim() || 'Mins',
        timerSecondsLabel: timerSecondsLabel.trim() || 'Secs',
      };

      const saveUrl = currentStore?.shopDomain
        ? `/api/preorder?shop=${encodeURIComponent(currentStore.shopDomain)}`
        : '/api/preorder';

      const res = await shopifyFetch(saveUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (data.success) {
        setSavedSnapshot(buildSnapshotFromCurrent());
        if (data.calculation) setCalculation(data.calculation);
        if (data.sample100) setSample100(data.sample100);
        if (typeof window !== 'undefined') {
          try {
            localStorage.setItem('storeorbit_config_version', Date.now().toString());
            window.dispatchEvent(new CustomEvent('storeorbit-config-updated'));
          } catch (_) {}
        }
        setToast({ message: 'Pre-order settings saved successfully!', type: 'success' });
      } else {
        setToast({ message: data.error || 'Failed to save settings', type: 'error' });
      }
    } catch (err: any) {
      setToast({ message: err.message || 'Error saving settings', type: 'error' });
    } finally {
      setSaving(false);
    }
  };

  const tabs: PageTab<PreorderTabId>[] = [
    { id: 'general', label: 'Setup & Products' },
    { id: 'offers_payment', label: 'Offer & Payment' },
    { id: 'status_timer', label: 'Status & Timer' },
    { id: 'orders', label: 'Pre-order Tracking' },
  ];

  const previewColumn = (
    <div className="lg:col-span-5 space-y-4 lg:sticky lg:top-6">
      <PreviewCard
        enabled={enabled}
        customerMessage={customerMessage}
        shippingMessage={shippingMessage}
        fulfillmentMessage={fulfillmentMessage}
        notifyMeEnabled={true}
        allowHalfPayment={allowHalfPayment}
        allowFullPayment={allowFullPayment}
        defaultPaymentOption={defaultPaymentOption}
        showSavings={showSavings}
        calculation={calculation}
        statusScheduleType={statusScheduleType}
        endDate={endDate}
        showTimer={showTimer}
        timerDateMode={timerDateMode}
        timerCustomDate={timerDateMode === 'CUSTOM_DATES' ? timerCustomDate : endDate}
        timerHeading={timerHeadingEnd}
        timerHeadingEnd={timerHeadingEnd}
        timerTextColor={timerTextColorEnd || timerTextColor}
        timerBgColor={timerBgColorEnd || timerBgColor}
        timerTextColorEnd={timerTextColorEnd}
        timerBgColorEnd={timerBgColorEnd}
        timerBorderRadius={parseInt(timerBorderRadius, 10) || 0}
        timerShowDays={timerShowDays}
        timerShowHours={timerShowHours}
        timerShowMinutes={timerShowMinutes}
        timerShowSeconds={timerShowSeconds}
        timerDaysLabel={timerDaysLabel}
        timerHoursLabel={timerHoursLabel}
        timerMinutesLabel={timerMinutesLabel}
        timerSecondsLabel={timerSecondsLabel}
      />
    </div>
  );

  if (loading) {
    return <Loading label="Loading preorder..." />;
  }

  return (
    <StandaloneGuard featureName="Pre-order">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 w-full overflow-x-hidden space-y-8">
      {/* Toast Alert */}
      {toast && (
        <Toast
          content={toast.message}
          error={toast.type === 'error'}
          onDismiss={() => setToast(null)}
        />
      )}

      {/* Page Header */}
      <PageHeader
        title="Pre-order"
        subtitle="Allow customers to pre-order items when stock drops to or below the configured inventory threshold."
      />

      {/* Pre-order Performance Overview: 4 database-driven cards (Total Pre-orders, Pending Pre-orders, Pre-order Revenue, Pending Revenue) at the top of the navbar */}
      <PreorderPerformanceCard metrics={preorderMetrics || undefined} />

      {/* 3-Tab Navbar Navigation */}
      <PageTabs
        tabs={tabs}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      {/* Action Bar Under Navbar */}
      {activeTab !== 'orders' && (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-1 pb-2">
          <div className="flex items-center gap-2">
            {isDirty && (
              <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-xl bg-amber-50 text-amber-800 border border-amber-200 text-xs font-bold shadow-2xs">
                <span className="inline-flex rounded-full h-2 w-2 bg-amber-500 animate-pulse"></span>
                <span>Unsaved changes: Ready to update</span>
              </span>
            )}
          </div>
          <SaveButton
            onClick={handleSave}
            loading={saving}
            label="Save Changes"
            loadingLabel="Saving Changes..."
            disabled={saving || !isDirty}
          />
        </div>
      )}

      {/* TAB 1: Setup & Products (Enable Pre-order, Product Selection, Customize Messaging) */}
      {activeTab === 'general' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 space-y-6">
            {/* Main Activation Card */}
            <SettingsCard
              title="Pre-order Behavior"
              description="Control when and how pre-order is triggered on your storefront product pages."
            >
              <SettingsToggle
                label="Enable Pre-order"
                description="When turned on, out-of-stock or low-stock variants show Pre-order instead of Sold Out."
                checked={enabled}
                onChange={setEnabled}
              />

              <div className="pt-2 border-t border-gray-100">
                <SettingsInput
                  label="Inventory Threshold"
                  description="Variants with stock at or below this value (e.g. 0 or negative) display Pre-order. In-stock products (> threshold) show the normal Add to Cart button."
                  value={inventoryThreshold}
                  onChange={setInventoryThreshold}
                  type="number"
                  min={0}
                  max={9999}
                />
              </div>

              <div className="pt-2 border-t border-gray-100">
                <SettingsInput
                  label="Maximum Pre-order Quantity (Optional)"
                  description="Limit the maximum quantity of pre-order items allowed per cart. Leave empty for unlimited."
                  value={maxQuantity}
                  onChange={setMaxQuantity}
                  type="number"
                  min={1}
                  placeholder="No limit"
                />
              </div>
            </SettingsCard>

            {/* Product Selection Mode Card */}
            <SettingsCard
              title="Product Selection Mode"
              description="Control which products are targeted for pre-order offers. Only eligible out-of-stock items will support pre-order."
              badge={
                <span
                  className="px-2.5 py-0.5 rounded-full text-xs font-bold"
                  style={{
                    backgroundColor: accentColor,
                    color: primaryColor,
                    border: `1px solid ${primaryColor}40`,
                  }}
                >
                  {selectionMode === 'ALL_PRODUCTS'
                    ? 'All Products'
                    : selectionMode === 'SPECIFIC_PRODUCTS'
                    ? `${selectedProductIds.length} Products Selected`
                    : `${selectedCollectionIds.length} Collections Selected`}
                </span>
              }
            >
              <div className="space-y-4">
                {/* The 3 Selection Modes Radio Grid */}
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {/* 1. All Products */}
                  <label
                    className={`p-3.5 border rounded-xl cursor-pointer flex flex-col gap-1 transition-all ${
                      selectionMode === 'ALL_PRODUCTS'
                        ? 'border-emerald-600 bg-emerald-50/50 shadow-2xs ring-1 ring-emerald-600'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="selectionMode"
                        value="ALL_PRODUCTS"
                        checked={selectionMode === 'ALL_PRODUCTS'}
                        onChange={() => setSelectionMode('ALL_PRODUCTS')}
                        style={{ accentColor: primaryColor }}
                        className="h-4 w-4 cursor-pointer"
                      />
                      <span className="text-sm font-bold text-gray-900">All Products</span>
                    </div>
                    <p className="text-xs text-gray-500 pl-6 leading-relaxed">
                      Target all products in the store that meet inventory conditions.
                    </p>
                  </label>

                  {/* 2. Specific Product */}
                  <label
                    className={`p-3.5 border rounded-xl cursor-pointer flex flex-col gap-1 transition-all ${
                      selectionMode === 'SPECIFIC_PRODUCTS'
                        ? 'border-emerald-600 bg-emerald-50/50 shadow-2xs ring-1 ring-emerald-600'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="selectionMode"
                        value="SPECIFIC_PRODUCTS"
                        checked={selectionMode === 'SPECIFIC_PRODUCTS'}
                        onChange={() => setSelectionMode('SPECIFIC_PRODUCTS')}
                        style={{ accentColor: primaryColor }}
                        className="h-4 w-4 cursor-pointer"
                      />
                      <span className="text-sm font-bold text-gray-900">Specific Product</span>
                    </div>
                    <p className="text-xs text-gray-500 pl-6 leading-relaxed">
                      Select individual products from your Shopify catalog.
                    </p>
                  </label>

                  {/* 3. Collection-Based */}
                  <label
                    className={`p-3.5 border rounded-xl cursor-pointer flex flex-col gap-1 transition-all ${
                      selectionMode === 'COLLECTIONS'
                        ? 'border-emerald-600 bg-emerald-50/50 shadow-2xs ring-1 ring-emerald-600'
                        : 'border-gray-200 hover:border-gray-300 bg-white'
                    }`}
                  >
                    <div className="flex items-center gap-2">
                      <input
                        type="radio"
                        name="selectionMode"
                        value="COLLECTIONS"
                        checked={selectionMode === 'COLLECTIONS'}
                        onChange={() => setSelectionMode('COLLECTIONS')}
                        style={{ accentColor: primaryColor }}
                        className="h-4 w-4 cursor-pointer"
                      />
                      <span className="text-sm font-bold text-gray-900">Collection-Based</span>
                    </div>
                    <p className="text-xs text-gray-500 pl-6 leading-relaxed">
                      Target eligible products belonging to selected collections.
                    </p>
                  </label>
                </div>

                {/* Dynamic Target Selection UI */}
                <div className="pt-2 border-t border-gray-100">
                  {selectionMode === 'ALL_PRODUCTS' && (
                    <div className="p-4 bg-emerald-50/60 rounded-xl border border-emerald-200 text-emerald-950 text-xs space-y-1">
                      <div className="font-bold flex items-center gap-1.5 text-emerald-900">
                        <svg className="w-4 h-4 text-emerald-700 shrink-0" fill="currentColor" viewBox="0 0 20 20">
                          <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                        </svg>
                        All Products Mode Active
                      </div>
                      <p className="text-emerald-800 leading-relaxed pl-5.5">
                        Pre-order offers apply across your entire catalog, but only for products or variants with stock ≤ {inventoryThreshold}. Products that are in stock remain standard purchases and will not show pre-order.
                      </p>
                    </div>
                  )}

                  {selectionMode === 'SPECIFIC_PRODUCTS' && (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-gray-700">
                        Select individual products to target for Pre-order:
                      </div>
                      <PreorderProductSelector
                        selectedProductIds={selectedProductIds}
                        onChange={setSelectedProductIds}
                        inventoryThreshold={parseInt(inventoryThreshold, 10) || 0}
                      />
                    </div>
                  )}

                  {selectionMode === 'COLLECTIONS' && (
                    <div className="space-y-2">
                      <div className="text-xs font-semibold text-gray-700">
                        Select Shopify collections to target for Pre-order:
                      </div>
                      <PreorderCollectionSelector
                        selectedCollectionIds={selectedCollectionIds}
                        onChange={setSelectedCollectionIds}
                      />
                    </div>
                  )}
                </div>

                {/* Card Footer with Direct Save Button */}
                <div className="pt-3 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-xs text-gray-500 font-medium">
                    {selectionMode === 'COLLECTIONS'
                      ? `${selectedCollectionIds.length} collection${selectedCollectionIds.length === 1 ? '' : 's'} selected`
                      : selectionMode === 'SPECIFIC_PRODUCTS'
                      ? `${selectedProductIds.length} product${selectedProductIds.length === 1 ? '' : 's'} selected`
                      : 'All catalog products targeted'}
                  </span>
                  {isDirty && (
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving}
                      style={{ backgroundColor: primaryColor, color: buttonTextColor }}
                      className="px-4 py-2 text-xs font-black rounded-lg shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer flex items-center gap-2"
                    >
                      {saving ? (
                        <>
                          <span className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                          Saving...
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" style={{ color: buttonTextColor }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                          </svg>
                          Save Changes
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </SettingsCard>

            {/* Customer Facing Messages Card */}
            <SettingsCard
              title="Customer Messaging"
              description="Customize the messaging shown on the product page Pre-order card."
            >
              <SettingsInput
                label="Customer Message"
                description="Prominent badge/callout text in the pre-order card."
                value={customerMessage}
                onChange={setCustomerMessage}
                placeholder="Pre-order before it's gone."
              />

              <SettingsInput
                label="Shipping Message"
                description="Estimated shipping timeline displayed with the truck icon."
                value={shippingMessage}
                onChange={setShippingMessage}
                placeholder="Shipping: As soon as possible"
              />

              <SettingsTextarea
                label="Fulfillment Message"
                description="Supporting message explaining when customer will receive their item."
                value={fulfillmentMessage}
                onChange={setFulfillmentMessage}
                rows={2}
                placeholder="We will fulfill the item as soon as it becomes available"
              />
            </SettingsCard>
          </div>
          {previewColumn}
        </div>
      )}

      {/* TAB 2: Offer & Payment */}
      {activeTab === 'offers_payment' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 space-y-6">
            {/* Pre-order Offer & Payment Settings Card (Matches Design) */}
            <SettingsCard
              title="Payment & Discount Settings"
              description="Configure payment options, upfront deposits, and promotional discounts for pre-orders."
              badge={
                discountType !== 'none' && calculation?.offerBadge ? (
                  <span
                    className="px-2.5 py-0.5 rounded-full text-xs font-black transition-colors"
                    style={{
                      backgroundColor: accentColor,
                      color: primaryColor,
                      border: `1px solid ${primaryColor}40`,
                    }}
                  >
                    {calculation.offerBadge}
                  </span>
                ) : undefined
              }
            >
              <div className="space-y-6">
                {/* 1. Discount on total price */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-bold text-gray-900">
                      1. Pre-order Discount
                    </label>
                    <span className="text-[11px] font-semibold text-emerald-700 bg-emerald-50 px-2.5 py-0.5 rounded-full border border-emerald-200">
                      Applied first to product price
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 mb-3 font-normal leading-relaxed">
                    Set a promotional discount applied directly to the catalog price for pre-ordered items.
                  </p>
                  <div className="flex flex-wrap items-center gap-7">
                    <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-semibold text-gray-800 hover:text-gray-900 transition-colors">
                      <input
                        type="radio"
                        name="preorderDiscountType"
                        value="none"
                        checked={discountType === 'none'}
                        onChange={() => {
                          setDiscountType('none');
                          setDiscountValue('0');
                        }}
                        style={{ accentColor: primaryColor }}
                        className="h-4 w-4 cursor-pointer"
                      />
                      <span>None</span>
                    </label>

                    <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-semibold text-gray-800 hover:text-gray-900 transition-colors">
                      <input
                        type="radio"
                        name="preorderDiscountType"
                        value="percentage"
                        checked={discountType === 'percentage'}
                        onChange={() => {
                          setDiscountType('percentage');
                          if (discountValue === '0' || !discountValue) setDiscountValue('10');
                        }}
                        style={{ accentColor: primaryColor }}
                        className="h-4 w-4 cursor-pointer"
                      />
                      <span>Percent</span>
                    </label>

                    <label className="inline-flex items-center gap-2 cursor-pointer text-sm font-semibold text-gray-800 hover:text-gray-900 transition-colors">
                      <input
                        type="radio"
                        name="preorderDiscountType"
                        value="fixed"
                        checked={discountType === 'fixed'}
                        onChange={() => {
                          setDiscountType('fixed');
                          if (discountValue === '0' || !discountValue) setDiscountValue('10');
                        }}
                        style={{ accentColor: primaryColor }}
                        className="h-4 w-4 cursor-pointer"
                      />
                      <span>Amount</span>
                    </label>
                  </div>

                  {/* Percentage input */}
                  {discountType === 'percentage' && (
                    <div className="max-w-xs mt-3 animate-fadeIn">
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Discount Percentage (%)
                      </label>
                      <div className="relative">
                        <input
                          type="number"
                          min={1}
                          max={100}
                          value={discountValue}
                          onChange={(e) => setDiscountValue(e.target.value)}
                          placeholder="10"
                          style={{ borderColor: primaryColor }}
                          className="w-full px-3.5 py-2 text-sm font-semibold text-gray-900 bg-white border rounded-lg shadow-2xs outline-none pr-8 focus:ring-1"
                        />
                        <span className="absolute right-3 top-2 text-sm font-bold pointer-events-none" style={{ color: primaryColor }}>%</span>
                      </div>
                    </div>
                  )}

                  {/* Amount input */}
                  {discountType === 'fixed' && (
                    <div className="max-w-xs mt-3 animate-fadeIn">
                      <label className="block text-xs font-bold text-gray-700 mb-1">
                        Discount Amount (₹)
                      </label>
                      <div className="relative">
                        <span className="absolute left-3 top-2 text-sm font-bold pointer-events-none" style={{ color: primaryColor }}>₹</span>
                        <input
                          type="number"
                          min={1}
                          value={discountValue}
                          onChange={(e) => setDiscountValue(e.target.value)}
                          placeholder="10"
                          style={{ borderColor: primaryColor }}
                          className="w-full pl-8 pr-3.5 py-2 text-sm font-semibold text-gray-900 bg-white border rounded-lg shadow-2xs outline-none focus:ring-1"
                        />
                      </div>
                    </div>
                  )}
                </div>

                {/* 2. Payment type Dropdown */}
                <div className="pt-6 border-t border-gray-100">
                  <div className="flex items-center justify-between mb-1">
                    <label className="block text-sm font-bold text-gray-900">
                      2. Payment Plan Option
                    </label>
                    <span className="text-[11px] font-semibold text-slate-700 bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200">
                      Calculated on discounted price
                    </span>
                  </div>
                  <div className="mt-2">
                    <PolarisSelect
                      value={paymentType}
                      onChange={(val) => handlePaymentTypeChange(val as 'FULL' | 'HALF')}
                      options={[
                        { label: 'Full payment (100% upfront)', value: 'FULL' },
                        { label: 'Half payment (50% deposit upfront)', value: 'HALF' },
                      ]}
                      helpText={
                        paymentType === 'FULL'
                          ? 'Customers will pay the full discounted price at checkout.'
                          : 'Customers pay a 50% deposit based on the discounted price today, and the remaining 50% upon restock.'
                      }
                    />
                  </div>
                </div>

                {/* 3. Display Settings */}
                <div className="pt-6 border-t border-gray-100">
                  <label className="block text-sm font-bold text-gray-900 mb-3">
                    Display
                  </label>
                  <label className="inline-flex items-center gap-2.5 cursor-pointer text-sm font-semibold text-gray-800 hover:text-gray-900 transition-colors">
                    <input
                      type="checkbox"
                      checked={showSavings}
                      onChange={(e) => setShowSavings(e.target.checked)}
                      style={{ accentColor: primaryColor }}
                      className="h-4 w-4 rounded cursor-pointer"
                    />
                    <span>Show payment &amp; discount savings</span>
                  </label>
                </div>

                {/* Card Footer with Direct Save Button */}
                <div className="pt-5 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-xs text-gray-500 font-medium">
                    {paymentType === 'HALF'
                      ? 'Half payment (50% deposit) active'
                      : 'Full payment (100%) active'}
                  </span>
                  {isDirty && (
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving}
                      style={{ backgroundColor: primaryColor, color: buttonTextColor }}
                      className="px-4 py-2 text-xs font-black rounded-lg shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer flex items-center gap-2"
                    >
                      {saving ? (
                        <>
                          <span className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                          Saving...
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" style={{ color: buttonTextColor }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                          </svg>
                          Save Changes
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </SettingsCard>
          </div>
          {previewColumn}
        </div>
      )}

      {/* TAB 3: Status & Timer (Status & Scheduling + Countdown Timer) */}
      {activeTab === 'status_timer' && (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          <div className="lg:col-span-7 space-y-6">
            {/* Card 1: Status & Scheduling matching Screenshot 1 */}
            <SettingsCard
              title="Status"
              description="Control the status of your preorder offer, and set an optional end deadline."
            >
              <div className="space-y-4">
                {/* Offer Status Badge Row */}
                <div className="flex items-center gap-2.5 pb-2 border-b border-gray-100">
                  <span className="text-sm font-bold text-gray-900">Offer status</span>
                  {(() => {
                    const now = new Date();
                    const end = endDate ? new Date(endDate) : null;

                    if (statusScheduleType === 'NOT_AVAILABLE') {
                      return (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-700 border border-gray-200">
                          Paused
                        </span>
                      );
                    }
                    if (statusScheduleType === 'UNTIL_END_DATE') {
                      if (end && now > end) {
                        return (
                          <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-gray-100 text-gray-700 border border-gray-200">
                            Ended
                          </span>
                        );
                      }
                      return (
                        <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Live
                        </span>
                      );
                    }
                    return (
                      <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                        Live
                      </span>
                    );
                  })()}
                </div>

                {/* The Clean Radio Options (End Date / Deadline only) */}
                <div className="space-y-3 pt-1">
                  {/* 1. Available now */}
                  <label className="flex items-center gap-3 cursor-pointer py-1">
                    <input
                      type="radio"
                      name="statusScheduleType"
                      value="AVAILABLE_NOW"
                      checked={statusScheduleType === 'AVAILABLE_NOW'}
                      onChange={() => setStatusScheduleType('AVAILABLE_NOW')}
                      style={{ accentColor: primaryColor }}
                      className="h-4 w-4 cursor-pointer"
                    />
                    <span className="text-sm font-semibold text-gray-800">Available now</span>
                  </label>

                  {/* 2. Available now & until end date */}
                  <div className="space-y-2">
                    <label className="flex items-center gap-3 cursor-pointer py-1">
                      <input
                        type="radio"
                        name="statusScheduleType"
                        value="UNTIL_END_DATE"
                        checked={statusScheduleType === 'UNTIL_END_DATE'}
                        onChange={() => setStatusScheduleType('UNTIL_END_DATE')}
                        style={{ accentColor: primaryColor }}
                        className="h-4 w-4 cursor-pointer"
                      />
                      <span className="text-sm font-semibold text-gray-800">Available now &amp; until end date</span>
                    </label>
                    {statusScheduleType === 'UNTIL_END_DATE' && (
                      <div className="pl-7 max-w-sm animate-fadeIn">
                        <DateTimePicker
                          label="End Date & Time"
                          value={endDate}
                          onChange={setEndDate}
                          primaryColor={primaryColor}
                        />
                      </div>
                    )}
                  </div>

                  {/* 3. Not available */}
                  <label className="flex items-center gap-3 cursor-pointer py-1">
                    <input
                      type="radio"
                      name="statusScheduleType"
                      value="NOT_AVAILABLE"
                      checked={statusScheduleType === 'NOT_AVAILABLE'}
                      onChange={() => setStatusScheduleType('NOT_AVAILABLE')}
                      style={{ accentColor: primaryColor }}
                      className="h-4 w-4 cursor-pointer"
                    />
                    <span className="text-sm font-semibold text-gray-800">Not available</span>
                  </label>
                </div>

                {/* Card Footer Save Button */}
                <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
                  <span className="text-xs text-gray-500 font-medium">
                    Changes apply automatically to storefront product pages.
                  </span>
                  {isDirty && (
                    <button
                      type="button"
                      onClick={handleSave}
                      disabled={saving}
                      style={{ backgroundColor: primaryColor, color: buttonTextColor }}
                      className="px-4 py-2 text-xs font-black rounded-lg shadow-sm hover:opacity-90 transition-opacity disabled:opacity-50 cursor-pointer flex items-center gap-2"
                    >
                      {saving ? (
                        <>
                          <span className="inline-block w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin"></span>
                          Saving...
                        </>
                      ) : (
                        <>
                          <svg className="w-3.5 h-3.5" style={{ color: buttonTextColor }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                          </svg>
                          Save Changes
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </SettingsCard>

            {/* Card 2: Reusable Countdown Timer Component matching exact layout */}
            <PreorderCountdownTimerCard
              showTimer={showTimer}
              setShowTimer={setShowTimer}
              timerDisplayMode={timerDisplayMode}
              setTimerDisplayMode={setTimerDisplayMode}
              timerDateMode={timerDateMode}
              setTimerDateMode={setTimerDateMode}
              customEndDate={timerCustomDate}
              setCustomEndDate={setTimerCustomDate}
              endDate={endDate}
              setEndDate={setEndDate}
              statusEndDate={endDate}
              timerHeadingStart={timerHeadingStart}
              setTimerHeadingStart={setTimerHeadingStart}
              timerHeadingEnd={timerHeadingEnd}
              setTimerHeadingEnd={setTimerHeadingEnd}
              timerTextColor={timerTextColor}
              setTimerTextColor={setTimerTextColor}
              timerBgColor={timerBgColor}
              setTimerBgColor={setTimerBgColor}
              timerTextColorEnd={timerTextColorEnd}
              setTimerTextColorEnd={setTimerTextColorEnd}
              timerBgColorEnd={timerBgColorEnd}
              setTimerBgColorEnd={setTimerBgColorEnd}
              timerBorderRadius={timerBorderRadius}
              setTimerBorderRadius={setTimerBorderRadius}
              timerShowDays={timerShowDays}
              setTimerShowDays={setTimerShowDays}
              timerShowHours={timerShowHours}
              setTimerShowHours={setTimerShowHours}
              timerShowMinutes={timerShowMinutes}
              setTimerShowMinutes={setTimerShowMinutes}
              timerShowSeconds={timerShowSeconds}
              setTimerShowSeconds={setTimerShowSeconds}
              timerDaysLabel={timerDaysLabel}
              setTimerDaysLabel={setTimerDaysLabel}
              timerHoursLabel={timerHoursLabel}
              setTimerHoursLabel={setTimerHoursLabel}
              timerMinutesLabel={timerMinutesLabel}
              setTimerMinutesLabel={setTimerMinutesLabel}
              timerSecondsLabel={timerSecondsLabel}
              setTimerSecondsLabel={setTimerSecondsLabel}
              primaryColor={primaryColor}
              buttonTextColor={buttonTextColor}
              onSave={handleSave}
              saving={saving}
              isDirty={isDirty}
            />
          </div>
          {previewColumn}
        </div>
      )}

      {/* TAB 3: Pre-order Tracking Table */}
      {activeTab === 'orders' && (
        <div className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold text-slate-900 tracking-tight m-0">Pre-order Tracking</h2>
              <p className="text-xs sm:text-sm text-slate-500 mt-1 m-0">
                Track initial deposits, outstanding customer balances, and payment statuses.
              </p>
            </div>
            <RefreshButton
              onClick={() => fetchRecords(recordsPage, recordsSearch, recordsStatus)}
              isRefreshing={recordsLoading}
              size="sm"
              variant="white"
              label="Refresh Orders"
              refreshingLabel="Refreshing Orders..."
              className="self-start sm:self-auto font-bold"
            />
          </div>

          <Table
            title="Pre-order Management"
            headerColor={primaryColor}
            columns={[
              { key: 'orderRef', title: 'Order Ref', type: 'react_node', width: '13%' },
              { key: 'product', title: 'Product & Variant', type: 'react_node', width: '27%' },
              { key: 'customer', title: 'Customer', type: 'react_node', width: '18%' },
              { key: 'totalAmount', title: 'Total', type: 'react_node', width: '9%' },
              { key: 'depositAmount', title: 'Initial Paid', type: 'react_node', width: '9%' },
              { key: 'remainingBalance', title: 'Remaining', type: 'react_node', width: '9%' },
              { key: 'paymentOption', title: 'Payment Plan', type: 'react_node', width: '10%' },
              { key: 'paymentStatus', title: 'Status', type: 'react_node', width: '9%' },
            ]}
            items={records.map((record) => {
              const isPartiallyPaid = record.paymentStatus === 'PARTIALLY_PAID' || record.remainingBalance > 0;
              const isPaid = record.paymentStatus === 'PAID' && record.remainingBalance <= 0;
              const curr = record.currency || 'INR';
              const currSym = curr === 'INR' ? '₹' : curr === 'USD' ? '$' : `${curr} `;

              const cleanOrderNumber = record.orderNumber
                ? (record.orderNumber.startsWith('#') || record.orderNumber.startsWith('PRE-') ? record.orderNumber : `#${record.orderNumber}`)
                : '—';

              return {
                id: record.id,
                orderNumber: record.orderNumber || '',
                rawPaymentStatus: record.paymentStatus || '',
                orderRef: (
                  <div className="flex flex-col">
                    <span className="font-bold text-slate-900 text-xs">{cleanOrderNumber}</span>
                    <span className="text-[10px] text-gray-400">
                      {record.createdAt ? new Date(record.createdAt).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : '—'}
                    </span>
                  </div>
                ),
                product: (() => {
                  const prodUrl = record.productId || record.shopifyProductId || record.sku
                    ? getProductUrl({ id: record.productId, shopifyProductId: record.shopifyProductId, sku: record.sku })
                    : undefined;
                  return (
                    <div className="flex items-center gap-3">
                      <ProductThumbnail src={record.imageUrl} alt={record.productTitle} href={prodUrl} />
                      <div className="flex flex-col min-w-0 max-w-[210px]">
                        {prodUrl ? (
                          <Link
                            href={prodUrl}
                            className="font-bold text-slate-900 text-xs truncate hover:underline hover:text-indigo-600 transition-colors"
                            title={record.productTitle || 'Pre-order Item'}
                          >
                            {record.productTitle || 'Pre-order Item'}
                          </Link>
                        ) : (
                          <span className="font-bold text-slate-900 text-xs truncate" title={record.productTitle || 'Pre-order Item'}>
                            {record.productTitle || 'Pre-order Item'}
                          </span>
                        )}
                        {record.variantTitle && (
                          <span className="text-[11px] text-gray-500 font-medium truncate" title={record.variantTitle}>
                            {record.variantTitle}
                          </span>
                        )}
                      </div>
                    </div>
                  );
                })(),
                customer: (
                  <div className="flex flex-col max-w-[170px]">
                    <span className="text-xs font-medium text-slate-800 truncate" title={record.customerName || 'Customer'}>
                      {record.customerName && !record.customerName.includes(':')
                        ? record.customerName
                        : (record.customerEmail ? record.customerEmail.split('@')[0] : 'Customer')}
                    </span>
                    {record.customerEmail && (
                      <span className="text-[11px] text-gray-400 truncate" title={record.customerEmail}>
                        {record.customerEmail}
                      </span>
                    )}
                  </div>
                ),
                totalAmount: (
                  <span className="text-xs font-bold text-slate-900">
                    {currSym}{(record.totalAmount || 0).toFixed(2)}
                  </span>
                ),
                depositAmount: (
                  <span className="text-xs font-semibold text-emerald-700">
                    {currSym}{(record.depositAmount || 0).toFixed(2)}
                  </span>
                ),
                remainingBalance: (
                  <div>
                    {record.remainingBalance > 0 ? (
                      <span className="inline-flex items-center gap-1 text-xs font-extrabold text-amber-600 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-md">
                        {currSym}{(record.remainingBalance || 0).toFixed(2)}
                      </span>
                    ) : (
                      <span className="text-xs font-medium text-emerald-700">
                        {currSym}0.00
                      </span>
                    )}
                  </div>
                ),
                paymentOption: (
                  <span
                    className={`inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold ${
                      record.paymentOption === 'HALF'
                        ? 'bg-blue-50 text-blue-700 border border-blue-200'
                        : 'bg-emerald-50 text-emerald-700 border border-emerald-200'
                    }`}
                  >
                    {record.paymentOption === 'HALF' ? 'Half (50%)' : 'Full (100%)'}
                  </span>
                ),
                paymentStatus: (
                  <span
                    className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-[10px] font-bold ${
                      isPaid
                        ? 'bg-emerald-100 text-emerald-800'
                        : isPartiallyPaid
                        ? 'bg-amber-100 text-amber-800'
                        : 'bg-gray-100 text-gray-800'
                    }`}
                  >
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        isPaid ? 'bg-emerald-600' : isPartiallyPaid ? 'bg-amber-600' : 'bg-gray-500'
                      }`}
                    />
                    {isPaid ? 'Fully Paid' : isPartiallyPaid ? 'Partially Paid' : record.paymentStatus || 'Pending'}
                  </span>
                ),
              };
            })}
            loading={recordsLoading}
            searchable={true}
            searchKey="orderNumber"
            filterable={true}
            filterKey="paymentStatus"
            filterOptions={[
              { label: 'All Statuses', value: 'ALL' },
              { label: 'Partially Paid', value: 'PARTIALLY_PAID' },
              { label: 'Fully Paid', value: 'PAID' },
              { label: 'Pending', value: 'PENDING' },
            ]}
            serverSide={true}
            searchValue={recordsSearch}
            onSearchChange={(val) => {
              setRecordsSearch(val);
            }}
            filterValue={recordsStatus}
            onFilterChange={(val) => {
              setRecordsStatus(val);
              setRecordsPage(1);
              fetchRecords(1, recordsSearch, val);
            }}
            totalItems={recordsTotal}
            page={recordsPage}
            totalPages={recordsTotalPages}
            onPageChange={(p) => {
              setRecordsPage(p);
              fetchRecords(p, recordsSearch, recordsStatus);
            }}
            itemsPerPage={10}
            paginate={true}
          />
        </div>
      )}
    </div>
    </StandaloneGuard>
  );
}
