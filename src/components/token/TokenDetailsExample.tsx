'use client';

import React from 'react';
import { useCachedQuery } from '@/hooks/useCachedQuery';
import { Card } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { RefreshCw } from 'lucide-react';

interface TokenData {
  name: string;
  symbol: string;
  address: string;
  marketCap: string;
  holders: number;
  volume24h: string;
  priceChange24h: number;
}

/**
 * Example component demonstrating IndexedDB caching for token details
 * This reduces API calls and improves performance on mobile devices
 */
export function TokenDetailsExample({ address }: { address: string }) {
  const { 
    data, 
    isLoading, 
    error, 
    isStale, 
    isRefetching,
    refetch 
  } = useCachedQuery<{ success: boolean; data: TokenData }>({
    queryKey: ['token', address],
    queryFn: async () => {
      const response = await fetch(`/api/token/${address}`);
      if (!response.ok) {
        throw new Error('Failed to fetch token details');
      }
      return response.json();
    },
    cacheTime: 300000, // Cache for 5 minutes
    staleTime: 60000,  // Consider stale after 1 minute
  });

  if (isLoading && !data) {
    return (
      <Card className="p-6">
        <div className="space-y-4">
          <Skeleton className="h-8 w-3/4" />
          <Skeleton className="h-4 w-1/2" />
          <div className="grid grid-cols-2 gap-4">
            <Skeleton className="h-20" />
            <Skeleton className="h-20" />
          </div>
        </div>
      </Card>
    );
  }

  if (error) {
    return (
      <Card className="p-6">
        <div className="text-center">
          <p className="text-red-600 mb-4">Error loading token details</p>
          <Button onClick={() => refetch()} variant="outline">
            <RefreshCw className="mr-2 h-4 w-4" />
            Try Again
          </Button>
        </div>
      </Card>
    );
  }

  if (!data?.success || !data.data) {
    return (
      <Card className="p-6">
        <p className="text-center text-muted-foreground">Token not found</p>
      </Card>
    );
  }

  const token = data.data;

  return (
    <Card className="p-6">
      <div className="flex justify-between items-start mb-4">
        <div>
          <h2 className="text-2xl font-bold">
            {token.name} ({token.symbol})
          </h2>
          <p className="text-sm text-muted-foreground">
            {token.address}
          </p>
        </div>
        <Button
          onClick={() => refetch()}
          variant="ghost"
          size="sm"
          disabled={isRefetching}
        >
          <RefreshCw className={`h-4 w-4 ${isRefetching ? 'animate-spin' : ''}`} />
        </Button>
      </div>

      {isStale && !isRefetching && (
        <div className="mb-4 p-2 bg-yellow-50 dark:bg-yellow-900/20 rounded text-sm text-yellow-800 dark:text-yellow-200">
          Data may be outdated. Refreshing in background...
        </div>
      )}

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Market Cap</p>
          <p className="text-xl font-semibold">${token.marketCap}</p>
        </div>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">Holders</p>
          <p className="text-xl font-semibold">{token.holders.toLocaleString()}</p>
        </div>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">24h Volume</p>
          <p className="text-xl font-semibold">${token.volume24h}</p>
        </div>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">24h Change</p>
          <p className={`text-xl font-semibold ${
            token.priceChange24h >= 0 ? 'text-green-600' : 'text-red-600'
          }`}>
            {token.priceChange24h >= 0 ? '+' : ''}{token.priceChange24h.toFixed(2)}%
          </p>
        </div>
      </div>

      <div className="mt-4 pt-4 border-t text-xs text-muted-foreground">
        {isRefetching ? (
          <span>Updating...</span>
        ) : (
          <span>
            {data ? 'Cached data • ' : ''}
            Last updated: {new Date().toLocaleTimeString()}
          </span>
        )}
      </div>
    </Card>
  );
}