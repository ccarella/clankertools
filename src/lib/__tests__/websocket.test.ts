import { WebSocketService } from '../websocket';

// Mock WebSocket
let mockWebSocketInstance: {
  url: string;
  readyState: number;
  CONNECTING: number;
  OPEN: number;
  CLOSING: number;
  CLOSED: number;
  send: jest.Mock;
  close: jest.Mock;
  onopen: (() => void) | null;
  onclose: (() => void) | null;
  onerror: ((error: unknown) => void) | null;
  onmessage: ((event: { data: string }) => void) | null;
};
const mockSend = jest.fn();
const mockClose = jest.fn();

(global as unknown as { WebSocket: jest.Mock }).WebSocket = jest.fn().mockImplementation((url: string) => {
  mockWebSocketInstance = {
    url,
    readyState: 0,
    CONNECTING: 0,
    OPEN: 1,
    CLOSING: 2,
    CLOSED: 3,
    send: mockSend,
    close: mockClose.mockImplementation(function(this: typeof mockWebSocketInstance) {
      this.readyState = 3;
      this.onclose?.();
    }),
    onopen: null,
    onclose: null,
    onerror: null,
    onmessage: null,
  };

  // Simulate async connection
  setTimeout(() => {
    mockWebSocketInstance.readyState = 1;
    mockWebSocketInstance.onopen?.();
  }, 0);

  return mockWebSocketInstance;
});

