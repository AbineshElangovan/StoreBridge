'use client';

import React, { useState } from 'react';
import {
  Card,
  BlockStack,
  InlineStack,
  Text,
  Badge,
  Button,
  Box,
  Icon,
  Tooltip,
} from '@shopify/polaris';
import {
  DeleteIcon,
  CheckIcon,
  AlertCircleIcon,
  OrderIcon,
  RefreshIcon,
  CartIcon,
  StoreIcon,
  ProductIcon,
} from '@shopify/polaris-icons';

export interface NotificationItem {
  id: string;
  type: string;
  title: string;
  message: string;
  productId?: string | null;
  productTitle?: string | null;
  sku?: string | null;
  imageUrl?: string | null;
  isRead: boolean;
  createdAt: string;
  metadata?: {
    syncPending?: boolean;
    syncAction?: 'UPDATE' | 'CREATE' | 'DELETE';
    syncStatus?: 'PENDING' | 'ACCEPTED' | 'DECLINED';
    payload?: any;
  } | null;
  recipientStore?: {
    id: string;
    label?: string | null;
    shopDomain: string;
    isMaster: boolean;
  } | null;
}

interface NotificationCardProps {
  item: NotificationItem;
  onMarkAsRead: (id: string) => void;
  onDelete: (id: string) => void;
}

