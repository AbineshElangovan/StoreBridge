'use client';

import React, { useState, useCallback, useEffect } from 'react';
import {
  Modal,
  DropZone,
  Thumbnail,
  Banner,
  TextField,
  ProgressBar,
  Button,
  ButtonGroup,
  InlineStack,
  BlockStack,
  Text,
  Box,
  Divider,
  Tabs,
  Icon,
} from '@shopify/polaris';
import {
  ImageIcon,
  UploadIcon,
  DeleteIcon,
} from '@shopify/polaris-icons';
import { shopifyFetch } from '@/lib/shopify/Client';
import {
  optimizeImageIfNeeded,
  validateImageFile,
  MAX_INPUT_FILE_SIZE,
} from '@/lib/utils/imageOptimizer';

interface ProductImageModalProps {
  open: boolean;
  productId: string;
  currentImageUrl?: string | null;
  productTitle: string;
  onClose: () => void;
  onImageUpdated: (newImageUrl: string | null) => void;
}

export function ProductImageModal({
  open,
  productId,
  currentImageUrl,
  productTitle,
  onClose,
  onImageUpdated,
}: ProductImageModalProps) {
  const [selectedTab, setSelectedTab] = useState(0);

  // Method A: URL state
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [urlPreviewValid, setUrlPreviewValid] = useState(false);
  const [urlTestError, setUrlTestError] = useState<string | null>(null);

  // Method B: Photo Upload state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [filePreviewUrl, setFilePreviewUrl] = useState<string | null>(null);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [optimizationNote, setOptimizationNote] = useState<string | null>(null);

  // Common UI State
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [statusText, setStatusText] = useState<string | null>(null);

  const tabs = [
    { id: 'upload-photo', content: 'Upload Photo' },
    { id: 'image-url', content: 'Image URL' },
  ];

  // Clean up Object URL preview on unmount/change
  useEffect(() => {
    return () => {
      if (filePreviewUrl) {
        URL.revokeObjectURL(filePreviewUrl);
      }
    };
  }, [filePreviewUrl]);

  // Reset modal state on open/close
  useEffect(() => {
    if (open) {
      setErrorMessage(null);
      setSuccessMessage(null);
      setStatusText(null);
      setSelectedFile(null);
      setFilePreviewUrl(null);
      setImageUrlInput('');
      setUrlPreviewValid(false);
      setUrlTestError(null);
      setOptimizationNote(null);
    }
  }, [open]);

  // Handle URL change & live reachability / security check
  const handleUrlChange = useCallback((value: string) => {
    setImageUrlInput(value);
    setErrorMessage(null);
    if (!value.trim()) {
      setUrlPreviewValid(false);
      setUrlTestError(null);
      return;
    }
    try {
      const parsed = new URL(value.trim());
      if (parsed.protocol !== 'https:') {
        setUrlPreviewValid(false);
        setUrlTestError('URL must use secure HTTPS.');
        return;
      }
      const host = parsed.hostname.toLowerCase();
      if (
        host === 'localhost' ||
        host === '127.0.0.1' ||
        host.startsWith('192.168.') ||
        host.startsWith('10.') ||
        host.startsWith('169.254.')
      ) {
        setUrlPreviewValid(false);
        setUrlTestError('Access to internal or loopback addresses is restricted.');
        return;
      }

      // Test load image in browser
      const testImg = new window.Image();
      testImg.onload = () => {
        setUrlPreviewValid(true);
        setUrlTestError(null);
      };
      testImg.onerror = () => {
        setUrlPreviewValid(false);
        setUrlTestError('Link is unreachable or does not point to a valid image file.');
      };
      testImg.src = value.trim();
    } catch {
      setUrlPreviewValid(false);
      setUrlTestError('Invalid URL format.');
    }
  }, []);

  // Handle DropZone file drop
  const handleDropZoneDrop = useCallback(
    async (_dropFiles: File[], acceptedFiles: File[], _rejectedFiles: File[]) => {
      setErrorMessage(null);
      setSuccessMessage(null);
      setOptimizationNote(null);

      if (acceptedFiles.length === 0) return;
      const rawFile = acceptedFiles[0];

      // Validate file before optimization
      const validation = await validateImageFile(rawFile);
      if (!validation.valid) {
        setErrorMessage(validation.error || 'Invalid image file.');
        return;
      }

      // Check if file is large and needs optimization
      if (rawFile.size > 20 * 1024 * 1024) {
        setIsOptimizing(true);
        setStatusText('Optimizing image to 4K Shopify-compatible file...');
      }

      try {
        const result = await optimizeImageIfNeeded(rawFile, (msg) => setStatusText(msg));
        if (!result.valid || !result.file) {
          setErrorMessage(result.error || 'Failed to process image file.');
          setIsOptimizing(false);
          setStatusText(null);
          return;
        }

        setSelectedFile(result.file);
        if (filePreviewUrl) URL.revokeObjectURL(filePreviewUrl);
        const previewUrl = URL.createObjectURL(result.file);
        setFilePreviewUrl(previewUrl);

        if (result.wasOptimized) {
          const origMb = (result.originalSize / (1024 * 1024)).toFixed(1);
          const optMb = (result.optimizedSize! / (1024 * 1024)).toFixed(1);
          setOptimizationNote(
            `Original file (${origMb} MB) automatically optimized to crisp 4K quality (${optMb} MB) to meet Shopify's 20 MB product limit.`
          );
        }
      } catch (err: any) {
        setErrorMessage(`Error preparing image: ${err.message}`);
      } finally {
        setIsOptimizing(false);
        setStatusText(null);
      }
    },
    [filePreviewUrl]
  );

  // Submit Photo Upload
  const handleUploadPhoto = async () => {
    if (!selectedFile) {
      setErrorMessage('Please select a photo to upload.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setStatusText(currentImageUrl ? 'Replacing photo in Shopify...' : 'Uploading photo to Shopify...');

    try {
      const formData = new FormData();
      formData.append('file', selectedFile);
      formData.append('altText', productTitle);

      const res = await shopifyFetch(`/api/products/${encodeURIComponent(productId)}/media`, {
        method: 'POST',
        body: formData,
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to upload photo to Shopify.');
      }

      setSuccessMessage(
        currentImageUrl
          ? 'Product image replaced and synchronized with Shopify successfully!'
          : 'Photo uploaded and synchronized with Shopify successfully!'
      );
      onImageUpdated(data.imageUrl);
      setTimeout(() => onClose(), 1200);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error uploading photo.');
    } finally {
      setIsSubmitting(false);
      setStatusText(null);
    }
  };

  // Submit Image URL
  const handleAttachUrl = async () => {
    if (!imageUrlInput.trim()) {
      setErrorMessage('Please enter a valid image URL.');
      return;
    }

    setIsSubmitting(true);
    setErrorMessage(null);
    setStatusText(currentImageUrl ? 'Replacing image URL in Shopify...' : 'Attaching image URL and synchronizing with Shopify...');

    try {
      const res = await shopifyFetch(`/api/products/${encodeURIComponent(productId)}/media`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          imageUrl: imageUrlInput.trim(),
          altText: productTitle,
        }),
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to attach image URL in Shopify.');
      }

      setSuccessMessage(
        currentImageUrl
          ? 'Product image replaced and synchronized with Shopify successfully!'
          : 'Image URL attached and synchronized with Shopify successfully!'
      );
      onImageUpdated(data.imageUrl);
      setTimeout(() => onClose(), 1200);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error attaching image URL.');
    } finally {
      setIsSubmitting(false);
      setStatusText(null);
    }
  };

  // Remove / Delete Image
  const handleDeleteImage = async () => {
    if (!currentImageUrl) return;

    setIsDeleting(true);
    setErrorMessage(null);
    setStatusText('Removing image from Shopify...');

    try {
      const res = await shopifyFetch(`/api/products/${encodeURIComponent(productId)}/media`, {
        method: 'DELETE',
      });

      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || 'Failed to remove image in Shopify.');
      }

      setSuccessMessage('Product image removed successfully.');
      onImageUpdated(null);
      setTimeout(() => onClose(), 1200);
    } catch (err: any) {
      setErrorMessage(err.message || 'Error removing image.');
    } finally {
      setIsDeleting(false);
      setStatusText(null);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={currentImageUrl ? "Replace Product Image" : "Product Image Management"}
      primaryAction={{
        content: isSubmitting
          ? 'Saving to Shopify...'
          : currentImageUrl
          ? 'Replace Image in Shopify'
          : 'Save to Shopify',
        loading: isSubmitting,
        disabled: isSubmitting || isDeleting || isOptimizing || (selectedTab === 0 ? !selectedFile : !urlPreviewValid),
        onAction: selectedTab === 0 ? handleUploadPhoto : handleAttachUrl,
      }}
      secondaryActions={[
        {
          content: 'Cancel',
          disabled: isSubmitting || isDeleting,
          onAction: onClose,
        },
      ]}
    >
      <Modal.Section>
        <BlockStack gap="400">
          {/* Error Banner */}
          {errorMessage && (
            <Banner title="Image operation failed" tone="critical" onDismiss={() => setErrorMessage(null)}>
              <p>{errorMessage}</p>
            </Banner>
          )}

          {/* Success Banner */}
          {successMessage && (
            <Banner title="Success" tone="success">
              <p>{successMessage}</p>
            </Banner>
          )}

          {/* Optimization Note */}
          {optimizationNote && (
            <Banner title="4K Optimization Applied" tone="info">
              <p>{optimizationNote}</p>
            </Banner>
          )}

          {/* Current vs New Image Comparison */}
          {currentImageUrl && (
            <Box padding="300" background="bg-surface-secondary" borderRadius="200">
              <InlineStack align="space-between" blockAlign="center">
                <InlineStack gap="300" blockAlign="center">
                  <Thumbnail source={currentImageUrl} alt={productTitle} size="small" />
                  <BlockStack gap="050">
                    <Text variant="bodySm" fontWeight="bold" as="p">
                      Current Product Image
                    </Text>
                    <Text variant="bodyXs" tone="subdued" as="p">
                      Saving a new photo or URL will replace this image in Shopify.
                    </Text>
                  </BlockStack>
                </InlineStack>
                <Button
                  tone="critical"
                  variant="plain"
                  icon={DeleteIcon}
                  loading={isDeleting}
                  disabled={isSubmitting || isDeleting}
                  onClick={handleDeleteImage}
                >
                  Remove Image
                </Button>
              </InlineStack>
            </Box>
          )}

          {/* Progress Indicator */}
          {(isSubmitting || isOptimizing || isDeleting) && (
            <BlockStack gap="200">
              <ProgressBar size="small" tone="primary" />
              {statusText && (
                <Text variant="bodySm" tone="subdued" as="p">
                  {statusText}
                </Text>
              )}
            </BlockStack>
          )}

          <Divider />

          {/* Tab Navigation: Photo Upload vs Image URL */}
          <Tabs tabs={tabs} selected={selectedTab} onSelect={setSelectedTab} fitted>
            <Box paddingBlockStart="300">
              {selectedTab === 0 ? (
                /* Tab 1: Photo Upload */
                <BlockStack gap="300">
                  <DropZone
                    allowMultiple={false}
                    onDrop={handleDropZoneDrop}
                    accept="image/jpeg,image/png,image/webp"
                    type="image"
                    disabled={isSubmitting || isOptimizing}
                  >
                    {filePreviewUrl ? (
                      <Box padding="400">
                        <InlineStack gap="400" blockAlign="center">
                          <Thumbnail source={filePreviewUrl} alt="New upload preview" size="large" />
                          <BlockStack gap="100">
                            <Text variant="bodyMd" fontWeight="bold" as="p">
                              {selectedFile?.name}
                            </Text>
                            <Text variant="bodySm" tone="subdued" as="p">
                              Size: {((selectedFile?.size || 0) / (1024 * 1024)).toFixed(2)} MB
                            </Text>
                            <Text variant="bodyXs" tone="success" as="p">
                              Ready for upload. Click or drop to replace.
                            </Text>
                          </BlockStack>
                        </InlineStack>
                      </Box>
                    ) : (
                      <DropZone.FileUpload
                        actionTitle="Add Photo"
                        actionHint="Accepts JPG, PNG, WebP up to 100 MB. High-res files automatically optimized to 4K."
                      />
                    )}
                  </DropZone>
                </BlockStack>
              ) : (
                /* Tab 2: Image URL */
                <BlockStack gap="300">
                  <TextField
                    label="Public HTTPS Image URL"
                    value={imageUrlInput}
                    onChange={handleUrlChange}
                    autoComplete="off"
                    placeholder="https://images.example.com/product.jpg"
                    helpText="Must be a direct, publicly accessible HTTPS link (JPEG, PNG, or WebP)."
                    error={urlTestError || undefined}
                    disabled={isSubmitting}
                  />

                  {urlPreviewValid && imageUrlInput && (
                    <Box padding="300" background="bg-surface-secondary" borderRadius="200">
                      <InlineStack gap="300" blockAlign="center">
                        <Thumbnail
                          source={imageUrlInput}
                          alt="URL Image preview"
                          size="medium"
                        />
                        <BlockStack gap="050">
                          <Text variant="bodySm" fontWeight="bold" tone="success" as="p">
                            ✓ Verified Secure Image URL
                          </Text>
                          <Text variant="bodyXs" tone="subdued" as="p">
                            Image is reachable and will be synced to Shopify's CDN upon saving.
                          </Text>
                        </BlockStack>
                      </InlineStack>
                    </Box>
                  )}
                </BlockStack>
              )}
            </Box>
          </Tabs>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
