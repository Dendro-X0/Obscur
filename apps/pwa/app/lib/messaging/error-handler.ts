/**
 * Comprehensive Error Handling for Messaging System
 * 
 * Implements:
 * - Network connectivity monitoring
 * - Graceful degradation for relay failures
 * - User-friendly error messages and recovery options
 * 
 * Requirements: 7.1, 7.2, 7.3, 7.4, 7.8
 */

/**
 * Error types for messaging system
 */
export enum MessageErrorType {
  NETWORK_OFFLINE = 'NETWORK_OFFLINE',
  ALL_RELAYS_FAILED = 'ALL_RELAYS_FAILED',
  ENCRYPTION_FAILED = 'ENCRYPTION_FAILED',
  DECRYPTION_FAILED = 'DECRYPTION_FAILED',
  SIGNATURE_FAILED = 'SIGNATURE_FAILED',
  STORAGE_FAILED = 'STORAGE_FAILED',
  INVALID_INPUT = 'INVALID_INPUT',
  RELAY_TIMEOUT = 'RELAY_TIMEOUT',
  UNKNOWN = 'UNKNOWN'
}

/**
 * Structured error with recovery options
 */
export interface MessageError {
  type: MessageErrorType;
  message: string;
  userMessage: string;
  recoverable: boolean;
  recoveryOptions?: RecoveryOption[];
  originalError?: Error;
  context?: Record<string, any>;
}

/**
 * Recovery action that can be taken
 */
export interface RecoveryOption {
  label: string;
  action: 'retry' | 'queue' | 'dismiss' | 'reconnect' | 'clear_cache';
  description: string;
}

/**
 * Network connectivity state
 */
export interface NetworkState {
  isOnline: boolean;
  hasRelayConnection: boolean;
  lastOnlineAt?: Date;
  lastOfflineAt?: Date;
}

/**
 * Error handler class
 */
export class ErrorHandler {
  private networkState: NetworkState = {
    isOnline: typeof navigator !== 'undefined' ? navigator.onLine : true,
    hasRelayConnection: false
  };

  private listeners: Set<(state: NetworkState) => void> = new Set();
  private errorListeners: Set<(error: MessageError) => void> = new Set();

  constructor() {
    this.initializeNetworkMonitoring();
  }

  /**
   * Initialize network connectivity monitoring
   * Requirement 7.1: Handle network connectivity changes
   */
  private initializeNetworkMonitoring(): void {
    if (typeof window === 'undefined') return;

    // Monitor online/offline events
    window.addEventListener('online', this.handleOnline);
    window.addEventListener('offline', this.handleOffline);

    // Initial state
    this.updateNetworkState({
      isOnline: navigator.onLine
    });
  }

  /**
   * Handle online event
   */
  private handleOnline = (): void => {
    console.log('Network connection restored');
    this.updateNetworkState({
      isOnline: true,
      lastOnlineAt: new Date()
    });
  };

  /**
   * Handle offline event
   */
  private handleOffline = (): void => {
    console.log('Network connection lost');
    this.updateNetworkState({
      isOnline: false,
      hasRelayConnection: false,
      lastOfflineAt: new Date()
    });
  };

  /**
   * Update network state and notify listeners
   */
  private updateNetworkState(updates: Partial<NetworkState>): void {
    this.networkState = {
      ...this.networkState,
      ...updates
    };

    this.notifyNetworkListeners();
  }

  /**
   * Update relay connection status
   */
  updateRelayConnectionStatus(hasConnection: boolean): void {
    if (this.networkState.hasRelayConnection !== hasConnection) {
      this.updateNetworkState({ hasRelayConnection: hasConnection });
    }
  }

  /**
   * Get current network state
   */
  getNetworkState(): NetworkState {
    return { ...this.networkState };
  }

