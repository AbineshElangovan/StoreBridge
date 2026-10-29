'use client';

import React, { useState, useEffect } from 'react';
import { Icon } from '@shopify/polaris';
import { CartIcon, CheckIcon, RefreshIcon } from '@shopify/polaris-icons';
import { shopifyFetch } from '@/lib/shopify/Client';
import { APP_NAME } from '@/lib/constants/app';

export interface EmailTemplateConfig {
  subject: string;
  bannerText: string;
  bannerColor: string;
  headline: string;
  bodyMessage: string;
  buttonText: string;
  buttonColor: string;
}

export interface EmailTemplatesState {
  notify_me: EmailTemplateConfig;
  preorder: EmailTemplateConfig;
}

export const DEFAULT_EMAIL_TEMPLATES: EmailTemplatesState = {
  notify_me: {
    subject: 'Good news! {{product_title}} is back in stock',
    bannerText: 'Back in Stock • Available Now',
    bannerColor: '#059669', // Emerald Green
    headline: 'Cotton T-shirt is Back in Stock!',
    bodyMessage: 'The item you requested at {{store_name}} is available now.',
    buttonText: 'Shop Now',
    buttonColor: '#111827', // Dark Slate
  },
  preorder: {
    subject: 'Pre-order Ready: {{product_title}} - {{store_name}}',
    bannerText: 'Pre-order Allocated • Ready for Fulfillment',
    bannerColor: '#7c3aed', // Purple
    headline: 'Your Pre-ordered Item is Ready',
    bodyMessage: 'Stock has arrived at {{store_name}}. Preparing fulfillment.',
    buttonText: 'View Order Status',
    buttonColor: '#111827', // Dark Slate
  },
};

const COLOR_PRESETS = [
  { name: 'Emerald', hex: '#059669' },
  { name: 'Purple', hex: '#7c3aed' },
  { name: 'Indigo', hex: '#4f46e5' },
  { name: 'Sky Blue', hex: '#0284c7' },
  { name: 'Rose Red', hex: '#e11d48' },
  { name: 'Amber', hex: '#d97706' },
  { name: 'Slate Dark', hex: '#111827' },
];

const BUTTON_COLOR_PRESETS = [
  { name: 'Slate Dark', hex: '#111827' },
  { name: 'Emerald', hex: '#059669' },
  { name: 'Purple', hex: '#7c3aed' },
  { name: 'Indigo', hex: '#4f46e5' },
  { name: 'Sky Blue', hex: '#0284c7' },
  { name: 'Rose Red', hex: '#e11d48' },
];

const STORAGE_KEY = 'storebridge_email_template_customizer';

interface EmailTemplateCustomizerProps {
  storeName?: string;
  productUrl?: string;
  onSave?: (templates: EmailTemplatesState) => void;
}

