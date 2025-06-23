'use client';

import React, { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { WebSocketService, TokenUpdate, PriceUpdate } from '@/lib/websocket';

interface WebSocketContextType {
  isConnected: boolean;
  isConnecting: boolean;
  connectionError: string | null;
  subscribeToToken: (address: string) => void;
  unsubscribeFromToken: (address: string) => void;
  lastTokenUpdate?: TokenUpdate;
  lastPriceUpdate?: PriceUpdate;
}

const WebSocketContext = createContext<WebSocketContextType | null>(null);

interface WebSocketProviderProps {
  children: React.ReactNode;
  url?: string;
}

export function WebSocketProvider({ children, url }: WebSocketProviderProps) {
  const [isConnected, setIsConnected] = useState(false);
  const [isConnecting, setIsConnecting] = useState(false);
  const [connectionError, setConnectionError] = useState<string | null>(null);
  const [lastTokenUpdate, setLastTokenUpdate] = useState<TokenUpdate>();
  const [lastPriceUpdate, setLastPriceUpdate] = useState<PriceUpdate>();
  const serviceRef = useRef<WebSocketService | null>(null);

  useEffect(() => {
    const wsUrl = url || process.env.NEXT_PUBLIC_WEBSOCKET_URL || 'wss://api.clanker.world/ws';
    const service = new WebSocketService(wsUrl);
    serviceRef.current = service;

    // Set up event handlers
    service.on('open', () => {
      setIsConnected(true);
      setIsConnecting(false);
      setConnectionError(null);
    });

    service.on('close', () => {
      setIsConnected(false);
      setIsConnecting(false);
    });

    service.on('error', (error: Error) => {
      setConnectionError(error.message);
      setIsConnecting(false);
    });

    service.on('reconnect', () => {
      setIsConnecting(true);
      setConnectionError(null);
    });

    service.on('tokenUpdate', (data: TokenUpdate) => {
      setLastTokenUpdate(data);
    });

    service.on('priceUpdate', (data: PriceUpdate) => {
      setLastPriceUpdate(data);
    });

    // Connect
    setIsConnecting(true);
    service.connect();

    // Cleanup
    return () => {
      service.disconnect();
      serviceRef.current = null;
    };
  }, [url]);

  const subscribeToToken = useCallback((address: string) => {
    serviceRef.current?.subscribeToToken(address);
  }, []);

  const unsubscribeFromToken = useCallback((address: string) => {
    serviceRef.current?.unsubscribeFromToken(address);
  }, []);

  const value: WebSocketContextType = {
    isConnected,
    isConnecting,
    connectionError,
    subscribeToToken,
    unsubscribeFromToken,
    lastTokenUpdate,
    lastPriceUpdate,
  };

  return (
    <WebSocketContext.Provider value={value}>
      {children}
    </WebSocketContext.Provider>
  );
}

export function useWebSocket() {
  const context = useContext(WebSocketContext);
  if (!context) {
    throw new Error('useWebSocket must be used within a WebSocketProvider');
  }
  return context;
}