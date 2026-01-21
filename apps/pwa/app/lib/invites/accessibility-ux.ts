/**
 * Accessibility and User Experience Enhancements
 * Provides loading states, error messages, and accessibility helpers
 */

/**
 * Loading state management
 */
export interface LoadingState {
  isLoading: boolean;
  message?: string;
  progress?: number;
}

export class LoadingStateManager {
  private states: Map<string, LoadingState>;
  private listeners: Map<string, Set<(state: LoadingState) => void>>;

  constructor() {
    this.states = new Map();
    this.listeners = new Map();
  }

  /**
   * Set loading state for an operation
   */
  setLoading(key: string, message?: string, progress?: number): void {
    const state: LoadingState = {
      isLoading: true,
      message,
      progress
    };

    this.states.set(key, state);
    this.notifyListeners(key, state);
  }

  /**
   * Clear loading state
   */
  clearLoading(key: string): void {
    const state: LoadingState = {
      isLoading: false
    };

    this.states.set(key, state);
    this.notifyListeners(key, state);
  }

  /**
   * Get current loading state
   */
  getState(key: string): LoadingState {
    return this.states.get(key) || { isLoading: false };
  }

  /**
   * Subscribe to loading state changes
   */
  subscribe(key: string, callback: (state: LoadingState) => void): () => void {
    if (!this.listeners.has(key)) {
      this.listeners.set(key, new Set());
    }

    this.listeners.get(key)!.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.get(key)?.delete(callback);
    };
  }

  private notifyListeners(key: string, state: LoadingState): void {
    const listeners = this.listeners.get(key);
    if (listeners) {
      listeners.forEach(callback => callback(state));
    }
  }
}

/**
 * User-friendly error messages
 */
export interface ErrorInfo {
  code: string;
  message: string;
  userMessage: string;
  suggestions: string[];
  severity: 'error' | 'warning' | 'info';
}

export class ErrorMessageFormatter {
  private errorMap: Map<string, Omit<ErrorInfo, 'code'>>;

  constructor() {
    this.errorMap = new Map();
    this.initializeErrorMessages();
  }

  private initializeErrorMessages(): void {
    // Invite-related errors
    this.errorMap.set('INVITE_EXPIRED', {
      message: 'Invite has expired',
      userMessage: 'This invite link has expired and can no longer be used.',
      suggestions: [
        'Ask the sender to create a new invite link',
        'Check if you have another invite from this person'
      ],
      severity: 'error'
    });

    this.errorMap.set('INVITE_REVOKED', {
      message: 'Invite has been revoked',
      userMessage: 'This invite has been cancelled by the sender.',
      suggestions: [
        'Contact the sender to get a new invite',
        'Verify you have the correct invite link'
      ],
      severity: 'error'
    });

    this.errorMap.set('INVALID_QR_CODE', {
      message: 'Invalid QR code format',
      userMessage: 'The QR code could not be read. Please try again.',
      suggestions: [
        'Ensure the QR code is clearly visible',
        'Try scanning from a different angle',
        'Ask for a new QR code if the problem persists'
      ],
      severity: 'error'
    });

    this.errorMap.set('NETWORK_ERROR', {
      message: 'Network connection failed',
      userMessage: 'Unable to connect to the network. Please check your connection.',
      suggestions: [
        'Check your internet connection',
        'Try again in a few moments',
        'Verify you\'re not in airplane mode'
      ],
      severity: 'error'
    });

    this.errorMap.set('STORAGE_FULL', {
      message: 'Storage quota exceeded',
      userMessage: 'Your device storage is full. Please free up some space.',
      suggestions: [
        'Delete old contacts or messages',
        'Clear browser cache',
        'Remove unused data from your device'
      ],
      severity: 'error'
    });

    this.errorMap.set('CONTACT_EXISTS', {
      message: 'Contact already exists',
      userMessage: 'You\'re already connected with this person.',
      suggestions: [
        'Check your contacts list',
        'Search for the contact by name'
      ],
      severity: 'info'
    });

    this.errorMap.set('INVALID_PUBLIC_KEY', {
      message: 'Invalid public key format',
      userMessage: 'The connection information is invalid.',
      suggestions: [
        'Ask the sender for a new invite',
        'Verify you copied the entire invite link'
      ],
      severity: 'error'
    });

    this.errorMap.set('IMPORT_FAILED', {
      message: 'Contact import failed',
      userMessage: 'Some contacts could not be imported.',
      suggestions: [
        'Check the file format',
        'Verify the file is not corrupted',
        'Try importing a smaller batch'
      ],
      severity: 'warning'
    });
  }

