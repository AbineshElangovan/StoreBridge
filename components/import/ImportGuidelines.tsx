import React from 'react';

export function ImportGuidelines() {
  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm">
      <div className="p-6 border-b border-gray-200">
        <h3 className="text-lg font-bold text-gray-900">Important guidelines</h3>
      </div>
      <div className="p-6 space-y-4 text-sm text-gray-600">
        <ul className="list-disc pl-5 space-y-3 marker:text-gray-400">
          <li><strong>Once Read After do the file import</strong> </li>
          <li><strong>CSV must contain required fields.</strong> (Handle, Title, Price).</li>
          <li><strong>SKU generation is automatic.</strong> If a SKU is omitted from your CSV, the system will automatically generate a unique one based on your SKU generation rules.</li>
          <li><strong>Invalid rows are rejected before import.</strong> The entire file is validated upfront. Fix all errors before proceeding.</li>
          <li><strong>Inventory updates quantity only.</strong> (For Inventory import - coming soon)</li>
          <li><strong>Imported products are added only to the selected store.</strong> Auto-sync is not triggered on import.</li>
        </ul>
      </div>
      
      <div className="px-6 pb-6">
        <div className="pt-5 border-t border-gray-100">
          <h4 className="text-xs font-bold text-gray-900 uppercase tracking-wider mb-3">Supported CSV Columns</h4>
          <div className="flex flex-wrap gap-2">
            {[
              'Title', 'Description', 
              'Product category', 'Type', 'Tags', 'Status', 'Collection',
              'Weight', 'Price', 'Compare-at price', 'Inventory tracker', 
              'Inventory quantity', 'Option1 name', 'Option1 value', 'Handle'
            ].map(col => (
              <span key={col} className="px-2 py-1 bg-gray-50 text-gray-600 rounded-md text-xs font-medium border border-gray-200">
                {col}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
