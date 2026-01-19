import { useState } from 'react';
import { Space, Reservation } from './SharedSpaces';
import './ReservationModal.css';

interface ReservationModalProps {
  isOpen: boolean;
  space: Space;
  existingReservations: Reservation[];
  onClose: () => void;
  onReserve: (reservation: Omit<Reservation, 'id'>) => void;
}

export function ReservationModal({
  isOpen,
  space,
  existingReservations,
  onClose,
  onReserve,
}: ReservationModalProps) {
  const [startDate, setStartDate] = useState('');
  const [startTime, setStartTime] = useState('');
  const [duration, setDuration] = useState(space.minDuration);
  const [subdivision, setSubdivision] = useState<number>(0);
  const [notes, setNotes] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!startDate || !startTime) return;

    const startDateTime = new Date(`${startDate}T${startTime}`);
    const endDateTime = new Date(startDateTime.getTime() + duration * 60000);

    onReserve({
      spaceId: space.id,
      userName: 'Current User', // TODO: Get from profile
      startTime: startDateTime.toISOString(),
      endTime: endDateTime.toISOString(),
      subdivision: subdivision,
      notes: notes.trim() || undefined,
    });

    // Reset form
    setStartDate('');
    setStartTime('');
    setDuration(space.minDuration);
    setSubdivision(0);
    setNotes('');
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  const formatDuration = (minutes: number) => {
    if (minutes >= 1440) {
      const days = Math.floor(minutes / 1440);
      return `${days} ${days === 1 ? 'day' : 'days'}`;
    }
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      const mins = minutes % 60;
      return mins > 0 ? `${hours}h ${mins}m` : `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
    }
    return `${minutes} min`;
  };

  // Generate duration options based on space constraints
  const durationOptions = [];
  for (let d = space.minDuration; d <= space.maxDuration; d += space.minDuration) {
    durationOptions.push(d);
  }

  if (!isOpen) return null;

  return (
    <>
      <div className="reservation-backdrop" onClick={handleBackdropClick} />
      <div className="reservation-modal">
        <div className="modal-header">
          <h2>
            {space.emoji} Reserve {space.name}
          </h2>
          <button className="close-btn" onClick={onClose} aria-label="Close">
            ✕
          </button>
        </div>

        <form className="reservation-form" onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label htmlFor="start-date">Date *</label>
              <input
                id="start-date"
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                min={new Date().toISOString().split('T')[0]}
                required
              />
            </div>

            <div className="form-group">
              <label htmlFor="start-time">Start Time *</label>
              <input
                id="start-time"
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                required
              />
            </div>
          </div>

          <div className="form-group">
            <label htmlFor="duration">Duration *</label>
            <select
              id="duration"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              required
            >
              {durationOptions.map((d) => (
                <option key={d} value={d}>
                  {formatDuration(d)}
                </option>
              ))}
            </select>
          </div>

          {space.subdivisions > 1 && (
            <div className="form-group">
              <label htmlFor="subdivision">Area *</label>
              <select
                id="subdivision"
                value={subdivision}
                onChange={(e) => setSubdivision(Number(e.target.value))}
                required
              >
                <option value={0}>Full {space.name}</option>
                {space.subdivisionNames?.map((name, index) => (
                  <option key={index + 1} value={index + 1}>
                    {name}
                  </option>
                ))}
              </select>
              <p className="field-hint">
                Choose a specific area or reserve the entire space
              </p>
            </div>
          )}

          <div className="form-group">
            <label htmlFor="notes">Notes (Optional)</label>
            <textarea
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any special notes or requirements..."
              rows={3}
            />
          </div>

          {existingReservations.length > 0 && (
            <div className="existing-reservations">
              <h4>Upcoming Reservations:</h4>
              <div className="reservations-list">
                {existingReservations
                  .filter((r) => new Date(r.startTime) > new Date())
                  .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())
                  .slice(0, 3)
                  .map((res) => (
                    <div key={res.id} className="mini-reservation">
                      <span className="res-user">{res.userName}</span>
                      <span className="res-time">
                        {new Date(res.startTime).toLocaleDateString()} at{' '}
                        {new Date(res.startTime).toLocaleTimeString([], {
                          hour: 'numeric',
                          minute: '2-digit',
                        })}
                      </span>
                      {res.subdivision && res.subdivision > 0 && space.subdivisionNames && (
                        <span className="res-subdivision">
                          {space.subdivisionNames[res.subdivision - 1]}
                        </span>
                      )}
                    </div>
                  ))}
              </div>
            </div>
          )}

          <div className="form-actions">
            <button type="button" className="cancel-btn" onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className="submit-btn">
              Reserve Space
            </button>
          </div>
        </form>
      </div>
    </>
  );
}
