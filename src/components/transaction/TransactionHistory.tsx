'use client'

import React from 'react'

export interface TransactionHistoryProps {
  transactions: Array<{
    id: string
    hash: string
    type: string
    status: string
    timestamp: string
  }>
  isLoading?: boolean
  error?: string
}

export function TransactionHistory({ transactions, isLoading, error }: TransactionHistoryProps) {
  if (isLoading) {
    return <div data-testid="history-skeleton">Loading...</div>
  }

  if (error) {
    return (
      <div role="alert">
        Failed to load transaction history
        <button>Try again</button>
      </div>
    )
  }

  return (
    <div>
      <h1>Transaction History</h1>
      <div>Test User</div>
      <div>@testuser</div>
      <div>{transactions.length} total transactions</div>
      <div>{transactions.filter(tx => tx.status === 'success').length} successful</div>
      <div>{transactions.filter(tx => tx.status === 'failed').length} failed</div>
      
      {transactions.length === 0 ? (
        <div>
          <div>No transactions yet</div>
          <div>Start by deploying your first token!</div>
          <a href="/simple-launch">Deploy Token</a>
        </div>
      ) : (
        <div>
          {transactions.map(tx => (
            <div key={tx.id} data-testid={`transaction-${tx.id}`}>
              {tx.type} - {tx.status}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}