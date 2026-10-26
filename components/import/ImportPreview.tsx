import React, { useState } from 'react';
import { ConfirmToast } from '@/components/ui/ConfirmToast';

interface ImportPreviewProps {
  products: any[];
  validationErrors: { row: number; error: string }[];
  onImport: () => void;
  onCancel: () => void;
}

export function ImportPreview({ 
  products, 
  validationErrors, 
  onImport, 
  onCancel 
}: ImportPreviewProps) {
  const [showConfirm, setShowConfirm] = useState(false);

  if (validationErrors.length > 0) {
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
            className="px-6 py-2 bg-gray-100 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-200 transition-colors"
          >
            Fix Errors & Re-upload
          </button>
        </div>
      </div>
    );
  }

  const totalVariants = products.reduce((acc, p) => acc + (p.variants?.length || 0), 0);

  return (
    <div>
      <div className="bg-green-50 border border-green-200 rounded-lg p-6 mb-6 flex items-center gap-3">
        <svg className="w-6 h-6 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
        </svg>
        <div>
          <h3 className="text-lg font-bold text-green-900 mb-1">CSV Validated Successfully</h3>
          <p className="text-green-800 text-sm">
            Found <strong>{products.length} products</strong> with a total of <strong>{totalVariants} variants</strong> ready to import.
          </p>
        </div>
      </div>
      
      <div className="mb-6 border border-gray-200 rounded-lg overflow-hidden">
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50 sticky top-0 z-10">
              <tr>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">PRODUCT</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">SKU</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">QTY</th>
                <th scope="col" className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">VALIDATION</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {products.flatMap((product) => 
                product.variants.map((variant: any, idx: number) => (
                  <tr key={`${product.handle || product.title}-${idx}`} className="hover:bg-gray-50">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900 truncate max-w-xs">
                      {product.title} {variant.option1Value !== 'Default Title' ? `— ${variant.option1Value}` : ''}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {variant.sku || 'Auto-generated'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                      {variant.inventoryQuantity}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm">
                      <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-green-100 text-green-800">
                        Valid
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      <div className="flex items-center gap-4 border-t border-gray-100 pt-6">
        <button 
          onClick={() => setShowConfirm(true)}
          className="px-6 py-2.5 bg-[var(--color-primary,#a7cd18)] hover:bg-[var(--color-primary-hover,#96bb13)] text-[var(--color-primary-text,#000000)] text-sm font-black rounded-xl border border-[var(--theme-sidebar-border,#91b212)] transition-all shadow-xs flex items-center gap-2 cursor-pointer"
        >
          <svg className="w-4 h-4 text-current" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
          </svg>
          Import Products Now
        </button>
        <button 
          onClick={onCancel}
          className="px-6 py-2 border border-gray-300 text-gray-700 text-sm font-semibold rounded-lg hover:bg-gray-50 transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>

      <ConfirmToast
        open={showConfirm}
        message={`Proceed with importing ${products.length} products?`}
        subMessage="This will push the catalog changes to your store."
        confirmLabel="Import Products"
        cancelLabel="Cancel"
        variant="info"
        onConfirm={() => {
          setShowConfirm(false);
          onImport();
        }}
        onCancel={() => setShowConfirm(false)}
      />
    </div>
  );
}
