/**
 * Message Logger
 * 
 * Provides comprehensive logging for debugging message delivery issues.
 * Supports different log levels, filtering, and export capabilities.
 * 
 * Requirements: 5.8, 4.7
 */

/**
 * Log levels
 */
export enum LogLevel {
  DEBUG = 0,
  INFO = 1,
  WARN = 2,
  ERROR = 3
}

/**
 * Log entry
 */
export interface LogEntry {
  timestamp: Date;
  level: LogLevel;
  category: string;
  message: string;
  data?: any;
  messageId?: string;
  relayUrl?: string;
  error?: Error;
}

/**
 * Log filter options
 */
export interface LogFilterOptions {
  level?: LogLevel;
  category?: string;
  messageId?: string;
  relayUrl?: string;
  startTime?: Date;
  endTime?: Date;
}

/**
 * Message Logger Class
 */
class MessageLogger {
  private logs: LogEntry[] = [];
  private maxLogs: number = 5000;
  private minLevel: LogLevel = LogLevel.INFO;
  private enabled: boolean = true;
  private categories: Set<string> = new Set();

  /**
   * Set minimum log level
   */
  setLevel(level: LogLevel): void {
    this.minLevel = level;
    console.log(`[MessageLogger] Log level set to ${LogLevel[level]}`);
  }

  /**
   * Enable logging
   */
  enable(): void {
    this.enabled = true;
    console.log('[MessageLogger] Logging enabled');
  }

  /**
   * Disable logging
   */
  disable(): void {
    this.enabled = false;
    console.log('[MessageLogger] Logging disabled');
  }

  /**
   * Check if logging is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Clear all logs
   */
  clear(): void {
    this.logs = [];
    this.categories.clear();
    console.log('[MessageLogger] Logs cleared');
  }

  /**
   * Log a debug message
   */
  debug(category: string, message: string, data?: any, messageId?: string, relayUrl?: string): void {
    this.log(LogLevel.DEBUG, category, message, data, messageId, relayUrl);
  }

  /**
   * Log an info message
   */
  info(category: string, message: string, data?: any, messageId?: string, relayUrl?: string): void {
    this.log(LogLevel.INFO, category, message, data, messageId, relayUrl);
  }

  /**
   * Log a warning
   */
  warn(category: string, message: string, data?: any, messageId?: string, relayUrl?: string): void {
    this.log(LogLevel.WARN, category, message, data, messageId, relayUrl);
  }

  /**
   * Log an error
   */
  error(category: string, message: string, error?: Error, data?: any, messageId?: string, relayUrl?: string): void {
    this.log(LogLevel.ERROR, category, message, data, messageId, relayUrl, error);
  }

  /**
   * Internal log method
   */
  private log(
    level: LogLevel,
    category: string,
    message: string,
    data?: any,
    messageId?: string,
    relayUrl?: string,
    error?: Error
  ): void {
    if (!this.enabled || level < this.minLevel) {
      return;
    }

    const entry: LogEntry = {
      timestamp: new Date(),
      level,
      category,
      message,
      data,
      messageId,
      relayUrl,
      error
    };

    // Add to logs
    this.logs.push(entry);
    this.categories.add(category);

    // Limit log size
    if (this.logs.length > this.maxLogs) {
      this.logs.shift();
    }

    // Output to console
    this.outputToConsole(entry);
  }

  /**
   * Output log entry to console
   */
  private outputToConsole(entry: LogEntry): void {
    const timestamp = entry.timestamp.toISOString();
    const levelStr = LogLevel[entry.level].padEnd(5);
    const messageId = entry.messageId ? ` [${entry.messageId.substring(0, 8)}]` : '';
    const relay = entry.relayUrl ? ` [${entry.relayUrl}]` : '';
    
    const logMessage = `[${timestamp}] [${levelStr}] [${entry.category}]${messageId}${relay} ${entry.message}`;

    switch (entry.level) {
      case LogLevel.DEBUG:
        console.debug(logMessage, entry.data);
        break;
      case LogLevel.INFO:
        console.log(logMessage, entry.data);
        break;
      case LogLevel.WARN:
        console.warn(logMessage, entry.data);
        break;
      case LogLevel.ERROR:
        console.error(logMessage, entry.error || entry.data);
        break;
    }
  }

  /**
   * Get logs with optional filtering
   */
  getLogs(filter?: LogFilterOptions): LogEntry[] {
    let filtered = this.logs;

    if (filter) {
      if (filter.level !== undefined) {
        filtered = filtered.filter(log => log.level >= filter.level!);
      }

      if (filter.category) {
        filtered = filtered.filter(log => log.category === filter.category);
      }

      if (filter.messageId) {
        filtered = filtered.filter(log => log.messageId === filter.messageId);
      }

      if (filter.relayUrl) {
        filtered = filtered.filter(log => log.relayUrl === filter.relayUrl);
      }

      if (filter.startTime) {
        filtered = filtered.filter(log => log.timestamp >= filter.startTime!);
      }

      if (filter.endTime) {
        filtered = filtered.filter(log => log.timestamp <= filter.endTime!);
      }
    }

    return filtered;
  }

