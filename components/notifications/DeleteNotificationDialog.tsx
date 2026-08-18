'use client';

import React from 'react';
import { Modal, Text, BlockStack, Banner } from '@shopify/polaris';
import { Button } from '@/components/common/Button';

interface DeleteNotificationDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  loading?: boolean;
}

export function DeleteNotificationDialog({
  open,
  onClose,
  onConfirm,
  loading = false,
}: DeleteNotificationDialogProps) {
  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Delete all notifications?"
    >
      <Modal.Section>
        <BlockStack gap="400">
          <Banner tone="critical">
            <p>This action cannot be undone.</p>
          </Banner>
          <Text as="p" variant="bodyMd">
            This will permanently remove all notifications for this store network. Are you sure you want to proceed?
          </Text>

          {/* Bottom Action Buttons: White Cancel & Dark Red Delete All */}
          <div className="flex items-center justify-end gap-2.5 pt-4 border-t border-gray-200 mt-2">
            <Button
              variant="white"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </Button>
            <Button
              variant="destructive"
              onClick={onConfirm}
              loading={loading}
            >
              Delete All
            </Button>
          </div>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
