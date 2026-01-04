import { Event } from './EventsFeed';
import './EventCard.css';

interface EventCardProps {
  event: Event;
  onRSVP: (eventId: string) => void;
  isPast?: boolean;
  style?: React.CSSProperties;
}

export function EventCard({ event, onRSVP, isPast = false, style }: EventCardProps) {
  const eventDate = new Date(`${event.date}T${event.time}`);
  const formattedDate = eventDate.toLocaleDateString('en-US', { 
    weekday: 'long', 
    year: 'numeric', 
    month: 'long', 
    day: 'numeric' 
  });
  const formattedTime = eventDate.toLocaleTimeString('en-US', { 
    hour: 'numeric', 
    minute: '2-digit' 
  });

  const monthDay = eventDate.toLocaleDateString('en-US', { 
    month: 'short', 
    day: 'numeric' 
  });

  return (
    <article className={`event-card ${isPast ? 'past' : ''}`} style={style}>
      <div className="event-date-badge">
        <div className="date-month">{monthDay.split(' ')[0]}</div>
        <div className="date-day">{monthDay.split(' ')[1]}</div>
      </div>

      <div className="event-content">
        <div className="event-main">
          <h3 className="event-title">{event.title}</h3>
          <p className="event-description">{event.description}</p>
          
          <div className="event-details">
            <div className="event-detail">
              <span className="detail-icon">📅</span>
              <span>{formattedDate}</span>
            </div>
            <div className="event-detail">
              <span className="detail-icon">🕐</span>
              <span>{formattedTime}</span>
            </div>
            <div className="event-detail">
              <span className="detail-icon">📍</span>
              <span>{event.location}</span>
            </div>
            <div className="event-detail">
              <span className="detail-icon">👤</span>
              <span>Hosted by {event.host}</span>
            </div>
          </div>
        </div>

        <div className="event-footer">
          <div className="event-attendees">
            <span className="attendees-icon">👥</span>
            <span className="attendees-count">
              {event.attendees.length} {event.attendees.length === 1 ? 'person' : 'people'} attending
            </span>
          </div>
          
          {!isPast && (
            <button 
              className="rsvp-btn"
              onClick={() => onRSVP(event.id)}
            >
              RSVP
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
