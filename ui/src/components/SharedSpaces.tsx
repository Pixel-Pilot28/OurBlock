import { useState, useEffect } from 'react';
import { useHolochain } from '../contexts/HolochainContext';
import { SpaceCard } from './SpaceCard';
import { ReservationModal } from './ReservationModal';
import './SharedSpaces.css';

export interface Space {
  id: string;
  name: string;
  description: string;
  emoji: string;
  maxDuration: number; // in minutes
  minDuration: number; // in minutes
  subdivisions: number; // how many parts it can be divided into (e.g., 2 for half-court)
  subdivisionNames?: string[]; // optional names for subdivisions
}

export interface Reservation {
  id: string;
  spaceId: string;
  userName: string;
  startTime: string;
  endTime: string;
  subdivision?: number; // which subdivision (0 for full space, 1+ for specific part)
  notes?: string;
}

const MOCK_SPACES: Space[] = [
  {
    id: '1',
    name: 'Tennis Courts',
    description: 'Two tennis courts with lighting for evening play',
    emoji: '🎾',
    maxDuration: 60, // 1 hour
    minDuration: 30,
    subdivisions: 2,
    subdivisionNames: ['Court 1', 'Court 2'],
  },
  {
    id: '2',
    name: 'Community Pavilion',
    description: 'Large covered pavilion with picnic tables and BBQ grills',
    emoji: '🏕️',
    maxDuration: 1440, // 1 day
    minDuration: 120, // 2 hours
    subdivisions: 1,
  },
  {
    id: '3',
    name: 'Basketball Court',
    description: 'Full outdoor basketball court',
    emoji: '🏀',
    maxDuration: 120, // 2 hours
    minDuration: 60,
    subdivisions: 2,
    subdivisionNames: ['Full Court', 'Half Court'],
  },
  {
    id: '4',
    name: 'Community Garden Plot',
    description: 'Raised bed garden plots for growing vegetables and flowers',
    emoji: '🌱',
    maxDuration: 10080, // 1 week
    minDuration: 1440, // 1 day
    subdivisions: 4,
    subdivisionNames: ['Plot A', 'Plot B', 'Plot C', 'Plot D'],
  },
  {
    id: '5',
    name: 'BBQ Area',
    description: 'Gas and charcoal grills with prep tables',
    emoji: '🍖',
    maxDuration: 240, // 4 hours
    minDuration: 60,
    subdivisions: 3,
    subdivisionNames: ['Grill 1', 'Grill 2', 'Grill 3'],
  },
];

export function SharedSpaces() {
  const { client, isConnected } = useHolochain();
  const [spaces] = useState<Space[]>(MOCK_SPACES);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [selectedSpace, setSelectedSpace] = useState<Space | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadReservations();
  }, [client, isConnected]);

  async function loadReservations() {
    if (!client || !isConnected) return;

    try {
      // TODO: Replace with actual Holochain call
      // const result = await client.callZome({
      //   role_name: 'our_block',
      //   zome_name: 'shared_spaces',
      //   fn_name: 'get_all_reservations',
      //   payload: null,
      // });

      // Mock data
      const mockReservations: Reservation[] = [
        {
          id: '1',
          spaceId: '1',
          userName: 'Alex Martinez',
          startTime: new Date(Date.now() + 3600000 * 2).toISOString(),
          endTime: new Date(Date.now() + 3600000 * 3).toISOString(),
          subdivision: 1,
        },
        {
          id: '2',
          spaceId: '2',
          userName: 'Sarah Johnson',
          startTime: new Date(Date.now() + 86400000).toISOString(),
          endTime: new Date(Date.now() + 86400000 + 14400000).toISOString(),
          notes: 'Birthday party setup',
        },
      ];

      setReservations(mockReservations);
    } catch (error) {
      console.error('Failed to load reservations:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateReservation(reservation: Omit<Reservation, 'id'>) {
    if (!client || !isConnected) return;

    try {
      // TODO: Replace with actual Holochain call
      // const result = await client.callZome({
      //   role_name: 'our_block',
      //   zome_name: 'shared_spaces',
      //   fn_name: 'create_reservation',
      //   payload: reservation,
      // });

      const newReservation: Reservation = {
        ...reservation,
        id: Date.now().toString(),
      };

      setReservations([...reservations, newReservation]);
      setIsModalOpen(false);
    } catch (error) {
      console.error('Failed to create reservation:', error);
    }
  }

  function handleReserveSpace(space: Space) {
    setSelectedSpace(space);
    setIsModalOpen(true);
  }

  if (isLoading) {
    return (
      <div className="shared-spaces">
        <div className="loading">
          <p>Loading shared spaces...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="shared-spaces">
      <div className="spaces-header">
        <h2>🏛️ Shared Spaces</h2>
        <p className="spaces-subtitle">Reserve community amenities for your activities</p>
      </div>

      <div className="spaces-grid">
        {spaces.map((space) => {
          const spaceReservations = reservations.filter((r) => r.spaceId === space.id);
          return (
            <SpaceCard
              key={space.id}
              space={space}
              reservations={spaceReservations}
              onReserve={() => handleReserveSpace(space)}
            />
          );
        })}
      </div>

      {selectedSpace && (
        <ReservationModal
          isOpen={isModalOpen}
          space={selectedSpace}
          existingReservations={reservations.filter((r) => r.spaceId === selectedSpace.id)}
          onClose={() => setIsModalOpen(false)}
          onReserve={handleCreateReservation}
        />
      )}
    </div>
  );
}
