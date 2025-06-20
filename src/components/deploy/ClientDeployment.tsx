'use client';

import React, { useState } from 'react';
import { useWallet } from '@/providers/WalletProvider';
import sdk from '@farcaster/frame-sdk';
import { createPublicClient, createWalletClient, custom, http } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Loader2 } from 'lucide-react';
import { getClientNetworkConfig } from '@/lib/client-network-config';

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

  const networkConfig = getClientNetworkConfig();
  const expectedChainId = targetChainId || networkConfig.chainId;
  const isCorrectChain = chainId === expectedChainId;

  const handleDeploy = async () => {
    if (!isConnected || !address) {
      setError('Wallet not connected');
      return;
    }

    if (!isCorrectChain) {
      try {
        const provider = await sdk.wallet.getEthereumProvider();
        if (!provider) {
          throw new Error('No wallet provider available');
        }
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
      if (!provider) {
        throw new Error('No wallet provider available');
      }
      
      // Create viem clients with the user's wallet
      const chain = chainId === 8453 ? base : baseSepolia;
      const publicClient = createPublicClient({
        chain,
        transport: http(),
      });
      
      const walletClient = createWalletClient({
        account: address as `0x${string}`,
        chain,
        transport: custom(provider),
      });

      // Prepare deployment data with proper formatting
      const deploymentData = {
        name: tokenData.name,
        symbol: tokenData.symbol,
        image: tokenData.imageUrl,
        pool: {
          quoteToken: '0x4200000000000000000000000000000000000006' as `0x${string}`, // WETH on Base
          initialMarketCap: tokenData.marketCap,
        },
        rewardsConfig: {
          creatorReward: tokenData.creatorReward,
          creatorAdmin: address as `0x${string}`,
          creatorRewardRecipient: address as `0x${string}`,
          interfaceAdmin: (process.env.NEXT_PUBLIC_INTERFACE_ADMIN || address) as `0x${string}`,
          interfaceRewardRecipient: (process.env.NEXT_PUBLIC_INTERFACE_REWARD_RECIPIENT || address) as `0x${string}`,
        },
      };

      // Deploy token using Clanker SDK
      const { Clanker } = await import('clanker-sdk');
      const clanker = new Clanker({
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        wallet: walletClient as any,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        publicClient: publicClient as any,
      });

      const deploymentResult = await clanker.deployToken(deploymentData);
      
      // Handle different return types from SDK
      let tokenAddress: string;
      let transactionHash: string;
      let poolAddress: string | undefined;
      
      if (typeof deploymentResult === 'string') {
        tokenAddress = deploymentResult;
        transactionHash = ''; // Will need to be fetched separately
      } else if (deploymentResult && typeof deploymentResult === 'object') {
        const result = deploymentResult as Record<string, unknown>;
        tokenAddress = (result.address as string) || (result.tokenAddress as string) || '';
        transactionHash = (result.txHash as string) || (result.transactionHash as string) || '';
        poolAddress = result.poolAddress as string | undefined;
      } else {
        throw new Error('Invalid deployment result');
      }
      
      if (!tokenAddress) {
        throw new Error('No token address returned from deployment');
      }
      
      onSuccess({
        tokenAddress,
        transactionHash,
        poolAddress,
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