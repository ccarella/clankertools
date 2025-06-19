import { useState, useEffect, useCallback } from 'react';
import { NeynarService, NeynarUser, WalletAddress } from '@/services/neynar';

let neynarServiceInstance: NeynarService | null = null;

export function useNeynar() {
  if (!neynarServiceInstance && typeof window !== 'undefined') {
    neynarServiceInstance = new NeynarService();
  }
  return neynarServiceInstance;
}

interface UseNeynarUserOptions {
  fid?: number;
  username?: string;
  includeAddresses?: boolean;
}

interface UseNeynarUserResult {
  user: NeynarUser | undefined;
  addresses: WalletAddress[] | undefined;
  loading: boolean;
  error: string | undefined;
  refetch: () => Promise<void>;
}

export function useNeynarUser(options: UseNeynarUserOptions): UseNeynarUserResult {
  const { fid, username, includeAddresses } = options;
  const neynarService = useNeynar();
  
  const [user, setUser] = useState<NeynarUser | undefined>();
  const [addresses, setAddresses] = useState<WalletAddress[] | undefined>();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | undefined>();

  const fetchUser = useCallback(async () => {
    if (!fid && !username) return;
    if (!neynarService) return; // Skip if service not available (during SSR)
    
    setLoading(true);
    setError(undefined);
    
    try {
      let fetchedUser: NeynarUser;
      
      if (fid) {
        fetchedUser = await neynarService.getUserByFid(fid);
      } else if (username) {
        fetchedUser = await neynarService.getUserByUsername(username);
      } else {
        return;
      }
      
      setUser(fetchedUser);
      
      if (includeAddresses && fetchedUser.fid) {
        const fetchedAddresses = await neynarService.getUserWalletAddresses(fetchedUser.fid);
        setAddresses(fetchedAddresses);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch user');
    } finally {
      setLoading(false);
    }
  }, [fid, username, includeAddresses, neynarService]);

  useEffect(() => {
    fetchUser();
  }, [fetchUser]);

  return { user, addresses, loading, error, refetch: fetchUser };
}

interface UseNeynarFollowersResult {
  followers: NeynarUser[];
  loading: boolean;
  loadingMore: boolean;
  error: string | undefined;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refetch: () => Promise<void>;
}

export function useNeynarFollowers(fid?: number, limit: number = 50): UseNeynarFollowersResult {
  const neynarService = useNeynar();
  
  const [followers, setFollowers] = useState<NeynarUser[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(true);

  const fetchFollowers = useCallback(async (isLoadMore = false) => {
    if (!fid) return;
    
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setError(undefined);
    }
    
    try {
      const result = await neynarService.getUserFollowers(fid, {
        cursor: isLoadMore ? cursor || undefined : undefined,
        limit
      });
      
      if (isLoadMore) {
        setFollowers(prev => [...prev, ...result.users]);
      } else {
        setFollowers(result.users);
      }
      
      setCursor(result.nextCursor);
      setHasMore(!!result.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch followers');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [fid, cursor, limit, neynarService]);

  useEffect(() => {
    if (fid) {
      fetchFollowers();
    }
  }, [fid, fetchFollowers]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    await fetchFollowers(true);
  }, [hasMore, loadingMore, fetchFollowers]);

  const refetch = useCallback(async () => {
    setCursor(null);
    await fetchFollowers();
  }, [fetchFollowers]);

  return { followers, loading, loadingMore, error, hasMore, loadMore, refetch };
}

interface UseNeynarFollowingResult {
  following: NeynarUser[];
  loading: boolean;
  loadingMore: boolean;
  error: string | undefined;
  hasMore: boolean;
  loadMore: () => Promise<void>;
  refetch: () => Promise<void>;
}

export function useNeynarFollowing(fid?: number, limit: number = 50): UseNeynarFollowingResult {
  const neynarService = useNeynar();
  
  const [following, setFollowing] = useState<NeynarUser[]>([]);
  const [cursor, setCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [hasMore, setHasMore] = useState(true);

  const fetchFollowing = useCallback(async (isLoadMore = false) => {
    if (!fid) return;
    
    if (isLoadMore) {
      setLoadingMore(true);
    } else {
      setLoading(true);
      setError(undefined);
    }
    
    try {
      const result = await neynarService.getUserFollowing(fid, {
        cursor: isLoadMore ? cursor || undefined : undefined,
        limit
      });
      
      if (isLoadMore) {
        setFollowing(prev => [...prev, ...result.users]);
      } else {
        setFollowing(result.users);
      }
      
      setCursor(result.nextCursor);
      setHasMore(!!result.nextCursor);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch following');
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
  }, [fid, cursor, limit, neynarService]);

  useEffect(() => {
    if (fid) {
      fetchFollowing();
    }
  }, [fid, fetchFollowing]);

  const loadMore = useCallback(async () => {
    if (!hasMore || loadingMore) return;
    await fetchFollowing(true);
  }, [hasMore, loadingMore, fetchFollowing]);

  const refetch = useCallback(async () => {
    setCursor(null);
    await fetchFollowing();
  }, [fetchFollowing]);

  return { following, loading, loadingMore, error, hasMore, loadMore, refetch };
}