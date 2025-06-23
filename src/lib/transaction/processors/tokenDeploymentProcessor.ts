import { Clanker } from 'clanker-sdk';
import { createPublicClient, createWalletClient, http } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { uploadToIPFS } from '@/lib/ipfs';
import { getNetworkConfig } from '@/lib/network-config';
import { Redis } from '@upstash/redis';
import { storeUserToken } from '@/lib/redis';
import { Transaction } from '../TransactionManager';

// Types for token deployment
export interface TokenDeploymentPayload extends Record<string, unknown> {
  name: string;
  symbol: string;
  imageFile: Blob;
  fid?: string;
  castContext?: {
    type: string;
    castId: string;
    parentCastId?: string;
    author: {
      fid: string;
      username: string;
    };
    embedUrl?: string;
  };
  creatorFeePercentage?: number;
  // Team deployment specific fields
  teamMembers?: Array<{
    address: string;
    percentage: number;
    role: string;
    vestingMonths: number;
    cliffMonths?: number;
  }>;
  treasuryAllocation?: {
    percentage: number;
    address: string;
    vestingMonths?: number;
  };
}

export interface TokenDeploymentResult {
  tokenAddress: string;
  txHash?: string;
  imageUrl: string;
  network: string;
  chainId: number;
  teamMembers?: Array<{
    address: string;
    percentage: number;
    role: string;
    vestingMonths: number;
    cliffMonths?: number;
  }>;
  treasuryAllocation?: {
    percentage: number;
    address: string;
    vestingMonths?: number;
  };
}

// Interface for wallet data
interface WalletData {
  address: string;
  enableCreatorRewards: boolean;
  connectedAt: number;
}

// Interface for cast-token relationship
interface TokenCastRelationship {
  tokenAddress: string;
  castId: string;
  parentCastId?: string;
  authorFid: string;
  authorUsername: string;
  embedUrl?: string;
  createdAt: number;
}

// Initialize Redis client
function getRedisClient(): Redis | null {
  const url = process.env.KV_REST_API_URL;
  const token = process.env.KV_REST_API_TOKEN;

  if (!url || !token) {
    console.warn('Redis configuration missing, wallet lookup will be skipped');
    return null;
  }

  try {
    return new Redis({ url, token });
  } catch (error) {
    console.error('Failed to initialize Redis client:', error);
    return null;
  }
}

