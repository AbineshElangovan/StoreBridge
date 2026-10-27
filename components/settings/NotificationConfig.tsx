'use client';

import React from 'react';
import { ThemedSection } from '@/components/ui/ThemedSection';
import { Icon, Select } from '@shopify/polaris';
import { 
  AlertTriangleIcon,
  ProductIcon,
  CashDollarIcon,
  RefreshIcon,
  AlertCircleIcon,
  StoreIcon,
  CheckIcon,
  OrderIcon,
  CartIcon,
} from '@shopify/polaris-icons';
import { useTheme } from '@/components/providers/ThemeContext';

export interface NotificationPreferences {
  // Section 1: Store & Inventory Operations Alerts
  notifyLowStock: boolean;
  notifyInventoryUpdate: boolean;
  notifyPriceUpdate: boolean;
  notifySyncUpdate: boolean;
  notifySyncFailure: boolean;
  notifyStoreUpdate: boolean;

  // Section 2: Customer Experience & Demand Alerts (Standalone only)
  notifyPreorder: boolean;
  notifyWaitlist: boolean;
  notifyBackInStock: boolean;
}

export interface StoreOptionItem {
  id: string;
  label: string;
  shopDomain?: string;
  isMaster?: boolean;
  isStandalone?: boolean;
}

interface NotificationConfigProps {
  preferences: NotificationPreferences;
  onChange: (key: keyof NotificationPreferences, value: boolean) => void;
  onSave: () => Promise<void>;
  isSaving: boolean;
  saveSuccess?: boolean;
  isStandalone?: boolean;
  isMaster?: boolean;
  stores?: StoreOptionItem[];
  selectedStoreId?: string;
  onSelectStore?: (storeId: string) => void;
}

interface NotificationCardConfig {
  key: keyof NotificationPreferences;
  title: string;
  description: string;
  icon: any;
  iconTone: 'warning' | 'info' | 'success' | 'critical' | 'subdued' | 'magic';
  badgeBg: string;
  badgeBorder: string;
}

interface NotificationSectionConfig {
  id: string;
  title: string;
  description: string;
  badgeText: string;
  items: NotificationCardConfig[];
}

