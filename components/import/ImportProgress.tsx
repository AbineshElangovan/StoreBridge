import React from 'react';

export function ImportProgress() {
  return (
    <div className="bg-white border border-gray-200 rounded-lg p-12 text-center shadow-sm">
      <h3 className="text-xl font-bold text-gray-900 mb-4">Importing Products...</h3>
      <div className="w-16 h-16 border-4 border-[var(--color-primary)] border-t-transparent rounded-full animate-spin mx-auto mb-6"></div>
      <p className="text-gray-500 max-w-md mx-auto">
        Please do not close this window while we securely import your products and variations into Shopify and your database.
      </p>
    </div>
  );
}
