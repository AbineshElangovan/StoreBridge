import React from 'react';
import { ViewIcon } from '@shopify/polaris-icons';
import { APP_NAME } from '@/lib/constants/app';

interface CsvUploaderProps {
  file: File | null;
  isValidating: boolean;
  onFileSelect: (file: File) => void;
  onValidate: () => void;
}

export function CsvUploader({
  file,
  isValidating,
  onFileSelect,
  onValidate,
}: CsvUploaderProps) {
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      onFileSelect(selectedFile);
    }
  };

  const handleDownloadSampleCsv = (e: React.MouseEvent) => {
    e.preventDefault();
    const csvContent = `Title,Description,Price,Inventory tracked,Available,Option1 Name,Option1 Value,Option2 Name,Option2 Value,Option3 Name,Option3 Value,collection,Status,Image
Stainless Steel Water Bottle,<p>Durable stainless steel water bottle for daily use.</p>,349,Yes,10,Color,Silver,,,,,Accessories,ACTIVE,https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=800&q=80
Classic Cotton T-Shirt,<p>Comfortable cotton T-shirt for everyday wear.</p>,499,Yes,10,Color,Blue,Size,M,,,T-shirts,ACTIVE,tshirt-blue.png
Slim Fit Jeans,<p>Stylish slim-fit denim jeans suitable for casual wear.</p>,999,Yes,10,Color,Black,Size,L,,,PANTS,ACTIVE,https://images.unsplash.com/photo-1542272604-780c96856592?auto=format&fit=crop&w=800&q=80
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

  const handleDownloadSampleXlsx = async (e: React.MouseEvent) => {
    e.preventDefault();
    try {
      const XLSX = await import('xlsx');
      const data = [
        {
          Title: 'Stainless Steel Water Bottle',
          Description: '<p>Durable stainless steel water bottle for daily use.</p>',
          Price: 349,
          'Inventory tracked': 'Yes',
          Available: 10,
          'Option1 Name': 'Color',
          'Option1 Value': 'Silver',
          'Option2 Name': '',
          'Option2 Value': '',
          'Option3 Name': '',
          'Option3 Value': '',
          collection: 'Accessories',
          Status: 'ACTIVE',
          Image: 'https://images.unsplash.com/photo-1602143407151-7111542de6e8?auto=format&fit=crop&w=800&q=80',
        },
        {
          Title: 'Classic Cotton T-Shirt',
          Description: '<p>Comfortable cotton T-shirt for everyday wear.</p>',
          Price: 499,
          'Inventory tracked': 'Yes',
          Available: 10,
          'Option1 Name': 'Color',
          'Option1 Value': 'Blue',
          'Option2 Name': 'Size',
          'Option2 Value': 'M',
          'Option3 Name': '',
          'Option3 Value': '',
          collection: 'T-shirts',
          Status: 'ACTIVE',
          Image: 'tshirt-blue.png',
        },
        {
          Title: 'Slim Fit Jeans',
          Description: '<p>Stylish slim-fit denim jeans suitable for casual wear.</p>',
          Price: 999,
          'Inventory tracked': 'Yes',
          Available: 10,
          'Option1 Name': 'Color',
          'Option1 Value': 'Black',
          'Option2 Name': 'Size',
          'Option2 Value': 'L',
          'Option3 Name': '',
          'Option3 Value': '',
          collection: 'PANTS',
          Status: 'ACTIVE',
          Image: 'https://images.unsplash.com/photo-1542272604-780c96856592?auto=format&fit=crop&w=800&q=80',
        },
      ];

      const ws = XLSX.utils.json_to_sheet(data);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, 'Products');
      XLSX.writeFile(wb, 'sample_products.xlsx');
    } catch (err) {
      // Fallback to direct static link
      const link = document.createElement('a');
      link.href = '/sample_products.xlsx';
      link.setAttribute('download', 'sample_products.xlsx');
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
  };

  return (
    <div>
      <div className="border-2 border-dashed border-gray-300 rounded-xl bg-gray-50 hover:bg-gray-100 transition-colors py-16 px-4 mb-6 flex flex-col items-center justify-center text-center">
        <div className="bg-white p-3 rounded-full shadow-xs border border-gray-200 mb-4">
          <svg className="w-6 h-6 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 13h6m-3-3v6m5 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <h3 className="text-base font-bold text-gray-900 mb-1">
          {file ? file.name : 'Drop your products CSV or Excel file here'}
        </h3>
        <p className="text-xs text-gray-500 mb-6">
          or click to browse · .csv, .xlsx, .xls · max 50 MB
        </p>

        <label className="cursor-pointer bg-white px-5 py-2.5 border border-gray-300 rounded-lg shadow-2xs text-xs font-semibold text-gray-700 hover:bg-gray-50 transition-colors">
          Browse files
          <input
            type="file"
            accept=".csv, .xlsx, .xls, text/csv, application/vnd.openxmlformats-officedocument.spreadsheetml.sheet, application/vnd.ms-excel"
            className="hidden"
            onChange={handleFileChange}
          />
        </label>

        <div className="flex flex-wrap items-center justify-center gap-3 mt-4">
          <a
            href="/sample_products.csv"
            download="sample_products.csv"
            onClick={handleDownloadSampleCsv}
            className="text-xs text-indigo-600 hover:text-indigo-800 underline inline-flex items-center gap-1 cursor-pointer font-medium"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download Sample CSV (.csv)
          </a>
          <span className="text-gray-300">·</span>
          <a
            href="/sample_products.xlsx"
            download="sample_products.xlsx"
            onClick={handleDownloadSampleXlsx}
            className="text-xs text-emerald-600 hover:text-emerald-800 underline inline-flex items-center gap-1 cursor-pointer font-medium"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            Download Sample Excel (.xlsx)
          </a>
        </div>
      </div>

      <div>
        <button
          onClick={onValidate}
          disabled={!file || isValidating}
          className="w-full flex items-center justify-center gap-2 py-3 px-6 rounded-xl shadow-xs text-sm font-black text-[var(--color-primary-text,#000000)] bg-[var(--color-primary,#a7cd18)] hover:bg-[var(--color-primary-hover,#96bb13)] border border-[var(--theme-sidebar-border,#91b212)] focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-[var(--color-primary)] disabled:opacity-50 disabled:cursor-not-allowed transition-all cursor-pointer"
        >
          {isValidating ? (
            <>
              <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" fill="none" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Validating & Generating Preview...
            </>
          ) : (
            <>
              <ViewIcon className="w-4 h-4 shrink-0 fill-current text-[var(--color-primary-text,#000000)]" />
              <span>Preview & Import Products</span>
            </>
          )}
        </button>
      </div>
    </div>
  );
}
