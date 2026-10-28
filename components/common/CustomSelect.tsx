"use client";
import React, { useState, useRef, useEffect } from "react";

export interface CustomSelectProps {
  label?: string;
  labelHidden?: boolean;
  options: { label: string; value: string }[];
  value: string;
  onChange: (value: string) => void;
  maxHeight?: number | string;
  accentColor?: string;
}

export function CustomSelect({
  label,
  labelHidden,
  options,
  value,
  onChange,
  maxHeight = "240px",
  accentColor = "#6366f1",
}: CustomSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [hoveredValue, setHoveredValue] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const selectedOption = options.find((opt) => opt.value === value) || options[0];

  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && dropdownRef.current) {
      const activeEl = dropdownRef.current.querySelector<HTMLElement>('[data-selected="true"]');
      if (activeEl) {
        activeEl.scrollIntoView({ block: "nearest" });
      }
    }
  }, [isOpen]);

  const hasActiveFilter = Boolean(value && value.toUpperCase() !== "ALL" && value !== "");

  return (
    <div className="relative w-full text-left" ref={containerRef}>
      {label && !labelHidden && (
        <label className="block text-sm font-medium text-gray-700 mb-1">
          {label}
        </label>
      )}
      <div
        className="w-full px-3 py-2 border rounded-lg text-[13px] bg-white cursor-pointer outline-none transition-all flex justify-between items-center shadow-xs hover:bg-gray-50"
        style={{
          borderColor: isOpen ? accentColor : hasActiveFilter ? `${accentColor}80` : "#d1d5db",
          boxShadow: isOpen ? `0 0 0 2px ${accentColor}25` : undefined,
        }}
        onClick={() => setIsOpen(!isOpen)}
      >
        <span
          className="truncate font-medium transition-colors"
          style={{ color: hasActiveFilter ? accentColor : "#374151" }}
        >
          {selectedOption?.label || "Select..."}
        </span>
        <svg
          className={`w-4 h-4 transition-transform ${isOpen ? "rotate-180" : ""}`}
          style={{ color: isOpen || hasActiveFilter ? accentColor : "#9ca3af" }}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {isOpen && (
        <div
          ref={dropdownRef}
          className="absolute z-50 w-full mt-1 bg-white border rounded-lg shadow-lg custom-dropdown-scrollbar overflow-y-auto"
          style={{
            maxHeight: typeof maxHeight === "number" ? `${maxHeight}px` : maxHeight,
            borderColor: `${accentColor}33`,
            scrollbarWidth: "thin",
            scrollbarColor: `${accentColor} #f1f5f9`,
            ["--dropdown-accent" as any]: accentColor,
          }}
        >
          <ul className="py-1">
            {options.map((opt) => {
              const isSelected = value === opt.value;
              const isHovered = hoveredValue === opt.value;
              return (
                <li
                  key={opt.value}
                  data-selected={isSelected ? "true" : "false"}
                  onMouseEnter={() => setHoveredValue(opt.value)}
                  onMouseLeave={() => setHoveredValue(null)}
                  className="px-3 py-2 text-[13px] cursor-pointer transition-colors"
                  style={{
                    backgroundColor: isSelected
                      ? accentColor
                      : isHovered
                      ? `${accentColor}18`
                      : "transparent",
                    color: isSelected
                      ? "#ffffff"
                      : isHovered
                      ? accentColor
                      : "#374151",
                    fontWeight: isSelected ? 600 : isHovered ? 500 : 400,
                  }}
                  onClick={() => {
                    onChange(opt.value);
                    setIsOpen(false);
                    setHoveredValue(null);
                  }}
                >
                  {opt.label}
                </li>
              );
            })}
          </ul>
        </div>
      )}
    </div>
  );
}