  /**
   * Subscribe to network state changes
   */
  subscribeToNetworkChanges(listener: (state: NetworkState) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Subscribe to error notifications
   */
  subscribeToErrors(listener: (error: MessageError) => void): () => void {
    this.errorListeners.add(listener);
    return () => {
      this.errorListeners.delete(listener);
    };
  }

  /**
   * Notify network state listeners
   */
  private notifyNetworkListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.networkState);
      } catch (error) {
        console.error('Error in network state listener:', error);
      }
    });
  }

  /**
   * Notify error listeners
   */
  private notifyErrorListeners(error: MessageError): void {
    this.errorListeners.forEach(listener => {
      try {
        listener(error);
      } catch (err) {
        console.error('Error in error listener:', err);
      }
    });
  }

  /**
   * Handle encryption error
   * Requirement 7.4: Show clear error message for encryption failures
   */
  handleEncryptionError(error: Error, context?: Record<string, any>): MessageError {
    const messageError: MessageError = {
      type: MessageErrorType.ENCRYPTION_FAILED,
      message: `Encryption failed: ${error.message}`,
      userMessage: 'Failed to encrypt your message. Please try again.',
      recoverable: true,
      recoveryOptions: [
        {
          label: 'Retry',
          action: 'retry',
          description: 'Try sending the message again'
        },
        {
          label: 'Dismiss',
          action: 'dismiss',
          description: 'Cancel sending this message'
        }
      ],
      originalError: error,
      context
    };

    this.notifyErrorListeners(messageError);
    return messageError;
  }

  /**
   * Handle decryption error
   * Requirement 7.5: Handle decryption failures without crashing
   */
  handleDecryptionError(error: Error, context?: Record<string, any>): MessageError {
    const messageError: MessageError = {
      type: MessageErrorType.DECRYPTION_FAILED,
      message: `Decryption failed: ${error.message}`,
      userMessage: 'Unable to decrypt this message. It may be corrupted or sent with an incompatible encryption method.',
      recoverable: false,
      originalError: error,
      context
    };

    this.notifyErrorListeners(messageError);
    return messageError;
  }

  /**
   * Handle relay failure
   * Requirement 7.3: Log error and try other relays
   */
  handleRelayError(relayUrl: string, error: Error | string, context?: Record<string, any>): MessageError {
    const errorMessage = typeof error === 'string' ? error : error.message;
    
    const messageError: MessageError = {
      type: MessageErrorType.ALL_RELAYS_FAILED,
      message: `Relay ${relayUrl} failed: ${errorMessage}`,
      userMessage: 'Some relays are unavailable. Your message will be sent to available relays.',
      recoverable: true,
      recoveryOptions: [
        {
          label: 'Retry',
          action: 'retry',
          description: 'Try sending to this relay again'
        },
        {
          label: 'Continue',
          action: 'dismiss',
          description: 'Continue with other relays'
        }
      ],
      originalError: typeof error === 'string' ? undefined : error,
      context: { ...context, relayUrl }
    };

    this.notifyErrorListeners(messageError);
    return messageError;
  }

  /**
   * Handle all relays failed
   * Requirement 7.1: Queue messages when all relays fail
   */
  handleAllRelaysFailed(context?: Record<string, any>): MessageError {
    const messageError: MessageError = {
      type: MessageErrorType.ALL_RELAYS_FAILED,
      message: 'All relay connections failed',
      userMessage: this.networkState.isOnline
        ? 'Unable to connect to any relays. Your message has been queued and will be sent when a connection is available.'
        : 'You are offline. Your message has been queued and will be sent when you reconnect.',
      recoverable: true,
      recoveryOptions: [
        {
          label: 'Reconnect',
          action: 'reconnect',
          description: 'Try reconnecting to relays'
        },
        {
          label: 'View Queue',
          action: 'queue',
          description: 'See queued messages'
        }
      ],
      context
    };

    this.notifyErrorListeners(messageError);
    return messageError;
  }

  /**
   * Handle storage error
   * Requirement 7.8: Handle storage errors with recovery
   */
  handleStorageError(error: Error, context?: Record<string, any>): MessageError {
    const messageError: MessageError = {
      type: MessageErrorType.STORAGE_FAILED,
      message: `Storage operation failed: ${error.message}`,
      userMessage: 'Failed to save message locally. Your storage may be full or unavailable.',
      recoverable: true,
      recoveryOptions: [
        {
          label: 'Clear Cache',
          action: 'clear_cache',
          description: 'Clear old messages to free up space'
        },
        {
          label: 'Retry',
          action: 'retry',
          description: 'Try saving again'
        },
        {
          label: 'Continue',
          action: 'dismiss',
          description: 'Continue without saving locally'
        }
      ],
      originalError: error,
      context
    };

    this.notifyErrorListeners(messageError);
    return messageError;
  }

  /**
   * Handle network offline
   * Requirement 7.1: Handle network connectivity loss
   */
  handleNetworkOffline(context?: Record<string, any>): MessageError {
    const messageError: MessageError = {
      type: MessageErrorType.NETWORK_OFFLINE,
      message: 'Network connection is offline',
      userMessage: 'You are offline. Messages will be queued and sent when you reconnect.',
      recoverable: true,
      recoveryOptions: [
        {
          label: 'View Queue',
          action: 'queue',
          description: 'See queued messages'
        },
        {
          label: 'Dismiss',
          action: 'dismiss',
          description: 'Close this message'
        }
      ],
      context
    };

    this.notifyErrorListeners(messageError);
    return messageError;
  }

  /**
   * Handle invalid input
   * Requirement 7.4: Show clear error messages
   */
  handleInvalidInput(reason: string, context?: Record<string, any>): MessageError {
    const messageError: MessageError = {
      type: MessageErrorType.INVALID_INPUT,
      message: `Invalid input: ${reason}`,
      userMessage: reason,
      recoverable: true,
      recoveryOptions: [
        {
          label: 'Dismiss',
          action: 'dismiss',
          description: 'Close this message'
        }
      ],
      context
    };

    this.notifyErrorListeners(messageError);
    return messageError;
  }

  /**
   * Handle unknown error
   * Requirement 7.8: Handle unexpected errors gracefully
   */
  handleUnknownError(error: Error, context?: Record<string, any>): MessageError {
    const messageError: MessageError = {
      type: MessageErrorType.UNKNOWN,
      message: `Unexpected error: ${error.message}`,
      userMessage: 'An unexpected error occurred. Please try again.',
      recoverable: true,
      recoveryOptions: [
        {
          label: 'Retry',
          action: 'retry',
          description: 'Try the operation again'
        },
        {
          label: 'Dismiss',
          action: 'dismiss',
          description: 'Close this message'
        }
      ],
      originalError: error,
      context
    };

    this.notifyErrorListeners(messageError);
    return messageError;
  }

  /**
   * Check if operation should be attempted based on network state
   */
  canAttemptOperation(): { canAttempt: boolean; reason?: string } {
    if (!this.networkState.isOnline) {
      return {
        canAttempt: false,
        reason: 'Network is offline'
      };
    }

    if (!this.networkState.hasRelayConnection) {
      return {
        canAttempt: false,
        reason: 'No relay connections available'
      };
    }

    return { canAttempt: true };
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (typeof window !== 'undefined') {
      window.removeEventListener('online', this.handleOnline);
      window.removeEventListener('offline', this.handleOffline);
    }
    this.listeners.clear();
    this.errorListeners.clear();
  }
}

/**
 * Global error handler instance
 */
export const errorHandler = new ErrorHandler();
