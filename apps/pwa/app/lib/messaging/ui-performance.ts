/**
 * UI Performance Enhancements
 * 
 * Implements:
 * - UI updates within 100ms of message processing (Requirement 8.2)
 * - Responsiveness under high message load (Requirement 8.8)
 * - Smooth loading states and progress indicators (Requirement 6.6)
 */

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Performance metrics
 */
interface PerformanceMetrics {
  messageProcessingTime: number;
  uiUpdateTime: number;
  totalTime: number;
  timestamp: Date;
}

/**
 * Loading state
 */
export interface LoadingState {
  isLoading: boolean;
  progress?: number;
  message?: string;
}

/**
 * UI Performance Monitor
 * Tracks UI update performance to ensure responsiveness
 * Requirement 8.2: Update UI within 100ms of message processing
 */
export class UIPerformanceMonitor {
  private metrics: PerformanceMetrics[] = [];
  private maxMetrics = 100;
  private performanceThresholdMs = 100;

  /**
   * Start tracking a UI update
   */
  startTracking(): () => PerformanceMetrics {
    const startTime = performance.now();
    
    return () => {
      const endTime = performance.now();
      const totalTime = endTime - startTime;
      
      const metric: PerformanceMetrics = {
        messageProcessingTime: 0, // Would be set by caller
        uiUpdateTime: totalTime,
        totalTime,
        timestamp: new Date()
      };
      
      this.recordMetric(metric);
      
      // Warn if update took too long
      if (totalTime > this.performanceThresholdMs) {
        console.warn(`UI update took ${totalTime.toFixed(2)}ms (threshold: ${this.performanceThresholdMs}ms)`);
      }
      
      return metric;
    };
  }

  /**
   * Record a performance metric
   */
  private recordMetric(metric: PerformanceMetrics): void {
    this.metrics.push(metric);
    
    // Keep only recent metrics
    if (this.metrics.length > this.maxMetrics) {
      this.metrics.shift();
    }
  }

  /**
   * Get average UI update time
   */
  getAverageUpdateTime(): number {
    if (this.metrics.length === 0) return 0;
    
    const sum = this.metrics.reduce((acc, m) => acc + m.uiUpdateTime, 0);
    return sum / this.metrics.length;
  }

  /**
   * Get percentage of updates within threshold
   */
  getPerformanceScore(): number {
    if (this.metrics.length === 0) return 100;
    
    const withinThreshold = this.metrics.filter(
      m => m.uiUpdateTime <= this.performanceThresholdMs
    ).length;
    
    return (withinThreshold / this.metrics.length) * 100;
  }

  /**
   * Check if performance is degraded
   */
  isPerformanceDegraded(): boolean {
    return this.getPerformanceScore() < 90; // Less than 90% within threshold
  }

  /**
   * Get recent metrics
   */
  getRecentMetrics(count: number = 10): PerformanceMetrics[] {
    return this.metrics.slice(-count);
  }

  /**
   * Clear metrics
   */
  clear(): void {
    this.metrics = [];
  }
}

/**
 * Message Throttler
 * Throttles UI updates under high message load
 * Requirement 8.8: Maintain UI responsiveness under high message load
 */
export class MessageThrottler {
  private pendingUpdates: Array<() => void> = [];
  private isProcessing = false;
  private frameId: number | null = null;
  private maxUpdatesPerFrame = 5;

  /**
   * Schedule a UI update
   * Uses requestAnimationFrame for smooth updates
   */
  scheduleUpdate(updateFn: () => void): void {
    this.pendingUpdates.push(updateFn);
    
    if (!this.isProcessing) {
      this.processUpdates();
    }
  }

  /**
   * Process pending updates
   */
  private processUpdates(): void {
    if (this.pendingUpdates.length === 0) {
      this.isProcessing = false;
      return;
    }

    this.isProcessing = true;

    // Use requestAnimationFrame for smooth updates
    this.frameId = requestAnimationFrame(() => {
      // Process a batch of updates
      const batch = this.pendingUpdates.splice(0, this.maxUpdatesPerFrame);
      
      // Execute updates
      batch.forEach(updateFn => {
        try {
          updateFn();
        } catch (error) {
          console.error('UI update failed:', error);
        }
      });

      // Continue processing if more updates pending
      if (this.pendingUpdates.length > 0) {
        this.processUpdates();
      } else {
        this.isProcessing = false;
      }
    });
  }

  /**
   * Cancel pending updates
   */
  cancel(): void {
    if (this.frameId !== null) {
      cancelAnimationFrame(this.frameId);
      this.frameId = null;
    }
    this.pendingUpdates = [];
    this.isProcessing = false;
  }

