# Messaging System Debugging Guide

This guide explains how to use the debugging and monitoring tools available in the messaging system.

## Overview

The messaging system includes three main debugging utilities:

1. **Message Flow Debugger** - Tracks message lifecycle and relay interactions
2. **Performance Monitor** - Monitors system performance and health
3. **Message Logger** - Provides comprehensive logging with filtering

All tools are accessible via the browser console when running in development mode.

## Message Flow Debugger

The Message Flow Debugger tracks every step of a message's journey through the system, from creation to delivery.

### Enabling the Debugger

```javascript
// In browser console
messageFlowDebugger.enable()
```

### Viewing Message Flow

```javascript
// Get flow for a specific message
const flow = messageFlowDebugger.getMessageFlow('message_id_here')
console.log(flow)

// Get recent message flows
const recentFlows = messageFlowDebugger.getRecentFlows(10)
console.log(recentFlows)

// Get all tracked message IDs
const messageIds = messageFlowDebugger.getTrackedMessageIds()
console.log(messageIds)
```

### Analyzing Relay Performance

```javascript
// Get relay statistics
const relayStats = messageFlowDebugger.getRelayStats()
console.log(relayStats)

// Example output:
// Map {
//   'wss://relay1.example.com' => {
//     totalInteractions: 50,
//     successCount: 48,
//     failureCount: 2,
//     averageLatency: 125,
//     successRate: 0.96
//   }
// }
```

### Exporting Debug Data

```javascript
// Export all debug data as JSON
const debugData = messageFlowDebugger.exportDebugData()
console.log(debugData)

// Save to file (in browser)
const blob = new Blob([debugData], { type: 'application/json' })
const url = URL.createObjectURL(blob)
const a = document.createElement('a')
a.href = url
a.download = 'message-debug-data.json'
a.click()
```

### Clearing Debug Data

```javascript
// Clear all tracked data
messageFlowDebugger.clear()
```

### Disabling the Debugger

```javascript
// Disable debugging
messageFlowDebugger.disable()
```

## Performance Monitor

The Performance Monitor tracks system performance metrics and alerts on performance issues.

### Enabling the Monitor

```javascript
// Enable with default 5-second interval
performanceMonitor.enable()

// Enable with custom interval (in milliseconds)
performanceMonitor.enable(10000) // 10 seconds
```

### Viewing Current Metrics

```javascript
// Get current performance metrics
const metrics = performanceMonitor.getCurrentMetrics()
console.log(metrics)

// Example output:
// {
//   messagesPerSecond: 2.5,
//   averageMessageLatency: 85,
//   messageQueueSize: 0,
//   connectedRelays: 3,
//   averageRelayLatency: 120,
//   relaySuccessRate: 0.95,
//   memoryUsageMB: 45,
//   activeSubscriptions: 2,
//   uiUpdateLatency: 35,
//   frameRate: 60
// }
```

### Recording Custom Metrics

```javascript
// Record a message sent
performanceMonitor.recordMessageSent()

// Record message latency
performanceMonitor.recordMessageLatency(150) // 150ms

// Record relay latency
performanceMonitor.recordRelayLatency(200, true) // 200ms, success

// Record UI update latency
performanceMonitor.recordUIUpdateLatency(45) // 45ms
```

### Exporting Performance Data

```javascript
// Export performance data
const perfData = performanceMonitor.exportData()
console.log(perfData)
```

### Disabling the Monitor

```javascript
// Disable monitoring
performanceMonitor.disable()
```

## Message Logger

The Message Logger provides comprehensive logging with filtering and export capabilities.

### Setting Log Level

```javascript
// Set minimum log level
messageLogger.setLevel(LogLevel.DEBUG) // Show all logs
messageLogger.setLevel(LogLevel.INFO)  // Show info, warn, error
messageLogger.setLevel(LogLevel.WARN)  // Show warn, error only
messageLogger.setLevel(LogLevel.ERROR) // Show errors only
```

### Viewing Logs

```javascript
// Get all logs
const allLogs = messageLogger.getLogs()
console.log(allLogs)

// Get logs for a specific message
const messageLogs = messageLogger.getMessageLogs('message_id_here')
console.log(messageLogs)

// Get logs for a specific relay
const relayLogs = messageLogger.getRelayLogs('wss://relay1.example.com')
console.log(relayLogs)

// Get only error logs
const errors = messageLogger.getErrors()
console.log(errors)

// Get logs with custom filter
const filtered = messageLogger.getLogs({
  level: LogLevel.WARN,
  category: 'relay-publish',
  startTime: new Date(Date.now() - 3600000) // Last hour
})
console.log(filtered)
```

### Viewing Log Statistics

```javascript
// Get log statistics
const stats = messageLogger.getStatistics()
console.log(stats)

// Example output:
// {
//   total: 1250,
//   byLevel: { DEBUG: 500, INFO: 600, WARN: 100, ERROR: 50 },
//   byCategory: { 'message-send': 300, 'relay-publish': 400, ... },
//   errorCount: 50,
//   warningCount: 100
// }
```

### Exporting Logs

