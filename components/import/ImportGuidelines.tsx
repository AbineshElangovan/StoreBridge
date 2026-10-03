import React from 'react';
import { Icon } from '@shopify/polaris';
import {
  NoteIcon,
  AlertCircleIcon,
  InventoryIcon,
  StoreIcon,
} from '@shopify/polaris-icons';

const GUIDELINES = [
  {
    icon: NoteIcon,
    title: 'Read before import',
    desc: 'Review all guidelines carefully before uploading your CSV file.',
    accent: 'var(--color-primary)',
  },
  {
    icon: AlertCircleIcon,
    title: 'Invalid rows are rejected before import',
    desc: 'The entire file is validated upfront. Fix all errors before proceeding.',
    accent: '#ef4444',
  },
  {
    icon: InventoryIcon,
    title: 'Inventory updates quantity only',
    desc: 'Inventory import updates stock count only — product details are unchanged.',
    accent: '#f59e0b',
  },
  {
    icon: StoreIcon,
    title: 'Store-scoped import',
    desc: 'Imported products are added only to the selected store. Auto-sync is not triggered.',
    accent: '#06b6d4',
  },
];

const CSV_COLUMNS = [
  'Title',
  'Description',
  'Price',
  'Compare-at price',
  'Status',
  'Product category',
  'Type',
  'Vendor',
  'Collections',
  'Tags',
  'Inventory tracker',
  'Inventory quantity',
  'Weight',
  'Option1 name',
  'Option1 value',
  'Option2 name',
  'Option2 value',
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
          Important Guidelines
        </h3>
        <p className="text-xs text-gray-500 mt-0.5">Read carefully before uploading</p>
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
          Supported CSV Columns
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
