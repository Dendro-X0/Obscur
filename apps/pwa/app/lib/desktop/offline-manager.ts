"use client";

/**
 * Offline state management for desktop app
 * Handles connection state persistence and offline queue
 */

export interface OfflineState {
  isOnline: boolean;
  lastOnline: Date | null;
  pendingActions: number;
}

export class OfflineManager {
  private listeners: Set<(state: OfflineState) => void> = new Set();
  private state: OfflineState = {
    isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
    lastOnline: null,
    pendingActions: 0,
  };

  constructor() {
    if (typeof window !== "undefined") {
      // Listen to online/offline events
      window.addEventListener("online", this.handleOnline.bind(this));
      window.addEventListener("offline", this.handleOffline.bind(this));

      // Load persisted state
      this.loadState();
    }
  }

  /**
   * Get current offline state
   */
  getState(): OfflineState {
    return { ...this.state };
  }

  /**
   * Subscribe to state changes
   */
  subscribe(listener: (state: OfflineState) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  /**
   * Add pending action to queue
   */
  addPendingAction(): void {
    this.state.pendingActions += 1;
    this.notifyListeners();
    this.saveState();
  }

  /**
   * Remove pending action from queue
   */
  removePendingAction(): void {
    if (this.state.pendingActions > 0) {
      this.state.pendingActions -= 1;
      this.notifyListeners();
      this.saveState();
    }
  }

  /**
   * Clear all pending actions
   */
  clearPendingActions(): void {
    this.state.pendingActions = 0;
    this.notifyListeners();
    this.saveState();
  }

  /**
   * Handle online event
   */
  private handleOnline(): void {
    this.state.isOnline = true;
    this.state.lastOnline = new Date();
    this.notifyListeners();
    this.saveState();
  }

  /**
   * Handle offline event
   */
  private handleOffline(): void {
    this.state.isOnline = false;
    this.notifyListeners();
    this.saveState();
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    const state = this.getState();
    this.listeners.forEach((listener) => listener(state));
  }

  /**
   * Save state to localStorage
   */
  private saveState(): void {
    if (typeof window === "undefined") return;

    try {
      const data = {
        lastOnline: this.state.lastOnline?.toISOString() || null,
        pendingActions: this.state.pendingActions,
      };
      localStorage.setItem("obscur.offline.state", JSON.stringify(data));
    } catch (error) {
      console.error("Failed to save offline state:", error);
    }
  }

  /**
   * Load state from localStorage
   */
  private loadState(): void {
    if (typeof window === "undefined") return;

    try {
      const raw = localStorage.getItem("obscur.offline.state");
      if (!raw) return;

      const data = JSON.parse(raw);
      if (data.lastOnline) {
        this.state.lastOnline = new Date(data.lastOnline);
      }
      if (typeof data.pendingActions === "number") {
        this.state.pendingActions = data.pendingActions;
      }
    } catch (error) {
      console.error("Failed to load offline state:", error);
    }
  }

  /**
   * Cleanup
   */
  destroy(): void {
    if (typeof window !== "undefined") {
      window.removeEventListener("online", this.handleOnline.bind(this));
      window.removeEventListener("offline", this.handleOffline.bind(this));
    }
    this.listeners.clear();
  }
}

// Singleton instance
let manager: OfflineManager | null = null;

/**
 * Get the offline manager instance
 */
export function getOfflineManager(): OfflineManager {
  if (!manager) {
    manager = new OfflineManager();
  }
  return manager;
}
