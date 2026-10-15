'use client';
import React, { useState, useMemo } from 'react';
import { Badge, Text, Icon } from '@shopify/polaris';
import { XIcon } from '@shopify/polaris-icons';
import { CustomSelect } from './CustomSelect';
import { useTheme } from '@/components/providers/ThemeContext';

export interface ColumnConfig {
  title: string;
  key: string;
  type?: 'text' | 'image' | 'badge' | 'bold' | 'status' | 'custom_html' | 'react_node';
  badgeRules?: { [key: string]: 'success' | 'critical' | 'warning' | 'info' };
  width?: string;
  align?: 'left' | 'center' | 'right';
}

export interface TableProps {
  title?: string;
  headerColor?: string;
  columns: ColumnConfig[];
  items: any[];
  emptyState?: React.ReactNode;
  errorState?: React.ReactNode;
  loading?: boolean;
  searchable?: boolean;
  searchKey?: string;
  filterable?: boolean;
  filterKey?: string;
  filterOptions?: { label: string; value: string }[];
  paginate?: boolean;
  // Server-side support props
  serverSide?: boolean;
  totalItems?: number;
  page?: number;
  totalPages?: number;
  onPageChange?: (page: number) => void;
  searchValue?: string;
  onSearchChange?: (value: string) => void;
  filterValue?: string;
  onFilterChange?: (value: string) => void;
  secondaryFilterable?: boolean;
  secondaryFilterValue?: string;
  secondaryFilterOptions?: { label: string; value: string }[];
  onSecondaryFilterChange?: (value: string) => void;
  extraControls?: React.ReactNode;
  itemsPerPage?: number;
  onRowClick?: (item: any) => void;
}

/* ── Centered full-page spinner ── */
function TableSpinner() {
  return (
    <div className="flex flex-col items-center justify-center p-[56px_20px] gap-4">
      <div className="w-11 h-11 rounded-full border-4 border-black/10 border-t-[var(--color-primary)] animate-spin" />
      <p className="m-0 text-[13px] text-gray-400 font-medium">Loading data…</p>
    </div>
  );
}

/* ── Rich empty state ── */
function DefaultEmptyState() {
  return (
    <div className="p-[56px_20px] text-center flex flex-col items-center gap-3">
      <svg width="56" height="56" viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg">
        <circle cx="32" cy="32" r="32" fill="#f3f4f6" />
        <path d="M20 44L26 26H38L44 44H20Z" fill="#d1d5db" />
        <rect x="26" y="20" width="12" height="4" rx="2" fill="#9ca3af" />
        <circle cx="32" cy="36" r="3" fill="#9ca3af" />
      </svg>
      <div>
        <p className="font-semibold text-[15px] text-gray-700 m-0">No records found</p>
        <p className="text-[13px] text-gray-400 mt-1 mb-0">Try adjusting your search or filter criteria.</p>
      </div>
    </div>
  );
}

/* ── Search input ── */
function SearchInput({ value, onChange, placeholder, accentColor }: { value: string; onChange: (v: string) => void; placeholder: string; accentColor?: string }) {
  const [isFocused, setIsFocused] = useState(false);
  return (
    <div className="relative flex-1 min-w-[180px]">
      <svg
        className="absolute left-2.5 top-1/2 -translate-y-1/2 transition-colors"
        style={{ color: isFocused && accentColor ? accentColor : '#9ca3af' }}
        width="16"
        height="16"
        fill="none"
        viewBox="0 0 24 24"
        stroke="currentColor"
        strokeWidth={2}
      >
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        onFocus={() => setIsFocused(true)}
        onBlur={() => setIsFocused(false)}
        placeholder={placeholder}
        style={{
          borderColor: isFocused && accentColor ? accentColor : '#d1d5db',
          boxShadow: isFocused && accentColor ? `0 0 0 2px ${accentColor}25` : undefined,
        }}
        className="w-full pl-8.5 pr-8 py-2 border rounded-lg text-[13px] outline-none transition-all bg-white box-border text-gray-700"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-2 top-1/2 -translate-y-1/2 bg-transparent border-none cursor-pointer text-gray-400 hover:text-gray-600 p-0.5 leading-none flex items-center justify-center"
          title="Clear search"
        >
          <span className="w-3.5 h-3.5 flex items-center">
            <Icon source={XIcon} tone="subdued" />
          </span>
        </button>
      )}
    </div>
  );
}

