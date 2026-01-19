import { useState } from 'react';
import './OwnerAvailabilityCalendar.css';

interface Props {
  itemTitle: string;
  itemImage?: string;
  isAvailableNow: boolean;
  onAvailableNowChange: (available: boolean) => void;
  unavailableDates: Date[];
  onUnavailableDatesChange: (dates: Date[]) => void;
  onClose: () => void;
  onSave: () => void;
}

export function OwnerAvailabilityCalendar({
  itemTitle,
  itemImage,
  isAvailableNow,
  onAvailableNowChange,
  unavailableDates,
  onUnavailableDatesChange,
  onClose,
  onSave,
}: Props) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectingRange, setSelectingRange] = useState<Date | null>(null);

  const getDaysInMonth = (date: Date) => {
    const year = date.getFullYear();
    const month = date.getMonth();
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    const startingDayOfWeek = firstDay.getDay();

    return { daysInMonth, startingDayOfWeek, year, month };
  };

  const isDateUnavailable = (date: Date) => {
    return unavailableDates.some(d => {
      const unavailable = new Date(d);
      return unavailable.toDateString() === date.toDateString();
    });
  };

  const handleDateClick = (date: Date) => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    if (date < today) return;

    if (!selectingRange) {
      // Start selecting range
      setSelectingRange(date);
      toggleDate(date);
    } else {
      // Complete range selection
      const start = selectingRange < date ? selectingRange : date;
      const end = selectingRange < date ? date : selectingRange;
      
      const datesInRange: Date[] = [];
      const current = new Date(start);
      while (current <= end) {
        datesInRange.push(new Date(current));
        current.setDate(current.getDate() + 1);
      }

      // Toggle all dates in range
      const areAllUnavailable = datesInRange.every(d => isDateUnavailable(d));
      
      if (areAllUnavailable) {
        // Remove all from unavailable
        onUnavailableDatesChange(
          unavailableDates.filter(d => !datesInRange.some(dr => dr.toDateString() === new Date(d).toDateString()))
        );
      } else {
        // Add all to unavailable
        const newDates = [...unavailableDates];
        datesInRange.forEach(d => {
          if (!isDateUnavailable(d)) {
            newDates.push(d);
          }
        });
        onUnavailableDatesChange(newDates);
      }

      setSelectingRange(null);
    }
  };

  const toggleDate = (date: Date) => {
    if (isDateUnavailable(date)) {
      onUnavailableDatesChange(
        unavailableDates.filter(d => new Date(d).toDateString() !== date.toDateString())
      );
    } else {
      onUnavailableDatesChange([...unavailableDates, date]);
    }
  };

  const clearAllDates = () => {
    onUnavailableDatesChange([]);
  };

  const { daysInMonth, startingDayOfWeek, year, month } = getDaysInMonth(currentMonth);
  const monthName = currentMonth.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });

  const previousMonth = () => {
    setCurrentMonth(new Date(year, month - 1));
  };

  const nextMonth = () => {
    setCurrentMonth(new Date(year, month + 1));
  };

  const renderCalendar = () => {
    const days = [];
    const weekDays = ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'];

    days.push(
      <div key="weekdays" className="calendar-weekdays">
        {weekDays.map(day => (
          <div key={day} className="weekday-label">{day}</div>
        ))}
      </div>
    );

    const cells = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      cells.push(<div key={`empty-${i}`} className="calendar-day empty" />);
    }

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const isPast = date < today;
      const isUnavail = isDateUnavailable(date);

      cells.push(
        <button
          key={day}
          type="button"
          className={`calendar-day ${isPast ? 'past' : ''} ${isUnavail ? 'marked-unavailable' : ''}`}
          onClick={() => handleDateClick(date)}
          disabled={isPast}
        >
          {day}
        </button>
      );
    }

    days.push(
      <div key="days" className="calendar-grid">
        {cells}
      </div>
    );

    return days;
  };

  return (
    <div className="owner-availability-overlay" onClick={onClose}>
      <div className="owner-availability-modal" onClick={(e) => e.stopPropagation()}>
        <header className="availability-header">
          <div className="availability-item-info">
            {itemImage && (
              <img src={itemImage} alt={itemTitle} className="availability-item-image" />
            )}
            <div>
              <h2>{itemTitle}</h2>
              <p className="availability-subtitle">Manage availability</p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>✕</button>
        </header>

        <div className="availability-content">
          <div className="availability-toggle">
            <div className="toggle-info">
              <h3>📦 Item Status</h3>
              <p>Is this item currently available for borrowing?</p>
            </div>
            <button
              className={`toggle-btn ${isAvailableNow ? 'available' : 'unavailable'}`}
              onClick={() => onAvailableNowChange(!isAvailableNow)}
            >
              {isAvailableNow ? '✅ Available' : '🔒 Unavailable'}
            </button>
          </div>

          <div className="calendar-section">
            <div className="section-header">
              <div>
                <h3>📅 Block Out Dates</h3>
                <p className="section-hint">Mark dates when this item won't be available</p>
              </div>
              {unavailableDates.length > 0 && (
                <button className="clear-btn" onClick={clearAllDates}>
                  Clear All
                </button>
              )}
            </div>

            <div className="calendar-header">
              <button type="button" className="month-nav" onClick={previousMonth}>‹</button>
              <h4>{monthName}</h4>
              <button type="button" className="month-nav" onClick={nextMonth}>›</button>
            </div>

            <div className="calendar">
              {renderCalendar()}
            </div>

            <p className="calendar-help">
              💡 Click a date to toggle • Click and drag to select a range
            </p>
          </div>

          <div className="availability-actions">
            <button className="cancel-btn" onClick={onClose}>
              Cancel
            </button>
            <button className="save-btn" onClick={onSave}>
              💾 Save Changes
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
