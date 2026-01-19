import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { renderHook, act } from '@testing-library/react';
import { useRateLimit, useDebounce, useThrottle } from './useRateLimit';

describe('useRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should allow calls within limit', () => {
    const { result } = renderHook(() => useRateLimit(5, 60000));

    expect(result.current.canCall()).toBe(true);
    
    act(() => {
      result.current.attemptCall();
    });

    expect(result.current.remaining()).toBe(4);
  });

  it('should block calls after limit reached', () => {
    const { result } = renderHook(() => useRateLimit(2, 60000));

    // First call - should succeed
    act(() => {
      const success = result.current.attemptCall();
      expect(success).toBe(true);
    });

    // Second call - should succeed
    act(() => {
      const success = result.current.attemptCall();
      expect(success).toBe(true);
    });

    // Third call - should fail
    act(() => {
      const success = result.current.attemptCall();
      expect(success).toBe(false);
    });

    expect(result.current.remaining()).toBe(0);
  });

  it('should reset after time window', () => {
    const { result } = renderHook(() => useRateLimit(2, 1000));

    // Use up the limit
    act(() => {
      result.current.attemptCall();
      result.current.attemptCall();
    });

    expect(result.current.canCall()).toBe(false);

    // Fast forward time
    act(() => {
      vi.advanceTimersByTime(1100);
    });

    expect(result.current.canCall()).toBe(true);
  });

  it('should calculate nextAvailableIn correctly', () => {
    const { result } = renderHook(() => useRateLimit(1, 60000));

    act(() => {
      result.current.attemptCall();
    });

    const nextAvailable = result.current.nextAvailableIn();
    expect(nextAvailable).toBeGreaterThan(59000);
    expect(nextAvailable).toBeLessThanOrEqual(60000);
  });

  it('should allow manual reset', () => {
    const { result } = renderHook(() => useRateLimit(1, 60000));

    act(() => {
      result.current.attemptCall();
    });

    expect(result.current.canCall()).toBe(false);

    act(() => {
      result.current.reset();
    });

    expect(result.current.canCall()).toBe(true);
    expect(result.current.remaining()).toBe(1);
  });
});

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should debounce value changes', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebounce(callback, 300));

    result.current('initial');
    expect(callback).not.toHaveBeenCalled();

    // Change value
    result.current('changed');

    // Callback should not fire yet
    expect(callback).not.toHaveBeenCalled();

    // Fast forward time
    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Now callback should be invoked with latest value
    expect(callback).toHaveBeenCalledWith('changed');
  });

  it('should cancel previous debounce on rapid changes', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebounce(callback, 300));

    result.current('first');
    
    act(() => {
      vi.advanceTimersByTime(100);
    });

    result.current('second');

    act(() => {
      vi.advanceTimersByTime(300);
    });

    // Should have the latest value, not 'first'
    expect(callback).toHaveBeenCalledWith('second');
  });
});

describe('useThrottle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should throttle value changes', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useThrottle(callback, 1000));

    result.current('initial');
    expect(callback).toHaveBeenCalledWith('initial');

    // Change value
    result.current('changed');

    // Should still be throttled
    expect(callback).toHaveBeenCalledTimes(1);

    // Change again quickly
    result.current('changed-again');

    // Still throttled
    expect(callback).toHaveBeenCalledTimes(1);

    // Fast forward past throttle time
    act(() => {
      vi.advanceTimersByTime(1100);
    });

    // Change value again
    result.current('final');

    // Should update now
    expect(callback).toHaveBeenCalledWith('final');
  });
});
