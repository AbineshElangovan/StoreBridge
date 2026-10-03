import React from 'react';

interface DataSyncSelectorProps {
  options: { id: string; label: string }[];
  selectedOptions: string[];
  onToggleOption: (optionId: string) => void;
}

export function DataSyncSelector({ options, selectedOptions, onToggleOption }: DataSyncSelectorProps) {
  return (
    <div className="mb-6">
      <h4 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">DATA TO SYNC</h4>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {options.map((option) => {
          const isSelected = selectedOptions.includes(option.id);
          return (
            <label 
              key={option.id} 
              className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${isSelected ? '' : 'border-gray-200 hover:bg-gray-50'}`}
              style={isSelected ? { borderColor: 'var(--color-primary)', background: 'var(--bg-hover)' } : {}}
            >
              <input 
                type="checkbox" 
                className="h-4 w-4 border-gray-300 rounded" style={{ accentColor: 'var(--color-primary)' }}
                checked={isSelected}
                onChange={() => onToggleOption(option.id)}
              />
              <span className="ml-3 text-sm font-medium text-gray-700 truncate">
                {option.label}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
