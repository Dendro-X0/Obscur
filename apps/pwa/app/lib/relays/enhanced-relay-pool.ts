/**
 * Enhanced Relay Pool with Health Monitoring
 * 
 * Extends the existing relay pool with:
 * - Connection health monitoring
 * - Exponential backoff retry
 * - Circuit breaker pattern
 * - Multi-relay publishing with failover
 * 
 * Requirements: 4.2, 4.3, 4.6, 7.7, 1.4, 1.5, 4.8
 */

import { useEffect, useMemo, useSyncExternalStore } from "react";
import { createRelayWebSocket } from "./create-relay-websocket";
import type { RelayConnection } from "./relay-connection";
import type { RelayConnectionStatus } from "./relay-connection-status";
import { relayHealthMonitor, type RelayHealthMetrics } from "./relay-health-monitor";

type RelayPoolState = Readonly<{
  connections: ReadonlyArray<RelayConnection>;
  healthMetrics: ReadonlyArray<RelayHealthMetrics>;
}>;

type EnhancedRelayPoolResult = Readonly<{
  connections: ReadonlyArray<RelayConnection>;
  healthMetrics: ReadonlyArray<RelayHealthMetrics>;
  sendToOpen: (payload: string) => void;
  publishToRelay: (url: string, payload: string) => Promise<PublishResult>;
  publishToAll: (payload: string) => Promise<MultiRelayPublishResult>;
  subscribeToMessages: (handler: (params: Readonly<{ url: string; message: string }>) => void) => () => void;
  getRelayHealth: (url: string) => RelayHealthMetrics | undefined;
  canConnectToRelay: (url: string) => boolean;
}>;

type RelayStatusByUrl = Readonly<Record<string, RelayConnection>>;
type SocketByUrl = Readonly<Record<string, WebSocket>>;
type MessageListener = (params: Readonly<{ url: string; message: string }>) => void;
type Unsubscribe = () => void;

/**
 * Result of publishing to a single relay
 */
export interface PublishResult {
  success: boolean;
  relayUrl: string;
  error?: string;
  latency?: number;
}

/**
 * Result of publishing to multiple relays
 */
export interface MultiRelayPublishResult {
  success: boolean;
  successCount: number;
  totalRelays: number;
  results: PublishResult[];
  overallError?: string;
}

const getUnixMs = (): number => Date.now();

const createNextConnection = (params: Readonly<{ 
  url: string; 
  status: RelayConnectionStatus; 
  errorMessage?: string 
}>): RelayConnection => ({
  url: params.url,
  status: params.status,
  updatedAtUnixMs: getUnixMs(),
  errorMessage: params.errorMessage
});

const upsertConnection = (current: RelayStatusByUrl, next: RelayConnection): RelayStatusByUrl => ({
  ...current,
  [next.url]: next
});

// Global state
let relayUrlsKey: string = "";
let statusByUrl: RelayStatusByUrl = {};
let socketsByUrl: SocketByUrl = {};
const listeners: Set<() => void> = new Set();
const messageListeners: Set<MessageListener> = new Set();
let cachedSnapshot: RelayPoolState = { connections: [], healthMetrics: [] };
let notifyScheduled: boolean = false;

// Retry timers for reconnection
const retryTimers: Map<string, NodeJS.Timeout> = new Map();

const notifyListeners = (): void => {
  if (notifyScheduled) {
    return;
  }
  notifyScheduled = true;
  queueMicrotask(() => {
    notifyScheduled = false;
    listeners.forEach((listener: () => void) => listener());
  });
};

const notifyMessageListeners = (params: Readonly<{ url: string; message: string }>): void => {
  messageListeners.forEach((listener: MessageListener) => listener(params));
};

const recomputeSnapshot = (): void => {
  const urls: ReadonlyArray<string> = relayUrlsKey ? relayUrlsKey.split("|") : [];
  const connections: ReadonlyArray<RelayConnection> = urls.map((url: string) => {
    const known: RelayConnection | undefined = statusByUrl[url];
    if (known) {
      return known;
    }
    return { url, status: "connecting", updatedAtUnixMs: 0 };
  });
  
  // Get health metrics for all relays
  const healthMetrics: RelayHealthMetrics[] = [];
  urls.forEach(url => {
    const metrics = relayHealthMonitor.getMetrics(url);
    if (metrics) {
      healthMetrics.push(metrics);
    }
  });
  
  cachedSnapshot = { connections, healthMetrics };
};

const getStateSnapshot = (): RelayPoolState => {
  return cachedSnapshot;
};

const subscribe = (listener: () => void): Unsubscribe => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/**
 * Attempt to connect to a relay with health monitoring
 */