function getRelativeTime(dateString: string): string {
  const date = new Date(dateString);
  const now = new Date();
  const seconds = Math.floor((now.getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'Just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} hr ago`;
  const days = Math.floor(hours / 24);
  return `${days} d ago`;
}

function getTypeBadge(type: string): { label: string; tone: 'critical' | 'warning' | 'info' | 'success' | 'attention'; iconSource: any } {
  switch (type) {
    case 'OUT_OF_STOCK':
      return { label: 'Out of Stock', tone: 'critical', iconSource: AlertCircleIcon };
    case 'LOW_STOCK':
    case 'STOCKOUT_RISK':
      return { label: 'Low Stock', tone: 'warning', iconSource: AlertCircleIcon };
    case 'PRICE_UPDATE':
      return { label: 'Price Update', tone: 'success', iconSource: CartIcon };
    case 'INVENTORY_UPDATE':
      return { label: 'Inventory Update', tone: 'warning', iconSource: OrderIcon };
    case 'SYNC_UPDATE':
      return { label: 'Sync Request', tone: 'info', iconSource: RefreshIcon };
    case 'SYNC_FAILURE':
      return { label: 'Sync Failure', tone: 'critical', iconSource: AlertCircleIcon };
    case 'CONNECTED_STORE_UPDATE':
      return { label: 'Connected Store', tone: 'attention', iconSource: StoreIcon };
    default:
      return { label: 'Product Update', tone: 'info', iconSource: ProductIcon };
  }
}

export function NotificationCard({
  item,
  onMarkAsRead,
  onDelete,
}: NotificationCardProps) {
  const [imgError, setImgError] = useState(false);
  const [isSyncing, setIsSyncing] = useState(false);
  const [syncStatus, setSyncStatus] = useState<'PENDING' | 'ACCEPTED' | 'DECLINED' | null>(
    item.metadata?.syncStatus || (item.metadata?.syncPending ? 'PENDING' : null)
  );

  const badgeInfo = getTypeBadge(item.type);
  const storeLabel = item.recipientStore?.label || item.recipientStore?.shopDomain || 'Store';
  const isMaster = item.recipientStore?.isMaster || false;

  const handleSyncAction = async (action: 'ACCEPT' | 'DECLINE') => {
    setIsSyncing(true);
    try {
      const { shopifyFetch } = await import('@/lib/shopify/Client');
      const res = await shopifyFetch(`/api/notifications/${item.id}/sync-action`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action }),
      });
      const json = await res.json().catch(() => ({ success: false }));

      if (res.ok && json.success) {
        setSyncStatus(action === 'ACCEPT' ? 'ACCEPTED' : 'DECLINED');
        onMarkAsRead(item.id);
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent('notification-updated'));
        }
      }
    } catch (err) {
      console.error('[NotificationCard] Sync action error:', err);
    } finally {
      setIsSyncing(false);
    }
  };

  return (
    <Card>
      <BlockStack gap="300">
        {/* Top Header: Badge, Unread status, Store & Time */}
        <InlineStack align="space-between" blockAlign="center">
          <InlineStack gap="200" blockAlign="center">
            <Badge tone={badgeInfo.tone} size="small">
              {badgeInfo.label}
            </Badge>
            {!item.isRead && (
              <span className="w-2 h-2 rounded-full bg-teal-500 inline-block animate-pulse" title="Unread" />
            )}
            <Text variant="headingSm" as="h3" fontWeight="bold">
              {item.title}
            </Text>
          </InlineStack>

          <InlineStack gap="200" blockAlign="center">
            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold ${
              isMaster ? 'bg-emerald-100 text-emerald-800 border border-emerald-200' : 'bg-teal-100 text-teal-800 border border-teal-200'
            }`}>
              {storeLabel}
            </span>
            <Text variant="bodySm" tone="subdued" as="span">
              • {getRelativeTime(item.createdAt)}
            </Text>
          </InlineStack>
        </InlineStack>

        {/* Middle Section: Product Image + Message Details */}
        <div className="flex items-start gap-3 mt-1">
          {item.imageUrl && !imgError ? (
            <div className="w-12 h-12 rounded-lg bg-gray-50 flex-shrink-0 border border-gray-200 overflow-hidden shadow-2xs flex items-center justify-center">
              <img
                src={item.imageUrl}
                alt=""
                className="w-full h-full object-cover"
                onError={() => setImgError(true)}
              />
            </div>
          ) : (
            <div className="w-12 h-12 rounded-lg bg-teal-50/50 flex-shrink-0 border border-teal-100 flex items-center justify-center text-teal-600">
              <div style={{ width: 22, height: 22 }}>
                <Icon source={badgeInfo.iconSource} />
              </div>
            </div>
          )}

          <div className="flex-1 min-w-0">
            {item.productTitle && (
              <Text variant="bodyMd" fontWeight="semibold" as="p">
                {item.productTitle}
              </Text>
            )}
            {item.sku && (
              <Text variant="bodyXs" tone="subdued" as="p">
                SKU: {item.sku}
              </Text>
            )}
            <Text variant="bodySm" as="p" tone={item.isRead ? 'subdued' : 'base'}>
              {item.message}
            </Text>

            {/* Sync Action Buttons: Yes, Sync / No, Skip */}
            {syncStatus === 'PENDING' ? (
              <div className="flex items-center gap-2 mt-3 pt-2.5 border-t border-gray-100">
                <button
                  type="button"
                  onClick={() => handleSyncAction('ACCEPT')}
                  disabled={isSyncing}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-bold text-white bg-[#0db69d] hover:bg-[#0b9c86] shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                >
                  {isSyncing ? 'Syncing...' : 'Yes, Sync'}
                </button>
                <button
                  type="button"
                  onClick={() => handleSyncAction('DECLINE')}
                  disabled={isSyncing}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-semibold text-gray-700 bg-gray-100 hover:bg-gray-200 border border-gray-300 shadow-2xs transition-all cursor-pointer disabled:opacity-50"
                >
                  No, Skip
                </button>
              </div>
            ) : syncStatus === 'ACCEPTED' ? (
              <div className="mt-2">
                <span className="inline-flex items-center gap-1 text-[11px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 px-2.5 py-0.5 rounded-full">
                  ✓ Synced to store
                </span>
              </div>
            ) : syncStatus === 'DECLINED' ? (
              <div className="mt-2">
                <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-gray-500 bg-gray-100 border border-gray-200 px-2.5 py-0.5 rounded-full">
                  ✕ Sync skipped
                </span>
              </div>
            ) : null}
          </div>
        </div>

        {/* Bottom Actions: Read Status & Delete */}
        <Box paddingBlockStart="200" borderBlockStartWidth="025" borderColor="border-secondary">
          <InlineStack align="space-between" blockAlign="center">
            <div>
              {item.isRead ? (
                <span className="text-xs text-gray-400 font-medium">
                  Read
                </span>
              ) : (
                <button
                  type="button"
                  onClick={() => onMarkAsRead(item.id)}
                  className="inline-flex items-center gap-1 text-xs font-bold text-[#0db69d] hover:text-[#0b9c86] transition-colors cursor-pointer"
                >
                  <div style={{ width: 14, height: 14 }}>
                    <CheckIcon />
                  </div>
                  Mark as read
                </button>
              )}
            </div>

            <button
              type="button"
              onClick={() => onDelete(item.id)}
              className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium text-red-600 bg-red-50 hover:bg-red-100 transition-colors cursor-pointer border border-red-100 shadow-2xs"
            >
              <div style={{ width: 14, height: 14 }} className="[&_svg]:fill-red-600 [&_svg]:text-red-600 text-red-600 flex items-center justify-center">
                <DeleteIcon />
              </div>
              <span>Delete</span>
            </button>
          </InlineStack>
        </Box>
      </BlockStack>
    </Card>
  );
}
