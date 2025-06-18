'use client';

import React, { useState } from 'react';
import { useWallet } from '@/providers/WalletProvider';
import { useWalletBalance } from '@/hooks/useWalletBalance';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { ChevronDown, Copy, LogOut, Wallet } from 'lucide-react';

const NETWORK_NAMES: Record<number, string> = {
  8453: 'Base',
  84532: 'Base Sepolia',
};

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function WalletButton() {
  const { isConnected, address, chainId, isLoading, connect, disconnect } = useWallet();
  const { balance } = useWalletBalance(address, chainId);
  const [copyFeedback, setCopyFeedback] = useState(false);

  const handleCopyAddress = async () => {
    if (address) {
      await navigator.clipboard.writeText(address);
      setCopyFeedback(true);
      setTimeout(() => setCopyFeedback(false), 2000);
    }
  };

  if (!isConnected) {
    return (
      <Button
        onClick={connect}
        disabled={isLoading}
        size="default"
        className="gap-2"
      >
        <Wallet className="h-4 w-4" />
        {isLoading ? 'Connecting...' : 'Connect Wallet'}
      </Button>
    );
  }

  const networkName = chainId ? NETWORK_NAMES[chainId] : 'Unknown';
  const isWrongNetwork = chainId && !NETWORK_NAMES[chainId];

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2">
          <div className="flex items-center gap-2">
            {balance && <span className="text-sm font-medium">{balance} ETH</span>}
            <span className="text-sm font-mono">{address && truncateAddress(address)}</span>
            {isWrongNetwork ? (
              <span className="text-xs bg-red-100 text-red-700 px-2 py-1 rounded">
                Wrong Network
              </span>
            ) : (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-1 rounded">
                {networkName}
              </span>
            )}
          </div>
          <ChevronDown className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuItem onClick={handleCopyAddress} className="gap-2">
          <Copy className="h-4 w-4" />
          {copyFeedback ? 'Copied!' : 'Copy Address'}
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={disconnect} className="gap-2 text-red-600">
          <LogOut className="h-4 w-4" />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}