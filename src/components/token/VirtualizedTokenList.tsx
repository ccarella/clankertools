'use client'

import React, { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FixedSizeList as List } from 'react-window'
import { TokenCard } from './TokenCard'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { RefreshCw, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { UserToken } from '@/lib/redis'
import { useHaptic } from '@/providers/HapticProvider'
import { useScrollPerformance, isMobileDevice } from '@/utils/performance-monitor'

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

const ITEM_HEIGHT = 200 // Height of TokenCard in pixels
const PULL_THRESHOLD = 80

export function VirtualizedTokenList({
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
  const listRef = useRef<List>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const [pullDistance, setPullDistance] = useState(0)
  const [isPulling, setIsPulling] = useState(false)
  const touchStartY = useRef(0)
  const [containerHeight, setContainerHeight] = useState(600)
  const { startMonitoring } = useScrollPerformance()

  // Update container height on resize
  useEffect(() => {
    const updateHeight = () => {
      if (containerRef.current) {
        setContainerHeight(containerRef.current.offsetHeight)
      }
    }
    
    updateHeight()
    window.addEventListener('resize', updateHeight)
    return () => window.removeEventListener('resize', updateHeight)
  }, [])

  // Monitor scroll performance on mobile
  useEffect(() => {
    if (isMobileDevice() && containerRef.current) {
      const cleanup = startMonitoring(containerRef.current)
      return cleanup
    }
  }, [startMonitoring])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (listRef.current) {
      const scrollOffset = (listRef.current as unknown as { state: { scrollOffset: number } }).state.scrollOffset
      if (scrollOffset === 0) {
        touchStartY.current = e.touches[0].clientY
        setIsPulling(true)
      }
    }
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPulling || refreshing) return
    
    const currentY = e.touches[0].clientY
    const distance = Math.max(0, currentY - touchStartY.current)
    
    if (distance > 0 && listRef.current) {
      const scrollOffset = (listRef.current as unknown as { state: { scrollOffset: number } }).state.scrollOffset
      if (scrollOffset === 0) {
        e.preventDefault()
        setPullDistance(Math.min(distance, PULL_THRESHOLD * 1.5))
        
        if (distance > PULL_THRESHOLD && haptic.isEnabled()) {
          haptic.toggleStateChange(true)
        }
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

  const handleScroll = useCallback(({ scrollOffset, scrollUpdateWasRequested }: { scrollOffset: number; scrollUpdateWasRequested: boolean }) => {
    if (!onLoadMore || !hasMore || loading || scrollUpdateWasRequested) return
    
    const totalHeight = tokens.length * ITEM_HEIGHT
    const scrollPercentage = (scrollOffset + containerHeight) / totalHeight
    
    if (scrollPercentage > 0.9) { // Load more when 90% scrolled
      onLoadMore()
    }
  }, [onLoadMore, hasMore, loading, tokens.length, containerHeight])

  const handleTokenClick = useCallback((tokenAddress: string) => {
    haptic.cardSelect()
    router.push(`/token/${tokenAddress}`)
  }, [haptic, router])

  const transformToken = useCallback((userToken: UserToken) => ({
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
  }), [])

  const Row = useCallback(({ index, style }: { index: number; style: React.CSSProperties }) => {
    const token = tokens[index]
    
    // Show loading skeleton for the last item if loading more
    if (index === tokens.length - 1 && loading && tokens.length > 0) {
      return (
        <div style={style} className="p-4">
          <Skeleton className="h-24 w-full rounded-lg" />
        </div>
      )
    }
    
    return (
      <div style={style} className="p-4">
        <div
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
      </div>
    )
  }, [tokens, loading, handleTokenClick, transformToken])

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

  // Add extra items for loading and "load more" button
  const itemCount = tokens.length + (hasMore ? 1 : 0)

  return (
    <div
      ref={containerRef}
      data-testid="token-list-container"
      className={cn("relative", className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {(refreshing || pullDistance > 0) && (
        <div
          data-testid="refresh-indicator"
          className={cn(
            "absolute top-0 left-0 right-0 flex items-center justify-center transition-all z-10",
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
          "transition-transform",
          pullDistance > 0 && `translate-y-[${pullDistance * 0.5}px]`
        )}
        style={{ height: '100%' }}
      >
        <List
          ref={listRef}
          height={containerHeight}
          itemCount={itemCount}
          itemSize={ITEM_HEIGHT}
          width="100%"
          onScroll={handleScroll}
          overscanCount={2} // Render 2 extra items outside of visible area
          className="scrollbar-thin"
        >
          {({ index, style }) => {
            // Render "Load More" button as the last item
            if (index === tokens.length && hasMore) {
              return (
                <div style={style} className="flex justify-center items-center p-4">
                  <Button
                    variant="outline"
                    onClick={onLoadMore}
                    disabled={loading}
                    className="min-h-[44px]"
                  >
                    {loading ? (
                      <RefreshCw className="h-4 w-4 animate-spin mr-2" />
                    ) : null}
                    Load More
                  </Button>
                </div>
              )
            }
            
            return <Row index={index} style={style} />
          }}
        </List>
      </div>
    </div>
  )
}