  /**
   * Get formatted error information
   */
  getErrorInfo(code: string, originalError?: Error): ErrorInfo {
    const errorInfo = this.errorMap.get(code);

    if (!errorInfo) {
      return {
        code: 'UNKNOWN_ERROR',
        message: originalError?.message || 'An unknown error occurred',
        userMessage: 'Something went wrong. Please try again.',
        suggestions: [
          'Refresh the page',
          'Try again in a few moments',
          'Contact support if the problem persists'
        ],
        severity: 'error'
      };
    }

    return {
      code,
      ...errorInfo
    };
  }

  /**
   * Add custom error message
   */
  addErrorMessage(code: string, info: Omit<ErrorInfo, 'code'>): void {
    this.errorMap.set(code, info);
  }
}

/**
 * Accessibility helpers
 */
export class AccessibilityHelper {
  /**
   * Generate ARIA label for contact
   */
  static getContactAriaLabel(contact: {
    displayName: string;
    trustLevel?: string;
    groups?: string[];
  }): string {
    const parts = [`Contact: ${contact.displayName}`];

    if (contact.trustLevel) {
      parts.push(`Trust level: ${contact.trustLevel}`);
    }

    if (contact.groups && contact.groups.length > 0) {
      parts.push(`Groups: ${contact.groups.length}`);
    }

    return parts.join(', ');
  }

  /**
   * Generate ARIA label for invite link
   */
  static getInviteLinkAriaLabel(invite: {
    displayName?: string;
    expiresAt?: Date;
    isActive: boolean;
  }): string {
    const parts = ['Invite link'];

    if (invite.displayName) {
      parts.push(`for ${invite.displayName}`);
    }

    if (invite.expiresAt) {
      const timeLeft = this.getTimeUntilExpiration(invite.expiresAt);
      parts.push(`expires ${timeLeft}`);
    }

    parts.push(invite.isActive ? 'active' : 'inactive');

    return parts.join(', ');
  }

  /**
   * Generate ARIA label for QR code
   */
  static getQRCodeAriaLabel(options: {
    displayName?: string;
    expirationHours?: number;
  }): string {
    const parts = ['QR code for connection'];

    if (options.displayName) {
      parts.push(`with ${options.displayName}`);
    }

    if (options.expirationHours) {
      parts.push(`valid for ${options.expirationHours} hours`);
    }

    return parts.join(', ');
  }

  /**
   * Get human-readable time until expiration
   */
  private static getTimeUntilExpiration(expiresAt: Date): string {
    const now = new Date();
    const diff = expiresAt.getTime() - now.getTime();

    if (diff <= 0) {
      return 'expired';
    }

    const hours = Math.floor(diff / (1000 * 60 * 60));
    const days = Math.floor(hours / 24);

    if (days > 0) {
      return `in ${days} day${days > 1 ? 's' : ''}`;
    }

    if (hours > 0) {
      return `in ${hours} hour${hours > 1 ? 's' : ''}`;
    }

    const minutes = Math.floor(diff / (1000 * 60));
    return `in ${minutes} minute${minutes > 1 ? 's' : ''}`;
  }

  /**
   * Generate keyboard navigation hints
   */
  static getKeyboardHints(context: 'contact-list' | 'invite-form' | 'qr-scanner'): string[] {
    const hints: Record<string, string[]> = {
      'contact-list': [
        'Use arrow keys to navigate contacts',
        'Press Enter to select a contact',
        'Press Delete to remove selected contact',
        'Type to search contacts'
      ],
      'invite-form': [
        'Tab to move between fields',
        'Enter to submit the form',
        'Escape to cancel'
      ],
      'qr-scanner': [
        'Space to capture QR code',
        'Escape to close scanner',
        'Tab to switch camera'
      ]
    };

    return hints[context] || [];
  }
}

/**
 * Progress indicator for long operations
 */
export interface ProgressInfo {
  current: number;
  total: number;
  message?: string;
  percentage: number;
}

export class ProgressTracker {
  private current: number = 0;
  private total: number = 0;
  private message?: string;
  private listeners: Set<(progress: ProgressInfo) => void>;

  constructor(total: number, message?: string) {
    this.total = total;
    this.message = message;
    this.listeners = new Set();
  }

