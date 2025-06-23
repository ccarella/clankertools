'use client'

import React, { createContext, useContext, useCallback, useRef, useEffect } from 'react';
import { useTransactionStatus, TransactionStatusUpdate, UseTransactionStatusOptions } from '@/lib/hooks/useTransactionStatus';

export interface TransactionSubscription {
  transactionId: string;
  status: TransactionStatusUpdate | null;
  isConnected: boolean;
  isReconnecting: boolean;
  error: string | null;
  reconnectAttempts: number;
  reconnect: () => void;
  disconnect: () => void;
}

export interface TransactionProviderContextValue {
  /** Subscribe to a transaction's status updates */
  subscribe: (transactionId: string, options?: UseTransactionStatusOptions) => string;
  /** Unsubscribe from a transaction's status updates */
  unsubscribe: (subscriptionId: string) => void;
  /** Get the current status of a subscription */
  getSubscription: (subscriptionId: string) => TransactionSubscription | null;
  /** Get all active subscriptions */
  getAllSubscriptions: () => Record<string, TransactionSubscription>;
  /** Subscribe to updates for a specific subscription */
  onSubscriptionUpdate: (subscriptionId: string, callback: (subscription: TransactionSubscription) => void) => () => void;
  /** Global connection status */
  globalConnectionStatus: {
    totalSubscriptions: number;
    connectedSubscriptions: number;
    reconnectingSubscriptions: number;
    failedSubscriptions: number;
  };
}

const TransactionProviderContext = createContext<TransactionProviderContextValue | null>(null);

interface TransactionProviderProps {
  children: React.ReactNode;
  /** Default options for all subscriptions */
  defaultOptions?: UseTransactionStatusOptions;
}

export function TransactionProvider({ children, defaultOptions = {} }: TransactionProviderProps) {
  const subscriptions = useRef<Map<string, {
    transactionId: string;
    options: UseTransactionStatusOptions;
    callbacks: Set<(subscription: TransactionSubscription) => void>;
  }>>(new Map());
  
  const activeHooks = useRef<Map<string, ReturnType<typeof useTransactionStatus>>>(new Map());
  const subscriptionCounterRef = useRef(0);

  const generateSubscriptionId = useCallback(() => {
    return `sub_${Date.now()}_${++subscriptionCounterRef.current}`;
  }, []);

  const subscribe = useCallback((transactionId: string, options: UseTransactionStatusOptions = {}) => {
    const subscriptionId = generateSubscriptionId();
    const mergedOptions = { ...defaultOptions, ...options };
    
    subscriptions.current.set(subscriptionId, {
      transactionId,
      options: mergedOptions,
      callbacks: new Set(),
    });

    return subscriptionId;
  }, [defaultOptions, generateSubscriptionId]);

  const unsubscribe = useCallback((subscriptionId: string) => {
    const subscription = subscriptions.current.get(subscriptionId);
    if (subscription) {
      // Notify all callbacks that subscription is being removed
      subscription.callbacks.forEach(() => {
        try {
          const currentStatus = activeHooks.current.get(subscriptionId);
          if (currentStatus) {
            // Call disconnect to clean up the hook
            currentStatus.disconnect();
          }
        } catch (error) {
          console.error('Error during unsubscribe cleanup:', error);
        }
      });
      
      activeHooks.current.delete(subscriptionId);
      subscriptions.current.delete(subscriptionId);
    }
  }, []);

  const getSubscription = useCallback((subscriptionId: string): TransactionSubscription | null => {
    const subscription = subscriptions.current.get(subscriptionId);
    const hookResult = activeHooks.current.get(subscriptionId);
    
    if (!subscription || !hookResult) {
      return null;
    }

    return {
      transactionId: subscription.transactionId,
      status: hookResult.status,
      isConnected: hookResult.isConnected,
      isReconnecting: hookResult.isReconnecting,
      error: hookResult.error,
      reconnectAttempts: hookResult.reconnectAttempts,
      reconnect: hookResult.reconnect,
      disconnect: hookResult.disconnect,
    };
  }, []);

  const getAllSubscriptions = useCallback((): Record<string, TransactionSubscription> => {
    const result: Record<string, TransactionSubscription> = {};
    
    subscriptions.current.forEach((_, subscriptionId) => {
      const subscription = getSubscription(subscriptionId);
      if (subscription) {
        result[subscriptionId] = subscription;
      }
    });
    
    return result;
  }, [getSubscription]);

  const onSubscriptionUpdate = useCallback((
    subscriptionId: string,
    callback: (subscription: TransactionSubscription) => void
  ): (() => void) => {
    const subscription = subscriptions.current.get(subscriptionId);
    if (!subscription) {
      console.warn(`Subscription ${subscriptionId} not found`);
      return () => {};
    }

    subscription.callbacks.add(callback);
    
    // Return cleanup function
    return () => {
      subscription.callbacks.delete(callback);
    };
  }, []);

  const globalConnectionStatus = useCallback(() => {
    const allSubs = getAllSubscriptions();
    const subscriptionValues = Object.values(allSubs);
    
    return {
      totalSubscriptions: subscriptionValues.length,
      connectedSubscriptions: subscriptionValues.filter(sub => sub.isConnected).length,
      reconnectingSubscriptions: subscriptionValues.filter(sub => sub.isReconnecting).length,
      failedSubscriptions: subscriptionValues.filter(sub => sub.error !== null).length,
    };
  }, [getAllSubscriptions]);

  const contextValue: TransactionProviderContextValue = {
    subscribe,
    unsubscribe,
    getSubscription,
    getAllSubscriptions,
    onSubscriptionUpdate,
    globalConnectionStatus: globalConnectionStatus(),
  };

  return (
    <TransactionProviderContext.Provider value={contextValue}>
      <TransactionSubscriptionManager
        subscriptions={subscriptions.current}
        activeHooks={activeHooks.current}
        getSubscription={getSubscription}
      />
      {children}
    </TransactionProviderContext.Provider>
  );
}

