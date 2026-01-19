/**
 * React Hooks for Rate Limiting and Debouncing
 * 
 * Prevents spam by limiting how often functions can be called.
 * Essential for form submissions, API calls, and user interactions.
 */

import { useCallback, useRef, useState } from 'react';

/**
 * useDebounce - Delays function execution until after a period of inactivity
 * 
 * Use for: Search inputs, autosave, resize handlers
 * 
 * @param callback - Function to debounce
 * @param delay - Milliseconds to wait (default: 300ms)
 * @returns Debounced function
 * 
 * @example
 * const debouncedSearch = useDebounce((query: string) => {
 *   fetchResults(query);
 * }, 500);
 */
export function useDebounce<T extends (...args: any[]) => any>(
  callback: T,
  delay: number = 300
): (...args: Parameters<T>) => void {
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  return useCallback(
    (...args: Parameters<T>) => {
      if (timeoutRef.current) {
        clearTimeout(timeoutRef.current);
      }

      timeoutRef.current = setTimeout(() => {
        callback(...args);
      }, delay);
    },
    [callback, delay]
  );
}

/**
 * useThrottle - Limits function execution to once per time period
 * 
 * Use for: Scroll handlers, button clicks, API calls
 * 
 * @param callback - Function to throttle
 * @param limit - Minimum milliseconds between calls (default: 1000ms)
 * @returns Throttled function
 * 
 * @example
 * const throttledSubmit = useThrottle(handleSubmit, 2000);
 */
export function useThrottle<T extends (...args: any[]) => any>(
  callback: T,
  limit: number = 1000
): (...args: Parameters<T>) => void {
  const lastRunRef = useRef<number>(0);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();

  return useCallback(
    (...args: Parameters<T>) => {
      const now = Date.now();
      const timeSinceLastRun = now - lastRunRef.current;

      if (timeSinceLastRun >= limit) {
        // Execute immediately if enough time has passed
        callback(...args);
        lastRunRef.current = now;
      } else {
        // Schedule for later if still in cooldown
        if (timeoutRef.current) {
          clearTimeout(timeoutRef.current);
        }

        const remaining = limit - timeSinceLastRun;
        timeoutRef.current = setTimeout(() => {
          callback(...args);
          lastRunRef.current = Date.now();
        }, remaining);
      }
    },
    [callback, limit]
  );
}

/**
 * useRateLimit - Prevents function calls exceeding a maximum count per time window
 * 
 * Use for: API rate limiting, preventing abuse
 * 
 * @param maxCalls - Maximum calls allowed per window
 * @param windowMs - Time window in milliseconds (default: 60000ms = 1 minute)
 * @returns Object with { canCall, attemptCall, remaining, reset }
 * 
 * @example
 * const rateLimit = useRateLimit(5, 60000); // 5 calls per minute
 * 
 * if (rateLimit.canCall()) {
 *   rateLimit.attemptCall();
 *   await submitForm();
 * } else {
 *   alert(`Rate limit exceeded. ${rateLimit.remaining()} calls remaining.`);
 * }
 */
export function useRateLimit(maxCalls: number, windowMs: number = 60000) {
  const [callTimestamps, setCallTimestamps] = useState<number[]>([]);

  const cleanOldCalls = useCallback(() => {
    const now = Date.now();
    return callTimestamps.filter((timestamp) => now - timestamp < windowMs);
  }, [callTimestamps, windowMs]);

  const canCall = useCallback((): boolean => {
    const validCalls = cleanOldCalls();
    return validCalls.length < maxCalls;
  }, [cleanOldCalls, maxCalls]);

  const attemptCall = useCallback(() => {
    const validCalls = cleanOldCalls();
    
    if (validCalls.length < maxCalls) {
      setCallTimestamps([...validCalls, Date.now()]);
      return true;
    }
    
    return false;
  }, [cleanOldCalls, maxCalls]);

  const remaining = useCallback((): number => {
    const validCalls = cleanOldCalls();
    return Math.max(0, maxCalls - validCalls.length);
  }, [cleanOldCalls, maxCalls]);

  const reset = useCallback(() => {
    setCallTimestamps([]);
  }, []);

  const nextAvailableIn = useCallback((): number => {
    const validCalls = cleanOldCalls();
    
    if (validCalls.length < maxCalls) {
      return 0;
    }
    
    const oldestCall = Math.min(...validCalls);
    const nextAvailable = oldestCall + windowMs;
    return Math.max(0, nextAvailable - Date.now());
  }, [cleanOldCalls, maxCalls, windowMs]);

  return {
    canCall,
    attemptCall,
    remaining,
    reset,
    nextAvailableIn,
  };
}

/**
 * useAsyncDebounce - Debounce for async functions with loading state
 * 
 * Use for: Async search, form validation with API calls
 * 
 * @param asyncCallback - Async function to debounce
 * @param delay - Milliseconds to wait (default: 300ms)
 * @returns Object with { execute, isLoading, cancel }
 * 
 * @example
 * const search = useAsyncDebounce(async (query: string) => {
 *   return await fetchResults(query);
 * }, 500);
 * 
 * search.execute('hello'); // Debounced API call
 * if (search.isLoading) { ... }
 */
export function useAsyncDebounce<T extends (...args: any[]) => Promise<any>>(
  asyncCallback: T,
  delay: number = 300
) {
  const [isLoading, setIsLoading] = useState(false);
  const timeoutRef = useRef<ReturnType<typeof setTimeout>>();
  const abortControllerRef = useRef<AbortController>();

  const cancel = useCallback(() => {
    if (timeoutRef.current) {
      clearTimeout(timeoutRef.current);
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    setIsLoading(false);
  }, []);

  const execute = useCallback(
    async (...args: Parameters<T>): Promise<ReturnType<T> | undefined> => {
      cancel();

      return new Promise((resolve, reject) => {
        timeoutRef.current = setTimeout(async () => {
          setIsLoading(true);
          abortControllerRef.current = new AbortController();

          try {
            const result = await asyncCallback(...args);
            setIsLoading(false);
            resolve(result);
          } catch (error) {
            setIsLoading(false);
            reject(error);
          }
        }, delay);
      });
    },
    [asyncCallback, delay, cancel]
  );

  return {
    execute,
    isLoading,
    cancel,
  };
}
