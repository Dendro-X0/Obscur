/**
 * Performance Monitor
 * 
 * Tracks and reports performance metrics for the messaging system.
 * Monitors message throughput, latency, memory usage, and system health.
 * 
 * Requirements: 5.8, 4.7, 8.2, 8.3, 8.5, 8.6
 */

/**
 * Performance metric
 */
export interface PerformanceMetric {
  name: string;
  value: number;
  unit: string;
  timestamp: Date;
  tags?: Record<string, string>;
}

/**
 * Performance snapshot
 */
export interface PerformanceSnapshot {
  timestamp: Date;
  metrics: {
    // Message metrics
    messagesPerSecond: number;
    averageMessageLatency: number;
    messageQueueSize: number;
    
    // Relay metrics
    connectedRelays: number;
    averageRelayLatency: number;
    relaySuccessRate: number;
    
    // System metrics
    memoryUsageMB: number;
    activeSubscriptions: number;
    
    // UI metrics
    uiUpdateLatency: number;
    frameRate: number;
  };
  health: 'healthy' | 'degraded' | 'critical';
  warnings: string[];
}

/**
 * Performance thresholds
 */
const PERFORMANCE_THRESHOLDS = {
  // Requirement 8.2: UI updates within 100ms
  maxUIUpdateLatency: 100,
  
  // Requirement 8.3: Message batching for performance
  maxMessageQueueSize: 100,
  
  // Requirement 8.5: Memory usage limits
  maxMemoryUsageMB: 200,
  
  // Relay performance
  maxRelayLatency: 1000,
  minRelaySuccessRate: 0.8,
  
  // Frame rate for smooth UI
  minFrameRate: 30
};

/**
 * Performance Monitor Class
 */
class PerformanceMonitor {
  private metrics: PerformanceMetric[] = [];
  private maxMetrics: number = 1000;
  private enabled: boolean = false;
  private monitoringInterval: NodeJS.Timeout | null = null;
  private frameRateMonitor: FrameRateMonitor | null = null;

  // Metric accumulators
  private messageCount: number = 0;
  private lastMessageCountReset: Date = new Date();
  private latencySum: number = 0;
  private latencyCount: number = 0;
  private relayLatencySum: number = 0;
  private relayLatencyCount: number = 0;
  private relaySuccessCount: number = 0;
  private relayTotalCount: number = 0;
  private uiUpdateLatencies: number[] = [];

  /**
   * Enable performance monitoring
   */
  enable(intervalMs: number = 5000): void {
    if (this.enabled) return;

    this.enabled = true;
    console.log('[PerformanceMonitor] Monitoring enabled');

    // Start periodic snapshot collection
    this.monitoringInterval = setInterval(() => {
      this.collectSnapshot();
    }, intervalMs);

    // Start frame rate monitoring
    if (typeof window !== 'undefined') {
      this.frameRateMonitor = new FrameRateMonitor();
      this.frameRateMonitor.start();
    }
  }

  /**
   * Disable performance monitoring
   */
  disable(): void {
    if (!this.enabled) return;

    this.enabled = false;
    console.log('[PerformanceMonitor] Monitoring disabled');

    if (this.monitoringInterval) {
      clearInterval(this.monitoringInterval);
      this.monitoringInterval = null;
    }

    if (this.frameRateMonitor) {
      this.frameRateMonitor.stop();
      this.frameRateMonitor = null;
    }
  }

  /**
   * Check if monitoring is enabled
   */
  isEnabled(): boolean {
    return this.enabled;
  }

  /**
   * Record a message sent
   */
  recordMessageSent(): void {
    if (!this.enabled) return;
    this.messageCount++;
  }

  /**
   * Record message latency
   */
  recordMessageLatency(latencyMs: number): void {
    if (!this.enabled) return;
    this.latencySum += latencyMs;
    this.latencyCount++;
  }

