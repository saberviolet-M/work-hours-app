import { useState, useEffect, useRef, useCallback } from 'react';

type DateRangeType = 'month' | 'lastMonth' | 'last3Months' | 'all';

const PRESETS: { type: DateRangeType; label: string }[] = [
  { type: 'month', label: '本月' },
  { type: 'lastMonth', label: '上月' },
  { type: 'last3Months', label: '近3月' },
  { type: 'all', label: '全部' },
];

const MONTHS = ['1月', '2月', '3月', '4月', '5月', '6月', '7月', '8月', '9月', '10月', '11月', '12月'];

function getCurrentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

interface DateRangePickerProps {
  value: string;
  dateRangeType: DateRangeType;
  onChange: (value: string) => void;
  onRangeTypeChange: (type: DateRangeType) => void;
}

export function DateRangePicker({ value, dateRangeType, onChange, onRangeTypeChange }: DateRangePickerProps) {
  const [open, setOpen] = useState(false);
  const [viewYear, setViewYear] = useState(() => {
    const [y] = value.split('-');
    return parseInt(y || String(new Date().getFullYear()), 10);
  });
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const [y] = value.split('-');
    if (y) setViewYear(parseInt(y, 10));
  }, [value]);

  const handleClickOutside = useCallback((e: MouseEvent) => {
    if (ref.current && !ref.current.contains(e.target as Node)) {
      setOpen(false);
    }
  }, []);

  useEffect(() => {
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [handleClickOutside]);

  const displayText = (() => {
    const preset = PRESETS.find(p => p.type === dateRangeType);
    if (preset && dateRangeType !== 'month') return preset.label;
    return value;
  })();

  const handlePreset = (type: DateRangeType) => {
    onRangeTypeChange(type);
    const now = new Date();
    if (type === 'month') {
      onChange(getCurrentMonth());
    } else if (type === 'lastMonth') {
      const d = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      onChange(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`);
    } else if (type === 'last3Months') {
      onChange(getCurrentMonth());
    } else {
      onChange(getCurrentMonth());
    }
    setOpen(false);
  };

  const handleMonthClick = (monthIndex: number) => {
    onChange(`${viewYear}-${String(monthIndex + 1).padStart(2, '0')}`);
    onRangeTypeChange('month');
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center justify-between px-4 py-2 border border-gray-300 rounded-lg bg-white min-w-[120px] hover:border-blue-400 hover:shadow-sm transition-all"
      >
        <svg className="w-4 h-4 mr-2 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
        </svg>
        <span className="text-sm text-gray-700">{displayText}</span>
        <svg className={`w-4 h-4 ml-2 text-gray-400 transition-transform ${open ? 'rotate-180' : ''}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full left-0 mt-2 bg-white border border-gray-200 rounded-lg shadow-xl z-50 p-3 w-[280px]">
          {/* Presets */}
          <div className="flex gap-1 mb-3 pb-3 border-b border-gray-100">
            {PRESETS.map(p => (
              <button
                key={p.type}
                onClick={() => handlePreset(p.type)}
                className={`flex-1 px-2 py-1.5 text-xs rounded transition-colors ${
                  dateRangeType === p.type
                    ? 'bg-blue-500 text-white'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                }`}
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Year nav */}
          <div className="flex items-center justify-between mb-3">
            <button
              onClick={() => setViewYear(y => y - 1)}
              className="p-1 hover:bg-gray-100 rounded text-gray-500"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
            <span className="text-sm font-medium text-gray-700">{viewYear}年</span>
            <button
              onClick={() => setViewYear(y => y + 1)}
              className="p-1 hover:bg-gray-100 rounded text-gray-500"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          </div>

          {/* Month grid */}
          <div className="grid grid-cols-3 gap-2">
            {MONTHS.map((label, i) => {
              const isSelected = dateRangeType === 'month' && value === `${viewYear}-${String(i + 1).padStart(2, '0')}`;
              const isCurrent = getCurrentMonth() === `${viewYear}-${String(i + 1).padStart(2, '0')}`;
              return (
                <button
                  key={i}
                  onClick={() => handleMonthClick(i)}
                  className={`px-2 py-1.5 text-xs rounded transition-colors ${
                    isSelected
                      ? 'bg-blue-500 text-white'
                      : isCurrent
                        ? 'bg-blue-50 text-blue-600 border border-blue-200'
                        : 'text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
