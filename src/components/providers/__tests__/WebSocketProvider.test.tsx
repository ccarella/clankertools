import React from 'react';
import { render, screen, waitFor, act } from '@testing-library/react';
import { WebSocketProvider, useWebSocket } from '../WebSocketProvider';
import { WebSocketService } from '@/lib/websocket';

// Mock WebSocketService
jest.mock('@/lib/websocket');

const MockedWebSocketService = WebSocketService as jest.MockedClass<typeof WebSocketService>;

describe('WebSocketProvider', () => {
  let mockService: WebSocketService;

  beforeEach(() => {
    mockService = {
      connect: jest.fn(),
      disconnect: jest.fn(),
      subscribeToToken: jest.fn(),
      unsubscribeFromToken: jest.fn(),
      isConnected: jest.fn().mockReturnValue(false),
      isConnecting: jest.fn().mockReturnValue(false),
      isSubscribedToToken: jest.fn().mockReturnValue(false),
      on: jest.fn(),
      off: jest.fn(),
      emit: jest.fn(),
    } as unknown as WebSocketService;

    MockedWebSocketService.mockImplementation(() => mockService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('Provider', () => {
    it('should render children', () => {
      render(
        <WebSocketProvider>
          <div>Test Child</div>
        </WebSocketProvider>
      );

      expect(screen.getByText('Test Child')).toBeInTheDocument();
    });

    it('should create WebSocket service on mount', () => {
      render(
        <WebSocketProvider>
          <div>Test</div>
        </WebSocketProvider>
      );

      expect(MockedWebSocketService).toHaveBeenCalledTimes(1);
    });

    it('should connect on mount', () => {
      render(
        <WebSocketProvider>
          <div>Test</div>
        </WebSocketProvider>
      );

      expect(mockService.connect).toHaveBeenCalledTimes(1);
    });

    it('should disconnect on unmount', () => {
      const { unmount } = render(
        <WebSocketProvider>
          <div>Test</div>
        </WebSocketProvider>
      );

      unmount();

      expect(mockService.disconnect).toHaveBeenCalledTimes(1);
    });

    it('should handle custom WebSocket URL', () => {
      const customUrl = 'wss://custom.example.com';
      
      render(
        <WebSocketProvider url={customUrl}>
          <div>Test</div>
        </WebSocketProvider>
      );

      expect(MockedWebSocketService).toHaveBeenCalledWith(customUrl);
    });
  });

  describe('useWebSocket hook', () => {
    const TestComponent = () => {
      const { 
        isConnected, 
        isConnecting, 
        subscribeToToken, 
        unsubscribeFromToken,
        connectionError 
      } = useWebSocket();

      return (
        <div>
          <div>Connected: {isConnected ? 'Yes' : 'No'}</div>
          <div>Connecting: {isConnecting ? 'Yes' : 'No'}</div>
          <div>Error: {connectionError || 'None'}</div>
          <button onClick={() => subscribeToToken('0x123')}>Subscribe</button>
          <button onClick={() => unsubscribeFromToken('0x123')}>Unsubscribe</button>
        </div>
      );
    };

    it('should provide connection status', () => {
      mockService.isConnected.mockReturnValue(true);
      mockService.isConnecting.mockReturnValue(false);

      render(
        <WebSocketProvider>
          <TestComponent />
        </WebSocketProvider>
      );

      expect(screen.getByText('Connected: Yes')).toBeInTheDocument();
      expect(screen.getByText('Connecting: No')).toBeInTheDocument();
    });

    it('should provide subscribe function', () => {
      const { getByText } = render(
        <WebSocketProvider>
          <TestComponent />
        </WebSocketProvider>
      );

      const subscribeButton = getByText('Subscribe');
      act(() => {
        subscribeButton.click();
      });

      expect(mockService.subscribeToToken).toHaveBeenCalledWith('0x123');
    });

    it('should provide unsubscribe function', () => {
      const { getByText } = render(
        <WebSocketProvider>
          <TestComponent />
        </WebSocketProvider>
      );

      const unsubscribeButton = getByText('Unsubscribe');
      act(() => {
        unsubscribeButton.click();
      });

      expect(mockService.unsubscribeFromToken).toHaveBeenCalledWith('0x123');
    });

    it('should update connection status on events', async () => {
      let openHandler: () => void;
      let closeHandler: () => void;

      mockService.on.mockImplementation((event, handler) => {
        if (event === 'open') openHandler = handler;
        if (event === 'close') closeHandler = handler;
        return mockService;
      });

      mockService.isConnected
        .mockReturnValueOnce(false)
        .mockReturnValueOnce(true)
        .mockReturnValueOnce(false);

      const { rerender } = render(
        <WebSocketProvider>
          <TestComponent />
        </WebSocketProvider>
      );

      expect(screen.getByText('Connected: No')).toBeInTheDocument();

      // Simulate connection open
      act(() => {
        openHandler!();
      });

      rerender(
        <WebSocketProvider>
          <TestComponent />
        </WebSocketProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Connected: Yes')).toBeInTheDocument();
      });

      // Simulate connection close
      act(() => {
        closeHandler!();
      });

      rerender(
        <WebSocketProvider>
          <TestComponent />
        </WebSocketProvider>
      );

      await waitFor(() => {
        expect(screen.getByText('Connected: No')).toBeInTheDocument();
      });
    });

    it('should handle connection errors', async () => {
      let errorHandler: (error: Error) => void;

      mockService.on.mockImplementation((event, handler) => {
        if (event === 'error') errorHandler = handler;
        return mockService;
      });

      render(
        <WebSocketProvider>
          <TestComponent />
        </WebSocketProvider>
      );

      expect(screen.getByText('Error: None')).toBeInTheDocument();

      // Simulate error
      act(() => {
        errorHandler!(new Error('Connection failed'));
      });

      await waitFor(() => {
        expect(screen.getByText('Error: Connection failed')).toBeInTheDocument();
      });
    });

    it('should throw error when used outside provider', () => {
      // Suppress console.error for this test
      const originalError = console.error;
      console.error = jest.fn();

      expect(() => {
        render(<TestComponent />);
      }).toThrow('useWebSocket must be used within a WebSocketProvider');

      console.error = originalError;
    });
  });

  describe('Token Updates', () => {
    const TokenUpdateComponent = ({ address }: { address: string }) => {
      const { subscribeToToken, unsubscribeFromToken } = useWebSocket();
      const [tokenData, setTokenData] = React.useState<{ address: string; marketCap: string; holders: number } | null>(null);

      React.useEffect(() => {
        subscribeToToken(address);
        
        const handleUpdate = (data: { address: string; marketCap: string; holders: number }) => {
          if (data.address === address) {
            setTokenData(data);
          }
        };

        mockService.on('tokenUpdate', handleUpdate);

        return () => {
          unsubscribeFromToken(address);
          mockService.off('tokenUpdate', handleUpdate);
        };
      }, [address, subscribeToToken, unsubscribeFromToken]);

      return (
        <div>
          {tokenData ? (
            <div>
              <div>Market Cap: ${tokenData.marketCap}</div>
              <div>Holders: {tokenData.holders}</div>
            </div>
          ) : (
            <div>Loading...</div>
          )}
        </div>
      );
    };

    it('should handle token updates', async () => {
      let tokenUpdateHandler: (data: { address: string; marketCap: string; holders: number }) => void;

      mockService.on.mockImplementation((event, handler) => {
        if (event === 'tokenUpdate') tokenUpdateHandler = handler;
        return mockService;
      });

      render(
        <WebSocketProvider>
          <TokenUpdateComponent address="0x123" />
        </WebSocketProvider>
      );

      expect(screen.getByText('Loading...')).toBeInTheDocument();
      expect(mockService.subscribeToToken).toHaveBeenCalledWith('0x123');

      // Simulate token update
      act(() => {
        tokenUpdateHandler!({
          address: '0x123',
          marketCap: '1000000',
          holders: 100
        });
      });

      await waitFor(() => {
        expect(screen.getByText('Market Cap: $1000000')).toBeInTheDocument();
        expect(screen.getByText('Holders: 100')).toBeInTheDocument();
      });
    });
  });
});