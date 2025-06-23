import { renderHook, act, waitFor } from '@testing-library/react';
import { useTransactionStatus } from '../useTransactionStatus';

// Mock EventSource
class MockEventSource {
  public onopen: ((event: Event) => void) | null = null;
  public onerror: ((event: Event) => void) | null = null;
  public onmessage: ((event: MessageEvent) => void) | null = null;
  public readyState: number = EventSource.CONNECTING;
  public url: string;
  private listeners: Map<string, ((event: MessageEvent) => void)[]> = new Map();

  constructor(url: string) {
    this.url = url;
    // Simulate connection after a short delay
    setTimeout(() => {
      this.readyState = EventSource.OPEN;
      this.onopen?.(new Event('open'));
    }, 10);
  }

  addEventListener(type: string, listener: (event: MessageEvent) => void) {
    if (!this.listeners.has(type)) {
      this.listeners.set(type, []);
    }
    this.listeners.get(type)!.push(listener);
  }

  removeEventListener(type: string, listener: (event: MessageEvent) => void) {
    const typeListeners = this.listeners.get(type);
    if (typeListeners) {
      const index = typeListeners.indexOf(listener);
      if (index !== -1) {
        typeListeners.splice(index, 1);
      }
    }
  }

  close() {
    this.readyState = EventSource.CLOSED;
  }

  // Test utility methods
  simulateStatusEvent(data: unknown) {
    const event = new MessageEvent('status', {
      data: JSON.stringify(data),
    });
    const listeners = this.listeners.get('status') || [];
    listeners.forEach(listener => listener(event));
  }

  simulateHeartbeat() {
    const event = new MessageEvent('heartbeat', {
      data: JSON.stringify({ timestamp: Date.now() }),
    });
    const listeners = this.listeners.get('heartbeat') || [];
    listeners.forEach(listener => listener(event));
  }

  simulateError(errorData?: unknown) {
    if (errorData) {
      const event = new MessageEvent('error', {
        data: JSON.stringify(errorData),
      });
      const listeners = this.listeners.get('error') || [];
      listeners.forEach(listener => listener(event));
    } else {
      this.readyState = EventSource.CLOSED;
      this.onerror?.(new Event('error'));
    }
  }
}

// Set up the mock
global.EventSource = MockEventSource as typeof EventSource;

