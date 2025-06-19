'use client'

import React from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Skeleton } from '@/components/ui/skeleton'
import { ProfileBadge } from '@/components/profile'
import { Trophy, TrendingUp, Coins } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useCreatorLeaderboard } from '@/hooks/useCreatorLeaderboard'

interface CreatorLeaderboardProps {
  variant?: 'default' | 'compact'
  className?: string
}

export function CreatorLeaderboard({ variant = 'default', className }: CreatorLeaderboardProps) {
  const { creators, loading, error } = useCreatorLeaderboard()

  const formatMarketCap = (value: number): string => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`
    }
    return `$${value}`
  }

  if (loading) {
    return (
      <Card className={cn(className)} data-testid="leaderboard-skeleton">
        <CardHeader>
          <Skeleton className="h-6 w-40" />
          <Skeleton className="h-4 w-60" />
        </CardHeader>
        <CardContent className="space-y-4">
          {[1, 2, 3].map((i) => (
            <div key={i} className="flex items-center gap-4">
              <Skeleton className="h-12 w-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-24" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card className={cn(className)}>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">{error}</p>
        </CardContent>
      </Card>
    )
  }

  if (!creators.length) {
    return (
      <Card className={cn(className)}>
        <CardContent className="pt-6">
          <p className="text-center text-muted-foreground">No creators found</p>
        </CardContent>
      </Card>
    )
  }

  const displayCreators = variant === 'compact' 
    ? creators.slice(0, 5) 
    : creators.slice(0, 10)

  return (
    <Card 
      className={cn(className)} 
      data-testid={variant === 'compact' ? 'leaderboard-compact' : undefined}
    >
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Trophy className="h-5 w-5 text-yellow-500" />
          Top Token Creators
        </CardTitle>
        <CardDescription>
          Leading creators by token launches and market cap
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {displayCreators.map((creator) => (
            <div 
              key={creator.fid} 
              className="flex items-start gap-4 pb-4 last:pb-0 border-b last:border-0"
            >
              <div className="flex items-center justify-center w-8 h-8 rounded-full bg-muted text-sm font-semibold">
                #{creator.rank}
              </div>
              
              <div className="flex-1 min-w-0">
                <ProfileBadge 
                  user={{
                    fid: creator.fid,
                    username: creator.username,
                    displayName: creator.display_name,
                    pfp: creator.pfp_url ? { url: creator.pfp_url } : undefined,
                    followerCount: creator.follower_count,
                    followingCount: 0,
                    profile: { bio: { text: '' } },
                    verifications: [],
                    custodyAddress: ''
                  }} 
                  variant="compact" 
                />
                
                <div className="flex gap-4 mt-2 text-sm">
                  <div className="flex items-center gap-1">
                    <TrendingUp className="h-3 w-3 text-muted-foreground" />
                    <span className="text-muted-foreground">{creator.token_count} tokens</span>
                  </div>
                  <div className="flex items-center gap-1">
                    <Coins className="h-3 w-3 text-muted-foreground" />
                    <span className="font-medium">{formatMarketCap(creator.total_market_cap)}</span>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  )
}