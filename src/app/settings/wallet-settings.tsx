'use client';

import React, { useState } from 'react';
import { useWallet } from '@/providers/WalletProvider';
import { useFarcasterAuth } from '@/components/providers/FarcasterAuthProvider';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import {
  Wallet,
  Copy,
  CheckCircle,
  AlertCircle,
  Loader2,
  ExternalLink,
} from 'lucide-react';

export function WalletSettings() {
  const { address, isConnected, isLoading, connect, disconnect, balance, networkName, error: walletError } = useWallet();
  const { user } = useFarcasterAuth();
  const [copied, setCopied] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleConnect = async () => {
    try {
      setError(null);
      await connect();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect wallet');
    }
  };

  const handleCopyAddress = async () => {
    if (address) {
      await navigator.clipboard.writeText(address);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleViewOnExplorer = () => {
    if (address && networkName) {
      const explorerUrl = networkName.includes('Sepolia')
        ? `https://sepolia.basescan.org/address/${address}`
        : `https://basescan.org/address/${address}`;
      window.open(explorerUrl, '_blank');
    }
  };

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Wallet className="h-5 w-5" />
          Wallet
        </CardTitle>
        <CardDescription>
          {isConnected
            ? 'Manage your connected wallet and creator rewards'
            : 'Connect your wallet to enable creator rewards'}
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {(error || walletError) && (
          <div className="flex items-center gap-2 p-3 bg-destructive/10 text-destructive rounded-lg">
            <AlertCircle className="h-4 w-4" />
            <span className="text-sm">{error || walletError}</span>
          </div>
        )}

        {isConnected && address ? (
          <>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Status</span>
                <Badge variant="default" className="bg-green-500">
                  <CheckCircle className="h-3 w-3 mr-1" />
                  Connected
                </Badge>
              </div>

              <Separator />

              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Address</span>
                <div className="flex items-center gap-2">
                  <code className="text-sm font-mono">{formatAddress(address)}</code>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleCopyAddress}
                    aria-label="Copy address"
                  >
                    {copied ? (
                      <CheckCircle className="h-4 w-4 text-green-500" />
                    ) : (
                      <Copy className="h-4 w-4" />
                    )}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    onClick={handleViewOnExplorer}
                    aria-label="View on explorer"
                  >
                    <ExternalLink className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {balance && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Balance</span>
                    <span className="text-sm font-medium">{balance} ETH</span>
                  </div>
                </>
              )}

              {networkName && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Network</span>
                    <Badge variant="secondary">{networkName}</Badge>
                  </div>
                </>
              )}

              {user?.fid && (
                <>
                  <Separator />
                  <div className="flex items-center justify-between">
                    <span className="text-sm text-muted-foreground">Farcaster ID</span>
                    <span className="text-sm font-medium">FID: {user.fid}</span>
                  </div>
                </>
              )}
            </div>

            <div className="pt-2">
              <Button
                onClick={disconnect}
                variant="outline"
                className="w-full"
              >
                Disconnect
              </Button>
            </div>
          </>
        ) : (
          <Button
            onClick={handleConnect}
            disabled={isLoading}
            className="w-full"
          >
            {isLoading ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Connecting...
              </>
            ) : (
              'Connect Wallet'
            )}
          </Button>
        )}
      </CardContent>
    </Card>
  );
}