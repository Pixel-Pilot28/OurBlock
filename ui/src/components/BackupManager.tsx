import React, { useState, useEffect } from 'react';
import { logger } from '../utils/logger';

/**
 * BackupManager Component
 * 
 * Provides UI for managing automated backups:
 * - View last backup timestamp
 * - Download latest encrypted backup
 * - Trigger manual backup
 * - View backup history
 * 
 * Security: Backups are AES-256 encrypted using ADMIN_API_KEY
 */

interface BackupInfo {
  timestamp: string;
  size: string;
  filename: string;
}

export const BackupManager: React.FC = () => {
  const [lastBackup, setLastBackup] = useState<BackupInfo | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [downloading, setDownloading] = useState(false);

  // Fetch backup info on mount
  useEffect(() => {
    fetchBackupInfo();
  }, []);

  /**
   * Fetches information about the latest backup
   */
  const fetchBackupInfo = async () => {
    try {
      setIsLoading(true);
      setError(null);

      // Query sidecar API for backup status
      const response = await fetch('/api/system/backup/status', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_api_key')}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      const data = await response.json();
      setLastBackup(data);
      
      logger.info('Backup info fetched', data);
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to fetch backup info';
      setError(message);
      logger.error('Failed to fetch backup info', err);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Downloads the latest encrypted backup file
   */
  const downloadBackup = async () => {
    try {
      setDownloading(true);
      setError(null);

      logger.info('Downloading latest backup...');

      // Fetch backup file from sidecar
      const response = await fetch('/api/system/backup/download', {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_api_key')}`,
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Get filename from Content-Disposition header
      const contentDisposition = response.headers.get('Content-Disposition');
      const filenameMatch = contentDisposition?.match(/filename="(.+)"/);
      const filename = filenameMatch?.[1] || 'ourblock_backup.tar.gz.enc';

      // Download file
      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);

      logger.info('Backup downloaded', { filename, size: blob.size });
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to download backup';
      setError(message);
      logger.error('Failed to download backup', err);
    } finally {
      setDownloading(false);
    }
  };

  /**
   * Triggers a manual backup (runs backup script immediately)
   */
  const triggerManualBackup = async () => {
    try {
      setIsLoading(true);
      setError(null);

      logger.info('Triggering manual backup...');

      const response = await fetch('/api/system/backup/trigger', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('admin_api_key')}`,
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }

      // Refresh backup info after a few seconds
      setTimeout(() => {
        fetchBackupInfo();
      }, 5000);

      logger.info('Manual backup triggered successfully');
    } catch (err) {
      const message = err instanceof Error ? err.message : 'Failed to trigger backup';
      setError(message);
      logger.error('Failed to trigger backup', err);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Formats timestamp for display
   */
  const formatTimestamp = (timestamp: string): string => {
    try {
      const date = new Date(timestamp);
      return date.toLocaleString('en-US', {
        dateStyle: 'medium',
        timeStyle: 'short',
      });
    } catch {
      return timestamp;
    }
  };

  return (
    <div className="bg-white rounded-lg shadow-md p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-2xl font-bold text-gray-900">Automated Backups</h2>
        <button
          onClick={fetchBackupInfo}
          disabled={isLoading}
          className="px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 disabled:opacity-50"
        >
          {isLoading ? 'Refreshing...' : 'Refresh'}
        </button>
      </div>

      {/* Error Display */}
      {error && (
        <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-lg">
          <p className="text-red-800 text-sm">{error}</p>
        </div>
      )}

      {/* Backup Info */}
      {lastBackup ? (
        <div className="space-y-4">
          {/* Last Backup Stats */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 bg-green-50 rounded-lg">
              <p className="text-sm text-green-600 font-medium">Last Backup</p>
              <p className="text-lg font-bold text-green-900">
                {formatTimestamp(lastBackup.timestamp)}
              </p>
            </div>
            <div className="p-4 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-600 font-medium">Backup Size</p>
              <p className="text-lg font-bold text-blue-900">{lastBackup.size}</p>
            </div>
            <div className="p-4 bg-purple-50 rounded-lg">
              <p className="text-sm text-purple-600 font-medium">Encryption</p>
              <p className="text-lg font-bold text-purple-900">AES-256-CBC</p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={downloadBackup}
              disabled={downloading}
              className="flex-1 px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {downloading ? (
                <span className="flex items-center justify-center">
                  <svg className="animate-spin -ml-1 mr-3 h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Downloading...
                </span>
              ) : (
                'Download Latest Backup'
              )}
            </button>

            <button
              onClick={triggerManualBackup}
              disabled={isLoading}
              className="flex-1 px-6 py-3 bg-green-600 text-white font-medium rounded-lg hover:bg-green-700 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Trigger Manual Backup
            </button>
          </div>

          {/* Info Box */}
          <div className="p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
            <div className="flex">
              <div className="flex-shrink-0">
                <svg className="h-5 w-5 text-yellow-400" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor">
                  <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-yellow-800">Important</h3>
                <div className="mt-2 text-sm text-yellow-700">
                  <ul className="list-disc list-inside space-y-1">
                    <li>Backups are automatically created daily at 3 AM</li>
                    <li>All backups are encrypted with your ADMIN_API_KEY</li>
                    <li>Keep your encryption key safe - you'll need it to restore</li>
                    <li>Store backups in multiple secure locations</li>
                    <li>Backups older than 30 days are automatically deleted</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>

          {/* Restoration Instructions */}
          <details className="p-4 bg-gray-50 rounded-lg">
            <summary className="font-medium text-gray-900 cursor-pointer">
              How to restore from backup
            </summary>
            <div className="mt-4 text-sm text-gray-700 space-y-2">
              <p className="font-medium">To restore your neighborhood from a backup:</p>
              <ol className="list-decimal list-inside space-y-2 ml-4">
                <li>Stop the OurBlock conductor: <code className="bg-gray-200 px-2 py-1 rounded">docker compose down</code></li>
                <li>Decrypt the backup file:
                  <pre className="mt-1 bg-gray-800 text-green-400 p-2 rounded overflow-x-auto">
                    openssl enc -aes-256-cbc -d -pbkdf2 -iter 100000 \<br/>
                    {'  '}-in backup.tar.gz.enc -out backup.tar.gz \<br/>
                    {'  '}-pass pass:YOUR_ADMIN_API_KEY
                  </pre>
                </li>
                <li>Extract the backup: <code className="bg-gray-200 px-2 py-1 rounded">tar -xzf backup.tar.gz</code></li>
                <li>Copy storage and lair directories to their original locations</li>
                <li>Restart the conductor: <code className="bg-gray-200 px-2 py-1 rounded">docker compose up -d</code></li>
              </ol>
            </div>
          </details>
        </div>
      ) : (
        !isLoading && (
          <div className="text-center py-12">
            <svg className="mx-auto h-12 w-12 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
            </svg>
            <p className="mt-2 text-gray-500">No backups found</p>
            <button
              onClick={triggerManualBackup}
              className="mt-4 px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700"
            >
              Create First Backup
            </button>
          </div>
        )
      )}

      {/* Loading State */}
      {isLoading && !lastBackup && (
        <div className="flex items-center justify-center py-12">
          <svg className="animate-spin h-8 w-8 text-blue-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
          </svg>
          <span className="ml-3 text-gray-600">Loading backup info...</span>
        </div>
      )}
    </div>
  );
};

export default BackupManager;
