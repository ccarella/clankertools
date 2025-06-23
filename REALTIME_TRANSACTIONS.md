# Real-time Transaction Status Updates

This implementation provides real-time status updates for transactions using Server-Sent Events (SSE). The system is designed to be mobile-optimized, battery-efficient, and resilient to connection issues.

## Architecture Overview

### 1. SSE API Route (`/api/transaction/[id]/events`)
- **Location**: `src/app/api/transaction/[id]/events/route.ts`
- **Purpose**: Streams real-time transaction status updates to clients
- **Features**:
  - Edge runtime for optimal performance
  - Automatic cleanup on client disconnect
  - Heartbeat mechanism to keep connections alive
  - Progress calculation based on transaction status
  - Security headers and CORS support

### 2. React Hook (`useTransactionStatus`)
- **Location**: `src/lib/hooks/useTransactionStatus.ts`
- **Purpose**: Manages SSE connections and provides transaction status updates
- **Features**:
  - Automatic reconnection with exponential backoff
  - Connection state management
  - Error handling and recovery
  - Configurable options for reconnection behavior
  - Debug logging capabilities

### 3. Transaction Provider (`TransactionProvider`)
- **Location**: `src/components/providers/TransactionProvider.tsx`
- **Purpose**: Manages multiple transaction subscriptions efficiently
- **Features**:
  - Centralized subscription management
  - Global connection status tracking
  - Multiple concurrent subscriptions support
  - Automatic cleanup on unmount
  - Callback-based updates

### 4. Enhanced Transaction Status Card
- **Location**: `src/components/transaction/TransactionStatusCard.tsx`
- **Purpose**: Displays transaction status with real-time updates
- **Features**:
  - Real-time status integration
  - Connection status indicators
  - Graceful degradation when provider unavailable
  - Mobile-optimized design
  - Haptic feedback on status changes

## Key Features

### Mobile Optimization
- **Battery Efficiency**: Connections automatically close for terminal transaction states
- **Touch Targets**: All interactive elements meet minimum 44px touch target size
- **Haptic Feedback**: Native haptic feedback on status changes
- **Responsive Design**: Optimized layouts for mobile viewports

### Reliability
- **Automatic Reconnection**: Exponential backoff with configurable retry limits
- **Connection Health**: Heartbeat mechanism to detect stale connections
- **Error Recovery**: Robust error handling with detailed error states
- **Graceful Degradation**: Works without real-time updates when provider unavailable

### Security
- **CORS Headers**: Configurable origin validation
- **Input Validation**: Transaction ID format validation
- **Security Headers**: XSS protection, content type validation
- **Rate Limiting**: Built into the existing transaction system

## Implementation Details

### SSE Stream Format
```
event: status
data: {"id":"tx_123","status":"processing","progress":50,"timestamp":1234567890}

event: heartbeat
data: {"timestamp":1234567890}

event: error
data: {"message":"Transaction not found"}
```

### Status Mapping
- `queued` → `pending` (10% progress)
- `processing` → `processing` (50% progress)
- `completed` → `success` (100% progress)
- `failed` → `failed` (0% progress)
- `cancelled` → `cancelled` (0% progress)

### Connection Lifecycle
1. **Initialization**: Client connects to SSE endpoint
2. **Authentication**: Transaction ID validation
3. **Status Delivery**: Initial status + real-time updates
4. **Heartbeat**: Periodic keep-alive messages
5. **Cleanup**: Automatic cleanup on terminal states or disconnect

## Usage Examples

### Basic Usage
```tsx
import { TransactionStatusCard } from '@/components/transaction/TransactionStatusCard';

<TransactionStatusCard 
  transaction={transaction}
  enableRealTimeUpdates={true}
  onCancel={handleCancel}
  onRetry={handleRetry}
/>
```

### Advanced Usage with Provider
```tsx
import { TransactionProvider } from '@/components/providers/TransactionProvider';
import { useTransactionSubscription } from '@/components/providers/TransactionProvider';

function MyComponent() {
  const subscription = useTransactionSubscription('tx_123', {
    autoReconnect: true,
    maxReconnectAttempts: 5,
    reconnectDelay: 1000,
  });

  return (
    <div>
      Status: {subscription?.status?.status}
      Connected: {subscription?.isConnected ? 'Yes' : 'No'}
    </div>
  );
}

// Wrap your app with the provider
<TransactionProvider>
  <MyComponent />
</TransactionProvider>
```

### Direct Hook Usage
```tsx
import { useTransactionStatus } from '@/lib/hooks/useTransactionStatus';

function TransactionMonitor({ transactionId }) {
  const { status, isConnected, error, reconnect } = useTransactionStatus(transactionId, {
    autoReconnect: true,
    maxReconnectAttempts: 3,
    reconnectDelay: 2000,
    debug: true,
  });

  if (error) {
    return <div>Error: {error} <button onClick={reconnect}>Retry</button></div>;
  }

  return (
    <div>
      <div>Status: {status?.status}</div>
      <div>Progress: {status?.progress}%</div>
      <div>Connected: {isConnected ? '🟢' : '🔴'}</div>
    </div>
  );
}
```

## Configuration Options

### useTransactionStatus Options
```typescript
interface UseTransactionStatusOptions {
  autoReconnect?: boolean;        // Default: true
  maxReconnectAttempts?: number;  // Default: 5
  reconnectDelay?: number;        // Default: 1000ms
  debug?: boolean;               // Default: false
}
```

### TransactionProvider Options
```typescript
interface TransactionProviderProps {
  children: React.ReactNode;
  defaultOptions?: UseTransactionStatusOptions;
}
```

## Testing

### Test Coverage
- SSE API route functionality
- Connection management and reconnection
- Provider subscription management
- Component integration with real-time updates
- Error handling and edge cases

### Test Files
- `src/app/api/transaction/[id]/events/__tests__/route.test.ts`
- `src/lib/hooks/__tests__/useTransactionStatus.test.ts`
- `src/components/providers/__tests__/TransactionProvider.test.tsx`
- `src/components/transaction/__tests__/TransactionStatusCard.realtime.test.tsx`

## Demo

Visit `/transaction-demo` to see the real-time updates in action with:
- Multiple transaction states
- Connection status indicators
- Toggle for enabling/disabling real-time updates
- Live demonstration of all features

## Performance Considerations

### Client-Side
- **Connection Pooling**: Single connection per transaction
- **Memory Management**: Automatic cleanup prevents memory leaks
- **Event Throttling**: Efficient event handling to prevent UI blocking

### Server-Side
- **Edge Runtime**: Optimal performance for streaming responses
- **Resource Cleanup**: Automatic subscription cleanup on disconnect
- **Scalability**: Stateless design allows horizontal scaling

## Browser Compatibility

- **Modern Browsers**: Full support for EventSource API
- **Mobile Browsers**: Optimized for iOS Safari and Chrome Mobile
- **Fallback**: Graceful degradation to polling if SSE unavailable

## Migration Guide

Existing transaction components can be gradually migrated to use real-time updates:

1. Wrap your app with `TransactionProvider`
2. Update `TransactionStatusCard` usage to enable real-time updates
3. Optionally migrate custom components to use `useTransactionSubscription`

The system is designed to be backward compatible and will gracefully degrade if the provider is not available.