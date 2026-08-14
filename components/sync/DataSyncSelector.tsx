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
              className={`flex items-center p-3 border rounded-lg cursor-pointer transition-colors ${isSelected ? 'border-green-500 bg-green-50/30' : 'border-gray-200 hover:bg-gray-50'}`}
            >
              <input 
                type="checkbox" 
                className="h-4 w-4 text-green-600 focus:ring-green-500 border-gray-300 rounded"
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
