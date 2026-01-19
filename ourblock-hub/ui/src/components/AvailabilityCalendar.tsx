import { useState, useMemo } from 'react';
import './AvailabilityCalendar.css';

interface DateRange {
  start: Date;
  end: Date;
}

interface Props {
  unavailableDates: DateRange[];
  onUnavailableDatesChange: (dates: DateRange[]) => void;
  isAvailableNow: boolean;
  onAvailableNowChange: (available: boolean) => void;
}

export function AvailabilityCalendar({
  unavailableDates,
  onUnavailableDatesChange,
  isAvailableNow,
  onAvailableNowChange,
}: Props) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectionStart, setSelectionStart] = useState<Date | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);

  const monthStart = useMemo(() => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth(), 1);
    return date;
  }, [currentMonth]);

  const monthEnd = useMemo(() => {
    const date = new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 0);
    return date;
  }, [currentMonth]);

  const weeks = useMemo(() => {
    const result: Date[][] = [];
    const startDay = monthStart.getDay();
    let currentDate = new Date(monthStart);
    currentDate.setDate(currentDate.getDate() - startDay);

    while (currentDate <= monthEnd || result.length < 6) {
      const week: Date[] = [];
      for (let i = 0; i < 7; i++) {
        week.push(new Date(currentDate));
        currentDate.setDate(currentDate.getDate() + 1);
      }
      result.push(week);
      if (currentDate > monthEnd && result.length >= 4) break;
    }

    return result;
  }, [monthStart, monthEnd]);

  const isDateUnavailable = (date: Date): boolean => {
    return unavailableDates.some(range => {
      const d = date.getTime();
      return d >= range.start.getTime() && d <= range.end.getTime();
    });
  };

  const isInCurrentMonth = (date: Date): boolean => {
    return date.getMonth() === currentMonth.getMonth();
  };

  const isPast = (date: Date): boolean => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    return date < today;
  };

  const handleDayMouseDown = (date: Date) => {
    if (isPast(date)) return;
    setSelectionStart(date);
    setIsSelecting(true);
  };

  const handleDayMouseUp = (date: Date) => {
    if (!isSelecting || !selectionStart || isPast(date)) {
      setIsSelecting(false);
      setSelectionStart(null);
      return;
    }

    const start = selectionStart < date ? selectionStart : date;
    const end = selectionStart < date ? date : selectionStart;

    // Check if clicking on an already unavailable range to remove it
    const existingIndex = unavailableDates.findIndex(range => {
      const rangeStart = range.start.getTime();
      const rangeEnd = range.end.getTime();
      return start.getTime() >= rangeStart && end.getTime() <= rangeEnd;
    });

    if (existingIndex !== -1 && start.getTime() === end.getTime()) {
      // Remove the range if single-clicking on an unavailable date
      const newRanges = unavailableDates.filter((_, i) => i !== existingIndex);
      onUnavailableDatesChange(newRanges);
    } else {
      // Add new unavailable range
      const newRange: DateRange = { start, end };
      
      // Merge overlapping ranges
      const mergedRanges = mergeRanges([...unavailableDates, newRange]);
      onUnavailableDatesChange(mergedRanges);
    }

    setIsSelecting(false);
    setSelectionStart(null);
  };

  const handleDayMouseEnter = (_date: Date) => {
    // For visual feedback during selection
  };

  const prevMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() - 1, 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(currentMonth.getFullYear(), currentMonth.getMonth() + 1, 1));
  };

  const clearAllUnavailable = () => {
    onUnavailableDatesChange([]);
  };

  const monthName = currentMonth.toLocaleDateString(undefined, { month: 'long', year: 'numeric' });

  return (
    <div className="availability-calendar">
      <div className="availability-toggle">
        <label className="toggle-label">
          <input
            type="checkbox"
            checked={isAvailableNow}
            onChange={(e) => onAvailableNowChange(e.target.checked)}
          />
          <span className="toggle-slider"></span>
          <span className="toggle-text">
            {isAvailableNow ? '✅ Available Now' : '❌ Not Available'}
          </span>
        </label>
      </div>

      <div className="calendar-section">
        <h4>📅 Mark Unavailable Dates</h4>
        <p className="calendar-help">Click or drag to mark dates as unavailable</p>
        
        <div className="calendar-header">
          <button className="nav-btn" onClick={prevMonth}>‹</button>
          <span className="month-name">{monthName}</span>
          <button className="nav-btn" onClick={nextMonth}>›</button>
        </div>

        <div className="calendar-grid">
          <div className="weekday-header">
            {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map(day => (
              <div key={day} className="weekday">{day}</div>
            ))}
          </div>

          <div className="days-grid">
            {weeks.map((week, weekIndex) => (
              <div key={weekIndex} className="week-row">
                {week.map((date, dayIndex) => {
                  const unavailable = isDateUnavailable(date);
                  const inMonth = isInCurrentMonth(date);
                  const past = isPast(date);
                  
                  return (
                    <div
                      key={dayIndex}
                      className={`day-cell ${unavailable ? 'unavailable' : ''} ${!inMonth ? 'other-month' : ''} ${past ? 'past' : ''}`}
                      onMouseDown={() => handleDayMouseDown(date)}
                      onMouseUp={() => handleDayMouseUp(date)}
                      onMouseEnter={() => handleDayMouseEnter(date)}
                    >
                      <span className="day-number">{date.getDate()}</span>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        </div>

        {unavailableDates.length > 0 && (
          <div className="unavailable-summary">
            <h5>Unavailable Periods:</h5>
            <ul>
              {unavailableDates.map((range, index) => (
                <li key={index}>
                  {formatDateRange(range)}
                  <button 
                    className="remove-range-btn"
                    onClick={() => {
                      const newRanges = unavailableDates.filter((_, i) => i !== index);
                      onUnavailableDatesChange(newRanges);
                    }}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
            <button className="clear-all-btn" onClick={clearAllUnavailable}>
              Clear All
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function mergeRanges(ranges: DateRange[]): DateRange[] {
  if (ranges.length === 0) return [];

  const sorted = [...ranges].sort((a, b) => a.start.getTime() - b.start.getTime());
  const merged: DateRange[] = [sorted[0]];

  for (let i = 1; i < sorted.length; i++) {
    const current = sorted[i];
    const last = merged[merged.length - 1];

    // Check if overlapping or adjacent (within 1 day)
    const lastEndPlus1 = new Date(last.end);
    lastEndPlus1.setDate(lastEndPlus1.getDate() + 1);

    if (current.start <= lastEndPlus1) {
      // Merge
      last.end = current.end > last.end ? current.end : last.end;
    } else {
      merged.push(current);
    }
  }

  return merged;
}

function formatDateRange(range: DateRange): string {
  const startStr = range.start.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const endStr = range.end.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  
  if (range.start.getTime() === range.end.getTime()) {
    return startStr;
  }
  return `${startStr} - ${endStr}`;
}
