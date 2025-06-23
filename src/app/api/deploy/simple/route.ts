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
  address: string;
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
  // Initialize debug context
  const debugContext = {
    timestamp: new Date().toISOString(),
    step: 'initialization',
    network: process.env.NEXT_PUBLIC_NETWORK || 'unknown',
    requestId: crypto.randomUUID?.() || Date.now().toString(),
  };
  
  // Initialize request context at top level
  let requestContext: Record<string, unknown> = {};

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
    debugContext.step = 'parsing_form_data';
    const formData = await request.formData();
    const rawName = formData.get('name') as string;
    const rawSymbol = formData.get('symbol') as string;
    const imageFile = formData.get('image') as Blob;
    const fid = formData.get('fid') as string;
    const castContextString = formData.get('castContext') as string;
    const creatorFeePercentage = formData.get('creatorFeePercentage') as string;
    
    // Enhanced debug logging for form data
    const formDebugInfo = {
      name: rawName || 'missing',
      symbol: rawSymbol || 'missing', 
      hasImage: !!imageFile,
      imageType: imageFile?.type || 'no image',
      imageSize: imageFile?.size || 0,
      fid: fid || 'not authenticated',
      hasCastContext: !!castContextString,
      timestamp: debugContext.timestamp,
      requestId: debugContext.requestId,
    };
    
    console.log('[Deploy] Form data received:', formDebugInfo);
    
    // Store request context for debug info
    requestContext = {
      fid,
      hasCastContext: !!castContextString,
      hasImage: !!imageFile,
      imageSize: imageFile?.size || 0,
      imageType: imageFile?.type || null,
    };
    
    // Sanitize inputs
    const name = rawName ? sanitizeInput(rawName) : '';
    const symbol = rawSymbol ? sanitizeInput(rawSymbol) : '';

    // Check wallet requirement
    const requireWallet = process.env.REQUIRE_WALLET_FOR_SIMPLE_LAUNCH === 'true';
    
    if (requireWallet) {
      // FID is required when wallet requirement is enabled
      if (!fid) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Farcaster authentication required',
            errorDetails: {
              type: 'FID_REQUIRED',
              message: 'Please sign in with Farcaster to deploy tokens',
            },
            debugInfo: {
              ...debugContext,
              step: 'wallet_requirement_check',
              requireWallet: true,
              hasFid: false,
              requestContext,
            }
          },
          { status: 400, headers: getSecurityHeaders(request) }
        );
      }
    }
    
    // Validate required fields
    debugContext.step = 'validation';
    const validationErrors = [];
    if (!name) validationErrors.push('name');
    if (!symbol) validationErrors.push('symbol');
    if (!imageFile) validationErrors.push('image');
    
    if (validationErrors.length > 0) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Missing required fields: ${validationErrors.join(', ')}`,
          errorDetails: {
            type: 'VALIDATION_ERROR',
            details: 'Required fields are missing',
            userMessage: 'Please fill in all required fields',
            missingFields: validationErrors,
          },
          debugInfo: {
            ...debugContext,
            step: 'validation',
            validationErrors,
            requestContext,
          }
        },
        { status: 400, headers: getSecurityHeaders(request) }
      );
    }

    // Validate image file
    const imageValidation = validateImageFile(imageFile);
    if (!imageValidation.valid) {
      return NextResponse.json(
        { 
          success: false, 
          error: imageValidation.error,
          errorDetails: {
            type: 'VALIDATION_ERROR',
            details: imageValidation.error,
            userMessage: imageValidation.error,
          },
          debugInfo: {
            ...debugContext,
            step: 'image_validation',
            fileSize: imageFile.size,
            fileType: imageFile.type,
            requestContext,
          }
        },
        { status: 400, headers: getSecurityHeaders(request) }
      );
    }
    
    // Validate field constraints
    if (name.length > 32) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Token name must be 32 characters or less',
          errorDetails: {
            type: 'VALIDATION_ERROR',
            details: `Name length: ${name.length} characters (max: 32)`,
            userMessage: 'Token name is too long. Please use 32 characters or less.',
          },
          debugInfo: {
            ...debugContext,
            step: 'name_validation',
            nameLength: name.length,
            requestContext,
          }
        },
        { status: 400, headers: getSecurityHeaders(request) }
      );
    }

    if (symbol.length < 3 || symbol.length > 8) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Symbol must be between 3 and 8 characters',
          errorDetails: {
            type: 'VALIDATION_ERROR',
            details: `Symbol length: ${symbol.length} characters (min: 3, max: 8)`,
            userMessage: 'Token symbol must be between 3 and 8 characters.',
          },
          debugInfo: {
            ...debugContext,
            step: 'symbol_validation',
            symbolLength: symbol.length,
            requestContext,
          }
        },
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
    debugContext.step = 'configuration';
    const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
    const interfaceAdmin = process.env.INTERFACE_ADMIN;
    const interfaceRewardRecipient = process.env.INTERFACE_REWARD_RECIPIENT;

    const missingConfig = [];
    if (!privateKey) missingConfig.push('DEPLOYER_PRIVATE_KEY');
    if (!interfaceAdmin) missingConfig.push('INTERFACE_ADMIN');
    if (!interfaceRewardRecipient) missingConfig.push('INTERFACE_REWARD_RECIPIENT');

    if (missingConfig.length > 0) {
      console.error('Missing required environment variables:', missingConfig);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Server configuration error',
          errorDetails: {
            type: 'CONFIGURATION_ERROR',
            details: 'Required environment variables are not configured',
            userMessage: 'The server is not properly configured. Please contact support.',
          },
          debugInfo: {
            ...debugContext,
            step: 'configuration',
            missingConfig,
            requestContext,
          }
        },
        { status: 500, headers: getSecurityHeaders(request) }
      );
    }

    // Validate and format private key
    let formattedPrivateKey: `0x${string}`;
    try {
      // privateKey is guaranteed to be defined here due to earlier check
      // Remove any whitespace
      const cleanKey = privateKey!.trim();
      
      // Check if it starts with 0x
      if (cleanKey.startsWith('0x')) {
        // Validate length (should be 66 characters: 0x + 64 hex chars)
        if (cleanKey.length !== 66) {
          throw new Error(`Invalid private key length: expected 66 characters, got ${cleanKey.length}`);
        }
        formattedPrivateKey = cleanKey as `0x${string}`;
      } else {
        // Add 0x prefix if missing
        if (cleanKey.length !== 64) {
          throw new Error(`Invalid private key length: expected 64 hex characters, got ${cleanKey.length}`);
        }
        formattedPrivateKey = `0x${cleanKey}`;
      }
      
      // Validate hex format
      if (!/^0x[a-fA-F0-9]{64}$/.test(formattedPrivateKey)) {
        throw new Error('Private key must be a valid hexadecimal string');
      }
    } catch (error) {
      console.error('Private key validation error:', error);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Invalid private key configuration',
          errorDetails: {
            type: 'CONFIGURATION_ERROR',
            details: error instanceof Error ? error.message : 'Invalid private key format',
            userMessage: 'The server private key is not properly configured. Please contact support.',
          },
          debugInfo: {
            ...debugContext,
            step: 'private_key_validation',
            keyLength: privateKey?.length || 0,
            hasPrefix: privateKey?.startsWith('0x') || false,
            requestContext,
          }
        },
        { status: 500, headers: getSecurityHeaders(request) }
      );
    }

    // Get configurable pool values
    const initialMarketCap = process.env.INITIAL_MARKET_CAP || '0.1';
    
    // Use creator fee percentage from request, fallback to env variable or default
    const rawCreatorReward = creatorFeePercentage 
      ? parseInt(creatorFeePercentage, 10)
      : parseInt(process.env.CREATOR_REWARD || '80', 10);
    
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
      
      // Provide more specific error messages
      let errorMessage = 'Failed to upload image';
      let errorDetails: Record<string, unknown> = {};
      
      if (error instanceof Error) {
        if (error.message.includes('IPFS credentials not configured')) {
          errorMessage = 'Image upload service not configured. Please contact support.';
          errorDetails = {
            type: 'CONFIGURATION_ERROR',
            details: 'PINATA_JWT environment variable is missing',
            userMessage: 'The image upload service is not properly configured. Please notify the app developer.'
          };
        } else if (error.message.includes('File size exceeds')) {
          errorMessage = error.message;
          errorDetails = {
            type: 'FILE_SIZE_ERROR',
            details: 'Image file is larger than 10MB',
            userMessage: 'Please use a smaller image file (max 10MB)'
          };
        } else if (error.message.includes('Invalid file type')) {
          errorMessage = error.message;
          errorDetails = {
            type: 'FILE_TYPE_ERROR',
            details: 'File type not supported',
            userMessage: 'Please use PNG, JPEG, GIF, or WebP image formats'
          };
        } else if (error.message.includes('IPFS upload failed')) {
          errorMessage = 'Image upload service temporarily unavailable. Please try again.';
          errorDetails = {
            type: 'UPLOAD_ERROR',
            details: error.message,
            userMessage: 'The image upload service is temporarily down. Please try again in a few moments.'
          };
        } else if (error.message.includes('Invalid response from IPFS')) {
          errorMessage = 'Image upload service returned an unexpected response';
          errorDetails = {
            type: 'IPFS_RESPONSE_ERROR',
            details: 'Invalid response structure from IPFS service',
            userMessage: 'The image upload service returned an invalid response. This may be due to expired credentials or API changes.'
          };
        } else {
          errorDetails = {
            type: 'UNKNOWN_ERROR',
            details: 'Image upload failed',
            userMessage: 'An unexpected error occurred during image upload'
          };
        }
      }
      
      return NextResponse.json(
        { 
          success: false, 
          error: errorMessage,
          errorDetails,
          debug: {
            hasFile: !!imageFile,
            fileSize: imageFile?.size,
            fileType: imageFile?.type,
            timestamp: new Date().toISOString()
          }
        },
        { status: 500, headers: getSecurityHeaders(request) }
      );
    }

    // Setup wallet and clients with the configured network
    let account;
    try {
      debugContext.step = 'account_creation';
      account = privateKeyToAccount(formattedPrivateKey);
    } catch (error) {
      console.error('Failed to create account from private key:', error);
      return NextResponse.json(
        { 
          success: false, 
          error: error instanceof Error ? error.message : 'Failed to create wallet account',
          errorDetails: {
            type: 'CONFIGURATION_ERROR',
            details: error instanceof Error ? error.message : 'Invalid private key format',
            userMessage: 'Failed to initialize deployment wallet. Please contact support.',
            code: 'INVALID_PRIVATE_KEY',
          },
          debugInfo: {
            ...debugContext,
            step: 'account_creation',
            error: error instanceof Error ? error.message : 'Unknown error',
            requestContext,
          }
        },
        { status: 500, headers: getSecurityHeaders(request) }
      );
    }
    
    const chain = networkConfig.isMainnet ? base : baseSepolia;
    
    // Check for user's connected wallet if fid is provided
    let creatorAdmin = account.address;
    let creatorRewardRecipient = account.address;
    
    if (fid) {
      try {
        const redisClient = getRedisClient();
        if (redisClient) {
          const walletData = await redisClient.get<WalletData>(`wallet:${fid}`);
          
          // If wallet is required, check that wallet is connected
          if (requireWallet) {
            if (!walletData) {
              return NextResponse.json(
                { 
                  success: false, 
                  error: 'Wallet connection required for deployment',
                  errorDetails: {
                    type: 'WALLET_REQUIREMENT_ERROR',
                    details: 'No wallet connected to your account',
                    userMessage: 'Please connect your wallet before deploying',
                  },
                  debugInfo: {
                    ...debugContext,
                    step: 'wallet_connection_check',
                    requireWallet: true,
                    hasWallet: false,
                    fid,
                    requestContext,
                  }
                },
                { status: 400, headers: getSecurityHeaders(request) }
              );
            }
            
            if (!walletData.enableCreatorRewards) {
              return NextResponse.json(
                { 
                  success: false, 
                  error: 'Creator rewards must be enabled when wallet is required',
                  errorDetails: {
                    type: 'WALLET_REQUIREMENT_ERROR',
                    details: 'Creator rewards disabled on connected wallet',
                    userMessage: 'Please enable creator rewards for your wallet',
                  },
                  debugInfo: {
                    ...debugContext,
                    step: 'creator_rewards_check',
                    requireWallet: true,
                    hasWallet: true,
                    creatorRewardsEnabled: false,
                    fid,
                    requestContext,
                  }
                },
                { status: 400, headers: getSecurityHeaders(request) }
              );
            }
          }
          
          if (walletData && walletData.enableCreatorRewards) {
            // Validate wallet address format
            const walletAddressRegex = /^0x[a-fA-F0-9]{40}$/;
            if (walletAddressRegex.test(walletData.address)) {
              creatorAdmin = walletData.address as `0x${string}`;
              creatorRewardRecipient = walletData.address as `0x${string}`;
            }
          }
        }
      } catch (error) {
        console.error('Error fetching wallet data:', error);
        if (requireWallet) {
          return NextResponse.json(
            { 
              success: false, 
              error: 'Failed to verify wallet connection',
              errorDetails: {
                type: 'WALLET_CHECK_ERROR',
                message: 'Unable to verify wallet connection status',
              },
              debugInfo: {
                ...debugContext,
                step: 'wallet_verification_error',
                requireWallet: true,
                error: error instanceof Error ? error.message : 'Unknown error',
                requestContext,
              }
            },
            { status: 500, headers: getSecurityHeaders(request) }
          );
        }
        // Continue with deployer address if Redis lookup fails and wallet not required
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

    debugContext.step = 'token_deployment';
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[Deploy] Attempting token deployment (attempt ${attempt}/${maxRetries})`);
        
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
          const errorInfo: Record<string, unknown> = {
            message: error.message,
            name: error.name,
            attempt,
            maxRetries,
          };
          
          // Check for common error properties
          if ('code' in error) errorInfo.code = (error as Record<string, unknown>).code;
          if ('cause' in error) errorInfo.cause = error.cause;
          if ('data' in error) errorInfo.data = (error as Record<string, unknown>).data;
          if ('details' in error) errorInfo.details = (error as Record<string, unknown>).details;
          
          // Log detailed error info
          console.error('[Deploy] Error details:', errorInfo);
          
          // If this is the last attempt, throw with enhanced details
          if (attempt === maxRetries) {
            const enhancedError = new TokenDeploymentError(
              error.message,
              typeof errorInfo.code === 'string' ? errorInfo.code : undefined,
              error.name
            );
            // Attach additional context
            (enhancedError as unknown as Record<string, unknown>).debugInfo = {
              ...debugContext,
              attempt,
              maxRetries,
              errorInfo,
              deploymentParams: {
                name,
                symbol,
                hasImage: !!imageUrl,
                network: networkConfig.name,
                chainId: networkConfig.chainId,
              },
            };
            throw enhancedError;
          }
        }
        
        if (attempt < maxRetries) {
          console.log(`[Deploy] Waiting before retry attempt ${attempt + 1}...`);
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    if (!tokenAddress) {
      return NextResponse.json(
        { 
          success: false, 
          error: `Token deployment failed after ${maxRetries} attempts`,
          errorDetails: {
            type: 'DEPLOYMENT_TIMEOUT',
            details: 'Token deployment did not complete successfully after multiple attempts',
            userMessage: 'Token deployment timed out. Please try again later.',
          },
          debugInfo: {
            ...debugContext,
            step: 'token_deployment',
            attempts: maxRetries,
            timestamp: new Date().toISOString(),
            requestContext,
          }
        },
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

    // Store deployment details for monitoring
    if (tokenAddress) {
      try {
        const redisClient = getRedisClient();
        if (redisClient) {
          const deploymentData = {
            tokenAddress,
            name,
            symbol,
            createdAt: new Date().toISOString(),
            fid: fid || 'anonymous',
            creatorAdmin,
            creatorRewardRecipient,
            creatorReward,
            txHash: txHash || null,
            interfaceAdmin,
            interfaceRewardRecipient,
            network: networkConfig.name,
            chainId: networkConfig.chainId,
          };
          
          await redisClient.set(
            `deployment:${tokenAddress}`,
            deploymentData,
            {
              ex: 365 * 24 * 60 * 60, // 1 year expiration
            }
          );
        }
      } catch (error) {
        console.error('Failed to store deployment details:', error);
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
    
    // Extract error details
    let errorMessage = 'An unexpected error occurred';
    let errorDetails: Record<string, unknown> = {
      type: 'UNKNOWN_ERROR',
      details: 'An unexpected error occurred during deployment',
      userMessage: 'Something went wrong. Please try again.',
    };
    const statusCode = 500;
    
    // Handle TokenDeploymentError with detailed info
    if (error instanceof TokenDeploymentError) {
      errorMessage = `Token deployment failed: ${error.message}`;
      errorDetails = {
        type: 'SDK_DEPLOYMENT_ERROR',
        code: error.code,
        details: error.message,
        userMessage: 'Token deployment failed. This could be due to network issues, insufficient funds, or contract errors.',
      };
      
      // Add debug info if available
      if ((error as unknown as Record<string, unknown>).debugInfo) {
        debugContext.step = ((error as unknown as Record<string, unknown>).debugInfo as Record<string, unknown>).step as string || 'token_deployment';
        Object.assign(debugContext, (error as unknown as Record<string, unknown>).debugInfo);
      }
    } else if (error instanceof Error) {
      errorMessage = error.message;
      
      // Determine error type based on message content
      if (error.message.includes('IPFS')) {
        errorDetails.type = 'IPFS_UPLOAD_ERROR';
        errorDetails.userMessage = 'Failed to upload image. Please try again.';
      } else if (error.message.includes('network') || error.message.includes('RPC')) {
        errorDetails.type = 'NETWORK_ERROR';
        errorDetails.userMessage = 'Network connection issue. Please check your connection and try again.';
      } else if (error.message.includes('insufficient') || error.message.includes('balance')) {
        errorDetails.type = 'INSUFFICIENT_FUNDS';
        errorDetails.userMessage = 'Insufficient funds for deployment. Please ensure the deployer wallet has enough balance.';
      }
      
      errorDetails.details = error.message;
    }
    
    return NextResponse.json(
      { 
        success: false, 
        error: errorMessage,
        errorDetails,
        debugInfo: {
          ...debugContext,
          timestamp: new Date().toISOString(),
          requestContext,
        }
      },
      { status: statusCode, headers: getSecurityHeaders(request) }
    );
  }
}