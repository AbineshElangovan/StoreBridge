"use client";

import { useState, useCallback, useEffect } from "react";
import {
  ResourceList,
  ResourceItem,
  Text,
  Badge,
  TextField,
  BlockStack,
  InlineStack,
  Box,
  Icon,
  Button,
} from "@shopify/polaris";
import { ProductAddIcon, EditIcon, DeleteIcon, CartIcon, InfoIcon, SearchIcon, ExportIcon } from "@shopify/polaris-icons";
import { shopifyFetch } from "@/lib/shopify/Client";
import { StoreRoleBadge } from '@/components/ui/StoreRoleBadge';
import { Loading, SearchBar, CustomSelect, Pagination } from '@/components/common';
import { useStoreContext } from '@/components/providers/StoreProvider';

function ProductThumbnail({ src, title }: { src?: string | null; title?: string | null }) {
  const [imgError, setImgError] = useState(false);

  useEffect(() => {
    setImgError(false);
  }, [src]);

  if (!src || imgError) {
    return (
      <div 
        className="w-8 h-8 rounded-lg bg-slate-100 flex-shrink-0 border border-slate-200 flex items-center justify-center text-slate-400 select-none shadow-2xs"
        title={title || "Product"}
      >
        <svg className="w-4 h-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
          <circle cx="8.5" cy="8.5" r="1.5" />
          <polyline points="21 15 16 10 5 21" />
        </svg>
      </div>
    );
  }

  return (
    <div className="w-8 h-8 rounded-lg bg-slate-100 flex-shrink-0 border border-slate-200 overflow-hidden shadow-2xs">
      <img 
        src={src} 
        alt="" 
        onError={() => setImgError(true)} 
        className="w-full h-full object-cover" 
        loading="lazy"
      />
    </div>
  );
}

