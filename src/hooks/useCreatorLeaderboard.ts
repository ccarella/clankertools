'use client'

import { useState, useEffect } from 'react'

export interface CreatorStats {
  fid: number
  username: string
  display_name: string
  pfp_url?: string
  follower_count: number
  token_count: number
  total_market_cap: number
  rank: number
}

interface UseCreatorLeaderboardReturn {
  creators: CreatorStats[]
  loading: boolean
  error: string | null
}

export function useCreatorLeaderboard(): UseCreatorLeaderboardReturn {
  const [creators, setCreators] = useState<CreatorStats[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function fetchLeaderboard() {
      try {
        setLoading(true)
        const response = await fetch('/api/leaderboard/creators')
        
        if (!response.ok) {
          throw new Error('Failed to fetch leaderboard')
        }

        const data = await response.json()
        setCreators(data.creators || [])
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to load leaderboard')
      } finally {
        setLoading(false)
      }
    }

    fetchLeaderboard()
  }, [])

  return { creators, loading, error }
}