  /**
   * Record relay latency
   */
  recordRelayLatency(latencyMs: number, success: boolean): void {
    if (!this.enabled) return;
    
    this.relayLatencySum += latencyMs;
    this.relayLatencyCount++;
    this.relayTotalCount++;
    
    if (success) {
      this.relaySuccessCount++;
    }
  }

  /**
   * Record UI update latency
   */
  recordUIUpdateLatency(latencyMs: number): void {
    if (!this.enabled) return;
    
    this.uiUpdateLatencies.push(latencyMs);
    
    // Keep only recent measurements
    if (this.uiUpdateLatencies.length > 100) {
      this.uiUpdateLatencies.shift();
    }
  }

  /**
   * Collect a performance snapshot
   */
  private collectSnapshot(): void {
    const now = new Date();
    
    // Calculate messages per second
    const timeSinceReset = (now.getTime() - this.lastMessageCountReset.getTime()) / 1000;
    const messagesPerSecond = timeSinceReset > 0 ? this.messageCount / timeSinceReset : 0;

    // Calculate average latencies
    const averageMessageLatency = this.latencyCount > 0
      ? this.latencySum / this.latencyCount
      : 0;

    const averageRelayLatency = this.relayLatencyCount > 0
      ? this.relayLatencySum / this.relayLatencyCount
      : 0;

    const relaySuccessRate = this.relayTotalCount > 0
      ? this.relaySuccessCount / this.relayTotalCount
      : 1;

    // Calculate average UI update latency
    const uiUpdateLatency = this.uiUpdateLatencies.length > 0
      ? this.uiUpdateLatencies.reduce((sum, val) => sum + val, 0) / this.uiUpdateLatencies.length
      : 0;

    // Get memory usage
    const memoryUsageMB = this.getMemoryUsage();

    // Get frame rate
    const frameRate = this.frameRateMonitor?.getFrameRate() || 60;

    // Create snapshot
    const snapshot: PerformanceSnapshot = {
      timestamp: now,
      metrics: {
        messagesPerSecond,
        averageMessageLatency,
        messageQueueSize: 0, // Would be populated by caller
        connectedRelays: 0, // Would be populated by caller
        averageRelayLatency,
        relaySuccessRate,
        memoryUsageMB,
        activeSubscriptions: 0, // Would be populated by caller
        uiUpdateLatency,
        frameRate
      },
      health: this.calculateHealth({
        uiUpdateLatency,
        memoryUsageMB,
        averageRelayLatency,
        relaySuccessRate,
        frameRate
      }),
      warnings: this.generateWarnings({
        uiUpdateLatency,
        memoryUsageMB,
        averageRelayLatency,
        relaySuccessRate,
        frameRate
      })
    };

    // Log snapshot
    this.logSnapshot(snapshot);

    // Reset counters for next period
    this.messageCount = 0;
    this.lastMessageCountReset = now;
    this.latencySum = 0;
    this.latencyCount = 0;
    this.relayLatencySum = 0;
    this.relayLatencyCount = 0;
    this.relaySuccessCount = 0;
    this.relayTotalCount = 0;
  }

