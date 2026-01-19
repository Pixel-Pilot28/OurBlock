import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, act, waitFor } from '@testing-library/react';
import { useRateLimit, useDebounce, useThrottle } from '../useRateLimit';

describe('useRateLimit', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('should allow calls within limit', () => {
    const { result } = renderHook(() => useRateLimit(3, 1000));

    expect(result.current.canCall()).toBe(true);
    
    act(() => {
      result.current.attemptCall();
    });
    
    expect(result.current.remaining()).toBe(2);
  });

  it('should block calls exceeding limit', () => {
    const { result } = renderHook(() => useRateLimit(2, 1000));

    act(() => {
      result.current.attemptCall();
      result.current.attemptCall();
    });

    expect(result.current.canCall()).toBe(false);
    expect(result.current.remaining()).toBe(0);
  });

  it('should allow calls after time window expires', async () => {
    const { result } = renderHook(() => useRateLimit(1, 1000));

    act(() => {
      result.current.attemptCall();
    });

    expect(result.current.canCall()).toBe(false);

    act(() => {
      vi.advanceTimersByTime(1100);
    });

    await waitFor(() => {
      expect(result.current.canCall()).toBe(true);
    });
  });

  it('should reset limit when reset is called', () => {
    const { result } = renderHook(() => useRateLimit(1, 1000));

    act(() => {
      result.current.attemptCall();
    });

    expect(result.current.canCall()).toBe(false);

    act(() => {
      result.current.reset();
    });

    expect(result.current.canCall()).toBe(true);
  });
});

describe('useDebounce', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('should return initial value immediately', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebounce(callback, 300));
    result.current('test');
    expect(callback).not.toHaveBeenCalled();
  });

  it('should debounce value changes', async () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebounce(callback, 300));

    result.current('initial');
    expect(callback).not.toHaveBeenCalled();

    result.current('updated');
    expect(callback).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(300);
    });

    await waitFor(() => {
      expect(callback).toHaveBeenCalledWith('updated');
    });
  });

  it('should cancel debounce on rapid changes', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useDebounce(callback, 300));

    result.current('a');
    result.current('b');
    
    act(() => {
      vi.advanceTimersByTime(100);
    });
    
    result.current('c');
    
    act(() => {
      vi.advanceTimersByTime(200);
    });

    expect(callback).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(100);
    });

    expect(callback).toHaveBeenCalledWith('c');
  });
});

describe('useThrottle', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  it('should return initial value immediately', () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useThrottle(callback, 1000));
    result.current('test');
    expect(callback).toHaveBeenCalledWith('test');
  });

  it('should throttle value updates', async () => {
    const callback = vi.fn();
    const { result } = renderHook(() => useThrottle(callback, 1000));

    result.current('initial');
    expect(callback).toHaveBeenCalledWith('initial');

    result.current('updated1');
    result.current('updated2');
    expect(callback).toHaveBeenCalledTimes(1); // Throttled

    act(() => {
      vi.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(callback).toHaveBeenCalledWith('updated2');
    });
  });
});
