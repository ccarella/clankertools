'use client'

import React from 'react'
import Image from 'next/image'
import { Card, CardContent } from '@/components/ui/card'
import { ProfileBadge } from '@/components/profile'
import { Badge } from '@/components/ui/badge'
import { Skeleton } from '@/components/ui/skeleton'
import { TrendingUp, TrendingDown, Users, DollarSign, CheckCircle2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { useNeynarUser } from '@/hooks/useNeynar'

export interface Token {
  address: string
  name: string
  symbol: string
  imageUrl?: string
  creatorFid: number
  marketCap: number
  holders: number
  volume24h: number
  priceChange24h: number
  launchedAt: string
}

interface TokenCardProps {
  token: Token
  variant?: 'default' | 'compact'
  className?: string
}

export function TokenCard({ token, variant = 'default', className }: TokenCardProps) {
  const { user: creator, loading: creatorLoading, error: creatorError } = useNeynarUser(token.creatorFid)

  const formatValue = (value: number): string => {
    if (value >= 1000000) {
      return `$${(value / 1000000).toFixed(1)}M`
    }
    if (value >= 1000) {
      return `$${(value / 1000).toFixed(0)}K`
    }
    return `$${value}`
  }

  const formatFollowers = (count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`
    }
    if (count >= 1000) {
      return `${Math.floor(count / 1000)}K`
    }
    return count.toString()
  }

  const getTimeSinceLaunch = (launchedAt: string): string => {
    const now = new Date()
    const launch = new Date(launchedAt)
    const diffMs = now.getTime() - launch.getTime()
    const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24))
    
    if (diffDays === 0) {
      const diffHours = Math.floor(diffMs / (1000 * 60 * 60))
      if (diffHours === 0) {
        const diffMinutes = Math.floor(diffMs / (1000 * 60))
        return `Launched ${diffMinutes} minute${diffMinutes !== 1 ? 's' : ''} ago`
      }
      return `Launched ${diffHours} hour${diffHours !== 1 ? 's' : ''} ago`
    }
    return `Launched ${diffDays} day${diffDays !== 1 ? 's' : ''} ago`
  }

  const hasVerifiedAddresses = creator && creator.verifications && creator.verifications.length > 0

  if (variant === 'compact') {
    return (
      <Card 
        className={cn("hover:shadow-md transition-shadow cursor-pointer", className)}
        data-testid="token-card-compact"
      >
        <CardContent className="p-4">
          <div className="flex items-start gap-3">
            {token.imageUrl && (
              <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-full">
                <Image
                  src={token.imageUrl}
                  alt={token.name}
                  fill
                  className="object-cover"
                />
              </div>
            )}
            
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <h3 className="font-semibold truncate">{token.name}</h3>
                <Badge variant="secondary" className="text-xs">{token.symbol}</Badge>
              </div>
              
              <div className="flex items-center gap-4 mt-1 text-sm text-muted-foreground">
                <span>{formatValue(token.marketCap)}</span>
                <span className={cn(
                  "flex items-center gap-1",
                  token.priceChange24h >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  {token.priceChange24h >= 0 ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
                  {token.priceChange24h >= 0 ? '+' : ''}{token.priceChange24h}%
                </span>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className={cn("hover:shadow-lg transition-shadow cursor-pointer", className)}>
      <CardContent className="p-6">
        <div className="space-y-4">
          <div className="flex items-start gap-4">
            {token.imageUrl && (
              <div className="relative h-16 w-16 shrink-0 overflow-hidden rounded-full">
                <Image
                  src={token.imageUrl}
                  alt={token.name}
                  fill
                  className="object-cover"
                />
              </div>
            )}
            
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="text-lg font-semibold">{token.name}</h3>
                  <Badge variant="secondary" className="mt-1">{token.symbol}</Badge>
                </div>
                
                <div className={cn(
                  "flex items-center gap-1 text-sm font-medium",
                  token.priceChange24h >= 0 ? "text-green-600" : "text-red-600"
                )}>
                  {token.priceChange24h >= 0 ? <TrendingUp className="h-4 w-4" /> : <TrendingDown className="h-4 w-4" />}
                  {token.priceChange24h >= 0 ? '+' : ''}{token.priceChange24h}%
                </div>
              </div>
              
              <p className="text-xs text-muted-foreground mt-2">
                {getTimeSinceLaunch(token.launchedAt)}
              </p>
            </div>
          </div>

          <div className="border-t pt-4">
            {creatorLoading ? (
              <div data-testid="creator-loading" className="flex items-center gap-2">
                <Skeleton className="h-8 w-8 rounded-full" />
                <Skeleton className="h-4 w-24" />
              </div>
            ) : creatorError ? (
              <p className="text-sm text-muted-foreground">Creator unavailable</p>
            ) : creator ? (
              <div className="flex items-center justify-between">
                <ProfileBadge user={creator} variant="compact" />
                <div className="flex items-center gap-3 text-sm">
                  <span className="text-muted-foreground">
                    {formatFollowers(creator.followerCount || 0)} followers
                  </span>
                  {hasVerifiedAddresses && (
                    <CheckCircle2 
                      data-testid="creator-verified"
                      className="h-4 w-4 text-primary" 
                    />
                  )}
                </div>
              </div>
            ) : null}
          </div>

          <div className="grid grid-cols-3 gap-4 pt-2">
            <div>
              <p className="text-2xl font-bold">{formatValue(token.marketCap)}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <DollarSign className="h-3 w-3" />
                Market Cap
              </p>
            </div>
            
            <div>
              <p className="text-2xl font-bold">{token.holders}</p>
              <p className="text-xs text-muted-foreground flex items-center gap-1">
                <Users className="h-3 w-3" />
                holders
              </p>
            </div>
            
            <div>
              <p className="text-2xl font-bold">{formatValue(token.volume24h)}</p>
              <p className="text-xs text-muted-foreground">24h Vol</p>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}