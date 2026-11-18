"use client";

import React, { useState, useEffect } from 'react';
import Papa from 'papaparse';
import { shopifyFetch } from '@/lib/shopify/Client';
import { useStoreContext } from '@/components/providers/StoreProvider';
import { CsvUploader } from './CsvUploader';
import { ImportPreview } from './ImportPreview';
import { ImportProgress } from './ImportProgress';
import { ImportResult } from './ImportResult';
import { ImportGuidelines } from './ImportGuidelines';

export function ImportTab() {
  const { isStandalone, currentStore } = useStoreContext();
  const [importState, setImportState] = useState<'UPLOAD' | 'VALIDATING' | 'PREVIEW' | 'IMPORTING' | 'RESULT'>('UPLOAD');
  
  const [file, setFile] = useState<File | null>(null);
  const [rows, setRows] = useState<any[]>([]);
  const [validationErrors, setValidationErrors] = useState<{row: number, error: string}[]>([]);
  const [previewProducts, setPreviewProducts] = useState<any[]>([]);
  const [importResult, setImportResult] = useState<any>(null);
  
  const [connections, setConnections] = useState<any[]>([]);
  const [masterStore, setMasterStore] = useState<any>(null);
  const [selectedStore, setSelectedStore] = useState<string>('');

  useEffect(() => {
    fetchConnections();
  }, []);

  useEffect(() => {
    if (isStandalone && currentStore?.id && !selectedStore) {
      setSelectedStore(currentStore.id);
    }
  }, [isStandalone, currentStore, selectedStore]);

  const fetchConnections = async () => {
    try {
      const res = await shopifyFetch('/api/connections', { cache: 'no-store' });
      const data = await res.json();
      if (data.connections) {
        setConnections(data.connections);
        if (data.store) {
          setMasterStore(data.store);
          setSelectedStore(data.store.id);
        } else if (data.connections.length > 0) {
          setSelectedStore(data.connections[0].targetStoreId);
        }
      }
    } catch (err) {
      console.error('Failed to fetch connections:', err);
    }
  };

  const parseUploadedFile = async (uploadedFile: File): Promise<any[]> => {
    const isExcel = uploadedFile.name.endsWith('.xlsx') || uploadedFile.name.endsWith('.xls');
    if (isExcel) {
      const XLSX = await import('xlsx');
      const buffer = await uploadedFile.arrayBuffer();
      const wb = XLSX.read(buffer, { type: 'array' });
      const firstSheetName = wb.SheetNames[0];
      const worksheet = wb.Sheets[firstSheetName];
      return XLSX.utils.sheet_to_json(worksheet, { defval: '' });
    } else {
      return new Promise<any[]>((resolve, reject) => {
        Papa.parse(uploadedFile, {
          header: true,
          skipEmptyLines: true,
          complete: (results) => resolve(results.data),
          error: (err) => reject(err),
        });
      });
    }
  };

  const handleValidate = async () => {
    if (!file) return;
    setImportState('VALIDATING');
    
    try {
      const parsedRows = await parseUploadedFile(file);
      setRows(parsedRows);

      const res = await shopifyFetch('/api/products/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rows: parsedRows,
          action: 'validate',
        })
      });
      const data = await res.json();
      
      if (!data.success && data.errors) {
        setValidationErrors(data.errors);
        setImportState('PREVIEW');
      } else if (data.success) {
        setPreviewProducts(data.products);
        setValidationErrors([]);
        setImportState('PREVIEW');
      } else {
         setValidationErrors([{row: 0, error: data.error || "Unknown API error"}]);
         setImportState('PREVIEW');
      }
    } catch (err: any) {
      setValidationErrors([{row: 0, error: err.message || "Error validating file"}]);
      setImportState('PREVIEW');
    }
  };

  const handleImport = async (
    pickedFiles?: Record<string, File>,
    activeUrls?: Record<string, string>,
    editedTitles?: Record<string, string>,
    editedPrices?: Record<string, string>,
    editedQuantities?: Record<string, number>
  ) => {
    setImportState('IMPORTING');

    try {
      const productVariantCounters: Record<string, number> = {};
      const rowsToImport = rows.map((r: any, rIdx: number) => {
        const handle = r['Handle'] || r['handle'] || r['product_id'] || '';
        const title = r['Title'] || r['title'] || r['product_name'] || '';
        const key = handle || title;

        const vIdx = productVariantCounters[key] ?? 0;
        productVariantCounters[key] = vIdx + 1;

        let finalTitle = title;
        if (editedTitles) {
          finalTitle = editedTitles[key] || editedTitles[title] || editedTitles[handle] || title;
        }

        const updated = { ...r };
        if (finalTitle !== title) {
          updated['Title'] = finalTitle;
          if (updated['title'] !== undefined) updated['title'] = finalTitle;
          if (updated['product_name'] !== undefined) updated['product_name'] = finalTitle;
        }

        // Apply edited price if provided
        const variantPriceKeys = [
          `${key}-${vIdx}`,
          `${title}-${vIdx}`,
          `${handle}-${vIdx}`,
          `${finalTitle}-${vIdx}`,
          r['SKU'] || r['Variant SKU'] || r['sku'] || '',
        ].filter(Boolean);

        if (editedPrices) {
          for (const k of variantPriceKeys) {
            if (editedPrices[k] !== undefined && editedPrices[k] !== '') {
              updated['Price'] = editedPrices[k];
              if (updated['price'] !== undefined) updated['price'] = editedPrices[k];
              if (updated['Variant Price'] !== undefined) updated['Variant Price'] = editedPrices[k];
              if (updated['variant_price'] !== undefined) updated['variant_price'] = editedPrices[k];
              break;
            }
          }
        }

        // Apply edited quantity if provided
        if (editedQuantities) {
          for (const k of variantPriceKeys) {
            if (editedQuantities[k] !== undefined) {
              const qVal = editedQuantities[k];
              updated['Available'] = qVal;
              if (updated['Inventory quantity'] !== undefined) updated['Inventory quantity'] = qVal;
              if (updated['inventory_quantity'] !== undefined) updated['inventory_quantity'] = qVal;
              if (updated['Variant Inventory Qty'] !== undefined) updated['Variant Inventory Qty'] = qVal;
              if (updated['qty'] !== undefined) updated['qty'] = qVal;
              break;
            }
          }
        }

        const pickedFile =
          pickedFiles?.[key] ||
          pickedFiles?.[title] ||
          pickedFiles?.[finalTitle] ||
          pickedFiles?.[handle] ||
          pickedFiles?.[`prod_${rIdx}`];

        const activeUrl =
          activeUrls?.[key] ||
          activeUrls?.[title] ||
          activeUrls?.[finalTitle] ||
          activeUrls?.[handle] ||
          activeUrls?.[`prod_${rIdx}`];

        if (pickedFile) {
          updated['Image'] = pickedFile.name;
          updated['Image File'] = pickedFile.name;
          if (updated['image_file'] !== undefined) updated['image_file'] = pickedFile.name;
          delete updated['Image URL'];
          delete updated['image_url'];
        } else if (activeUrl) {
          updated['Image'] = activeUrl;
          updated['Image URL'] = activeUrl;
          if (updated['image_url'] !== undefined) updated['image_url'] = activeUrl;
          delete updated['Image File'];
          delete updated['image_file'];
        }

        return updated;
      });

      const hasFiles = pickedFiles && Object.keys(pickedFiles).length > 0;
      let res;

      if (hasFiles) {
        const formData = new FormData();
        formData.append('rows', JSON.stringify(rowsToImport));
        formData.append('action', 'import');
        formData.append('targetStoreId', selectedStore);
        formData.append('filename', file?.name || 'unknown.csv');

        const mapping: Record<string, string> = {};
        Object.entries(pickedFiles).forEach(([productKey, imgFile]) => {
          formData.append('image_files', imgFile, imgFile.name);
          mapping[productKey] = imgFile.name;
        });
        formData.append('product_image_mapping', JSON.stringify(mapping));
        if (activeUrls && Object.keys(activeUrls).length > 0) {
          formData.append('active_image_urls', JSON.stringify(activeUrls));
        }

        res = await shopifyFetch('/api/products/import', {
          method: 'POST',
          body: formData,
        });
      } else {
        res = await shopifyFetch('/api/products/import', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            rows: rowsToImport,
            action: 'import',
            targetStoreId: selectedStore,
            filename: file?.name || 'unknown.csv',
            active_image_urls: activeUrls || {},
          }),
        });
      }
      const data = await res.json();
      
      if (!data.success && data.errors && data.errors.length > 0) {
        setValidationErrors(data.errors);
        try {
          const valRes = await shopifyFetch('/api/products/import', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              rows: rowsToImport,
              action: 'validate',
            }),
          });
          const valData = await valRes.json();
          if (valData.products) {
            setPreviewProducts(valData.products);
          }
        } catch (_) {}
        setImportState('PREVIEW');
        return;
      }

      const errorMsg =
        data.error ||
        data.message ||
        (data.errors && data.errors.length > 0
          ? data.errors.map((e: any) => `Row ${e.row}: ${e.error}`).join('\n')
          : null) ||
        (!res.ok ? `HTTP ${res.status}: Failed to import products` : "Failed to import products");

      setImportResult(data.result || { error: errorMsg });
      setImportState('RESULT');
    } catch (err: any) {
      setImportResult({ error: err.message || "Failed to run import" });
      setImportState('RESULT');
    }
  };

  const reset = () => {
    setFile(null);
    setRows([]);
    setValidationErrors([]);
    setPreviewProducts([]);
    setImportState('UPLOAD');
    setImportResult(null);
  };

  return (
    <div className="flex flex-col lg:flex-row gap-6">
      {/* Main Column - Import Data */}
      <div className={`transition-all duration-200 ${importState === 'PREVIEW' ? 'w-full' : 'flex-1 lg:col-span-2'}`}>
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Import data</h2>
            <p className="text-sm text-gray-500">
              {isStandalone
                ? 'CSV or Excel import into your product catalog. Includes product creation, variations, inventory, images, and collection mapping.'
                : 'CSV import into the master catalog. Includes product creation, variations, inventory, images, and collection mapping.'}
            </p>
          </div>
          
          <div className="p-6">
            {importState === 'UPLOAD' && (
              <CsvUploader 
                file={file}
                isValidating={false} 
                onFileSelect={setFile}
                onValidate={handleValidate} 
              />
            )}

            {importState === 'VALIDATING' && (
              <CsvUploader 
                file={file}
                isValidating={true} 
                onFileSelect={setFile}
                onValidate={handleValidate} 
              />
            )}

            {importState === 'PREVIEW' && (
              <ImportPreview 
                products={previewProducts}
                validationErrors={validationErrors}
                onImport={handleImport}
                onCancel={reset}
              />
            )}

            {importState === 'IMPORTING' && (
              <ImportProgress />
            )}

            {importState === 'RESULT' && importResult && (
              <ImportResult 
                result={importResult}
                onReset={reset}
              />
            )}
          </div>
        </div>
      </div>

      {/* Right Column - Guidelines (only shown during upload / validating to give preview full width) */}
      {importState !== 'PREVIEW' && (
        <div className="w-full lg:w-1/3">
          <ImportGuidelines />
        </div>
      )}
    </div>
  );
}
