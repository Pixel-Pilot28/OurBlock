import { Space, Reservation } from './SharedSpaces';
import './SpaceCard.css';

interface SpaceCardProps {
  space: Space;
  reservations: Reservation[];
  onReserve: () => void;
}

export function SpaceCard({ space, reservations, onReserve }: SpaceCardProps) {
  const formatDuration = (minutes: number) => {
    if (minutes >= 1440) {
      const days = Math.floor(minutes / 1440);
      return `${days} ${days === 1 ? 'day' : 'days'}`;
    }
    if (minutes >= 60) {
      const hours = Math.floor(minutes / 60);
      return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
    }
    return `${minutes} min`;
  };

  // Count upcoming reservations
  const now = new Date();
  const upcomingReservations = reservations.filter(
    (r) => new Date(r.startTime) > now
  );

  return (
    <article className="space-card">
      <div className="space-icon">{space.emoji}</div>
      
      <div className="space-content">
        <h3 className="space-name">{space.name}</h3>
        <p className="space-description">{space.description}</p>

        <div className="space-details">
          <div className="space-detail">
            <span className="detail-label">Max Duration:</span>
            <span className="detail-value">{formatDuration(space.maxDuration)}</span>
          </div>
          {space.subdivisions > 1 && (
            <div className="space-detail">
              <span className="detail-label">Subdivisions:</span>
              <span className="detail-value">{space.subdivisions} available</span>
            </div>
          )}
        </div>

        {upcomingReservations.length > 0 && (
          <div className="reservations-badge">
            {upcomingReservations.length} upcoming{' '}
            {upcomingReservations.length === 1 ? 'reservation' : 'reservations'}
          </div>
        )}

        <button className="reserve-btn" onClick={onReserve}>
          Reserve This Space
        </button>
      </div>
    </article>
  );
}