export function EmailTemplateCustomizer({
  storeName = 'ESHAN Chennai Store',
  productUrl = '#',
  onSave,
}: EmailTemplateCustomizerProps) {
  const [activeTab, setActiveTab] = useState<'notify_me' | 'preorder'>('notify_me');
  const [templates, setTemplates] = useState<EmailTemplatesState>(DEFAULT_EMAIL_TEMPLATES);
  const [savedSuccess, setSavedSuccess] = useState(false);
  const [saving, setSaving] = useState(false);

  // Helper to strip any accidentally typed arrow symbol from buttonText
  const cleanButton = (text: string) => text.replace(/\s*[→➔➜>]\s*$/g, '').trim();

  // Load from API and fallback to localStorage on mount
  useEffect(() => {
    let mounted = true;
    const fetchTemplates = async () => {
      try {
        const res = await shopifyFetch('/api/email-template');
        const data = await res.json();
        if (mounted && data.success && data.templates) {
          setTemplates({
            notify_me: {
              ...DEFAULT_EMAIL_TEMPLATES.notify_me,
              ...(data.templates.notify_me || {}),
              subject: data.templates.notify_me?.subject || DEFAULT_EMAIL_TEMPLATES.notify_me.subject,
              buttonText: cleanButton(data.templates.notify_me?.buttonText || DEFAULT_EMAIL_TEMPLATES.notify_me.buttonText),
            },
            preorder: {
              ...DEFAULT_EMAIL_TEMPLATES.preorder,
              ...(data.templates.preorder || {}),
              subject: data.templates.preorder?.subject || DEFAULT_EMAIL_TEMPLATES.preorder.subject,
              buttonText: cleanButton(data.templates.preorder?.buttonText || DEFAULT_EMAIL_TEMPLATES.preorder.buttonText),
            },
          });
          return;
        }
      } catch {
        // Fallback to localStorage
      }

      try {
        const saved = localStorage.getItem(STORAGE_KEY);
        if (mounted && saved) {
          const parsed = JSON.parse(saved);
          setTemplates({
            notify_me: {
              ...DEFAULT_EMAIL_TEMPLATES.notify_me,
              ...(parsed.notify_me || {}),
              subject: parsed.notify_me?.subject || DEFAULT_EMAIL_TEMPLATES.notify_me.subject,
              buttonText: cleanButton(parsed.notify_me?.buttonText || DEFAULT_EMAIL_TEMPLATES.notify_me.buttonText),
            },
            preorder: {
              ...DEFAULT_EMAIL_TEMPLATES.preorder,
              ...(parsed.preorder || {}),
              subject: parsed.preorder?.subject || DEFAULT_EMAIL_TEMPLATES.preorder.subject,
              buttonText: cleanButton(parsed.preorder?.buttonText || DEFAULT_EMAIL_TEMPLATES.preorder.buttonText),
            },
          });
        }
      } catch {
        // Use defaults
      }
    };

    fetchTemplates();
    return () => { mounted = false; };
  }, []);

  const currentConfig = templates[activeTab];

  const updateCurrentConfig = (field: keyof EmailTemplateConfig, value: string) => {
    const formattedValue = field === 'buttonText' ? cleanButton(value) : value;
    setTemplates((prev) => ({
      ...prev,
      [activeTab]: {
        ...prev[activeTab],
        [field]: formattedValue,
      },
    }));
  };

  const handleResetToDefault = () => {
    setTemplates((prev) => ({
      ...prev,
      [activeTab]: { ...DEFAULT_EMAIL_TEMPLATES[activeTab] },
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    const cleanedTemplates = {
      notify_me: {
        ...templates.notify_me,
        buttonText: cleanButton(templates.notify_me.buttonText),
      },
      preorder: {
        ...templates.preorder,
        buttonText: cleanButton(templates.preorder.buttonText),
      },
    };

    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(cleanedTemplates));

      // Persist to backend server so actual emails sent to customers use this format!
      await shopifyFetch('/api/email-template', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ templates: cleanedTemplates }),
      });

      setSavedSuccess(true);
      setTimeout(() => setSavedSuccess(false), 2500);
      if (onSave) {
        onSave(cleanedTemplates);
      }
    } catch (e) {
      console.error('Failed to save email templates:', e);
    } finally {
      setSaving(false);
    }
  };

  // Replace variables in preview
  const previewSubject = (currentConfig.subject || '')
    .replace(/\{\{product_title\}\}/gi, 'Cotton T-shirt')
    .replace(/\{\{product\}\}/gi, 'Cotton T-shirt')
    .replace(/\{\{store_name\}\}/gi, storeName);

  const previewBodyMessage = currentConfig.bodyMessage.replace(
    /\{\{store_name\}\}/gi,
    storeName
  );

  const displayButtonText = cleanButton(currentConfig.buttonText) || (activeTab === 'preorder' ? 'View Order Status' : 'Shop Now');

  return (
    <div className="bg-white rounded-2xl border border-gray-200 shadow-xs overflow-hidden">
      {/* Top Header & Tab Switcher */}
      <div className="p-4 sm:p-6 border-b border-gray-100 flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-gray-900 tracking-tight">
              Customer Restock Email Customizer
            </h3>
            <span className="text-[11px] font-bold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2.5 py-0.5 rounded-full">
              Live Preview & Dispatch Sync
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-1">
            Customize the email subject line, words, banner colors, and button for both <strong>Back in Stock (Notify Me)</strong> and <strong>Pre-order</strong> customer emails.
          </p>
        </div>

        {/* Tab Switcher & Save Button */}
        <div className="flex items-center gap-3">
          <div className="inline-flex p-1 bg-gray-100 rounded-xl border border-gray-200 text-xs">
            <button
              type="button"
              onClick={() => setActiveTab('notify_me')}
              className={`flex items-center gap-1.5 px-3 py-1.5 font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === 'notify_me'
                  ? 'bg-white text-gray-900 shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: templates.notify_me.bannerColor }}
              />
              <span>Back in Stock (Notify Me)</span>
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('preorder')}
              className={`flex items-center gap-1.5 px-3 py-1.5 font-bold rounded-lg transition-all cursor-pointer ${
                activeTab === 'preorder'
                  ? 'bg-white text-gray-900 shadow-2xs'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              <span
                className="w-2.5 h-2.5 rounded-full shrink-0"
                style={{ backgroundColor: templates.preorder.bannerColor }}
              />
              <span>Pre-order Restock</span>
            </button>
          </div>

          <button
            type="button"
            disabled={saving}
            onClick={handleSave}
            className={`inline-flex items-center gap-1.5 px-4 py-2 text-xs font-bold rounded-xl transition-all cursor-pointer shadow-sm ${
              savedSuccess
                ? 'bg-emerald-600 text-white'
                : 'bg-gray-900 hover:bg-black text-white'
            }`}
          >
            {savedSuccess ? (
              <>
                <div className="w-3.5 h-3.5">
                  <Icon source={CheckIcon} />
                </div>
                <span>Saved & Synced!</span>
              </>
            ) : (
              <span>{saving ? 'Saving...' : 'Save Changes'}</span>
            )}
          </button>
        </div>
      </div>

      {/* Grid: Left Editor + Right Live Preview */}
      <div className="grid grid-cols-1 lg:grid-cols-12 divide-y lg:divide-y-0 lg:divide-x divide-gray-100">
        {/* LEFT COLUMN: Customizer Controls */}
        <div className="lg:col-span-6 p-5 sm:p-6 space-y-6">
          <div className="flex items-center justify-between pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <span
                className="w-3 h-3 rounded-full"
                style={{ backgroundColor: currentConfig.bannerColor }}
              />
              <span className="text-xs font-extrabold text-gray-900 uppercase tracking-wider">
                Editing: {activeTab === 'notify_me' ? 'Back in Stock' : 'Pre-order'} Template
              </span>
            </div>

            <button
              type="button"
              onClick={handleResetToDefault}
              className="text-[11px] font-semibold text-gray-500 hover:text-gray-900 flex items-center gap-1 cursor-pointer transition-colors"
            >
              <div className="w-3 h-3">
                <Icon source={RefreshIcon} />
              </div>
              <span>Reset default</span>
            </button>
          </div>

          {/* 1. Email Notification Subject Line */}
          <div className="space-y-2">
            <label className="text-xs font-bold text-gray-900 uppercase tracking-wider block">
              1. Email Notification Subject Line
            </label>

            <div>
              <span className="text-xs text-gray-600 font-medium block mb-1">
                Subject Line (Customer Inbox)
              </span>
              <input
                type="text"
                value={currentConfig.subject}
                onChange={(e) => updateCurrentConfig('subject', e.target.value)}
                placeholder={activeTab === 'notify_me' ? 'Good news! {{product_title}} is back in stock' : 'Pre-order Ready: {{product_title}} - {{store_name}}'}
                className="w-full text-xs font-medium px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white"
              />
              <p className="text-[10px] text-gray-400 mt-1">
                Tip: Use <code className="bg-gray-100 px-1 py-0.5 rounded font-mono">&#123;&#123;product_title&#125;&#125;</code> and <code className="bg-gray-100 px-1 py-0.5 rounded font-mono">&#123;&#123;store_name&#125;&#125;</code> to insert dynamic details.
              </p>
            </div>
          </div>

          {/* 2. Banner Customization */}
          <div className="space-y-3 pt-3 border-t border-gray-100">
            <label className="text-xs font-bold text-gray-900 uppercase tracking-wider block">
              2. Top Status Banner & Color
            </label>

            <div>
              <span className="text-xs text-gray-600 font-medium block mb-1">Banner Text</span>
              <input
                type="text"
                value={currentConfig.bannerText}
                onChange={(e) => updateCurrentConfig('bannerText', e.target.value)}
                placeholder="e.g. Back in Stock • Available Now"
                className="w-full text-xs font-medium px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white"
              />
            </div>

            <div>
              <span className="text-xs text-gray-600 font-medium block mb-1.5">
                Banner Background Color (Change {activeTab === 'notify_me' ? 'Green' : 'Purple'} into any color)
              </span>

              {/* Color Presets */}
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {COLOR_PRESETS.map((p) => (
                  <button
                    key={p.hex}
                    type="button"
                    onClick={() => updateCurrentConfig('bannerColor', p.hex)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                      currentConfig.bannerColor.toLowerCase() === p.hex.toLowerCase()
                        ? 'border-gray-900 shadow-2xs scale-105'
                        : 'border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full shrink-0 border border-black/10"
                      style={{ backgroundColor: p.hex }}
                    />
                    <span>{p.name}</span>
                  </button>
                ))}
              </div>

              {/* Custom Hex Input */}
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={currentConfig.bannerColor}
                  onChange={(e) => updateCurrentConfig('bannerColor', e.target.value)}
                  className="w-8 h-8 rounded-lg border border-gray-200 cursor-pointer p-0.5 bg-white"
                />
                <input
                  type="text"
                  value={currentConfig.bannerColor}
                  onChange={(e) => updateCurrentConfig('bannerColor', e.target.value)}
                  placeholder="#059669"
                  className="w-28 text-xs font-mono font-bold px-2.5 py-1.5 rounded-lg border border-gray-200 uppercase"
                />
                <span className="text-[11px] text-gray-400">Custom Hex Code</span>
              </div>
            </div>
          </div>

          {/* 3. Headline & Body Words */}
          <div className="space-y-3 pt-3 border-t border-gray-100">
            <label className="text-xs font-bold text-gray-900 uppercase tracking-wider block">
              3. Email Headline & Message Copy
            </label>

            <div>
              <span className="text-xs text-gray-600 font-medium block mb-1">Main Headline</span>
              <input
                type="text"
                value={currentConfig.headline}
                onChange={(e) => updateCurrentConfig('headline', e.target.value)}
                placeholder="e.g. Cotton T-shirt is Back in Stock!"
                className="w-full text-xs font-medium px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white"
              />
            </div>

            <div>
              <span className="text-xs text-gray-600 font-medium block mb-1">
                Body / Subtitle Message
              </span>
              <textarea
                rows={2}
                value={currentConfig.bodyMessage}
                onChange={(e) => updateCurrentConfig('bodyMessage', e.target.value)}
                placeholder="The item you requested at {{store_name}} is available now."
                className="w-full text-xs font-medium px-3 py-2 rounded-xl border border-gray-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white"
              />
              <p className="text-[10px] text-gray-400 mt-1">
                Tip: <code className="bg-gray-100 px-1 py-0.5 rounded font-mono">&#123;&#123;store_name&#125;&#125;</code> inserts your store name automatically.
              </p>
            </div>
          </div>

          {/* 4. Button Text & Color Customization (Constant Arrow) */}
          <div className="space-y-3 pt-3 border-t border-gray-100">
            <label className="text-xs font-bold text-gray-900 uppercase tracking-wider block">
              4. Call-To-Action (CTA) Button
            </label>

            <div>
              <span className="text-xs text-gray-600 font-medium block mb-1">
                Button Label Text (Constant arrow <span className="font-bold text-gray-900">→</span> is permanently attached)
              </span>

              {/* Constant Arrow Affixed to Input */}
              <div className="flex items-stretch max-w-sm">
                <input
                  type="text"
                  value={currentConfig.buttonText}
                  onChange={(e) => updateCurrentConfig('buttonText', e.target.value)}
                  placeholder="e.g. Shop Now, Order Now, View Product"
                  className="flex-1 text-xs font-medium px-3 py-2 rounded-l-xl border border-r-0 border-gray-200 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 bg-white"
                />
                <div className="inline-flex items-center px-3.5 bg-gray-100 border border-gray-200 rounded-r-xl text-gray-700 font-extrabold text-sm select-none">
                  →
                </div>
              </div>
              <p className="text-[11px] text-gray-500 mt-1">
                The arrow <strong>→</strong> is constant and cannot be removed or broken. Customers receive: <strong>{displayButtonText} →</strong>
              </p>
            </div>

            <div>
              <span className="text-xs text-gray-600 font-medium block mb-1.5">Button Background Color</span>

              {/* Button Color Presets */}
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {BUTTON_COLOR_PRESETS.map((p) => (
                  <button
                    key={p.hex}
                    type="button"
                    onClick={() => updateCurrentConfig('buttonColor', p.hex)}
                    className={`flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-bold border transition-all cursor-pointer ${
                      currentConfig.buttonColor.toLowerCase() === p.hex.toLowerCase()
                        ? 'border-gray-900 shadow-2xs scale-105'
                        : 'border-gray-200 hover:border-gray-400'
                    }`}
                  >
                    <span
                      className="w-3 h-3 rounded-full shrink-0 border border-black/10"
                      style={{ backgroundColor: p.hex }}
                    />
                    <span>{p.name}</span>
                  </button>
                ))}
              </div>

              {/* Custom Hex Input */}
              <div className="flex items-center gap-2">
                <input
                  type="color"
                  value={currentConfig.buttonColor}
                  onChange={(e) => updateCurrentConfig('buttonColor', e.target.value)}
                  className="w-8 h-8 rounded-lg border border-gray-200 cursor-pointer p-0.5 bg-white"
                />
                <input
                  type="text"
                  value={currentConfig.buttonColor}
                  onChange={(e) => updateCurrentConfig('buttonColor', e.target.value)}
                  placeholder="#111827"
                  className="w-28 text-xs font-mono font-bold px-2.5 py-1.5 rounded-lg border border-gray-200 uppercase"
                />
                <span className="text-[11px] text-gray-400">Button Hex Code</span>
              </div>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Live Interactive Email Preview */}
        <div className="lg:col-span-6 p-5 sm:p-6 bg-gray-50/60 flex flex-col items-center justify-center">
          {/* Simulated Email Client Container */}
          <div className="w-full max-w-md bg-white rounded-2xl border border-gray-200 shadow-sm overflow-hidden text-center transition-all">
            {/* Email Header Bar */}
            <div className="bg-gray-100/80 px-4 py-2 border-b border-gray-200 flex items-center justify-between text-[11px] text-gray-500">
              <div className="flex items-center gap-1.5">
                <span className="w-2.5 h-2.5 rounded-full bg-rose-400" />
                <span className="w-2.5 h-2.5 rounded-full bg-amber-400" />
                <span className="w-2.5 h-2.5 rounded-full bg-emerald-400" />
                <span className="ml-2 font-mono text-gray-600 font-semibold">Inbox Preview</span>
              </div>
              <span className="font-semibold text-gray-400">Just now</span>
            </div>

            {/* Email Subject Line Bar */}
            <div className="bg-gray-50/90 border-b border-gray-200 px-4 py-2.5 text-left flex items-start gap-2">
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider shrink-0 mt-0.5">Subject:</span>
              <span className="text-xs font-bold text-gray-900 leading-tight break-words">
                {previewSubject}
              </span>
            </div>

            {/* Store Title Bar */}
            <div className="bg-gray-900 text-white px-4 py-3 flex items-center justify-between text-xs">
              <span className="font-extrabold tracking-tight truncate">{storeName}</span>
              <span className="text-[10px] uppercase font-bold text-gray-400 tracking-wider">
                OFFICIAL STORE
              </span>
            </div>

            {/* Dynamic Status Banner with Customizable Color & Text */}
            <div
              className="text-white text-xs font-bold py-2 px-4 flex items-center justify-center gap-1.5 transition-colors duration-200 shadow-inner"
              style={{ backgroundColor: currentConfig.bannerColor }}
            >
              <span>{currentConfig.bannerText || 'Notification Alert'}</span>
            </div>

            {/* Body */}
            <div className="p-6 space-y-4">
              <div>
                <h3 className="text-lg font-black text-gray-900 leading-snug">
                  {currentConfig.headline || 'Product Notification'}
                </h3>
                <p className="text-xs text-gray-500 mt-1 leading-relaxed">
                  {previewBodyMessage}
                </p>
              </div>

              {/* Product Card */}
              <div className="bg-gray-50 border border-gray-200 rounded-xl p-3 max-w-sm mx-auto flex items-center gap-3 text-left">
                <div className="w-16 h-16 bg-white rounded-lg border border-gray-200 flex items-center justify-center p-1 shrink-0 overflow-hidden">
                  <img
                    src="https://cdn.shopify.com/s/files/1/0836/6748/4891/files/cotton-t-shirt_924bced9-4b4d-4e4f-9f3b-b554623c9e69.png?v=1790857896"
                    alt="Cotton T-shirt"
                    className="max-h-full max-w-full object-contain"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <h4 className="text-xs font-bold text-gray-900 truncate">Cotton T-shirt</h4>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <span className="text-[10px] font-semibold text-gray-600 bg-gray-200 px-1.5 py-0.5 rounded">
                      White / M
                    </span>
                    <span className="text-[10px] font-bold text-gray-900">
                      ₹1,240
                    </span>
                  </div>
                  <p
                    className="text-[10px] font-bold mt-1"
                    style={{ color: currentConfig.bannerColor }}
                  >
                    {activeTab === 'preorder' ? 'Reserved & in stock' : 'Ready to order'}
                  </p>
                </div>
              </div>

              {/* Dynamic CTA Button with Constant Arrow */}
              <div className="pt-1">
                <a
                  href={productUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center gap-2 py-2.5 px-6 font-bold text-xs rounded-xl shadow-sm transition-all duration-150 hover:opacity-90 active:scale-95 text-white"
                  style={{ backgroundColor: currentConfig.buttonColor }}
                >
                  <div className="w-3.5 h-3.5 text-white">
                    <Icon source={CartIcon} />
                  </div>
                  <span>{displayButtonText} →</span>
                </a>
              </div>

              {/* Footer */}
              <p className="text-[10px] text-gray-400 pt-3 border-t border-gray-100">
                © {new Date().getFullYear()} {storeName} • Sent automatically via {APP_NAME}
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
