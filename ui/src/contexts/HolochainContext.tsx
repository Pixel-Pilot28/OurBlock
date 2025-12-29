import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
} from 'react';
import { AppClient, AppWebsocket } from '@holochain/client';

interface HolochainContextType {
  client: AppClient | null;
  isConnected: boolean;
  error: string | null;
}

const HolochainContext = createContext<HolochainContextType>({
  client: null,
  isConnected: false,
  error: null,
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

  useEffect(() => {
    async function connect() {
      try {
        // Default Holochain app websocket port
        const wsUrl = import.meta.env.VITE_HC_PORT
          ? `ws://localhost:${import.meta.env.VITE_HC_PORT}`
          : 'ws://localhost:8888';

        const appClient = await AppWebsocket.connect(wsUrl);
        setClient(appClient);
        setIsConnected(true);
        setError(null);
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
    <HolochainContext.Provider value={{ client, isConnected, error }}>
      {children}
    </HolochainContext.Provider>
  );
}
