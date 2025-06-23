'use client'

import React, { useState, useEffect, useMemo, useCallback, useRef } from 'react'
import { cn } from '@/lib/utils'
import { useHaptic } from '@/providers/HapticProvider'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { Checkbox } from '@/components/ui/checkbox'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
  DropdownMenuCheckboxItem,
} from '@/components/ui/dropdown-menu'
// import { TransactionStatusCard } from './TransactionStatusCard'
import { 
  Filter, 
  SortAsc, 
  MoreVertical, 
  Search, 
  X,
  Play,
  Pause,
  Trash2,
  RotateCcw,
  XCircle,
  CheckCircle,
  Clock,
  AlertCircle
} from 'lucide-react'

type Transaction = {
  id: string
  hash: string
  type: 'token_deployment' | 'token_transfer' | 'add_liquidity' | 'wallet_connect'
  status: 'pending' | 'processing' | 'success' | 'failed'
  timestamp: string
  tokenName?: string
  tokenSymbol?: string
  amount?: string
  toAddress?: string
  liquidityAmount?: string
  tokenAmount?: string
  walletAddress?: string
  error?: string
}

interface TransactionQueueProps {
  transactions: Transaction[]
  onCancel?: (id: string) => void
  onRetry?: (id: string) => void
  onBulkCancel?: (ids: string[]) => void
  onBulkRetry?: (ids: string[]) => void
  onClearCompleted?: () => void
  onPauseQueue?: () => void
  onResumeQueue?: () => void
  onFilterChange?: (filters: Record<string, unknown>) => void
  isQueuePaused?: boolean
  autoDismissCompleted?: boolean
  dismissDelay?: number
}