const ImageCell = ({ src }: { src: string | string[] }) => {
  const [errorIndex, setErrorIndex] = useState(0);
  const srcArray = Array.isArray(src) ? src : [src];
  const currentSrc = srcArray[errorIndex];

  if (errorIndex >= srcArray.length || !currentSrc) {
    return (
      <div style={{ width: 40, height: 40, borderRadius: 6, backgroundColor: '#f8fafc', display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px dashed #cbd5e1', margin: '0 auto' }}>
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#94a3b8" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      </div>
    );
  }
  return (
    <img 
      src={currentSrc} 
      alt="Product" 
      onError={() => setErrorIndex(prev => prev + 1)} 
      style={{ width: 40, height: 40, borderRadius: 6, objectFit: 'cover', border: '1px solid #e5e7eb', display: 'block', margin: '0 auto' }} 
    />
  );
};

export function Table({
  title,
  headerColor,
  columns,
  items,
  emptyState,
  errorState,
  loading = false,
  searchable = true,
  searchKey,
  filterable = true,
  filterKey,
  filterOptions = [{ label: 'All', value: 'ALL' }],
  paginate = true,
  serverSide = false,
  totalItems,
  page: controlledPage,
  totalPages: controlledTotalPages,
  onPageChange,
  searchValue: controlledSearchValue,
  onSearchChange,
  filterValue: controlledFilterValue,
  onFilterChange,
  secondaryFilterable = false,
  secondaryFilterValue,
  secondaryFilterOptions,
  onSecondaryFilterChange,
  extraControls,
  itemsPerPage = 10,
  onRowClick,
}: TableProps) {
  const { currentTheme } = useTheme();
  const effectiveHeaderColor = headerColor || '#6366f1';

  const [localQuery, setLocalQuery] = useState('');
  const [localFilterValue, setLocalFilterValue] = useState('ALL');
  const [localPage, setLocalPage] = useState(1);

  const query = serverSide ? (controlledSearchValue ?? '') : localQuery;
  const setQuery = (val: string) => {
    if (serverSide) {
      onSearchChange?.(val);
    } else {
      setLocalQuery(val);
    }
  };

  const currentFilterValue = serverSide ? (controlledFilterValue ?? 'ALL') : localFilterValue;
  const handleFilterChange = (val: string) => {
    if (serverSide) {
      onFilterChange?.(val);
    } else {
      setLocalFilterValue(val);
    }
  };

  const currentPage = serverSide ? (controlledPage ?? 1) : localPage;
  const handlePageChange = (p: number) => {
    if (serverSide) {
      onPageChange?.(p);
    } else {
      setLocalPage(p);
    }
  };

  // Derive a soft background tint from effectiveHeaderColor (12% opacity)
  const headerBg = `${effectiveHeaderColor}1a`;
  const headerText = effectiveHeaderColor;

  const filteredItems = useMemo(() => {
    if (serverSide) return items;
    return items.filter((item) => {
      let matchSearch = true;
      let matchFilter = true;
      if (searchable && searchKey && query) {
        const val = item[searchKey]?.toString().toLowerCase() || '';
        matchSearch = val.includes(query.toLowerCase());
      }
      if (filterable && filterKey && currentFilterValue !== 'ALL') {
        matchFilter = item[filterKey] === currentFilterValue;
      }
      return matchSearch && matchFilter;
    });
  }, [items, query, currentFilterValue, searchable, searchKey, filterable, filterKey, serverSide]);

  const totalPages = serverSide
    ? (controlledTotalPages ?? 1)
    : (Math.ceil(filteredItems.length / itemsPerPage) || 1);

  const paginatedItems = serverSide
    ? items
    : (paginate ? filteredItems.slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage) : filteredItems);

  React.useEffect(() => {
    if (!serverSide) {
      setLocalPage(1);
    }
  }, [query, currentFilterValue, serverSide]);

  const renderCell = (item: any, col: ColumnConfig) => {
    const val = item[col.key];
    switch (col.type) {
      case 'image':
        return <ImageCell src={val} />;
      case 'bold':
        return <strong style={{ fontWeight: 600, color: '#111827' }}>{val ?? '—'}</strong>;
      case 'badge':
      case 'status': {
        const tone = col.badgeRules ? (col.badgeRules[val] || 'info') : 'info';
        return <Badge tone={tone as any}>{val ?? '—'}</Badge>;
      }
      case 'custom_html':
        return <div dangerouslySetInnerHTML={{ __html: val }} />;
      case 'react_node':
        return val;
      default:
        return <span style={{ color: '#374151', fontSize: 13 }}>{val ?? '—'}</span>;
    }
  };

  return (
    <div className="w-full bg-white/90 backdrop-blur-md rounded-xl border border-gray-200/80 shadow-2xs relative">

      {/* ── Table Header / Toolbar ── */}
      {(title || searchable || filterable) && !loading && (
        <div className="p-3 sm:p-4 px-4 sm:px-5 border-b border-gray-100 bg-white/40 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 sm:gap-4 rounded-t-xl">
          
          {/* Left Side: Title */}
          <div className="flex items-center gap-3">
            {title && (
              <h3 className="text-base sm:text-lg font-bold uppercase tracking-wider m-0" style={{ color: effectiveHeaderColor }}>
                {title}
              </h3>
            )}
          </div>

          {/* Right Side: Search & Filter */}
          <div className="flex flex-col sm:flex-row gap-2.5 sm:gap-3 items-stretch sm:items-center w-full sm:w-auto sm:ml-auto">
            {searchable && (searchKey || serverSide) && (
              <div className="w-full sm:w-auto flex-1 sm:min-w-[200px]">
                <SearchInput
                  value={query}
                  onChange={setQuery}
                  placeholder={`Search ${title?.replace(/[^a-zA-Z ]/g, '').trim() || 'records'}…`}
                  accentColor={effectiveHeaderColor}
                />
              </div>
            )}
            {secondaryFilterable && secondaryFilterOptions && (
              <div className="w-full sm:w-auto sm:min-w-[170px]">
                <CustomSelect
                  options={secondaryFilterOptions}
                  value={secondaryFilterValue || 'ALL'}
                  onChange={(value) => onSecondaryFilterChange?.(value)}
                  accentColor={effectiveHeaderColor}
                />
              </div>
            )}
            {filterable && (filterKey || serverSide) && (
              <div className="w-full sm:w-auto sm:min-w-[160px]">
                <CustomSelect
                  options={filterOptions}
                  value={currentFilterValue}
                  onChange={(value) => handleFilterChange(value)}
                  accentColor={effectiveHeaderColor}
                />
              </div>
            )}
            {extraControls}
            {(query || currentFilterValue !== 'ALL' || (secondaryFilterable && secondaryFilterValue && secondaryFilterValue !== 'ALL')) && (
              <span className="text-xs text-gray-400 self-end sm:self-center shrink-0">
                {serverSide ? (totalItems ?? items.length) : filteredItems.length} result{((serverSide ? (totalItems ?? items.length) : filteredItems.length) !== 1) ? 's' : ''}
              </span>
            )}
          </div>
        </div>
      )}

      {/* ── Table body / Loading / Error ── */}
      {errorState ? (
        <div className="p-12 px-5 text-center text-red-600 font-medium">
          {errorState}
        </div>
      ) : (
        <div className="relative overflow-x-auto w-full">
          <table className="w-full min-w-[640px] border-collapse">
            <thead>
              <tr>
                {columns.map((col, i) => (
                  <th
                    key={col.key}
                    style={{
                      width: col.width,
                      backgroundColor: headerBg,
                      color: headerText,
                      borderBottom: `2px solid ${effectiveHeaderColor}44`,
                      borderRight: i < columns.length - 1 ? '1px solid #f1f5f9' : 'none',
                      textAlign: col.align || 'center',
                    }}
                    className="p-[10px_8px] font-bold text-xs uppercase tracking-wider whitespace-nowrap overflow-hidden text-ellipsis"
                  >
                    {col.title}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {paginatedItems.length === 0 ? (
                <tr>
                  <td colSpan={columns.length} className="p-0">
                    {emptyState ?? <DefaultEmptyState />}
                  </td>
                </tr>
              ) : (
                paginatedItems.map((item, index) => (
                  <tr
                    key={item.id ?? index}
                    onClick={(e) => {
                      // Don't trigger if clicked on an anchor link or button inside the cell
                      const target = e.target as HTMLElement;
                      if (target.closest('a') || target.closest('button') || target.closest('input')) {
                        return;
                      }
                      if (onRowClick) {
                        onRowClick(item);
                      }
                    }}
                    style={{
                      backgroundColor: index % 2 === 0 ? 'rgba(255,255,255,0.95)' : `${effectiveHeaderColor}0a`,
                      transition: 'background-color 0.15s',
                      cursor: onRowClick ? 'pointer' : 'default'
                    }}
                    onMouseEnter={(e) => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = `${effectiveHeaderColor}18`; }}
                    onMouseLeave={(e) => { (e.currentTarget as HTMLTableRowElement).style.backgroundColor = index % 2 === 0 ? 'rgba(255,255,255,0.95)' : `${effectiveHeaderColor}0a`; }}
                  >
                    {columns.map((col, ci) => (
                      <td
                        key={col.key}
                        style={{
                          width: col.width,
                          borderRight: ci < columns.length - 1 ? '1px solid #f8f9ff' : 'none',
                          textAlign: col.align || 'center',
                        }}
                        className="p-[8px_8px] border-b border-slate-100/80 text-[13px] align-middle overflow-hidden text-ellipsis"
                      >
                        {renderCell(item, col)}
                      </td>
                    ))}
                  </tr>
                ))
              )}
              {loading && (
                <tr>
                  <td colSpan={columns.length} className="p-0 bg-white/80 absolute inset-0 z-10 flex items-center justify-center backdrop-blur-[1px]">
                    <TableSpinner />
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Pagination ── */}
      {paginate && totalPages > 1 && (
        <div className="p-3 px-5 border-t border-gray-200 bg-white flex items-center justify-between flex-wrap gap-2">
          <span className="text-xs text-gray-400">
            {serverSide ? (
              `Showing ${(currentPage - 1) * itemsPerPage + 1}–${Math.min(currentPage * itemsPerPage, totalItems ?? items.length)} of ${totalItems ?? items.length} records`
            ) : (
              `Showing ${(currentPage - 1) * itemsPerPage + 1}–${Math.min(currentPage * itemsPerPage, filteredItems.length)} of ${filteredItems.length} records`
            )}
          </span>
          <div className="inline-flex items-center gap-3 bg-white px-2 py-1 rounded-xl border border-gray-200 shadow-2xs">
            <button
              onClick={() => handlePageChange(Math.max(currentPage - 1, 1))}
              disabled={currentPage <= 1 || loading}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                currentPage <= 1 || loading
                  ? 'bg-[#eaebee] text-gray-400 cursor-not-allowed opacity-50'
                  : 'bg-[#e4e5e7] hover:bg-[#d8d9dc] text-gray-800 cursor-pointer shadow-2xs'
              }`}
              aria-label="Previous page"
            >
              ‹
            </button>

            <span className="text-xs font-semibold text-gray-700 select-none px-1">
              Page {currentPage} of {totalPages}
            </span>

            <button
              onClick={() => handlePageChange(Math.min(currentPage + 1, totalPages))}
              disabled={currentPage >= totalPages || loading}
              className={`w-8 h-8 rounded-lg flex items-center justify-center transition-all ${
                currentPage >= totalPages || loading
                  ? 'bg-[#eaebee] text-gray-400 cursor-not-allowed opacity-50'
                  : 'bg-[#e4e5e7] hover:bg-[#d8d9dc] text-gray-800 cursor-pointer shadow-2xs'
              }`}
              aria-label="Next page"
            >
              ›
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