// Validate Ethereum address
function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// Token deployment processor function
export async function tokenDeploymentProcessor(
  transaction: Transaction
): Promise<{ success: boolean; result?: TokenDeploymentResult }> {
  const payload = transaction.payload as TokenDeploymentPayload;

  try {
    // Validate required environment variables
    const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
    const interfaceAdmin = process.env.INTERFACE_ADMIN;
    const interfaceRewardRecipient = process.env.INTERFACE_REWARD_RECIPIENT;

    if (!privateKey || !interfaceAdmin || !interfaceRewardRecipient) {
      throw new Error('Missing required environment variables');
    }

    // Validate and format private key
    let formattedPrivateKey: `0x${string}`;
    const cleanKey = privateKey.trim();
    
    if (cleanKey.startsWith('0x')) {
      if (cleanKey.length !== 66) {
        throw new Error(`Invalid private key length: expected 66 characters, got ${cleanKey.length}`);
      }
      formattedPrivateKey = cleanKey as `0x${string}`;
    } else {
      if (cleanKey.length !== 64) {
        throw new Error(`Invalid private key length: expected 64 hex characters, got ${cleanKey.length}`);
      }
      formattedPrivateKey = `0x${cleanKey}`;
    }
    
    if (!/^0x[a-fA-F0-9]{64}$/.test(formattedPrivateKey)) {
      throw new Error('Private key must be a valid hexadecimal string');
    }

    // Get network configuration
    const networkConfig = getNetworkConfig();
    const chain = networkConfig.isMainnet ? base : baseSepolia;

    // Create account from private key
    const account = privateKeyToAccount(formattedPrivateKey);

    // Upload image to IPFS
    const imageUrl = await uploadToIPFS(payload.imageFile);

    // Setup wallet clients
    const publicClient = createPublicClient({
      chain,
      transport: http(networkConfig.rpcUrl),
    });
    
    const wallet = createWalletClient({
      account,
      chain,
      transport: http(networkConfig.rpcUrl),
    });

    // Initialize Clanker SDK
    const clanker = new Clanker({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      wallet: wallet as any,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      publicClient: publicClient as any,
    });

    // Get configurable values
    const initialMarketCap = process.env.INITIAL_MARKET_CAP || '0.1';
    const rawCreatorReward = payload.creatorFeePercentage 
      ? payload.creatorFeePercentage
      : parseInt(process.env.CREATOR_REWARD || '80', 10);
    
    const creatorReward = (isNaN(rawCreatorReward) || rawCreatorReward < 0 || rawCreatorReward > 100) 
      ? 80 
      : rawCreatorReward;

    // Determine creator admin and reward recipient
    let creatorAdmin = account.address;
    let creatorRewardRecipient = account.address;
    
    // Check for user's connected wallet if fid is provided
    if (payload.fid) {
      try {
        const redisClient = getRedisClient();
        if (redisClient) {
          const walletData = await redisClient.get<WalletData>(`wallet:${payload.fid}`);
          
          if (walletData && walletData.enableCreatorRewards && isValidAddress(walletData.address)) {
            creatorAdmin = walletData.address as `0x${string}`;
            creatorRewardRecipient = walletData.address as `0x${string}`;
          }
        }
      } catch (error) {
        console.error('Error fetching wallet data:', error);
        // Continue with deployer address
      }
    }

    // Deploy token
    const deploymentResult = await clanker.deployToken({
      name: payload.name,
      symbol: payload.symbol,
      image: imageUrl,
      pool: {
        quoteToken: '0x4200000000000000000000000000000000000006' as `0x${string}`, // WETH on Base
        initialMarketCap,
      },
      rewardsConfig: {
        creatorReward,
        creatorAdmin: creatorAdmin as `0x${string}`,
        creatorRewardRecipient: creatorRewardRecipient as `0x${string}`,
        interfaceAdmin: interfaceAdmin as `0x${string}`,
        interfaceRewardRecipient: interfaceRewardRecipient as `0x${string}`,
      },
      context: payload.castContext ? {
        interface: 'Clanker Tools',
        platform: 'Farcaster',
        messageId: payload.castContext.castId,
        id: payload.castContext.parentCastId || payload.castContext.castId,
      } : undefined,
    });

    // Handle different return types from SDK
    let tokenAddress: string;
    let txHash: string | undefined;

    if (typeof deploymentResult === 'string') {
      tokenAddress = deploymentResult;
    } else if (deploymentResult && typeof deploymentResult === 'object') {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const result = deploymentResult as any;
      tokenAddress = result.address || result.tokenAddress || deploymentResult;
      txHash = result.txHash || result.transactionHash;
    } else {
      throw new Error('Invalid deployment result from SDK');
    }

    // Wait for transaction confirmation if we have a hash
    if (txHash) {
      const receipt = await publicClient.waitForTransactionReceipt({ 
        hash: txHash as `0x${string}`,
        confirmations: 1,
      });

      if (receipt.status === 'reverted') {
        throw new Error('Transaction failed on blockchain');
      }

      // Get token address from receipt if not already set
      if (!tokenAddress && receipt.contractAddress) {
        tokenAddress = receipt.contractAddress;
      }
    }

    if (!tokenAddress) {
      throw new Error('No token address available after deployment');
    }

    // Store cast context relationship if provided
    if (payload.castContext && tokenAddress) {
      try {
        const redisClient = getRedisClient();
        if (redisClient) {
          const castRelationship: TokenCastRelationship = {
            tokenAddress,
            castId: payload.castContext.castId,
            parentCastId: payload.castContext.parentCastId,
            authorFid: payload.castContext.author.fid,
            authorUsername: payload.castContext.author.username,
            embedUrl: payload.castContext.embedUrl,
            createdAt: Date.now(),
          };
          
          await redisClient.set(
            `token:${tokenAddress}:cast`,
            castRelationship,
            {
              ex: 60 * 60 * 24 * 30, // 30 days expiration
            }
          );
        }
      } catch (error) {
        console.error('Failed to store cast context:', error);
        // Don't fail the deployment if storing context fails
      }
    }

    // Store token in user's token list
    if (payload.fid && tokenAddress) {
      try {
        await storeUserToken(payload.fid, {
          address: tokenAddress,
          name: payload.name,
          symbol: payload.symbol,
          createdAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Failed to store user token:', error);
        // Don't fail the deployment if storing fails
      }
    }

    // Store deployment details for monitoring
    if (tokenAddress) {
      try {
        const redisClient = getRedisClient();
        if (redisClient) {
          const deploymentData = {
            tokenAddress,
            name: payload.name,
            symbol: payload.symbol,
            createdAt: new Date().toISOString(),
            fid: payload.fid || 'anonymous',
            creatorAdmin,
            creatorRewardRecipient,
            creatorReward,
            txHash: txHash || null,
            interfaceAdmin,
            interfaceRewardRecipient,
            network: networkConfig.name,
            chainId: networkConfig.chainId,
            // Team deployment specific data
            ...(payload.teamMembers && { teamMembers: payload.teamMembers }),
            ...(payload.treasuryAllocation && { treasuryAllocation: payload.treasuryAllocation }),
          };
          
          const storageKey = payload.teamMembers ? `team-token:${tokenAddress}` : `deployment:${tokenAddress}`;
          
          await redisClient.set(
            storageKey,
            deploymentData,
            {
              ex: 365 * 24 * 60 * 60, // 1 year expiration
            }
          );
        }
      } catch (error) {
        console.error('Failed to store deployment details:', error);
        // Don't fail the deployment if storing fails
      }
    }

    // Return successful result
    const result: TokenDeploymentResult = {
      tokenAddress,
      txHash,
      imageUrl,
      network: networkConfig.name,
      chainId: networkConfig.chainId,
      ...(payload.teamMembers && { teamMembers: payload.teamMembers }),
      ...(payload.treasuryAllocation && { treasuryAllocation: payload.treasuryAllocation }),
    };

    return {
      success: true,
      result,
    };

  } catch (error) {
    console.error('Token deployment processor error:', error);
    return {
      success: false,
    };
  }
}