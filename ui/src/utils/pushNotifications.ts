/**
 * Push Notification Bridge for OurBlock
 * 
 * Integrates with UnifiedPush to enable background message delivery
 * while keeping the conductor paused to save battery.
 * 
 * Flow:
 * 1. User grants notification permission
 * 2. Register with UnifiedPush distributor (e.g., ntfy.sh)
 * 3. Send endpoint to hub via signal
 * 4. Hub forwards DirectMessage signals to push server if recipient offline
 * 5. Push notification wakes app, user can tap to view message
 * 6. On tap, wake conductor and sync messages
 */

import { logger } from './logger';
import { syncManager } from './syncManager';

export interface PushEndpoint {
  endpoint: string;
  distributorName: string;
}

export interface PushNotificationPayload {
  type: 'direct_message' | 'mention' | 'reaction' | 'event';
  title: string;
  body: string;
  icon?: string;
  badge?: number;
  data?: Record<string, unknown>;
}

export class PushNotificationManager {
  private registration: ServiceWorkerRegistration | null = null;
  private endpoint: PushEndpoint | null = null;
  private notificationPermission: NotificationPermission = 'default';

  constructor() {
    this.notificationPermission = 'Notification' in window ? Notification.permission : 'denied';
  }

  /**
   * Initialize push notifications
   * Requests permission and registers with UnifiedPush
   */
  async initialize(): Promise<void> {
    try {
      // Check if notifications are supported
      if (!('Notification' in window)) {
        logger.warn('Push notifications not supported in this browser');
        return;
      }

      // Request notification permission
      if (this.notificationPermission === 'default') {
        this.notificationPermission = await Notification.requestPermission();
      }

      if (this.notificationPermission !== 'granted') {
        logger.info('Notification permission denied');
        return;
      }

      // Register service worker for push
      if ('serviceWorker' in navigator) {
        this.registration = await navigator.serviceWorker.ready;
        logger.info('Service worker ready for push notifications');

        // Listen for push events from service worker
        navigator.serviceWorker.addEventListener('message', this.handleServiceWorkerMessage.bind(this));
      }

      // Register with UnifiedPush
      await this.registerUnifiedPush();

      logger.info('Push notification manager initialized', { endpoint: this.endpoint });
    } catch (err) {
      logger.error('Failed to initialize push notifications', err);
    }
  }

  /**
   * Register with UnifiedPush distributor
   * For now, uses ntfy.sh as default distributor
   */
  private async registerUnifiedPush(): Promise<void> {
    try {
      // Check if UnifiedPush is available
      // Note: This is a placeholder - actual UnifiedPush integration
      // requires a UnifiedPush distributor app installed on the device
      
      // For web, we'll use a simple push.ourblock.community endpoint
      // that forwards notifications via ntfy.sh or similar service
      const pushServerUrl = import.meta.env.VITE_PUSH_SERVER_URL || 'https://push.ourblock.community';
      
      // Generate a unique topic for this device/user
      const deviceId = this.getOrCreateDeviceId();
      const topic = `ourblock-${deviceId}`;
      
      // Create endpoint URL
      const endpoint = `${pushServerUrl}/subscribe/${topic}`;
      
      this.endpoint = {
        endpoint,
        distributorName: 'ourblock-unified-push',
      };

      // Subscribe to push endpoint
      // This would typically involve registering with the push server
      // and getting a subscription token
      logger.info('Registered with UnifiedPush', { endpoint });

      // TODO: Send endpoint to hub via Holochain signal
      // This allows the hub to forward messages to this device when offline
      await this.sendEndpointToHub();
    } catch (err) {
      logger.error('Failed to register with UnifiedPush', err);
      throw err;
    }
  }

  /**
   * Get or create a unique device ID for this installation
   */
  private getOrCreateDeviceId(): string {
    const DEVICE_ID_KEY = 'ourblock_device_id';
    let deviceId = localStorage.getItem(DEVICE_ID_KEY);
    
    if (!deviceId) {
      // Generate a random device ID
      deviceId = crypto.randomUUID();
      localStorage.setItem(DEVICE_ID_KEY, deviceId);
    }
    
    return deviceId;
  }

