import { Skeleton } from '@/components/ui/skeleton'
import { cn } from '@/lib/utils'

interface DashboardSkeletonProps {
  className?: string
}

export function DashboardSkeleton({ className }: DashboardSkeletonProps) {
  return (
    <div className={cn("flex flex-col min-h-screen pb-20", className)}>
      <div className="flex-1">
        <div className="px-4 py-6 border-b">
          <div className="flex items-center gap-3 mb-4">
            <Skeleton className="h-12 w-12 rounded-full" />
            <div className="flex-1">
              <Skeleton className="h-5 w-32 mb-1" />
              <Skeleton className="h-4 w-24" />
            </div>
          </div>
          <div className="flex items-center justify-between">
            <Skeleton className="h-7 w-28" />
            <Skeleton className="h-4 w-32" />
          </div>
        </div>
        
        <div className="p-4 space-y-4">
          {Array.from({ length: 3 }).map((_, index) => (
            <DashboardTokenItemSkeleton key={index} />
          ))}
        </div>
      </div>
    </div>
  )
}

function DashboardTokenItemSkeleton() {
  return (
    <div className="p-4 border rounded-lg">
      <div className="flex items-start gap-3">
        <Skeleton className="h-12 w-12 rounded-full" />
        <div className="flex-1">
          <div className="flex items-center gap-2 mb-1">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-4 w-12 rounded-full" />
          </div>
          <div className="flex items-center gap-4">
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-16" />
          </div>
        </div>
      </div>
    </div>
  )
}

interface TokenListSkeletonProps {
  count?: number
  className?: string
}

export function TokenListSkeleton({ count = 3, className }: TokenListSkeletonProps) {
  return (
    <div className={cn("space-y-4", className)}>
      {Array.from({ length: count }).map((_, index) => (
        <DashboardTokenItemSkeleton key={index} />
      ))}
    </div>
  )
}