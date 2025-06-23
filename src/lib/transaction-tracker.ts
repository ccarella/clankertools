import { Redis } from '@upstash/redis';
import { getTransactionManager, TransactionData as TMTransactionData, TransactionStatus as TMTransactionStatus, TransactionPriority as TMTransactionPriority } from './transaction/TransactionManager';
import { tokenDeploymentProcessor } from './transaction/processors/tokenDeploymentProcessor';

// Legacy types for backward compatibility
type TransactionStatus = 'pending' | 'confirmed' | 'failed';

interface TransactionMetadata {
  type: 'token_deployment' | 'team_token_deployment';
  tokenAddress: string;
  name: string;
  symbol: string;
  teamMembers?: Array<{
    address: string;
    percentage: number;
    role?: string;
    vestingMonths?: number;
  }>;
  treasuryPercentage?: number;
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

// New function to get transaction status from TransactionManager
export async function getTransactionManagerStatus(
  transactionId: string
): Promise<TMTransactionData | null> {
  try {
    const transactionManager = getTransactionManager({
      processor: tokenDeploymentProcessor,
      maxRetries: 3,
      retryDelay: 5000,
    });

    // Access private redis instance to get transaction data
    const redis = transactionManager['redis'];
    const txDataRaw = await redis.hgetall(`tx:data:${transactionId}`);

    if (!txDataRaw || Object.keys(txDataRaw).length === 0) {
      return null;
    }

    // Parse transaction data
    const txData: TMTransactionData = {
      id: transactionId,
      transaction: JSON.parse(txDataRaw.transaction as string),
      metadata: JSON.parse(txDataRaw.metadata as string),
      status: txDataRaw.status as TMTransactionStatus,
      priority: txDataRaw.priority as TMTransactionPriority,
      createdAt: parseInt(txDataRaw.createdAt as string, 10),
      updatedAt: txDataRaw.updatedAt ? parseInt(txDataRaw.updatedAt as string, 10) : undefined,
      completedAt: txDataRaw.completedAt ? parseInt(txDataRaw.completedAt as string, 10) : undefined,
      cancelledAt: txDataRaw.cancelledAt ? parseInt(txDataRaw.cancelledAt as string, 10) : undefined,
      result: txDataRaw.result ? JSON.parse(txDataRaw.result as string) : undefined,
      error: txDataRaw.error as string | undefined,
      lastError: txDataRaw.lastError as string | undefined,
      retryCount: txDataRaw.retryCount ? parseInt(txDataRaw.retryCount as string, 10) : 0,
      lastRetryAt: txDataRaw.lastRetryAt ? parseInt(txDataRaw.lastRetryAt as string, 10) : undefined,
      nextRetryAt: txDataRaw.nextRetryAt ? parseInt(txDataRaw.nextRetryAt as string, 10) : undefined,
    };

    return txData;
  } catch (error) {
    console.error('Failed to get transaction manager status:', error);
    return null;
  }
}

// Helper function to create a transaction using TransactionManager
export async function createManagedTransaction(
  payload: Record<string, unknown>,
  metadata: {
    userId: number;
    description: string;
  },
  priority: 'high' | 'medium' | 'low' = 'medium'
): Promise<string> {
  const transactionManager = getTransactionManager({
    processor: tokenDeploymentProcessor,
    maxRetries: 3,
    retryDelay: 5000,
  });

  return await transactionManager.queueTransaction(
    {
      type: (payload.type as string) || 'token_deployment',
      payload,
    },
    metadata,
    priority
  );
}

// Helper function to cancel a managed transaction
export async function cancelManagedTransaction(
  transactionId: string
): Promise<boolean> {
  const transactionManager = getTransactionManager({
    processor: tokenDeploymentProcessor,
    maxRetries: 3,
    retryDelay: 5000,
  });

  return await transactionManager.cancelTransaction(transactionId);
}

// Helper function to get user transaction history
export async function getUserTransactionHistory(
  userId: number,
  filter?: {
    status?: 'queued' | 'processing' | 'completed' | 'failed' | 'cancelled';
    type?: string;
    limit?: number;
    offset?: number;
  }
): Promise<TMTransactionData[]> {
  const transactionManager = getTransactionManager({
    processor: tokenDeploymentProcessor,
    maxRetries: 3,
    retryDelay: 5000,
  });

  return await transactionManager.getUserTransactionHistory(userId, filter);
}