describe('useTransactionStatus', () => {
  let mockEventSource: MockEventSource;
  
  beforeEach(() => {
    jest.clearAllMocks();
    mockEventSource = null as unknown as MockEventSource;
    
    // Capture the created EventSource for testing
    // const OriginalEventSource = global.EventSource;
    global.EventSource = function(url: string) {
      mockEventSource = new MockEventSource(url);
      return mockEventSource;
    } as typeof EventSource;
    global.EventSource.CONNECTING = 0;
    global.EventSource.OPEN = 1;
    global.EventSource.CLOSED = 2;
  });

  afterEach(() => {
    if (mockEventSource) {
      mockEventSource.close();
    }
  });

  it('should return initial state when no transaction ID provided', () => {
    const { result } = renderHook(() => useTransactionStatus(null));

    expect(result.current.status).toBeNull();
    expect(result.current.isConnected).toBe(false);
    expect(result.current.isReconnecting).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.reconnectAttempts).toBe(0);
  });

  it('should establish connection when transaction ID is provided', async () => {
    const { result } = renderHook(() => 
      useTransactionStatus('tx_123', { debug: true })
    );

    expect(result.current.isConnected).toBe(false);

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    expect(mockEventSource).toBeDefined();
    expect(mockEventSource.url).toBe('/api/transaction/tx_123/events');
  });

  it('should handle status updates', async () => {
    const { result } = renderHook(() => useTransactionStatus('tx_123'));

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    const statusUpdate = {
      id: 'tx_123',
      status: 'processing' as const,
      progress: 50,
      timestamp: Date.now(),
    };

    act(() => {
      mockEventSource.simulateStatusEvent(statusUpdate);
    });

    await waitFor(() => {
      expect(result.current.status).toEqual(statusUpdate);
    });
  });

  it('should handle heartbeat events', async () => {
    const { result } = renderHook(() => useTransactionStatus('tx_123'));

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    // Heartbeat should not change status but connection should remain active
    act(() => {
      mockEventSource.simulateHeartbeat();
    });

    expect(result.current.isConnected).toBe(true);
  });

  it('should handle error events', async () => {
    const { result } = renderHook(() => useTransactionStatus('tx_123'));

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    const errorData = { message: 'Transaction not found' };

    act(() => {
      mockEventSource.simulateError(errorData);
    });

    await waitFor(() => {
      expect(result.current.error).toBe('Transaction not found');
    });
  });

  it('should attempt reconnection on connection failure', async () => {
    jest.useFakeTimers();

    const { result } = renderHook(() => 
      useTransactionStatus('tx_123', {
        autoReconnect: true,
        maxReconnectAttempts: 3,
        reconnectDelay: 1000,
      })
    );

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    // Simulate connection error
    act(() => {
      mockEventSource.simulateError();
    });

    await waitFor(() => {
      expect(result.current.isConnected).toBe(false);
      expect(result.current.isReconnecting).toBe(true);
    });

    // Fast-forward timer to trigger reconnect
    act(() => {
      jest.advanceTimersByTime(1000);
    });

    await waitFor(() => {
      expect(result.current.reconnectAttempts).toBe(1);
    });

    jest.useRealTimers();
  });

  it('should stop reconnecting after max attempts', async () => {
    jest.useFakeTimers();

    const { result } = renderHook(() => 
      useTransactionStatus('tx_123', {
        autoReconnect: true,
        maxReconnectAttempts: 2,
        reconnectDelay: 100,
      })
    );

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    // Simulate multiple connection failures
    for (let i = 0; i < 3; i++) {
      act(() => {
        mockEventSource.simulateError();
      });

      act(() => {
        jest.advanceTimersByTime(100 * Math.pow(2, i));
      });
    }

    await waitFor(() => {
      expect(result.current.reconnectAttempts).toBeGreaterThanOrEqual(2);
      expect(result.current.isReconnecting).toBe(false);
    });

    jest.useRealTimers();
  });

  it('should handle manual reconnect', async () => {
    const { result } = renderHook(() => useTransactionStatus('tx_123'));

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    // Simulate connection loss
    act(() => {
      mockEventSource.simulateError();
    });

    await waitFor(() => {
      expect(result.current.isConnected).toBe(false);
    });

    // Manual reconnect
    act(() => {
      result.current.reconnect();
    });

    await waitFor(() => {
      expect(result.current.reconnectAttempts).toBe(0); // Should reset attempts
      expect(result.current.isConnected).toBe(true);
    });
  });

  it('should handle manual disconnect', async () => {
    const { result } = renderHook(() => useTransactionStatus('tx_123'));

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    act(() => {
      result.current.disconnect();
    });

    expect(result.current.isConnected).toBe(false);
    expect(result.current.status).toBeNull();
    expect(result.current.error).toBeNull();
  });

  it('should handle transaction ID changes', async () => {
    const { result, rerender } = renderHook(
      ({ txId }) => useTransactionStatus(txId),
      { initialProps: { txId: 'tx_123' } }
    );

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    const firstEventSource = mockEventSource;

    // Change transaction ID
    rerender({ txId: 'tx_456' });

    await waitFor(() => {
      expect(mockEventSource).not.toBe(firstEventSource);
      expect(mockEventSource.url).toBe('/api/transaction/tx_456/events');
    });
  });

  it('should clean up on unmount', async () => {
    const { result, unmount } = renderHook(() => useTransactionStatus('tx_123'));

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    const eventSource = mockEventSource;
    const closeSpy = jest.spyOn(eventSource, 'close');

    unmount();

    expect(closeSpy).toHaveBeenCalled();
  });

  it('should handle malformed status updates', async () => {
    const { result } = renderHook(() => useTransactionStatus('tx_123'));

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    // Simulate malformed data
    const malformedEvent = new MessageEvent('status', {
      data: 'invalid json',
    });

    act(() => {
      const listeners = mockEventSource['listeners'].get('status') || [];
      listeners.forEach(listener => listener(malformedEvent));
    });

    await waitFor(() => {
      expect(result.current.error).toBe('Failed to parse status update');
    });
  });

  it('should use exponential backoff for reconnection delays', async () => {
    jest.useFakeTimers();

    const { result } = renderHook(() => 
      useTransactionStatus('tx_123', {
        autoReconnect: true,
        maxReconnectAttempts: 5,
        reconnectDelay: 100,
      })
    );

    await waitFor(() => {
      expect(result.current.isConnected).toBe(true);
    });

    // Test exponential backoff: 100ms, 200ms, 400ms, 800ms, 1600ms, but capped at 3200ms
    const expectedDelays = [100, 200, 400, 800, 1600];

    for (let i = 0; i < expectedDelays.length; i++) {
      act(() => {
        mockEventSource.simulateError();
      });

      act(() => {
        jest.advanceTimersByTime(expectedDelays[i]);
      });

      await waitFor(() => {
        expect(result.current.reconnectAttempts).toBe(i + 1);
      });
    }

    jest.useRealTimers();
  });
});