export function NotificationConfig({
  preferences,
  onChange,
  onSave,
  isSaving,
  saveSuccess = false,
  isStandalone = false,
  isMaster = false,
  stores = [],
  selectedStoreId = '',
  onSelectStore,
}: NotificationConfigProps) {
  const { currentTheme } = useTheme();

  const primaryColor = currentTheme?.primaryColor || 'var(--color-primary, #a7cd18)';
  const primaryTextColor = 'var(--color-primary-text, #000000)';
  const primaryHoverColor = 'var(--color-primary-hover, #96bb13)';
  const sidebarBorder = currentTheme?.sidebarBorder || 'var(--theme-sidebar-border, #91b212)';
  const themeDark = currentTheme?.darkColor || 'var(--color-primary-dark, #022c22)';
  const themeBorder = currentTheme?.navbarBorder || 'var(--theme-border-accent, #34d399)';
  const themeNavbarBg = currentTheme?.navbarBg || '#ffffff';

  // Business Rule: Master and Connected stores in multi-store mode do NOT show Customer Experience.
  // Customer Experience is strictly for Standalone stores (single standalone store without master/connected network).
  const isMultiStoreNetwork = isMaster || (stores && stores.length > 1) || !isStandalone;
  const showCustomerExperience = isStandalone && !isMultiStoreNetwork;

  const sections: NotificationSectionConfig[] = [
    {
      id: 'store-operations',
      title: 'Store Operations & Inventory Alerts',
      description: 'Control real-time notifications for stock levels, price modifications, and multi-store catalog synchronization.',
      badgeText: 'Operations',
      items: [
        {
          key: 'notifyLowStock',
          title: 'Low Stock & Stockout Alerts',
          description: 'Receive notifications when any product inventory drops to or below your configured low stock threshold.',
          icon: AlertTriangleIcon,
          iconTone: 'warning',
          badgeBg: 'bg-amber-50',
          badgeBorder: 'border-amber-200',
        },
        {
          key: 'notifyInventoryUpdate',
          title: 'Inventory & Stock Adjustments',
          description: 'Receive alerts when product stock levels are adjusted manually or synced across your store inventory.',
          icon: ProductIcon,
          iconTone: 'info',
          badgeBg: 'bg-blue-50',
          badgeBorder: 'border-blue-200',
        },
        {
          key: 'notifyPriceUpdate',
          title: 'Price Adjustments & Updates',
          description: 'Receive notifications when product or collection prices, discounts, or margins are modified.',
          icon: CashDollarIcon,
          iconTone: 'success',
          badgeBg: 'bg-emerald-50',
          badgeBorder: 'border-emerald-200',
        },
        {
          key: 'notifySyncUpdate',
          title: isStandalone ? 'Catalog Import & Sync Summaries' : 'Multi-Store Sync & Catalog Summaries',
          description: isStandalone
            ? 'Receive alerts when product catalog imports, updates, and CSV operations complete.'
            : 'Receive notifications when scheduled synchronization, catalog imports, and bulk sync batches complete.',
          icon: RefreshIcon,
          iconTone: 'info',
          badgeBg: 'bg-teal-50',
          badgeBorder: 'border-teal-200',
        },
        {
          key: 'notifySyncFailure',
          title: 'Sync & Integration Failures',
          description: 'Receive immediate high-priority alerts if any product sync job, background task, or webhook operation fails.',
          icon: AlertCircleIcon,
          iconTone: 'critical',
          badgeBg: 'bg-rose-50',
          badgeBorder: 'border-rose-200',
        },
        {
          key: 'notifyStoreUpdate',
          title: isStandalone ? 'Store Configuration & Credential Updates' : 'Connected Store & Network Updates',
          description: isStandalone
            ? 'Receive alerts when store credentials, logos, or app installation settings change.'
            : 'Receive notifications when stores are connected, disconnected, or Master store assignments are modified.',
          icon: StoreIcon,
          iconTone: 'subdued',
          badgeBg: 'bg-indigo-50',
          badgeBorder: 'border-indigo-200',
        },
      ],
    },
    ...(showCustomerExperience ? [{
      id: 'customer-experience',
      title: 'Customer Experience & Demand Alerts',
      description: 'Alerts for shopper pre-orders, out-of-stock customer waitlists, and restock notification events.',
      badgeText: 'Shopper Experience',
      items: [
        {
          key: 'notifyPreorder' as const,
          title: 'Pre-order Orders & Stock Allocation',
          description: 'Receive alerts when shoppers place pre-orders, make deposit or balance payments, or when stock is allocated.',
          icon: OrderIcon,
          iconTone: 'magic' as const,
          badgeBg: 'bg-purple-50',
          badgeBorder: 'border-purple-200',
        },
        {
          key: 'notifyWaitlist' as const,
          title: 'Notify Me (Waitlist) Signups',
          description: 'Receive alerts when customers subscribe to restock waitlists on out-of-stock products to monitor demand.',
          icon: CartIcon,
          iconTone: 'info' as const,
          badgeBg: 'bg-cyan-50',
          badgeBorder: 'border-cyan-200',
        },
        {
          key: 'notifyBackInStock' as const,
          title: 'Back In Stock Restock Dispatches',
          description: 'Receive alerts when restocked inventory triggers automated customer notifications and queue dispatches.',
          icon: CheckIcon,
          iconTone: 'success' as const,
          badgeBg: 'bg-emerald-50',
          badgeBorder: 'border-emerald-200',
        },
      ],
    }] : []),
  ];

  const allKeys = sections.flatMap((s) => s.items.map((i) => i.key));

  const handleToggleAll = (enabled: boolean) => {
    allKeys.forEach((key) => {
      onChange(key, enabled);
    });
  };

  const enabledCount = allKeys.filter((key) => !!preferences[key]).length;

  return (
    <ThemedSection
      title="Notification Configuration"
    >
      <div className="flex flex-col gap-4 sm:gap-6 mt-1 w-full min-w-0 max-w-full">
        {/* Main Note Banner: Professional Info Blue (Not theme color) */}
        <div className="p-3 sm:p-3.5 bg-blue-50/80 border border-blue-200/90 rounded-xl text-xs sm:text-sm flex flex-col sm:flex-row items-start gap-2 sm:gap-2.5 text-blue-950 shadow-2xs w-full min-w-0">
          <span className="font-black text-blue-700 shrink-0">Note:</span>
          <span className="font-semibold text-blue-900 leading-relaxed break-words">
            When you enable a notification, real-time alerts and activity updates are triggered across your store network. When disabled, notifications are suppressed and will not be created.
          </span>
        </div>

        {/* Control Card: Active Notifications Counter, Master Store Selector & Global Toggle Buttons */}
        <div className="p-3.5 sm:p-4 bg-white rounded-xl border border-gray-200/90 shadow-2xs flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3 sm:gap-4 w-full min-w-0">
          {/* Active Notifications Counter */}
          <div className="flex items-center gap-2 flex-wrap shrink-0">
            <span className="text-sm font-black text-gray-800">Active Notifications:</span>
            <span
              className="px-3 py-0.5 rounded-full text-xs font-black"
              style={{
                backgroundColor: 'var(--color-primary-light)',
                color: 'var(--color-primary-dark, var(--color-primary))',
                border: '1px solid var(--theme-border-accent, var(--color-primary))',
              }}
            >
              {enabledCount} of {allKeys.length} Enabled
            </span>
          </div>

          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5 sm:gap-3 shrink-0">
            {/* Master Store Selector Dropdown (Filter-like with active Theme styling matching Price Adjustment) */}
            {isMaster && stores && stores.length > 1 && (
              <div
                className="flex items-center gap-2.5 px-3 sm:px-4 py-1.5 sm:py-2 rounded-xl shadow-2xs transition-colors w-full sm:w-auto"
                style={{
                  backgroundColor: themeNavbarBg,
                  border: `1.5px solid ${themeBorder}`,
                }}
              >
                <label
                  htmlFor="notification-master-store-select"
                  className="text-xs sm:text-sm font-bold whitespace-nowrap shrink-0"
                  style={{ color: themeDark }}
                >
                  Select Store:
                </label>
                <div className="w-full sm:min-w-[200px]">
                  <Select
                    label="Select Store"
                    labelHidden
                    id="notification-master-store-select"
                    value={selectedStoreId || stores.find((s) => s.isMaster)?.id || stores[0]?.id || ''}
                    onChange={onSelectStore || (() => {})}
                    options={stores.map((s) => ({
                      label: s.label,
                      value: s.id,
                    }))}
                  />
                </div>
              </div>
            )}

            {/* Quick Action Buttons */}
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button
                type="button"
                onClick={() => handleToggleAll(true)}
                className="flex-1 sm:flex-initial px-3.5 py-1.5 text-xs font-extrabold rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-800 shadow-2xs transition-all cursor-pointer active:scale-95 text-center justify-center whitespace-nowrap"
              >
                Enable All
              </button>
              <button
                type="button"
                onClick={() => handleToggleAll(false)}
                className="flex-1 sm:flex-initial px-3.5 py-1.5 text-xs font-extrabold rounded-lg border border-gray-200 bg-white hover:bg-gray-50 text-gray-800 shadow-2xs transition-all cursor-pointer active:scale-95 text-center justify-center whitespace-nowrap"
              >
                Disable All
              </button>
            </div>
          </div>
        </div>

        {/* Sections */}
        {sections.map((section, idx) => {
          const sectionEnabledCount = section.items.filter((i) => !!preferences[i.key]).length;

          return (
            <div
              key={section.id}
              className="p-4 sm:p-5 md:p-6 bg-white/95 rounded-xl sm:rounded-2xl border border-gray-200/90 shadow-2xs flex flex-col gap-4 w-full min-w-0"
            >
              {/* Section Header with Bold Heading, Badge, Counter, and Non-Theme Note Callout */}
              <div className="flex flex-col gap-3 pb-3.5 border-b border-gray-100 w-full min-w-0">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2.5 sm:gap-3 w-full min-w-0">
                  <div className="flex items-center gap-2.5 flex-wrap min-w-0">
                    <span className="w-6 h-6 rounded-full text-xs font-black flex items-center justify-center shrink-0 bg-slate-100 text-slate-800 border border-slate-300">
                      {idx + 1}
                    </span>
                    <h3 className="text-base sm:text-lg md:text-xl font-black text-gray-900 tracking-tight m-0 break-words">
                      {section.title}
                    </h3>
                    <span className="inline-block px-2.5 py-0.5 text-[10px] sm:text-[11px] font-black uppercase tracking-wider rounded-md bg-slate-100 text-slate-700 border border-slate-200 shrink-0">
                      {section.badgeText}
                    </span>
                  </div>

                  {/* Section Active Counter */}
                  <div className="flex items-center gap-2 shrink-0 self-start sm:self-auto">
                    <span
                      className="px-3 py-1 rounded-full text-xs font-black"
                      style={{
                        backgroundColor: 'var(--color-primary-light)',
                        color: 'var(--color-primary-dark, var(--color-primary))',
                        border: '1px solid var(--theme-border-accent)',
                      }}
                    >
                      {sectionEnabledCount} of {section.items.length} Active
                    </span>
                  </div>
                </div>

                {/* Section Note (Bold and NOT theme color - Info Blue Style) */}
                <div className="p-2.5 sm:p-3 bg-blue-50/80 border border-blue-200/90 rounded-xl text-xs sm:text-sm flex items-start gap-2 text-blue-950 shadow-2xs w-full min-w-0">
                  <span className="font-black text-blue-700 shrink-0">Note:</span>
                  <span className="font-semibold text-blue-900 leading-relaxed break-words">
                    {section.description}
                  </span>
                </div>
              </div>

              {/* Cards Grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4 w-full min-w-0">
                {section.items.map((item) => {
                  const isChecked = !!preferences[item.key];
                  return (
                    <div
                      key={item.key}
                      onClick={() => onChange(item.key, !isChecked)}
                      className={`p-3.5 sm:p-4 md:p-4.5 rounded-xl border transition-all duration-200 cursor-pointer flex flex-col justify-between gap-3 select-none w-full min-w-0 ${
                        isChecked
                          ? 'bg-white border-gray-300 shadow-2xs hover:shadow-xs'
                          : 'bg-gray-50/60 border-gray-200/70 opacity-75 hover:opacity-100 hover:bg-white'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 w-full min-w-0">
                        <div className="flex items-start gap-2.5 sm:gap-3 min-w-0 flex-1">
                          <div
                            className={`w-9 sm:w-10 h-9 sm:h-10 rounded-xl flex items-center justify-center shrink-0 border ${item.badgeBg} ${item.badgeBorder}`}
                          >
                            <div style={{ width: 18, height: 18 }}>
                              <Icon source={item.icon} tone={item.iconTone} />
                            </div>
                          </div>

                          <div className="min-w-0 flex-1">
                            <h4 className="text-xs sm:text-sm md:text-base font-black text-gray-900 tracking-tight leading-snug m-0 break-words">
                              {item.title}
                            </h4>
                          </div>
                        </div>

                        {/* Toggle switch */}
                        <div className="shrink-0 pt-0.5">
                          <button
                            type="button"
                            role="switch"
                            aria-checked={isChecked}
                            onClick={(e) => {
                              e.stopPropagation();
                              onChange(item.key, !isChecked);
                            }}
                            className="relative inline-flex items-center cursor-pointer p-0 bg-transparent border-0 outline-none focus:outline-none"
                          >
                            <span
                              className="w-11 h-6 rounded-full transition-colors duration-200 ease-in-out relative block"
                              style={{
                                backgroundColor: isChecked ? primaryColor : '#e5e7eb',
                              }}
                            >
                              <span
                                className={`inline-block w-5 h-5 bg-white rounded-full shadow-md transform transition-transform duration-200 ease-in-out absolute top-[2px] left-[2px] ${
                                  isChecked ? 'translate-x-5' : 'translate-x-0'
                                }`}
                              />
                            </span>
                          </button>
                        </div>
                      </div>

                      <p className="text-xs sm:text-sm text-gray-500 font-medium leading-relaxed m-0 break-words">
                        {item.description}
                      </p>
                    </div>
                  );
                })}
              </div>

              {/* Save Bar - Embedded within the card */}
              <div className="mt-3 pt-4 border-t border-gray-100 flex items-center justify-end gap-3 w-full min-w-0">
                {saveSuccess && (
                  <span className="text-xs sm:text-sm font-black text-emerald-600 flex items-center gap-1.5 shrink-0 animate-in fade-in duration-200">
                    <div style={{ width: 16, height: 16 }}>
                      <Icon source={CheckIcon} tone="success" />
                    </div>
                    Saved!
                  </span>
                )}
                <button
                  type="button"
                  disabled={isSaving}
                  onClick={onSave}
                  className="w-full sm:w-auto px-6 py-2.5 sm:py-3 text-sm sm:text-base font-black rounded-lg transition-all shadow-2xs disabled:opacity-50 cursor-pointer flex items-center justify-center gap-2"
                  style={{
                    backgroundColor: primaryColor,
                    color: primaryTextColor,
                    border: `1.5px solid ${sidebarBorder}`,
                  }}
                  onMouseEnter={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = primaryHoverColor;
                  }}
                  onMouseLeave={(e) => {
                    (e.currentTarget as HTMLButtonElement).style.backgroundColor = primaryColor;
                  }}
                >
                  {isSaving ? (
                    <>
                      <span className="w-4 h-4 border-2 border-black border-t-transparent rounded-full animate-spin" />
                      <span>Saving...</span>
                    </>
                  ) : (
                    'Save Notification'
                  )}
                </button>
              </div>
            </div>
          );
        })}
      </div>
    </ThemedSection>
  );
}
