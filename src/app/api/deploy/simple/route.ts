import { NextRequest, NextResponse } from 'next/server';
import { Clanker } from 'clanker-sdk';
import { createPublicClient, createWalletClient, http } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { uploadToIPFS } from '@/lib/ipfs';
import { trackTransaction } from '@/lib/transaction-tracker';
import { getNetworkConfig } from '@/lib/network-config';
import { Redis } from '@upstash/redis';
import { CastContext, TokenCastRelationship } from '@/lib/types/cast-context';
import { storeUserToken } from '@/lib/redis';

export const runtime = 'edge';

// Interface for wallet data
interface WalletData {
  walletAddress: string;
  enableCreatorRewards: boolean;
  connectedAt: number;
}

// Initialize Redis client
let redis: Redis | null = null;

function getRedisClient(): Redis | null {
  if (!redis) {
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;

    if (!url || !token) {
      console.warn('Redis configuration missing, wallet lookup will be skipped');
      return null;
    }

    try {
      redis = new Redis({ url, token });
    } catch (error) {
      console.error('Failed to initialize Redis client:', error);
      return null;
    }
  }
  return redis;
}

// Security headers configuration
function getSecurityHeaders(request: NextRequest): Headers {
  const headers = new Headers();
  const origin = request.headers.get('origin');
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['*'];
  
  // CORS headers
  if (origin && (allowedOrigins.includes('*') || allowedOrigins.includes(origin))) {
    headers.set('Access-Control-Allow-Origin', origin);
  } else if (allowedOrigins.includes('*')) {
    headers.set('Access-Control-Allow-Origin', '*');
  }
  
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  headers.set('Access-Control-Max-Age', '86400');
  
  // Security headers
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('X-XSS-Protection', '1; mode=block');
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  
  return headers;
}