// Separate component to manage the actual subscriptions using hooks
function TransactionSubscriptionManager({
  subscriptions,
  activeHooks,
  getSubscription,
}: {
  subscriptions: Map<string, {
    transactionId: string;
    options: UseTransactionStatusOptions;
    callbacks: Set<(subscription: TransactionSubscription) => void>;
  }>;
  activeHooks: Map<string, ReturnType<typeof useTransactionStatus>>;
  getSubscription: (id: string) => TransactionSubscription | null;
}) {
  const subscriptionIds = Array.from(subscriptions.keys());
  
  // Create hook instances for each subscription
  subscriptionIds.forEach(subscriptionId => {
    const subscription = subscriptions.get(subscriptionId);
    if (!subscription) return;
    
    // eslint-disable-next-line react-hooks/rules-of-hooks
    const hookResult = useTransactionStatus(subscription.transactionId, subscription.options);
    activeHooks.set(subscriptionId, hookResult);
    
    // Notify callbacks when status changes
    // eslint-disable-next-line react-hooks/rules-of-hooks
    useEffect(() => {
      const currentSub = getSubscription(subscriptionId);
      if (currentSub && subscription.callbacks) {
        subscription.callbacks.forEach((callback: (subscription: TransactionSubscription) => void) => {
          try {
            callback(currentSub);
          } catch (error) {
            console.error('Error in subscription callback:', error);
          }
        });
      }
    }, [hookResult.status, hookResult.isConnected, hookResult.isReconnecting, hookResult.error, subscription.callbacks, subscriptionId]);
  });

  return null;
}

export function useTransactionProvider(): TransactionProviderContextValue {
  const context = useContext(TransactionProviderContext);
  
  if (!context) {
    throw new Error('useTransactionProvider must be used within a TransactionProvider');
  }
  
  return context;
}

export function useTransactionSubscription(transactionId: string, options?: UseTransactionStatusOptions) {
  const provider = useTransactionProvider();
  const subscriptionIdRef = useRef<string | null>(null);
  const [subscription, setSubscription] = React.useState<TransactionSubscription | null>(null);

  // Subscribe on mount or when transactionId changes
  useEffect(() => {
    if (transactionId) {
      subscriptionIdRef.current = provider.subscribe(transactionId, options);
      
      // Set up update listener
      const cleanup = provider.onSubscriptionUpdate(subscriptionIdRef.current, (updatedSub) => {
        setSubscription(updatedSub);
      });
      
      // Get initial state
      const initialSub = provider.getSubscription(subscriptionIdRef.current);
      setSubscription(initialSub);
      
      return () => {
        cleanup();
        if (subscriptionIdRef.current) {
          provider.unsubscribe(subscriptionIdRef.current);
          subscriptionIdRef.current = null;
        }
      };
    } else {
      setSubscription(null);
    }
  }, [transactionId, provider, options]);

  return subscription;
}