describe('WebSocketService', () => {
  let service: WebSocketService;
  const TEST_URL = 'ws://localhost:8080';
  const TOKEN_ADDRESS = '0x123456789abcdef';

  beforeEach(() => {
    jest.clearAllMocks();
    mockSend.mockClear();
    mockClose.mockClear();
    service = new WebSocketService(TEST_URL);
  });

  afterEach(() => {
    service.disconnect();
  });

  describe('Connection Management', () => {
    it('should connect to WebSocket server', async () => {
      const onOpen = jest.fn();
      service.on('open', onOpen);
      
      service.connect();
      
      // Wait for async connection
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(onOpen).toHaveBeenCalled();
      expect(service.isConnected()).toBe(true);
    });

    it('should disconnect from WebSocket server', async () => {
      const onClose = jest.fn();
      service.on('close', onClose);
      
      service.connect();
      await new Promise(resolve => setTimeout(resolve, 10));
      
      service.disconnect();
      
      expect(mockClose).toHaveBeenCalled();
      expect(service.isConnected()).toBe(false);
    });

    it('should handle connection errors', async () => {
      const onError = jest.fn();
      service.on('error', onError);
      
      service.connect();
      await new Promise(resolve => setTimeout(resolve, 10));
      
      const error = new Error('Connection failed');
      mockWebSocketInstance.onerror?.(error);
      
      expect(onError).toHaveBeenCalledWith(error);
    });

    it('should reconnect after disconnect', async () => {
      const onReconnect = jest.fn();
      service.on('reconnect', onReconnect);
      
      service.connect();
      await new Promise(resolve => setTimeout(resolve, 10));
      
      // Simulate connection close
      mockWebSocketInstance.readyState = 3;
      mockWebSocketInstance.onclose?.();
      
      // Wait for reconnection attempt
      await new Promise(resolve => setTimeout(resolve, 100));
      
      expect(onReconnect).toHaveBeenCalled();
    });

    it('should limit reconnection attempts', async () => {
      const onMaxReconnect = jest.fn();
      const onError = jest.fn(); // Capture error events
      service.on('maxReconnectAttempts', onMaxReconnect);
      service.on('error', onError); // Listen for errors to prevent unhandled error
      
      // Force multiple reconnection failures
      for (let i = 0; i < 6; i++) {
        service.connect();
        await new Promise(resolve => setTimeout(resolve, 10));
        
        if (mockWebSocketInstance) {
          mockWebSocketInstance.readyState = 3;
          mockWebSocketInstance.onerror?.(new Error('Connection failed'));
          mockWebSocketInstance.onclose?.();
        }
        
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      
      expect(onMaxReconnect).toHaveBeenCalled();
    });
  });

  describe('Message Handling', () => {
    beforeEach(async () => {
      service.connect();
      await new Promise(resolve => setTimeout(resolve, 10));
      mockWebSocketInstance.readyState = 1; // Ensure OPEN state
    });

    it('should subscribe to token updates', () => {
      service.subscribeToToken(TOKEN_ADDRESS);
      
      expect(mockSend).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'subscribe',
          channel: 'token',
          address: TOKEN_ADDRESS
        })
      );
    });

    it('should unsubscribe from token updates', () => {
      service.subscribeToToken(TOKEN_ADDRESS);
      mockSend.mockClear();
      
      service.unsubscribeFromToken(TOKEN_ADDRESS);
      
      expect(mockSend).toHaveBeenCalledWith(
        JSON.stringify({
          type: 'unsubscribe',
          channel: 'token',
          address: TOKEN_ADDRESS
        })
      );
    });

    it('should handle token update messages', () => {
      const onTokenUpdate = jest.fn();
      service.on('tokenUpdate', onTokenUpdate);
      
      const tokenData = {
        address: TOKEN_ADDRESS,
        marketCap: '1000000',
        holders: 100,
        volume24h: '50000',
        priceChange24h: 5.5
      };
      
      mockWebSocketInstance.onmessage?.({
        data: JSON.stringify({
          type: 'tokenUpdate',
          data: tokenData
        })
      });
      
      expect(onTokenUpdate).toHaveBeenCalledWith(tokenData);
    });

    it('should handle price update messages', () => {
      const onPriceUpdate = jest.fn();
      service.on('priceUpdate', onPriceUpdate);
      
      const priceData = {
        address: TOKEN_ADDRESS,
        price: '0.001',
        marketCap: '1000000',
        priceChange24h: 5.5
      };
      
      mockWebSocketInstance.onmessage?.({
        data: JSON.stringify({
          type: 'priceUpdate',
          data: priceData
        })
      });
      
      expect(onPriceUpdate).toHaveBeenCalledWith(priceData);
    });
  });

  describe('Heartbeat', () => {
    beforeEach(async () => {
      service.connect();
      await new Promise(resolve => setTimeout(resolve, 10));
      mockWebSocketInstance.readyState = 1; // Ensure OPEN state
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should send heartbeat messages', () => {
      jest.advanceTimersByTime(30000); // 30 seconds
      
      expect(mockSend).toHaveBeenCalledWith(
        JSON.stringify({ type: 'ping' })
      );
    });

    it('should handle heartbeat timeout', () => {
      const onTimeout = jest.fn();
      service.on('timeout', onTimeout);
      
      // Advance time without receiving pong
      jest.advanceTimersByTime(60000); // 60 seconds
      
      expect(onTimeout).toHaveBeenCalled();
    });

    it('should reset heartbeat on pong', () => {
      const onTimeout = jest.fn();
      service.on('timeout', onTimeout);
      
      jest.advanceTimersByTime(30000); // 30 seconds
      
      // Send pong response
      mockWebSocketInstance.onmessage?.({
        data: JSON.stringify({ type: 'pong' })
      });
      
      // Advance time but not enough for timeout
      jest.advanceTimersByTime(40000); // 40 seconds
      
      expect(onTimeout).not.toHaveBeenCalled();
    });
  });

  describe('State Management', () => {
    it('should track connection state', async () => {
      expect(service.isConnected()).toBe(false);
      expect(service.isConnecting()).toBe(false);
      
      service.connect();
      expect(service.isConnecting()).toBe(true);
      
      await new Promise(resolve => setTimeout(resolve, 10));
      
      expect(service.isConnected()).toBe(true);
      expect(service.isConnecting()).toBe(false);
    });

    it('should track subscribed tokens', async () => {
      service.connect();
      await new Promise(resolve => setTimeout(resolve, 10));
      mockWebSocketInstance.readyState = 1;
      
      service.subscribeToToken(TOKEN_ADDRESS);
      expect(service.isSubscribedToToken(TOKEN_ADDRESS)).toBe(true);
      
      service.unsubscribeFromToken(TOKEN_ADDRESS);
      expect(service.isSubscribedToToken(TOKEN_ADDRESS)).toBe(false);
    });

    it('should clean up subscriptions on disconnect', async () => {
      service.connect();
      await new Promise(resolve => setTimeout(resolve, 10));
      mockWebSocketInstance.readyState = 1;
      
      service.subscribeToToken(TOKEN_ADDRESS);
      expect(service.isSubscribedToToken(TOKEN_ADDRESS)).toBe(true);
      
      service.disconnect();
      
      expect(service.isSubscribedToToken(TOKEN_ADDRESS)).toBe(false);
    });
  });
});