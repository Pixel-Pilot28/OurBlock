import { useState } from 'react';
import type { ItemOutput, ItemStatus } from '../types';
import './ItemCard.css';

interface Props {
  item: ItemOutput;
  onBorrowRequest?: (item: ItemOutput) => void;
  showOwnerActions?: boolean;
  onStatusChange?: (item: ItemOutput, newStatus: ItemStatus) => void;
}

export function ItemCard({ 
  item, 
  onBorrowRequest,
  showOwnerActions = false,
  onStatusChange 
}: Props) {
  const { title, description, status, owner, created_at } = item.item;
  const [isRequesting, setIsRequesting] = useState(false);

  const isAvailable = status === 'Available';

  const handleBorrowClick = async () => {
    if (!onBorrowRequest || !isAvailable) return;
    
    setIsRequesting(true);
    try {
      onBorrowRequest(item);
    } finally {
      setIsRequesting(false);
    }
  };

  const getStatusBadge = () => {
    switch (status) {
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

  const getItemIcon = () => {
    // Simple icon based on first letter or keywords
    const lowerTitle = title.toLowerCase();
    if (lowerTitle.includes('drill') || lowerTitle.includes('tool')) return '🔧';
    if (lowerTitle.includes('ladder')) return '🪜';
    if (lowerTitle.includes('game') || lowerTitle.includes('board')) return '🎲';
    if (lowerTitle.includes('book')) return '📚';
    if (lowerTitle.includes('bike') || lowerTitle.includes('bicycle')) return '🚲';
    if (lowerTitle.includes('tent') || lowerTitle.includes('camp')) return '⛺';
    if (lowerTitle.includes('grill') || lowerTitle.includes('bbq')) return '🍖';
    if (lowerTitle.includes('chair') || lowerTitle.includes('table')) return '🪑';
    if (lowerTitle.includes('camera')) return '📷';
    if (lowerTitle.includes('speaker') || lowerTitle.includes('music')) return '🔊';
    return '📦';
  };

  return (
    <article className={`item-card ${!isAvailable ? 'unavailable' : ''}`}>
      <div className="item-image">
        <span className="item-icon">{getItemIcon()}</span>
        {getStatusBadge()}
      </div>

      <div className="item-content">
        <h3 className="item-title">{title}</h3>
        <p className="item-description">{description || 'No description provided.'}</p>
        
        <div className="item-meta">
          <span className="item-owner">
            👤 {shortenAgentKey(owner)}
          </span>
          <span className="item-date">
            Listed {formatTimestamp(created_at)}
          </span>
        </div>
      </div>

      <div className="item-actions">
        {showOwnerActions ? (
          <div className="owner-actions">
            <button 
              className="status-btn"
              onClick={() => onStatusChange?.(item, isAvailable ? 'Unavailable' : 'Available')}
            >
              {isAvailable ? '🔒 Mark Unavailable' : '🔓 Mark Available'}
            </button>
          </div>
        ) : (
          <button 
            className={`borrow-btn ${!isAvailable ? 'disabled' : ''}`}
            onClick={handleBorrowClick}
            disabled={!isAvailable || isRequesting}
          >
            {isRequesting ? 'Requesting...' : isAvailable ? '🤝 Request to Borrow' : 'Not Available'}
          </button>
        )}
      </div>
    </article>
  );
}

function shortenAgentKey(key: Uint8Array): string {
  const hex = Array.from(key.slice(0, 4))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `Neighbor #${hex.toUpperCase()}`;
}

function formatTimestamp(timestamp: number): string {
  const date = new Date(timestamp / 1000);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  if (diff < 86400000) {
    return 'today';
  }
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000);
    return `${days}d ago`;
  }
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}
