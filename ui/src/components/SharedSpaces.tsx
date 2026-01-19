import { useState, useEffect } from 'react';
import { useHolochain } from '../contexts/HolochainContext';
import { SpaceCard } from './SpaceCard';
import { ReservationModal } from './ReservationModal';
import { CreateSpaceForm } from './CreateSpaceForm';
import { SpaceOutput, ReservationOutput, CreateSpaceInput, CreateReservationInput } from '../types/spaces';
import { useProfiles } from '../hooks/useProfile';
import { AppSignal } from '@holochain/client';
import { logger } from '../utils/logger';
import './SharedSpaces.css';

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
  reserverKey?: Uint8Array; // For profile lookup
}

export function SharedSpaces() {
  const { client, isConnected, onSignal } = useHolochain();
  const [spaces, setSpaces] = useState<Space[]>([]);
  const [reservations, setReservations] = useState<Reservation[]>([]);
  const [selectedSpace, setSelectedSpace] = useState<Space | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  // Collect all agent keys for profile fetching
  const allAgentKeys = reservations
    .map(r => r.reserverKey)
    .filter((k): k is Uint8Array => k !== undefined);
  const profiles = useProfiles(allAgentKeys);

  useEffect(() => {
    loadSpacesAndReservations();
  }, [client, isConnected]);

  // Listen for real-time signals
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = onSignal((signal: AppSignal) => {
      if (signal.zome_name === 'spaces') {
        const payload = signal.payload;
        
        if (payload && typeof payload === 'object' && 'type' in payload) {
          const signalType = (payload as { type: string }).type;
          
          if (signalType === 'NewSpace' || signalType === 'NewReservation') {
            logger.debug('Spaces update signal received, refreshing');
            loadSpacesAndReservations();
          }
        }
      }
    });

    return unsubscribe;
  }, [isConnected, onSignal]);

  async function loadSpacesAndReservations() {
    if (!client || !isConnected) {
      setIsLoading(false);
      return;
    }

    try {
      // Load spaces
      const spacesResult: SpaceOutput[] = await client.callZome({
        role_name: 'our_block',
        zome_name: 'spaces',
        fn_name: 'get_all_spaces',
        payload: null,
      });

      // Convert backend spaces to frontend format
      // Note: Backend doesn't have emoji/subdivisions - these are UI concepts
      const convertedSpaces: Space[] = spacesResult.map(spaceOutput => ({
        id: uint8ArrayToHex(spaceOutput.action_hash),
        name: spaceOutput.space.name,
        description: spaceOutput.space.description,
        emoji: '🏛️', // Default emoji
        maxDuration: 240, // Default 4 hours
        minDuration: 60, // Default 1 hour
        subdivisions: 1, // No subdivisions by default
      }));

      setSpaces(convertedSpaces);

      // Load all reservations
      const allReservations: Reservation[] = [];
      for (const spaceOutput of spacesResult) {
        const reservationsResult: ReservationOutput[] = await client.callZome({
          role_name: 'our_block',
          zome_name: 'spaces',
          fn_name: 'get_space_reservations',
          payload: spaceOutput.action_hash,
        });

        const convertedReservations = reservationsResult.map(resOutput => ({
          id: uint8ArrayToHex(resOutput.action_hash),
          spaceId: uint8ArrayToHex(resOutput.reservation.space_hash),
          userName: (() => {
            const reserverHex = uint8ArrayToHex(resOutput.reservation.reserver);
            const reserverProfile = profiles.get(reserverHex);
            return reserverProfile?.nickname || `Neighbor #${reserverHex.slice(0, 8).toUpperCase()}`;
          })(),
          startTime: new Date(resOutput.reservation.start_time * 1000).toISOString(),
          endTime: new Date(resOutput.reservation.end_time * 1000).toISOString(),
          notes: resOutput.reservation.purpose || undefined,
          reserverKey: resOutput.reservation.reserver,
        }));

        allReservations.push(...convertedReservations);
      }

      setReservations(allReservations);
    } catch (error) {
      console.error('Failed to load spaces and reservations:', error);
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateReservation(reservation: Omit<Reservation, 'id'>) {
    if (!client || !isConnected) return;

    try {
      const spaceHash = hexToUint8Array(reservation.spaceId);
      const startTimestamp = Math.floor(new Date(reservation.startTime).getTime() / 1000);
      const endTimestamp = Math.floor(new Date(reservation.endTime).getTime() / 1000);

      const input: CreateReservationInput = {
        space_hash: spaceHash,
        start_time: startTimestamp,
        end_time: endTimestamp,
        purpose: reservation.notes || null,
      };

      const result: ReservationOutput = await client.callZome({
        role_name: 'our_block',
        zome_name: 'spaces',
        fn_name: 'create_reservation',
        payload: input,
      });

      const reserverHex = uint8ArrayToHex(result.reservation.reserver);
      const reserverProfile = profiles.get(reserverHex);
      const reserverDisplay = reserverProfile?.nickname || `Neighbor #${reserverHex.slice(0, 8).toUpperCase()}`;

      const newReservation: Reservation = {
        id: uint8ArrayToHex(result.action_hash),
        userName: reserverDisplay,
        startTime: new Date(result.reservation.start_time * 1000).toISOString(),
        endTime: new Date(result.reservation.end_time * 1000).toISOString(),
        notes: result.reservation.purpose || undefined,
        reserverKey: result.reservation.reserver,
        spaceId: reservation.spaceId,
      };

      setReservations([...reservations, newReservation]);
      setIsModalOpen(false);
    } catch (error) {
      console.error('Failed to create reservation:', error);
      alert('Failed to create reservation. The time slot may conflict with an existing reservation.');
    }
  }

  async function handleCreateSpace(spaceData: Omit<Space, 'id'>) {
    if (!client || !isConnected) return;

    try {
      const input: CreateSpaceInput = {
        name: spaceData.name,
        description: spaceData.description,
        capacity: 10, // Default capacity
        available_hours: '9AM-9PM', // Default hours
      };

      const result: SpaceOutput = await client.callZome({
        role_name: 'our_block',
        zome_name: 'spaces',
        fn_name: 'create_space',
        payload: input,
      });

      const newSpace: Space = {
        id: uint8ArrayToHex(result.action_hash),
        name: result.space.name,
        description: result.space.description,
        emoji: spaceData.emoji,
        maxDuration: spaceData.maxDuration,
        minDuration: spaceData.minDuration,
        subdivisions: spaceData.subdivisions,
        subdivisionNames: spaceData.subdivisionNames,
      };

      setSpaces([...spaces, newSpace]);
    } catch (error) {
      console.error('Failed to create space:', error);
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

      <CreateSpaceForm onSpaceCreated={handleCreateSpace} />

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
