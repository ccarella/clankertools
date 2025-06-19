'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { TokenCard } from './TokenCard'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { RefreshCw, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { UserToken } from '@/lib/redis'
import { useHaptic } from '@/providers/HapticProvider'

interface TokenListProps {
  tokens: UserToken[]
  loading: boolean
  onRefresh: () => void | Promise<void>
  refreshing?: boolean
  onLoadMore?: () => void
  hasMore?: boolean
  error?: string
  className?: string
}

export function TokenList({
  tokens,
  loading,
  onRefresh,
  refreshing = false,
  onLoadMore,
  hasMore = false,
  error,
  className
}: TokenListProps) {
  const router = useRouter()
  const haptic = useHaptic()
  const containerRef = useRef<HTMLDivElement>(null)
  const [pullDistance, setPullDistance] = useState(0)
  const [isPulling, setIsPulling] = useState(false)
  const touchStartY = useRef(0)
  const PULL_THRESHOLD = 80

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (containerRef.current?.scrollTop === 0) {
      touchStartY.current = e.touches[0].clientY
      setIsPulling(true)
    }
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling || refreshing) return
    
    const currentY = e.touches[0].clientY
    const distance = Math.max(0, currentY - touchStartY.current)
    
    if (distance > 0 && containerRef.current?.scrollTop === 0) {
      e.preventDefault()
      setPullDistance(Math.min(distance, PULL_THRESHOLD * 1.5))
      
      if (distance > PULL_THRESHOLD && haptic.isEnabled()) {
        haptic.toggleStateChange(true)
      }
    }
  }, [isPulling, refreshing, haptic])

  const handleTouchEnd = useCallback(async () => {
    if (pullDistance > PULL_THRESHOLD && !refreshing) {
      haptic.buttonPress()
      await onRefresh()
    }
    
    setPullDistance(0)
    setIsPulling(false)
  }, [pullDistance, refreshing, onRefresh, haptic])

  const handleScroll = useCallback(() => {
    if (!onLoadMore || !hasMore || loading) return
    
    const container = containerRef.current
    if (!container) return
    
    const { scrollTop, scrollHeight, clientHeight } = container
    if (scrollTop + clientHeight >= scrollHeight - 100) {
      onLoadMore()
    }
  }, [onLoadMore, hasMore, loading])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    
    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [handleScroll])

  const handleTokenClick = (tokenAddress: string) => {
    haptic.cardSelect()
    router.push(`/token/${tokenAddress}`)
  }

  if (error) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <AlertCircle className="h-12 w-12 text-destructive mb-4" />
        <p className="text-center text-muted-foreground mb-4">{error}</p>
        <Button
          variant="outline"
          onClick={() => onRefresh()}
          className="min-h-[44px]"
        >
          Try Again
        </Button>
      </div>
    )
  }

  if (loading && tokens.length === 0) {
    return (
      <div className="space-y-4 p-4">
        {[...Array(3)].map((_, i) => (
          <div key={i} data-testid="token-skeleton" className="space-y-3">
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        ))}
      </div>
    )
  }

  if (tokens.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4">
        <div className="text-center">
          <h3 className="text-lg font-semibold mb-2">No tokens created yet</h3>
          <p className="text-muted-foreground">Create your first token to see it here</p>
        </div>
      </div>
    )
  }

  const transformToken = (userToken: UserToken) => ({
    address: userToken.address,
    name: userToken.name,
    symbol: userToken.symbol,
    imageUrl: undefined,
    creatorFid: 0,
    marketCap: parseFloat(userToken.marketCap || '0'),
    holders: userToken.holders || 0,
    volume24h: parseFloat(userToken.volume24h || '0'),
    priceChange24h: 0,
    launchedAt: userToken.createdAt
  })

  return (
    <div
      ref={containerRef}
      data-testid="token-list-container"
      className={cn("relative overflow-y-auto", className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {(refreshing || pullDistance > 0) && (
        <div
          data-testid="refresh-indicator"
          className={cn(
            "absolute top-0 left-0 right-0 flex items-center justify-center transition-all",
            refreshing ? "h-12" : ""
          )}
          style={{
            height: refreshing ? 48 : pullDistance * 0.5,
            opacity: refreshing ? 1 : pullDistance / PULL_THRESHOLD
          }}
        >
          <RefreshCw
            className={cn(
              "h-5 w-5 text-muted-foreground",
              refreshing && "animate-spin"
            )}
          />
        </div>
      )}
      
      <div
        className={cn(
          "space-y-4 p-4 transition-transform",
          pullDistance > 0 && `translate-y-[${pullDistance * 0.5}px]`
        )}
      >
        {tokens.map((token) => (
          <div
            key={token.address}
            role="button"
            tabIndex={0}
            onClick={() => handleTokenClick(token.address)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault()
                handleTokenClick(token.address)
              }
            }}
            className="cursor-pointer"
          >
            <TokenCard
              token={transformToken(token)}
              variant="default"
            />
          </div>
        ))}
        
        {hasMore && !loading && (
          <div className="flex justify-center pt-4 pb-8">
            <Button
              variant="outline"
              onClick={onLoadMore}
              className="min-h-[44px]"
            >
              Load More
            </Button>
          </div>
        )}
        
        {loading && tokens.length > 0 && (
          <div className="py-4">
            <Skeleton className="h-24 w-full rounded-lg" />
          </div>
        )}
      </div>
    </div>
  )
}