  /**
   * Calculate system health
   */
  private calculateHealth(metrics: {
    uiUpdateLatency: number;
    memoryUsageMB: number;
    averageRelayLatency: number;
    relaySuccessRate: number;
    frameRate: number;
  }): 'healthy' | 'degraded' | 'critical' {
    const issues: string[] = [];

    // Check UI performance (Requirement 8.2)
    if (metrics.uiUpdateLatency > PERFORMANCE_THRESHOLDS.maxUIUpdateLatency * 2) {
      issues.push('critical_ui_latency');
    } else if (metrics.uiUpdateLatency > PERFORMANCE_THRESHOLDS.maxUIUpdateLatency) {
      issues.push('degraded_ui_latency');
    }

    // Check memory usage (Requirement 8.5)
    if (metrics.memoryUsageMB > PERFORMANCE_THRESHOLDS.maxMemoryUsageMB * 1.5) {
      issues.push('critical_memory');
    } else if (metrics.memoryUsageMB > PERFORMANCE_THRESHOLDS.maxMemoryUsageMB) {
      issues.push('degraded_memory');
    }

    // Check relay performance
    if (metrics.averageRelayLatency > PERFORMANCE_THRESHOLDS.maxRelayLatency * 2) {
      issues.push('critical_relay_latency');
    } else if (metrics.averageRelayLatency > PERFORMANCE_THRESHOLDS.maxRelayLatency) {
      issues.push('degraded_relay_latency');
    }

    if (metrics.relaySuccessRate < PERFORMANCE_THRESHOLDS.minRelaySuccessRate * 0.5) {
      issues.push('critical_relay_failures');
    } else if (metrics.relaySuccessRate < PERFORMANCE_THRESHOLDS.minRelaySuccessRate) {
      issues.push('degraded_relay_failures');
    }

    // Check frame rate
    if (metrics.frameRate < PERFORMANCE_THRESHOLDS.minFrameRate * 0.5) {
      issues.push('critical_frame_rate');
    } else if (metrics.frameRate < PERFORMANCE_THRESHOLDS.minFrameRate) {
      issues.push('degraded_frame_rate');
    }

    // Determine overall health
    if (issues.some(issue => issue.startsWith('critical_'))) {
      return 'critical';
    } else if (issues.length > 0) {
      return 'degraded';
    } else {
      return 'healthy';
    }
  }

  /**
   * Generate performance warnings
   */
  private generateWarnings(metrics: {
    uiUpdateLatency: number;
    memoryUsageMB: number;
    averageRelayLatency: number;
    relaySuccessRate: number;
    frameRate: number;
  }): string[] {
    const warnings: string[] = [];

    if (metrics.uiUpdateLatency > PERFORMANCE_THRESHOLDS.maxUIUpdateLatency) {
      warnings.push(
        `UI update latency (${metrics.uiUpdateLatency.toFixed(0)}ms) exceeds target (${PERFORMANCE_THRESHOLDS.maxUIUpdateLatency}ms)`
      );
    }

    if (metrics.memoryUsageMB > PERFORMANCE_THRESHOLDS.maxMemoryUsageMB) {
      warnings.push(
        `Memory usage (${metrics.memoryUsageMB.toFixed(0)}MB) exceeds limit (${PERFORMANCE_THRESHOLDS.maxMemoryUsageMB}MB)`
      );
    }

    if (metrics.averageRelayLatency > PERFORMANCE_THRESHOLDS.maxRelayLatency) {
      warnings.push(
        `Relay latency (${metrics.averageRelayLatency.toFixed(0)}ms) exceeds target (${PERFORMANCE_THRESHOLDS.maxRelayLatency}ms)`
      );
    }

    if (metrics.relaySuccessRate < PERFORMANCE_THRESHOLDS.minRelaySuccessRate) {
      warnings.push(
        `Relay success rate (${(metrics.relaySuccessRate * 100).toFixed(0)}%) below target (${PERFORMANCE_THRESHOLDS.minRelaySuccessRate * 100}%)`
      );
    }

    if (metrics.frameRate < PERFORMANCE_THRESHOLDS.minFrameRate) {
      warnings.push(
        `Frame rate (${metrics.frameRate.toFixed(0)} fps) below target (${PERFORMANCE_THRESHOLDS.minFrameRate} fps)`
      );
    }

    return warnings;
  }

  /**
   * Get memory usage in MB
   */
  private getMemoryUsage(): number {
    if (typeof performance !== 'undefined' && (performance as any).memory) {
      const memory = (performance as any).memory;
      return memory.usedJSHeapSize / (1024 * 1024);
    }
    return 0;
  }

