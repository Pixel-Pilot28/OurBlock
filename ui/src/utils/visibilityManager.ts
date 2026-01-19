/**
 * Visibility Manager
 * 
 * Tracks app foreground/background state for battery optimization.
 * Uses Page Visibility API (web) and provides hooks for React Native.
 * 
 * Features:
 * - Debounced background detection (30s delay before pausing)
 * - Immediate foreground wake-up
 * - Battery-saving conductor pause in background
 * - Listeners for state change events
 */

import { logger } from './logger';

export type VisibilityState = 'foreground' | 'background' | 'transitioning';

export interface VisibilityChangeEvent {
  state: VisibilityState;
  timestamp: number;
  previousState: VisibilityState;
}

type VisibilityListener = (event: VisibilityChangeEvent) => void;

class VisibilityManager {
  private currentState: VisibilityState = 'foreground';
  private listeners: Set<VisibilityListener> = new Set();
  private backgroundTimer: NodeJS.Timeout | null = null;
  private readonly BACKGROUND_DELAY_MS = 30000; // 30 seconds

  constructor() {
    this.init();
  }

  /**
   * Start visibility monitoring (called automatically in constructor)
   */
  public start(): void {
    // Already initialized in constructor, this is a no-op for compatibility
    logger.debug('Visibility manager start() called');
  }

  /**
   * Stop visibility monitoring
   */
  public stop(): void {
    // Clear any pending timers
    if (this.backgroundTimer) {
      clearTimeout(this.backgroundTimer);
      this.backgroundTimer = null;
    }
    logger.debug('Visibility manager stopped');
  }

  /**
   * Initialize the visibility manager
   */
  private init(): void {
    if (typeof document !== 'undefined') {
      this.initializeWebListeners();
    }
  }

  /**
   * Initialize Page Visibility API listeners (web)
   */
  private initializeWebListeners(): void {
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.handleVisibilityChange('background');
      } else {
        this.handleVisibilityChange('foreground');
      }
    });

    // Also listen for window focus/blur as backup
    window.addEventListener('focus', () => {
      this.handleVisibilityChange('foreground');
    });

    window.addEventListener('blur', () => {
      // Don't immediately mark as background - user might be switching tabs briefly
      // Use visibilitychange as primary signal
    });

    logger.info('Visibility manager initialized for web');
  }

  /**
   * Handle visibility state changes with debouncing for background
   */
  private handleVisibilityChange(newState: VisibilityState): void {
    const previousState = this.currentState;

    if (newState === 'foreground') {
      // Immediate foreground transition - cancel any pending background transition
      if (this.backgroundTimer) {
        clearTimeout(this.backgroundTimer);
        this.backgroundTimer = null;
      }

      this.currentState = 'foreground';
      this.notifyListeners({
        state: 'foreground',
        timestamp: Date.now(),
        previousState,
      });

      logger.info('App entered foreground', { previousState });
    } else if (newState === 'background') {
      // Debounced background transition - wait 30s before marking as background
      if (this.backgroundTimer) {
        return; // Already transitioning to background
      }

      this.currentState = 'transitioning';
      logger.info('App transitioning to background (30s delay)', { previousState });

      this.backgroundTimer = setTimeout(() => {
        this.currentState = 'background';
        this.backgroundTimer = null;

        this.notifyListeners({
          state: 'background',
          timestamp: Date.now(),
          previousState: 'transitioning',
        });

        logger.info('App entered background after delay');
      }, this.BACKGROUND_DELAY_MS);
    }
  }

  /**
   * Notify all registered listeners of state change
   */
  private notifyListeners(event: VisibilityChangeEvent): void {
    this.listeners.forEach((listener) => {
      try {
        listener(event);
      } catch (error) {
        logger.error('Error in visibility listener', error);
      }
    });
  }

  /**
   * Register a listener for visibility changes
   */
  public addListener(listener: VisibilityListener): () => void {
    this.listeners.add(listener);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Get current visibility state
   */
  public getState(): VisibilityState {
    return this.currentState;
  }

  /**
   * Check if app is in foreground
   */
  public isForeground(): boolean {
    return this.currentState === 'foreground';
  }

  /**
   * Check if app is in background
   */
  public isBackground(): boolean {
    return this.currentState === 'background';
  }

  /**
   * Force a state change (for React Native integration)
   */
  public forceStateChange(state: VisibilityState): void {
    const previousState = this.currentState;
    this.currentState = state;

    this.notifyListeners({
      state,
      timestamp: Date.now(),
      previousState,
    });

    logger.info('Visibility state forced', { state, previousState });
  }
}

// Singleton instance
export const visibilityManager = new VisibilityManager();

/**
 * React hook for visibility state
 */
export function useVisibility() {
  const [state, setState] = React.useState<VisibilityState>(
    visibilityManager.getState()
  );

  React.useEffect(() => {
    const unsubscribe = visibilityManager.addListener((event) => {
      setState(event.state);
    });

    return unsubscribe;
  }, []);

  return {
    state,
    isForeground: state === 'foreground',
    isBackground: state === 'background',
    isTransitioning: state === 'transitioning',
  };
}

// React import for hook
import * as React from 'react';
