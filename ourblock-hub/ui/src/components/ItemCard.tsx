import { useState, useEffect } from 'react';
import { useHolochain } from '../contexts/HolochainContext';
import type { ItemOutput, Profile, FileOutput, ItemStatus } from '../types';
import { normalizeItemStatus } from '../utils/itemStatus';
import './ItemCard.css';

interface Props {
  item: ItemOutput;
  onClick?: () => void;
  showOwnerActions?: boolean;
  onStatusChange?: (item: ItemOutput, newStatus: ItemStatus) => void;
  style?: React.CSSProperties;
}

export function ItemCard({ 
  item,
  onClick,
  style
}: Props) {
  const { client, agentKey } = useHolochain();
  const { title, description, status, owner, image_hash } = item.item;
  const [ownerProfile, setOwnerProfile] = useState<Profile | null>(null);
  const [imageData, setImageData] = useState<string | null>(null);

  // Check if current user is the owner
  const isOwner = agentKey && arrayToHex(owner) === arrayToHex(agentKey);

  // Fetch the item's image from file storage
  useEffect(() => {
    async function fetchImage() {
      if (!client || !image_hash) return;

      try {
        // Note: file_storage zome is currently disabled
        // Items created without images will have null image_hash
        const fileOutput: FileOutput = await client.callZome({
          role_name: 'our_block',
          zome_name: 'file_storage',
          fn_name: 'get_file',
          payload: image_hash,
        });

        // Convert Uint8Array to base64
        const base64 = arrayBufferToBase64(new Uint8Array(fileOutput.data));
        setImageData(base64);
      } catch (err) {
        // Silently fail - file_storage zome may not be available
        console.debug('Could not fetch image (file_storage may be disabled):', err);
      }
    }

    fetchImage();
  }, [client, image_hash]);

  // Fetch the owner's profile
  useEffect(() => {
    async function fetchOwnerProfile() {
      if (!client) return;

      try {
        const result = await client.callZome({
          role_name: 'our_block',
          zome_name: 'profile',
          fn_name: 'get_agent_profile',
          payload: owner,
        });
        
        if (result) {
          setOwnerProfile(result.profile);
        }
      } catch (err) {
        console.debug('Could not fetch profile for owner:', err);
      }
    }

    fetchOwnerProfile();
  }, [client, owner]);

  const ownerDisplayName = ownerProfile?.nickname || shortenAgentKey(owner);

  const normalizedStatus = normalizeItemStatus(status);
  const isAvailable = normalizedStatus === 'Available';

  const getStatusBadge = () => {
    switch (normalizedStatus) {
      case 'Available':
        return <span className="status-badge available">Available</span>;
      case 'Borrowed':
        return <span className="status-badge borrowed">Borrowed</span>;
      case 'Unavailable':
        return <span className="status-badge unavailable">Unavailable</span>;
      default:
        return null;
    }
  };

  return (
    <article 
      className={`item-card ${!isAvailable ? 'unavailable' : ''}`}
      onClick={onClick}
      style={style}
    >
      {imageData && (
        <div className="item-image-container">
          <img src={imageData} alt={title} className="item-image" />
          <div className="item-image-overlay">
            {getStatusBadge()}
          </div>
        </div>
      )}
      
      <div className="item-compact-content">
        <div className="item-header-row">
          <h3 className="item-title">{title}</h3>
          {!imageData && getStatusBadge()}
        </div>
        
        <p className="item-description">{description || 'No description'}</p>
        
        <div className="item-footer-row">
          <span className="item-owner">{ownerDisplayName}</span>
          {isOwner && <span className="owner-indicator">Your item</span>}
        </div>
      </div>
    </article>
  );
}

function arrayBufferToBase64(buffer: Uint8Array): string {
  let binary = '';
  const len = buffer.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(buffer[i]);
  }
  return `data:image/jpeg;base64,${btoa(binary)}`;
}

function arrayToHex(arr: Uint8Array): string {
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

function shortenAgentKey(key: Uint8Array): string {
  const hex = Array.from(key.slice(0, 4))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `Neighbor #${hex.toUpperCase()}`;
}
