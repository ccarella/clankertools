import { NextRequest, NextResponse } from 'next/server';
import { Redis } from '@upstash/redis';
import { verifyFarcasterAuth, securityHeaders } from '@/lib/security/auth-middleware';
import { validateInput, schemas } from '@/lib/security/input-validation';
import { rateLimiters } from '@/lib/security/rate-limiter';
import { z } from 'zod';

interface WalletData {
  address: string;
  enableCreatorRewards: boolean;
  connectedAt: number;
}

// Validation schema for POST request
const connectWalletSchema = z.object({
  fid: schemas.fid,
  walletAddress: schemas.walletAddress,
  enableCreatorRewards: z.boolean().optional().default(true),
});

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
    // Apply rate limiting
    const rateLimitResult = await rateLimiters.api.middleware(request);
    if (rateLimitResult) {
      return rateLimitResult;
    }

    // Verify authentication
    const authResult = await verifyFarcasterAuth(request, { requireAuth: true });
    if (authResult) {
      return authResult;
    }

    // Check Redis configuration
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
      return NextResponse.json(
        { error: 'Server configuration error' },
        { status: 500, headers: securityHeaders() }
      );
    }

    const body = await request.json();
    
    // Validate input
    const validation = validateInput(body, connectWalletSchema);
    if (!validation.success) {
      return NextResponse.json(
        { error: 'Validation failed', details: validation.errors },
        { status: 400, headers: securityHeaders() }
      );
    }

    const { fid, walletAddress, enableCreatorRewards } = validation.data;

    // TODO: Verify that the requesting user actually owns this FID
    // This would require implementing Farcaster signature verification

    // Store wallet data in Redis
    const redisClient = getRedisClient();
    const walletData: WalletData = {
      address: walletAddress,
      enableCreatorRewards: enableCreatorRewards ?? true,
      connectedAt: Date.now(),
    };

    const key = `wallet:${fid}`;
    await redisClient.set(key, walletData);
    
    // Set expiration to 7 days
    await redisClient.expire(key, 86400 * 7);

    return NextResponse.json({
      success: true,
      message: 'Wallet connected successfully',
    }, { headers: securityHeaders() });
  } catch (error) {
    console.error('Error connecting wallet:', error);
    return NextResponse.json(
      { error: 'Failed to connect wallet' },
      { status: 500, headers: securityHeaders() }
    );
  }
}

// GET endpoint to retrieve wallet information
export async function GET(request: NextRequest) {
  try {
    // Apply rate limiting
    const rateLimitResult = await rateLimiters.api.middleware(request);
    if (rateLimitResult) {
      return rateLimitResult;
    }

    // Verify authentication
    const authResult = await verifyFarcasterAuth(request, { requireAuth: true });
    if (authResult) {
      return authResult;
    }

    // Check Redis configuration
    if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
      return NextResponse.json(
        { success: false, error: 'Server configuration error' },
        { status: 500, headers: securityHeaders() }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const fid = searchParams.get('fid');

    // Validate FID
    const fidValidation = validateInput(fid, schemas.fid);
    if (!fidValidation.success) {
      return NextResponse.json(
        { success: false, error: 'Invalid FID format' },
        { status: 400, headers: securityHeaders() }
      );
    }

    // TODO: Verify that the requesting user owns this FID or has permission to view it

    // Retrieve wallet data from Redis
    const redisClient = getRedisClient();
    const key = `wallet:${fid}`;
    const walletData = await redisClient.get<WalletData>(key);

    if (!walletData) {
      return NextResponse.json(
        { success: false, error: 'Wallet not found' },
        { status: 404, headers: securityHeaders() }
      );
    }

    return NextResponse.json({
      success: true,
      data: walletData,
    }, { headers: securityHeaders() });
  } catch (error) {
    console.error('Error retrieving wallet:', error);
    return NextResponse.json(
      { success: false, error: 'Failed to retrieve wallet information' },
      { status: 500, headers: securityHeaders() }
    );
  }
}