  /**
   * Update progress
   */
  update(current: number, message?: string): void {
    this.current = Math.min(current, this.total);
    if (message) {
      this.message = message;
    }

    this.notifyListeners();
  }

  /**
   * Increment progress by one
   */
  increment(message?: string): void {
    this.update(this.current + 1, message);
  }

  /**
   * Get current progress info
   */
  getProgress(): ProgressInfo {
    return {
      current: this.current,
      total: this.total,
      message: this.message,
      percentage: this.total > 0 ? (this.current / this.total) * 100 : 0
    };
  }

  /**
   * Subscribe to progress updates
   */
  subscribe(callback: (progress: ProgressInfo) => void): () => void {
    this.listeners.add(callback);

    // Return unsubscribe function
    return () => {
      this.listeners.delete(callback);
    };
  }

  /**
   * Reset progress
   */
  reset(total?: number, message?: string): void {
    this.current = 0;
    if (total !== undefined) {
      this.total = total;
    }
    if (message !== undefined) {
      this.message = message;
    }

    this.notifyListeners();
  }

  private notifyListeners(): void {
    const progress = this.getProgress();
    this.listeners.forEach(callback => callback(progress));
  }
}

/**
 * Contextual help system
 */
export interface HelpContent {
  title: string;
  description: string;
  steps?: string[];
  tips?: string[];
  relatedLinks?: Array<{ text: string; url: string }>;
}

export class ContextualHelp {
  private helpContent: Map<string, HelpContent>;

  constructor() {
    this.helpContent = new Map();
    this.initializeHelpContent();
  }

  private initializeHelpContent(): void {
    this.helpContent.set('qr-generation', {
      title: 'Generating QR Codes',
      description: 'Create a QR code that others can scan to connect with you instantly.',
      steps: [
        'Click "Generate QR Code"',
        'Customize your profile information (optional)',
        'Set an expiration time',
        'Share the QR code with others'
      ],
      tips: [
        'QR codes expire after the set time for security',
        'You can revoke a QR code at any time',
        'Include a personal message to help others identify you'
      ]
    });

    this.helpContent.set('qr-scanning', {
      title: 'Scanning QR Codes',
      description: 'Scan a QR code to quickly connect with someone.',
      steps: [
        'Click "Scan QR Code"',
        'Allow camera access when prompted',
        'Point your camera at the QR code',
        'Review the connection request',
        'Accept or decline the request'
      ],
      tips: [
        'Ensure good lighting for best results',
        'Hold your device steady',
        'The QR code should fill most of the frame'
      ]
    });

    this.helpContent.set('invite-links', {
      title: 'Creating Invite Links',
      description: 'Generate shareable links to connect with others remotely.',
      steps: [
        'Click "Create Invite Link"',
        'Set an expiration time',
        'Add a personal message (optional)',
        'Copy and share the link'
      ],
      tips: [
        'Links can be shared via any messaging app',
        'Set shorter expiration times for better security',
        'You can revoke links if they\'re compromised'
      ]
    });

    this.helpContent.set('contact-organization', {
      title: 'Organizing Contacts',
      description: 'Keep your contacts organized with groups and trust levels.',
      steps: [
        'Create groups for different categories',
        'Add contacts to groups',
        'Set trust levels (trusted, neutral, blocked)',
        'Use search and filters to find contacts'
      ],
      tips: [
        'Contacts can be in multiple groups',
        'Blocked contacts cannot message you',
        'Use descriptive group names'
      ]
    });

    this.helpContent.set('contact-import', {
      title: 'Importing Contacts',
      description: 'Import contacts from other Nostr clients or files.',
      steps: [
        'Click "Import Contacts"',
        'Select your contact file',
        'Review the import preview',
        'Confirm the import'
      ],
      tips: [
        'Supports NIP-02 format',
        'Duplicates are automatically detected',
        'You can import from multiple sources'
      ]
    });
  }

  /**
   * Get help content for a context
   */
  getHelp(context: string): HelpContent | null {
    return this.helpContent.get(context) || null;
  }

  /**
   * Add custom help content
   */
  addHelp(context: string, content: HelpContent): void {
    this.helpContent.set(context, content);
  }

  /**
   * Get all available help contexts
   */
  getAllContexts(): string[] {
    return Array.from(this.helpContent.keys());
  }
}

/**
 * Singleton instances
 */
export const loadingStateManager = new LoadingStateManager();
export const errorMessageFormatter = new ErrorMessageFormatter();
export const contextualHelp = new ContextualHelp();
