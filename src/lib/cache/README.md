# IndexedDB Caching for API Responses

This module provides client-side caching using IndexedDB to minimize network calls and improve performance, especially on mobile devices.

## Features

- **IndexedDB Storage**: Persistent client-side caching that survives page reloads
- **Stale-While-Revalidate**: Serves cached data immediately while fetching fresh data in background
- **TTL Support**: Configurable time-to-live for different data types
- **Automatic Cleanup**: Periodic removal of expired cache entries
- **Mobile Optimized**: Handles quota limits and private browsing gracefully

## Usage

### Basic Example

```typescript
import { useCachedQuery } from '@/hooks/useCachedQuery';

function TokenDetails({ address }: { address: string }) {
  const { data, isLoading, error, refetch } = useCachedQuery({
    queryKey: ['token', address],
    queryFn: async () => {
      const response = await fetch(`/api/token/${address}`);
      return response.json();
    },
    cacheTime: 300000, // 5 minutes
    staleTime: 60000,  // 1 minute
  });

  if (isLoading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;
  
  return (
    <div>
      <h1>{data.name}</h1>
      <button onClick={refetch}>Refresh</button>
    </div>
  );
}
```

### Using Presets

```typescript
import { useCachedQuery, queryPresets } from '@/hooks/useCachedQuery';

// Token details with preset configuration
const { data } = useCachedQuery({
  ...queryPresets.tokenDetails(address),
  queryFn: async () => {
    const response = await fetch(`/api/token/${address}`);
    return response.json();
  },
});

// User profile with preset configuration
const { data: profile } = useCachedQuery({
  ...queryPresets.userProfile(fid),
  queryFn: async () => {
    const response = await fetch(`/api/user/${fid}/profile`);
    return response.json();
  },
});
```

## Cache Configuration

### TTL Presets

```typescript
export const CacheTTL = {
  TOKEN_DETAILS: 300000,     // 5 minutes
  USER_PROFILE: 3600000,     // 1 hour
  TOKEN_LIST: 60000,         // 1 minute
  LEADERBOARD: 300000,       // 5 minutes
  STATIC_CONFIG: 86400000,   // 24 hours
};
```

### Query Options

- `queryKey`: Unique identifier for the cache entry
- `queryFn`: Async function that fetches the data
- `cacheTime`: How long to keep data in cache (ms)
- `staleTime`: How long before data is considered stale (ms)
- `enabled`: Whether to run the query automatically
- `retry`: Number of retry attempts on failure
- `retryDelay`: Delay between retries (ms)

## Cache Invalidation

```typescript
// Invalidate specific cache entry
const { invalidate } = useCachedQuery({ ... });
await invalidate();

// Invalidate by pattern
const { invalidatePattern } = useCachedQuery({ ... });
await invalidatePattern(['user']); // Invalidates all user-related queries
```

## Mobile Considerations

The cache handles mobile browser limitations:

- **Quota Exceeded**: Falls back to network when storage is full
- **Private Browsing**: Works without persistence
- **Background Sync**: Respects battery and data saving modes

## Architecture

```
┌─────────────┐     ┌──────────────┐     ┌────────────┐
│   Component │────▶│ useCachedQuery│────▶│   Cache    │
└─────────────┘     └──────────────┘     └────────────┘
                            │                     │
                            ▼                     ▼
                      ┌──────────┐         ┌──────────┐
                      │  API Call │         │ IndexedDB│
                      └──────────┘         └──────────┘
```

## Best Practices

1. **Use appropriate TTLs**: Shorter for frequently changing data, longer for static content
2. **Implement error boundaries**: Cache failures should not break the app
3. **Monitor cache size**: Clean up old entries regularly
4. **Test offline scenarios**: Ensure app works with cached data
5. **Provide refresh options**: Let users manually update stale data