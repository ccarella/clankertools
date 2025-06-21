# Skeleton Components

This directory contains skeleton loading states for various UI components in the application.

## Components

### TokenCardSkeleton
Loading state for token cards with two variants:
- `default`: Full card with image, stats, and creator info
- `compact`: Minimal card with basic info

```tsx
import { TokenCardSkeleton } from '@/components/ui/skeleton'

// Default variant
<TokenCardSkeleton />

// Compact variant
<TokenCardSkeleton variant="compact" />
```

### FormSkeleton
Generic form skeleton with configurable fields:

```tsx
import { FormSkeleton } from '@/components/ui/skeleton'

// Default (3 fields with header)
<FormSkeleton />

// Custom number of fields
<FormSkeleton fields={5} />

// Without header
<FormSkeleton showHeader={false} />
```

### SimpleLaunchFormSkeleton
Specific skeleton for the simple launch form page:

```tsx
import { SimpleLaunchFormSkeleton } from '@/components/ui/skeleton'

<SimpleLaunchFormSkeleton />
```

### ProfileSkeleton
Full profile page skeleton:

```tsx
import { ProfileSkeleton } from '@/components/ui/skeleton'

<ProfileSkeleton />
```

### ProfileBadgeSkeleton
Profile badge skeleton with two variants:

```tsx
import { ProfileBadgeSkeleton } from '@/components/ui/skeleton'

// Compact (default)
<ProfileBadgeSkeleton />

// Expanded
<ProfileBadgeSkeleton variant="expanded" />
```

### DashboardSkeleton
Dashboard page skeleton with user info and token list:

```tsx
import { DashboardSkeleton } from '@/components/ui/skeleton'

<DashboardSkeleton />
```

### TokenListSkeleton
Token list skeleton with configurable item count:

```tsx
import { TokenListSkeleton } from '@/components/ui/skeleton'

// Default (3 items)
<TokenListSkeleton />

// Custom count
<TokenListSkeleton count={5} />
```

## Usage Example

```tsx
function TokenPage() {
  const { token, loading } = useToken()
  
  if (loading) {
    return <TokenCardSkeleton />
  }
  
  return <TokenCard token={token} />
}