'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import sdk from '@farcaster/frame-sdk';

interface WalletState {
  isConnected: boolean;
  address: string | null;
  balance: string | null;
  chainId: number | null;
  isLoading: boolean;
  error: string | null;
}

interface WalletContextType extends WalletState {
  connect: () => Promise<void>;
  disconnect: () => void;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const STORAGE_KEY = 'wallet-state';
const BASE_CHAIN_ID = 8453;
const BASE_SEPOLIA_CHAIN_ID = 84532;

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [walletState, setWalletState] = useState<WalletState>(() => {
    // Initialize from sessionStorage if available
    if (typeof window !== 'undefined') {
      const stored = sessionStorage.getItem(STORAGE_KEY);
      if (stored) {
        try {
          const parsed = JSON.parse(stored);
          return {
            isConnected: true,
            address: parsed.address,
            balance: parsed.balance || null,
            chainId: parsed.chainId,
            isLoading: false,
            error: null,
          };
        } catch (e) {
          console.error('Failed to parse stored wallet state:', e);
        }
      }
    }

    return {
      isConnected: false,
      address: null,
      balance: null,
      chainId: null,
      isLoading: false,
      error: null,
    };
  });

  // Update balance when wallet is connected
  useEffect(() => {
    if (walletState.isConnected && walletState.address && walletState.chainId) {
      // Balance will be fetched by useWalletBalance hook in components
    }
  }, [walletState.isConnected, walletState.address, walletState.chainId]);

  // Persist state to sessionStorage
  useEffect(() => {
    if (walletState.isConnected && walletState.address) {
      sessionStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          address: walletState.address,
          chainId: walletState.chainId,
          balance: walletState.balance,
        })
      );
    } else {
      sessionStorage.removeItem(STORAGE_KEY);
    }
  }, [walletState]);

  const connect = useCallback(async () => {
    setWalletState(prev => ({ ...prev, isLoading: true, error: null }));

    try {
      // Use Farcaster SDK wallet connection
      const result = await sdk.wallet.connectEthereum();
      
      // Validate network
      if (result.chainId !== BASE_CHAIN_ID && result.chainId !== BASE_SEPOLIA_CHAIN_ID) {
        setWalletState(prev => ({
          ...prev,
          isLoading: false,
          error: 'Please switch to Base network',
        }));
        return;
      }

      setWalletState({
        isConnected: true,
        address: result.address,
        chainId: result.chainId,
        balance: null, // Will be fetched separately
        isLoading: false,
        error: null,
      });
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Failed to connect wallet';
      setWalletState(prev => ({
        ...prev,
        isLoading: false,
        error: errorMessage,
      }));
    }
  }, []);

  const disconnect = useCallback(() => {
    setWalletState({
      isConnected: false,
      address: null,
      balance: null,
      chainId: null,
      isLoading: false,
      error: null,
    });
  }, []);

  const contextValue: WalletContextType = {
    ...walletState,
    connect,
    disconnect,
  };

  return (
    <WalletContext.Provider value={contextValue}>
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}