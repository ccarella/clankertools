import { Redis } from '@upstash/redis';

type TransactionStatus = 'pending' | 'confirmed' | 'failed';

interface TransactionMetadata {
  type: 'token_deployment';
  tokenAddress: string;
  name: string;
  symbol: string;
}

interface TransactionData extends TransactionMetadata {
  status: TransactionStatus;
  timestamp: number;
  updatedAt?: number;
  error?: string;
}

// Initialize Redis client lazily
function getRedisClient() {
  return new Redis({
    url: process.env.KV_REST_API_URL || '',
    token: process.env.KV_REST_API_TOKEN || '',
  });
}

export async function trackTransaction(
  txHash: string,
  metadata: TransactionMetadata
): Promise<void> {
  // Validate transaction hash format
  if (!txHash.match(/^0x[a-fA-F0-9]+$/)) {
    throw new Error('Invalid transaction hash format');
  }

  const data: TransactionData = {
    status: 'pending',
    timestamp: Date.now(),
    ...metadata,
  };

  try {
    // Store transaction data with 24 hour expiry
    const redis = getRedisClient();
    await redis.setex(`tx:${txHash}`, 86400, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to track transaction:', error);
    // Don't throw - tracking failure shouldn't break the main flow
  }
}

export async function getTransactionStatus(
  txHash: string
): Promise<TransactionData | null> {
  try {
    const redis = getRedisClient();
    const data = await redis.get(`tx:${txHash}`);
    if (!data) return null;
    
    return JSON.parse(data as string) as TransactionData;
  } catch (error) {
    console.error('Failed to get transaction status:', error);
    return null;
  }
}

export async function updateTransactionStatus(
  txHash: string,
  status: TransactionStatus,
  error?: string
): Promise<void> {
  try {
    const redis = getRedisClient();
    const existingData = await redis.get(`tx:${txHash}`);
    if (!existingData) {
      throw new Error('Transaction not found');
    }

    const data = JSON.parse(existingData as string) as TransactionData;
    data.status = status;
    data.updatedAt = Date.now();
    
    if (error) {
      data.error = error;
    }

    await redis.set(`tx:${txHash}`, JSON.stringify(data));
  } catch (error) {
    console.error('Failed to update transaction status:', error);
    // Don't throw for Redis errors, but throw for not found
    if (error instanceof Error && error.message === 'Transaction not found') {
      throw error;
    }
  }
}