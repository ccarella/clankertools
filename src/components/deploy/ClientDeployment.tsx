'use client';

import React, { useState } from 'react';
import { useWallet } from '@/providers/WalletProvider';
import sdk from '@farcaster/frame-sdk';
import { createPublicClient, createWalletClient, custom, http, parseEther } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';

interface TokenData {
  name: string;
  symbol: string;
  imageUrl: string;
  description?: string;
  marketCap: string;
  creatorReward: number;
  deployerAddress: string;
}

interface ClientDeploymentProps {
  tokenData: TokenData;
  onSuccess: (result: { tokenAddress: string; transactionHash: string; poolAddress?: string }) => void;
  onError: (error: Error) => void;
  targetChainId?: number;
}

export function ClientDeployment({ tokenData, onSuccess, onError, targetChainId }: ClientDeploymentProps) {
  const { isConnected, address, chainId } = useWallet();
  const [isDeploying, setIsDeploying] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const expectedChainId = targetChainId || (process.env.NEXT_PUBLIC_NETWORK === 'base' ? 8453 : 84532);
  const isCorrectChain = chainId === expectedChainId;

  const handleDeploy = async () => {
    if (!isConnected || !address) {
      setError('Wallet not connected');
      return;
    }

    if (!isCorrectChain) {
      try {
        const provider = await sdk.wallet.getEthereumProvider();
        await provider.request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: `0x${expectedChainId.toString(16)}` }],
        });
      } catch {
        setError('Failed to switch network');
        onError(new Error('Failed to switch network'));
        return;
      }
    }

    setIsDeploying(true);
    setError(null);

    try {
      // Get the provider from Farcaster SDK
      const provider = await sdk.wallet.getEthereumProvider();
      
      // Create viem clients with the user's wallet
      const chain = chainId === 8453 ? base : baseSepolia;
      const publicClient = createPublicClient({
        chain,
        transport: http(),
      });
      
      const walletClient = createWalletClient({
        account: address,
        chain,
        transport: custom(provider),
      });

      // Prepare deployment data with proper formatting
      const deploymentData = {
        name: tokenData.name,
        symbol: tokenData.symbol,
        imageUrl: tokenData.imageUrl,
        description: tokenData.description || '',
        fundingSourceId: 0,
        creatorShareId: 0,
        rewardsConfig: {
          creatorAdmin: address,
          creatorRewardRecipient: address,
          creatorPercentage: tokenData.creatorReward,
        },
        marketCapLiquidity: parseEther(tokenData.marketCap).toString(),
      };

      // Deploy token using Clanker SDK
      const { Clanker } = await import('clanker-sdk');
      const clanker = new Clanker({
        wallet: walletClient,
        publicClient,
      });

      const result = await clanker.deployToken(deploymentData);
      
      onSuccess({
        tokenAddress: result.tokenAddress,
        transactionHash: result.transactionHash,
        poolAddress: result.poolAddress,
      });
    } catch (err) {
      console.error('Deployment error:', err);
      const errorMessage = err instanceof Error ? err.message : 'Unknown error occurred';
      setError(errorMessage);
      onError(err instanceof Error ? err : new Error(errorMessage));
    } finally {
      setIsDeploying(false);
    }
  };

  if (!isConnected) {
    return (
      <Alert>
        <AlertDescription>Wallet not connected. Please connect your wallet to deploy tokens.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="space-y-4">
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}
      
      <Button
        onClick={handleDeploy}
        disabled={isDeploying}
        className="w-full"
        size="lg"
      >
        {isDeploying ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Deploying...
          </>
        ) : !isCorrectChain ? (
          'Switch Network & Deploy Token'
        ) : (
          'Deploy Token'
        )}
      </Button>
    </div>
  );
}