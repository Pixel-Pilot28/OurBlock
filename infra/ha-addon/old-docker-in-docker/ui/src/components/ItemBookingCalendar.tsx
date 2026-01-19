import { useState } from 'react';
import './ItemBookingCalendar.css';

interface Props {
  itemTitle: string;
  itemImage?: string;
  onClose: () => void;
  onBooking: (startDate: Date, endDate: Date, message: string) => void;
  unavailableDates?: Date[];
}

export function ItemBookingCalendar({ itemTitle, itemImage, onClose, onBooking, unavailableDates = [] }: Props) {
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedStart, setSelectedStart] = useState<Date | null>(null);
  const [selectedEnd, setSelectedEnd] = useState<Date | null>(null);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    if (date < today) return true;
    
    return unavailableDates.some(unavailable => {
      const d = new Date(unavailable);
      return d.toDateString() === date.toDateString();
    });
  };

  const isDateInRange = (date: Date) => {
    if (!selectedStart) return false;
    if (!selectedEnd) return false;
    return date >= selectedStart && date <= selectedEnd;
  };

  const handleDateClick = (date: Date) => {
    if (isDateUnavailable(date)) return;

    if (!selectedStart || (selectedStart && selectedEnd)) {
      // Start new selection
      setSelectedStart(date);
      setSelectedEnd(null);
    } else {
      // Complete selection
      if (date < selectedStart) {
        setSelectedEnd(selectedStart);
        setSelectedStart(date);
      } else {
        setSelectedEnd(date);
      }
    }
  };

  const handleSubmit = async () => {
    if (!selectedStart || !selectedEnd) return;

    setIsSubmitting(true);
    try {
      await onBooking(selectedStart, selectedEnd, message);
    } finally {
      setIsSubmitting(false);
    }
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

    // Week day headers
    days.push(
      <div key="weekdays" className="calendar-weekdays">
        {weekDays.map(day => (
          <div key={day} className="weekday-label">{day}</div>
        ))}
      </div>
    );

    // Empty cells before month starts
    const cells = [];
    for (let i = 0; i < startingDayOfWeek; i++) {
      cells.push(<div key={`empty-${i}`} className="calendar-day empty" />);
    }

    // Month days
    for (let day = 1; day <= daysInMonth; day++) {
      const date = new Date(year, month, day);
      const isUnavailable = isDateUnavailable(date);
      const isStart = selectedStart?.toDateString() === date.toDateString();
      const isEnd = selectedEnd?.toDateString() === date.toDateString();
      const isInRange = isDateInRange(date);

      cells.push(
        <button
          key={day}
          type="button"
          className={`calendar-day ${isUnavailable ? 'unavailable' : ''} ${isStart ? 'selected-start' : ''} ${isEnd ? 'selected-end' : ''} ${isInRange ? 'in-range' : ''}`}
          onClick={() => handleDateClick(date)}
          disabled={isUnavailable}
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
    <div className="booking-modal-overlay" onClick={onClose}>
      <div className="booking-modal" onClick={(e) => e.stopPropagation()}>
        <header className="booking-header">
          <div className="booking-item-info">
            {itemImage && (
              <img src={itemImage} alt={itemTitle} className="booking-item-image" />
            )}
            <div>
              <h2>{itemTitle}</h2>
              <p className="booking-subtitle">Select your borrow dates</p>
            </div>
          </div>
          <button className="close-btn" onClick={onClose}>✕</button>
        </header>

        <div className="booking-content">
          <div className="calendar-section">
            <div className="calendar-header">
              <button type="button" className="month-nav" onClick={previousMonth}>‹</button>
              <h3>{monthName}</h3>
              <button type="button" className="month-nav" onClick={nextMonth}>›</button>
            </div>

            <div className="calendar">
              {renderCalendar()}
            </div>

            <div className="calendar-legend">
              <div className="legend-item">
                <div className="legend-color selected"></div>
                <span>Selected</span>
              </div>
              <div className="legend-item">
                <div className="legend-color unavailable"></div>
                <span>Unavailable</span>
              </div>
            </div>
          </div>

          {selectedStart && (
            <div className="booking-summary">
              <h3>📅 Your Booking</h3>
              <div className="date-range">
                <div className="date-box">
                  <span className="date-label">From</span>
                  <span className="date-value">{selectedStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                </div>
                <div className="date-arrow">→</div>
                <div className="date-box">
                  <span className="date-label">To</span>
                  <span className="date-value">
                    {selectedEnd 
                      ? selectedEnd.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
                      : 'Select end date'}
                  </span>
                </div>
              </div>

              {selectedEnd && (
                <>
                  <div className="form-group">
                    <label htmlFor="booking-message">Message (optional)</label>
                    <textarea
                      id="booking-message"
                      value={message}
                      onChange={(e) => setMessage(e.target.value)}
                      placeholder="Let the owner know why you need this..."
                      rows={3}
                      maxLength={300}
                    />
                    <span className="char-count">{message.length}/300</span>
                  </div>

                  <button
                    className="submit-booking-btn"
                    onClick={handleSubmit}
                    disabled={isSubmitting}
                  >
                    {isSubmitting ? 'Requesting...' : '🤝 Request to Borrow'}
                  </button>
                </>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
