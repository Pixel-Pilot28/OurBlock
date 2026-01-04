import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { AppClient, AppWebsocket, AdminWebsocket, CellType } from '@holochain/client';

interface HolochainContextType {
  client: AppClient | null;
  isConnected: boolean;
  error: string | null;
  agentKey: Uint8Array | null;
}

const HolochainContext = createContext<HolochainContextType>({
  client: null,
  isConnected: false,
  error: null,
  agentKey: null,
});

export function useHolochain() {
  return useContext(HolochainContext);
}

interface Props {
  children: ReactNode;
}

export function HolochainProvider({ children }: Props) {
  const [client, setClient] = useState<AppClient | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [agentKey, setAgentKey] = useState<Uint8Array | null>(null);

  useEffect(() => {
    async function connect() {
      try {
        const appPort = import.meta.env.VITE_HC_PORT || '36449';
        const adminPort = import.meta.env.VITE_HC_ADMIN_PORT || '9999';
        const host = import.meta.env.VITE_HC_HOST || 'localhost';
        
        console.log('Connecting to Holochain admin at:', `ws://${host}:${adminPort}`);
        console.log('App port:', appPort);

        // First connect to admin to get an auth token
        const adminWs = await AdminWebsocket.connect({
          url: new URL(`ws://${host}:${adminPort}`),
        });
        console.log('Admin connected!');

        // Get the installed apps
        const apps = await adminWs.listApps({});
        console.log('Installed apps:', apps);

        if (!apps || apps.length === 0) {
          throw new Error('No apps installed in the conductor');
        }

        // Get the first app's installed_app_id
        const appInfo = apps[0];
        const appId = appInfo.installed_app_id;
        console.log('Using app:', appId);

        // Authorize signing credentials for all cells in the app
        for (const roleName of Object.keys(appInfo.cell_info)) {
          const cells = appInfo.cell_info[roleName];
          for (const cell of cells) {
            if (cell.type === CellType.Provisioned) {
              const cellId = cell.value.cell_id;
              console.log('Authorizing signing credentials for cell:', roleName);
              await adminWs.authorizeSigningCredentials(cellId);
            }
          }
        }
        console.log('Signing credentials authorized');

        // Issue an app authentication token
        const tokenResponse = await adminWs.issueAppAuthenticationToken({
          installed_app_id: appId,
        });
        console.log('Got auth token');

        // Now connect to app websocket with the token
        const appClient = await AppWebsocket.connect({
          url: new URL(`ws://${host}:${appPort}`),
          token: tokenResponse.token,
        });
        
        // Get the agent's public key
        const clientAppInfo = await appClient.appInfo();
        if (clientAppInfo && clientAppInfo.agent_pub_key) {
          setAgentKey(clientAppInfo.agent_pub_key);
        }
        
        setClient(appClient);
        setIsConnected(true);
        setError(null);
        console.log('Connected successfully to app!');
      } catch (err) {
        console.error('Failed to connect to Holochain:', err);
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

  return (
    <HolochainContext.Provider value={{ client, isConnected, error, agentKey }}>
      {children}
    </HolochainContext.Provider>
  );
}