  /**
   * Log performance snapshot
   */
  private logSnapshot(snapshot: PerformanceSnapshot): void {
    const healthIcon = snapshot.health === 'healthy' ? '✓' : 
                      snapshot.health === 'degraded' ? '⚠' : '✗';
    
    console.log(`[PerformanceMonitor] ${healthIcon} Health: ${snapshot.health}`);
    console.log(`  Messages/sec: ${snapshot.metrics.messagesPerSecond.toFixed(2)}`);
    console.log(`  Avg Message Latency: ${snapshot.metrics.averageMessageLatency.toFixed(0)}ms`);
    console.log(`  Avg Relay Latency: ${snapshot.metrics.averageRelayLatency.toFixed(0)}ms`);
    console.log(`  Relay Success Rate: ${(snapshot.metrics.relaySuccessRate * 100).toFixed(0)}%`);
    console.log(`  UI Update Latency: ${snapshot.metrics.uiUpdateLatency.toFixed(0)}ms`);
    console.log(`  Memory Usage: ${snapshot.metrics.memoryUsageMB.toFixed(0)}MB`);
    console.log(`  Frame Rate: ${snapshot.metrics.frameRate.toFixed(0)} fps`);

    if (snapshot.warnings.length > 0) {
      console.warn('[PerformanceMonitor] Warnings:');
      snapshot.warnings.forEach(warning => console.warn(`  - ${warning}`));
    }
  }

  /**
   * Get current performance metrics
   */
  getCurrentMetrics(): PerformanceSnapshot['metrics'] {
    const now = new Date();
    const timeSinceReset = (now.getTime() - this.lastMessageCountReset.getTime()) / 1000;
    
    return {
      messagesPerSecond: timeSinceReset > 0 ? this.messageCount / timeSinceReset : 0,
      averageMessageLatency: this.latencyCount > 0 ? this.latencySum / this.latencyCount : 0,
      messageQueueSize: 0,
      connectedRelays: 0,
      averageRelayLatency: this.relayLatencyCount > 0 ? this.relayLatencySum / this.relayLatencyCount : 0,
      relaySuccessRate: this.relayTotalCount > 0 ? this.relaySuccessCount / this.relayTotalCount : 1,
      memoryUsageMB: this.getMemoryUsage(),
      activeSubscriptions: 0,
      uiUpdateLatency: this.uiUpdateLatencies.length > 0
        ? this.uiUpdateLatencies.reduce((sum, val) => sum + val, 0) / this.uiUpdateLatencies.length
        : 0,
      frameRate: this.frameRateMonitor?.getFrameRate() || 60
    };
  }

  /**
   * Export performance data
   */
  exportData(): string {
    return JSON.stringify({
      timestamp: new Date().toISOString(),
      currentMetrics: this.getCurrentMetrics(),
      thresholds: PERFORMANCE_THRESHOLDS
    }, null, 2);
  }
}

/**
 * Frame Rate Monitor
 * Tracks UI frame rate for smooth rendering
 */
class FrameRateMonitor {
  private frameCount: number = 0;
  private lastTime: number = 0;
  private frameRate: number = 60;
  private animationFrameId: number | null = null;

  start(): void {
    this.lastTime = performance.now();
    this.frameCount = 0;
    this.tick();
  }

  stop(): void {
    if (this.animationFrameId !== null) {
      cancelAnimationFrame(this.animationFrameId);
      this.animationFrameId = null;
    }
  }

  getFrameRate(): number {
    return this.frameRate;
  }

  private tick = (): void => {
    const now = performance.now();
    this.frameCount++;

    // Calculate FPS every second
    if (now >= this.lastTime + 1000) {
      this.frameRate = Math.round((this.frameCount * 1000) / (now - this.lastTime));
      this.frameCount = 0;
      this.lastTime = now;
    }

    this.animationFrameId = requestAnimationFrame(this.tick);
  };
}

// Export singleton instance
export const performanceMonitor = new PerformanceMonitor();

// Expose to window for browser console access
if (typeof window !== 'undefined') {
  (window as any).performanceMonitor = performanceMonitor;
}
