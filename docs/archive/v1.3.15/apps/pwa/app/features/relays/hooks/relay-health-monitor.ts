/**
 * Relay Health Monitor
 * 
 * Implements connection health monitoring with:
 * - Relay health metrics and status tracking
 * - Connection retry with exponential backoff
 * - Circuit breaker pattern for failing relays
 * 
 * Requirements: 4.2, 4.3, 4.6, 7.7
 */

/**
 * Circuit breaker states
 */
export type CircuitBreakerState = 'closed' | 'open' | 'half-open';

/**
 * Relay health metrics
 */
export interface RelayHealthMetrics {
  url: string;
  status: 'connected' | 'connecting' | 'disconnected' | 'error';
  
  // Connection metrics
  connectionAttempts: number;
  successfulConnections: number;
  failedConnections: number;
  lastConnectedAt?: Date;
  lastDisconnectedAt?: Date;
  lastErrorAt?: Date;
  lastError?: string;
  
  // Performance metrics
  latency: number; // Average latency in ms
  latencyHistory: number[]; // Last 10 latency measurements
  successRate: number; // Percentage of successful operations
  
  // Circuit breaker
  circuitBreakerState: CircuitBreakerState;
  circuitBreakerOpenedAt?: Date;
  circuitBreakerFailureCount: number;
  
  // Retry tracking
  retryCount: number;
  nextRetryAt?: Date;
  backoffDelay: number; // Current backoff delay in ms
}

/**
 * Circuit breaker configuration
 */
interface CircuitBreakerConfig {
  failureThreshold: number; // Number of failures before opening circuit
  successThreshold: number; // Number of successes to close circuit from half-open
  openDuration: number; // How long to keep circuit open (ms)
  halfOpenMaxAttempts: number; // Max attempts in half-open state
}

/**
 * Exponential backoff configuration
 */
interface BackoffConfig {
  initialDelay: number; // Initial delay in ms
  maxDelay: number; // Maximum delay in ms
  multiplier: number; // Backoff multiplier
  jitter: boolean; // Add random jitter to prevent thundering herd
}

/**
 * Default circuit breaker configuration
 */
const DEFAULT_CIRCUIT_BREAKER_CONFIG: CircuitBreakerConfig = {
  failureThreshold: 5, // Open circuit after 5 consecutive failures
  successThreshold: 2, // Close circuit after 2 consecutive successes
  openDuration: 60000, // Keep circuit open for 60 seconds
  halfOpenMaxAttempts: 3 // Allow 3 attempts in half-open state
};

/**
 * Default exponential backoff configuration
 */
const DEFAULT_BACKOFF_CONFIG: BackoffConfig = {
  initialDelay: 1000, // Start with 1 second
  maxDelay: 300000, // Max 5 minutes
  multiplier: 2, // Double each time
  jitter: true // Add jitter
};

/**
 * Maximum latency history to keep
 */
const MAX_LATENCY_HISTORY = 10;

/**
 * Relay Health Monitor
 * Tracks health metrics for all relays and implements circuit breaker pattern
 */
export class RelayHealthMonitor {
  private metrics: Map<string, RelayHealthMetrics> = new Map();
  private circuitBreakerConfig: CircuitBreakerConfig;
  private backoffConfig: BackoffConfig;
  private listeners: Set<(metrics: Map<string, RelayHealthMetrics>) => void> = new Set();

  constructor(
    circuitBreakerConfig: Partial<CircuitBreakerConfig> = {},
    backoffConfig: Partial<BackoffConfig> = {}
  ) {
    this.circuitBreakerConfig = { ...DEFAULT_CIRCUIT_BREAKER_CONFIG, ...circuitBreakerConfig };
    this.backoffConfig = { ...DEFAULT_BACKOFF_CONFIG, ...backoffConfig };
  }

  /**
   * Initialize metrics for a relay
   */
  initializeRelay(url: string): void {
    if (this.metrics.has(url)) {
      return;
    }

    const metrics: RelayHealthMetrics = {
      url,
      status: 'connecting',
      connectionAttempts: 0,
      successfulConnections: 0,
      failedConnections: 0,
      latency: 0,
      latencyHistory: [],
      successRate: 100,
      circuitBreakerState: 'closed',
      circuitBreakerFailureCount: 0,
      retryCount: 0,
      backoffDelay: this.backoffConfig.initialDelay
    };

    this.metrics.set(url, metrics);
    this.notifyListeners();
  }

