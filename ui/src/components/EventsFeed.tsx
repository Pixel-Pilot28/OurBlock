import { useState, useEffect } from 'react';
import { useHolochain } from '../contexts/HolochainContext';
import { CreateEventForm } from './CreateEventForm';
import { EventCard } from './EventCard';
import './EventsFeed.css';

export interface Event {
  id: string;
  title: string;
  description: string;
  date: string;
  time: string;
  location: string;
  host: string;
  attendees: string[];
  createdAt: number;
}

export function EventsFeed() {
  const { client, isConnected } = useHolochain();
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadEvents();
  }, [client, isConnected]);

  async function loadEvents() {
    if (!client || !isConnected) return;

    try {
      // TODO: Replace with actual Holochain call when implemented
      // const result = await client.callZome({
      //   role_name: 'our_block',
      //   zome_name: 'events',
      //   fn_name: 'get_all_events',
      //   payload: null,
      // });
      
      // Mock data for now
      const mockEvents: Event[] = [
        {
          id: '1',
          title: 'Block Party BBQ',
          description: 'Join us for a neighborhood BBQ! Bring your favorite dish to share. We\'ll have grills, games, and great company.',
          date: '2026-01-15',
          time: '14:00',
          location: 'Community Park Pavilion',
          host: 'Sarah Johnson',
          attendees: ['Sarah Johnson', 'Mike Chen', 'Emily Rodriguez'],
          createdAt: Date.now() - 86400000,
        },
        {
          id: '2',
          title: 'Community Garden Workday',
          description: 'Help us prepare the community garden for spring planting. Tools and refreshments provided.',
          date: '2026-01-20',
          time: '09:00',
          location: 'Maple Street Garden',
          host: 'Tom Williams',
          attendees: ['Tom Williams', 'Lisa Park'],
          createdAt: Date.now() - 172800000,
        },
        {
          id: '3',
          title: 'Yoga in the Park',
          description: 'Free outdoor yoga session for all skill levels. Bring your own mat!',
          date: '2026-01-18',
          time: '08:00',
          location: 'Riverside Park',
          host: 'Jennifer Lee',
          attendees: ['Jennifer Lee', 'Alex Martinez', 'Priya Patel', 'David Kim'],
          createdAt: Date.now() - 259200000,
        },
      ];
      
      setEvents(mockEvents);
    } catch (error) {
      console.error('Failed to load events:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateEvent(eventData: Omit<Event, 'id' | 'createdAt' | 'attendees' | 'host'>) {
    if (!client || !isConnected) return;

    try {
      // TODO: Replace with actual Holochain call
      // const result = await client.callZome({
      //   role_name: 'our_block',
      //   zome_name: 'events',
      //   fn_name: 'create_event',
      //   payload: eventData,
      // });

      // Mock implementation
      const newEvent: Event = {
        ...eventData,
        id: Date.now().toString(),
        host: 'Current User', // TODO: Get from profile
        attendees: ['Current User'],
        createdAt: Date.now(),
      };

      setEvents([newEvent, ...events]);
    } catch (error) {
      console.error('Failed to create event:', error);
    }
  }

  async function handleRSVP(eventId: string) {
    // TODO: Implement RSVP functionality
    console.log('RSVP to event:', eventId);
  }

  if (isLoading) {
    return (
      <div className="events-feed">
        <div className="loading">
          <p>Loading events...</p>
        </div>
      </div>
    );
  }

  // Separate upcoming and past events
  const now = new Date();
  const upcomingEvents = events.filter(event => new Date(`${event.date}T${event.time}`) >= now);
  const pastEvents = events.filter(event => new Date(`${event.date}T${event.time}`) < now);

  return (
    <div className="events-feed">
      <div className="events-header">
        <div className="events-title-section">
          <h2>📅 Community Events</h2>
          <p className="events-subtitle">Connect with neighbors through local gatherings</p>
        </div>
      </div>

      <CreateEventForm onEventCreated={handleCreateEvent} />

      {upcomingEvents.length > 0 && (
        <section className="events-section">
          <h3 className="section-title">Upcoming Events</h3>
          <div className="events-list">
            {upcomingEvents.map((event, index) => (
              <EventCard
                key={event.id}
                event={event}
                onRSVP={handleRSVP}
                style={{ animationDelay: `${index * 100}ms` }}
              />
            ))}
          </div>
        </section>
      )}

      {pastEvents.length > 0 && (
        <section className="events-section">
          <h3 className="section-title">Past Events</h3>
          <div className="events-list">
            {pastEvents.map((event, index) => (
              <EventCard
                key={event.id}
                event={event}
                onRSVP={handleRSVP}
                isPast={true}
                style={{ animationDelay: `${index * 100}ms` }}
              />
            ))}
          </div>
        </section>
      )}

      {events.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">📅</div>
          <h3>No events yet</h3>
          <p>Be the first to create an event and bring the community together!</p>
        </div>
      )}
    </div>
  );
}