  /**
   * Get pending update count
   */
  getPendingCount(): number {
    return this.pendingUpdates.length;
  }
}

/**
 * Loading State Manager
 * Manages smooth loading states and progress indicators
 * Requirement 6.6: Provide sync progress indicators to the user
 */
export class LoadingStateManager {
  private loadingStates: Map<string, LoadingState> = new Map();
  private listeners: Set<(states: Map<string, LoadingState>) => void> = new Set();

  /**
   * Set loading state for an operation
   */
  setLoading(operationId: string, state: LoadingState): void {
    this.loadingStates.set(operationId, state);
    this.notifyListeners();
  }

  /**
   * Update progress for an operation
   */
  updateProgress(operationId: string, progress: number, message?: string): void {
    const existing = this.loadingStates.get(operationId);
    if (existing) {
      this.loadingStates.set(operationId, {
        ...existing,
        progress,
        message: message || existing.message
      });
      this.notifyListeners();
    }
  }

  /**
   * Complete an operation
   */
  complete(operationId: string): void {
    this.loadingStates.delete(operationId);
    this.notifyListeners();
  }

  /**
   * Get loading state for an operation
   */
  getState(operationId: string): LoadingState | undefined {
    return this.loadingStates.get(operationId);
  }

  /**
   * Check if any operation is loading
   */
  isAnyLoading(): boolean {
    return this.loadingStates.size > 0;
  }

  /**
   * Get all loading states
   */
  getAllStates(): Map<string, LoadingState> {
    return new Map(this.loadingStates);
  }

  /**
   * Subscribe to loading state changes
   */
  subscribe(listener: (states: Map<string, LoadingState>) => void): () => void {
    this.listeners.add(listener);
    return () => {
      this.listeners.delete(listener);
    };
  }

  /**
   * Notify listeners of state changes
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      listener(this.getAllStates());
    });
  }

  /**
   * Clear all loading states
   */
  clear(): void {
    this.loadingStates.clear();
    this.notifyListeners();
  }
}

/**
 * Hook for UI performance monitoring
 * Requirement 8.2: Ensure UI updates within 100ms
 */
export function useUIPerformance() {
  const monitorRef = useRef(new UIPerformanceMonitor());

  const trackUpdate = useCallback(() => {
    return monitorRef.current.startTracking();
  }, []);

  const getMetrics = useCallback(() => {
    return {
      averageUpdateTime: monitorRef.current.getAverageUpdateTime(),
      performanceScore: monitorRef.current.getPerformanceScore(),
      isDegraded: monitorRef.current.isPerformanceDegraded(),
      recentMetrics: monitorRef.current.getRecentMetrics()
    };
  }, []);

  return { trackUpdate, getMetrics };
}

/**
 * Hook for message throttling
 * Requirement 8.8: Maintain responsiveness under high load
 */
export function useMessageThrottling() {
  const throttlerRef = useRef(new MessageThrottler());

  const scheduleUpdate = useCallback((updateFn: () => void) => {
    throttlerRef.current.scheduleUpdate(updateFn);
  }, []);

  const getPendingCount = useCallback(() => {
    return throttlerRef.current.getPendingCount();
  }, []);

  useEffect(() => {
    return () => {
      throttlerRef.current.cancel();
    };
  }, []);

  return { scheduleUpdate, getPendingCount };
}

/**
 * Hook for loading state management
 * Requirement 6.6: Provide smooth loading states and progress indicators
 */
export function useLoadingState() {
  const managerRef = useRef(new LoadingStateManager());
  const [loadingStates, setLoadingStates] = useState<Map<string, LoadingState>>(new Map());

  useEffect(() => {
    const unsubscribe = managerRef.current.subscribe((states) => {
      setLoadingStates(new Map(states));
    });

    return unsubscribe;
  }, []);

  const setLoading = useCallback((operationId: string, state: LoadingState) => {
    managerRef.current.setLoading(operationId, state);
  }, []);

  const updateProgress = useCallback((operationId: string, progress: number, message?: string) => {
    managerRef.current.updateProgress(operationId, progress, message);
  }, []);

  const complete = useCallback((operationId: string) => {
    managerRef.current.complete(operationId);
  }, []);

  const getState = useCallback((operationId: string) => {
    return managerRef.current.getState(operationId);
  }, []);

  const isAnyLoading = useCallback(() => {
    return managerRef.current.isAnyLoading();
  }, []);

  return {
    loadingStates,
    setLoading,
    updateProgress,
    complete,
    getState,
    isAnyLoading
  };
}

/**
 * Global instances
 */
export const uiPerformanceMonitor = new UIPerformanceMonitor();
export const messageThrottler = new MessageThrottler();
export const loadingStateManager = new LoadingStateManager();