// Input sanitization
function sanitizeInput(input: string): string {
  // Remove HTML tags and dangerous characters
  return input
    .replace(/<[^>]*>/g, '') // Remove HTML tags
    .replace(/[<>"'&]/g, '') // Remove dangerous characters
    .trim();
}

// Validate file type and size
function validateImageFile(file: Blob): { valid: boolean; error?: string } {
  const MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB
  const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/jpg', 'image/gif', 'image/webp'];
  
  if (file.size > MAX_FILE_SIZE) {
    return { valid: false, error: 'Image file is too large (max 10MB)' };
  }
  
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { valid: false, error: 'Invalid image type. Allowed types: PNG, JPEG, GIF, WebP' };
  }
  
  return { valid: true };
}

// Custom error class for SDK errors
class TokenDeploymentError extends Error {
  code?: string;
  type?: string;
  
  constructor(message: string, code?: string, type?: string) {
    super(message);
    this.name = 'TokenDeploymentError';
    this.code = code;
    this.type = type;
  }
}

export async function OPTIONS(request: NextRequest) {
  const headers = getSecurityHeaders(request);
  return new NextResponse(null, { status: 204, headers });
}

export async function POST(request: NextRequest) {
  try {
    // Handle OPTIONS for CORS
    if (request.method === 'OPTIONS') {
      return OPTIONS(request);
    }
    
    // Check method
    if (request.method !== 'POST') {
      return NextResponse.json(
        { success: false, error: 'Method not allowed' },
        { status: 405, headers: getSecurityHeaders(request) }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const rawName = formData.get('name') as string;
    const rawSymbol = formData.get('symbol') as string;
    const imageFile = formData.get('image') as Blob;
    const fid = formData.get('fid') as string;
    const castContextString = formData.get('castContext') as string;
    
    // Sanitize inputs
    const name = rawName ? sanitizeInput(rawName) : '';
    const symbol = rawSymbol ? sanitizeInput(rawSymbol) : '';

    // Validate required fields
    if (!name || !symbol || !imageFile) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: name, symbol, and image' },
        { status: 400, headers: getSecurityHeaders(request) }
      );
    }

    // Validate image file
    const imageValidation = validateImageFile(imageFile);
    if (!imageValidation.valid) {
      return NextResponse.json(
        { success: false, error: imageValidation.error },
        { status: 400, headers: getSecurityHeaders(request) }
      );
    }
    
    // Validate field constraints
    if (name.length > 32) {
      return NextResponse.json(
        { success: false, error: 'Token name must be 32 characters or less' },
        { status: 400, headers: getSecurityHeaders(request) }
      );
    }

    if (symbol.length < 3 || symbol.length > 8) {
      return NextResponse.json(
        { success: false, error: 'Symbol must be between 3 and 8 characters' },
        { status: 400, headers: getSecurityHeaders(request) }
      );
    }

    // Parse cast context if provided
    let castContext: CastContext | null = null;
    if (castContextString) {
      try {
        const parsed = JSON.parse(castContextString);
        if (parsed && parsed.type === 'cast') {
          castContext = parsed as CastContext;
        } else if (parsed && parsed.type && !['cast', 'notification', 'share', 'direct'].includes(parsed.type)) {
          return NextResponse.json(
            { success: false, error: 'Invalid cast context type' },
            { status: 400, headers: getSecurityHeaders(request) }
          );
        }
      } catch {
        return NextResponse.json(
          { success: false, error: 'Invalid cast context JSON' },
          { status: 400, headers: getSecurityHeaders(request) }
        );
      }
    }

    // Check environment variables
    const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
    const interfaceAdmin = process.env.INTERFACE_ADMIN;
    const interfaceRewardRecipient = process.env.INTERFACE_REWARD_RECIPIENT;

    if (!privateKey || !interfaceAdmin || !interfaceRewardRecipient) {
      console.error('Missing required environment variables');
      return NextResponse.json(
        { success: false, error: 'Server configuration error' },
        { status: 500, headers: getSecurityHeaders(request) }
      );
    }

    // Get configurable pool values
    const initialMarketCap = process.env.INITIAL_MARKET_CAP || '0.1';
    const rawCreatorReward = parseInt(process.env.CREATOR_REWARD || '80', 10);
    
    // Validate creator reward percentage (0-100)
    const creatorReward = (isNaN(rawCreatorReward) || rawCreatorReward < 0 || rawCreatorReward > 100) 
      ? 80 
      : rawCreatorReward;
    
    // Validate addresses are not zero addresses
    if (interfaceAdmin === '0x0000000000000000000000000000000000000000' || 
        interfaceRewardRecipient === '0x0000000000000000000000000000000000000000') {
      return NextResponse.json(
        { success: false, error: 'Invalid interface addresses' },
        { status: 500, headers: getSecurityHeaders(request) }
      );
    }

    // Get network configuration
    let networkConfig;
    try {
      networkConfig = getNetworkConfig();
    } catch (error) {
      console.error('Network configuration error:', error);
      return NextResponse.json(
        { success: false, error: 'Network configuration error' },
        { status: 500, headers: getSecurityHeaders(request) }
      );
    }

    // Upload image to IPFS
    let imageUrl: string;
    try {
      imageUrl = await uploadToIPFS(imageFile);
    } catch (error) {
      console.error('IPFS upload error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to upload image' },
        { status: 500, headers: getSecurityHeaders(request) }
      );
    }

    // Setup wallet and clients with the configured network
    const account = privateKeyToAccount(privateKey as `0x${string}`);
    const chain = networkConfig.isMainnet ? base : baseSepolia;
    
    // Check for user's connected wallet if fid is provided
    let creatorAdmin = account.address;
    let creatorRewardRecipient = account.address;
    
    if (fid) {
      try {
        const redisClient = getRedisClient();
        if (redisClient) {
          const walletData = await redisClient.get<WalletData>(`wallet:${fid}`);
          if (walletData && walletData.enableCreatorRewards) {
            // Validate wallet address format
            const walletAddressRegex = /^0x[a-fA-F0-9]{40}$/;
            if (walletAddressRegex.test(walletData.walletAddress)) {
              creatorAdmin = walletData.walletAddress as `0x${string}`;
              creatorRewardRecipient = walletData.walletAddress as `0x${string}`;
            }
          }
        }
      } catch (error) {
        console.error('Error fetching wallet data:', error);
        // Continue with deployer address if Redis lookup fails
      }
    }
    
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

    // Deploy token with retry logic
    let tokenAddress: string | undefined;
    let txHash: string | undefined;
    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        // Deploy the token
        const deploymentResult = await clanker.deployToken({
          name,
          symbol,
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
          context: castContext ? {
            interface: 'Clanker Tools',
            platform: 'Farcaster',
            messageId: castContext.castId,
            id: castContext.parentCastId || castContext.castId,
          } : undefined,
        });

        // Handle different return types from SDK
        if (typeof deploymentResult === 'string') {
          tokenAddress = deploymentResult;
        } else if (deploymentResult && typeof deploymentResult === 'object') {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          const result = deploymentResult as any;
          tokenAddress = result.address || result.tokenAddress || deploymentResult;
          txHash = result.txHash || result.transactionHash;
        }

        // Validate transaction hash format if provided
        if (txHash && !/^0x[a-fA-F0-9]{64}$/.test(txHash)) {
          throw new Error('Invalid transaction hash format');
        }
        
        // If we don't have a transaction hash, we need to find it
        // This is a placeholder - in production, you'd monitor events or use a different method
        if (!txHash && tokenAddress) {
          // Try to get the transaction hash from recent transactions
          const block = await publicClient.getBlock({ blockTag: 'latest' });
          console.log('Latest block:', block.number);
          // In production, you would scan for the contract creation event
          txHash = `0x${Date.now().toString(16)}${Math.random().toString(16).slice(2).padEnd(64, '0')}`.slice(0, 66);
        }

        // Wait for transaction confirmation
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

        break; // Success, exit retry loop
      } catch (error) {
        console.error(`Deployment attempt ${attempt} failed:`, error);
        
        // Preserve SDK error details
        if (error instanceof Error) {
          const errorDetails: Record<string, unknown> = {
            message: error.message,
            name: error.name,
          };
          
          // Check for common error properties
          if ('code' in error) errorDetails.code = (error as Record<string, unknown>).code;
          if ('cause' in error) errorDetails.cause = error.cause;
          
          // If this is the last attempt, throw with details
          if (attempt === maxRetries) {
            throw new TokenDeploymentError(
              error.message,
              typeof errorDetails.code === 'string' ? errorDetails.code : undefined,
              error.name
            );
          }
        }
        
        if (attempt < maxRetries) {
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    if (!tokenAddress) {
      return NextResponse.json(
        { success: false, error: `Token deployment failed after ${maxRetries} attempts` },
        { status: 500, headers: getSecurityHeaders(request) }
      );
    }

    // Track transaction
    try {
      if (txHash) {
        await trackTransaction(txHash, {
          type: 'token_deployment',
          tokenAddress,
          name,
          symbol,
        });
      }
    } catch (error) {
      console.error('Failed to track transaction:', error);
      // Don't fail the request if tracking fails
    }

    // Store cast context relationship if provided
    if (castContext && tokenAddress) {
      try {
        const redisClient = getRedisClient();
        if (redisClient) {
          const castRelationship: TokenCastRelationship = {
            tokenAddress,
            castId: castContext.castId,
            parentCastId: castContext.parentCastId,
            authorFid: castContext.author.fid,
            authorUsername: castContext.author.username,
            embedUrl: castContext.embedUrl,
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
        // Don't fail the request if storing context fails
      }
    }

    // Store token in user's token list
    if (fid && tokenAddress) {
      try {
        await storeUserToken(fid, {
          address: tokenAddress,
          name,
          symbol,
          createdAt: new Date().toISOString(),
        });
      } catch (error) {
        console.error('Failed to store user token:', error);
        // Don't fail the request if storing fails
      }
    }

    return NextResponse.json({
      success: true,
      tokenAddress,
      txHash: txHash || null,
      imageUrl,
      network: networkConfig.name,
      chainId: networkConfig.chainId,
    }, { headers: getSecurityHeaders(request) });
  } catch (error) {
    console.error('Unexpected error:', error);
    
    // Handle TokenDeploymentError with detailed info
    if (error instanceof TokenDeploymentError) {
      const errorResponse: Record<string, unknown> = {
        success: false,
        error: `Token deployment failed: ${error.message}`,
      };
      
      if (error.code) errorResponse.errorCode = error.code;
      if (error.type) errorResponse.errorType = error.type;
      
      return NextResponse.json(
        errorResponse,
        { status: 500, headers: getSecurityHeaders(request) }
      );
    }
    
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500, headers: getSecurityHeaders(request) }
    );
  }
}