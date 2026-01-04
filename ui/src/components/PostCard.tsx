import { useState, useEffect } from 'react';
import { useHolochain } from '../contexts/HolochainContext';
import type { PostOutput, Profile } from '../types';
import './PostCard.css';

interface Props {
  post: PostOutput;
}

export function PostCard({ post }: Props) {
  const { client } = useHolochain();
  const { title, content, author, created_at } = post.post;
  const [authorProfile, setAuthorProfile] = useState<Profile | null>(null);

  // Fetch the author's profile
  useEffect(() => {
    async function fetchAuthorProfile() {
      if (!client) return;

      try {
        const result = await client.callZome({
          role_name: 'our_block',
          zome_name: 'profile',
          fn_name: 'get_agent_profile',
          payload: author,
        });
        
        if (result) {
          setAuthorProfile(result.profile);
        }
      } catch (err) {
        // Profile might not exist, that's ok
        console.debug('Could not fetch profile for author:', err);
      }
    }

    fetchAuthorProfile();
  }, [client, author]);

  const displayName = authorProfile?.nickname || shortenAgentKey(author);
  const avatarInitial = authorProfile?.nickname 
    ? authorProfile.nickname.charAt(0).toUpperCase()
    : getAuthorInitial(author);

  return (
    <article className="post-card">
      <header className="post-header">
        <div className="post-author">
          <div className="author-avatar">
            {avatarInitial}
          </div>
          <div className="author-info">
            <span className="author-name">{displayName}</span>
            <time className="post-time">{formatTimestamp(created_at)}</time>
          </div>
        </div>
      </header>

      <div className="post-content">
        <h3 className="post-title">{title}</h3>
        <p className="post-body">{content}</p>
      </div>

      <footer className="post-footer">
        <div className="post-actions">
          <button className="action-btn" title="React">
            👍
          </button>
          <button className="action-btn" title="Comment">
            💬
          </button>
          <button className="action-btn" title="Share">
            🔗
          </button>
        </div>
      </footer>
    </article>
  );
}

// Helper functions
function getAuthorInitial(author: Uint8Array): string {
  // Use the first byte of the key to generate a consistent initial
  const byte = author[0] || 0;
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  return letters[byte % letters.length];
}

function shortenAgentKey(key: Uint8Array): string {
  const hex = Array.from(key.slice(0, 4))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
  return `Neighbor #${hex.toUpperCase()}`;
}

function formatTimestamp(timestamp: number): string {
  // Holochain timestamps are in microseconds
  const date = new Date(timestamp / 1000);
  const now = new Date();
  const diff = now.getTime() - date.getTime();

  // Less than a minute
  if (diff < 60000) {
    return 'Just now';
  }

  // Less than an hour
  if (diff < 3600000) {
    const minutes = Math.floor(diff / 60000);
    return `${minutes}m ago`;
  }

  // Less than a day
  if (diff < 86400000) {
    const hours = Math.floor(diff / 3600000);
    return `${hours}h ago`;
  }

  // Less than a week
  if (diff < 604800000) {
    const days = Math.floor(diff / 86400000);
    return `${days}d ago`;
  }

  // Otherwise, show the date
  return date.toLocaleDateString(undefined, {
    month: 'short',
    day: 'numeric',
  });
}
