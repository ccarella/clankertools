'use client'

import React, { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { useHaptic } from '@/providers/HapticProvider'
import { useTransactionSubscription } from '@/components/providers/TransactionProvider'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { 
  Clock, 
  CheckCircle, 
  XCircle, 
  Loader2, 
  Copy, 
  ExternalLink,
  AlertCircle,
  Wifi,
  WifiOff
} from 'lucide-react'

type Transaction = {
  id: string
  hash: string
  type: 'token_deployment' | 'token_transfer' | 'add_liquidity' | 'wallet_connect'
  status: 'pending' | 'processing' | 'success' | 'failed'
  timestamp: string
  tokenAddress?: string
  tokenName?: string
  tokenSymbol?: string
  amount?: string
  toAddress?: string
  liquidityAmount?: string
  tokenAmount?: string
  walletAddress?: string
  gasEstimate?: string
  networkFee?: string
  error?: string | null
  estimatedTime?: number
  progress?: number
}

interface TransactionStatusCardProps {
  transaction: Transaction
  onCancel?: (id: string) => void
  onRetry?: (id: string) => void
  /** Enable real-time status updates via SSE */
  enableRealTimeUpdates?: boolean
}

export function TransactionStatusCard({ 
  transaction, 
  onCancel, 
  onRetry,
  enableRealTimeUpdates = true
}: TransactionStatusCardProps) {
  const haptic = useHaptic()
  const [copied, setCopied] = useState(false)
  const [isMobile, setIsMobile] = useState(false)
  const [previousStatus, setPreviousStatus] = useState(transaction.status)
  
  // Subscribe to real-time updates if enabled and provider is available
  const realtimeSubscription = useTransactionSubscription(
    enableRealTimeUpdates ? transaction.id : null,
    {
      autoReconnect: true,
      maxReconnectAttempts: 5,
      reconnectDelay: 1000,
    }
  );
  
  // Merge real-time status with prop transaction data
  const currentTransaction = realtimeSubscription?.status ? {
    ...transaction,
    status: realtimeSubscription.status.status === 'queued' ? 'pending' : 
           realtimeSubscription.status.status === 'completed' ? 'success' :
           realtimeSubscription.status.status,
    progress: realtimeSubscription.status.progress,
    error: realtimeSubscription.status.error || transaction.error,
    timestamp: realtimeSubscription.status.updatedAt ? 
               new Date(realtimeSubscription.status.updatedAt).toISOString() : 
               transaction.timestamp,
  } : transaction

  useEffect(() => {
    const checkMobile = () => setIsMobile(window.innerWidth <= 375)
    checkMobile()
    window.addEventListener('resize', checkMobile)
    return () => window.removeEventListener('resize', checkMobile)
  }, [])

  // Trigger haptic feedback on status change
  useEffect(() => {
    if (previousStatus !== currentTransaction.status) {
      if (currentTransaction.status === 'success') {
        haptic.cardSelect?.()
      }
      setPreviousStatus(currentTransaction.status)
    }
  }, [currentTransaction.status, previousStatus, haptic])

  const typeLabel = currentTransaction.type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  const truncatedHash = `${currentTransaction.hash.slice(0, 6)}...${currentTransaction.hash.slice(-4)}`

  const formatTimestamp = () => {
    const now = new Date()
    const txTime = new Date(currentTransaction.timestamp)
    const diffMinutes = Math.floor((now.getTime() - txTime.getTime()) / 60000)
    
    if (diffMinutes < 60) {
      return `${diffMinutes} minutes ago`
    } else if (diffMinutes < 1440) {
      return `${Math.floor(diffMinutes / 60)} hours ago`
    } else {
      return txTime.toLocaleDateString('en-US', { 
        month: 'short', 
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        hour12: true
      })
    }
  }

  const getStatusIcon = () => {
    switch (currentTransaction.status) {
      case 'pending':
        return <Clock className="w-4 h-4 text-yellow-500" data-testid="loading-spinner" />
      case 'processing':
        return <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
      case 'success':
        return <CheckCircle className="w-4 h-4 text-green-500" data-testid="success-icon" />
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" data-testid="error-icon" />
    }
  }

  const getStatusColor = () => {
    switch (currentTransaction.status) {
      case 'pending': return 'text-yellow-500'
      case 'processing': return 'text-blue-500'
      case 'success': return 'text-green-500'
      case 'failed': return 'text-red-500'
      default: return 'text-gray-500'
    }
  }

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(currentTransaction.hash)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (error) {
      console.error('Failed to copy:', error)
    }
  }

  const handleCancel = () => {
    haptic.buttonPress?.('destructive')
    onCancel?.(currentTransaction.id)
  }

  const handleRetry = () => {
    haptic.buttonPress?.()
    onRetry?.(currentTransaction.id)
  }

  const handleViewOnExplorer = () => {
    window.open(`https://basescan.org/tx/${currentTransaction.hash}`, '_blank')
  }

  return (
    <article 
      data-testid="transaction-card"
      className={cn(
        "bg-white border border-gray-200 rounded-lg shadow-sm transition-all hover:shadow-md",
        isMobile ? 'p-3' : 'p-4'
      )}
      aria-label={`${typeLabel} transaction ${currentTransaction.status}`}
    >
      <div 
        data-testid="transaction-details" 
        className={cn(isMobile ? 'text-sm' : 'text-base', 'space-y-3')}
      >
        {/* Header with type and status */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-medium">{typeLabel}</span>
            {currentTransaction.tokenName && (
              <Badge variant="secondary" className="text-xs">
                {currentTransaction.tokenName} ({currentTransaction.tokenSymbol})
              </Badge>
            )}
          </div>
          <div className="flex items-center gap-2">
            {getStatusIcon()}
            <span 
              data-testid="status-icon" 
              className={cn("font-medium capitalize", getStatusColor())}
            >
              {currentTransaction.status}
            </span>
            {/* Connection status indicator */}
            {enableRealTimeUpdates && (
              <div className="flex items-center">
                {realtimeSubscription?.isConnected ? (
                  <Wifi className="w-3 h-3 text-green-500" aria-label="Connected" />
                ) : realtimeSubscription?.isReconnecting ? (
                  <Loader2 className="w-3 h-3 text-yellow-500 animate-spin" aria-label="Reconnecting" />
                ) : realtimeSubscription?.error ? (
                  <WifiOff className="w-3 h-3 text-red-500" aria-label="Disconnected" />
                ) : null}
              </div>
            )}
          </div>
        </div>

        {/* Transaction hash */}
        <div className="text-sm text-gray-500 font-mono">
          {truncatedHash}
        </div>

        {/* Progress bar for processing transactions */}
        {currentTransaction.status === 'processing' && currentTransaction.progress && (
          <div role="progressbar" aria-valuenow={currentTransaction.progress} className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-blue-500 h-2 rounded-full transition-all duration-300" 
              style={{ width: `${currentTransaction.progress}%` }}
            />
            <span className="text-xs text-gray-500 mt-1">{currentTransaction.progress}%</span>
          </div>
        )}

        {/* Error message */}
        {currentTransaction.status === 'failed' && currentTransaction.error && (
          <div role="alert" className="flex items-center gap-2 text-red-600 text-sm bg-red-50 p-2 rounded">
            <AlertCircle className="w-4 h-4" />
            {currentTransaction.error}
          </div>
        )}

        {/* Transaction type specific details */}
        {currentTransaction.type === 'token_transfer' && currentTransaction.toAddress && (
          <div className="text-sm space-y-1">
            <div className="font-medium">{currentTransaction.amount} {currentTransaction.tokenSymbol}</div>
            <div className="text-gray-500">To: {currentTransaction.toAddress.slice(0, 6)}...{currentTransaction.toAddress.slice(-4)}</div>
          </div>
        )}

        {currentTransaction.type === 'add_liquidity' && (
          <div className="text-sm font-medium">
            {currentTransaction.liquidityAmount} ETH + {currentTransaction.tokenAmount} {currentTransaction.tokenSymbol}
          </div>
        )}

        {currentTransaction.type === 'wallet_connect' && currentTransaction.walletAddress && (
          <div className="text-sm font-mono">
            {currentTransaction.walletAddress.slice(0, 6)}...{currentTransaction.walletAddress.slice(-4)}
          </div>
        )}

        {/* Gas and fees */}
        <div className="flex gap-4 text-xs text-gray-500">
          {currentTransaction.gasEstimate && <span>Gas: {currentTransaction.gasEstimate} ETH</span>}
          {currentTransaction.networkFee && <span>Network Fee: {currentTransaction.networkFee} ETH</span>}
          {currentTransaction.estimatedTime && <span>Est. {currentTransaction.estimatedTime}s remaining</span>}
        </div>

        {/* Timestamp */}
        <div className="timestamp text-xs text-gray-400">
          {formatTimestamp()}
        </div>

        {/* Screen reader status announcement */}
        <div role="status" style={{ position: 'absolute', left: '-9999px' }}>
          {currentTransaction.status === 'success' && 'Transaction completed successfully'}
        </div>
      </div>

      {/* Action buttons */}
      <div className="actions flex gap-2 mt-4">
        {currentTransaction.status === 'pending' && onCancel && (
          <Button 
            variant="destructive" 
            size="sm"
            onClick={handleCancel}
            style={{ minHeight: '44px' }}
          >
            Cancel
          </Button>
        )}
        
        {currentTransaction.status === 'failed' && onRetry && (
          <Button 
            variant="default" 
            size="sm"
            onClick={handleRetry}
            style={{ minHeight: '44px' }}
          >
            Retry
          </Button>
        )}
        
        <Button 
          variant="outline" 
          size="sm"
          onClick={handleCopy}
          aria-label="Copy transaction hash"
          style={{ minHeight: '44px' }}
        >
          <Copy className="w-4 h-4" />
          {copied ? 'Copied!' : 'Copy'}
        </Button>
        
        <Button 
          variant="outline" 
          size="sm"
          onClick={handleViewOnExplorer}
          aria-label="View on explorer"
          style={{ minHeight: '44px' }}
        >
          <ExternalLink className="w-4 h-4" />
          Explorer
        </Button>
      </div>
    </article>
  )
}