const connectToRelay = (url: string): WebSocket | null => {
  // Check circuit breaker before attempting connection
  if (!relayHealthMonitor.canConnect(url)) {
    console.log(`Circuit breaker preventing connection to ${url}`);
    return null;
  }

  // Record connection attempt
  relayHealthMonitor.recordConnectionAttempt(url);

  const socket: WebSocket = createRelayWebSocket(url);
  
  // Track connection start time for latency measurement
  const connectionStartTime = Date.now();

  socket.addEventListener("open", () => {
    // Record successful connection
    relayHealthMonitor.recordConnectionSuccess(url);
    
    // Measure connection latency
    const latency = Date.now() - connectionStartTime;
    relayHealthMonitor.recordLatency(url, latency);
    
    // Update status
    statusByUrl = upsertConnection(statusByUrl, createNextConnection({ url, status: "open" }));
    recomputeSnapshot();
    notifyListeners();
    
    console.log(`Connected to relay ${url} (latency: ${latency}ms)`);
  });

  socket.addEventListener("error", (event) => {
    const errorMessage = "WebSocket error";
    
    // Record connection failure
    relayHealthMonitor.recordConnectionFailure(url, errorMessage);
    
    // Update status
    statusByUrl = upsertConnection(statusByUrl, createNextConnection({ 
      url, 
      status: "error", 
      errorMessage 
    }));
    recomputeSnapshot();
    notifyListeners();
    
    console.error(`Relay error ${url}:`, errorMessage);
    
    // Schedule retry with exponential backoff
    scheduleReconnect(url);
  });

  socket.addEventListener("close", () => {
    // Record disconnection
    relayHealthMonitor.recordDisconnection(url);
    
    // Update status
    statusByUrl = upsertConnection(statusByUrl, createNextConnection({ url, status: "closed" }));
    recomputeSnapshot();
    notifyListeners();
    
    console.log(`Relay closed ${url}`);
    
    // Schedule retry with exponential backoff
    scheduleReconnect(url);
  });

  socket.addEventListener("message", (evt: MessageEvent) => {
    if (typeof evt.data !== "string") {
      return;
    }
    notifyMessageListeners({ url, message: evt.data });
  });

  return socket;
};

/**
 * Schedule reconnection with exponential backoff
 * Implements Requirements 4.2, 4.3
 */
const scheduleReconnect = (url: string): void => {
  // Clear any existing retry timer
  const existingTimer = retryTimers.get(url);
  if (existingTimer) {
    clearTimeout(existingTimer);
  }

  // Check if we can reconnect (circuit breaker check)
  if (!relayHealthMonitor.canConnect(url)) {
    const metrics = relayHealthMonitor.getMetrics(url);
    if (metrics?.nextRetryAt) {
      const delay = metrics.nextRetryAt.getTime() - Date.now();
      if (delay > 0) {
        console.log(`Scheduling reconnect to ${url} in ${Math.round(delay / 1000)}s`);
        const timer = setTimeout(() => {
          retryTimers.delete(url);
          attemptReconnect(url);
        }, delay);
        retryTimers.set(url, timer);
      }
    }
    return;
  }

  // Get backoff delay from health monitor
  const metrics = relayHealthMonitor.getMetrics(url);
  const delay = metrics?.backoffDelay || 1000;

  console.log(`Scheduling reconnect to ${url} in ${Math.round(delay / 1000)}s`);
  
  const timer = setTimeout(() => {
    retryTimers.delete(url);
    attemptReconnect(url);
  }, delay);
  
  retryTimers.set(url, timer);
};

/**
 * Attempt to reconnect to a relay
 */
const attemptReconnect = (url: string): void => {
  // Check if relay is still in our list
  const urls = relayUrlsKey ? relayUrlsKey.split("|") : [];
  if (!urls.includes(url)) {
    console.log(`Relay ${url} no longer in list, skipping reconnect`);
    return;
  }

  // Check if already connected
  const existingSocket = socketsByUrl[url];
  if (existingSocket && (existingSocket.readyState === WebSocket.OPEN || existingSocket.readyState === WebSocket.CONNECTING)) {
    console.log(`Relay ${url} already connected, skipping reconnect`);
    return;
  }

  console.log(`Attempting to reconnect to ${url}`);
  
  // Close existing socket if any
  if (existingSocket) {
    try {
      existingSocket.close();
    } catch (error) {
      console.error(`Error closing socket for ${url}:`, error);
    }
  }

  // Attempt new connection
  const newSocket = connectToRelay(url);
  if (newSocket) {
    socketsByUrl = { ...socketsByUrl, [url]: newSocket };
  }
};

/**
 * Set relay URLs and manage connections
 */
const setRelayUrls = (urls: ReadonlyArray<string>): void => {
  const nextKey: string = urls.join("|");
  if (nextKey === relayUrlsKey) {
    return;
  }
  
  relayUrlsKey = nextKey;
  const existingSockets: SocketByUrl = socketsByUrl;
  const nextSockets: Record<string, WebSocket> = {};
  
  urls.forEach((url: string) => {
    // Initialize health monitoring for new relays
    relayHealthMonitor.initializeRelay(url);
    
    const existing: WebSocket | undefined = existingSockets[url];
    if (existing && (existing.readyState === WebSocket.OPEN || existing.readyState === WebSocket.CONNECTING)) {
      nextSockets[url] = existing;
      return;
    }
    
    // Attempt to connect
    const socket = connectToRelay(url);
    if (socket) {
      nextSockets[url] = socket;
    }
  });
  
  // Close sockets for removed relays
  Object.entries(existingSockets).forEach(([url, socket]: [string, WebSocket]) => {
    if (!nextSockets[url] && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
      socket.close();
      
      // Clear retry timer
      const timer = retryTimers.get(url);
      if (timer) {
        clearTimeout(timer);
        retryTimers.delete(url);
      }
    }
  });
  
  socketsByUrl = nextSockets;
  recomputeSnapshot();
  notifyListeners();
};

