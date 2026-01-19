/**
 * Query Client Configuration
 * 
 * Sets up TanStack Query (react-query) with IndexedDB persistence
 * for offline-first data access.
 * 
 * Features:
 * - Offline-first: Read from cache instantly, sync in background
 * - IndexedDB persistence: Survives page refreshes and app restarts
 * - Stale-while-revalidate: Show cached data, fetch fresh in background
 * - Automatic garbage collection: Remove old queries after 7 days
 * - Optimistic updates: Update UI immediately, sync later
 */

import { QueryClient } from '@tanstack/react-query';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { get, set, del } from 'idb-keyval';
import { logger } from './logger';

/**
 * Custom IndexedDB storage adapter for react-query persistence
 */
function createIDBPersister() {
  return {
    persistClient: async (client: any) => {
      try {
        await set('react-query-offline-cache', client);
      } catch (error) {
        logger.error('Failed to persist query client', error);
      }
    },
    restoreClient: async () => {
      try {
        return await get('react-query-offline-cache');
      } catch (error) {
        logger.error('Failed to restore query client', error);
        return undefined;
      }
    },
    removeClient: async () => {
      try {
        await del('react-query-offline-cache');
      } catch (error) {
        logger.error('Failed to remove query client', error);
      }
    },
  };
}

/**
 * Query client with optimized defaults for OurBlock
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Offline-first configuration
      staleTime: 1000 * 60 * 5, // 5 minutes - data is fresh for 5 min
      gcTime: 1000 * 60 * 60 * 24 * 7, // 7 days - keep in cache for 7 days
      
      // Network behavior
      refetchOnWindowFocus: true, // Refresh when user returns to tab
      refetchOnReconnect: true, // Refresh when internet reconnects
      refetchOnMount: false, // Don't refetch if data is fresh
      
      // Retry configuration
      retry: 3, // Retry failed requests 3 times
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      
      // Suspense and error handling
      throwOnError: false,
      
      // Placeholder data while loading
      placeholderData: (previousData: unknown) => previousData,
    },
    mutations: {
      // Retry failed mutations
      retry: 2,
      retryDelay: 1000,
    },
  },
});

/**
 * Persister for IndexedDB storage
 */
export const persister = createIDBPersister();

/**
 * Persistence configuration
 */
export const persistOptions = {
  persister,
  maxAge: 1000 * 60 * 60 * 24 * 7, // 7 days
  buster: 'v1', // Increment to invalidate all cached data
  dehydrateOptions: {
    shouldDehydrateQuery: (query: any) => {
      // Only persist successful queries
      return query.state.status === 'success';
    },
  },
};

/**
 * Query keys for consistent caching
 */
export const queryKeys = {
  // Posts
  posts: {
    all: ['posts'] as const,
    list: (filters?: any) => ['posts', 'list', filters] as const,
    detail: (id: string) => ['posts', 'detail', id] as const,
    latest: (limit: number) => ['posts', 'latest', limit] as const,
  },
  
  // Events
  events: {
    all: ['events'] as const,
    list: (filters?: any) => ['events', 'list', filters] as const,
    detail: (id: string) => ['events', 'detail', id] as const,
    upcoming: () => ['events', 'upcoming'] as const,
  },
  
  // Messages
  messages: {
    all: ['messages'] as const,
    conversations: () => ['messages', 'conversations'] as const,
    conversation: (agent: string) => ['messages', 'conversation', agent] as const,
    unread: () => ['messages', 'unread'] as const,
  },
  
  // Profiles
  profiles: {
    all: ['profiles'] as const,
    me: () => ['profiles', 'me'] as const,
    detail: (agent: string) => ['profiles', 'detail', agent] as const,
    list: () => ['profiles', 'list'] as const,
  },
  
  // Shared Spaces
  spaces: {
    all: ['spaces'] as const,
    list: () => ['spaces', 'list'] as const,
    detail: (id: string) => ['spaces', 'detail', id] as const,
    files: (spaceId: string) => ['spaces', 'files', spaceId] as const,
  },
};

/**
 * Invalidate all queries (use after sync)
 */
export function invalidateAll() {
  queryClient.invalidateQueries();
  logger.info('All queries invalidated - refetching fresh data');
}

/**
 * Clear all cached data (use sparingly - user will lose offline access)
 */
export async function clearAllCache() {
  await queryClient.clear();
  logger.info('All cached data cleared');
}

/**
 * Prefetch data for offline use
 */
export async function prefetchForOffline(client: any) {
  logger.info('Prefetching data for offline use...');
  
  try {
    // Prefetch latest posts
    await queryClient.prefetchQuery({
      queryKey: queryKeys.posts.latest(50),
      queryFn: async () => {
        const result = await client.callZome({
          role_name: 'our_block',
          zome_name: 'posts',
          fn_name: 'get_latest_posts',
          payload: { limit: 50 },
        });
        return result;
      },
    });
    
    // Prefetch upcoming events
    await queryClient.prefetchQuery({
      queryKey: queryKeys.events.upcoming(),
      queryFn: async () => {
        const result = await client.callZome({
          role_name: 'our_block',
          zome_name: 'events',
          fn_name: 'get_upcoming_events',
          payload: null,
        });
        return result;
      },
    });
    
    // Prefetch unread messages
    await queryClient.prefetchQuery({
      queryKey: queryKeys.messages.unread(),
      queryFn: async () => {
        const result = await client.callZome({
          role_name: 'our_block',
          zome_name: 'messaging',
          fn_name: 'get_unread_messages',
          payload: null,
        });
        return result;
      },
    });
    
    logger.info('Offline prefetch completed');
  } catch (error) {
    logger.error('Failed to prefetch data', error);
  }
}

export { PersistQueryClientProvider };
