import React from 'react';

export type TimeRange = 'today' | '7days' | '30days';

interface TimeRangeToggleProps {
  selectedRange: TimeRange;
  onRangeChange: (range: TimeRange) => void;
}

const TimeRangeToggle: React.FC<TimeRangeToggleProps> = ({ selectedRange, onRangeChange }) => {
  const ranges: { value: TimeRange; label: string }[] = [
    { value: 'today', label: 'Today' },
    { value: '7days', label: '7 Days' },
    { value: '30days', label: '30 Days' },
  ];

  return (
    <div className="flex items-center bg-card p-1 rounded-md border">
      {ranges.map((range) => (
        <button
          key={range.value}
          onClick={() => onRangeChange(range.value)}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors
            ${selectedRange === range.value
              ? 'bg-primary text-primary-foreground'
              : 'hover:bg-muted'}
          `}
        >
          {range.label}
        </button>
      ))}
    </div>
  );
};

export default TimeRangeToggle; 