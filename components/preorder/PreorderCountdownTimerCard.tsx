'use client';

import React, { useState } from 'react';

export interface PreorderCountdownTimerCardProps {
  showTimer: boolean;
  setShowTimer: (show: boolean) => void;
  timerDisplayMode?: 'BEFORE_PREORDER' | 'WHILE_PREORDER' | 'BOTH';
  setTimerDisplayMode?: (mode: 'BEFORE_PREORDER' | 'WHILE_PREORDER' | 'BOTH') => void;
  // Start date props (optional for backwards compatibility)
  timerStartDateMode?: string;
  setTimerStartDateMode?: (mode: 'USE_STATUS_DATE' | 'CUSTOM_DATES') => void;
  customStartDate?: string;
  setCustomStartDate?: (date: string) => void;
  startDate?: string;
  setStartDate?: (date: string) => void;
  statusStartDate?: string;
  // End date / Deadline props
  timerDateMode: string;
  setTimerDateMode: (mode: 'USE_STATUS_DATE' | 'CUSTOM_DATES') => void;
  customEndDate?: string;
  setCustomEndDate?: (date: string) => void;
  endDate?: string;
  setEndDate?: (date: string) => void;
  statusEndDate?: string;
  // Styling props
  timerHeadingStart?: string;
  setTimerHeadingStart?: (heading: string) => void;
  timerHeadingEnd: string;
  setTimerHeadingEnd: (heading: string) => void;
  timerTextColor: string;
  setTimerTextColor: (color: string) => void;
  timerBgColor: string;
  setTimerBgColor: (color: string) => void;
  timerTextColorEnd?: string;
  setTimerTextColorEnd?: (color: string) => void;
  timerBgColorEnd?: string;
  setTimerBgColorEnd?: (color: string) => void;
  timerBorderRadius: string;
  setTimerBorderRadius: (radius: string) => void;
  timerShowDays: boolean;
  setTimerShowDays: (show: boolean) => void;
  timerShowHours: boolean;
  setTimerShowHours: (show: boolean) => void;
  timerShowMinutes: boolean;
  setTimerShowMinutes: (show: boolean) => void;
  timerShowSeconds: boolean;
  setTimerShowSeconds: (show: boolean) => void;
  timerDaysLabel: string;
  setTimerDaysLabel: (label: string) => void;
  timerHoursLabel: string;
  setTimerHoursLabel: (label: string) => void;
  timerMinutesLabel: string;
  setTimerMinutesLabel: (label: string) => void;
  timerSecondsLabel: string;
  setTimerSecondsLabel: (label: string) => void;
  primaryColor?: string;
  buttonTextColor?: string;
  onSave?: () => void;
  saving?: boolean;
}

