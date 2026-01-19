import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { AdminWebsocket, AppInfo, InstalledAppId } from '@holochain/client';
import {
  parseInviteCode,
  validateInviteCode,
  formatInviteTimestamp,
} from '../utils/inviteCode';
import { inviteCodeSchema, validateField } from '../utils/validation';
import { logger } from '../utils/logger';

const HOLOCHAIN_ADMIN_PORT = import.meta.env.VITE_HC_ADMIN_PORT || 4444;

/**
 * JoinNeighborhood - Zero-config entry point for neighbors
 * 
 * Allows users to join a neighborhood by entering an invite code.
 * The code contains everything needed: network seed, signature, P2P discovery info
 * 
 * V2 codes enable "domain-less" connectivity using Holochain's signaling infrastructure
 */
export default function JoinNeighborhood() {
  const navigate = useNavigate();
  
  const [inviteCode, setInviteCode] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [installProgress, setInstallProgress] = useState<string>('');

  /**
   * Handles the join process
   */
  const handleJoin = async () => {
    setError(null);
    setInstallProgress('');

    // Validate invite code format with Zod schema
    const schemaValidation = validateField(inviteCodeSchema, inviteCode);
    if (!schemaValidation.success) {
      setError(schemaValidation.error);
      return;
    }

    // Validate invite code content
    const validation = validateInviteCode(inviteCode);
    if (!validation.isValid) {
      setError(validation.error || 'Invalid invite code');
      return;
    }

    // Parse the code
    const parsed = parseInviteCode(inviteCode);
    if (!parsed) {
      setError('Failed to parse invite code');
      return;
    }

    setIsLoading(true);

    try {
      setInstallProgress('Connecting to Holochain conductor...');

      // Connect to admin websocket
      const adminWs = await AdminWebsocket.connect({
        url: new URL(`ws://localhost:${HOLOCHAIN_ADMIN_PORT}`),
        wsClientOptions: {
          origin: 'ourblock-client',
        },
      });

      setInstallProgress('Installing OurBlock app...');

      // Install the app with the network seed and membrane proof
      // Convert the invite code string to Uint8Array for membrane proof
      const membraneProof = new TextEncoder().encode(inviteCode);
      
      const installedAppId: InstalledAppId = `ourblock-${parsed.networkSeed}`;

      // For V2 codes: Configure P2P discovery using signal server from invite
      if (parsed.version === 'V2') {
        logger.info('Using V2 invite with P2P discovery', {
          signalUrl: parsed.signalUrl,
          bootstrapUrl: parsed.bootstrapUrl,
          hubAgentKey: parsed.hubAgentPubKey.substring(0, 10) + '...',
        });

        // TODO: Configure conductor network settings dynamically
        // This would require updating conductor-config.yaml or using runtime network config API
        // For now, ensure conductor is configured with:
        // - bootstrap_service: parsed.bootstrapUrl
        // - signal_url: parsed.signalUrl
        
        // The membrane proof contains the hub's agent public key for P2P discovery
        // Holochain will use this to initiate direct P2P connection via the signal server
      } else {
        logger.info('Using V1 invite with traditional discovery', {
          hubAddress: (parsed as any).hubAddress,
        });
      }

      // Install app with membrane proof (invite code) and network seed
      const installRequest = {
        installed_app_id: installedAppId,
        agent_key: undefined, // Will generate new agent key
        membrane_proofs: {
          our_block: membraneProof, // Pass invite code as Uint8Array
        },
        network_seed: parsed.networkSeed,
      };
      
      const appInfo: AppInfo = await adminWs.installApp(installRequest as any);

      setInstallProgress('Enabling app...');

      // Enable the installed app
      await adminWs.enableApp({
        installed_app_id: appInfo.installed_app_id,
      });

      setInstallProgress('Configuring network...');

      // Attach app interface (if not already attached)
      try {
        const appPort = parseInt(import.meta.env.VITE_HC_PORT || '8888');
        const attachRequest = {
          port: appPort,
          allowed_origins: '*',
        };
        await adminWs.attachAppInterface(attachRequest as any);
      } catch (err) {
        // May already be attached, ignore error
        logger.debug('App interface may already be attached', err);
      }

      setInstallProgress('Complete! Redirecting...');

      // Close admin connection
      await adminWs.client.close();

      // Success! Navigate to the app with hub agent key for first joiner detection
      // Convert hubAgentPubKey from base64 string to Uint8Array if it's a V2 code
      let hubAgentPubKeyBytes: Uint8Array | undefined;
      if (parsed.version === 'V2') {
        try {
          // Decode base64 hub agent public key to Uint8Array
          const binaryString = atob(parsed.hubAgentPubKey);
          hubAgentPubKeyBytes = new Uint8Array(binaryString.length);
          for (let i = 0; i < binaryString.length; i++) {
            hubAgentPubKeyBytes[i] = binaryString.charCodeAt(i);
          }
        } catch (e) {
          logger.warn('Failed to decode hub agent pub key', e);
        }
      }

      setTimeout(() => {
        navigate('/', { 
          state: { 
            hubAgentPubKey: hubAgentPubKeyBytes 
          } 
        });
      }, 1000);

    } catch (err) {
      console.error('Failed to join neighborhood:', err);
      
      let errorMessage = 'Failed to join neighborhood. ';
      
      if (err instanceof Error) {
        if (err.message.includes('membrane')) {
          errorMessage += 'Your invite code was rejected. It may be expired or revoked.';
        } else if (err.message.includes('network')) {
          errorMessage += 'Could not connect to the Holochain conductor.';
        } else {
          errorMessage += err.message;
        }
      } else {
        errorMessage += 'Please try again or contact your neighborhood admin.';
      }
      
      setError(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Handles paste event to auto-detect invite codes
   */
  const handlePaste = (e: React.ClipboardEvent<HTMLInputElement>) => {
    const pastedText = e.clipboardData.getData('text');
    if (pastedText.startsWith('OURBLOCK_V1:') || pastedText.startsWith('OURBLOCK_V2:')) {
      setInviteCode(pastedText);
      setError(null);
    }
  };

  // Parse code for display (if valid)
  const parsed = parseInviteCode(inviteCode);

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg shadow-xl p-8 max-w-md w-full">
        {/* Header */}
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            Join a Neighborhood
          </h1>
          <p className="text-gray-600">
            Enter your invite code to get started
          </p>
        </div>

        {/* Invite Code Input */}
        <div className="mb-6">
          <label
            htmlFor="inviteCode"
            className="block text-sm font-medium text-gray-700 mb-2"
          >
            Invite Code
          </label>
          <input
            id="inviteCode"
            type="text"
            value={inviteCode}
            onChange={(e) => setInviteCode(e.target.value)}
            onPaste={handlePaste}
            placeholder="OURBLOCK_V1:... or OURBLOCK_V2:..."
            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent font-mono text-sm"
            disabled={isLoading}
          />
          
          {/* Code preview */}
          {parsed && !error && (
            <div className="mt-3 p-3 bg-green-50 rounded-lg text-sm">
              <p className="text-green-800 font-medium mb-1">
                Valid Invite Code ({parsed.version})
              </p>
              {parsed.version === 'V2' ? (
                <>
                  <p className="text-green-700">
                    Mode: Domain-less P2P Discovery
                  </p>
                  <p className="text-green-700">
                    Signal: {parsed.signalUrl}
                  </p>
                  <p className="text-green-700">
                    Created: {formatInviteTimestamp(parsed.timestamp)}
                  </p>
                </>
              ) : (
                <>
                  <p className="text-green-700">
                    Hub: {(parsed as any).hubAddress}
                  </p>
                  <p className="text-green-700">
                    Created: {formatInviteTimestamp(parsed.timestamp)}
                  </p>
                </>
              )}
            </div>
          )}
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 text-sm">{error}</p>
          </div>
        )}

        {/* Progress Display */}
        {installProgress && (
          <div className="mb-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex items-center space-x-3">
              <div className="animate-spin h-5 w-5 border-2 border-blue-600 border-t-transparent rounded-full" />
              <p className="text-blue-800 text-sm">{installProgress}</p>
            </div>
          </div>
        )}

        {/* Join Button */}
        <button
          onClick={handleJoin}
          disabled={!inviteCode || isLoading}
          className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
            !inviteCode || isLoading
              ? 'bg-gray-300 text-gray-500 cursor-not-allowed'
              : 'bg-blue-600 text-white hover:bg-blue-700'
          }`}
        >
          {isLoading ? 'Joining...' : 'Join Neighborhood'}
        </button>

        {/* Help Text */}
        <div className="mt-6 text-center text-sm text-gray-600">
          <p>Don't have an invite code?</p>
          <p className="mt-1">
            Ask your neighborhood admin to generate one for you.
          </p>
        </div>

        {/* Technical Details (expandable) */}
        {parsed && (
          <details className="mt-6 text-xs text-gray-500">
            <summary className="cursor-pointer font-medium">
              Technical Details
            </summary>
            <div className="mt-2 space-y-1 font-mono">
              {parsed.version === 'V1' && (
                <p>Hub Address: {parsed.hubAddress}</p>
              )}
              <p>Network Seed: {parsed.networkSeed}</p>
              <p>Timestamp: {parsed.timestamp}</p>
              <p>Signature: {parsed.signature.substring(0, 20)}...</p>
              {parsed.version === 'V2' && (
                <p className="mt-2 text-gray-600">
                  Bootstrap Server: {parsed.bootstrapUrl}
                </p>
              )}
            </div>
          </details>
        )}

        {/* Security Notice */}
        <div className="mt-6 p-3 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-600">
            <strong>Your Privacy:</strong> Your cryptographic keys are generated
            locally on your device. The neighborhood hub never has access to your
            private keys.
          </p>
        </div>
      </div>
    </div>
  );
}
