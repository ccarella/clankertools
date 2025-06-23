'use client'

import { useEffect, useRef, useState, useCallback } from 'react';

export interface TransactionStatusUpdate {
  id: string;
  status: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
  progress: number;
  timestamp: number;
  createdAt?: number;
  updatedAt?: number;
  completedAt?: number;
  error?: string;
  retryCount?: number;
}

export interface UseTransactionStatusOptions {
  /**
   * Whether to automatically reconnect on connection failure
   * @default true
   */
  autoReconnect?: boolean;
  
  /**
   * Maximum number of reconnection attempts
   * @default 5
   */
  maxReconnectAttempts?: number;
  
  /**
   * Delay between reconnection attempts in milliseconds
   * @default 1000
   */
  reconnectDelay?: number;
  
  /**
   * Whether to enable debug logging
   * @default false
   */
  debug?: boolean;
}

export interface UseTransactionStatusResult {
  /** Current transaction status */
  status: TransactionStatusUpdate | null;
  /** Whether the connection is active */
  isConnected: boolean;
  /** Whether currently reconnecting */
  isReconnecting: boolean;
  /** Any connection error */
  error: string | null;
  /** Number of reconnection attempts made */
  reconnectAttempts: number;
  /** Manually reconnect to the transaction stream */
  reconnect: () => void;
  /** Disconnect from the transaction stream */
  disconnect: () => void;
}

export function useTransactionStatus(
  transactionId: string | null,
  options: UseTransactionStatusOptions = {}
): UseTransactionStatusResult {
  const {
    autoReconnect = true,
    maxReconnectAttempts = 5,
    reconnectDelay = 1000,
    debug = false,
  } = options;

  const [status, setStatus] = useState<TransactionStatusUpdate | null>(null);
  const [isConnected, setIsConnected] = useState(false);
  const [isReconnecting, setIsReconnecting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconnectAttempts, setReconnectAttempts] = useState(0);

  const eventSourceRef = useRef<EventSource | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const scheduleReconnectRef = useRef<(() => void) | null>(null);
  const mountedRef = useRef(true);

  const log = useCallback((message: string, ...args: unknown[]) => {
    if (debug) {
      console.log(`[useTransactionStatus] ${message}`, ...args);
    }
  }, [debug]);

  const cleanup = useCallback(() => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    
    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }
    
    setIsConnected(false);
    setIsReconnecting(false);
  }, []);

  const connect = useCallback(() => {
    if (!transactionId || !mountedRef.current) {
      return;
    }

    // Clean up existing connection
    cleanup();
    
    setError(null);
    setIsReconnecting(false);
    
    log('Connecting to transaction stream', { transactionId });

    try {
      const eventSource = new EventSource(`/api/transaction/${transactionId}/events`);
      eventSourceRef.current = eventSource;

      eventSource.onopen = () => {
        if (!mountedRef.current) return;
        
        log('Connected to transaction stream');
        setIsConnected(true);
        setError(null);
        setReconnectAttempts(0);
      };

      eventSource.addEventListener('status', (event) => {
        if (!mountedRef.current) return;
        
        try {
          const data = JSON.parse(event.data) as TransactionStatusUpdate;
          log('Received status update', data);
          setStatus(data);
        } catch (err) {
          log('Failed to parse status update', err);
          setError('Failed to parse status update');
        }
      });

      eventSource.addEventListener('heartbeat', () => {
        if (!mountedRef.current) return;
        log('Received heartbeat');
        // Heartbeat keeps connection alive, no action needed
      });

      eventSource.addEventListener('error', (event) => {
        if (!mountedRef.current) return;
        
        try {
          const data = JSON.parse((event as MessageEvent).data);
          log('Received error event', data);
          setError(data.message || 'Unknown error');
        } catch (err) {
          log('Failed to parse error event', err);
          setError('Unknown error occurred');
        }
      });

      eventSource.onerror = (event) => {
        if (!mountedRef.current) return;
        
        log('EventSource error', event);
        setIsConnected(false);
        
        // Handle different error states
        if (eventSource.readyState === EventSource.CLOSED) {
          log('Connection closed by server');
          if (autoReconnect && reconnectAttempts < maxReconnectAttempts) {
            scheduleReconnectRef.current?.();
          } else {
            setError('Connection lost');
          }
        } else if (eventSource.readyState === EventSource.CONNECTING) {
          log('Connection in progress...');
          if (autoReconnect && reconnectAttempts < maxReconnectAttempts) {
            scheduleReconnectRef.current?.();
          } else {
            setError('Failed to connect');
          }
        }
      };

    } catch (err) {
      log('Failed to create EventSource', err);
      setError(err instanceof Error ? err.message : 'Failed to connect');
      
      if (autoReconnect && reconnectAttempts < maxReconnectAttempts) {
        scheduleReconnectRef.current?.();
      }
    }
  }, [transactionId, autoReconnect, maxReconnectAttempts, reconnectAttempts, cleanup, log]);

  const scheduleReconnect = useCallback(() => {
    if (!mountedRef.current || reconnectAttempts >= maxReconnectAttempts) {
      return;
    }

    setIsReconnecting(true);
    
    const delay = reconnectDelay * Math.pow(2, Math.min(reconnectAttempts, 5)); // Exponential backoff, max 32x
    log(`Scheduling reconnect attempt ${reconnectAttempts + 1} in ${delay}ms`);
    
    reconnectTimeoutRef.current = setTimeout(() => {
      if (!mountedRef.current) return;
      
      setReconnectAttempts(prev => prev + 1);
      connect();
    }, delay);
  }, [reconnectAttempts, maxReconnectAttempts, reconnectDelay, connect, log]);
  
  // Update the ref whenever scheduleReconnect changes
  scheduleReconnectRef.current = scheduleReconnect;

  const reconnect = useCallback(() => {
    log('Manual reconnect requested');
    setReconnectAttempts(0);
    connect();
  }, [connect, log]);

  const disconnect = useCallback(() => {
    log('Manual disconnect requested');
    mountedRef.current = false;
    cleanup();
    setStatus(null);
    setError(null);
    setReconnectAttempts(0);
  }, [cleanup, log]);

  // Effect to manage connection lifecycle
  useEffect(() => {
    mountedRef.current = true;
    
    if (transactionId) {
      connect();
    } else {
      cleanup();
      setStatus(null);
      setError(null);
    }

    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [transactionId, connect, cleanup]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      mountedRef.current = false;
      cleanup();
    };
  }, [cleanup]);

  return {
    status,
    isConnected,
    isReconnecting,
    error,
    reconnectAttempts,
    reconnect,
    disconnect,
  };
}