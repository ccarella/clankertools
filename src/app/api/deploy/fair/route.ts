import { NextRequest, NextResponse } from 'next/server';
import { z } from 'zod';
import { getTransactionManager } from '@/lib/transaction/TransactionManager';
import { keccak256, toUtf8Bytes } from 'ethers';
import { MerkleTree } from 'merkletreejs';

const fairLaunchSchema = z.object({
  fid: z.string(),
  tokenName: z.string().min(1).max(50),
  tokenSymbol: z.string().min(1).max(10).transform(s => s.toUpperCase()),
  description: z.string().max(500),
  imageUrl: z.string().url(),
  whitelist: z.array(z.string()).min(1, 'Whitelist must contain at least one user'),
  minContribution: z.string().refine((val) => parseFloat(val) > 0, 'Must be greater than 0'),
  maxContribution: z.string().refine((val) => parseFloat(val) > 0, 'Must be greater than 0'),
  targetRaise: z.string().refine((val) => parseFloat(val) > 0, 'Must be greater than 0'),
  launchStartTime: z.string().datetime(),
  launchDuration: z.number().min(3600).max(604800), // 1 hour to 7 days in seconds
  creatorWallet: z.string().optional(),
});

function generateMerkleTree(whitelist: string[]): { root: string; tree: MerkleTree } {
  const leaves = whitelist.map((address) => keccak256(toUtf8Bytes(address)));
  const tree = new MerkleTree(leaves, keccak256, { sortPairs: true });
  const root = tree.getHexRoot();
  return { root, tree };
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const validationResult = fairLaunchSchema.safeParse(body);

    if (!validationResult.success) {
      return NextResponse.json(
        { error: validationResult.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const data = validationResult.data;

    // Additional validations
    const minContribution = parseFloat(data.minContribution);
    const maxContribution = parseFloat(data.maxContribution);
    const targetRaise = parseFloat(data.targetRaise);

    if (minContribution > maxContribution) {
      return NextResponse.json(
        { error: 'Minimum contribution must be less than maximum contribution' },
        { status: 400 }
      );
    }

    if (maxContribution > targetRaise) {
      return NextResponse.json(
        { error: 'Maximum contribution cannot exceed target raise amount' },
        { status: 400 }
      );
    }

    const launchStartTime = new Date(data.launchStartTime);
    if (launchStartTime <= new Date()) {
      return NextResponse.json(
        { error: 'Launch start time must be in the future' },
        { status: 400 }
      );
    }

    if (data.launchDuration < 3600 || data.launchDuration > 604800) {
      return NextResponse.json(
        { error: 'Launch duration must be between 1 hour and 7 days' },
        { status: 400 }
      );
    }

    // Generate Merkle tree for whitelist
    const { root: merkleRoot } = generateMerkleTree(data.whitelist);

    // Create transaction record
    const transactionManager = getTransactionManager();
    const transaction = await transactionManager.createTransaction({
      fid: data.fid,
      type: 'fair_launch',
      tokenName: data.tokenName,
      tokenSymbol: data.tokenSymbol,
      description: data.description,
      imageUrl: data.imageUrl,
      metadata: {
        whitelist: data.whitelist,
        merkleRoot,
        minContribution,
        maxContribution,
        targetRaise,
        launchStartTime: launchStartTime.toISOString(),
        launchDuration: data.launchDuration,
        creatorWallet: data.creatorWallet,
      },
    });

    // In a real implementation, you would:
    // 1. Deploy the fair launch smart contract
    // 2. Store the merkle tree data for proof generation
    // 3. Set up monitoring for contributions
    // 4. Handle refund logic if target not met

    return NextResponse.json({
      success: true,
      transactionId: transaction.transactionId,
      merkleRoot,
      message: 'Fair launch token deployment initiated',
    });

  } catch (error) {
    console.error('Fair launch deployment error:', error);
    return NextResponse.json(
      { error: 'Failed to deploy fair launch token' },
      { status: 500 }
    );
  }
}