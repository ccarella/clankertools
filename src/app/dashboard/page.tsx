'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { useFarcasterAuth } from '@/components/providers/FarcasterAuthProvider'
import { useUserTokens } from '@/hooks/useUserTokens'
import { TokenList } from '@/components/token'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'

export default function Dashboard() {
  const router = useRouter()
  const { isAuthenticated, user } = useFarcasterAuth()
  const {
    tokens,
    loading,
    error,
    hasMore,
    loadMore,
    refresh,
    refreshing
  } = useUserTokens(user?.fid?.toString() || null, {
    pollInterval: 30000 // Poll every 30 seconds
  })

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/')
    }
  }, [isAuthenticated, router])

  if (!isAuthenticated) {
    return null
  }

  return (
    <div className="flex flex-col min-h-screen pb-20">
      <div className="flex-1">
        <div className="px-4 py-6 border-b">
          <div className="flex items-center gap-3 mb-4">
            <Avatar className="h-12 w-12">
              <AvatarImage src={user?.pfpUrl} alt={user?.displayName} />
              <AvatarFallback>
                {user?.displayName?.slice(0, 2).toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <h2 className="font-semibold">{user?.displayName || 'User'}</h2>
              <p className="text-sm text-muted-foreground">@{user?.username}</p>
            </div>
          </div>
          <div className="flex items-center justify-between">
            <h1 className="text-xl font-bold">My Tokens</h1>
            <p className="text-sm text-muted-foreground">
              {tokens.length} {tokens.length === 1 ? 'token' : 'tokens'} created
            </p>
          </div>
        </div>
        
        <TokenList
          tokens={tokens}
          loading={loading}
          error={error || undefined}
          onRefresh={refresh}
          refreshing={refreshing}
          onLoadMore={loadMore}
          hasMore={hasMore}
          className="h-[calc(100vh-180px)]"
        />
      </div>
    </div>
  )
}