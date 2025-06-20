import { NextRequest, NextResponse } from 'next/server';
import { uploadToIPFS } from '@/lib/ipfs';
import { getNetworkConfig } from '@/lib/network-config';

export const runtime = 'edge';

// Security headers configuration
function getSecurityHeaders(request: NextRequest): Headers {
  const headers = new Headers();
  const origin = request.headers.get('origin');
  const allowedOrigins = process.env.ALLOWED_ORIGINS?.split(',') || ['*'];
  
  if (allowedOrigins.includes('*') || (origin && allowedOrigins.includes(origin))) {
    headers.set('Access-Control-Allow-Origin', origin || '*');
  }
  
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type');
  headers.set('Content-Type', 'application/json');
  
  return headers;
}

// Handle OPTIONS request for CORS
export async function OPTIONS(request: NextRequest) {
  return new Response(null, { status: 204, headers: getSecurityHeaders(request) });
}

export async function POST(request: NextRequest) {
  const requestContext = {
    timestamp: new Date().toISOString(),
    url: request.url,
    method: request.method,
    headers: Object.fromEntries(request.headers.entries()),
  };

  const debugContext: {
    timestamp: string;
    network: string;
    hasDeployerKey: boolean;
    keyLength: number;
    step?: string;
  } = {
    timestamp: requestContext.timestamp,
    network: process.env.NEXT_PUBLIC_NETWORK || 'base-sepolia',
    hasDeployerKey: !!process.env.DEPLOYER_PRIVATE_KEY,
    keyLength: process.env.DEPLOYER_PRIVATE_KEY?.length || 0,
  };

  try {
    const body = await request.json();
    const { 
      tokenName, 
      tokenSymbol, 
      imageFile, 
      description = '', 
      userFid,
      walletAddress,
    } = body;

    // Validate required fields
    if (!tokenName || !tokenSymbol || !imageFile || !userFid) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Missing required fields',
          errorDetails: {
            type: 'VALIDATION_ERROR',
            details: 'tokenName, tokenSymbol, imageFile, and userFid are required',
            userMessage: 'Please fill in all required fields',
          },
          debugInfo: {
            ...debugContext,
            step: 'validation',
            receivedFields: Object.keys(body),
            requestContext,
          }
        },
        { status: 400, headers: getSecurityHeaders(request) }
      );
    }

    // Validate wallet address is provided
    if (!walletAddress) {
      return NextResponse.json(
        { 
          success: false, 
          error: 'Wallet address required',
          errorDetails: {
            type: 'VALIDATION_ERROR',
            details: 'Wallet address is required for deployment',
            userMessage: 'Please connect your wallet to deploy tokens',
          },
          debugInfo: {
            ...debugContext,
            step: 'wallet_validation',
            requestContext,
          }
        },
        { status: 400, headers: getSecurityHeaders(request) }
      );
    }

    debugContext.step = 'ipfs_upload';

    // Upload image to IPFS
    let imageUrl: string;
    try {
      if (!imageFile.startsWith('data:image/')) {
        throw new Error('Invalid image format. Expected base64 data URL.');
      }

      imageUrl = await uploadToIPFS(imageFile);
      
      if (!imageUrl) {
        throw new Error('Failed to get IPFS URL');
      }

      console.log('Image uploaded to IPFS:', imageUrl);
    } catch (error) {
      console.error('IPFS upload error:', error);
      return NextResponse.json(
        { 
          success: false, 
          error: 'Failed to upload image',
          errorDetails: {
            type: 'UPLOAD_ERROR',
            details: error instanceof Error ? error.message : 'IPFS upload failed',
            userMessage: 'Failed to upload image. Please try again.',
          },
          debugInfo: {
            ...debugContext,
            step: 'ipfs_upload_error',
            requestContext,
          }
        },
        { status: 500, headers: getSecurityHeaders(request) }
      );
    }

    debugContext.step = 'network_config';

    // Get network configuration
    const networkConfig = getNetworkConfig();
    const { chainId } = networkConfig;

    // Get configurable pool values
    const initialMarketCap = process.env.INITIAL_MARKET_CAP || '0.1';
    const rawCreatorReward = parseInt(process.env.CREATOR_REWARD || '80', 10);
    
    // Validate creator reward percentage (0-100)
    const creatorReward = (isNaN(rawCreatorReward) || rawCreatorReward < 0 || rawCreatorReward > 100) 
      ? 80 
      : rawCreatorReward;

    debugContext.step = 'prepare_response';

    // Prepare deployment data for client-side
    const deploymentData = {
      name: tokenName,
      symbol: tokenSymbol,
      imageUrl,
      description,
      marketCap: initialMarketCap,
      creatorReward,
      deployerAddress: walletAddress,
    };

    // Store deployment preparation data if we have cast context
    // Note: storeUserToken expects a UserToken object, not deployment data
    // This would need to be updated after deployment completes with actual token data

    return NextResponse.json(
      { 
        success: true,
        deploymentData,
        chainId,
        networkName: networkConfig.name,
        debugInfo: {
          ...debugContext,
          step: 'success',
          requestContext,
        }
      },
      { status: 200, headers: getSecurityHeaders(request) }
    );

  } catch (error) {
    console.error('Deployment preparation error:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Deployment preparation failed',
        errorDetails: {
          type: 'PREPARATION_ERROR',
          details: error instanceof Error ? error.message : 'An unexpected error occurred',
          userMessage: 'Failed to prepare token deployment. Please try again.',
        },
        debugInfo: {
          ...debugContext,
          step: 'unexpected_error',
          errorName: error instanceof Error ? error.name : 'UnknownError',
          errorStack: error instanceof Error ? error.stack : undefined,
          requestContext,
        }
      },
      { status: 500, headers: getSecurityHeaders(request) }
    );
  }
}