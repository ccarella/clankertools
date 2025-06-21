'use client'

import React from 'react'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/optimized-avatar'
import { CheckCircle2 } from 'lucide-react'
import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'
import { NeynarUser } from '@/services/neynar'

interface ProfileBadgeProps {
  user: NeynarUser | null
  variant?: 'default' | 'compact' | 'expanded'
  loading?: boolean
  error?: string
  className?: string
}

export function ProfileBadge({ 
  user, 
  variant = 'default', 
  loading = false,
  error,
  className 
}: ProfileBadgeProps) {
  if (loading) {
    return (
      <div data-testid="profile-badge-skeleton" className={cn("flex items-center gap-3", className)}>
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      </div>
    )
  }

  if (error || !user) {
    return (
      <div className={cn("text-sm text-muted-foreground", className)}>
        {error || 'Failed to load profile'}
      </div>
    )
  }

  const formatFollowerCount = (count: number): string => {
    if (count >= 1000000) {
      return `${(count / 1000000).toFixed(1)}M`
    }
    if (count >= 1000) {
      return `${Math.floor(count / 1000)}K`
    }
    return count.toString()
  }

  const hasVerifiedAddresses = user.verifications && user.verifications.length > 0

  if (variant === 'compact') {
    return (
      <div 
        data-testid="profile-badge-compact" 
        className={cn("flex items-center gap-2", className)}
      >
        <Avatar className="h-8 w-8">
          <AvatarImage src={user.pfp?.url} alt={user.displayName || user.username} />
          <AvatarFallback data-testid="avatar-fallback">
            {(user.displayName || user.username || '?')[0].toUpperCase()}
          </AvatarFallback>
        </Avatar>
        <div className="flex items-center gap-1">
          <span className="text-sm font-medium">{user.displayName || user.username}</span>
          {hasVerifiedAddresses && (
            <CheckCircle2 
              data-testid="verification-badge" 
              className="h-3 w-3 text-primary" 
            />
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={cn("space-y-3", className)}>
      <div className="flex items-start gap-3">
        <Avatar className="h-12 w-12">
          <AvatarImage src={user.pfp?.url} alt={user.displayName || user.username} />
          <AvatarFallback data-testid="avatar-fallback">
            {(user.displayName || user.username || '?')[0].toUpperCase()}
          </AvatarFallback>
        </Avatar>
        
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="font-semibold truncate">{user.displayName || user.username}</h3>
            {hasVerifiedAddresses && (
              <CheckCircle2 
                data-testid="verification-badge" 
                className="h-4 w-4 text-primary shrink-0" 
              />
            )}
          </div>
          <p className="text-sm text-muted-foreground">@{user.username}</p>
        </div>
      </div>

      <div className="flex gap-4 text-sm">
        <div className="flex items-baseline gap-1">
          <span className="font-semibold">{formatFollowerCount(user.followerCount || 0)}</span>
          <span className="text-muted-foreground">followers</span>
        </div>
        <div className="flex items-baseline gap-1">
          <span className="font-semibold">{user.followingCount || 0}</span>
          <span className="text-muted-foreground">following</span>
        </div>
      </div>

      {variant === 'expanded' && user.profile?.bio?.text && (
        <p className="text-sm text-muted-foreground">{user.profile.bio.text}</p>
      )}
    </div>
  )
}