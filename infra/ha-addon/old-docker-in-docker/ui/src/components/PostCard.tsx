import { useState, useEffect } from 'react';
import { useHolochain } from '../contexts/HolochainContext';
import type { PostOutput, Profile } from '../types';
import './PostCard.css';

interface Props {
  post: PostOutput;
}

interface PostReactions {
  likes: number;
  userLiked: boolean;
  comments: number;
  shares: number;
}

export function PostCard({ post }: Props) {
  const { client, agentKey } = useHolochain();
  const { title, content, author, created_at } = post.post;
  const [authorProfile, setAuthorProfile] = useState<Profile | null>(null);
  const [reactions, setReactions] = useState<PostReactions>({
    likes: 0,
    userLiked: false,
    comments: 0,
    shares: 0,
  });
  const [showComments, setShowComments] = useState(false);

  const postId = arrayToHex(post.action_hash);
  const [myReactionHash, setMyReactionHash] = useState<Uint8Array | null>(null);

  // Load reactions and comments from backend
  useEffect(() => {
    async function fetchReactions() {
      if (!client) return;

      try {
        // Get all reactions for this post
        const reactionsResult = await client.callZome({
          role_name: 'our_block',
          zome_name: 'feed',
          fn_name: 'get_post_reactions',
          payload: post.action_hash,
        });

        const likes = reactionsResult.filter((r: any) => r.reaction.reaction_type === 'like').length;
        
        // Check if current user liked
        let userLiked = false;
        let userReactionHash = null;
        if (agentKey) {
          const userKeyHex = arrayToHex(agentKey);
          for (const reaction of reactionsResult) {
            if (arrayToHex(reaction.reaction.author) === userKeyHex && reaction.reaction.reaction_type === 'like') {
              userLiked = true;
              userReactionHash = reaction.action_hash;
              break;
            }
          }
        }

        setMyReactionHash(userReactionHash);
        setReactions(prev => ({ ...prev, likes, userLiked }));
      } catch (err) {
        console.debug('Could not fetch reactions:', err);
      }

      try {
        // Get all comments for this post
        const commentsResult = await client.callZome({
          role_name: 'our_block',
          zome_name: 'feed',
          fn_name: 'get_post_comments',
          payload: post.action_hash,
        });

        setReactions(prev => ({ ...prev, comments: commentsResult.length }));
      } catch (err) {
        console.debug('Could not fetch comments:', err);
      }
    }

    fetchReactions();
  }, [client, post.action_hash, agentKey]);

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

  // Handle like/unlike
  const handleLike = async () => {
    if (!client || !agentKey) return;

    const newLiked = !reactions.userLiked;

    try {
      if (newLiked) {
        // Add reaction
        const result = await client.callZome({
          role_name: 'our_block',
          zome_name: 'feed',
          fn_name: 'add_reaction',
          payload: {
            post_hash: post.action_hash,
            reaction_type: 'like',
          },
        });
        setMyReactionHash(result.action_hash);
        setReactions(prev => ({ ...prev, userLiked: true, likes: prev.likes + 1 }));
      } else {
        // Remove reaction
        if (myReactionHash) {
          await client.callZome({
            role_name: 'our_block',
            zome_name: 'feed',
            fn_name: 'remove_reaction',
            payload: myReactionHash,
          });
          setMyReactionHash(null);
          setReactions(prev => ({ ...prev, userLiked: false, likes: prev.likes - 1 }));
        }
      }
    } catch (err) {
      console.error('Failed to toggle reaction:', err);
    }
  };

  // Handle comment toggle
  const handleComment = () => {
    setShowComments(!showComments);
  };

  // Handle share (copy link to clipboard)
  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/post/${postId}`;
    
    try {
      await navigator.clipboard.writeText(shareUrl);
      alert('Link copied to clipboard!');
    } catch (err) {
      console.error('Failed to copy link:', err);
    }
  };

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
          <button 
            className={`action-btn ${reactions.userLiked ? 'active' : ''}`}
            onClick={handleLike}
            title={reactions.userLiked ? 'Unlike' : 'Like'}
          >
            {reactions.userLiked ? '👍' : '👍'}
            {reactions.likes > 0 && <span className="count">{reactions.likes}</span>}
          </button>
          <button 
            className={`action-btn ${showComments ? 'active' : ''}`}
            onClick={handleComment}
            title="Comment"
          >
            💬
            {reactions.comments > 0 && <span className="count">{reactions.comments}</span>}
          </button>
          <button 
            className="action-btn" 
            onClick={handleShare}
            title="Copy link"
          >
            🔗
            {reactions.shares > 0 && <span className="count">{reactions.shares}</span>}
          </button>
        </div>

        {showComments && (
          <div className="comments-section">
            <p className="comments-placeholder">💬 Comments coming soon! Backend support needed.</p>
          </div>
        )}
      </footer>
    </article>
  );
}

// Helper functions
function arrayToHex(arr: Uint8Array): string {
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}

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
