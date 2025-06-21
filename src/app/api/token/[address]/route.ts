import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { getNetworkConfig } from '@/lib/network-config';
import { createPublicClient, http, formatUnits, createWalletClient, parseAbiItem } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { Clanker } from 'clanker-sdk';
import { privateKeyToAccount } from 'viem/accounts';

// Initialize Redis client
const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

interface TokenData {
  name: string;
  symbol: string;
  address: string;
  txHash: string;
  imageUrl: string;
  creatorAddress: string;
  totalSupply: string;
  marketCap: string;
  holders: number;
  volume24h: string;
  priceChange24h: number;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ address: string }> }
) {
  const { address } = await params;
  
  // Validate address format
  if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
    return NextResponse.json({ error: 'Invalid token address' }, { status: 400 });
  }

  try {
    // Get network configuration
    const networkConfig = getNetworkConfig();
    
    // Check cache first - include network in cache key
    const cacheKey = `token:${networkConfig.network}:${address.toLowerCase()}`;
    const cached = await redis.get<TokenData>(cacheKey);
    
    if (cached) {
      return NextResponse.json({ success: true, data: cached });
    }

    // Fetch token data from blockchain and Clanker API
    const tokenData = await fetchTokenData(address, networkConfig);
    
    if (!tokenData) {
      return NextResponse.json({ success: false, error: 'Token not found' }, { status: 404 });
    }

    // Cache the data for 5 minutes
    await redis.setex(cacheKey, 300, tokenData);

    return NextResponse.json({ success: true, data: tokenData });
  } catch (error) {
    console.error('Error fetching token data:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to fetch token data' },
      { status: 500 }
    );
  }
}

async function fetchTokenData(address: string, networkConfig: ReturnType<typeof getNetworkConfig>): Promise<TokenData | null> {
  try {
    // Create a public client for the appropriate network
    const chain = networkConfig.isMainnet ? base : baseSepolia;
    const publicClient = createPublicClient({
      chain,
      transport: http(networkConfig.rpcUrl),
    });

    // Initialize Clanker SDK for fetching token metadata
    let clankerData = null;
    try {
      // Create a dummy wallet client for Clanker SDK initialization
      // This is just for reading data, not for signing transactions
      const dummyPrivateKey = '0x' + '0'.repeat(63) + '1' as `0x${string}`;
      const account = privateKeyToAccount(dummyPrivateKey);
      const walletClient = createWalletClient({
        account,
        chain,
        transport: http(networkConfig.rpcUrl),
      });

      const clanker = new Clanker(walletClient, publicClient);
      
      // Try to fetch token data from Clanker
      if (clanker.getToken) {
        clankerData = await clanker.getToken(address);
      }
    } catch (clankerError) {
      console.error('Error fetching from Clanker:', clankerError);
      // Continue without Clanker data
    }

    // ERC20 ABI for basic token info
    const erc20Abi = [
      {
        inputs: [],
        name: 'name',
        outputs: [{ type: 'string' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [],
        name: 'symbol',
        outputs: [{ type: 'string' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [],
        name: 'decimals',
        outputs: [{ type: 'uint8' }],
        stateMutability: 'view',
        type: 'function',
      },
      {
        inputs: [],
        name: 'totalSupply',
        outputs: [{ type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      },
    ] as const;

    // Fetch basic token info from blockchain
    const [name, symbol, decimals, totalSupply] = await Promise.all([
      publicClient.readContract({
        address: address as `0x${string}`,
        abi: erc20Abi,
        functionName: 'name',
      }),
      publicClient.readContract({
        address: address as `0x${string}`,
        abi: erc20Abi,
        functionName: 'symbol',
      }),
      publicClient.readContract({
        address: address as `0x${string}`,
        abi: erc20Abi,
        functionName: 'decimals',
      }),
      publicClient.readContract({
        address: address as `0x${string}`,
        abi: erc20Abi,
        functionName: 'totalSupply',
      }),
    ]);

    // Format total supply
    const formattedTotalSupply = formatUnits(totalSupply, decimals);

    // Calculate holder count by analyzing Transfer events
    let holders = 0;
    try {
      const transferEventAbi = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)');
      
      // Get all Transfer events for this token
      const logs = await publicClient.getLogs({
        address: address as `0x${string}`,
        event: transferEventAbi,
        fromBlock: 'earliest',
        toBlock: 'latest',
      });

      // Track unique addresses that have received tokens
      const uniqueHolders = new Set<string>();
      
      for (const log of logs) {
        if (log.args && log.args.to && log.args.to !== '0x0000000000000000000000000000000000000000') {
          uniqueHolders.add(log.args.to.toLowerCase());
        }
      }

      // Filter out addresses with zero balance
      const balanceAbi = [{
        inputs: [{ name: 'account', type: 'address' }],
        name: 'balanceOf',
        outputs: [{ type: 'uint256' }],
        stateMutability: 'view',
        type: 'function',
      }] as const;

      const holderAddresses = Array.from(uniqueHolders);
      const balanceChecks = await Promise.all(
        holderAddresses.slice(0, 100).map(async (holder) => {
          try {
            const balance = await publicClient.readContract({
              address: address as `0x${string}`,
              abi: balanceAbi,
              functionName: 'balanceOf',
              args: [holder as `0x${string}`],
            });
            return balance > 0n;
          } catch {
            return false;
          }
        })
      );

      holders = balanceChecks.filter(Boolean).length;
    } catch (error) {
      console.error('Error calculating holder count:', error);
    }

    // TODO: Integrate with DEX API for price, volume data
    const tokenData: TokenData = {
      name: name as string,
      symbol: symbol as string,
      address,
      txHash: clankerData?.txHash || '0x' + '0'.repeat(64),
      imageUrl: clankerData?.imageUrl || 'ipfs://QmZxN8UJzR8kJnDyT3CgM3KgvbFYRXRknCkiMLDH1Q2Hti',
      creatorAddress: clankerData?.creatorAddress || '0x' + '0'.repeat(40),
      totalSupply: formattedTotalSupply,
      marketCap: '0', // TODO: Calculate from DEX price
      holders,
      volume24h: '0', // TODO: Get from DEX API
      priceChange24h: 0, // TODO: Get from DEX API
    };

    return tokenData;
  } catch (error) {
    console.error('Error fetching token data from blockchain:', error);
    
    // If the contract doesn't exist or doesn't have ERC20 methods, return null
    if (error instanceof Error && error.message.includes('reverted')) {
      return null;
    }
    
    // For development/testing, return mock data if blockchain call fails
    if (!networkConfig.isMainnet) {
      return {
        name: 'Test Token',
        symbol: 'TEST',
        address: address,
        txHash: '0x' + '0'.repeat(64),
        imageUrl: 'ipfs://QmZxN8UJzR8kJnDyT3CgM3KgvbFYRXRknCkiMLDH1Q2Hti',
        creatorAddress: '0x' + '0'.repeat(40),
        totalSupply: '1000000000',
        marketCap: '100000',
        holders: 42,
        volume24h: '5000',
        priceChange24h: 5.25,
      };
    }
    
    throw error;
  }
}