function formatHumanDateTime(dateStr?: string | Date | null): string {
  if (!dateStr) return '';
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

export function PreorderCountdownTimerCard({
  showTimer,
  setShowTimer,
  timerDisplayMode = 'WHILE_PREORDER',
  setTimerDisplayMode,
  timerDateMode = 'USE_STATUS_DATE',
  setTimerDateMode,
  customEndDate = '',
  setCustomEndDate,
  endDate = '',
  setEndDate,
  statusEndDate,
  timerHeadingStart,
  setTimerHeadingStart,
  timerHeadingEnd,
  setTimerHeadingEnd,
  timerTextColor,
  setTimerTextColor,
  timerBgColor,
  setTimerBgColor,
  timerTextColorEnd,
  setTimerTextColorEnd,
  timerBgColorEnd,
  setTimerBgColorEnd,
  timerBorderRadius,
  setTimerBorderRadius,
  timerShowDays,
  setTimerShowDays,
  timerShowHours,
  setTimerShowHours,
  timerShowMinutes,
  setTimerShowMinutes,
  timerShowSeconds,
  setTimerShowSeconds,
  timerDaysLabel,
  setTimerDaysLabel,
  timerHoursLabel,
  setTimerHoursLabel,
  timerMinutesLabel,
  setTimerMinutesLabel,
  timerSecondsLabel,
  setTimerSecondsLabel,
  primaryColor = '#008060',
  buttonTextColor = '#ffffff',
  onSave,
  saving = false,
}: PreorderCountdownTimerCardProps) {
  const [hideStyling, setHideStyling] = useState(true);
  const [editingEnd, setEditingEnd] = useState(false);

  // Effective values for End Date / Deadline
  const effectiveCustomEnd = customEndDate || endDate;
  const effectiveStatusEnd = statusEndDate || endDate;

  const handleSetCustomEnd = (val: string) => {
    if (setCustomEndDate) setCustomEndDate(val);
    if (setEndDate) setEndDate(val);
  };

  const currentHeading = timerHeadingEnd || timerHeadingStart || 'Hurry up! Pre-order ending soon';
  const currentTextColor = timerTextColorEnd || timerTextColor || '#000000';
  const currentBgColor = timerBgColorEnd || timerBgColor || '#fee2e2';

  const handleHeadingChange = (val: string) => {
    setTimerHeadingEnd(val);
    if (setTimerHeadingStart) setTimerHeadingStart(val);
  };

  const handleTextColorChange = (val: string) => {
    setTimerTextColor(val);
    if (setTimerTextColorEnd) setTimerTextColorEnd(val);
  };

  const handleBgColorChange = (val: string) => {
    setTimerBgColor(val);
    if (setTimerBgColorEnd) setTimerBgColorEnd(val);
  };

  return (
    <div className="bg-white rounded-2xl border border-gray-200/80 shadow-xs p-6 space-y-6">
      {/* Header */}
      <div>
        <h3 className="text-base font-bold text-gray-900">Countdown timer</h3>
        <p className="text-xs text-gray-500 mt-0.5">
          Add a live countdown timer to create urgency for your preorders.
        </p>
      </div>

      {/* 1. Display */}
      <div>
        <label className="block text-sm font-bold text-gray-900 mb-2.5">Display</label>
        <div className="space-y-3">
          <label className="flex items-center gap-3 cursor-pointer">
            <input
              type="radio"
              name="reusableShowTimerRadio"
              checked={!showTimer}
              onChange={() => setShowTimer(false)}
              style={{ accentColor: primaryColor }}
              className="h-4 w-4 cursor-pointer"
            />
            <span className="text-sm font-semibold text-gray-800">Don&apos;t show timer</span>
          </label>

          <div className="space-y-1">
            <label className="flex items-center gap-3 cursor-pointer">
              <input
                type="radio"
                name="reusableShowTimerRadio"
                checked={showTimer}
                onChange={() => {
                  setShowTimer(true);
                  if (setTimerDisplayMode) setTimerDisplayMode('WHILE_PREORDER');
                }}
                style={{ accentColor: primaryColor }}
                className="h-4 w-4 cursor-pointer"
              />
              <span className="text-sm font-semibold text-gray-800">Show countdown timer</span>
            </label>
            <p className="text-xs text-gray-500 pl-7">
              Create urgency and motivate customers to preorder now
            </p>
          </div>
        </div>
      </div>

      {showTimer && (
        <div className="space-y-6 pt-2 border-t border-gray-100 animate-fadeIn">
          {/* Dates */}
          <div>
            <label className="block text-sm font-bold text-gray-900 mb-2.5">Dates</label>
            <div className="space-y-3">
              {/* Option 1: Use 'End' date set in Status settings */}
              <div>
                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="reusableTimerDateMode"
                    value="USE_STATUS_DATE"
                    checked={timerDateMode === 'USE_STATUS_DATE'}
                    onChange={() => setTimerDateMode('USE_STATUS_DATE')}
                    style={{ accentColor: primaryColor }}
                    className="h-4 w-4 mt-0.5 cursor-pointer"
                  />
                  <div>
                    <span className="text-sm font-semibold text-gray-800">
                      Use &apos;End&apos; date set in Status settings
                    </span>
                    <p className="text-xs text-gray-500 mt-0.5">
                      {effectiveStatusEnd
                        ? `End date set to: ${formatHumanDateTime(effectiveStatusEnd)}`
                        : "An end date is not set for this offer. Set it up in 'Status' tab."}
                    </p>
                  </div>
                </label>
              </div>

              {/* Option 2: Set a custom end date */}
              <div>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="radio"
                    name="reusableTimerDateMode"
                    value="CUSTOM_DATES"
                    checked={timerDateMode !== 'USE_STATUS_DATE'}
                    onChange={() => setTimerDateMode('CUSTOM_DATES')}
                    style={{ accentColor: primaryColor }}
                    className="h-4 w-4 cursor-pointer"
                  />
                  <span className="text-sm font-semibold text-gray-800">
                    Set a custom end date
                  </span>
                </label>
              </div>
            </div>
          </div>

          {/* 4. Deadline date & time */}
          {timerDateMode !== 'USE_STATUS_DATE' && (
            <div className="space-y-1.5 animate-fadeIn">
              <label className="block text-sm font-semibold text-gray-900">
                Deadline date &amp; time
              </label>
              <div className="flex items-center justify-between p-3 rounded-xl border border-gray-300 bg-white shadow-2xs hover:border-gray-400 transition-colors">
                <span className={`text-sm ${effectiveCustomEnd ? 'text-gray-900 font-medium' : 'text-gray-500'}`}>
                  {effectiveCustomEnd ? formatHumanDateTime(effectiveCustomEnd) : 'No date set'}
                </span>
                <div className="flex items-center gap-2">
                  {editingEnd ? (
                    <div className="flex items-center gap-2 animate-fadeIn">
                      <input
                        type="datetime-local"
                        value={effectiveCustomEnd}
                        onChange={(e) => handleSetCustomEnd(e.target.value)}
                        className="text-xs px-2.5 py-1 border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none"
                      />
                      <button
                        type="button"
                        onClick={() => setEditingEnd(false)}
                        className="px-2.5 py-1 text-xs font-semibold bg-gray-900 text-white rounded-lg hover:bg-gray-800 cursor-pointer"
                      >
                        Done
                      </button>
                    </div>
                  ) : (
                    <>
                      <button
                        type="button"
                        onClick={() => setEditingEnd(true)}
                        className="px-3.5 py-1.5 text-xs font-bold border border-gray-600 rounded-lg bg-white hover:bg-gray-100 hover:border-gray-900 text-gray-900 shadow-xs cursor-pointer transition-all"
                      >
                        Change
                      </button>
                      {effectiveCustomEnd && (
                        <button
                          type="button"
                          onClick={() => handleSetCustomEnd('')}
                          className="text-xs text-red-500 hover:text-red-700 font-semibold cursor-pointer"
                        >
                          Clear
                        </button>
                      )}
                    </>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* 5. Styling */}
          <div className="pt-4 border-t border-gray-100 space-y-3">
            <div>
              <h4 className="text-sm font-bold text-gray-900">Styling</h4>
              <p className="text-xs text-gray-500 mt-0.5">Customize colors, borders, and time format</p>
              <button
                type="button"
                onClick={() => setHideStyling(!hideStyling)}
                className="mt-3 px-4 py-1.5 text-xs font-bold border border-gray-900 rounded-lg bg-gray-900 hover:bg-black text-white shadow-xs cursor-pointer transition-all"
              >
                {hideStyling ? 'Show' : 'Hide'}
              </button>
            </div>

            {!hideStyling && (
              <div className="space-y-4 pt-2 animate-fadeIn">
                {/* Heading */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">
                    Heading
                  </label>
                  <input
                    type="text"
                    value={currentHeading}
                    onChange={(e) => handleHeadingChange(e.target.value)}
                    placeholder="Hurry up! Pre-order ending soon"
                    className="w-full px-3 py-1.5 text-xs font-medium text-gray-900 bg-white border border-gray-300 rounded-lg shadow-2xs focus:ring-1 focus:outline-none"
                    style={{ borderColor: primaryColor }}
                  />
                </div>

                {/* Colors for Countdown Timer */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3.5 rounded-xl border border-gray-200 bg-gray-50/50">
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Text Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={currentTextColor}
                        onChange={(e) => handleTextColorChange(e.target.value)}
                        className="w-8 h-8 p-0.5 rounded border border-gray-300 cursor-pointer bg-white"
                      />
                      <input
                        type="text"
                        value={currentTextColor}
                        onChange={(e) => handleTextColorChange(e.target.value)}
                        className="w-full px-2 py-1 text-xs font-mono border border-gray-300 rounded bg-white text-gray-900"
                      />
                    </div>
                  </div>
                  <div>
                    <label className="block text-[11px] font-bold text-gray-700 mb-1">Background Color</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="color"
                        value={currentBgColor}
                        onChange={(e) => handleBgColorChange(e.target.value)}
                        className="w-8 h-8 p-0.5 rounded border border-gray-300 cursor-pointer bg-white"
                      />
                      <input
                        type="text"
                        value={currentBgColor}
                        onChange={(e) => handleBgColorChange(e.target.value)}
                        className="w-full px-2 py-1 text-xs font-mono border border-gray-300 rounded bg-white text-gray-900"
                      />
                    </div>
                  </div>
                </div>

                {/* Borders */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-1">Borders (px)</label>
                  <input
                    type="number"
                    min="0"
                    max="100"
                    value={timerBorderRadius}
                    onChange={(e) => setTimerBorderRadius(e.target.value)}
                    className="w-32 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg bg-white text-gray-900 focus:outline-none focus:ring-1 shadow-2xs"
                    style={{ borderColor: primaryColor }}
                  />
                </div>

                {/* Time format */}
                <div>
                  <label className="block text-xs font-bold text-gray-700 mb-2">Time format</label>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                    <div className="space-y-1.5 p-2 rounded-lg border border-gray-200 bg-white">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={timerShowDays}
                          onChange={(e) => setTimerShowDays(e.target.checked)}
                          style={{ accentColor: primaryColor }}
                          className="h-3.5 w-3.5 rounded"
                        />
                        <span className="text-xs font-semibold text-gray-800">Days</span>
                      </label>
                      <input
                        type="text"
                        value={timerDaysLabel}
                        onChange={(e) => setTimerDaysLabel(e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-gray-50 text-gray-700"
                        placeholder="Days"
                      />
                    </div>

                    <div className="space-y-1.5 p-2 rounded-lg border border-gray-200 bg-white">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={timerShowHours}
                          onChange={(e) => setTimerShowHours(e.target.checked)}
                          style={{ accentColor: primaryColor }}
                          className="h-3.5 w-3.5 rounded"
                        />
                        <span className="text-xs font-semibold text-gray-800">Hours</span>
                      </label>
                      <input
                        type="text"
                        value={timerHoursLabel}
                        onChange={(e) => setTimerHoursLabel(e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-gray-50 text-gray-700"
                        placeholder="Hours"
                      />
                    </div>

                    <div className="space-y-1.5 p-2 rounded-lg border border-gray-200 bg-white">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={timerShowMinutes}
                          onChange={(e) => setTimerShowMinutes(e.target.checked)}
                          style={{ accentColor: primaryColor }}
                          className="h-3.5 w-3.5 rounded"
                        />
                        <span className="text-xs font-semibold text-gray-800">Minutes</span>
                      </label>
                      <input
                        type="text"
                        value={timerMinutesLabel}
                        onChange={(e) => setTimerMinutesLabel(e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-gray-50 text-gray-700"
                        placeholder="Mins"
                      />
                    </div>

                    <div className="space-y-1.5 p-2 rounded-lg border border-gray-200 bg-white">
                      <label className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={timerShowSeconds}
                          onChange={(e) => setTimerShowSeconds(e.target.checked)}
                          style={{ accentColor: primaryColor }}
                          className="h-3.5 w-3.5 rounded"
                        />
                        <span className="text-xs font-semibold text-gray-800">Seconds</span>
                      </label>
                      <input
                        type="text"
                        value={timerSecondsLabel}
                        onChange={(e) => setTimerSecondsLabel(e.target.value)}
                        className="w-full px-2 py-1 text-xs border border-gray-300 rounded bg-gray-50 text-gray-700"
                        placeholder="Secs"
                      />
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Quick Save within Card if provided */}
          {onSave && (
            <div className="pt-2 flex justify-end">
              <button
                type="button"
                onClick={onSave}
                disabled={saving}
                className="px-4 py-2 text-xs font-bold text-white rounded-xl shadow-xs transition-colors flex items-center gap-2 cursor-pointer"
                style={{ backgroundColor: primaryColor }}
              >
                {saving ? 'Saving...' : 'Save Countdown Settings'}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
