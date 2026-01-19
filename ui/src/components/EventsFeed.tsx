import { useState, useEffect } from 'react';
import { useHolochain } from '../contexts/HolochainContext';
import { CreateEventForm } from './CreateEventForm';
import { EventCard } from './EventCard';
import { EventOutput, CreateEventInput } from '../types/events';
import { useProfiles } from '../hooks/useProfile';
import { AppSignal } from '@holochain/client';
import { logger } from '../utils/logger';
import './EventsFeed.css';

// Helper to convert Uint8Array to hex string (browser-compatible)
function uint8ArrayToHex(arr: Uint8Array): string {
  return Array.from(arr).map(b => b.toString(16).padStart(2, '0')).join('');
}

// Helper to convert hex string to Uint8Array
function hexToUint8Array(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2);
  for (let i = 0; i < hex.length; i += 2) {
    bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
  }
  return bytes;
}

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
  hostKey?: Uint8Array; // For profile lookup
  attendeeKeys?: Uint8Array[]; // For profile lookup
}

export function EventsFeed() {
  const { client, isConnected, onSignal } = useHolochain();
  const [events, setEvents] = useState<Event[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  
  // Collect all agent keys for profile fetching
  const allAgentKeys = events.flatMap(e => [
    ...(e.hostKey ? [e.hostKey] : []),
    ...(e.attendeeKeys || [])
  ]);
  const profiles = useProfiles(allAgentKeys);

  useEffect(() => {
    loadEvents();
  }, [client, isConnected]);

  // Listen for real-time signals
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = onSignal((signal: AppSignal) => {
      if (signal.zome_name === 'events') {
        const payload = signal.payload;
        
        if (payload && typeof payload === 'object' && 'type' in payload) {
          const signalType = (payload as { type: string }).type;
          
          if (signalType === 'NewEvent' || signalType === 'EventRSVP') {
            logger.debug('Event update signal received, refreshing');
            loadEvents();
          }
        }
      }
    });

    return unsubscribe;
  }, [isConnected, onSignal]);

  async function loadEvents() {
    if (!client || !isConnected) {
      setIsLoading(false);
      return;
    }

    try {
      const result: EventOutput[] = await client.callZome({
        role_name: 'our_block',
        zome_name: 'events',
        fn_name: 'get_all_events',
        payload: null,
      });

      // Convert backend events to frontend format
      const convertedEvents: Event[] = result.map(eventOutput => {
        const eventDate = new Date(eventOutput.event.event_date * 1000);
        const hostHex = uint8ArrayToHex(eventOutput.event.host);
        const hostProfile = profiles.get(hostHex);
        const hostDisplay = hostProfile?.nickname || `Neighbor #${hostHex.slice(0, 8).toUpperCase()}`;
        
        return {
          id: uint8ArrayToHex(eventOutput.action_hash),
          title: eventOutput.event.title,
          description: eventOutput.event.description,
          date: eventDate.toISOString().split('T')[0],
          time: eventDate.toTimeString().slice(0, 5),
          location: eventOutput.event.location,
          host: hostDisplay,
          attendees: eventOutput.event.attendees.map(a => {
            const attendeeHex = uint8ArrayToHex(a);
            const attendeeProfile = profiles.get(attendeeHex);
            return attendeeProfile?.nickname || `Neighbor #${attendeeHex.slice(0, 8).toUpperCase()}`;
          }),
          createdAt: eventOutput.event.created_at * 1000,
          hostKey: eventOutput.event.host,
          attendeeKeys: eventOutput.event.attendees,
        };
      });

      setEvents(convertedEvents);
    } catch (error) {
      console.error('Failed to load events:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateEvent(eventData: Omit<Event, 'id' | 'createdAt' | 'attendees' | 'host'>) {
    if (!client || !isConnected) return;

    try {
      // Convert date and time to timestamp
      const eventDateTime = new Date(`${eventData.date}T${eventData.time}`);
      const eventDateTimestamp = Math.floor(eventDateTime.getTime() / 1000);

      const input: CreateEventInput = {
        title: eventData.title,
        description: eventData.description,
        location: eventData.location,
        event_date: eventDateTimestamp,
        max_attendees: null, // Can be enhanced later
      };

      const result: EventOutput = await client.callZome({
        role_name: 'our_block',
        zome_name: 'events',
        fn_name: 'create_event',
        payload: input,
      });

      const hostHex = uint8ArrayToHex(result.event.host);
      const hostProfile = profiles.get(hostHex);
      const hostDisplay = hostProfile?.nickname || `Neighbor #${hostHex.slice(0, 8).toUpperCase()}`;
      const newEventDate = new Date(result.event.event_date * 1000);
      
      const newEvent: Event = {
        id: uint8ArrayToHex(result.action_hash),
        title: result.event.title,
        description: result.event.description,
        date: newEventDate.toISOString().split('T')[0],
        time: newEventDate.toTimeString().slice(0, 5),
        location: result.event.location,
        host: hostDisplay,
        attendees: result.event.attendees.map(a => {
          const attendeeHex = uint8ArrayToHex(a);
          const attendeeProfile = profiles.get(attendeeHex);
          return attendeeProfile?.nickname || `Neighbor #${attendeeHex.slice(0, 8).toUpperCase()}`;
        }),
        createdAt: result.event.created_at * 1000,
        hostKey: result.event.host,
        attendeeKeys: result.event.attendees,
      };

      setEvents([newEvent, ...events]);
    } catch (error) {
      console.error('Failed to create event:', error);
    }
  }

  async function handleRSVP(eventId: string) {
    if (!client || !isConnected) return;

    try {
      // Convert hex id back to ActionHash
      const eventHash = hexToUint8Array(eventId);

      const result: EventOutput = await client.callZome({
        role_name: 'our_block',
        zome_name: 'events',
        fn_name: 'rsvp_event',
        payload: eventHash,
      });

      const updatedEventDate = new Date(result.event.event_date * 1000);
      const hostHex = uint8ArrayToHex(result.event.host);
      const hostProfile = profiles.get(hostHex);
      const hostDisplay = hostProfile?.nickname || `Neighbor #${hostHex.slice(0, 8).toUpperCase()}`;
      
      const updatedEvent: Event = {
        id: eventId,
        title: result.event.title,
        description: result.event.description,
        date: updatedEventDate.toISOString().split('T')[0],
        time: updatedEventDate.toTimeString().slice(0, 5),
        location: result.event.location,
        host: hostDisplay,
        attendees: result.event.attendees.map(a => {
          const attendeeHex = uint8ArrayToHex(a);
          const attendeeProfile = profiles.get(attendeeHex);
          return attendeeProfile?.nickname || `Neighbor #${attendeeHex.slice(0, 8).toUpperCase()}`;
        }),
        createdAt: result.event.created_at * 1000,
        hostKey: result.event.host,
        attendeeKeys: result.event.attendees,
      };

      setEvents(events.map(e => e.id === eventId ? updatedEvent : e));
    } catch (error) {
      console.error('Failed to RSVP to event:', error);
    }
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