  /**
   * Record connection attempt
   */
  recordConnectionAttempt(url: string): void {
    const metrics = this.getOrCreateMetrics(url);
    metrics.connectionAttempts++;
    metrics.status = 'connecting';
    this.metrics.set(url, metrics);
    this.notifyListeners();
  }

  /**
   * Record successful connection
   */
  recordConnectionSuccess(url: string): void {
    const metrics = this.getOrCreateMetrics(url);
    metrics.successfulConnections++;
    metrics.status = 'connected';
    metrics.lastConnectedAt = new Date();
    metrics.retryCount = 0;
    metrics.backoffDelay = this.backoffConfig.initialDelay;
    metrics.nextRetryAt = undefined;

    // Update circuit breaker
    this.updateCircuitBreakerOnSuccess(metrics);

    // Update success rate
    this.updateSuccessRate(metrics);

    this.metrics.set(url, metrics);
    this.notifyListeners();
  }

  /**
   * Record connection failure
   */
  recordConnectionFailure(url: string, error?: string): void {
    const metrics = this.getOrCreateMetrics(url);
    metrics.failedConnections++;
    metrics.status = 'error';
    metrics.lastErrorAt = new Date();
    metrics.lastError = error;
    metrics.lastDisconnectedAt = new Date();

    // Update circuit breaker
    this.updateCircuitBreakerOnFailure(metrics);

    // Calculate next retry time with exponential backoff
    metrics.retryCount++;
    metrics.backoffDelay = this.calculateBackoffDelay(metrics.retryCount);
    metrics.nextRetryAt = new Date(Date.now() + metrics.backoffDelay);

    // Update success rate
    this.updateSuccessRate(metrics);

    this.metrics.set(url, metrics);
    this.notifyListeners();
  }

  /**
   * Record disconnection
   */
  recordDisconnection(url: string): void {
    const metrics = this.getOrCreateMetrics(url);
    metrics.status = 'disconnected';
    metrics.lastDisconnectedAt = new Date();
    this.metrics.set(url, metrics);
    this.notifyListeners();
  }

  /**
   * Record latency measurement
   */
  recordLatency(url: string, latencyMs: number): void {
    const metrics = this.getOrCreateMetrics(url);
    
    // Add to history
    metrics.latencyHistory.push(latencyMs);
    
    // Keep only last N measurements
    if (metrics.latencyHistory.length > MAX_LATENCY_HISTORY) {
      metrics.latencyHistory.shift();
    }
    
    // Calculate average latency
    metrics.latency = metrics.latencyHistory.reduce((sum, l) => sum + l, 0) / metrics.latencyHistory.length;
    
    this.metrics.set(url, metrics);
    this.notifyListeners();
  }

  /**
   * Check if relay can accept connections (circuit breaker check)
   */
  canConnect(url: string): boolean {
    const metrics = this.metrics.get(url);
    if (!metrics) {
      return true; // Allow first connection attempt
    }

    // Check circuit breaker state
    if (metrics.circuitBreakerState === 'open') {
      // Check if enough time has passed to try half-open
      if (metrics.circuitBreakerOpenedAt) {
        const timeSinceOpen = Date.now() - metrics.circuitBreakerOpenedAt.getTime();
        if (timeSinceOpen >= this.circuitBreakerConfig.openDuration) {
          // Transition to half-open
          metrics.circuitBreakerState = 'half-open';
          metrics.circuitBreakerFailureCount = 0;
          this.metrics.set(url, metrics);
          this.notifyListeners();
          return true;
        }
      }
      return false; // Circuit is open, don't allow connection
    }

    // Check if we should wait for backoff
    if (metrics.nextRetryAt && Date.now() < metrics.nextRetryAt.getTime()) {
      return false; // Still in backoff period
    }

    return true; // Circuit is closed or half-open, allow connection
  }

  /**
   * Get health metrics for a relay
   */
  getMetrics(url: string): RelayHealthMetrics | undefined {
    return this.metrics.get(url);
  }