export function TransactionQueue({
  transactions,
  // onCancel,
  // onRetry,
  onBulkCancel,
  onBulkRetry,
  onClearCompleted,
  onPauseQueue,
  onResumeQueue,
  onFilterChange,
  isQueuePaused = false,
  autoDismissCompleted = false,
  dismissDelay = 3000
}: TransactionQueueProps) {
  const haptic = useHaptic()
  const [isMobile, setIsMobile] = useState(false)
  const [selectedIds, setSelectedIds] = useState<string[]>([])
  const [searchQuery, setSearchQuery] = useState('')
  const [statusFilter, setStatusFilter] = useState<string[]>([])
  const [typeFilter, setTypeFilter] = useState('')
  const [sortBy, setSortBy] = useState<'newest' | 'oldest' | 'status'>('newest')
  const [showFilters, setShowFilters] = useState(false)
  const [dismissedTxs, setDismissedTxs] = useState<Set<string>>(new Set())
  const [newTxAnnouncement, setNewTxAnnouncement] = useState('')
  const [completedTxNotification, setCompletedTxNotification] = useState('')
  const searchDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const previousTxCountRef = useRef(transactions.length)
  const previousTxStatusRef = useRef<Record<string, string>>({})

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 375)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Handle search with debouncing
  useEffect(() => {
    if (searchDebounceRef.current) {
      clearTimeout(searchDebounceRef.current)
    }
    
    searchDebounceRef.current = setTimeout(() => {
      if (onFilterChange && searchQuery) {
        onFilterChange({ search: searchQuery })
      }
    }, 300)

    return () => {
      if (searchDebounceRef.current) {
        clearTimeout(searchDebounceRef.current)
      }
    }
  }, [searchQuery, onFilterChange])

  // Announce new transactions for screen readers
  useEffect(() => {
    if (transactions.length > previousTxCountRef.current) {
      setNewTxAnnouncement('New transaction added to queue')
      setTimeout(() => setNewTxAnnouncement(''), 3000)
    }
    previousTxCountRef.current = transactions.length
  }, [transactions.length])

  // Handle completed transaction notifications and auto-dismiss
  useEffect(() => {
    transactions.forEach(tx => {
      const previousStatus = previousTxStatusRef.current[tx.id]
      if (previousStatus && previousStatus !== 'success' && tx.status === 'success') {
        setCompletedTxNotification('Transaction completed')
        haptic.cardSelect?.()
        setTimeout(() => setCompletedTxNotification(''), 3000)

        if (autoDismissCompleted) {
          setTimeout(() => {
            setDismissedTxs(prev => new Set([...prev, tx.id]))
          }, dismissDelay)
        }
      }
      previousTxStatusRef.current[tx.id] = tx.status
    })
  }, [transactions, haptic, autoDismissCompleted, dismissDelay])

  // Filter and sort transactions
  const filteredTransactions = useMemo(() => {
    let filtered = transactions.filter(tx => !dismissedTxs.has(tx.id))

    // Search filter
    if (searchQuery) {
      filtered = filtered.filter(tx => 
        tx.hash.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.type.includes(searchQuery.toLowerCase()) ||
        tx.tokenName?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        tx.tokenSymbol?.toLowerCase().includes(searchQuery.toLowerCase())
      )
    }

    // Status filter
    if (statusFilter.length > 0) {
      filtered = filtered.filter(tx => statusFilter.includes(tx.status))
    }

    // Type filter
    if (typeFilter) {
      filtered = filtered.filter(tx => tx.type === typeFilter)
    }

    // Sort
    return filtered.sort((a, b) => {
      switch (sortBy) {
        case 'newest':
          return new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
        case 'oldest':
          return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime()
        case 'status':
          const statusOrder = { pending: 0, processing: 1, failed: 2, success: 3 }
          return statusOrder[a.status] - statusOrder[b.status]
        default:
          return 0
      }
    })
  }, [transactions, searchQuery, statusFilter, typeFilter, sortBy, dismissedTxs])

  const activeTransactions = useMemo(() => 
    transactions.filter(tx => tx.status === 'pending' || tx.status === 'processing'),
    [transactions]
  )

  const queueStats = useMemo(() => {
    const stats = { pending: 0, processing: 0, success: 0, failed: 0 }
    transactions.forEach(tx => stats[tx.status]++)
    return stats
  }, [transactions])

  const handleSelectAll = useCallback((checked: boolean) => {
    if (checked) {
      setSelectedIds(filteredTransactions.map(tx => tx.id))
    } else {
      setSelectedIds([])
    }
  }, [filteredTransactions])

  const handleSelectTransaction = useCallback((id: string, checked: boolean) => {
    setSelectedIds(prev => 
      checked ? [...prev, id] : prev.filter(selectedId => selectedId !== id)
    )
  }, [])

  const handleBulkCancel = useCallback(() => {
    const cancelableIds = selectedIds.filter(id => {
      const tx = transactions.find(t => t.id === id)
      return tx && (tx.status === 'pending' || tx.status === 'processing')
    })
    
    if (cancelableIds.length > 0) {
      haptic.buttonPress?.('destructive')
      onBulkCancel?.(cancelableIds)
      setSelectedIds([])
    }
  }, [selectedIds, transactions, onBulkCancel, haptic])

  const handleBulkRetry = useCallback(() => {
    const retryableIds = selectedIds.filter(id => {
      const tx = transactions.find(t => t.id === id)
      return tx && tx.status === 'failed'
    })
    
    if (retryableIds.length > 0) {
      haptic.buttonPress?.()
      onBulkRetry?.(retryableIds)
      setSelectedIds([])
    }
  }, [selectedIds, transactions, onBulkRetry, haptic])

  const clearFilters = useCallback(() => {
    setSearchQuery('')
    setStatusFilter([])
    setTypeFilter('')
    setSortBy('newest')
  }, [])

  const toggleStatusFilter = useCallback((status: string) => {
    setStatusFilter(prev => 
      prev.includes(status) 
        ? prev.filter(s => s !== status)
        : [...prev, status]
    )
  }, [])

  // Keyboard navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent, index: number) => {
    if (e.key === 'ArrowDown' && index < filteredTransactions.length - 1) {
      e.preventDefault()
      const nextElement = document.querySelector(`[data-testid="transaction-${filteredTransactions[index + 1].id}"]`) as HTMLElement
      nextElement?.focus()
    } else if (e.key === 'ArrowUp' && index > 0) {
      e.preventDefault()
      const prevElement = document.querySelector(`[data-testid="transaction-${filteredTransactions[index - 1].id}"]`) as HTMLElement
      prevElement?.focus()
    }
  }, [filteredTransactions])

  const selectedTransactions = selectedIds.map(id => transactions.find(tx => tx.id === id)).filter(Boolean)
  const canCancel = selectedTransactions.some(tx => tx?.status === 'pending' || tx?.status === 'processing')
  const canRetry = selectedTransactions.some(tx => tx?.status === 'failed')

  const renderMobileFilters = () => (
    <DropdownMenu open={showFilters} onOpenChange={setShowFilters}>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm">
          <Filter className="w-4 h-4" />
          Filter
          {(statusFilter.length > 0 || typeFilter || searchQuery) && (
            <Badge variant="secondary" className="ml-1 px-1 py-0 text-xs">
              {statusFilter.length + (typeFilter ? 1 : 0) + (searchQuery ? 1 : 0)}
            </Badge>
          )}
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent className="w-56">
        <div className="p-2">
          <Input
            placeholder="Search transactions..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="mb-2"
          />
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuCheckboxItem
          checked={statusFilter.includes('pending')}
          onCheckedChange={() => toggleStatusFilter('pending')}
        >
          Pending
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={statusFilter.includes('processing')}
          onCheckedChange={() => toggleStatusFilter('processing')}
        >
          Processing
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={statusFilter.includes('success')}
          onCheckedChange={() => toggleStatusFilter('success')}
        >
          Success
        </DropdownMenuCheckboxItem>
        <DropdownMenuCheckboxItem
          checked={statusFilter.includes('failed')}
          onCheckedChange={() => toggleStatusFilter('failed')}
        >
          Failed
        </DropdownMenuCheckboxItem>
        <DropdownMenuSeparator />
        <div className="p-2">
          <Select value={typeFilter} onValueChange={setTypeFilter}>
            <SelectTrigger className="w-full" aria-label="Type">
              <SelectValue placeholder="All types" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">All types</SelectItem>
              <SelectItem value="token_deployment">Token Deployment</SelectItem>
              <SelectItem value="token_transfer">Token Transfer</SelectItem>
              <SelectItem value="add_liquidity">Add Liquidity</SelectItem>
              <SelectItem value="wallet_connect">Wallet Connect</SelectItem>
            </SelectContent>
          </Select>
        </div>
        {(statusFilter.length > 0 || typeFilter || searchQuery) && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={clearFilters}>
              <X className="w-4 h-4 mr-2" />
              Clear Filters
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )

  const renderDesktopFilters = () => (
    <div className="flex gap-2 flex-wrap">
      <Button
        variant={statusFilter.length === 0 ? "default" : "outline"}
        size="sm"
        onClick={() => setStatusFilter([])}
      >
        All
      </Button>
      <Button
        variant={statusFilter.includes('pending') || statusFilter.includes('processing') ? "default" : "outline"}
        size="sm"
        onClick={() => setStatusFilter(['pending', 'processing'])}
      >
        Active
      </Button>
      <Button
        variant={statusFilter.includes('success') ? "default" : "outline"}
        size="sm"
        onClick={() => setStatusFilter(['success'])}
      >
        Completed
      </Button>
      <Button
        variant={statusFilter.includes('failed') ? "default" : "outline"}
        size="sm"
        onClick={() => setStatusFilter(['failed'])}
      >
        Failed
      </Button>
    </div>
  )

  if (transactions.length === 0) {
    return (
      <div 
        data-testid="queue-container" 
        className={cn("text-center py-12", isMobile ? 'space-y-2' : 'space-y-4')}
      >
        <div className="text-gray-500">
          <Clock className="w-12 h-12 mx-auto mb-4 opacity-50" />
          <h3 className="text-lg font-medium mb-2">No transactions yet</h3>
          <p className="text-sm">Your transaction history will appear here</p>
        </div>
      </div>
    )
  }

  return (
    <div 
      data-testid="queue-container" 
      className={cn("w-full", isMobile ? 'space-y-2' : 'space-y-4')}
      role="region"
      aria-label="Transaction Queue"
    >
      {/* Screen reader announcements */}
      {newTxAnnouncement && (
        <div role="status" className="sr-only">
          {newTxAnnouncement}
        </div>
      )}
      
      {completedTxNotification && (
        <div role="alert" className="sr-only">
          {completedTxNotification}
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-semibold">Transaction Queue</h2>
          <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
            <span>{transactions.length} transactions</span>
            <span>{activeTransactions.length} active</span>
            {isQueuePaused && (
              <Badge variant="destructive" className="text-xs">
                Queue Paused
              </Badge>
            )}
          </div>
        </div>
        
        {/* Live indicator */}
        {activeTransactions.length > 0 && (
          <div data-testid="live-indicator" className="flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm text-gray-500">Live</span>
          </div>
        )}
      </div>

      {/* Queue controls */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2">
          {/* Selection controls */}
          <div className="flex items-center gap-2">
            <Checkbox
              checked={selectedIds.length === filteredTransactions.length && filteredTransactions.length > 0}
              onCheckedChange={handleSelectAll}
              aria-label="Select all transactions"
            />
            {selectedIds.length > 0 && (
              <span className="text-sm text-gray-500">
                {selectedIds.length} selected
              </span>
            )}
          </div>

          {/* Bulk actions */}
          {selectedIds.length > 0 && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" size="sm">
                  <MoreVertical className="w-4 h-4" />
                  Bulk Actions
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem 
                  onClick={handleBulkCancel}
                  disabled={!canCancel}
                  aria-disabled={!canCancel}
                >
                  <XCircle className="w-4 h-4 mr-2" />
                  Cancel Selected
                </DropdownMenuItem>
                <DropdownMenuItem 
                  onClick={handleBulkRetry}
                  disabled={!canRetry}
                  aria-disabled={!canRetry}
                >
                  <RotateCcw className="w-4 h-4 mr-2" />
                  Retry Selected
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>

        <div className="flex items-center gap-2">
          {/* Queue management */}
          {isQueuePaused ? (
            <Button variant="default" size="sm" onClick={onResumeQueue}>
              <Play className="w-4 h-4" />
              Resume Queue
            </Button>
          ) : (
            <Button variant="outline" size="sm" onClick={onPauseQueue}>
              <Pause className="w-4 h-4" />
              Pause Queue
            </Button>
          )}
          
          <Button variant="outline" size="sm" onClick={onClearCompleted}>
            <Trash2 className="w-4 h-4" />
            Clear Completed
          </Button>
        </div>
      </div>

      {/* Search and filters */}
      <div className="flex items-center gap-4">
        <div className="flex-1 max-w-md">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
            <Input
              placeholder="Search by hash, type, or token..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
              aria-label="Search transactions"
            />
            {searchQuery && (
              <Button
                variant="ghost"
                size="sm"
                className="absolute right-1 top-1/2 transform -translate-y-1/2 p-1"
                onClick={() => setSearchQuery('')}
              >
                <X className="w-4 h-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Filters */}
        {isMobile ? renderMobileFilters() : renderDesktopFilters()}

        {/* Sort */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="outline" size="sm">
              <SortAsc className="w-4 h-4" />
              Sort
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent>
            <DropdownMenuItem onClick={() => setSortBy('newest')}>
              Newest First
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortBy('oldest')}>
              Oldest First
            </DropdownMenuItem>
            <DropdownMenuItem onClick={() => setSortBy('status')}>
              By Status
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>

        {/* Clear filters */}
        {(statusFilter.length > 0 || typeFilter || searchQuery) && (
          <Button variant="ghost" size="sm" onClick={clearFilters}>
            <X className="w-4 h-4" />
            Clear Filters
          </Button>
        )}
      </div>

      {/* Queue statistics */}
      <div className="grid grid-cols-4 gap-4 p-4 bg-gray-50 rounded-lg">
        <div className="text-center">
          <div className="text-lg font-semibold text-yellow-600">{queueStats.pending}</div>
          <div className="text-xs text-gray-500">pending</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-blue-600">{queueStats.processing}</div>
          <div className="text-xs text-gray-500">processing</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-green-600">{queueStats.success}</div>
          <div className="text-xs text-gray-500">completed</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-semibold text-red-600">{queueStats.failed}</div>
          <div className="text-xs text-gray-500">failed</div>
        </div>
      </div>

      {/* Completed transaction notification */}
      {completedTxNotification && (
        <div role="alert" className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg text-green-800">
          <CheckCircle className="w-4 h-4" />
          {completedTxNotification}
        </div>
      )}

      {/* Transaction list */}
      <div 
        className="space-y-3" 
        role="group" 
        aria-label="Active transactions"
        data-testid="virtual-scroller"
      >
        {filteredTransactions.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            <AlertCircle className="w-8 h-8 mx-auto mb-2 opacity-50" />
            <p>No transactions match your filters</p>
          </div>
        ) : (
          filteredTransactions.map((transaction, index) => (
            <div
              key={transaction.id}
              className="flex items-center gap-3 p-2 rounded-lg hover:bg-gray-50 focus-within:bg-gray-50"
              tabIndex={0}
              onKeyDown={(e) => handleKeyDown(e, index)}
            >
              <Checkbox
                checked={selectedIds.includes(transaction.id)}
                onCheckedChange={(checked) => handleSelectTransaction(transaction.id, !!checked)}
                aria-label={`Select transaction ${transaction.id}`}
              />
              <div className="flex-1">
                <div data-testid={`transaction-${transaction.id}`} className="p-2 border rounded">
                  <span>{transaction.type}</span>
                  <span className="ml-2">{transaction.status}</span>
                </div>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  )
}