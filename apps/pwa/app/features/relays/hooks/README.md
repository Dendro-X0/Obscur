# Enhanced Relay Pool

The enhanced relay pool provides robust connection management with health monitoring, circuit breakers, and multi-relay publishing with failover.

## Features

### Connection Health Monitoring
- Tracks connection attempts, successes, and failures
- Measures relay latency and performance
- Calculates success rates for each relay

### Circuit Breaker Pattern
- Automatically opens circuit after repeated failures
- Prevents wasted connection attempts to failing relays
- Transitions through closed → open → half-open states
- Automatically retries after cooldown period

### Exponential Backoff
- Implements exponential backoff for reconnection attempts
- Configurable initial delay, max delay, and multiplier
- Optional jitter to prevent thundering herd

### Multi-Relay Publishing
- Publishes to all connected relays in parallel
- Prioritizes healthy relays over degraded ones
- Gracefully handles individual relay failures
- Returns detailed results for each relay

## Usage

### Basic Usage

```typescript
import { useEnhancedRelayPool } from './lib/relays/enhanced-relay-pool';

function MyComponent() {
  const relayUrls = [
    'wss://relay1.example.com',
    'wss://relay2.example.com',
    'wss://relay3.example.com'
  ];
  
  const pool = useEnhancedRelayPool(relayUrls);
  
  // Check connection status
  console.log('Connections:', pool.connections);
  console.log('Health metrics:', pool.healthMetrics);
  
  return <div>Connected to {pool.connections.filter(c => c.status === 'open').length} relays</div>;
}
```

### Publishing to All Relays

```typescript
// Publish with automatic failover
const result = await pool.publishToAll(JSON.stringify(['EVENT', event]));

console.log(`Published to ${result.successCount} of ${result.totalRelays} relays`);

if (!result.success) {
  console.error('All relays failed:', result.overallError);
}

// Check individual relay results
result.results.forEach(r => {
  if (r.success) {
    console.log(`✓ ${r.relayUrl} (${r.latency}ms)`);
  } else {
    console.error(`✗ ${r.relayUrl}: ${r.error}`);
  }
});
```

### Publishing to Specific Relay

```typescript
// Publish to a specific relay
const result = await pool.publishToRelay('wss://relay1.example.com', payload);

if (result.success) {
  console.log(`Published in ${result.latency}ms`);
} else {
  console.error(`Failed: ${result.error}`);
}
```

### Checking Relay Health

```typescript
// Get health metrics for a specific relay
const metrics = pool.getRelayHealth('wss://relay1.example.com');

if (metrics) {
  console.log('Status:', metrics.status);
  console.log('Success rate:', metrics.successRate.toFixed(1) + '%');
  console.log('Average latency:', metrics.latency.toFixed(0) + 'ms');
  console.log('Circuit breaker:', metrics.circuitBreakerState);
}

// Check if relay can accept connections
const canConnect = pool.canConnectToRelay('wss://relay1.example.com');
if (!canConnect) {
  console.log('Circuit breaker is open, waiting for cooldown');
}
```

### Subscribing to Messages

```typescript
useEffect(() => {
  const unsubscribe = pool.subscribeToMessages(({ url, message }) => {
    console.log(`Message from ${url}:`, message);
    
    // Parse and handle message
    const parsed = JSON.parse(message);
    if (parsed[0] === 'EVENT') {
      handleEvent(parsed[2]);
    }
  });
  
  return unsubscribe;
}, [pool]);
```

## Health Metrics

Each relay has the following health metrics:

- **status**: Current connection status (connected, connecting, disconnected, error)
- **connectionAttempts**: Total number of connection attempts
- **successfulConnections**: Number of successful connections
- **failedConnections**: Number of failed connections
- **latency**: Average latency in milliseconds
- **successRate**: Percentage of successful operations (0-100)
- **circuitBreakerState**: Circuit breaker state (closed, open, half-open)
- **retryCount**: Number of retry attempts
- **nextRetryAt**: When the next retry will be attempted

## Circuit Breaker States

### Closed (Normal Operation)
- Relay is operating normally
- All requests are allowed through
- Failures are counted

### Open (Failing)
- Relay has exceeded failure threshold
- All requests are blocked
- Waits for cooldown period before transitioning to half-open

### Half-Open (Testing)
- Cooldown period has elapsed
- Limited requests are allowed through to test if relay has recovered
- Success → transitions back to closed
- Failure → transitions back to open

## Configuration

### Circuit Breaker Configuration

```typescript
import { RelayHealthMonitor } from './lib/relays/relay-health-monitor';

const monitor = new RelayHealthMonitor({
  failureThreshold: 5,      // Open circuit after 5 failures
  successThreshold: 2,      // Close circuit after 2 successes
  openDuration: 60000,      // Keep open for 60 seconds
  halfOpenMaxAttempts: 3    // Allow 3 attempts in half-open
});
```

### Backoff Configuration

```typescript
const monitor = new RelayHealthMonitor(
  {}, // Use default circuit breaker config
  {
    initialDelay: 1000,     // Start with 1 second
    maxDelay: 300000,       // Max 5 minutes
    multiplier: 2,          // Double each time
    jitter: true            // Add random jitter
  }
);
```

## Integration with DM Controller

The enhanced relay pool integrates seamlessly with the enhanced DM controller:

```typescript
import { useEnhancedRelayPool } from './lib/relays/enhanced-relay-pool';
import { useEnhancedDMController } from './lib/messaging/enhanced-dm-controller';

function MessagingComponent() {
  const pool = useEnhancedRelayPool(relayUrls);
  const dmController = useEnhancedDMController({
    myPublicKeyHex,
    myPrivateKeyHex,
    pool, // Pass enhanced pool
    blocklist,
    peerTrust,
    requestsInbox
  });
  
  // Send message with automatic multi-relay publishing
  const handleSend = async () => {
    const result = await dmController.sendDm({
      peerPublicKeyInput: recipientPubkey,
      plaintext: messageText
    });
    
    if (result.success) {
      console.log(`Message sent to ${result.relayResults.filter(r => r.success).length} relays`);
    }
  };
  
  return <div>...</div>;
}
```

## Requirements Implemented

- **4.2**: Connection retry with exponential backoff
- **4.3**: Relay marked as offline, continues with other relays
- **4.6**: Connection status maintained for each relay
- **7.7**: Circuit breaker pattern for failing relays
- **1.4**: Publish events to all connected relays
- **1.5**: Handle individual relay failures gracefully
- **4.8**: Relay prioritization based on performance
