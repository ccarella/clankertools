import { useState, useEffect, useCallback, useRef } from 'react';
import { getCache, CacheTTL } from '../lib/cache/indexeddb';

export interface CachedQueryOptions<T> {
  queryKey: (string | number)[];
  queryFn: () => Promise<T>;
  enabled?: boolean;
  staleTime?: number;
  cacheTime?: number;
  onSuccess?: (data: T) => void;
  onError?: (error: Error) => void;
  retry?: number;
  retryDelay?: number;
}

export interface CachedQueryResult<T> {
  data: T | null;
  error: Error | null;
  isLoading: boolean;
  isStale: boolean;
  isRefetching: boolean;
  refetch: () => void;
  invalidate: () => void;
  invalidatePattern: (pattern: (string | number)[]) => void;
}

function getCacheKey(queryKey: (string | number)[]): string {
  return queryKey.join(':');
}

export function useCachedQuery<T>({
  queryKey,
  queryFn,
  enabled = true,
  staleTime = 0,
  cacheTime = CacheTTL.TOKEN_DETAILS,
  onSuccess,
  onError,
  retry = 3,
  retryDelay = 1000,
}: CachedQueryOptions<T>): CachedQueryResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<Error | null>(null);
  const [isLoading, setIsLoading] = useState(enabled);
  const [isStale, setIsStale] = useState(false);
  const [isRefetching, setIsRefetching] = useState(false);
  
  const cache = getCache();
  const isMountedRef = useRef(true);
  const retryCountRef = useRef(0);
  const cacheKey = getCacheKey(queryKey);

  const fetchData = useCallback(async (isRefetch = false) => {
    if (!isMountedRef.current) return;

    try {
      if (isRefetch) {
        setIsRefetching(true);
      } else {
        setIsLoading(true);
      }
      setError(null);

      // Try to get from cache first if not refetching
      if (!isRefetch) {
        try {
          await cache.init();
          const cachedData = await cache.get<T & { _cachedAt?: number }>(cacheKey);
          
          if (cachedData !== null && isMountedRef.current) {
            setData(cachedData);
            setIsLoading(false);
            
            // Check if data is stale
            const cachedAt = cachedData._cachedAt || 0;
            const isDataStale = staleTime > 0 && Date.now() - cachedAt > staleTime;
            setIsStale(isDataStale);
            
            // If data is fresh, don't fetch
            if (!isDataStale) {
              onSuccess?.(cachedData);
              return;
            }
            
            // If stale, continue to fetch fresh data but show stale data
            setIsRefetching(true);
          }
        } catch (cacheError) {
          console.warn('Cache error, falling back to network:', cacheError);
        }
      }

      // Fetch fresh data
      const freshData = await queryFn();
      
      if (!isMountedRef.current) return;

      // Add metadata for cache staleness checking
      const dataWithMeta = { ...freshData, _cachedAt: Date.now() } as T & { _cachedAt: number };
      
      setData(dataWithMeta);
      setIsStale(false);
      retryCountRef.current = 0;
      
      // Cache the data
      try {
        await cache.set(cacheKey, dataWithMeta, { ttl: cacheTime });
      } catch (cacheError) {
        console.warn('Failed to cache data:', cacheError);
      }
      
      onSuccess?.(freshData);
    } catch (err) {
      if (!isMountedRef.current) return;
      
      const error = err as Error;
      
      // Retry logic
      if (retryCountRef.current < retry && error.name !== 'AbortError') {
        retryCountRef.current++;
        setTimeout(() => {
          if (isMountedRef.current) {
            fetchData(isRefetch);
          }
        }, retryDelay * retryCountRef.current);
        return;
      }
      
      setError(error);
      onError?.(error);
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
        setIsRefetching(false);
      }
    }
  }, [cacheKey, queryFn, staleTime, cacheTime, onSuccess, onError, retry, retryDelay, cache]);

  const refetch = useCallback(() => {
    fetchData(true);
  }, [fetchData]);

  const invalidate = useCallback(async () => {
    try {
      await cache.delete(cacheKey);
      setData(null);
      setIsStale(true);
    } catch (error) {
      console.warn('Failed to invalidate cache:', error);
    }
  }, [cacheKey, cache]);

  const invalidatePattern = useCallback(async (pattern: (string | number)[]) => {
    const patternKey = getCacheKey(pattern);
    if (cacheKey.startsWith(patternKey)) {
      await invalidate();
    }
  }, [cacheKey, invalidate]);

  useEffect(() => {
    isMountedRef.current = true;
    
    if (enabled) {
      fetchData();
    }
    
    return () => {
      isMountedRef.current = false;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, cacheKey]); // Dependencies managed separately to avoid infinite loops

  // Periodic cleanup of expired cache entries
  useEffect(() => {
    const cleanup = async () => {
      try {
        await cache.cleanupExpired();
      } catch (error) {
        console.warn('Failed to cleanup expired cache:', error);
      }
    };
    
    // Run cleanup on mount and every 5 minutes
    cleanup();
    const interval = setInterval(cleanup, 300000);
    
    return () => clearInterval(interval);
  }, [cache]);

  return {
    data,
    error,
    isLoading,
    isStale,
    isRefetching,
    refetch,
    invalidate,
    invalidatePattern,
  };
}

// Preset configurations for common query types
export const queryPresets = {
  tokenDetails: <T>(address: string): Partial<CachedQueryOptions<T>> => ({
    queryKey: ['token', address],
    staleTime: 60000, // 1 minute
    cacheTime: CacheTTL.TOKEN_DETAILS,
  }),
  
  userProfile: <T>(fid: string): Partial<CachedQueryOptions<T>> => ({
    queryKey: ['user', 'profile', fid],
    staleTime: 300000, // 5 minutes
    cacheTime: CacheTTL.USER_PROFILE,
  }),
  
  tokenList: <T>(type: 'trending' | 'new' | 'user', userId?: string): Partial<CachedQueryOptions<T>> => ({
    queryKey: userId ? ['tokens', type, userId] : ['tokens', type],
    staleTime: 30000, // 30 seconds
    cacheTime: CacheTTL.TOKEN_LIST,
  }),
  
  leaderboard: <T>(type: 'creators' | 'tokens'): Partial<CachedQueryOptions<T>> => ({
    queryKey: ['leaderboard', type],
    staleTime: 60000, // 1 minute
    cacheTime: CacheTTL.LEADERBOARD,
  }),
};