  /**
   * Get all log categories
   */
  getCategories(): string[] {
    return Array.from(this.categories);
  }

  /**
   * Get logs for a specific message
   */
  getMessageLogs(messageId: string): LogEntry[] {
    return this.getLogs({ messageId });
  }

  /**
   * Get logs for a specific relay
   */
  getRelayLogs(relayUrl: string): LogEntry[] {
    return this.getLogs({ relayUrl });
  }

  /**
   * Get error logs
   */
  getErrors(): LogEntry[] {
    return this.getLogs({ level: LogLevel.ERROR });
  }

  /**
   * Export logs as JSON
   */
  exportLogs(filter?: LogFilterOptions): string {
    const logs = this.getLogs(filter);
    
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      totalLogs: logs.length,
      logs: logs.map(log => ({
        timestamp: log.timestamp.toISOString(),
        level: LogLevel[log.level],
        category: log.category,
        message: log.message,
        messageId: log.messageId,
        relayUrl: log.relayUrl,
        data: log.data,
        error: log.error ? {
          name: log.error.name,
          message: log.error.message,
          stack: log.error.stack
        } : undefined
      }))
    }, null, 2);
  }

  /**
   * Export logs as CSV
   */
  exportLogsCSV(filter?: LogFilterOptions): string {
    const logs = this.getLogs(filter);
    
    const headers = ['Timestamp', 'Level', 'Category', 'Message', 'MessageID', 'RelayURL', 'Error'];
    const rows = logs.map(log => [
      log.timestamp.toISOString(),
      LogLevel[log.level],
      log.category,
      log.message,
      log.messageId || '',
      log.relayUrl || '',
      log.error?.message || ''
    ]);

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    return csvContent;
  }

  /**
   * Get log statistics
   */
  getStatistics(): {
    total: number;
    byLevel: Record<string, number>;
    byCategory: Record<string, number>;
    errorCount: number;
    warningCount: number;
  } {
    const byLevel: Record<string, number> = {};
    const byCategory: Record<string, number> = {};
    let errorCount = 0;
    let warningCount = 0;

    for (const log of this.logs) {
      // Count by level
      const levelName = LogLevel[log.level];
      byLevel[levelName] = (byLevel[levelName] || 0) + 1;

      // Count by category
      byCategory[log.category] = (byCategory[log.category] || 0) + 1;

      // Count errors and warnings
      if (log.level === LogLevel.ERROR) {
        errorCount++;
      } else if (log.level === LogLevel.WARN) {
        warningCount++;
      }
    }

    return {
      total: this.logs.length,
      byLevel,
      byCategory,
      errorCount,
      warningCount
    };
  }
}

// Export singleton instance
export const messageLogger = new MessageLogger();

// Expose to window for browser console access
if (typeof window !== 'undefined') {
  (window as any).messageLogger = messageLogger;
}

// Helper functions for common logging scenarios

export const logMessageSent = (messageId: string, recipientPubkey: string, content: string) => {
  messageLogger.info('message-send', `Message sent to ${recipientPubkey.substring(0, 8)}`, 
    { content: content.substring(0, 50) }, messageId);
};

export const logMessageReceived = (messageId: string, senderPubkey: string, content: string) => {
  messageLogger.info('message-receive', `Message received from ${senderPubkey.substring(0, 8)}`, 
    { content: content.substring(0, 50) }, messageId);
};

export const logRelayPublish = (messageId: string, relayUrl: string, success: boolean, error?: string) => {
  if (success) {
    messageLogger.info('relay-publish', `Published to relay`, undefined, messageId, relayUrl);
  } else {
    messageLogger.warn('relay-publish', `Failed to publish to relay: ${error}`, undefined, messageId, relayUrl);
  }
};

export const logEncryptionError = (messageId: string, error: Error) => {
  messageLogger.error('encryption', 'Encryption failed', error, undefined, messageId);
};

export const logDecryptionError = (messageId: string, error: Error) => {
  messageLogger.error('decryption', 'Decryption failed', error, undefined, messageId);
};

export const logStorageError = (operation: string, error: Error, messageId?: string) => {
  messageLogger.error('storage', `Storage operation failed: ${operation}`, error, undefined, messageId);
};

export const logNetworkError = (error: Error, relayUrl?: string) => {
  messageLogger.error('network', 'Network error occurred', error, undefined, undefined, relayUrl);
};
