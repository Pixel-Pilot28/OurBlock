import { useState } from 'react';
import { Event } from './EventsFeed';
import './CreateEventForm.css';

interface CreateEventFormProps {
  onEventCreated: (event: Omit<Event, 'id' | 'createdAt' | 'attendees' | 'host'>) => void;
}

export function CreateEventForm({ onEventCreated }: CreateEventFormProps) {
  const [isExpanded, setIsExpanded] = useState(false);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [location, setLocation] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!title.trim() || !date || !time || !location.trim()) {
      return;
    }

    onEventCreated({
      title: title.trim(),
      description: description.trim(),
      date,
      time,
      location: location.trim(),
    });

    // Reset form
    setTitle('');
    setDescription('');
    setDate('');
    setTime('');
    setLocation('');
    setIsExpanded(false);
  };

  const handleCancel = () => {
    setTitle('');
    setDescription('');
    setDate('');
    setTime('');
    setLocation('');
    setIsExpanded(false);
  };

  if (!isExpanded) {
    return (
      <button
        className="create-event-trigger"
        onClick={() => setIsExpanded(true)}
      >
        <span className="trigger-icon">+</span>
        <span>Create New Event</span>
      </button>
    );
  }

  return (
    <form className="create-event-form" onSubmit={handleSubmit}>
      <div className="form-header">
        <h3>Create New Event</h3>
      </div>

      <div className="form-group">
        <label htmlFor="event-title">Event Title *</label>
        <input
          id="event-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="e.g., Summer Block Party"
          required
          autoFocus
        />
      </div>

      <div className="form-group">
        <label htmlFor="event-description">Description</label>
        <textarea
          id="event-description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Tell neighbors what to expect..."
          rows={3}
        />
      </div>

      <div className="form-row">
        <div className="form-group">
          <label htmlFor="event-date">Date *</label>
          <input
            id="event-date"
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            required
            min={new Date().toISOString().split('T')[0]}
          />
        </div>

        <div className="form-group">
          <label htmlFor="event-time">Time *</label>
          <input
            id="event-time"
            type="time"
            value={time}
            onChange={(e) => setTime(e.target.value)}
            required
          />
        </div>
      </div>

      <div className="form-group">
        <label htmlFor="event-location">Location *</label>
        <input
          id="event-location"
          type="text"
          value={location}
          onChange={(e) => setLocation(e.target.value)}
          placeholder="e.g., Community Park Pavilion"
          required
        />
      </div>

      <div className="form-actions">
        <button type="button" className="cancel-btn" onClick={handleCancel}>
          Cancel
        </button>
        <button type="submit" className="submit-btn">
          Create Event
        </button>
      </div>
    </form>
  );
}
