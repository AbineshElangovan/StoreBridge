"use client";
import React, { useState, useEffect, useRef } from "react";
import { shopifyFetch } from "@/lib/shopify/Client";
import { Loading } from "@/components/common";
import CollectionSkuRule from "@/components/stores/CollectionSkuRule";
import { Input } from "@/components/forms/Input";
import { useStoreContext } from "@/components/providers/StoreProvider";
import { SkuGeneratorContainer } from "@/components/sku-generation/SkuGeneratorContainer";

export default function SkuSettingsPage() {
  const [activeTab, setActiveTab] = useState<"variant_generator" | "global_rules">("variant_generator");

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

  return (
    <div className="p-4 sm:p-6 lg:p-8 max-w-4xl mx-auto mb-16">
      <div className="mb-6 border-b border-gray-200 pb-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-gray-900 m-0">
            SKU Management & Variant Generator
          </h1>
          <p className="mt-1 text-xs sm:text-sm text-gray-500 m-0">
            Generate variant-based SKUs dynamically (Age 0M–18Y+, Footwear, Clothes, Accessories) and configure global prefixes.
          </p>
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
          onClick={() => setActiveTab("variant_generator")}
          className={`pb-3 px-1 text-sm font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === "variant_generator"
              ? "border-[#0db69d] text-[#0db69d]"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
          <span>Variant SKU Generator</span>
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("global_rules")}
          className={`pb-3 px-1 text-sm font-bold border-b-2 transition-colors cursor-pointer flex items-center gap-2 ${
            activeTab === "global_rules"
              ? "border-[#0db69d] text-[#0db69d]"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
          <span>Global SKU Configuration</span>
        </button>
      </div>

      {/* TAB 1: Variant SKU Generator */}
      {activeTab === "variant_generator" && <SkuGeneratorContainer />}

      {/* TAB 2: Global SKU Rules */}
      {activeTab === "global_rules" && (
        <div className="p-4 sm:p-6 bg-[#f0fdfa] border border-[#ccfbf1] rounded-xl sm:rounded-2xl shadow-2xs">
          <div className="mb-5 border-l-4 sm:border-l-6 border-[#0a9984] pl-3 sm:pl-4 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <h2 className="text-lg sm:text-xl font-extrabold text-[#115e59] m-0">
                Global Sequence & Prefix Settings
              </h2>
              <p className="mt-1 text-xs sm:text-sm text-[#0f766e] m-0">
                Define the master product prefix and starting sequence for SKU creation.
              </p>
            </div>

            <div
              className={`flex items-center gap-1.5 p-1 bg-white/50 backdrop-blur-sm rounded-lg border border-teal-100 shrink-0 self-start md:self-auto ${
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
                className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-semibold rounded-md transition-colors ${
                  skuMode === "default" ? "bg-[#0a9984] text-white shadow-xs" : "text-[#0f766e] hover:bg-teal-50"
                }`}
                disabled={!hasWriteAccess}
              >
                Default SKU
              </button>
              <button
                type="button"
                onClick={() => hasWriteAccess && setSkuMode("collection")}
                className={`px-3 sm:px-4 py-1.5 text-xs sm:text-sm font-semibold rounded-md transition-colors ${
                  skuMode === "collection" ? "bg-[#0a9984] text-white shadow-xs" : "text-[#0f766e] hover:bg-teal-50"
                }`}
                disabled={!hasWriteAccess}
              >
                Collection SKU
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl p-4 sm:p-6 border border-teal-100 shadow-2xs flex flex-col gap-4">
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

            <div className="text-xs sm:text-sm text-gray-600 bg-gray-50 p-3 sm:p-4 rounded-lg border border-gray-100">
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

            <div className="mt-2 p-4 bg-teal-50 border-2 border-teal-200 rounded-xl shadow-2xs text-center">
              <p className="text-gray-500 text-xs sm:text-sm mb-1.5">Generated Base SKU Example</p>
              <span className="text-lg sm:text-xl font-bold text-[#0a9984] tracking-wider break-all">
                {generatedPreview}
              </span>
            </div>

            <div className="mt-4 pt-4 border-t border-teal-100 flex flex-col sm:flex-row justify-end items-stretch sm:items-center gap-3">
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
                className="w-full sm:w-auto px-5 py-2.5 bg-[#0a9984] text-white text-sm font-semibold rounded-lg hover:bg-[#087d6c] transition-colors shadow-2xs disabled:opacity-50 text-center cursor-pointer"
                onClick={handleSave}
                disabled={saving || !hasWriteAccess}
              >
                {saving ? "Saving..." : "Save Configuration"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