  /**
   * Send push endpoint to hub via Holochain
   * Hub will store this and use it to forward notifications when offline
   */
  private async sendEndpointToHub(): Promise<void> {
    try {
      // TODO: Implement zome call to store push endpoint
      // This would call a coordinator function like:
      // register_push_endpoint({ endpoint: string, device_id: string })
      
      logger.debug('Push endpoint sent to hub', { endpoint: this.endpoint });
    } catch (err) {
      logger.error('Failed to send endpoint to hub', err);
    }
  }

  /**
   * Handle messages from service worker
   * Called when a push notification is received
   */
  private handleServiceWorkerMessage(event: MessageEvent): void {
    if (event.data.type === 'push-notification') {
      const payload = event.data.payload as PushNotificationPayload;
      
      logger.debug('Push notification received', { payload });
      
      // Show notification (service worker should handle this)
      // This is just for handling the click event
      this.handleNotificationClick(payload);
    }
  }

  /**
   * Handle notification click
   * Wakes the conductor and syncs data
   */
  private async handleNotificationClick(payload: PushNotificationPayload): Promise<void> {
    try {
      logger.info('Notification clicked, waking conductor', { type: payload.type });
      
      // Force wake the conductor even if in background
      await syncManager.forceSync();
      
      // Navigate to the relevant page based on notification type
      switch (payload.type) {
        case 'direct_message':
          window.location.hash = '#/chat';
          break;
        case 'mention':
        case 'reaction':
          window.location.hash = '#/feed';
          break;
        case 'event':
          window.location.hash = '#/events';
          break;
      }
    } catch (err) {
      logger.error('Failed to handle notification click', err);
    }
  }

  /**
   * Show a local notification (for testing)
   */
  async showNotification(payload: PushNotificationPayload): Promise<void> {
    if (this.notificationPermission !== 'granted') {
      logger.warn('Cannot show notification: permission not granted');
      return;
    }

    try {
      if (this.registration) {
        await this.registration.showNotification(payload.title, {
          body: payload.body,
          icon: payload.icon || '/icons/icon-192x192.png',
          badge: payload.badge?.toString(),
          data: payload.data,
          tag: payload.type,
          requireInteraction: false,
        });
      } else {
        // Fallback to regular Notification API
        new Notification(payload.title, {
          body: payload.body,
          icon: payload.icon || '/icons/icon-192x192.png',
          data: payload.data,
        });
      }
    } catch (err) {
      logger.error('Failed to show notification', err);
    }
  }

  /**
   * Unregister from push notifications
   */
  async unregister(): Promise<void> {
    try {
      // Remove endpoint from hub
      // TODO: Implement zome call to remove push endpoint
      
      this.endpoint = null;
      logger.info('Unregistered from push notifications');
    } catch (err) {
      logger.error('Failed to unregister from push notifications', err);
    }
  }

  /**
   * Get current notification permission status
   */
  getPermission(): NotificationPermission {
    return this.notificationPermission;
  }

  /**
   * Get current push endpoint
   */
  getEndpoint(): PushEndpoint | null {
    return this.endpoint;
  }

  /**
   * Check if push is supported and enabled
   */
  isEnabled(): boolean {
    return this.notificationPermission === 'granted' && this.endpoint !== null;
  }
}

// Singleton instance
export const pushNotificationManager = new PushNotificationManager();

// React hook for push notification status
export function usePushNotifications() {
  const [isEnabled, setIsEnabled] = React.useState(pushNotificationManager.isEnabled());
  const [permission, setPermission] = React.useState(pushNotificationManager.getPermission());

  React.useEffect(() => {
    // Check status on mount
    setIsEnabled(pushNotificationManager.isEnabled());
    setPermission(pushNotificationManager.getPermission());
  }, []);

  const enable = React.useCallback(async () => {
    await pushNotificationManager.initialize();
    setIsEnabled(pushNotificationManager.isEnabled());
    setPermission(pushNotificationManager.getPermission());
  }, []);

  const disable = React.useCallback(async () => {
    await pushNotificationManager.unregister();
    setIsEnabled(pushNotificationManager.isEnabled());
  }, []);

  return {
    isEnabled,
    permission,
    enable,
    disable,
    showNotification: (payload: PushNotificationPayload) => 
      pushNotificationManager.showNotification(payload),
  };
}

// Note: Import React in the actual implementation
import * as React from 'react';
