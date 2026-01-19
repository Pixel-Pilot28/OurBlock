import * as Sentry from '@sentry/react';

/**
 * Initialize Sentry error tracking
 * Only enabled in production builds
 */
export function initSentry(): void {
  // Only initialize in production
  if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
    Sentry.init({
      dsn: import.meta.env.VITE_SENTRY_DSN,
      
      // Set tracesSampleRate to 1.0 to capture 100% of transactions for performance monitoring.
      // Recommend adjusting this value in production
      tracesSampleRate: import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE 
        ? parseFloat(import.meta.env.VITE_SENTRY_TRACES_SAMPLE_RATE) 
        : 0.1,
      
      // Capture Replay for 10% of all sessions,
      // plus for 100% of sessions with an error
      replaysSessionSampleRate: 0.1,
      replaysOnErrorSampleRate: 1.0,
      
      integrations: [
        Sentry.browserTracingIntegration(),
        Sentry.replayIntegration({
          maskAllText: true,
          blockAllMedia: true,
        }),
      ],
      
      // Environment
      environment: import.meta.env.MODE,
      
      // Release version
      release: import.meta.env.VITE_APP_VERSION || '0.1.0',
      
      // Filter out known errors
        beforeSend(event: Sentry.ErrorEvent, _hint: Sentry.EventHint) {
        // Don't send events for development WebSocket connection errors
        if (event.message?.includes('WebSocket')) {
          return null;
        }
        
        // Don't send Holochain source chain errors (expected)
        if (event.message?.includes('source chain head has moved')) {
          return null;
        }
        
        return event;
      },
    });
  }
}

/**
 * Log error to Sentry
 */
export function logError(error: Error, context?: Record<string, any>): void {
  if (import.meta.env.PROD) {
    Sentry.captureException(error, {
      extra: context,
    });
  } else {
    console.error('Error:', error, context);
  }
}

/**
 * Set user context for error tracking
 */
export function setUserContext(agentKey: string): void {
  if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
    Sentry.setUser({
      id: agentKey,
    });
  }
}

/**
 * Clear user context (on logout)
 */
export function clearUserContext(): void {
  if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
    Sentry.setUser(null);
  }
}

/**
 * Add breadcrumb for debugging
 */
export function addBreadcrumb(message: string, data?: Record<string, any>): void {
  if (import.meta.env.PROD && import.meta.env.VITE_SENTRY_DSN) {
    Sentry.addBreadcrumb({
      message,
      data,
      level: 'info',
    });
  }
}
