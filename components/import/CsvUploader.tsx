import React from 'react';
import { APP_NAME } from '@/lib/constants/app';

interface CsvUploaderProps {
  file: File | null;
  isValidating: boolean;
  onFileSelect: (file: File) => void;
  onValidate: () => void;
  onDirectImport?: () => void;
}

export function CsvUploader({ file, isValidating, onFileSelect, onValidate, onDirectImport }: CsvUploaderProps) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      onFileSelect(selectedFile);
    }
  };

  const handleDirectClick = () => {
    if (onDirectImport) onDirectImport();
  };

  const handleDownloadSampleCsv = (e: React.MouseEvent) => {
    e.preventDefault();
    const csvContent = `Title,Description,Price,Inventory tracked,Available,Option1 Name,Option1 Value,Option2 Name,Option2 Value,Option3 Name,Option3 Value,SKU,Vendor,Tags,Status,collection
Stainless Steel Water Bottle,<p>Durable stainless steel water bottle for daily use.</p>,349,Yes,10,Color,Beige,,,,,,ESHAN Coimbatore Store,Accessories,ACTIVE,MENS ACCESSORIES
Classic Cotton T-Shirt,<p>Comfortable cotton T-shirt for everyday wear.</p>,499,Yes,10,Color,Blue,Size,M,,,,${APP_NAME},T-shirts,ACTIVE,T-SHIRTS
Slim Fit Jeans,<p>Stylish slim-fit denim jeans suitable for casual wear.</p>,999,Yes,10,Color,Black,Size,L,,,,ESHAN Chennai Store,PANTS,ACTIVE,PANTS
`;
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.setAttribute('download', 'sample_products.csv');
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div>
      <div className="border-2 border-dashed border-gray-300 rounded-lg bg-gray-50 hover:bg-gray-100 transition-colors py-16 px-4 mb-6 flex flex-col items-center justify-center text-center">
        <div className="bg-white p-3 rounded-full shadow-sm border border-gray-200 mb-4">
          <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-base font-semibold text-gray-900 mb-1">
          {file ? file.name : 'Drop your products CSV or Excel file here'}
        </h3>
        <p className="text-sm text-gray-500 mb-6">
          or click to browse · .csv, .xlsx, .xls · max 50 MB
        </p>
        
        <label className="cursor-pointer bg-white px-4 py-2 border border-gray-300 rounded-md shadow-sm text-sm font-medium text-gray-700 hover:bg-gray-50">
          Browse files
          <input 
            type="file" 
            accept=".csv, .xlsx, .xls, text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel" 
            className="hidden" 
            onChange={handleFileChange} 
          />
        </label>
        
        <a 
          href="/storebridge_sample_import.csv" 
          download="sample_products.csv"
          onClick={handleDownloadSampleCsv}
          className="text-xs text-blue-600 hover:text-blue-800 underline mt-4 inline-flex items-center gap-1 cursor-pointer font-medium"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
          </svg>
          Download Sample CSV
        </a>
      </div>

      <div className="flex flex-col sm:flex-row gap-4">
        <button 
          onClick={onValidate}
          disabled={!file || isValidating}
          className="flex-1 flex justify-center py-2.5 px-4 rounded-xl shadow-xs text-sm font-black text-[var(--color-primary-text,#000000)] bg-[var(--color-primary,#a7cd18)] hover:bg-[var(--color-primary-hover,#96bb13)] border border-[var(--theme-sidebar-border,#91b212)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary)] disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
        >
          {isValidating ? 'Processing...' : 'Preview CSV'}
        </button>
        <button 
          onClick={handleDirectClick}
          disabled={!file || isValidating}
          className="flex-1 flex justify-center py-2.5 px-4 rounded-xl shadow-xs text-sm font-black text-[var(--color-primary-text,#000000)] bg-[var(--color-primary,#a7cd18)] hover:bg-[var(--color-primary-hover,#96bb13)] border border-[var(--theme-sidebar-border,#91b212)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary)] disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
        >
          {isValidating ? 'Importing...' : 'Import Directly'}
        </button>
      </div>
    </div>
  );
}
