'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import { UserToken } from '@/lib/redis'

interface UseUserTokensOptions {
  limit?: number
  pollInterval?: number
}

interface UseUserTokensResult {
  tokens: UserToken[]
  loading: boolean
  error: string | null
  hasMore: boolean
  loadMore: () => Promise<void>
  refresh: () => Promise<void>
  refreshing: boolean
}

export function useUserTokens(
  userId: string | null,
  options: UseUserTokensOptions = {}
): UseUserTokensResult {
  const { limit = 10, pollInterval } = options
  const [tokens, setTokens] = useState<UserToken[]>([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [cursor, setCursor] = useState<string | null>(null)
  const [hasMore, setHasMore] = useState(false)
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const isMountedRef = useRef(true)

  const fetchTokens = useCallback(
    async (isLoadMore = false, isRefresh = false) => {
      if (!userId) {
        setLoading(false)
        return
      }

      try {
        if (isRefresh) {
          setRefreshing(true)
        } else if (!isLoadMore) {
          setLoading(true)
        }
        
        setError(null)

        const params = new URLSearchParams({ limit: limit.toString() })
        if (isLoadMore && cursor) {
          params.append('cursor', cursor)
        }

        const response = await fetch(`/api/user/tokens?${params}`, {
          headers: {
            'x-farcaster-user-id': userId
          }
        })

        if (!response.ok) {
          const data = await response.json()
          throw new Error(data.error || 'Failed to fetch tokens')
        }

        const data = await response.json()
        
        if (!isMountedRef.current) return

        if (isLoadMore) {
          setTokens(prev => {
            const combined = [...prev, ...data.tokens]
            const uniqueTokens = Array.from(
              new Map(combined.map(token => [token.address, token])).values()
            )
            return uniqueTokens
          })
        } else {
          setTokens(data.tokens)
        }

        setCursor(data.nextCursor)
        setHasMore(!!data.nextCursor)
      } catch (err) {
        console.error('Error fetching user tokens:', err)
        if (isMountedRef.current) {
          setError(err instanceof Error ? err.message : 'Failed to fetch tokens')
        }
      } finally {
        if (isMountedRef.current) {
          setLoading(false)
          setRefreshing(false)
        }
      }
    },
    [userId, cursor, limit]
  )

  const loadMore = useCallback(async () => {
    if (!hasMore || loading || refreshing) return
    await fetchTokens(true, false)
  }, [hasMore, loading, refreshing, fetchTokens])

  const refresh = useCallback(async () => {
    setCursor(null)
    await fetchTokens(false, true)
  }, [fetchTokens])

  useEffect(() => {
    isMountedRef.current = true
    
    if (userId) {
      fetchTokens()
    } else {
      setLoading(false)
    }

    return () => {
      isMountedRef.current = false
    }
  }, [userId, fetchTokens])

  useEffect(() => {
    if (!pollInterval || !userId) return

    intervalRef.current = setInterval(() => {
      if (!loading && !refreshing) {
        fetchTokens(false, false)
      }
    }, pollInterval)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [pollInterval, userId, loading, refreshing, fetchTokens])

  return {
    tokens,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
    refreshing
  }
}