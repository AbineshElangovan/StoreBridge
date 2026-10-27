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
        body: JSON.stringify({ rows: parsedRows, action: 'validate' })
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

  const handleImport = async () => {
    setImportState('IMPORTING');

    try {
      const res = await shopifyFetch('/api/products/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows, action: 'import', targetStoreId: selectedStore, filename: file?.name || 'unknown.csv' })
      });
      const data = await res.json();
      
      setImportResult(data.result || { error: data.error || "Unknown API error" });
      setImportState('RESULT');
    } catch (err: any) {
      setImportResult({ error: err.message || "Failed to run import" });
      setImportState('RESULT');
    }
  };

  const handleDirectImport = async () => {
    if (!file) return;
    setImportState('VALIDATING');
    
    try {
      const parsedRows = await parseUploadedFile(file);
      setRows(parsedRows);
      setImportState('IMPORTING');
      const res = await shopifyFetch('/api/products/import', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ rows: parsedRows, action: 'import', targetStoreId: selectedStore, filename: file.name })
      });
      const data = await res.json();
      setImportResult(data.result || { error: data.error || "Unknown API error" });
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
      {/* Left Column - Import Data */}
      <div className="flex-1 lg:col-span-2">
        <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-bold text-gray-900 mb-1">Import data</h2>
            <p className="text-sm text-gray-500">
              {isStandalone
                ? 'CSV or Excel import into your product catalog. Includes product creation, variations, inventory, and collection mapping.'
                : 'CSV import into the master catalog. Includes product creation, variations, inventory, and collection mapping.'}
            </p>
          </div>
          
          <div className="p-6">
            {importState === 'UPLOAD' && (
              <CsvUploader 
                file={file} 
                isValidating={false} 
                onFileSelect={setFile} 
                onValidate={handleValidate} 
                onDirectImport={handleDirectImport}
              />
            )}

            {importState === 'VALIDATING' && (
              <CsvUploader 
                file={file} 
                isValidating={true} 
                onFileSelect={setFile} 
                onValidate={handleValidate} 
                onDirectImport={handleDirectImport}
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

      {/* Right Column - Guidelines */}
      <div className="w-full lg:w-1/3">
        <ImportGuidelines />
      </div>
    </div>
  );
}
