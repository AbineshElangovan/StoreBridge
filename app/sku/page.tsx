"use client";
import React, { useState, useEffect, useRef } from "react";
import { shopifyFetch } from "@/lib/shopify/Client";
import { Loading } from "@/components/common";
import CollectionSkuRule from "@/components/stores/CollectionSkuRule";
import { Input } from "@/components/forms/Input";
import { useStoreContext } from "@/components/providers/StoreProvider";
import { SkuGeneratorContainer } from "@/components/sku-generation/SkuGeneratorContainer";

export default function SkuSettingsPage() {
  const [activeTab, setActiveTab] = useState<"global_rules" | "variant_generator">("global_rules");

  const [skuPrefix, setSkuPrefix] = useState("SHOE");
  const [skuSequence, setSkuSequence] = useState("0001");

  const [storeId, setStoreId] = useState("");
  const [storeName, setStoreName] = useState("");

  const [selectedCollectionPrefix, setSelectedCollectionPrefix] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [isMaster, setIsMaster] = useState(true);
  const [toastMessage, setToastMessage] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const [inlineError, setInlineError] = useState<string | null>(null);

  const [skuMode, setSkuMode] = useState<"default" | "collection">("default");
  const [copied, setCopied] = useState(false);

  const { canManageSku } = useStoreContext();
  const hasWriteAccess = canManageSku;

  const collectionRuleRef = useRef<any>(null);

  useEffect(() => {
    fetchSettings();
  }, []);

  useEffect(() => {
    if (toastMessage) {
      const timer = setTimeout(() => {
        setToastMessage(null);
      }, 3000);
      return () => clearTimeout(timer);
    }
  }, [toastMessage]);

  const fetchSettings = async () => {
    try {
      setLoading(true);
      const res = await shopifyFetch("/api/settings/sku");
      const data = await res.json();
      if (data.success && data.setting) {
        setSkuPrefix(data.setting.skuPrefix || "SHOE");
        const seq = data.setting.skuSequence || 1;
        setSkuSequence(seq.toString().padStart(4, "0"));
        setIsMaster(data.isMaster !== false);
        setStoreId(data.setting.storeId);
        setStoreName(data.storeName || "Store");
      }
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    setToastMessage(null);
    setInlineError(null);

    try {
      const finalPrefix = skuPrefix.trim() || "SHOE";

      const res = await shopifyFetch("/api/settings/sku", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ skuPrefix: finalPrefix, skuSequence }),
      });
      const data = await res.json();

      if (collectionRuleRef.current && hasWriteAccess) {
        await collectionRuleRef.current.saveRules();
      }

      if (data.success) {
        setSkuPrefix(data.setting.skuPrefix);
        setSkuSequence(data.setting.skuSequence.toString().padStart(4, "0"));
        setToastMessage({ message: "SKU configuration and collection rules saved successfully.", type: "success" });
      } else {
        setToastMessage({ message: data.error || "Failed to save configuration.", type: "error" });
        if (data.nextSequence) {
          setInlineError(`Prefix "${skuPrefix}" already exists. Next available sequence: ${data.nextSequence}.`);
          setSkuSequence(data.nextSequence.toString().padStart(4, "0"));
        }
      }
    } catch (err: any) {
      setToastMessage({ message: err.message, type: "error" });
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <Loading label="Loading SKU system..." />;
  }

  const generatedPreview = `STB-${skuPrefix || "SHOE"}-${
    skuMode === "collection" && selectedCollectionPrefix ? selectedCollectionPrefix + "-" : ""
  }${skuSequence ? skuSequence.toString().padStart(4, "0") : "0001"}`;

  const handleCopySku = async () => {
    if (!generatedPreview) return;
    try {
      await navigator.clipboard.writeText(generatedPreview);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error("Failed to copy SKU", err);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6 sm:py-10 w-full overflow-x-hidden space-y-6">
      {/* Header Banner */}
      <div className="border-b border-gray-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="page-title text-3xl sm:text-4xl font-extrabold text-slate-900 tracking-tight m-0">
            SKU Management & Variant Generator
          </h1>
          <p className="page-subtitle text-lg sm:text-xl font-medium text-slate-500 mt-1.5 m-0">
          Build dynamic SKUs by variant with flexible global prefix settings.          </p>
        </div>
      </div>

      {!hasWriteAccess && (
        <div className="p-4 rounded-md font-medium shadow-sm border bg-red-50 text-red-800 border-red-200 text-xs sm:text-sm flex items-center gap-2">
          <svg className="w-4 h-4 text-red-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
          </svg>
          <span>Only the Master Store can configure SKU settings. These settings are read-only for this store.</span>
        </div>
      )}

      {/* Main Tabs */}
      <div className="flex border-b border-gray-200 space-x-4">
        <button
          type="button"
          onClick={() => setActiveTab("global_rules")}
          className={`pb-3 px-1 text-sm font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === "global_rules"
              ? "border-[var(--color-primary)] text-black font-black"
              : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          <svg className="w-4 h-4 text-current" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>Global SKU Configuration</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("variant_generator")}
          className={`pb-3 px-1 text-sm font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === "variant_generator"
              ? "border-[var(--color-primary)] text-black font-black"
              : "border-transparent text-gray-500 hover:text-gray-900"
          }`}
        >
          <svg className="w-4 h-4 text-current" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span>Variant SKU Generator</span>
        </button>
      </div>

      {/* TAB 1: Global SKU Rules */}
      {activeTab === "global_rules" && (
        <div className="p-4 sm:p-6 bg-white border border-gray-200 rounded-xl sm:rounded-2xl shadow-2xs">
          <div className="mb-5 border-l-4 sm:border-l-6 border-[var(--color-primary)] pl-3 sm:pl-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-gray-900 m-0">
                Global Sequence & Prefix Settings
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-gray-500 m-0">
                Define the master product prefix and starting sequence for SKU creation.
              </p>
            </div>

            <div
              className={`flex items-center gap-1.5 p-1 bg-gray-100 rounded-xl border border-gray-200 shrink-0 self-start md:self-auto ${
                !hasWriteAccess ? "opacity-60 cursor-not-allowed" : ""
              }`}
            >
              <button
                type="button"
                onClick={() => {
                  if (hasWriteAccess) {
                    setSkuMode("default");
                    setSelectedCollectionPrefix("");
                  }
                }}
                className={`px-3.5 sm:px-4 py-1.5 text-xs sm:text-sm font-black rounded-lg transition-all cursor-pointer ${
                  skuMode === "default" ? "bg-[var(--color-primary)] toggle-btn-active shadow-xs" : "text-gray-700 hover:bg-gray-200/70"
                }`}
                disabled={!hasWriteAccess}
              >
                Default SKU
              </button>
              <button
                type="button"
                onClick={() => hasWriteAccess && setSkuMode("collection")}
                className={`px-3.5 sm:px-4 py-1.5 text-xs sm:text-sm font-black rounded-lg transition-all cursor-pointer ${
                  skuMode === "collection" ? "bg-[var(--color-primary)] toggle-btn-active shadow-xs" : "text-gray-700 hover:bg-gray-200/70"
                }`}
                disabled={!hasWriteAccess}
              >
                Collection SKU
              </button>
            </div>
          </div>

          <div className="bg-gray-50/50 rounded-xl p-4 sm:p-6 border border-gray-200 shadow-2xs flex flex-col gap-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Input
                  label="Product Prefix"
                  prefix="STB -"
                  value={skuPrefix}
                  onChange={(val) => setSkuPrefix(val.toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 10))}
                  autoComplete="off"
                  disabled={!hasWriteAccess}
                />
              </div>

              <div>
                <Input
                  label="Starting Sequence"
                  value={skuSequence}
                  onChange={(val) => setSkuSequence(val.replace(/[^0-9]/g, "").slice(0, 6))}
                  autoComplete="off"
                  error={inlineError || undefined}
                  disabled={!hasWriteAccess}
                />
              </div>
            </div>

            <div className="text-xs sm:text-sm text-gray-600 bg-white p-3 sm:p-4 rounded-lg border border-gray-200">
              <span className="font-semibold text-gray-800">Dynamic Insertion:</span> If a product belongs to a Collection or has Variants (e.g. Size/Color/Age), the system will automatically extract their short-form abbreviations and insert them into the generated SKU.
            </div>

            {storeId && skuMode === "collection" && (
              <div>
                <CollectionSkuRule
                  ref={collectionRuleRef}
                  storeId={storeId}
                  onSelectCollection={(id, prefix) => setSelectedCollectionPrefix(prefix)}
                />
              </div>
            )}

            <div className="mt-2 p-5 bg-[var(--color-primary-light)] border-2 border-[var(--theme-border-accent)] rounded-xl shadow-2xs text-center flex flex-col items-center justify-center gap-2.5">
              <p className="text-gray-600 text-xs sm:text-sm font-semibold m-0">Generated Base SKU Example</p>

              <div className="flex flex-wrap items-center justify-center gap-3.5 my-1">
                <span className="text-2xl sm:text-3xl lg:text-4xl font-black text-[var(--color-primary-dark)] tracking-wider font-mono break-all select-all">
                  {generatedPreview}
                </span>

                <button
                  type="button"
                  onClick={handleCopySku}
                  className={`inline-flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all cursor-pointer shadow-xs border shrink-0 ${
                    copied
                      ? "bg-emerald-600 text-white border-emerald-600 shadow-emerald-100"
                      : "bg-white text-[var(--color-primary-dark)] hover:bg-gray-50 border-gray-300 hover:border-gray-400 active:scale-95"
                  }`}
                  title="Copy SKU to clipboard"
                >
                  {copied ? (
                    <>
                      <svg className="w-3.5 h-3.5 text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                      </svg>
                      <span>Copied!</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-3.5 h-3.5 text-[var(--color-primary)]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                      </svg>
                      <span>Copy SKU</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            <div className="mt-4 pt-4 border-t border-gray-200 flex flex-col sm:flex-row justify-end items-stretch sm:items-center gap-3">
              {toastMessage && (
                <span
                  className={`text-xs sm:text-sm font-semibold text-center sm:text-left sm:mr-auto ${
                    toastMessage.type === "success" ? "text-green-600" : "text-red-600"
                  }`}
                >
                  {toastMessage.message}
                </span>
              )}
              <button
                className="w-full sm:w-auto px-5 py-2.5 bg-[var(--color-primary)] text-black text-sm font-black rounded-xl hover:opacity-90 transition-all shadow-2xs text-center cursor-pointer"
                onClick={handleSave}
                disabled={saving || !hasWriteAccess}
              >
                {saving ? "Saving..." : "Save Configuration"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: Variant SKU Generator */}
      {activeTab === "variant_generator" && <SkuGeneratorContainer />}
    </div>
  );
}
