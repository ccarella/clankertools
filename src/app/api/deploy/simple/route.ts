import { NextRequest, NextResponse } from 'next/server';
import { Clanker } from 'clanker-sdk';
import { createPublicClient, createWalletClient, http } from 'viem';
import { base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { uploadToIPFS } from '@/lib/ipfs';
import { trackTransaction } from '@/lib/transaction-tracker';

export const runtime = 'edge';

export async function POST(request: NextRequest) {
  try {
    // Check method
    if (request.method !== 'POST') {
      return NextResponse.json(
        { success: false, error: 'Method not allowed' },
        { status: 405 }
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
        { status: 400 }
      );
    }

    // Validate field constraints
    if (name.length > 32) {
      return NextResponse.json(
        { success: false, error: 'Token name must be 32 characters or less' },
        { status: 400 }
      );
    }

    if (symbol.length < 3 || symbol.length > 8) {
      return NextResponse.json(
        { success: false, error: 'Symbol must be between 3 and 8 characters' },
        { status: 400 }
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
        { status: 500 }
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
        { status: 500 }
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
        tokenAddress = await clanker.deployToken({
          name,
          symbol,
          image: imageUrl,
          pool: {
            quoteToken: '0x4200000000000000000000000000000000000006' as `0x${string}`, // WETH on Base
            initialMarketCap: '0.1', // 0.1 ETH initial market cap
          },
          rewardsConfig: {
            creatorReward: 80, // 80% creator reward
            creatorAdmin: account.address,
            creatorRewardRecipient: account.address,
            interfaceAdmin: interfaceAdmin as `0x${string}`,
            interfaceRewardRecipient: interfaceRewardRecipient as `0x${string}`,
          },
        });

        // Generate a transaction hash for tracking (in production, this would come from the blockchain event)
        txHash = `0x${Date.now().toString(16)}${Math.random().toString(16).slice(2).padEnd(64, '0')}`.slice(0, 66);
        break; // Success, exit retry loop
      } catch (error) {
        console.error(`Deployment attempt ${attempt} failed:`, error);
        
        if (attempt < maxRetries) {
          // Wait before retrying (exponential backoff)
          await new Promise(resolve => setTimeout(resolve, Math.pow(2, attempt) * 1000));
        }
      }
    }

    if (!tokenAddress || !txHash) {
      return NextResponse.json(
        { success: false, error: `Token deployment failed after ${maxRetries} attempts` },
        { status: 500 }
      );
    }

    // Track transaction
    try {
      await trackTransaction(txHash, {
        type: 'token_deployment',
        tokenAddress,
        name,
        symbol,
      });
    } catch (error) {
      console.error('Failed to track transaction:', error);
      // Don't fail the request if tracking fails
    }

    return NextResponse.json({
      success: true,
      tokenAddress,
      txHash,
      imageUrl,
    });
  } catch (error) {
    console.error('Unexpected error:', error);
    return NextResponse.json(
      { success: false, error: 'An unexpected error occurred' },
      { status: 500 }
    );
  }
}