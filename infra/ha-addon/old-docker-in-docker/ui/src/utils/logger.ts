/**
 * Conditional Logger Utility
 * 
 * Provides logging that only outputs in development mode.
 * In production, sensitive data is never logged to console.
 * 
 * Usage:
 *   import { logger } from '@/utils/logger';
 *   logger.info('Connection established', { port: 8888 });
 *   logger.error('Failed to connect', error);
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LoggerConfig {
  enabled: boolean;
  minLevel: LogLevel;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3,
};

class Logger {
  private config: LoggerConfig;

  constructor() {
    // Only enable logging in development mode
    const isDev = import.meta.env.DEV || import.meta.env.MODE === 'development';
    
    this.config = {
      enabled: isDev,
      minLevel: isDev ? 'debug' : 'error', // Production only logs errors
    };
  }

  private shouldLog(level: LogLevel): boolean {
    if (!this.config.enabled) return false;
    return LOG_LEVELS[level] >= LOG_LEVELS[this.config.minLevel];
  }

  private formatMessage(level: LogLevel, message: string, data?: any): void {
    if (!this.shouldLog(level)) return;

    const timestamp = new Date().toISOString();
    const prefix = `[${timestamp}] [${level.toUpperCase()}]`;

    switch (level) {
      case 'debug':
        console.debug(prefix, message, data ?? '');
        break;
      case 'info':
        console.info(prefix, message, data ?? '');
        break;
      case 'warn':
        console.warn(prefix, message, data ?? '');
        break;
      case 'error':
        console.error(prefix, message, data ?? '');
        break;
    }
  }

  debug(message: string, data?: any): void {
    this.formatMessage('debug', message, data);
  }

  info(message: string, data?: any): void {
    this.formatMessage('info', message, data);
  }

  warn(message: string, data?: any): void {
    this.formatMessage('warn', message, data);
  }

  error(message: string, error?: any): void {
    this.formatMessage('error', message, error);
  }

  /**
   * Force log even in production (use sparingly, only for critical errors)
   */
  forceLog(message: string, data?: any): void {
    const timestamp = new Date().toISOString();
    console.error(`[${timestamp}] [CRITICAL]`, message, data ?? '');
  }
}

// Export singleton instance
export const logger = new Logger();

// For backwards compatibility, export individual functions
export const logDebug = (message: string, data?: any) => logger.debug(message, data);
export const logInfo = (message: string, data?: any) => logger.info(message, data);
export const logWarn = (message: string, data?: any) => logger.warn(message, data);
export const logError = (message: string, error?: any) => logger.error(message, error);
