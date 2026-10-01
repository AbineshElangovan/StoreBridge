"use client";
import React from 'react';

export function Loading({ label = "Loading..." }: { label?: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', minHeight: '60vh', marginTop: '5vh', gap: 16 }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="ys-sk-ping" />
        <div className="ys-sk-spinner" />
      </div>
      <p style={{ margin: 0, fontSize: 14, color: 'var(--text-primary, #0f172a)', fontWeight: 600, letterSpacing: '-0.01em' }}>{label}</p>
      <div style={{ display: 'flex', gap: 6 }}>
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="ys-sk-dot"
            style={{
              width: 7,
              height: 7,
              borderRadius: '50%',
              backgroundColor: 'var(--color-primary, #047857)',
              animation: `sk-pulse 1.2s ease-in-out ${i * 0.2}s infinite`,
            }}
          />
        ))}
      </div>
    </div>
  );
}