export default function ActivityPage() {
  const { isStandalone, isMultiStore } = useStoreContext();
  const [activities, setActivities] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentStoreId, setCurrentStoreId] = useState<string | null>(null);
  const [allowedStoreIds, setAllowedStoreIds] = useState<string[]>([]);
  const [connectionStatus, setConnectionStatus] = useState<string>("Disconnected");

  // Filters state
  const [queryValue, setQueryValue] = useState("");
  const [debouncedQueryValue, setDebouncedQueryValue] = useState("");
  const [collectionFilter, setCollectionFilter] = useState("");
  const [storeFilter, setStoreFilter] = useState("");
  const [dateFilter, setDateFilter] = useState("all");

  useEffect(() => {
    const handler = setTimeout(() => {
      setDebouncedQueryValue(queryValue);
      setPage(1); // Reset page when search term changes
    }, 500);
    return () => clearTimeout(handler);
  }, [queryValue]);

  const [collectionOptions, setCollectionOptions] = useState<any[]>([]);
  const [storeOptions, setStoreOptions] = useState<any[]>([]);

  const [isMaster, setIsMaster] = useState(false);

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [errorMsg, setErrorMsg] = useState("");
  const [isExporting, setIsExporting] = useState(false);

  const fetchActivities = useCallback(async () => {
    setLoading(true);
    setErrorMsg("");
    try {
      const params = new URLSearchParams();
      if (debouncedQueryValue) params.append("search", debouncedQueryValue);
      if (collectionFilter) params.append("collection", collectionFilter);
      if (storeFilter) params.append("storeId", storeFilter);
      if (dateFilter) params.append("dateRange", dateFilter);
      params.append("page", page.toString());
      params.append("limit", "10");

      const response = await shopifyFetch(`/api/activity?${params.toString()}`);
      if (response.ok) {
        const data = await response.json();
        setActivities(data.activities || []);
        setIsMaster(data.isMaster || false);
        setTotalPages(data.pagination?.totalPages || 1);
        setCollectionOptions(data.collectionOptions || []);
        setStoreOptions(data.storeOptions || []);
        setCurrentStoreId(data.currentStoreId || null);
        
        // Save the allowed store IDs only if they changed to prevent reconnect churn
        const newIds = (data.allowedStoreIds || []).slice().sort();
        const newKey = newIds.join(',');
        setAllowedStoreIds(prev => {
          if (prev.slice().sort().join(',') === newKey) return prev;
          return newIds;
        });
      } else {
        const errData = await response.json();
        setErrorMsg(errData.error || "Failed to fetch activities");
      }
    } catch (error: any) {
      console.error("Failed to fetch activities:", error);
      setErrorMsg(error.message || "Network error");
    } finally {
      setLoading(false);
    }
  }, [debouncedQueryValue, collectionFilter, storeFilter, dateFilter, page]);

  useEffect(() => {
    fetchActivities();
  }, [fetchActivities]);

  useEffect(() => {
    if (allowedStoreIds.length === 0) return;

    let eventSource: EventSource | null = null;
    let isMounted = true;

    const connectSSE = () => {
      if (!isMounted) return;
      if (typeof window !== 'undefined' && document.hidden) return;

      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }

      setConnectionStatus('Connecting...');
      const storeIdsParam = allowedStoreIds.join(',');
      eventSource = new EventSource(`/api/activity/stream?storeIds=${storeIdsParam}`);

      eventSource.onopen = () => {
        if (isMounted) setConnectionStatus('Live');
      };

      eventSource.addEventListener('new-activity', (e) => {
        if (!isMounted) return;
        try {
          const newActivity = JSON.parse(e.data);
          setActivities(prev => {
            if (prev.some(act => act.id === newActivity.id)) {
              return prev;
            }
            return [newActivity, ...prev];
          });
        } catch (err) {
          console.error("Error parsing new activity", err);
        }
      });

      eventSource.onerror = () => {
        if (isMounted) setConnectionStatus('Disconnected');
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
      };
    };

    // Stagger SSE connection by 1000ms to allow table rendering and image loading to complete first
    const timer = setTimeout(connectSSE, 1000);

    const handleVisibilityChange = () => {
      if (typeof window === 'undefined') return;
      if (document.hidden) {
        if (eventSource) {
          eventSource.close();
          eventSource = null;
        }
        if (isMounted) setConnectionStatus('Disconnected');
      } else {
        connectSSE();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      isMounted = false;
      clearTimeout(timer);
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      if (eventSource) {
        eventSource.close();
        eventSource = null;
      }
    };
  }, [allowedStoreIds]);

  const handleSearchChange = useCallback((value: string) => {
    setQueryValue(value);
  }, []);

  const formatDateParts = (dateString?: string | null) => {
    if (!dateString) return { date: "—", time: "" };
    try {
      const d = new Date(dateString);
      if (isNaN(d.getTime())) return { date: "—", time: "" };
      const date = d.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
      const time = d.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        hour12: true,
      });
      return { date, time };
    } catch {
      return { date: "—", time: "" };
    }
  };

  const getEventTitle = (eventType: string) => {
    switch (eventType) {
      case "CREATE": return "Product Created";
      case "UPDATE": return "Product Updated";
      case "DELETE": return "Product Deleted";
      case "SOLD": return "Product Sold";
      default: return eventType || "Product Activity";
    }
  };

  const getEventBadge = (eventType: string) => {
    switch (eventType) {
      case "CREATE":
        return {
          title: "Product Created",
          colorClass: "text-emerald-700 bg-emerald-50 border-emerald-200",
          dotColor: "bg-emerald-500",
        };
      case "UPDATE":
        return {
          title: "Product Updated",
          colorClass: "text-blue-700 bg-blue-50 border-blue-200",
          dotColor: "bg-blue-500",
        };
      case "DELETE":
        return {
          title: "Product Deleted",
          colorClass: "text-rose-700 bg-rose-50 border-rose-200",
          dotColor: "bg-rose-500",
        };
      case "SOLD":
        return {
          title: "Product Sold",
          colorClass: "text-amber-700 bg-amber-50 border-amber-200",
          dotColor: "bg-amber-500",
        };
      default:
        return {
          title: eventType || "Activity",
          colorClass: "text-slate-700 bg-slate-50 border-slate-200",
          dotColor: "bg-slate-400",
        };
    }
  };

  const exportToPDF = useCallback(async () => {
    setIsExporting(true);
    try {
      const params = new URLSearchParams();
      if (debouncedQueryValue) params.append("search", debouncedQueryValue);
      if (collectionFilter) params.append("collection", collectionFilter);
      if (storeFilter) params.append("storeId", storeFilter);
      if (dateFilter) params.append("dateRange", dateFilter);
      params.append("export", "true");

      const response = await shopifyFetch(`/api/activity?${params.toString()}`);
      if (!response.ok) throw new Error("Failed to fetch export data");
      const data = await response.json();
      const exportActivities = data.activities || [];

      const { default: jsPDF } = await import('jspdf');
      const { default: autoTable } = await import('jspdf-autotable');
      
      const doc = new jsPDF({ orientation: 'landscape', unit: 'mm', format: 'a4' });
      
      // Document Title
      doc.setFontSize(16);
      doc.setTextColor(15, 23, 42);
      doc.text("Activity Log", 14, 15);
      
      doc.setFontSize(9);
      doc.setTextColor(100, 116, 139);
      doc.text(`Generated on ${new Date().toLocaleString('en-GB')}  |  Total Records: ${exportActivities.length}`, 14, 21);

      const tableColumn = ["Date & Time", "Event", "Title", "SKU", "Store", "Description"];
      const tableRows: any[] = [];

      const sanitizeForPdf = (val: string | null | undefined): string => {
        if (!val) return '—';
        return String(val)
          .replace(/₹/g, 'Rs. ')
          .replace(/[→➔➜➝➞]/g, ' -> ')
          .replace(/[←]/g, ' <- ')
          .replace(/[\u2018\u2019]/g, "'")
          .replace(/[\u201C\u201D]/g, '"')
          .replace(/[\u2013\u2014]/g, '-')
          .replace(/\u00A0/g, ' ')
          .replace(/[^\x00-\x7F]/g, '')
          .replace(/\s+/g, ' ')
          .trim();
      };

      exportActivities.forEach((item: any) => {
        const { date, time } = formatDateParts(item.createdAt);
        const dateFormatted = time ? `${date}\n${time}` : (date || "—");
        const event = sanitizeForPdf(getEventTitle(item.eventType));
        const title = sanitizeForPdf(item.productTitle);
        const sku = sanitizeForPdf(item.sku);
        const store = sanitizeForPdf(item.store?.label || item.store?.shopDomain || "Unknown Store");
        const rawDesc = item.description || "Product details updated in catalog";
        const desc = sanitizeForPdf(rawDesc);

        tableRows.push([dateFormatted, event, title, sku, store, desc]);
      });

      autoTable(doc, {
        head: [tableColumn],
        body: tableRows,
        startY: 25,
        margin: { left: 12, right: 12, bottom: 12 },
        theme: 'grid',
        tableWidth: 'auto',
        styles: {
          font: 'helvetica',
          fontSize: 8,
          cellPadding: { top: 2.5, right: 2.5, bottom: 2.5, left: 2.5 },
          valign: 'middle',
          overflow: 'linebreak',
          textColor: [30, 41, 59],
          lineWidth: 0.1,
          lineColor: [226, 232, 240]
        },
        headStyles: {
          fillColor: [99, 102, 241], // #6366f1 Purple Table Header
          textColor: [255, 255, 255],
          fontStyle: 'bold',
          fontSize: 8.5,
          halign: 'left',
          cellPadding: 3
        },
        columnStyles: {
          0: { cellWidth: 28, halign: 'left' }, // Date & Time
          1: { cellWidth: 32, fontStyle: 'bold' }, // Event
          2: { cellWidth: 48, overflow: 'linebreak' }, // Title
          3: { cellWidth: 34, overflow: 'linebreak' }, // SKU
          4: { cellWidth: 36, overflow: 'linebreak' }, // Store
          5: { cellWidth: 'auto', overflow: 'linebreak' } // Description: cleanly auto-fits and wraps inside cell box
        },
        alternateRowStyles: {
          fillColor: [248, 250, 252]
        }
      });

      doc.save(`Activity_Log_${new Date().toISOString().split('T')[0]}.pdf`);
    } catch (error) {
      console.error("Export failed:", error);
      setErrorMsg("Failed to export activities");
    } finally {
      setIsExporting(false);
    }
  }, [debouncedQueryValue, collectionFilter, storeFilter, dateFilter]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 w-full overflow-x-hidden">
      <div className="flex flex-col gap-6 min-w-0 w-full">
        {/* Header */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
          <div>
            <h1 className="page-title text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight m-0">
              Activity
            </h1>
            <p className="page-subtitle text-lg sm:text-xl font-medium text-slate-500 mt-1 m-0">
              Full audit trail of product changes and sync events.
            </p>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={exportToPDF}
              disabled={isExporting}
              className="flex items-center gap-2 bg-[#6366f1] hover:bg-[#4f46e5] text-white px-4 py-2 rounded-lg font-semibold text-sm transition-all shadow-xs cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
              <span>{isExporting ? 'Exporting...' : 'Export'}</span>
            </button>
          </div>
        </div>

        {/* Main Card */}
        <div className="w-full bg-white overflow-hidden rounded-xl border border-gray-200 shadow-2xs">
          {/* Filters Bar */}
          <div className="p-3.5 sm:p-4 px-4 sm:px-5 border-b border-slate-100 bg-slate-50/50 flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <div className="w-full sm:w-auto flex-1 sm:min-w-[220px]">
              <SearchBar
                label="Search"
                labelHidden
                placeholder="Search by Product Title or SKU..."
                value={queryValue}
                onChange={handleSearchChange}
                autoComplete="off"
                clearButton
                onClearButtonClick={() => handleSearchChange("")}
                prefix={<Icon source={SearchIcon} tone="base" />}
              />
            </div>

            {/* Custom Tailwind Collection Select */}
            <div className="w-full sm:w-auto sm:min-w-[170px]">
              <CustomSelect
                label="Collection"
                labelHidden
                options={[
                  { label: 'All Collections', value: '' },
                  ...collectionOptions
                    .filter(opt => opt.value !== '')
                    .map(opt => ({ label: opt.label, value: opt.value }))
                ]}
                value={collectionFilter}
                onChange={(value) => { setCollectionFilter(value); setPage(1); }}
              />
            </div>

            {/* Custom Tailwind Store Select (Master Only) */}
            {isMaster && isMultiStore && (
              <div className="w-full sm:w-auto sm:min-w-[160px]">
                <CustomSelect
                  label="Store"
                  labelHidden
                  options={[
                    { label: 'All Stores', value: 'all' },
                    ...storeOptions
                      .filter(opt => opt.value !== 'all')
                      .map(opt => ({ label: opt.label, value: opt.value }))
                  ]}
                  value={storeFilter}
                  onChange={(value) => { setStoreFilter(value); setPage(1); }}
                />
              </div>
            )}

            {/* Date Filter Select */}
            <div className="w-full sm:w-auto sm:min-w-[140px]">
              <CustomSelect
                label="Date Range"
                labelHidden
                options={[
                  { label: 'All Time', value: 'all' },
                  { label: 'Last 24 Hours', value: 'today' },
                  { label: 'Last 7 Days', value: 'week' },
                  { label: 'Last 30 Days', value: 'month' },
                ]}
                value={dateFilter}
                onChange={(value) => { setDateFilter(value); setPage(1); }}
              />
            </div>
          </div>
          
          {errorMsg && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg my-4 mx-4 text-sm">
              <strong>Error: </strong>{errorMsg}
            </div>
          )}

          {loading ? (
            <div className="py-16 flex flex-col items-center justify-center gap-3">
              <Loading label="Loading activities..." />
            </div>
          ) : activities.length === 0 ? (
            <div className="py-16 text-center flex flex-col items-center justify-center gap-2">
              <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 mb-1">
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.75" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <p className="text-sm font-bold text-slate-700 m-0">No activities found</p>
              <p className="text-xs text-slate-400 m-0">Try adjusting your search query, collection, store, or date filter.</p>
            </div>
          ) : (
            <>
              {/* Desktop & Tablet Table View (Fluid 100% Width) */}
              <div className="hidden md:block w-full overflow-x-auto">
                <table className="w-full text-left border-collapse table-auto">
                  <thead>
                    <tr className="bg-[#6366f1] text-white text-[11px] font-extrabold uppercase tracking-wider select-none">
                      <th className="py-3 px-3.5 w-[13%]">Date & Time</th>
                      <th className="py-3 px-3.5 w-[14%]">Event</th>
                      <th className="py-3 px-3.5 w-[22%]">Title</th>
                      <th className="py-3 px-3.5 w-[13%] whitespace-nowrap">SKU</th>
                      <th className="py-3 px-3.5 w-[13%]">Store</th>
                      <th className="py-3 px-3.5 w-[25%]">Description</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-200 text-slate-800 text-xs">
                    {activities.map((item, idx) => {
                      const { id, eventType, productTitle, sku, description, store, createdAt, imageUrl } = item;
                      const { date, time } = formatDateParts(createdAt);
                      const badge = getEventBadge(eventType);
                      const storeLabel = store?.label || store?.shopDomain || "Unknown Store";

                      return (
                        <tr 
                          key={id || idx} 
                          className={`transition-colors hover:bg-slate-50/80 border-b border-slate-200/80 ${idx % 2 === 1 ? 'bg-slate-50/40' : 'bg-white'}`}
                        >
                          {/* 1. Date & Time */}
                          <td className="py-3.5 px-3.5 align-middle">
                            <div className="flex flex-col text-xs leading-tight whitespace-nowrap">
                              <span className="font-bold text-slate-900">{date}</span>
                              {time && (
                                <span className="text-[11px] text-slate-500 font-medium mt-0.5">{time}</span>
                              )}
                            </div>
                          </td>

                          {/* 2. Event */}
                          <td className="py-3.5 px-3.5 align-middle">
                            <div className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-semibold whitespace-nowrap shadow-2xs ${badge.colorClass}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${badge.dotColor}`} />
                              <span>{badge.title}</span>
                            </div>
                          </td>

                          {/* 3. Title */}
                          <td className="py-3.5 px-3.5 align-middle">
                            <div className="flex items-center gap-2.5">
                              <ProductThumbnail src={imageUrl} title={productTitle} />
                              <span className="font-bold text-slate-900 text-xs leading-snug line-clamp-2" title={productTitle}>
                                {productTitle || "—"}
                              </span>
                            </div>
                          </td>

                          {/* 4. SKU */}
                          <td className="py-3.5 px-3.5 align-middle whitespace-nowrap">
                            {sku ? (
                              <span className="font-mono text-xs font-semibold text-slate-800 bg-slate-100/90 px-2 py-0.5 rounded border border-slate-200/80 tracking-tight whitespace-nowrap inline-block">
                                {sku}
                              </span>
                            ) : (
                              <span className="text-slate-400 font-mono text-xs">—</span>
                            )}
                          </td>

                          {/* 5. Store (3-line wrap) */}
                          <td className="py-3.5 px-3.5 align-middle">
                            <span className="text-xs font-semibold text-slate-700 leading-snug line-clamp-3 break-words block max-w-[130px]" title={storeLabel}>
                              {storeLabel}
                            </span>
                          </td>

                          {/* 6. Description */}
                          <td className="py-3.5 px-3.5 align-middle">
                            <span className="text-xs text-slate-600 font-normal leading-relaxed break-words block">
                              {description || "Product details updated in catalog"}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {/* Mobile Responsive Cards View */}
              <div className="md:hidden divide-y divide-slate-200 w-full bg-white">
                {activities.map((item, idx) => {
                  const { id, eventType, productTitle, sku, description, store, createdAt, imageUrl } = item;
                  const { date, time } = formatDateParts(createdAt);
                  const badge = getEventBadge(eventType);
                  const storeLabel = store?.label || store?.shopDomain || "Unknown Store";

                  return (
                    <div key={id || idx} className="p-4 flex flex-col gap-2.5 hover:bg-slate-50/50 transition-colors border-b border-slate-200/80">
                      {/* Top: Event Badge + Date & Time */}
                      <div className="flex items-center justify-between gap-2 flex-wrap">
                        <div className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-md border text-xs font-semibold shadow-2xs ${badge.colorClass}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${badge.dotColor}`} />
                          <span>{badge.title}</span>
                        </div>

                        <div className="flex items-center gap-1.5 text-xs text-slate-500 font-medium">
                          <span className="font-bold text-slate-900">{date}</span>
                          {time && <span>• {time}</span>}
                        </div>
                      </div>

                      {/* Product details */}
                      <div className="flex items-start gap-3 mt-0.5">
                        <ProductThumbnail src={imageUrl} title={productTitle} />
                        <div className="flex-1 min-w-0">
                          <div className="font-bold text-slate-900 text-xs leading-snug">
                            {productTitle || "—"}
                          </div>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            {sku && (
                              <span className="font-mono text-[11px] font-semibold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200">
                                {sku}
                              </span>
                            )}
                            <span className="text-[11px] font-semibold text-slate-600 bg-slate-50 px-1.5 py-0.5 rounded border border-slate-200/60 line-clamp-3 break-words">
                              {storeLabel}
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Description */}
                      <div className="text-xs text-slate-600 bg-slate-50/90 p-2.5 rounded-lg border border-slate-100 text-left break-words">
                        {description || "Product details updated in catalog"}
                      </div>
                    </div>
                  );
                })}
              </div>

              {/* Pagination */}
              <div className="flex justify-center border-t border-slate-100 px-4 py-3.5 bg-slate-50/40">
                <Pagination
                  page={page}
                  totalPages={totalPages}
                  onPageChange={setPage}
                />
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
