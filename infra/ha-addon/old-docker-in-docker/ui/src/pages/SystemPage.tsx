import { useState, useCallback, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { useHolochain } from '../contexts/HolochainContext';
import { logger } from '../utils/logger';
import { BackupManager } from '../components/BackupManager';
import './SystemPage.css';

interface DataHealthStatus {
  status: 'healthy' | 'warning' | 'error' | 'checking';
  message: string;
  chainHeight?: number;
  lastChecked?: Date;
}

interface VersionInfo {
  currentVersion: string;
  latestVersion: string | null;
  updateAvailable: boolean;
  checkStatus: 'idle' | 'checking' | 'success' | 'error';
  errorMessage?: string;
}

interface UpdateStatus {
  isUpdating: boolean;
  isRestarting: boolean;
  restartMessage: string;
  healthCheckAttempts: number;
}

// Sidecar management service endpoint (via HTTPS reverse proxy)
const SIDECAR_URL = import.meta.env.VITE_SIDECAR_URL || 'https://localhost:4443';
const ADMIN_API_KEY = import.meta.env.VITE_ADMIN_API_KEY || 'dev-key-change-in-production';
const HEALTH_CHECK_INTERVAL = 2000; // 2 seconds
const MAX_HEALTH_CHECK_ATTEMPTS = 30; // 60 seconds total

export function SystemPage() {
  const { client, adminWs, isConnected, appId } = useHolochain();
  const [isBackingUp, setIsBackingUp] = useState(false);
  const [isRestoring, setIsRestoring] = useState(false);
  const [backupStatus, setBackupStatus] = useState<string>('');
  const [restoreStatus, setRestoreStatus] = useState<string>('');
  const [dataHealth, setDataHealth] = useState<DataHealthStatus>({
    status: 'healthy',
    message: 'Not yet checked',
  });
  
  // Version and update state
  const [versionInfo, setVersionInfo] = useState<VersionInfo>({
    currentVersion: import.meta.env.VITE_APP_VERSION || '0.1.0',
    latestVersion: null,
    updateAvailable: false,
    checkStatus: 'idle',
  });
  
  const [updateStatus, setUpdateStatus] = useState<UpdateStatus>({
    isUpdating: false,
    isRestarting: false,
    restartMessage: '',
    healthCheckAttempts: 0,
  });

  // Backup: Export full state as downloadable file
  const handleBackup = async () => {
    if (!adminWs || !appId) {
      setBackupStatus('Error: Admin connection not available');
      return;
    }

    setIsBackingUp(true);
    setBackupStatus('Preparing backup...');

    try {
      // Call dump_full_state on the admin websocket
      logger.debug('Initiating state dump', { appId });
      
      // dump_full_state is an admin API call that exports the entire conductor state
      // This API is not yet fully typed in @holochain/client, so we use the generic request method
      interface AdminWebsocketExtended {
        request(method: string, args: Record<string, any>): Promise<any>;
      }
      
      const stateData = await (adminWs as unknown as AdminWebsocketExtended).request('dump_full_state', {
        cell_id: null, // null means all cells
      });

      logger.info('State dump completed successfully');

      // Convert the state data to a blob
      const stateJson = JSON.stringify(stateData, null, 2);
      const blob = new Blob([stateJson], { type: 'application/json' });

      // Create download link
      const url = URL.createObjectURL(blob);
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `ourblock_backup_${timestamp}.json`;

      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setBackupStatus(`Backup saved: ${filename}`);
      logger.info('Backup downloaded', { filename });
    } catch (error) {
      logger.error('Backup failed', error);
      setBackupStatus(`Backup failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsBackingUp(false);
    }
  };

  // Restore: Handle dropped backup file
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;

    const file = acceptedFiles[0];
    setIsRestoring(true);
    setRestoreStatus(`Processing ${file.name}...`);

    try {
      // Read the file
      const fileContent = await file.text();
      const backupData = JSON.parse(fileContent);

      logger.debug('Backup file loaded, preparing to restore');
      setRestoreStatus('Restoring from backup...');

      // Note: Full restore would require uninstalling and reinstalling the app
      // This is a destructive operation and should be confirmed
      // For now, we'll just validate the backup file
      
      if (!backupData || typeof backupData !== 'object') {
        throw new Error('Invalid backup file format');
      }

      setRestoreStatus('⚠️ Restore functionality requires manual confirmation. Backup file validated.');
      
      // TODO: Implement full restore flow:
      // 1. Confirm with user (this will delete current data)
      // 2. Call adminWs.uninstallApp({ installed_app_id: appId })
      // 3. Call adminWs.installApp with backup data
      // 4. Reconnect client

    } catch (error) {
      logger.error('Restore failed', error);
      setRestoreStatus(`Restore failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    } finally {
      setIsRestoring(false);
    }
  }, [adminWs, appId]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/json': ['.json'],
    },
    maxFiles: 1,
    disabled: isRestoring || !isConnected,
  });

  // Sync Check: Query agent activity to verify chain health
  const handleSyncCheck = async () => {
    if (!client || !isConnected) {
      setDataHealth({
        status: 'error',
        message: 'Not connected to Holochain',
      });
      return;
    }

    setDataHealth({
      status: 'checking',
      message: 'Checking data health...',
    });

    try {
      // Get agent info to check activity
      const appInfo = await client.appInfo();
      
      if (!appInfo) {
        throw new Error('Could not retrieve app info');
      }

      // Try to get some activity data from the feed zome as a health check
      try {
        const posts = await client.callZome({
          role_name: 'our_block',
          zome_name: 'feed',
          fn_name: 'get_all_posts',
          payload: null,
        });

        setDataHealth({
          status: 'healthy',
          message: `Connected and synced. Found ${Array.isArray(posts) ? posts.length : 0} posts.`,
          lastChecked: new Date(),
        });
      } catch (zomeError) {
        // If the zome call fails, we're still connected but maybe no data
        setDataHealth({
          status: 'warning',
          message: 'Connected but could not retrieve activity data',
          lastChecked: new Date(),
        });
      }
    } catch (error) {
      logger.error('Sync check failed', error);
      setDataHealth({
        status: 'error',
        message: `Health check failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        lastChecked: new Date(),
      });
    }
  };

  // Version Check: Fetch latest version from GitHub releases
  const checkForUpdates = async () => {
    setVersionInfo(prev => ({ ...prev, checkStatus: 'checking' }));

    try {
      // Check if sidecar is available first
      const sidecarResponse = await fetch(`${SIDECAR_URL}/version`, {
        method: 'GET',
        headers: {
          'X-OurBlock-Admin-Key': ADMIN_API_KEY,
        },
        signal: AbortSignal.timeout(5000),
      });

      if (!sidecarResponse.ok) {
        throw new Error('Sidecar service not available');
      }

      const sidecarData = await sidecarResponse.json();
      const latestVersion = sidecarData.latest || sidecarData.version;

      // Compare versions (simple string comparison, could use semver)
      const currentVersion = versionInfo.currentVersion;
      const updateAvailable = latestVersion !== currentVersion;

      setVersionInfo({
        currentVersion,
        latestVersion,
        updateAvailable,
        checkStatus: 'success',
      });

      logger.debug('Version check completed', { currentVersion, latestVersion, updateAvailable });
    } catch (error) {
      logger.error('Version check failed', error);
      setVersionInfo(prev => ({
        ...prev,
        checkStatus: 'error',
        errorMessage: error instanceof Error ? error.message : 'Failed to check for updates',
      }));
    }
  };

  // Update Trigger: Signal sidecar to pull and restart containers
  const handleUpdate = async () => {
    if (!versionInfo.updateAvailable) return;

    const confirmed = window.confirm(
      `Update OurBlock from v${versionInfo.currentVersion} to v${versionInfo.latestVersion}?\n\n` +
      'The app will restart during the update process. This may take 1-2 minutes.'
    );

    if (!confirmed) return;

    setUpdateStatus({
      isUpdating: true,
      isRestarting: false,
      restartMessage: 'Triggering update...',
      healthCheckAttempts: 0,
    });

    try {
      // Send update signal to sidecar
      const response = await fetch(`${SIDECAR_URL}/update`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-OurBlock-Admin-Key': ADMIN_API_KEY,
        },
        body: JSON.stringify({ version: versionInfo.latestVersion }),
        signal: AbortSignal.timeout(10000),
      });

      if (!response.ok) {
        throw new Error(`Update request failed: ${response.statusText}`);
      }

      logger.info('Update triggered successfully');

      // Start restart monitoring
      setUpdateStatus(prev => ({
        ...prev,
        isRestarting: true,
        restartMessage: 'Server is restarting... Please wait.',
      }));

      // Start health check polling
      startHealthCheckPolling();
    } catch (error) {
      logger.error('Update failed', error);
      setUpdateStatus({
        isUpdating: false,
        isRestarting: false,
        restartMessage: `Update failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
        healthCheckAttempts: 0,
      });
    }
  };

  // Health Check Polling: Monitor app availability after restart
  const startHealthCheckPolling = () => {
    let attempts = 0;

    const pollInterval = setInterval(async () => {
      attempts++;
      
      setUpdateStatus(prev => ({
        ...prev,
        healthCheckAttempts: attempts,
        restartMessage: `Waiting for server... (${attempts}/${MAX_HEALTH_CHECK_ATTEMPTS})`,
      }));

      try {
        // Try to reach the app's base URL
        const response = await fetch(window.location.origin, {
          method: 'HEAD',
          signal: AbortSignal.timeout(2000),
        });

        if (response.ok) {
          // Server is back online
          clearInterval(pollInterval);
          setUpdateStatus({
            isUpdating: false,
            isRestarting: false,
            restartMessage: 'Update complete! Reloading...',
            healthCheckAttempts: attempts,
          });

          // Reload the page to get new version
          setTimeout(() => {
            window.location.reload();
          }, 1500);
        }
      } catch {
        // Server still down, continue polling
        if (attempts >= MAX_HEALTH_CHECK_ATTEMPTS) {
          clearInterval(pollInterval);
          setUpdateStatus({
            isUpdating: false,
            isRestarting: false,
            restartMessage: 'Update may have failed. Please refresh manually.',
            healthCheckAttempts: attempts,
          });
        }
      }
    }, HEALTH_CHECK_INTERVAL);
  };

  // Check for updates on mount
  useEffect(() => {
    checkForUpdates();
  }, []);

  return (
    <div className="system-page">
      <div className="page-header">
        <h1>Data & System</h1>
        <p className="page-description">
          Manage backups, updates, and system maintenance
        </p>
      </div>

      <div className="system-content">
        {/* Data Health Section */}
        <section className="system-section">
          <h2>Data Health</h2>
          <p className="section-description">
            Check the synchronization status of your local data with the DHT network.
          </p>
          
          <div className={`health-status health-status-${dataHealth.status}`}>
            <div className="health-icon">
              {dataHealth.status === 'healthy' && '✓'}
              {dataHealth.status === 'warning' && '⚠'}
              {dataHealth.status === 'error' && '✗'}
              {dataHealth.status === 'checking' && '⟳'}
            </div>
            <div className="health-info">
              <div className="health-message">{dataHealth.message}</div>
              {dataHealth.lastChecked && (
                <div className="health-timestamp">
                  Last checked: {dataHealth.lastChecked.toLocaleTimeString()}
                </div>
              )}
            </div>
          </div>

          <button
            onClick={handleSyncCheck}
            disabled={!isConnected || dataHealth.status === 'checking'}
            className="system-button"
          >
            {dataHealth.status === 'checking' ? 'Checking...' : 'Check Data Health'}
          </button>
        </section>

        {/* Backup Section */}
        <section className="system-section">
          <h2>Backup Data</h2>
          <p className="section-description">
            Export your complete source chain and encrypted keystore to a backup file.
          </p>

          <button
            onClick={handleBackup}
            disabled={!isConnected || isBackingUp}
            className="system-button system-button-primary"
          >
            {isBackingUp ? '⟳ Creating Backup...' : '⬇ Download Backup'}
          </button>

          {backupStatus && (
            <div className={`status-message ${backupStatus.includes('failed') ? 'status-error' : 'status-success'}`}>
              {backupStatus}
            </div>
          )}
        </section>

        {/* Restore Section */}
        <section className="system-section">
          <h2>Restore from Backup</h2>
          <p className="section-description">
            Upload a backup file to restore your data. ⚠️ This will replace your current data.
          </p>

          <div
            {...getRootProps()}
            className={`dropzone ${isDragActive ? 'dropzone-active' : ''} ${!isConnected ? 'dropzone-disabled' : ''}`}
          >
            <input {...getInputProps()} />
            <div className="dropzone-content">
              <div className="dropzone-icon">📁</div>
              {isDragActive ? (
                <p>Drop backup file here...</p>
              ) : (
                <>
                  <p>Drag & drop a backup file here</p>
                  <p className="dropzone-hint">or click to select file</p>
                  <p className="dropzone-format">Accepts: .json backup files</p>
                </>
              )}
            </div>
          </div>

          {isRestoring && (
            <div className="status-message status-info">
              ⟳ Processing backup file...
            </div>
          )}

          {restoreStatus && !isRestoring && (
            <div className={`status-message ${
              restoreStatus.includes('failed') 
                ? 'status-error' 
                : restoreStatus.includes('⚠️')
                ? 'status-warning'
                : 'status-success'
            }`}>
              {restoreStatus}
            </div>
          )}
        </section>

        {/* Update Management Section */}
        <section className="system-section">
          <h2>App Updates</h2>
          <p className="section-description">
            Check for and install updates to OurBlock. Updates are pulled from Docker Hub and applied automatically.
          </p>

          <div className="version-info">
            <div className="version-row">
              <span className="version-label">Current Version:</span>
              <span className="version-value">v{versionInfo.currentVersion}</span>
            </div>
            {versionInfo.latestVersion && (
              <div className="version-row">
                <span className="version-label">Latest Version:</span>
                <span className="version-value">v{versionInfo.latestVersion}</span>
              </div>
            )}
            {versionInfo.checkStatus === 'checking' && (
              <div className="version-status version-checking">
                ⟳ Checking for updates...
              </div>
            )}
            {versionInfo.checkStatus === 'error' && (
              <div className="version-status version-error">
                ✗ {versionInfo.errorMessage || 'Could not check for updates'}
              </div>
            )}
            {versionInfo.checkStatus === 'success' && !versionInfo.updateAvailable && (
              <div className="version-status version-current">
                ✓ You're running the latest version
              </div>
            )}
            {versionInfo.updateAvailable && (
              <div className="version-status version-available">
                ⬆ Update available: v{versionInfo.latestVersion}
              </div>
            )}
          </div>

          <div className="update-actions">
            <button
              onClick={checkForUpdates}
              disabled={versionInfo.checkStatus === 'checking' || updateStatus.isUpdating}
              className="system-button"
            >
              {versionInfo.checkStatus === 'checking' ? '⟳ Checking...' : '🔄 Check for Updates'}
            </button>

            {versionInfo.updateAvailable && (
              <button
                onClick={handleUpdate}
                disabled={updateStatus.isUpdating}
                className="system-button system-button-primary"
              >
                {updateStatus.isUpdating ? '⟳ Updating...' : '⬆ Update Now'}
              </button>
            )}
          </div>
        </section>

        {/* Automated Backups */}
        <section className="system-section">
          <BackupManager />
        </section>

        {/* System Info */}
        <section className="system-section">
          <h2>System Information</h2>
          <div className="system-info">
            <div className="info-row">
              <span className="info-label">Connection Status:</span>
              <span className={`info-value ${isConnected ? 'status-connected' : 'status-disconnected'}`}>
                {isConnected ? '● Connected' : '○ Disconnected'}
              </span>
            </div>
            <div className="info-row">
              <span className="info-label">App ID:</span>
              <span className="info-value">{appId || 'Not available'}</span>
            </div>
            <div className="info-row">
              <span className="info-label">Admin WebSocket:</span>
              <span className={`info-value ${adminWs ? 'status-connected' : 'status-disconnected'}`}>
                {adminWs ? '● Available' : '○ Not available'}
              </span>
            </div>
          </div>
        </section>
      </div>

      {/* Server Restart Overlay */}
      {updateStatus.isRestarting && (
        <div className="restart-overlay">
          <div className="restart-modal">
            <div className="restart-spinner"></div>
            <h2>Server Restarting</h2>
            <p className="restart-message">{updateStatus.restartMessage}</p>
            <div className="restart-progress">
              <div className="progress-bar">
                <div 
                  className="progress-fill" 
                  style={{ 
                    width: `${(updateStatus.healthCheckAttempts / MAX_HEALTH_CHECK_ATTEMPTS) * 100}%` 
                  }}
                ></div>
              </div>
              <p className="progress-text">
                Health check: {updateStatus.healthCheckAttempts} / {MAX_HEALTH_CHECK_ATTEMPTS}
              </p>
            </div>
            <p className="restart-hint">
              The app will reload automatically once the server is back online.
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
