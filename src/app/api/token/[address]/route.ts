import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

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
  { params }: { params: { address: string } }
) {
  const { address } = params;
  
  // Validate address format
  if (!address || !address.match(/^0x[a-fA-F0-9]{40}$/)) {
    return NextResponse.json({ error: 'Invalid token address' }, { status: 400 });
  }

  try {
    // Check cache first
    const cacheKey = `token:${address.toLowerCase()}`;
    const cached = await redis.get<TokenData>(cacheKey);
    
    if (cached) {
      return NextResponse.json({ success: true, data: cached });
    }

    // Fetch token data from Clanker API or blockchain
    // For now, we'll use mock data. In production, this would call the actual API
    const tokenData = await fetchTokenData(address);
    
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

async function fetchTokenData(address: string): Promise<TokenData | null> {
  // In production, this would fetch real data from:
  // 1. Clanker API for basic token info
  // 2. DEX API for price and volume data
  // 3. Blockchain RPC for holder count and supply
  
  // For now, return mock data for development
  // This should be replaced with actual API calls
  return {
    name: 'Mock Token',
    symbol: 'MOCK',
    address: address,
    txHash: '0x' + '0'.repeat(64),
    imageUrl: 'ipfs://QmZxN8UJzR8kJnDyT3CgM3KgvbFYRXRknCkiMLDH1Q2Hti',
    creatorAddress: '0x' + '0'.repeat(40),
    totalSupply: '1000000000',
    marketCap: Math.floor(Math.random() * 1000000).toString(),
    holders: Math.floor(Math.random() * 1000),
    volume24h: Math.floor(Math.random() * 100000).toString(),
    priceChange24h: (Math.random() * 200 - 100),
  };
}