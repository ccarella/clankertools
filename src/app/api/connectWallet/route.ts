import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';

interface WalletData {
  walletAddress: string;
  enableCreatorRewards: boolean;
  connectedAt: number;
}

// Initialize Redis client
let redis: Redis | null = null;

function getRedisClient(): Redis {
  if (!redis) {
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;

    if (!url || !token) {
      throw new Error('Redis configuration missing');
    }

    redis = new Redis({ url, token });
  }
  return redis;
}

// POST endpoint to store wallet connection
export async function POST(request: NextRequest) {
  try {
    // Check Redis configuration
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const body = await request.json();
    const { fid, walletAddress, enableCreatorRewards = true } = body;

    // Validate required fields
    if (!fid || !walletAddress) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }

    // Validate wallet address format (basic Ethereum address validation)
    const walletAddressRegex = /^0x[a-fA-F0-9]{40}$/;
    if (!walletAddressRegex.test(walletAddress)) {
      return NextResponse.json(
        { error: 'Invalid wallet address format' },
        { status: 400 }
      );
    }

    // Store wallet data in Redis
    const redisClient = getRedisClient();
    const walletData: WalletData = {
      walletAddress,
      enableCreatorRewards,
      connectedAt: Date.now(),
    };

    const key = `wallet:${fid}`;
    await redisClient.set(key, walletData);
    
    // Set expiration to 7 days
    await redisClient.expire(key, 86400 * 7);

    return NextResponse.json({
      success: true,
      message: 'Wallet connected successfully',
    });
  } catch (error) {
    console.error('Error connecting wallet:', error);
    return NextResponse.json(
      { error: 'Failed to connect wallet' },
      { status: 500 }
    );
  }
}

// GET endpoint to retrieve wallet information
export async function GET(request: NextRequest) {
  try {
    // Check Redis configuration
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
      return NextResponse.json(
        { success: false, error: 'Server configuration error' },
        { status: 500 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const fid = searchParams.get('fid');

    if (!fid) {
      return NextResponse.json(
        { success: false, error: 'Missing fid parameter' },
        { status: 400 }
      );
    }

    // Retrieve wallet data from Redis
    const redisClient = getRedisClient();
    const key = `wallet:${fid}`;
    const walletData = await redisClient.get<WalletData>(key);

    if (!walletData) {
      return NextResponse.json(
        { success: false, error: 'Wallet not found' },
        { status: 404 }
      );
    }

    return NextResponse.json({
      success: true,
      data: walletData,
    });
  } catch (error) {
    console.error('Error retrieving wallet:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve wallet information' },
      { status: 500 }
    );
  }
}