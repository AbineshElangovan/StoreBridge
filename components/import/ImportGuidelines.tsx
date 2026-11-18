import React from 'react';
import { Icon } from '@shopify/polaris';
import {
  ArrowDownIcon,
  UploadIcon,
  ViewIcon,
  EditIcon,
  ImportIcon,
} from '@shopify/polaris-icons';

const GUIDELINES = [
  {
    icon: ArrowDownIcon,
    title: '1. Download Sample (Optional)',
    desc: 'Download the sample CSV or Excel (.xlsx) template to check the format and fill in your product details.',
    accent: '#8b5cf6',
  },
  {
    icon: UploadIcon,
    title: '2. Browse & Upload File',
    desc: 'Upload your completed CSV or Excel spreadsheet. All rows and columns are automatically detected and validated.',
    accent: '#06b6d4',
  },
  {
    icon: ViewIcon,
    title: '3. Preview Products',
    desc: 'Click "Preview & Import Products" to view all products, variants, collections, and validation statuses in a table.',
    accent: '#3b82f6',
  },
  {
    icon: EditIcon,
    title: '4. Edit Details & Add Images',
    desc: 'Directly edit product names, prices, and quantities inline. Enter image URLs or attach raw photos via the pin icon.',
    accent: '#f59e0b',
  },
  {
    icon: ImportIcon,
    title: '5. Import Products',
    desc: 'Click "Import Products" to securely create products, variations, inventory, and images directly into Shopify.',
    accent: '#10b981',
  },
];

const CSV_COLUMNS = [
  'Title',
  'Description',
  'Price',
  'Compare-at price',
  'Status',
  'Product category',
  'Collections',
  'Inventory tracker',
  'Inventory quantity',
  'Option1 name',
  'Option1 value',
  'Option2 name',
  'Option2 value',
  'SKU',
  'Image',
];

export function ImportGuidelines() {
  return (
    <div
      className="rounded-2xl border overflow-hidden shadow-sm"
      style={{
        backgroundColor: 'var(--theme-surface, #fff)',
        borderColor: 'var(--theme-border-accent, var(--border-color))',
      }}
    >
      {/* Header */}
      <div
        className="px-5 py-4 border-b"
        style={{
          background: 'linear-gradient(135deg, var(--color-primary-light, #ede9fe), var(--theme-surface, #fff))',
          borderColor: 'var(--theme-border-accent, var(--border-color))',
        }}
      >
        <h3
          className="text-sm font-extrabold uppercase tracking-widest"
          style={{ color: 'var(--color-primary)' }}
        >
          How Import Works
        </h3>
        <p className="text-xs text-gray-500 mt-0.5">5 simple steps from upload to Shopify import</p>
      </div>

      {/* Guidelines list */}
      <div className="p-4 flex flex-col gap-1">
        {GUIDELINES.map((g, i) => (
          <div
            key={i}
            className="flex gap-3 items-start px-3 py-2.5 rounded-xl transition-colors hover:bg-black/[0.02]"
            style={{ borderLeft: `3px solid ${g.accent}` }}
          >
            <span
              className="mt-0.5 shrink-0"
              style={{ color: g.accent }}
            >
              <Icon source={g.icon} tone="inherit" />
            </span>
            <div className="min-w-0">
              <p className="text-xs font-bold text-gray-800">{g.title}</p>
              <p className="text-[11px] text-gray-500 mt-0.5 leading-relaxed">{g.desc}</p>
            </div>
          </div>
        ))}
      </div>

      {/* CSV Columns */}
      <div
        className="px-4 pb-4 pt-3 border-t"
        style={{ borderColor: 'var(--theme-border-accent, var(--border-color))' }}
      >
        <span className="text-xs font-extrabold uppercase tracking-widest text-gray-500 block mb-3">
          Supported CSV & Excel Columns
        </span>
        <div className="flex flex-wrap gap-1.5">
          {CSV_COLUMNS.map((col) => (
            <span
              key={col}
              className="px-2 py-1 rounded-lg text-[11px] font-semibold border transition-colors"
              style={{
                backgroundColor: 'var(--theme-surface-2, #f8fafc)',
                color: '#64748b',
                borderColor: 'var(--border-color, #e2e8f0)',
              }}
            >
              {col}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
