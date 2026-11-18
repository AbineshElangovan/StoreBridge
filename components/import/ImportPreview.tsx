import React, { useState, useEffect } from 'react';
import { ConfirmToast } from '@/components/ui/ConfirmToast';
import { ImportIcon, AttachmentIcon } from '@shopify/polaris-icons';

interface ImportPreviewProps {
  products: any[];
  validationErrors: { row: number; error: string }[];
  onImport: (
    pickedFiles: Record<string, File>,
    activeUrls: Record<string, string>,
    editedTitles?: Record<string, string>,
    editedPrices?: Record<string, string>,
    editedQuantities?: Record<string, number>
  ) => void;
  onCancel: () => void;
}

interface RowImageState {
  activeSource: 'url' | 'file' | 'none';
  urlInput: string;
  file?: File;
  filePreviewUrl?: string;
  fileName?: string;
  fileSize?: string;
}

export function ImportPreview({
  products,
  validationErrors,
  onImport,
  onCancel,
}: ImportPreviewProps) {
  const [showConfirm, setShowConfirm] = useState(false);
  const [activeUrlPrompt, setActiveUrlPrompt] = useState<string | null>(null);

  // Editable product titles state
  const [editedTitles, setEditedTitles] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    products.forEach((p, idx) => {
      const key = p.handle || p.title || `prod_${idx}`;
      init[key] = p.title || '';
    });
    return init;
  });

  // Editable variant prices state (keyed by `${productKey}-${vIdx}`)
  const [editedPrices, setEditedPrices] = useState<Record<string, string>>(() => {
    const init: Record<string, string> = {};
    products.forEach((p, pIdx) => {
      const pKey = p.handle || p.title || `prod_${pIdx}`;
      p.variants?.forEach((v: any, vIdx: number) => {
        init[`${pKey}-${vIdx}`] = v.price != null ? String(v.price) : '';
      });
    });
    return init;
  });

  // Editable variant quantities state (keyed by `${productKey}-${vIdx}`)
  const [editedQuantities, setEditedQuantities] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    products.forEach((p, pIdx) => {
      const pKey = p.handle || p.title || `prod_${pIdx}`;
      p.variants?.forEach((v: any, vIdx: number) => {
        init[`${pKey}-${vIdx}`] = v.inventoryQuantity ?? 0;
      });
    });
    return init;
  });

  // Initialize row-level image states from parsed products
  const [rowStates, setRowStates] = useState<Record<string, RowImageState>>(() => {
    const init: Record<string, RowImageState> = {};
    products.forEach((p, idx) => {
      const key = p.handle || p.title || `prod_${idx}`;
      const rawUrl = p.imageUrl || '';
      const rawFile = p.imageFile || '';

      const isFile = Boolean(rawFile);
      const isUrl = Boolean(rawUrl) && !isFile;

      init[key] = {
        activeSource: isFile ? 'file' : isUrl ? 'url' : 'none',
        urlInput: rawUrl,
        fileName: rawFile,
      };
    });
    return init;
  });

  // Clean up object URLs on unmount
  useEffect(() => {
    return () => {
      Object.values(rowStates).forEach((state) => {
        if (state.filePreviewUrl) {
          URL.revokeObjectURL(state.filePreviewUrl);
        }
      });
    };
  }, []);

  if (validationErrors.length > 0 && products.length === 0) {
    return (
      <div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-6 mb-6">
          <div className="flex items-center gap-3 text-red-800 mb-4">
            <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h3 className="text-lg font-bold">Import Blocked - {validationErrors.length} Errors Found</h3>
          </div>
          <div className="bg-white rounded border border-red-100 p-4 max-h-60 overflow-y-auto">
            <ul className="list-disc pl-5 space-y-1 text-sm text-red-700">
              {validationErrors.map((err, i) => (
                <li key={i}>
                  <span className="font-semibold">Row {err.row}:</span> {err.error}
                </li>
              ))}
            </ul>
          </div>
        </div>

        <div className="flex gap-3">
          <button
            onClick={onCancel}
            className="px-6 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-200 transition-colors cursor-pointer"
          >
            Fix Errors & Re-upload
          </button>
        </div>
      </div>
    );
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024 * 1024) {
      return `${(bytes / 1024).toFixed(0)} KB`;
    }
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // 1. Assign selected raw file to a product row
  const handleFileSelect = (productKey: string, file: File) => {
    const validMimes = ['image/jpeg', 'image/png', 'image/webp', 'image/jpg', 'image/gif', 'image/svg+xml', 'image/avif'];
    const validExts = /\.(png|jpe?g|webp|gif|svg|avif)$/i;

    if (!validMimes.includes(file.type.toLowerCase()) && !validExts.test(file.name)) {
      alert(`Invalid format: ${file.name}. Supported formats: WebP, JPG, PNG, GIF, SVG, AVIF.`);
      return;
    }

    if (file.size > 100 * 1024 * 1024) {
      alert(`File too large: ${file.name} (${(file.size / (1024 * 1024)).toFixed(1)} MB). Limit is 100 MB.`);
      return;
    }

    setRowStates((prev) => {
      const current = prev[productKey] || {
        activeSource: 'none',
        urlInput: '',
      };

      if (current.filePreviewUrl) {
        URL.revokeObjectURL(current.filePreviewUrl);
      }

      const previewUrl = URL.createObjectURL(file);

      return {
        ...prev,
        [productKey]: {
          activeSource: 'file',
          urlInput: '', // Switching to file clears URL
          file,
          filePreviewUrl: previewUrl,
          fileName: file.name,
          fileSize: formatFileSize(file.size),
        },
      };
    });
  };

  // 2. Assign URL to a product row
  const handleUrlChange = (productKey: string, url: string) => {
    const trimmed = url.trim();
    setRowStates((prev) => {
      const current = prev[productKey];
      if (current?.filePreviewUrl) {
        URL.revokeObjectURL(current.filePreviewUrl);
      }

      return {
        ...prev,
        [productKey]: {
          activeSource: trimmed ? 'url' : 'none',
          urlInput: trimmed,
          file: undefined,
          filePreviewUrl: undefined,
          fileName: undefined,
          fileSize: undefined,
        },
      };
    });
  };

  // 3. Remove image completely
  const handleRemoveImage = (productKey: string) => {
    setRowStates((prev) => {
      const current = prev[productKey];
      if (!current) return prev;

      if (current.filePreviewUrl) {
        URL.revokeObjectURL(current.filePreviewUrl);
      }

      return {
        ...prev,
        [productKey]: {
          activeSource: 'none',
          urlInput: '',
          file: undefined,
          filePreviewUrl: undefined,
          fileName: undefined,
          fileSize: undefined,
        },
      };
    });
  };

  // 4. Edit product title / name
  const handleTitleChange = (productKey: string, newTitle: string) => {
    setEditedTitles((prev) => ({
      ...prev,
      [productKey]: newTitle,
    }));
  };

  const handleExecuteImport = () => {
    setShowConfirm(false);

    const pickedFiles: Record<string, File> = {};
    const activeUrls: Record<string, string> = {};

    products.forEach((p, pIdx) => {
      const origKey = p.handle || p.title || `prod_${pIdx}`;
      const newTitle = editedTitles[origKey] ?? p.title;
      const state = rowStates[origKey];

      if (!state) return;

      const keysToMap = [origKey, newTitle, p.handle, p.title, `prod_${pIdx}`].filter(Boolean) as string[];

      if (state.activeSource === 'file' && state.file) {
        keysToMap.forEach((k) => {
          pickedFiles[k] = state.file!;
        });
      } else if (state.activeSource === 'url' && state.urlInput?.trim()) {
        const trimmed = state.urlInput.trim();
        keysToMap.forEach((k) => {
          activeUrls[k] = trimmed;
        });
      }
    });

    onImport(pickedFiles, activeUrls, editedTitles, editedPrices, editedQuantities);
  };

  const totalVariants = products.reduce((acc, p) => acc + (p.variants?.length || 0), 0);

  return (
    <div>
      {/* Top Banner: Error Alert if validation failed, otherwise Success Bar */}
      {validationErrors.length > 0 ? (
        <div className="bg-rose-50 border border-rose-200 rounded-xl p-4 mb-4 shadow-2xs">
          <div className="flex items-center gap-2 mb-2">
            <svg className="w-5 h-5 text-rose-600 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
            </svg>
            <h3 className="text-sm font-bold text-rose-950">
              Import Blocked - {validationErrors.length} Issue{validationErrors.length > 1 ? 's' : ''} Found (Please attach photo or URL below)
            </h3>
          </div>
          <div className="bg-white/80 rounded-lg border border-rose-200 p-2.5 text-xs text-rose-900 space-y-1">
            {validationErrors.map((err, i) => (
              <div key={i}>
                • <strong className="text-rose-950">Row {err.row}:</strong> {err.error}
              </div>
            ))}
          </div>
        </div>
      ) : (
        <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 mb-4 flex items-center justify-between shadow-2xs">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full bg-emerald-100 border border-emerald-200 flex items-center justify-center shrink-0">
              <svg className="w-4 h-4 text-emerald-700" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            <div>
              <h3 className="text-sm font-bold text-emerald-950">Spreadsheet Validated Successfully</h3>
              <p className="text-emerald-800 text-xs">
                Found <strong>{products.length} products</strong> with <strong>{totalVariants} variants</strong> ready to import.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Streamlined Responsive Data Table */}
      <div className="mb-5 border border-gray-200 rounded-xl overflow-hidden shadow-2xs bg-white">
        <div className="overflow-x-auto max-h-[540px] overflow-y-auto">
          <table className="w-full divide-y divide-gray-200 text-left text-xs">
            <thead className="bg-gray-50/90 backdrop-blur-xs sticky top-0 z-10 border-b border-gray-200">
              <tr>
                <th scope="col" className="px-2.5 py-2.5 font-bold text-gray-700 uppercase tracking-wider w-8 text-center">#</th>
                <th scope="col" className="px-2.5 py-2.5 font-bold text-gray-700 uppercase tracking-wider w-12 text-center">PREVIEW</th>
                <th scope="col" className="px-3 py-2.5 font-bold text-gray-700 uppercase tracking-wider min-w-[170px]">
                  PRODUCT NAME
                </th>
                <th scope="col" className="px-2 py-2.5 font-bold text-gray-700 uppercase tracking-wider w-20 text-center">COLLECTION</th>
                <th scope="col" className="px-2 py-2.5 font-bold text-gray-700 uppercase tracking-wider w-18 text-center">STATUS</th>
                <th scope="col" className="px-3 py-2.5 font-bold text-gray-700 uppercase tracking-wider min-w-[220px] text-center">
                  IMAGE
                </th>
                <th scope="col" className="px-2.5 py-2.5 font-bold text-gray-700 uppercase tracking-wider w-24 text-center">SKU</th>
                <th scope="col" className="px-2.5 py-2.5 font-bold text-gray-700 uppercase tracking-wider w-16 text-center">PRICE</th>
                <th scope="col" className="px-2 py-2.5 font-bold text-gray-700 uppercase tracking-wider w-12 text-center">QTY</th>
                <th scope="col" className="px-2.5 py-2.5 font-bold text-gray-700 uppercase tracking-wider w-20 text-center">VALIDATION</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {products.flatMap((product, pIdx) => {
                const productKey = product.handle || product.title || `prod_${pIdx}`;
                const state = rowStates[productKey] || {
                  activeSource: 'none',
                  urlInput: '',
                };

                const currentTitle = editedTitles[productKey] ?? product.title;

                const hasPhoto = Boolean(state.file || state.filePreviewUrl);
                const hasUrl = Boolean(state.urlInput && state.urlInput.trim().length > 0);
                const activePreview = state.filePreviewUrl || (hasUrl ? state.urlInput.trim() : null);

                return product.variants.map((variant: any, vIdx: number) => {
                  const rowNum = pIdx + 1;
                  const isFirstVariant = vIdx === 0;

                  return (
                    <tr key={`${productKey}-${vIdx}`} className="hover:bg-gray-50/80 transition-colors">
                      {/* 1. Row Index */}
                      <td className="px-2.5 py-2.5 whitespace-nowrap text-center text-gray-400 font-mono text-xs">
                        {isFirstVariant ? rowNum : ''}
                      </td>

                      {/* 2. PREVIEW (Circle Thumbnail in front of Product Name, just like the old format) */}
                      <td className="px-2.5 py-2.5 whitespace-nowrap text-center">
                        {isFirstVariant && (
                          <div className="w-9 h-9 rounded-full bg-gray-100 border border-gray-200 overflow-hidden mx-auto flex items-center justify-center shadow-2xs">
                            {activePreview ? (
                              <img
                                src={activePreview}
                                alt=""
                                className="w-full h-full object-cover"
                                onError={(e) => {
                                  (e.target as HTMLElement).style.display = 'none';
                                }}
                              />
                            ) : (
                              <svg className="w-4 h-4 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                              </svg>
                            )}
                          </div>
                        )}
                      </td>

                      {/* 3. Product Name (Directly Editable) */}
                      <td className="px-3 py-2.5 whitespace-nowrap">
                        <div className="flex flex-col gap-0.5 max-w-[200px]">
                          {isFirstVariant ? (
                            <input
                              type="text"
                              value={currentTitle}
                              onChange={(e) => handleTitleChange(productKey, e.target.value)}
                              placeholder="Product title..."
                              title="Click to edit product name"
                              className="w-full text-xs font-bold text-gray-900 px-1.5 py-1 bg-transparent hover:bg-gray-50 focus:bg-white rounded border border-transparent hover:border-gray-300 focus:border-indigo-500 focus:outline-none transition-all truncate"
                            />
                          ) : (
                            <span className="text-xs font-bold text-gray-900 px-1.5 py-1 truncate">
                              {currentTitle}
                            </span>
                          )}

                          {variant.option1Value && variant.option1Value !== 'Default Title' && (
                            <span className="text-[10px] text-gray-500 px-1.5 font-normal">
                              {variant.option1Name}: <strong>{variant.option1Value}</strong>
                              {variant.option2Value ? `, ${variant.option2Name}: ${variant.option2Value}` : ''}
                              {variant.option3Value ? `, ${variant.option3Name}: ${variant.option3Value}` : ''}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 4. Collection */}
                      <td className="px-2 py-2.5 whitespace-nowrap text-center">
                        {product.collection ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-medium bg-gray-100 text-gray-800 border border-gray-200">
                            {product.collection}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">—</span>
                        )}
                      </td>

                      {/* 5. Status */}
                      <td className="px-2 py-2.5 whitespace-nowrap text-center">
                        {product.status === 'ACTIVE' ? (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                            ACTIVE
                          </span>
                        ) : (
                          <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-700 border border-gray-200">
                            {product.status || 'DRAFT'}
                          </span>
                        )}
                      </td>

                      {/* 6. SINGLE UNIFIED IMAGE COLUMN (Identical Pill Size, Consistent [x] Inside, White Pin Icon) */}
                      <td className="px-3 py-2.5 whitespace-nowrap text-center">
                        {isFirstVariant && (
                          <div className="flex items-center justify-center gap-2">
                            {/* Symmetric Pill Container for File / URL / Empty */}
                            {state.activeSource === 'file' || state.file || (!state.urlInput && state.fileName) ? (
                              <div className="w-[190px] h-8 rounded-full border border-purple-200 bg-purple-50/50 flex items-center justify-between px-3 transition-all shadow-2xs">
                                <span
                                  className="text-xs font-semibold text-gray-800 truncate select-none text-left"
                                  title={state.fileName || state.file?.name}
                                >
                                  {state.fileName || state.file?.name}
                                  {state.fileSize ? ` (${state.fileSize})` : ''}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => handleRemoveImage(productKey)}
                                  title="Remove image"
                                  className="text-gray-400 hover:text-red-500 p-0.5 cursor-pointer shrink-0 transition-colors ml-1.5"
                                >
                                  <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                  </svg>
                                </button>
                              </div>
                            ) : (
                              <div className="relative w-[190px] h-8 rounded-full border border-purple-200 bg-purple-50/50 flex items-center transition-all shadow-2xs focus-within:border-purple-400">
                                <input
                                  type="url"
                                  value={state.urlInput || ''}
                                  onChange={(e) => handleUrlChange(productKey, e.target.value)}
                                  placeholder="Paste https:// URL..."
                                  title="Enter image URL"
                                  className="w-full h-full text-xs pl-3 pr-7 bg-transparent font-mono text-gray-700 truncate focus:outline-none"
                                />
                                {state.urlInput && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveImage(productKey)}
                                    title="Clear URL"
                                    className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-red-500 p-0.5 cursor-pointer shrink-0 transition-colors"
                                  >
                                    <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                  </button>
                                )}
                              </div>
                            )}

                            {/* Circular Pin Attachment Button with Pure White Polaris Pin Icon */}
                            <label
                              className="w-8 h-8 rounded-full bg-[#7021b7] hover:bg-[#5b1999] active:scale-95 flex items-center justify-center cursor-pointer transition-all shadow-sm shrink-0"
                              title={state.file ? "Change attached photo" : `Click to attach photo file`}
                            >
                              <AttachmentIcon className="w-4 h-4 shrink-0 text-white fill-white stroke-white" />
                              <input
                                type="file"
                                accept="image/*,.webp,.png,.jpg,.jpeg,.gif,.svg,.avif"
                                className="hidden"
                                onChange={(e) => {
                                  const f = e.target.files?.[0];
                                  if (f) handleFileSelect(productKey, f);
                                  e.target.value = '';
                                }}
                              />
                            </label>
                          </div>
                        )}
                      </td>

                      {/* 7. SKU */}
                      <td className="px-2.5 py-2.5 whitespace-nowrap font-mono text-gray-600 text-xs text-center">
                        {variant.sku || 'Auto-generated'}
                      </td>

                      {/* 8. Price (Directly Inline Editable) */}
                      <td className="px-2.5 py-2.5 whitespace-nowrap text-center">
                        <div className="inline-flex items-center justify-center border border-gray-200 hover:border-gray-300 focus-within:border-indigo-500 rounded-md px-1.5 py-0.5 bg-white shadow-2xs transition-colors">
                          <span className="text-gray-500 text-xs font-bold mr-0.5">₹</span>
                          <input
                            type="number"
                            min="0"
                            step="any"
                            value={editedPrices[`${productKey}-${vIdx}`] ?? (variant.price != null ? String(variant.price) : '')}
                            onChange={(e) => {
                              const val = e.target.value;
                              setEditedPrices((prev) => ({
                                ...prev,
                                [`${productKey}-${vIdx}`]: val,
                              }));
                            }}
                            className="w-16 h-6 text-xs font-bold text-center text-gray-900 bg-transparent focus:outline-none"
                            title="Edit variant price"
                          />
                        </div>
                      </td>

                      {/* 9. Quantity (Directly Inline Editable) */}
                      <td className="px-2 py-2.5 whitespace-nowrap text-center">
                        <div className="inline-flex items-center justify-center border border-gray-200 hover:border-gray-300 focus-within:border-indigo-500 rounded-md px-1.5 py-0.5 bg-white shadow-2xs transition-colors">
                          <input
                            type="number"
                            min="0"
                            value={editedQuantities[`${productKey}-${vIdx}`] ?? (variant.inventoryQuantity ?? 0)}
                            onChange={(e) => {
                              const val = parseInt(e.target.value, 10);
                              setEditedQuantities((prev) => ({
                                ...prev,
                                [`${productKey}-${vIdx}`]: isNaN(val) ? 0 : val,
                              }));
                            }}
                            className="w-14 h-6 text-xs font-semibold text-center text-gray-700 bg-transparent focus:outline-none"
                            title="Edit inventory quantity"
                          />
                        </div>
                      </td>

                      {/* 10. Validation */}
                      <td className="px-2.5 py-2.5 whitespace-nowrap text-center">
                        <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-200">
                          Valid
                        </span>
                      </td>
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Action Footer */}
      <div className="flex flex-col sm:flex-row items-center justify-between gap-4 border-t border-gray-100 pt-4 pb-2">
        <div className="text-xs text-gray-500">
          Showing <strong>{products.length} products</strong> ready for Shopify synchronization.
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto">
          <button
            onClick={() => setShowConfirm(true)}
            className="flex-1 sm:flex-initial px-6 py-2.5 bg-[var(--color-primary,#a7cd18)] hover:bg-[var(--color-primary-hover,#96bb13)] text-[var(--color-primary-text,#000000)] text-sm font-black rounded-xl border border-[var(--theme-sidebar-border,#91b212)] transition-all shadow-md flex items-center justify-center gap-2 cursor-pointer [&_svg]:fill-current [&_svg]:text-[var(--color-primary-text,#000000)]"
          >
            <ImportIcon className="w-4 h-4 shrink-0 fill-current text-[var(--color-primary-text,#000000)]" />
            Import Products
          </button>
          <button
            onClick={onCancel}
            className="px-5 py-2.5 border border-gray-300 text-gray-700 text-sm font-semibold rounded-xl hover:bg-gray-50 transition-colors cursor-pointer"
          >
            Cancel
          </button>
        </div>
      </div>

      {/* Confirmation Modal */}
      <ConfirmToast
        open={showConfirm}
        message={`Proceed with importing ${products.length} products?`}
        subMessage="This will push the catalog changes and media associations to your store in Shopify."
        confirmLabel="Import Products"
        cancelLabel="Cancel"
        variant="info"
        onConfirm={handleExecuteImport}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}
