import { useState } from 'react';
import './CommunitySwitcher.css';

interface Community {
  id: string;
  name: string;
  emoji: string;
  memberCount: number;
  description: string;
}

interface CommunitySwitcherProps {
  isOpen: boolean;
  onClose: () => void;
  currentCommunity: Community;
  onCommunityChange: (community: Community) => void;
}

// Mock communities - in production this would come from Holochain
const MOCK_COMMUNITIES: Community[] = [
  {
    id: '1',
    name: 'Maple Street',
    emoji: '🏘️',
    memberCount: 24,
    description: 'Your neighborhood community',
  },
  {
    id: '2',
    name: 'Oak Park District',
    emoji: '🌳',
    memberCount: 156,
    description: 'Local district hub',
  },
  {
    id: '3',
    name: 'Downtown Collective',
    emoji: '🏙️',
    memberCount: 89,
    description: 'Urban community network',
  },
  {
    id: '4',
    name: 'Riverside Neighbors',
    emoji: '🌊',
    memberCount: 42,
    description: 'Waterfront community',
  },
];

export function CommunitySwitcher({ isOpen, onClose, currentCommunity, onCommunityChange }: CommunitySwitcherProps) {
  const [communities] = useState<Community[]>(MOCK_COMMUNITIES);

  const handleCommunitySelect = (community: Community) => {
    onCommunityChange(community);
    onClose();
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <>
      {/* Backdrop */}
      <div 
        className={`community-switcher-backdrop ${isOpen ? 'open' : ''}`}
        onClick={handleBackdropClick}
      />
      
      {/* Side Panel */}
      <aside className={`community-switcher ${isOpen ? 'open' : ''}`}>
        <div className="community-switcher-header">
          <h2>Your Communities</h2>
          <button 
            className="close-btn"
            onClick={onClose}
            aria-label="Close community switcher"
          >
            ✕
          </button>
        </div>

        <div className="community-list">
          {communities.map((community) => (
            <button
              key={community.id}
              className={`community-card ${community.id === currentCommunity.id ? 'active' : ''}`}
              onClick={() => handleCommunitySelect(community)}
            >
              <div className="community-emoji">{community.emoji}</div>
              <div className="community-info">
                <h3>{community.name}</h3>
                <p className="community-description">{community.description}</p>
                <p className="community-members">{community.memberCount} members</p>
              </div>
              {community.id === currentCommunity.id && (
                <div className="active-indicator">✓</div>
              )}
            </button>
          ))}
        </div>

        <div className="community-switcher-footer">
          <button className="create-community-btn">
            <span className="plus-icon">+</span>
            Join or Create Community
          </button>
        </div>
      </aside>
    </>
  );
}

export { MOCK_COMMUNITIES };
export type { Community };
