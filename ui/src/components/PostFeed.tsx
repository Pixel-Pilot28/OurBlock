import { useState, useEffect, useCallback } from 'react';
import { useHolochain } from '../contexts/HolochainContext';
import { CreatePostForm } from './CreatePostForm';
import { PostCard } from './PostCard';
import type { PostOutput } from '../types';
import './PostFeed.css';

// Polling interval in milliseconds (30 seconds)
const POLL_INTERVAL = 30000;

export function PostFeed() {
  const { client, isConnected } = useHolochain();
  const [posts, setPosts] = useState<PostOutput[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);

  // Fetch all posts from the DHT
  const fetchPosts = useCallback(async () => {
    if (!client) return;

    try {
      const result = await client.callZome({
        role_name: 'our_block',
        zome_name: 'feed',
        fn_name: 'get_all_posts',
        payload: null,
      });

      setPosts(result);
      setLastUpdated(new Date());
      setError(null);
    } catch (err) {
      console.error('Failed to fetch posts:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch posts');
    } finally {
      setIsLoading(false);
    }
  }, [client]);

  // Initial fetch on mount
  useEffect(() => {
    if (isConnected) {
      fetchPosts();
    }
  }, [isConnected, fetchPosts]);

  // Set up polling for real-time updates
  useEffect(() => {
    if (!isConnected) return;

    const intervalId = setInterval(() => {
      fetchPosts();
    }, POLL_INTERVAL);

    return () => clearInterval(intervalId);
  }, [isConnected, fetchPosts]);

  // Handle new post creation
  const handlePostCreated = (newPost: PostOutput) => {
    // Add the new post to the top of the feed
    setPosts((prevPosts) => [newPost, ...prevPosts]);
  };

  // Manual refresh
  const handleRefresh = () => {
    setIsLoading(true);
    fetchPosts();
  };

  if (!isConnected) {
    return (
      <div className="post-feed">
        <div className="feed-loading">
          <p>Connecting to your neighborhood...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="post-feed">
      <header className="feed-header">
        <div className="feed-title">
          <h2>🏘️ Common Ground</h2>
          <p className="feed-subtitle">What's happening in the neighborhood</p>
        </div>
        <div className="feed-actions">
          <button 
            className="refresh-btn" 
            onClick={handleRefresh}
            disabled={isLoading}
            title="Refresh feed"
          >
            🔄
          </button>
          {lastUpdated && (
            <span className="last-updated">
              Updated {formatTimeAgo(lastUpdated)}
            </span>
          )}
        </div>
      </header>

      <CreatePostForm onPostCreated={handlePostCreated} />

      {error && (
        <div className="feed-error">
          <p>⚠️ {error}</p>
          <button onClick={handleRefresh}>Try Again</button>
        </div>
      )}

      {isLoading && posts.length === 0 ? (
        <div className="feed-loading">
          <div className="loading-spinner"></div>
          <p>Loading posts from the neighborhood...</p>
        </div>
      ) : posts.length === 0 ? (
        <div className="feed-empty">
          <div className="empty-icon">📭</div>
          <h3>No posts yet</h3>
          <p>Be the first to share something with your neighbors!</p>
        </div>
      ) : (
        <div className="posts-grid">
          {posts.map((post, index) => (
            <PostCard 
              key={`${arrayToHex(post.action_hash)}-${index}`} 
              post={post} 
            />
          ))}
        </div>
      )}

      <div className="feed-footer">
        <p className="polling-indicator">
          ✨ Auto-refreshing every 30 seconds
        </p>
      </div>
    </div>
  );
}

// Helper to format time ago
function formatTimeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);

  if (seconds < 60) return 'just now';
  if (seconds < 3600) return `${Math.floor(seconds / 60)}m ago`;
  if (seconds < 86400) return `${Math.floor(seconds / 3600)}h ago`;
  return `${Math.floor(seconds / 86400)}d ago`;
}

// Helper to convert Uint8Array to hex string for keys
function arrayToHex(arr: Uint8Array): string {
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
