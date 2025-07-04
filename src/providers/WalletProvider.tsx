'use client';

import React, { createContext, useContext, useState, useCallback, useEffect } from 'react';
import sdk from '@farcaster/frame-sdk';
import { BASE_NETWORKS } from '@/lib/network-config';

interface WalletState {
  isConnected: boolean;
  address: string | null;
  balance: string | null;
  chainId: number | null;
  isLoading: boolean;
  error: string | null;
}

export interface WalletContextType extends WalletState {
  connect: () => Promise<void>;
  disconnect: () => void;
  networkName: string | null;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

const STORAGE_KEY = 'wallet-state';
const BASE_CHAIN_ID = BASE_NETWORKS.mainnet.chainId;
const BASE_SEPOLIA_CHAIN_ID = BASE_NETWORKS.testnet.chainId;

const NETWORK_NAMES: Record<number, string> = {
  8453: 'Base',
  84532: 'Base Sepolia',
};

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

    // Set a timeout to prevent infinite loading
    const timeoutId = setTimeout(() => {
      setWalletState(prev => ({
        ...prev,
        isLoading: false,
        error: 'Connection timeout. Please try again.',
      }));
    }, 30000); // 30 second timeout

    try {
      // Get Ethereum provider from Farcaster SDK
      const provider = await sdk.wallet.getEthereumProvider();
      
      if (!provider) {
        throw new Error('No Ethereum provider available');
      }

      // Request accounts using EIP-1193
      const accounts = await provider.request({ 
        method: 'eth_requestAccounts' 
      }) as string[];
      
      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts found');
      }

      // Get chain ID
      const chainIdHex = await provider.request({ 
        method: 'eth_chainId' 
      }) as string;
      const chainId = parseInt(chainIdHex, 16);
      
      // Validate network
      if (chainId !== BASE_CHAIN_ID && chainId !== BASE_SEPOLIA_CHAIN_ID) {
        throw new Error('Please switch to Base network');
      }

      // Clear timeout on success
      clearTimeout(timeoutId);

      setWalletState({
        isConnected: true,
        address: accounts[0],
        chainId,
        balance: null, // Will be fetched separately
        isLoading: false,
        error: null,
      });
    } catch (error) {
      // Clear timeout on error
      clearTimeout(timeoutId);
      
      // Handle user rejection specifically
      let errorMessage = 'Failed to connect wallet';
      if (error instanceof Error) {
        // Common user rejection messages
        if (error.message.includes('User rejected') || 
            error.message.includes('User denied') ||
            error.message.includes('canceled') ||
            error.message.includes('cancelled')) {
          errorMessage = 'Connection cancelled';
        } else {
          errorMessage = error.message;
        }
      }
      
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
    networkName: walletState.chainId ? NETWORK_NAMES[walletState.chainId] || null : null,
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