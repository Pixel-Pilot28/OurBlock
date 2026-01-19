import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
  useRef,
} from 'react';
import { AppClient, AppWebsocket, AdminWebsocket, CellType, AppSignal, SignalType } from '@holochain/client';
import { logger } from '../utils/logger';
import { syncManager } from '../utils/syncManager';
import { visibilityManager } from '../utils/visibilityManager';

type SignalHandler = (signal: AppSignal) => void;

interface HolochainContextType {
  client: AppClient | null;
  adminWs: AdminWebsocket | null;
  isConnected: boolean;
  error: string | null;
  agentKey: Uint8Array | null;
  appId: string | null;
  onSignal: (handler: SignalHandler) => () => void;
}

const HolochainContext = createContext<HolochainContextType>({
  client: null,
  adminWs: null,
  isConnected: false,
  error: null,
  agentKey: null,
  appId: null,
  onSignal: () => () => {},
});

export function useHolochain() {
  return useContext(HolochainContext);
}

interface Props {
  children: ReactNode;
}

export function HolochainProvider({ children }: Props) {
  const [client, setClient] = useState<AppClient | null>(null);
  const [adminWs, setAdminWs] = useState<AdminWebsocket | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentKey, setAgentKey] = useState<Uint8Array | null>(null);
  const [appId, setAppId] = useState<string | null>(null);
  const signalHandlersRef = useRef<Set<SignalHandler>>(new Set());

  // Function to register signal handlers
  const onSignal = useCallback((handler: SignalHandler) => {
    signalHandlersRef.current.add(handler);
    
    // Return unsubscribe function
    return () => {
      signalHandlersRef.current.delete(handler);
    };
  }, []);

  useEffect(() => {
    async function connect(retryCount = 0) {
      const maxRetries = 3;
      const retryDelay = 1000; // 1 second
      
      try {
        // Check URL query params for port override
        const urlParams = new URLSearchParams(window.location.search);
        const queryAppPort = urlParams.get('port');
        const queryAdminPort = urlParams.get('admin_port');

        const appPort = queryAppPort || import.meta.env.VITE_HC_PORT || '8888';
        const adminPort = queryAdminPort || import.meta.env.VITE_HC_ADMIN_PORT || '37397';
        // Use window.location.hostname if VITE_HC_HOST is not set, otherwise fallback to localhost
        const host = import.meta.env.VITE_HC_HOST || window.location.hostname || 'localhost';
        
        logger.debug('Holochain connection initiated', { 
          queryAppPort, 
          queryAdminPort, 
          appPort, 
          adminPort, 
          host 
        });

        // First connect to admin to get an auth token
        const adminWs = await AdminWebsocket.connect({
          url: new URL(`ws://${host}:${adminPort}`),
        });
        logger.info('Admin WebSocket connected');

        // Get the installed apps
        const apps = await adminWs.listApps({});
        logger.debug('Installed apps retrieved', { count: apps.length });

        if (!apps || apps.length === 0) {
          throw new Error('No apps installed in the conductor');
        }

        // Get the first app's installed_app_id
        const appInfo = apps[0];
        const installedAppId = appInfo.installed_app_id;
        logger.info('Using app', { installedAppId });
        
        // Store admin websocket and app ID for backup/restore functionality
        setAdminWs(adminWs);
        setAppId(installedAppId);

        // Authorize signing credentials for all cells in the app
        for (const roleName of Object.keys(appInfo.cell_info)) {
          const cells = appInfo.cell_info[roleName];
          for (const cell of cells) {
            if (cell.type === CellType.Provisioned) {
              const cellId = cell.value.cell_id;
              logger.debug('Authorizing signing credentials', { roleName });
              await adminWs.authorizeSigningCredentials(cellId);
            }
          }
        }
        logger.info('Signing credentials authorized');

        // Issue an app authentication token
        const tokenResponse = await adminWs.issueAppAuthenticationToken({
          installed_app_id: installedAppId,
        });
        logger.info('App authentication token issued');

        // Now connect to app websocket with the token
        const appClient = await AppWebsocket.connect({
          url: new URL(`ws://${host}:${appPort}`),
          token: tokenResponse.token,
        });
        
        // Set up signal listener
        appClient.on('signal', (signal) => {
          // Signal arrives wrapped, extract AppSignal from wrapper
          const appSignal: AppSignal = 'value' in signal && signal.type === SignalType.App 
            ? signal.value 
            : signal as unknown as AppSignal;
          
          logger.debug('Signal received', { zome: appSignal.zome_name });
          // Notify all registered handlers
          signalHandlersRef.current.forEach(handler => {
            try {
              handler(appSignal);
            } catch (err) {
              logger.error('Error in signal handler', err);
            }
          });
        });
        
        // Get the agent's public key
        const clientAppInfo = await appClient.appInfo();
        if (clientAppInfo && clientAppInfo.agent_pub_key) {
          setAgentKey(clientAppInfo.agent_pub_key);
        }
        
        setClient(appClient);
        setIsConnected(true);
        setError(null);
        logger.info('Holochain connection established successfully');
      } catch (err) {
        logger.error('Failed to connect to Holochain', err);
        
        // Check if it's a source chain head error and retry
        const errorMessage = err instanceof Error ? err.message : String(err);
        const isChainHeadError = errorMessage.includes('source chain head has moved');
        
        if (isChainHeadError && retryCount < maxRetries) {
          logger.warn(`Source chain conflict detected, retrying...`, { attempt: retryCount + 1, maxRetries });
          setTimeout(() => connect(retryCount + 1), retryDelay);
          return;
        }
        
        setError(
          err instanceof Error
            ? err.message
            : 'Failed to connect to Holochain'
        );
        setIsConnected(false);
      }
    }

    connect();
  }, []);

  // Integrate sync and visibility managers
  useEffect(() => {
    if (client && appId) {
      // Set the client in sync manager
      syncManager.setClient(client);
      
      // Set connection lifecycle callbacks
      syncManager.setCallbacks(
        async () => {
          // onConnect callback - already connected, just trigger sync
          logger.debug('Sync manager requesting connection (already connected)');
          setIsConnected(true);
        },
        async () => {
          // onDisconnect callback - pause background sync
          logger.debug('Sync manager pausing background activity');
          // Note: We don't actually close the WebSocket here
          // Just stop periodic sync to save battery
        }
      );

      // Start monitoring visibility
      visibilityManager.start();
      
      logger.info('Sync and visibility managers initialized');
    }

    return () => {
      // Cleanup on unmount
      visibilityManager.stop();
    };
  }, [client, appId]);

  return (
    <HolochainContext.Provider value={{ client, adminWs, isConnected, error, agentKey, appId, onSignal }}>
      {children}
    </HolochainContext.Provider>
  );
}