  /**
   * Get all health metrics
   */
  getAllMetrics(): Map<string, RelayHealthMetrics> {
    return new Map(this.metrics);
  }

  /**
   * Get relay health status
   */
  getHealthStatus(url: string): 'healthy' | 'degraded' | 'unhealthy' | 'unknown' {
    const metrics = this.metrics.get(url);
    if (!metrics) {
      return 'unknown';
    }

    // Circuit breaker open = unhealthy
    if (metrics.circuitBreakerState === 'open') {
      return 'unhealthy';
    }

    // Check success rate
    if (metrics.successRate >= 90) {
      return 'healthy';
    } else if (metrics.successRate >= 50) {
      return 'degraded';
    } else {
      return 'unhealthy';
    }
  }

  /**
   * Subscribe to health metric changes
   */
  subscribe(listener: (metrics: Map<string, RelayHealthMetrics>) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Reset metrics for a relay
   */
  resetMetrics(url: string): void {
    this.metrics.delete(url);
    this.notifyListeners();
  }

  /**
   * Clear all metrics
   */
  clearAllMetrics(): void {
    this.metrics.clear();
    this.notifyListeners();
  }

  // Private helper methods

  private getOrCreateMetrics(url: string): RelayHealthMetrics {
    let metrics = this.metrics.get(url);
    if (!metrics) {
      this.initializeRelay(url);
      metrics = this.metrics.get(url)!;
    }
    return { ...metrics }; // Return copy to avoid mutations
  }

  private updateCircuitBreakerOnSuccess(metrics: RelayHealthMetrics): void {
    if (metrics.circuitBreakerState === 'closed') {
      // Already closed, reset failure count
      metrics.circuitBreakerFailureCount = 0;
    } else if (metrics.circuitBreakerState === 'half-open') {
      // In half-open state, count successes
      metrics.circuitBreakerFailureCount = 0;
      
      // After enough successes, close the circuit
      if (metrics.successfulConnections >= this.circuitBreakerConfig.successThreshold) {
        metrics.circuitBreakerState = 'closed';
        metrics.circuitBreakerOpenedAt = undefined;
      }
    }
  }

  private updateCircuitBreakerOnFailure(metrics: RelayHealthMetrics): void {
    metrics.circuitBreakerFailureCount++;

    if (metrics.circuitBreakerState === 'closed') {
      // Check if we should open the circuit
      if (metrics.circuitBreakerFailureCount >= this.circuitBreakerConfig.failureThreshold) {
        metrics.circuitBreakerState = 'open';
        metrics.circuitBreakerOpenedAt = new Date();
      }
    } else if (metrics.circuitBreakerState === 'half-open') {
      // Failure in half-open state, reopen circuit
      metrics.circuitBreakerState = 'open';
      metrics.circuitBreakerOpenedAt = new Date();
    }
  }

  private calculateBackoffDelay(retryCount: number): number {
    // Calculate exponential backoff: initialDelay * (multiplier ^ retryCount)
    let delay = this.backoffConfig.initialDelay * Math.pow(this.backoffConfig.multiplier, retryCount - 1);
    
    // Cap at max delay
    delay = Math.min(delay, this.backoffConfig.maxDelay);
    
    // Add jitter if enabled (random value between 0 and delay)
    if (this.backoffConfig.jitter) {
      delay = delay * (0.5 + Math.random() * 0.5);
    }
    
    return Math.floor(delay);
  }

  private updateSuccessRate(metrics: RelayHealthMetrics): void {
    const total = metrics.successfulConnections + metrics.failedConnections;
    if (total === 0) {
      metrics.successRate = 100;
    } else {
      metrics.successRate = (metrics.successfulConnections / total) * 100;
    }
  }

  private notifyListeners(): void {
    const metricsSnapshot = this.getAllMetrics();
    this.listeners.forEach(listener => {
      try {
        listener(metricsSnapshot);
      } catch (error) {
        console.error('Error in health monitor listener:', error);
      }
    });
  }
}

/**
 * Global relay health monitor instance
 */
export const relayHealthMonitor = new RelayHealthMonitor();
