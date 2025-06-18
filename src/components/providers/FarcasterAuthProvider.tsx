'use client';

import React, { createContext, useContext, useState, useEffect, useCallback, ReactNode } from 'react';
import sdk from '@farcaster/frame-sdk';

interface FarcasterUser {
  fid: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
}

interface FarcasterAuthContextType {
  user: FarcasterUser | null;
  isAuthenticated: boolean;
  isLoading: boolean;
  error: string | null;
  signIn: () => Promise<void>;
  signOut: () => void;
  clearError: () => void;
  getQuickAuthToken: () => Promise<string | null>;
}

const FarcasterAuthContext = createContext<FarcasterAuthContextType | null>(null);

export const useFarcasterAuth = () => {
  const context = useContext(FarcasterAuthContext);
  if (!context) {
    throw new Error('useFarcasterAuth must be used within a FarcasterAuthProvider');
  }
  return context;
};

interface FarcasterAuthProviderProps {
  children: ReactNode;
}

const STORAGE_KEY = 'farcaster_user';

export const FarcasterAuthProvider: React.FC<FarcasterAuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<FarcasterUser | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Restore user from sessionStorage on mount
  useEffect(() => {
    const storedUser = sessionStorage.getItem(STORAGE_KEY);
    if (storedUser) {
      try {
        const parsedUser = JSON.parse(storedUser);
        setUser(parsedUser);
      } catch (error) {
        console.error('Failed to parse stored user:', error);
        sessionStorage.removeItem(STORAGE_KEY);
      }
    }
  }, []);

  const signIn = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    
    try {
      await sdk.actions.signIn({
        nonce: crypto.randomUUID(),
      });
      
      // For successful sign-in, get user context directly from SDK
      const context = await sdk.context;
      const userContext = context?.user;
      
      if (userContext) {
        const userData: FarcasterUser = {
          fid: userContext.fid,
          username: userContext.username,
          displayName: userContext.displayName,
          pfpUrl: userContext.pfpUrl,
        };
        
        setUser(userData);
        sessionStorage.setItem(STORAGE_KEY, JSON.stringify(userData));
      } else {
        setError('Failed to get user context after sign in');
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  }, []);

  const signOut = useCallback(() => {
    setUser(null);
    sessionStorage.removeItem(STORAGE_KEY);
    setError(null);
  }, []);

  const clearError = useCallback(() => {
    setError(null);
  }, []);

  const getQuickAuthToken = useCallback(async (): Promise<string | null> => {
    try {
      const result = await sdk.quickAuth;
      if (result && result.token) {
        return result.token;
      }
      return null;
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Quick Auth failed');
      return null;
    }
  }, []);

  const value: FarcasterAuthContextType = {
    user,
    isAuthenticated: !!user,
    isLoading,
    error,
    signIn,
    signOut,
    clearError,
    getQuickAuthToken,
  };

  return (
    <FarcasterAuthContext.Provider value={value}>
      {children}
    </FarcasterAuthContext.Provider>
  );
};