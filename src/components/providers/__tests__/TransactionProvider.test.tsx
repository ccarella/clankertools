import React from 'react';
import { renderHook, waitFor } from '@testing-library/react';
import { TransactionProvider, useTransactionProvider, useTransactionSubscription } from '../TransactionProvider';

// Mock the useTransactionStatus hook
jest.mock('@/lib/hooks/useTransactionStatus', () => ({
  useTransactionStatus: jest.fn(),
}));

import { useTransactionStatus } from '@/lib/hooks/useTransactionStatus';
const mockUseTransactionStatus = useTransactionStatus as jest.MockedFunction<typeof useTransactionStatus>;

const createMockHookResult = (overrides = {}) => ({
  status: null,
  isConnected: false,
  isReconnecting: false,
  error: null,
  reconnectAttempts: 0,
  reconnect: jest.fn(),
  disconnect: jest.fn(),
  ...overrides,
});

const TransactionProviderWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <TransactionProvider>{children}</TransactionProvider>
);

describe('TransactionProvider', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockUseTransactionStatus.mockReturnValue(createMockHookResult());
  });

  describe('useTransactionProvider', () => {
    it('should throw error when used outside provider', () => {
      const { result } = renderHook(() => useTransactionProvider());
      
      expect(result.error).toBeDefined();
      expect(result.error.message).toBe('useTransactionProvider must be used within a TransactionProvider');
    });

    it('should provide context value when used within provider', () => {
      const { result } = renderHook(() => useTransactionProvider(), {
        wrapper: TransactionProviderWrapper,
      });

      expect(result.current).toBeDefined();
      expect(typeof result.current.subscribe).toBe('function');
      expect(typeof result.current.unsubscribe).toBe('function');
      expect(typeof result.current.getSubscription).toBe('function');
      expect(typeof result.current.getAllSubscriptions).toBe('function');
      expect(typeof result.current.onSubscriptionUpdate).toBe('function');
      expect(result.current.globalConnectionStatus).toBeDefined();
    });
  });

  describe('subscription management', () => {
    it('should create and manage subscriptions', () => {
      const { result } = renderHook(() => useTransactionProvider(), {
        wrapper: TransactionProviderWrapper,
      });

      const subscriptionId = result.current.subscribe('tx_123');
      
      expect(subscriptionId).toMatch(/^sub_\d+_\d+$/);
      
      const subscription = result.current.getSubscription(subscriptionId);
      expect(subscription).toBeDefined();
      expect(subscription?.transactionId).toBe('tx_123');
    });

    it('should unsubscribe and clean up subscriptions', () => {
      const mockDisconnect = jest.fn();
      mockUseTransactionStatus.mockReturnValue(createMockHookResult({
        disconnect: mockDisconnect,
      }));

      const { result } = renderHook(() => useTransactionProvider(), {
        wrapper: TransactionProviderWrapper,
      });

      const subscriptionId = result.current.subscribe('tx_123');
      
      expect(result.current.getSubscription(subscriptionId)).toBeDefined();
      
      result.current.unsubscribe(subscriptionId);
      
      expect(result.current.getSubscription(subscriptionId)).toBeNull();
    });

    it('should get all subscriptions', () => {
      const { result } = renderHook(() => useTransactionProvider(), {
        wrapper: TransactionProviderWrapper,
      });

      const sub1 = result.current.subscribe('tx_123');
      const sub2 = result.current.subscribe('tx_456');
      
      const allSubs = result.current.getAllSubscriptions();
      
      expect(Object.keys(allSubs)).toHaveLength(2);
      expect(allSubs[sub1]).toBeDefined();
      expect(allSubs[sub2]).toBeDefined();
    });

    it('should handle subscription updates with callbacks', async () => {
      const mockCallback = jest.fn();
      
      const { result } = renderHook(() => useTransactionProvider(), {
        wrapper: TransactionProviderWrapper,
      });

      const subscriptionId = result.current.subscribe('tx_123');
      const cleanup = result.current.onSubscriptionUpdate(subscriptionId, mockCallback);
      
      expect(typeof cleanup).toBe('function');
    });

    it('should calculate global connection status', () => {
      // Mock multiple subscriptions with different states
      let callCount = 0;
      mockUseTransactionStatus.mockImplementation(() => {
        callCount++;
        switch (callCount) {
          case 1:
            return createMockHookResult({ isConnected: true });
          case 2:
            return createMockHookResult({ isReconnecting: true });
          case 3:
            return createMockHookResult({ error: 'Connection failed' });
          default:
            return createMockHookResult();
        }
      });

      const { result } = renderHook(() => useTransactionProvider(), {
        wrapper: TransactionProviderWrapper,
      });

      result.current.subscribe('tx_123');
      result.current.subscribe('tx_456');
      result.current.subscribe('tx_789');

      const status = result.current.globalConnectionStatus;
      
      expect(status.totalSubscriptions).toBe(3);
      expect(status.connectedSubscriptions).toBe(1);
      expect(status.reconnectingSubscriptions).toBe(1);
      expect(status.failedSubscriptions).toBe(1);
    });

    it('should handle subscription with custom options', () => {
      const { result } = renderHook(() => useTransactionProvider(), {
        wrapper: TransactionProviderWrapper,
      });

      const options = {
        autoReconnect: false,
        maxReconnectAttempts: 3,
        reconnectDelay: 2000,
      };

      result.current.subscribe('tx_123', options);
      
      expect(mockUseTransactionStatus).toHaveBeenCalledWith('tx_123', options);
    });
  });

  describe('useTransactionSubscription hook', () => {
    it('should create subscription and return status', async () => {
      const mockStatus = {
        id: 'tx_123',
        status: 'processing' as const,
        progress: 50,
        timestamp: Date.now(),
      };

      mockUseTransactionStatus.mockReturnValue(createMockHookResult({
        status: mockStatus,
        isConnected: true,
      }));

      const { result } = renderHook(() => useTransactionSubscription('tx_123'), {
        wrapper: TransactionProviderWrapper,
      });

      await waitFor(() => {
        expect(result.current).toBeDefined();
        expect(result.current?.status).toEqual(mockStatus);
        expect(result.current?.isConnected).toBe(true);
      });
    });

    it('should return null when no transaction ID provided', () => {
      const { result } = renderHook(() => useTransactionSubscription(null), {
        wrapper: TransactionProviderWrapper,
      });

      expect(result.current).toBeNull();
    });

    it('should clean up subscription on unmount', () => {
      const { result: providerResult } = renderHook(() => useTransactionProvider(), {
        wrapper: TransactionProviderWrapper,
      });

      const unsubscribeSpy = jest.spyOn(providerResult.current, 'unsubscribe');

      const { unmount } = renderHook(() => useTransactionSubscription('tx_123'), {
        wrapper: TransactionProviderWrapper,
      });

      unmount();

      expect(unsubscribeSpy).toHaveBeenCalled();
    });

    it('should handle transaction ID changes', async () => {
      const { result: providerResult } = renderHook(() => useTransactionProvider(), {
        wrapper: TransactionProviderWrapper,
      });

      const subscribeSpy = jest.spyOn(providerResult.current, 'subscribe');
      const unsubscribeSpy = jest.spyOn(providerResult.current, 'unsubscribe');

      const { rerender } = renderHook(
        ({ txId }) => useTransactionSubscription(txId),
        {
          wrapper: TransactionProviderWrapper,
          initialProps: { txId: 'tx_123' },
        }
      );

      expect(subscribeSpy).toHaveBeenCalledWith('tx_123', undefined);

      rerender({ txId: 'tx_456' });

      await waitFor(() => {
        expect(unsubscribeSpy).toHaveBeenCalled();
        expect(subscribeSpy).toHaveBeenCalledWith('tx_456', undefined);
      });
    });

    it('should pass custom options to subscription', () => {
      const { result: providerResult } = renderHook(() => useTransactionProvider(), {
        wrapper: TransactionProviderWrapper,
      });

      const subscribeSpy = jest.spyOn(providerResult.current, 'subscribe');

      const options = {
        autoReconnect: false,
        maxReconnectAttempts: 2,
      };

      renderHook(() => useTransactionSubscription('tx_123', options), {
        wrapper: TransactionProviderWrapper,
      });

      expect(subscribeSpy).toHaveBeenCalledWith('tx_123', options);
    });
  });

  describe('default options', () => {
    it('should merge default options with subscription options', () => {
      const defaultOptions = {
        autoReconnect: true,
        maxReconnectAttempts: 10,
        reconnectDelay: 500,
      };

      const CustomWrapper: React.FC<{ children: React.ReactNode }> = ({ children }) => (
        <TransactionProvider defaultOptions={defaultOptions}>
          {children}
        </TransactionProvider>
      );

      const { result } = renderHook(() => useTransactionProvider(), {
        wrapper: CustomWrapper,
      });

      const customOptions = {
        maxReconnectAttempts: 5, // Override default
        debug: true, // Additional option
      };

      result.current.subscribe('tx_123', customOptions);

      expect(mockUseTransactionStatus).toHaveBeenCalledWith('tx_123', {
        autoReconnect: true, // From defaults
        maxReconnectAttempts: 5, // Overridden
        reconnectDelay: 500, // From defaults
        debug: true, // Additional
      });
    });
  });

  describe('error handling', () => {
    it('should handle callback errors gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => {});

      const { result } = renderHook(() => useTransactionProvider(), {
        wrapper: TransactionProviderWrapper,
      });

      const subscriptionId = result.current.subscribe('tx_123');
      
      const errorCallback = jest.fn(() => {
        throw new Error('Callback error');
      });

      const cleanup = result.current.onSubscriptionUpdate(subscriptionId, errorCallback);

      // This should not throw, but log the error
      expect(() => cleanup()).not.toThrow();

      consoleSpy.mockRestore();
    });

    it('should handle missing subscription gracefully', () => {
      const consoleSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});

      const { result } = renderHook(() => useTransactionProvider(), {
        wrapper: TransactionProviderWrapper,
      });

      const cleanup = result.current.onSubscriptionUpdate('nonexistent', jest.fn());

      expect(cleanup).toBeDefined();
      expect(typeof cleanup).toBe('function');
      expect(consoleSpy).toHaveBeenCalledWith('Subscription nonexistent not found');

      consoleSpy.mockRestore();
    });
  });
});