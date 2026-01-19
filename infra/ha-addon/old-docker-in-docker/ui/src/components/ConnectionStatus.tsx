import { useState, useEffect } from 'react';
import { AppWebsocket } from '@holochain/client';

type ConnectionState = 'synced' | 'searching' | 'connecting' | 'offline';

interface ConnectionStatusProps {
  /** Optional custom class name */
  className?: string;
}

/**
 * ConnectionStatus - Displays real-time P2P network status
 * 
 * Shows whether the app is:
 * - Synced: Connected to peers and DHT
 * - Searching: Looking for peers via bootstrap
 * - Connecting: Establishing peer connections
 * - Offline: No connection to conductor or peers
 */
export default function ConnectionStatus({ className = '' }: ConnectionStatusProps) {
  const [status, setStatus] = useState<ConnectionState>('connecting');
  const [peerCount, setPeerCount] = useState<number>(0);
  const [lastSync, setLastSync] = useState<Date | null>(null);

  useEffect(() => {
    let pollInterval: ReturnType<typeof setInterval>;
    let appWs: AppWebsocket | null = null;

    const checkConnection = async () => {
      try {
        const appPort = parseInt(import.meta.env.VITE_HC_PORT || '8888');
        
        // Try to connect to app websocket
        if (!appWs) {
          appWs = await AppWebsocket.connect({
            url: new URL(`ws://localhost:${appPort}`),
            wsClientOptions: {
              origin: 'ourblock-client',
            },
          });
        }

        // TODO: Once Holochain provides peer count API, query it here
        // For now, we'll simulate based on connection state
        
        // If we can connect, we're at least "connecting"
        setStatus('searching');
        
        // Simulate peer discovery (in production, query actual peer count)
        // This is a placeholder - replace with actual Holochain peer status API
        const simulatedPeerCount = 0; // Would come from: appWs.callZome({ fn_name: 'get_peer_count' })
        
        if (simulatedPeerCount > 0) {
          setStatus('synced');
          setPeerCount(simulatedPeerCount);
          setLastSync(new Date());
        } else {
          setStatus('searching');
          setPeerCount(0);
        }
        
      } catch (error) {
        console.error('Connection check failed:', error);
        setStatus('offline');
        setPeerCount(0);
        if (appWs) {
          try {
            await appWs.client.close();
            appWs = null;
          } catch (e) {
            // Ignore close errors
          }
        }
      }
    };

    // Initial check
    checkConnection();

    // Poll every 5 seconds
    pollInterval = setInterval(checkConnection, 5000);

    return () => {
      clearInterval(pollInterval);
      if (appWs) {
        appWs.client.close().catch(() => {
          // Ignore close errors
        });
      }
    };
  }, []);

  const getStatusColor = (state: ConnectionState): string => {
    switch (state) {
      case 'synced':
        return 'bg-green-500';
      case 'searching':
        return 'bg-yellow-500';
      case 'connecting':
        return 'bg-blue-500';
      case 'offline':
        return 'bg-red-500';
    }
  };

  const getStatusText = (state: ConnectionState): string => {
    switch (state) {
      case 'synced':
        return `Synced (${peerCount} ${peerCount === 1 ? 'peer' : 'peers'})`;
      case 'searching':
        return 'Searching for Peers';
      case 'connecting':
        return 'Connecting';
      case 'offline':
        return 'Offline';
    }
  };

  const getStatusIcon = (state: ConnectionState): string => {
    switch (state) {
      case 'synced':
        return '✓';
      case 'searching':
        return '🔍';
      case 'connecting':
        return '⟳';
      case 'offline':
        return '✗';
    }
  };

  return (
    <div className={`flex items-center space-x-2 ${className}`}>
      {/* Status indicator dot */}
      <div className="relative flex items-center">
        <div
          className={`h-3 w-3 rounded-full ${getStatusColor(status)}`}
          aria-label={`Status: ${status}`}
        >
          {/* Pulsing animation for searching/connecting states */}
          {(status === 'searching' || status === 'connecting') && (
            <div
              className={`absolute inset-0 h-3 w-3 rounded-full ${getStatusColor(
                status
              )} animate-ping opacity-75`}
            />
          )}
        </div>
      </div>

      {/* Status text */}
      <span className="text-sm font-medium text-gray-700">
        <span className="mr-1">{getStatusIcon(status)}</span>
        {getStatusText(status)}
      </span>

      {/* Last sync time (for synced state) */}
      {status === 'synced' && lastSync && (
        <span className="text-xs text-gray-500">
          • {lastSync.toLocaleTimeString()}
        </span>
      )}

      {/* Tooltip on hover */}
      <div className="group relative">
        <button className="text-gray-400 hover:text-gray-600 text-xs ml-1">
          ℹ️
        </button>
        <div className="absolute bottom-full left-1/2 transform -translate-x-1/2 mb-2 hidden group-hover:block w-64 p-3 bg-gray-900 text-white text-xs rounded-lg shadow-lg z-10">
          <p className="font-medium mb-1">Connection Status</p>
          <ul className="space-y-1">
            <li>
              <span className="text-green-400">Synced:</span> Connected to
              peers, DHT is up-to-date
            </li>
            <li>
              <span className="text-yellow-400">Searching:</span> Looking for
              peers via bootstrap server
            </li>
            <li>
              <span className="text-blue-400">Connecting:</span> Establishing
              P2P connections
            </li>
            <li>
              <span className="text-red-400">Offline:</span> No connection to
              Holochain
            </li>
          </ul>
          {status === 'offline' && (
            <p className="mt-2 text-yellow-300">
              Check that Holochain is running on port{' '}
              {import.meta.env.VITE_HC_PORT || '8888'}
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