```javascript
// Export as JSON
const jsonLogs = messageLogger.exportLogs()
console.log(jsonLogs)

// Export as CSV
const csvLogs = messageLogger.exportLogsCSV()
console.log(csvLogs)

// Export filtered logs
const errorLogs = messageLogger.exportLogs({ level: LogLevel.ERROR })
console.log(errorLogs)
```

### Clearing Logs

```javascript
// Clear all logs
messageLogger.clear()
```

## Common Debugging Scenarios

### Debugging Message Delivery Issues

```javascript
// 1. Enable all debugging tools
messageFlowDebugger.enable()
performanceMonitor.enable()
messageLogger.setLevel(LogLevel.DEBUG)

// 2. Send a test message
// (use the UI to send a message)

// 3. Check message flow
const messageIds = messageFlowDebugger.getTrackedMessageIds()
const latestMessageId = messageIds[messageIds.length - 1]
const flow = messageFlowDebugger.getMessageFlow(latestMessageId)
console.log('Message Flow:', flow)

// 4. Check logs for that message
const logs = messageLogger.getMessageLogs(latestMessageId)
console.log('Message Logs:', logs)

// 5. Check for errors
const errors = messageLogger.getErrors()
console.log('Recent Errors:', errors)
```

### Debugging Relay Connection Issues

```javascript
// 1. Check relay statistics
const relayStats = messageFlowDebugger.getRelayStats()
console.log('Relay Stats:', relayStats)

// 2. Check relay-specific logs
const relayUrl = 'wss://relay1.example.com'
const relayLogs = messageLogger.getRelayLogs(relayUrl)
console.log('Relay Logs:', relayLogs)

// 3. Check performance metrics
const metrics = performanceMonitor.getCurrentMetrics()
console.log('Relay Latency:', metrics.averageRelayLatency)
console.log('Relay Success Rate:', metrics.relaySuccessRate)
```

### Debugging Performance Issues

```javascript
// 1. Check current performance
const metrics = performanceMonitor.getCurrentMetrics()
console.log('Performance Metrics:', metrics)

// 2. Check for performance warnings
// (warnings are logged automatically every 5 seconds)

// 3. Check UI update latency
console.log('UI Update Latency:', metrics.uiUpdateLatency)
console.log('Frame Rate:', metrics.frameRate)

// 4. Check memory usage
console.log('Memory Usage:', metrics.memoryUsageMB, 'MB')
```

### Debugging Encryption/Decryption Issues

```javascript
// 1. Set log level to DEBUG
messageLogger.setLevel(LogLevel.DEBUG)

// 2. Filter logs by category
const encryptionLogs = messageLogger.getLogs({ category: 'encryption' })
const decryptionLogs = messageLogger.getLogs({ category: 'decryption' })

console.log('Encryption Logs:', encryptionLogs)
console.log('Decryption Logs:', decryptionLogs)

// 3. Check for errors
const encryptionErrors = encryptionLogs.filter(log => log.level === LogLevel.ERROR)
const decryptionErrors = decryptionLogs.filter(log => log.level === LogLevel.ERROR)

console.log('Encryption Errors:', encryptionErrors)
console.log('Decryption Errors:', decryptionErrors)
```

## Performance Thresholds

The system monitors these performance thresholds:

- **UI Update Latency**: Target < 100ms (Requirement 8.2)
- **Message Queue Size**: Target < 100 messages (Requirement 8.3)
- **Memory Usage**: Target < 200MB (Requirement 8.5)
- **Relay Latency**: Target < 1000ms
- **Relay Success Rate**: Target > 80%
- **Frame Rate**: Target > 30 fps

When thresholds are exceeded, warnings are logged automatically.

## Best Practices

1. **Enable debugging only when needed** - Debugging tools add overhead
2. **Use appropriate log levels** - DEBUG for development, INFO for production
3. **Export data before clearing** - Save debug data for later analysis
4. **Monitor performance regularly** - Check metrics periodically
5. **Clear old data** - Prevent memory buildup by clearing old logs/debug data

## Troubleshooting

### High Memory Usage

```javascript
// Check memory usage
const metrics = performanceMonitor.getCurrentMetrics()
console.log('Memory:', metrics.memoryUsageMB, 'MB')

// Clear debug data to free memory
messageFlowDebugger.clear()
messageLogger.clear()
```

### Slow UI Updates

```javascript
// Check UI performance
const metrics = performanceMonitor.getCurrentMetrics()
console.log('UI Latency:', metrics.uiUpdateLatency, 'ms')
console.log('Frame Rate:', metrics.frameRate, 'fps')

// Check for performance warnings in console
```

### Messages Not Sending

```javascript
// Check relay connections
const relayStats = messageFlowDebugger.getRelayStats()
console.log('Relay Stats:', relayStats)

// Check for relay errors
const relayErrors = messageLogger.getLogs({ 
  category: 'relay-publish',
  level: LogLevel.ERROR 
})
console.log('Relay Errors:', relayErrors)
```

## Support

For additional help:
- Check the console for automatic warnings and errors
- Export debug data and share with the development team
- Review the requirements document for expected behavior
