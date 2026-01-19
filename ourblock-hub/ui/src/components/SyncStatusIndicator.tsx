import { useSyncStatus } from '../utils/syncManager';
import { useVisibility } from '../utils/visibilityManager';
import './SyncStatusIndicator.css';

/**
 * SyncStatusIndicator Component
 * 
 * Shows the current sync state to users:
 * - Foreground: "Syncing..." or "Up to date"
 * - Background: "Paused (saving battery)"
 * - Offline: "Offline - changes queued"
 */
export function SyncStatusIndicator() {
  const { isConnected, isSyncing, queuedActions, lastSync } = useSyncStatus();
  const { state: visibilityState } = useVisibility();

  // Determine status message
  const getStatusMessage = () => {
    if (visibilityState === 'background') {
      return '💤 Paused (saving battery)';
    }
    
    if (!isConnected) {
      return queuedActions > 0 
        ? `📴 Offline - ${queuedActions} action${queuedActions > 1 ? 's' : ''} queued`
        : '📴 Offline';
    }
    
    if (isSyncing) {
      return '🔄 Syncing...';
    }
    
    if (lastSync) {
      const secondsAgo = Math.floor((Date.now() - lastSync.getTime()) / 1000);
      if (secondsAgo < 60) {
        return '✅ Up to date';
      } else {
        return `✅ Synced ${secondsAgo}s ago`;
      }
    }
    
    return '⏳ Waiting...';
  };

  const statusMessage = getStatusMessage();
  
  // Determine status class for styling
  const getStatusClass = () => {
    if (visibilityState === 'background') return 'sync-status--paused';
    if (!isConnected) return 'sync-status--offline';
    if (isSyncing) return 'sync-status--syncing';
    return 'sync-status--connected';
  };

  return (
    <div className={`sync-status-indicator ${getStatusClass()}`}>
      <span className="sync-status-message">{statusMessage}</span>
      
      {queuedActions > 0 && (
        <span className="sync-status-queue" title={`${queuedActions} pending action${queuedActions > 1 ? 's' : ''}`}>
          {queuedActions}
        </span>
      )}
    </div>
  );
}
