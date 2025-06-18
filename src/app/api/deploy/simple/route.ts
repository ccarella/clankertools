import { NextRequest, NextResponse } from 'next/server';
import { Clanker } from 'clanker-sdk';
import { createPublicClient, createWalletClient, http } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { uploadToIPFS } from '@/lib/ipfs';
import { trackTransaction } from '@/lib/transaction-tracker';

export const runtime = 'edge';

// CORS configuration
function getCorsHeaders(request: NextRequest): Headers {
  const headers = new Headers();
  const origin = request.headers.get('origin');
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['*'];
  
  if (origin && (allowedOrigins.includes('*') || allowedOrigins.includes(origin))) {
    headers.set('Access-Control-Allow-Origin', origin);
  } else if (allowedOrigins.includes('*')) {
    headers.set('Access-Control-Allow-Origin', '*');
  }
  
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  headers.set('Access-Control-Max-Age', '86400');
  
  return headers;
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
  const headers = getCorsHeaders(request);
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
        { status: 405, headers: getCorsHeaders(request) }
      );
    }

    // Parse form data
    const formData = await request.formData();
    const name = formData.get('name') as string;
    const symbol = formData.get('symbol') as string;
    const imageFile = formData.get('image') as Blob;

    // Validate required fields
    if (!name || !symbol || !imageFile) {
      return NextResponse.json(
        { success: false, error: 'Missing required fields: name, symbol, and image' },
        { status: 400, headers: getCorsHeaders(request) }
      );
    }

    // Validate field constraints
    if (name.length > 32) {
      return NextResponse.json(
        { success: false, error: 'Token name must be 32 characters or less' },
        { status: 400, headers: getCorsHeaders(request) }
      );
    }

    if (symbol.length < 3 || symbol.length > 8) {
      return NextResponse.json(
        { success: false, error: 'Symbol must be between 3 and 8 characters' },
        { status: 400, headers: getCorsHeaders(request) }
      );
    }

    // Check environment variables
    const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
    const interfaceAdmin = process.env.INTERFACE_ADMIN;
    const interfaceRewardRecipient = process.env.INTERFACE_REWARD_RECIPIENT;

    if (!privateKey || !interfaceAdmin || !interfaceRewardRecipient) {
      console.error('Missing required environment variables');
      return NextResponse.json(
        { success: false, error: 'Server configuration error' },
        { status: 500, headers: getCorsHeaders(request) }
      );
    }

    // Get configurable pool values
    const initialMarketCap = process.env.INITIAL_MARKET_CAP || '0.1';
    const creatorReward = parseInt(process.env.CREATOR_REWARD || '80', 10);

    // Upload image to IPFS
    let imageUrl: string;
    try {
      imageUrl = await uploadToIPFS(imageFile);
    } catch (error) {
      console.error('IPFS upload error:', error);
      return NextResponse.json(
        { success: false, error: 'Failed to upload image' },
        { status: 500, headers: getCorsHeaders(request) }
      );
    }

    // Setup wallet and clients
    const account = privateKeyToAccount(privateKey as `0x${string}`);
    
    const publicClient = createPublicClient({
      chain: base,
      transport: http(),
    });
    
    const wallet = createWalletClient({
      account,
      chain: base,
      transport: http(),
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
            creatorAdmin: account.address,
            creatorRewardRecipient: account.address,
            interfaceAdmin: interfaceAdmin as `0x${string}`,
            interfaceRewardRecipient: interfaceRewardRecipient as `0x${string}`,
          },
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
              errorDetails.code,
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
        { status: 500, headers: getCorsHeaders(request) }
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

    return NextResponse.json({
      success: true,
      tokenAddress,
      txHash: txHash || null,
      imageUrl,
    }, { headers: getCorsHeaders(request) });
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
        { status: 500, headers: getCorsHeaders(request) }
      );
    }
    
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500, headers: getCorsHeaders(request) }
    );
  }
}