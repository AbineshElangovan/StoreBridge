"use client";
import React from 'react';

export function ImportProgress() {
  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-12 text-center shadow-xs max-w-2xl mx-auto my-6">
      <style>{`
        @keyframes sk-spin { to { transform: rotate(360deg); } }
        @keyframes sk-ping {
          0% { transform: scale(1); opacity: 0.55; }
          100% { transform: scale(1.75); opacity: 0; }
        }
        @keyframes sk-pulse {
          0%, 100% { opacity: 1; transform: scale(1); }
          50% { opacity: 0.3; transform: scale(0.85); }
        }
        .storeorbit-sk-spinner {
          width: 52px;
          height: 52px;
          border: 4px solid rgba(0, 0, 0, 0.08);
          border-top-color: var(--color-primary, #a7cd18);
          border-radius: 50%;
          animation: sk-spin 0.75s linear infinite;
        }
        .storeorbit-sk-ping {
          position: absolute;
          width: 52px;
          height: 52px;
          border: 3px solid var(--color-primary, #a7cd18);
          border-radius: 50%;
          animation: sk-ping 1.3s ease-out infinite;
        }
      `}</style>

      {/* Branded dual-ring pulse spinner matching Loading and PageLoader */}
      <div className="relative flex items-center justify-center mx-auto mb-6 h-16 w-16">
        <div className="storeorbit-sk-ping" />
        <div className="storeorbit-sk-spinner" />
      </div>

      <h3 className="text-lg font-bold text-gray-900 mb-2">Importing Products...</h3>

      {/* Pulsing indicator dots */}
      <div className="flex items-center justify-center gap-1.5 mb-4">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-[var(--color-primary,#a7cd18)]"
            style={{
              animation: `sk-pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>

      <p className="text-gray-500 text-xs max-w-md mx-auto leading-relaxed">
        Please do not close this window while we securely import your products, variations, and images into Shopify.
      </p>
    </div>
  );
}