/**
 * Send message to all open relays
 */
const sendToOpen = (payload: string): void => {
  Object.values(socketsByUrl).forEach((socket: WebSocket) => {
    if (socket.readyState === WebSocket.OPEN) {
      socket.send(payload);
    }
  });
};

/**
 * Publish to a specific relay
 * Implements Requirements 1.4, 1.5
 */
const publishToRelay = async (url: string, payload: string): Promise<PublishResult> => {
  const socket = socketsByUrl[url];
  
  if (!socket) {
    return {
      success: false,
      relayUrl: url,
      error: 'Relay not found'
    };
  }
  
  if (socket.readyState !== WebSocket.OPEN) {
    return {
      success: false,
      relayUrl: url,
      error: 'Relay not connected'
    };
  }
  
  const startTime = Date.now();
  
  try {
    socket.send(payload);
    const latency = Date.now() - startTime;
    
    // Record latency
    relayHealthMonitor.recordLatency(url, latency);
    
    return {
      success: true,
      relayUrl: url,
      latency
    };
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    
    // Record failure
    relayHealthMonitor.recordConnectionFailure(url, errorMessage);
    
    return {
      success: false,
      relayUrl: url,
      error: errorMessage
    };
  }
};

/**
 * Publish to all connected relays with failover
 * Implements Requirements 1.4, 1.5, 4.8
 */
const publishToAll = async (payload: string): Promise<MultiRelayPublishResult> => {
  const urls = relayUrlsKey ? relayUrlsKey.split("|") : [];
  const results: PublishResult[] = [];
  
  // Get all relays sorted by health (prioritize healthy relays)
  const sortedUrls = urls.sort((a, b) => {
    const healthA = relayHealthMonitor.getHealthStatus(a);
    const healthB = relayHealthMonitor.getHealthStatus(b);
    
    const healthScore = { healthy: 3, degraded: 2, unhealthy: 1, unknown: 0 };
    return healthScore[healthB] - healthScore[healthA];
  });
  
  // Publish to all relays in parallel
  const publishPromises = sortedUrls.map(url => publishToRelay(url, payload));
  const publishResults = await Promise.all(publishPromises);
  
  results.push(...publishResults);
  
  // Calculate overall result
  const successCount = results.filter(r => r.success).length;
  const totalRelays = results.length;
  const success = successCount > 0; // Success if at least one relay accepted
  
  let overallError: string | undefined;
  if (successCount === 0) {
    overallError = 'All relays failed to accept the message';
  } else if (successCount < totalRelays) {
    overallError = `${totalRelays - successCount} of ${totalRelays} relays failed`;
  }
  
  return {
    success,
    successCount,
    totalRelays,
    results,
    overallError
  };
};

/**
 * Subscribe to relay messages
 */
const subscribeToMessages = (handler: MessageListener): Unsubscribe => {
  messageListeners.add(handler);
  return () => {
    messageListeners.delete(handler);
  };
};

/**
 * Get relay health metrics
 */
const getRelayHealth = (url: string): RelayHealthMetrics | undefined => {
  return relayHealthMonitor.getMetrics(url);
};

/**
 * Check if can connect to relay (circuit breaker check)
 */
const canConnectToRelay = (url: string): boolean => {
  return relayHealthMonitor.canConnect(url);
};

const serverSnapshot: RelayPoolState = { connections: [], healthMetrics: [] };

/**
 * Enhanced Relay Pool Hook
 */
export const useEnhancedRelayPool = (urls: ReadonlyArray<string>): EnhancedRelayPoolResult => {
  const urlsKey: string = urls.join("|");
  const urlsFromKey: ReadonlyArray<string> = useMemo(() => (urlsKey ? urlsKey.split("|") : []), [urlsKey]);
  
  useEffect(() => {
    setRelayUrls(urlsFromKey);
  }, [urlsKey, urlsFromKey]);
  
  // Subscribe to health monitor changes
  useEffect(() => {
    const unsubscribe = relayHealthMonitor.subscribe(() => {
      recomputeSnapshot();
      notifyListeners();
    });
    
    return unsubscribe;
  }, []);
  
  const snapshot: RelayPoolState = useSyncExternalStore(subscribe, getStateSnapshot, () => serverSnapshot);
  
  return { 
    connections: snapshot.connections,
    healthMetrics: snapshot.healthMetrics,
    sendToOpen, 
    publishToRelay,
    publishToAll,
    subscribeToMessages,
    getRelayHealth,
    canConnectToRelay
  };
};
