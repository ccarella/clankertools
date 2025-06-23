'use client'

import React, { useState } from 'react';
import { TransactionStatusCard } from '@/components/transaction/TransactionStatusCard';
import { Button } from '@/components/ui/button';

const mockTransactions = [
  {
    id: 'tx_demo_001',
    hash: '0x1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef',
    type: 'token_deployment' as const,
    status: 'processing' as const,
    timestamp: new Date().toISOString(),
    tokenName: 'DemoToken',
    tokenSymbol: 'DEMO',
    progress: 25,
  },
  {
    id: 'tx_demo_002',
    hash: '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
    type: 'token_transfer' as const,
    status: 'pending' as const,
    timestamp: new Date(Date.now() - 60000).toISOString(),
    amount: '100',
    tokenSymbol: 'DEMO',
    toAddress: '0x742d35Cc4Cc8b1c4E46C9eEc51a7e8F8f17B0A79',
  },
  {
    id: 'tx_demo_003',
    hash: '0x9876543210fedcba9876543210fedcba9876543210fedcba9876543210fedcba',
    type: 'wallet_connect' as const,
    status: 'success' as const,
    timestamp: new Date(Date.now() - 300000).toISOString(),
    walletAddress: '0x742d35Cc4Cc8b1c4E46C9eEc51a7e8F8f17B0A79',
  },
];

export default function TransactionDemoPage() {
  const [realTimeEnabled, setRealTimeEnabled] = useState(true);

  return (
    <div className="p-4 space-y-6">
      <div className="max-w-2xl mx-auto space-y-4">
        <h1 className="text-2xl font-bold">Transaction Real-time Updates Demo</h1>
        
        <p className="text-gray-600">
          This demo shows how transaction status cards can receive real-time updates via Server-Sent Events (SSE).
          The cards below demonstrate different transaction states and will show live connection status indicators.
        </p>

        <div className="flex items-center gap-4 p-4 bg-blue-50 rounded-lg">
          <Button
            variant={realTimeEnabled ? "default" : "outline"}
            onClick={() => setRealTimeEnabled(!realTimeEnabled)}
            size="sm"
          >
            {realTimeEnabled ? "Disable" : "Enable"} Real-time Updates
          </Button>
          <span className="text-sm text-gray-600">
            Real-time updates: {realTimeEnabled ? "ON" : "OFF"}
          </span>
        </div>

        <div className="space-y-4">
          {mockTransactions.map((transaction) => (
            <TransactionStatusCard
              key={transaction.id}
              transaction={transaction}
              enableRealTimeUpdates={realTimeEnabled}
              onCancel={(id) => console.log('Cancel requested for:', id)}
              onRetry={(id) => console.log('Retry requested for:', id)}
            />
          ))}
        </div>

        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <h2 className="text-lg font-semibold mb-2">Features Demonstrated:</h2>
          <ul className="list-disc list-inside space-y-1 text-sm text-gray-700">
            <li>Real-time status updates via Server-Sent Events</li>
            <li>Connection status indicators (WiFi icons)</li>
            <li>Automatic reconnection with exponential backoff</li>
            <li>Progress bar updates for processing transactions</li>
            <li>Mobile-optimized design with haptic feedback</li>
            <li>Graceful degradation when real-time updates are disabled</li>
            <li>Battery-efficient implementation</li>
          </ul>
        </div>

        <div className="mt-4 p-4 bg-yellow-50 rounded-lg">
          <h3 className="text-md font-semibold mb-2">Connection Status Icons:</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-green-500 rounded-sm"></div>
              <span>Connected - Receiving real-time updates</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-yellow-500 rounded-sm animate-spin"></div>
              <span>Reconnecting - Attempting to restore connection</span>
            </div>
            <div className="flex items-center gap-2">
              <div className="w-3 h-3 bg-red-500 rounded-sm"></div>
              <span>Disconnected - Connection failed or disabled</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}