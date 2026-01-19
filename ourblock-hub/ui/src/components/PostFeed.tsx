import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useHolochain } from '../contexts/HolochainContext';
import { CreatePostForm } from './CreatePostForm';
import { PostCard } from './PostCard';
import { queryKeys } from '../utils/queryClient';
import type { PostOutput } from '../types';
import { AppSignal } from '@holochain/client';
import { logger } from '../utils/logger';
import './PostFeed.css';

export function PostFeed() {
  const { client, isConnected, onSignal } = useHolochain();
  const queryClient = useQueryClient();
  const [error] = useState<string | null>(null);

  // Use React Query for posts - reads from IndexedDB cache first
  const {
    data: posts = [],
    isLoading,
    refetch,
  } = useQuery({
    queryKey: queryKeys.posts.all,
    queryFn: async () => {
      if (!client) throw new Error('Client not connected');
      
      const result = await client.callZome({
        role_name: 'our_block',
        zome_name: 'feed',
        fn_name: 'get_all_posts',
        payload: null,
      });
      
      return result as PostOutput[];
    },
    enabled: isConnected && !!client,
    // Keep cached data for 5 minutes
    staleTime: 1000 * 60 * 5,
  });

  // Listen for real-time signals to invalidate cache
  useEffect(() => {
    if (!isConnected) return;

    const unsubscribe = onSignal((signal: AppSignal) => {
      // Check if this is a feed signal
      if (signal.zome_name === 'feed') {
        const payload = signal.payload;
        
        if (payload && typeof payload === 'object' && 'type' in payload) {
          const signalType = (payload as { type: string }).type;
          
          if (signalType === 'NewPost' || signalType === 'NewReaction' || signalType === 'NewComment') {
            logger.debug('Feed signal received, invalidating cache', { signalType });
            // Invalidate the query cache to trigger a background refetch
            queryClient.invalidateQueries({ queryKey: queryKeys.posts.all });
          }
        }
      }
    });

    return unsubscribe;
  }, [isConnected, onSignal, queryClient]);

  // Handle new post creation with optimistic updates
  const handlePostCreated = (newPost: PostOutput) => {
    // Optimistically add to cache
    queryClient.setQueryData(queryKeys.posts.all, (old: PostOutput[] = []) => [newPost, ...old]);
    // Trigger background refetch to sync with DHT
    queryClient.invalidateQueries({ queryKey: queryKeys.posts.all });
  };

  // Manual refresh
  const handleRefresh = () => {
    refetch();
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
          {isLoading && (
            <span className="loading-indicator">
              Syncing...
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
          {isLoading ? '🔄 Syncing with DHT...' : '✨ Cached data, syncing in background'}
        </p>
      </div>
    </div>
  );
}

// Helper to convert Uint8Array to hex string for keys
function arrayToHex(arr: Uint8Array): string {
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('');
}
