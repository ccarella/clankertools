import { NextRequest, NextResponse } from 'next/server';
import { Clanker } from 'clanker-sdk';
import { createPublicClient, createWalletClient, http } from 'viem';
import { base, baseSepolia } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { uploadToIPFS } from '@/lib/ipfs';
import { trackTransaction } from '@/lib/transaction-tracker';
import { getNetworkConfig } from '@/lib/network-config';
import { Redis } from '@upstash/redis';
import { storeUserToken } from '@/lib/redis';

export const runtime = 'edge';

// Interface for team member data
interface TeamMember {
  address: string;
  percentage: number;
  role: string;
  vestingMonths: number;
  cliffMonths?: number;
}

// Interface for treasury allocation
interface TreasuryAllocation {
  percentage: number;
  address: string;
  vestingMonths?: number;
}

// Initialize Redis client
let redis: Redis | null = null;

function getRedisClient(): Redis | null {
  if (!redis) {
    const url = process.env.KV_REST_API_URL;
    const token = process.env.KV_REST_API_TOKEN;

    if (!url || !token) {
      console.warn('Redis configuration missing');
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

// Validate Ethereum address
function isValidAddress(address: string): boolean {
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

// Validate team member data
function validateTeamMember(member: TeamMember, index: number): string | null {
  if (!isValidAddress(member.address)) {
    return `Invalid team member address at index ${index}`;
  }

  if (member.percentage < 0.1) {
    return 'Minimum allocation is 0.1%';
  }

  if (member.percentage > 100) {
    return 'Percentage cannot exceed 100%';
  }

  if (!member.role || member.role.length === 0) {
    return 'Role is required';
  }

  if (member.role.length > 50) {
    return 'Role must be 50 characters or less';
  }

  if (member.vestingMonths < 0) {
    return 'Invalid vesting period';
  }

  if (member.vestingMonths > 60) {
    return 'Maximum vesting period is 60 months';
  }

  if (member.cliffMonths !== undefined) {
    if (member.cliffMonths < 0) {
      return 'Invalid cliff period';
    }
    if (member.cliffMonths > member.vestingMonths) {
      return 'Cliff period cannot exceed vesting period';
    }
  }

  return null;
}

export async function OPTIONS(request: NextRequest) {
  const headers = getSecurityHeaders(request);
  return new NextResponse(null, { status: 204, headers });
}

export async function POST(request: NextRequest) {
  try {
    // Parse form data
    const formData = await request.formData();
    const rawName = formData.get('name') as string;
    const rawSymbol = formData.get('symbol') as string;
    const imageFile = formData.get('image') as Blob;
    const fid = formData.get('fid') as string;
    const teamMembersString = formData.get('teamMembers') as string;
    const treasuryPercentageString = formData.get('treasuryPercentage') as string;
    const treasuryAddress = formData.get('treasuryAddress') as string;
    const treasuryVestingMonthsString = formData.get('treasuryVestingMonths') as string;

    // Check authentication - require fid
    if (!fid) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Authentication required'
        },
        { status: 401, headers: getSecurityHeaders(request) }
      );
    }

    // Sanitize inputs
    const name = rawName ? sanitizeInput(rawName) : '';
    const symbol = rawSymbol ? sanitizeInput(rawSymbol) : '';

    // Validate required fields
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
          }
        },
        { status: 400, headers: getSecurityHeaders(request) }
      );
    }

    // Parse team members
    let teamMembers: TeamMember[] = [];
    if (teamMembersString) {
      try {
        teamMembers = JSON.parse(teamMembersString);
        if (!Array.isArray(teamMembers)) {
          throw new Error('Team members must be an array');
        }
      } catch {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Invalid team members data',
            errorDetails: {
              type: 'VALIDATION_ERROR',
              details: 'Team members JSON is invalid',
              userMessage: 'Invalid team members data format',
            }
          },
          { status: 400, headers: getSecurityHeaders(request) }
        );
      }
    }

    // Validate team member count
    if (teamMembers.length > 10) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Maximum 10 team members allowed',
          errorDetails: {
            type: 'VALIDATION_ERROR',
            details: `Team member count: ${teamMembers.length}`,
            userMessage: 'You can have a maximum of 10 team members',
            teamMemberCount: teamMembers.length,
          }
        },
        { status: 400, headers: getSecurityHeaders(request) }
      );
    }

    // Validate each team member
    const memberAddresses = new Set<string>();
    for (let i = 0; i < teamMembers.length; i++) {
      const member = teamMembers[i];
      
      // Check for required fields
      if (!member.address || member.percentage === undefined || !member.role || member.vestingMonths === undefined) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Invalid team member data',
            errorDetails: {
              type: 'VALIDATION_ERROR',
              details: `Missing required fields for team member at index ${i}`,
              userMessage: 'All team members must have address, percentage, role, and vesting months',
            }
          },
          { status: 400, headers: getSecurityHeaders(request) }
        );
      }

      // Validate member data
      const validationError = validateTeamMember(member, i);
      if (validationError) {
        return NextResponse.json(
          { 
            success: false, 
            error: validationError,
            errorDetails: {
              type: 'VALIDATION_ERROR',
              details: validationError,
              userMessage: validationError,
            }
          },
          { status: 400, headers: getSecurityHeaders(request) }
        );
      }

      // Check for duplicate addresses
      const normalizedAddress = member.address.toLowerCase();
      if (memberAddresses.has(normalizedAddress)) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Duplicate team member address',
            errorDetails: {
              type: 'VALIDATION_ERROR',
              details: `Duplicate address: ${member.address}`,
              userMessage: 'Each team member must have a unique address',
            }
          },
          { status: 400, headers: getSecurityHeaders(request) }
        );
      }
      memberAddresses.add(normalizedAddress);
    }

    // Parse treasury allocation
    let treasuryAllocation: TreasuryAllocation | null = null;
    const treasuryPercentage = treasuryPercentageString ? parseFloat(treasuryPercentageString) : 0;
    
    if (treasuryPercentage > 0) {
      if (!treasuryAddress || !isValidAddress(treasuryAddress)) {
        return NextResponse.json(
          { 
            success: false, 
            error: 'Invalid treasury address',
            errorDetails: {
              type: 'VALIDATION_ERROR',
              details: 'Treasury address is required when treasury percentage is set',
              userMessage: 'Please provide a valid treasury address',
            }
          },
          { status: 400, headers: getSecurityHeaders(request) }
        );
      }

      treasuryAllocation = {
        percentage: treasuryPercentage,
        address: treasuryAddress,
      };

      if (treasuryVestingMonthsString) {
        const vestingMonths = parseInt(treasuryVestingMonthsString, 10);
        if (isNaN(vestingMonths) || vestingMonths < 0 || vestingMonths > 60) {
          return NextResponse.json(
            { 
              success: false, 
              error: 'Invalid treasury vesting period',
              errorDetails: {
                type: 'VALIDATION_ERROR',
                details: 'Treasury vesting must be between 0 and 60 months',
                userMessage: 'Treasury vesting period must be between 0 and 60 months',
              }
            },
            { status: 400, headers: getSecurityHeaders(request) }
          );
        }
        treasuryAllocation.vestingMonths = vestingMonths;
      }
    }

    // Calculate total allocation
    const teamAllocation = teamMembers.reduce((sum, member) => sum + member.percentage, 0);
    const totalAllocation = teamAllocation + treasuryPercentage;

    if (totalAllocation > 100) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Total allocation exceeds 100%',
          errorDetails: {
            type: 'VALIDATION_ERROR',
            details: `Total allocation: ${totalAllocation}% (team: ${teamAllocation}%, treasury: ${treasuryPercentage}%)`,
            userMessage: 'The combined team and treasury allocation cannot exceed 100%',
            totalAllocation,
            teamAllocation,
            treasuryPercentage,
          }
        },
        { status: 400, headers: getSecurityHeaders(request) }
      );
    }

    // Check environment variables
    const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
    const interfaceAdmin = process.env.INTERFACE_ADMIN;
    const interfaceRewardRecipient = process.env.INTERFACE_REWARD_RECIPIENT;

    if (!privateKey || !interfaceAdmin || !interfaceRewardRecipient) {
      console.error('Missing required environment variables');
      return NextResponse.json(
        { 
          success: false, 
          error: 'Server configuration error',
          errorDetails: {
            type: 'CONFIGURATION_ERROR',
            details: 'Required environment variables are not configured',
            userMessage: 'The server is not properly configured. Please contact support.',
          }
        },
        { status: 500, headers: getSecurityHeaders(request) }
      );
    }

    // Format private key
    let formattedPrivateKey: `0x${string}`;
    try {
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
          }
        },
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
      
      let errorMessage = 'Failed to upload image';
      let errorDetails: Record<string, unknown> = {
        type: 'UPLOAD_ERROR',
        details: 'Image upload failed',
        userMessage: 'Failed to upload image. Please try again.',
      };
      
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
        }
      }
      
      return NextResponse.json(
        { 
          success: false, 
          error: errorMessage,
          errorDetails
        },
        { status: 500, headers: getSecurityHeaders(request) }
      );
    }

    // Setup wallet and clients
    let account;
    try {
      account = privateKeyToAccount(formattedPrivateKey);
    } catch (error) {
      console.error('Failed to create account from private key:', error);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to create wallet account',
          errorDetails: {
            type: 'CONFIGURATION_ERROR',
            details: error instanceof Error ? error.message : 'Invalid private key format',
            userMessage: 'Failed to initialize deployment wallet. Please contact support.',
          }
        },
        { status: 500, headers: getSecurityHeaders(request) }
      );
    }

    const chain = networkConfig.isMainnet ? base : baseSepolia;
    
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
    const creatorReward = parseInt(process.env.CREATOR_REWARD || '80', 10);

    // Deploy token
    let tokenAddress: string | undefined;
    let txHash: string | undefined;
    
    try {
      console.log('[Deploy] Deploying team token...');
      
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
    } catch (error) {
      console.error('Token deployment failed:', error);
      return NextResponse.json(
        { 
          success: false, 
          error: `Token deployment failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
          errorDetails: {
            type: 'DEPLOYMENT_ERROR',
            details: error instanceof Error ? error.message : 'Token deployment failed',
            userMessage: 'Failed to deploy token. Please try again.',
          }
        },
        { status: 500, headers: getSecurityHeaders(request) }
      );
    }

    if (!tokenAddress) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Token deployment failed',
          errorDetails: {
            type: 'DEPLOYMENT_ERROR',
            details: 'No token address returned from deployment',
            userMessage: 'Token deployment failed. Please try again.',
          }
        },
        { status: 500, headers: getSecurityHeaders(request) }
      );
    }

    // Track transaction
    try {
      if (txHash) {
        await trackTransaction(txHash, {
          type: 'team_token_deployment',
          tokenAddress,
          name,
          symbol,
          teamMembers,
          treasuryPercentage,
        });
      }
    } catch (error) {
      console.error('Failed to track transaction:', error);
      // Don't fail the request if tracking fails
    }

    // Store deployment data in Redis
    try {
      const redisClient = getRedisClient();
      if (redisClient) {
        const deploymentData = {
          tokenAddress,
          name,
          symbol,
          teamMembers,
          treasuryAllocation,
          deployedBy: fid,
          deployedAt: Date.now(),
          network: networkConfig.name,
          chainId: networkConfig.chainId,
        };
        
        await redisClient.set(
          `team-token:${tokenAddress}`,
          deploymentData,
          {
            ex: 60 * 60 * 24 * 365, // 1 year expiration
          }
        );
      }
    } catch (error) {
      console.error('Failed to store deployment data:', error);
      // Don't fail the request if storing fails
    }

    // Store token in user's token list
    if (fid && tokenAddress) {
      try {
        await storeUserToken(fid, {
          address: tokenAddress,
          name,
          symbol,
          createdAt: new Date().toISOString(),
          type: 'team',
        });
      } catch (error) {
        console.error('Failed to store user token:', error);
        // Don't fail the request if storing fails
      }
    }

    // Return response
    const response = {
      success: true,
      tokenAddress,
      txHash: txHash || null,
      imageUrl,
      network: networkConfig.name,
      chainId: networkConfig.chainId,
      teamMembers,
    };

    if (treasuryAllocation) {
      response.treasuryAllocation = treasuryAllocation;
    }

    return NextResponse.json(response, { headers: getSecurityHeaders(request) });
  } catch (error) {
    console.error('Unexpected error:', error);
    
    return NextResponse.json(
      { 
        success: false, 
        error: 'An unexpected error occurred',
        errorDetails: {
          type: 'UNKNOWN_ERROR',
          details: error instanceof Error ? error.message : 'An unexpected error occurred',
          userMessage: 'Something went wrong. Please try again.',
        }
      },
      { status: 500, headers: getSecurityHeaders(request) }
    );
  }
}