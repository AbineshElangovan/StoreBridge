'use client';

import React from 'react';
import {
  Modal,
  BlockStack,
  Checkbox,
  Banner,
  Text,
  Box,
} from '@shopify/polaris';

import { Button } from '@/components/common/Button';

export interface NotificationPreferences {
  notifyLowStock: boolean;
  notifyInventoryUpdate: boolean;
  notifyPriceUpdate: boolean;
  notifySyncUpdate: boolean;
  notifySyncFailure: boolean;
  notifyStoreUpdate: boolean;
}

interface NotificationPreferencesModalProps {
  open: boolean;
  onClose: () => void;
  prefs: NotificationPreferences;
  onChange: (newPrefs: NotificationPreferences) => void;
  onSave: () => void;
  saving?: boolean;
  saveSuccess?: boolean;
}

export function NotificationPreferencesModal({
  open,
  onClose,
  prefs,
  onChange,
  onSave,
  saving = false,
  saveSuccess = false,
}: NotificationPreferencesModalProps) {
  const toggle = (key: keyof NotificationPreferences) => {
    onChange({
      ...prefs,
      [key]: !prefs[key],
    });
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Notification Preferences"
    >
      <Modal.Section>
        <BlockStack gap="400">
          {saveSuccess && (
            <Banner tone="success">
              <p>Notification preferences saved successfully.</p>
            </Banner>
          )}

          <Text as="p" variant="bodySm" tone="subdued">
            Choose which real-time notifications you want to receive across your stores.
          </Text>

          <Box paddingBlockStart="200">
            <BlockStack gap="400">
              <Checkbox
                label="Low Stock Alerts"
                helpText="Receive alerts when product inventory drops below your low stock threshold."
                checked={prefs.notifyLowStock}
                onChange={() => toggle('notifyLowStock')}
              />

              <Checkbox
                label="Inventory Updates"
                helpText="Receive notifications when stock levels are adjusted or synced."
                checked={prefs.notifyInventoryUpdate}
                onChange={() => toggle('notifyInventoryUpdate')}
              />

              <Checkbox
                label="Price Updates"
                helpText="Receive notifications when product or collection prices are updated."
                checked={prefs.notifyPriceUpdate}
                onChange={() => toggle('notifyPriceUpdate')}
              />

              <Checkbox
                label="Product & Store Updates"
                helpText="Receive notifications when products are created, updated, or deleted across stores."
                checked={prefs.notifyStoreUpdate}
                onChange={() => toggle('notifyStoreUpdate')}
              />

              <Checkbox
                label="Sync Success Summaries"
                helpText="Receive notifications when bulk multi-store synchronization completes."
                checked={prefs.notifySyncUpdate}
                onChange={() => toggle('notifySyncUpdate')}
              />

              <Checkbox
                label="Sync Failure Alerts"
                helpText="Receive instant alerts if a product sync or API request fails."
                checked={prefs.notifySyncFailure}
                onChange={() => toggle('notifySyncFailure')}
              />
            </BlockStack>
          </Box>

          {/* Bottom Action Buttons: White Cancel & Green Save Preferences */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-gray-200 mt-2">
            <Button
              variant="white"
              onClick={onClose}
              disabled={saving}
            >
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={onSave}
              loading={saving}
            >
              Save Preferences
            </Button>
          </div>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
