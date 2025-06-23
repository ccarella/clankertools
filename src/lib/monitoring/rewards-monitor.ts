import { getRedisClient } from '@/lib/redis';
import { validateInput, schemas, sanitizeRedisKey } from '@/lib/security/input-validation';
import { FeeConfiguration } from '@/lib/feeCalculations';
import { z } from 'zod';

// Types for deployment and reward tracking
export interface DeploymentData {
  tokenAddress: string;
  tokenName: string;
  tokenSymbol: string;
  creatorAddress: string;
  creatorFid: string;
  deploymentDate: string;
  transactionHash: string;
  feeConfiguration: FeeConfiguration;
  expectedCreatorPercentage: number;
  expectedPlatformPercentage: number;
  network: 'base' | 'base-sepolia';
}

export interface OnChainRewards {
  tokenAddress: string;
  totalFeesCollected: bigint;
  creatorFeesReceived: bigint;
  platformFeesReceived: bigint;
  creatorPercentage: number;
  platformPercentage: number;
  lastUpdated: string;
}

export interface RewardDiscrepancy {
  tokenAddress: string;
  tokenName: string;
  expectedCreatorPercentage: number;
  actualCreatorPercentage: number;
  percentageDifference: number;
  expectedCreatorFees: bigint;
  actualCreatorFees: bigint;
  feeDifference: bigint;
  severity: 'low' | 'medium' | 'high';
}

export interface WeeklyReportData {
  startDate: string;
  endDate: string;
  totalDeployments: number;
  deploymentsWithDiscrepancies: number;
  totalFeesCollected: bigint;
  totalCreatorFees: bigint;
  totalPlatformFees: bigint;
  averageCreatorPercentage: number;
  discrepancies: RewardDiscrepancy[];
  deploymentsByDay: Record<string, number>;
  feesByDay: Record<string, bigint>;
}

// Schemas for validation
const deploymentDataSchema = z.object({
  tokenAddress: schemas.tokenAddress,
  tokenName: z.string().min(1).max(100),
  tokenSymbol: z.string().min(1).max(10),
  creatorAddress: schemas.walletAddress,
  creatorFid: schemas.fid,
  deploymentDate: z.string().datetime(),
  transactionHash: z.string().regex(/^0x[a-fA-F0-9]{64}$/),
  feeConfiguration: z.object({
    creatorFeePercentage: z.number().min(0).max(100),
    platformFeePercentage: z.number().min(0).max(100),
    totalFeePercentage: z.number().min(0).max(100),
  }),
  expectedCreatorPercentage: z.number().min(0).max(100),
  expectedPlatformPercentage: z.number().min(0).max(100),
  network: z.enum(['base', 'base-sepolia']),
});

/**
 * Fetches deployment data from Redis for a given date range
 */
export async function fetchDeploymentData(
  startDate: Date,
  endDate: Date
): Promise<DeploymentData[]> {
  const client = getRedisClient();
  const deployments: DeploymentData[] = [];
  
  try {
    // Generate date keys for the range
    const currentDate = new Date(startDate);
    const dateKeys: string[] = [];
    
    while (currentDate <= endDate) {
      const dateKey = currentDate.toISOString().split('T')[0];
      dateKeys.push(`deployments:${dateKey}`);
      currentDate.setDate(currentDate.getDate() + 1);
    }
    
    // Fetch deployments for each date
    for (const dateKey of dateKeys) {
      const dayDeployments = await client.get<DeploymentData[]>(dateKey);
      if (dayDeployments && Array.isArray(dayDeployments)) {
        deployments.push(...dayDeployments);
      }
    }
    
    // Also fetch from deployment history pattern
    const deploymentPattern = 'deployment:*';
    const keys = await client.keys(deploymentPattern);
    
    for (const key of keys) {
      const deployment = await client.get<DeploymentData>(key);
      if (deployment) {
        const deploymentDate = new Date(deployment.deploymentDate);
        if (deploymentDate >= startDate && deploymentDate <= endDate) {
          // Validate deployment data
          const validation = validateInput(deployment, deploymentDataSchema);
          if (validation.success) {
            deployments.push(validation.data);
          }
        }
      }
    }
    
    // Remove duplicates by token address
    const uniqueDeployments = Array.from(
      new Map(deployments.map(d => [d.tokenAddress.toLowerCase(), d])).values()
    );
    
    return uniqueDeployments;
  } catch (error) {
    console.error('Error fetching deployment data:', error);
    throw new Error('Failed to fetch deployment data from storage');
  }
}

/**
 * Calculates expected rewards based on deployment configuration
 */
export function calculateExpectedRewards(deployment: DeploymentData): {
  expectedCreatorPercentage: number;
  expectedPlatformPercentage: number;
  expectedSplit: { creator: number; platform: number };
} {
  // Default to 80/20 split if not specified
  const creatorPercentage = deployment.expectedCreatorPercentage || 80;
  const platformPercentage = deployment.expectedPlatformPercentage || 20;
  
  // Validate percentages sum to 100
  if (Math.abs(creatorPercentage + platformPercentage - 100) > 0.001) {
    console.warn(
      `Invalid fee split for ${deployment.tokenAddress}: ${creatorPercentage}/${platformPercentage}`
    );
  }
  
  return {
    expectedCreatorPercentage: creatorPercentage,
    expectedPlatformPercentage: platformPercentage,
    expectedSplit: {
      creator: creatorPercentage,
      platform: platformPercentage,
    },
  };
}

/**
 * Fetches actual on-chain reward distributions
 * This is a placeholder - actual implementation would query blockchain
 */
export async function verifyOnChainRewards(
  tokenAddress: string
): Promise<OnChainRewards | null> {
  // Validate token address
  const validation = validateInput(tokenAddress, schemas.tokenAddress);
  if (!validation.success) {
    throw new Error('Invalid token address format');
  }
  
  try {
    // In a real implementation, this would:
    // 1. Query the token contract for fee configuration
    // 2. Query transfer events to calculate actual fee distributions
    // 3. Calculate percentages based on actual transfers
    
    // For now, return mock data or fetch from cached data
    const client = getRedisClient();
    const cacheKey = `onchain:rewards:${sanitizeRedisKey(tokenAddress)}`;
    const cachedData = await client.get<OnChainRewards>(cacheKey);
    
    if (cachedData) {
      return cachedData;
    }
    
    // Placeholder response
    return {
      tokenAddress,
      totalFeesCollected: BigInt(0),
      creatorFeesReceived: BigInt(0),
      platformFeesReceived: BigInt(0),
      creatorPercentage: 0,
      platformPercentage: 0,
      lastUpdated: new Date().toISOString(),
    };
  } catch (error) {
    console.error(`Error fetching on-chain rewards for ${tokenAddress}:`, error);
    return null;
  }
}

/**
 * Compares expected vs actual rewards and identifies discrepancies
 */
export function detectDiscrepancies(
  deployment: DeploymentData,
  onChainRewards: OnChainRewards
): RewardDiscrepancy | null {
  const expected = calculateExpectedRewards(deployment);
  
  // Calculate percentage difference
  const percentageDifference = Math.abs(
    expected.expectedCreatorPercentage - onChainRewards.creatorPercentage
  );
  
  // Skip if no fees collected yet
  if (onChainRewards.totalFeesCollected === BigInt(0)) {
    return null;
  }
  
  // Calculate expected fees based on total collected
  const expectedCreatorFees =
    (onChainRewards.totalFeesCollected * BigInt(expected.expectedCreatorPercentage)) / BigInt(100);
  const feeDifference = expectedCreatorFees - onChainRewards.creatorFeesReceived;
  const feeDifferenceAbs = feeDifference < 0 ? -feeDifference : feeDifference;
  
  // Determine severity
  let severity: 'low' | 'medium' | 'high';
  if (percentageDifference < 1) {
    severity = 'low';
  } else if (percentageDifference < 5) {
    severity = 'medium';
  } else {
    severity = 'high';
  }
  
  // Only report if there's a meaningful discrepancy
  if (percentageDifference < 0.1 && feeDifferenceAbs < BigInt(1000000)) {
    return null;
  }
  
  return {
    tokenAddress: deployment.tokenAddress,
    tokenName: deployment.tokenName,
    expectedCreatorPercentage: expected.expectedCreatorPercentage,
    actualCreatorPercentage: onChainRewards.creatorPercentage,
    percentageDifference,
    expectedCreatorFees,
    actualCreatorFees: onChainRewards.creatorFeesReceived,
    feeDifference,
    severity,
  };
}

/**
 * Generates a weekly report of deployments and reward distributions
 */
export async function generateWeeklyReport(
  deployments: DeploymentData[]
): Promise<WeeklyReportData> {
  if (deployments.length === 0) {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    return {
      startDate: weekAgo.toISOString(),
      endDate: now.toISOString(),
      totalDeployments: 0,
      deploymentsWithDiscrepancies: 0,
      totalFeesCollected: BigInt(0),
      totalCreatorFees: BigInt(0),
      totalPlatformFees: BigInt(0),
      averageCreatorPercentage: 0,
      discrepancies: [],
      deploymentsByDay: {},
      feesByDay: {},
    };
  }
  
  // Sort deployments by date
  const sortedDeployments = [...deployments].sort(
    (a, b) => new Date(a.deploymentDate).getTime() - new Date(b.deploymentDate).getTime()
  );
  
  const startDate = sortedDeployments[0].deploymentDate;
  const endDate = sortedDeployments[sortedDeployments.length - 1].deploymentDate;
  
  // Initialize aggregates
  let totalFeesCollected = BigInt(0);
  let totalCreatorFees = BigInt(0);
  let totalPlatformFees = BigInt(0);
  const discrepancies: RewardDiscrepancy[] = [];
  const deploymentsByDay: Record<string, number> = {};
  const feesByDay: Record<string, bigint> = {};
  const creatorPercentages: number[] = [];
  
  // Process each deployment
  for (const deployment of deployments) {
    // Verify on-chain rewards
    const onChainRewards = await verifyOnChainRewards(deployment.tokenAddress);
    
    if (onChainRewards) {
      totalFeesCollected += onChainRewards.totalFeesCollected;
      totalCreatorFees += onChainRewards.creatorFeesReceived;
      totalPlatformFees += onChainRewards.platformFeesReceived;
      
      // Check for discrepancies
      const discrepancy = detectDiscrepancies(deployment, onChainRewards);
      if (discrepancy) {
        discrepancies.push(discrepancy);
      }
      
      // Track creator percentage
      if (onChainRewards.totalFeesCollected > BigInt(0)) {
        creatorPercentages.push(onChainRewards.creatorPercentage);
      }
    }
    
    // Track deployments by day
    const dayKey = deployment.deploymentDate.split('T')[0];
    deploymentsByDay[dayKey] = (deploymentsByDay[dayKey] || 0) + 1;
    
    // Track fees by day
    if (onChainRewards) {
      feesByDay[dayKey] = (feesByDay[dayKey] || BigInt(0)) + onChainRewards.totalFeesCollected;
    }
  }
  
  // Calculate average creator percentage
  const averageCreatorPercentage =
    creatorPercentages.length > 0
      ? creatorPercentages.reduce((sum, pct) => sum + pct, 0) / creatorPercentages.length
      : 80; // Default to 80% if no data
  
  // Sort discrepancies by severity and fee difference
  discrepancies.sort((a, b) => {
    if (a.severity !== b.severity) {
      const severityOrder = { high: 0, medium: 1, low: 2 };
      return severityOrder[a.severity] - severityOrder[b.severity];
    }
    // Sort by absolute fee difference for same severity
    const aDiff = a.feeDifference < 0 ? -a.feeDifference : a.feeDifference;
    const bDiff = b.feeDifference < 0 ? -b.feeDifference : b.feeDifference;
    return Number(bDiff - aDiff);
  });
  
  return {
    startDate,
    endDate,
    totalDeployments: deployments.length,
    deploymentsWithDiscrepancies: discrepancies.length,
    totalFeesCollected,
    totalCreatorFees,
    totalPlatformFees,
    averageCreatorPercentage,
    discrepancies,
    deploymentsByDay,
    feesByDay,
  };
}

/**
 * Store deployment data for monitoring
 */
export async function storeDeploymentForMonitoring(
  deployment: DeploymentData
): Promise<void> {
  const validation = validateInput(deployment, deploymentDataSchema);
  if (!validation.success) {
    throw new Error(`Invalid deployment data: ${validation.errors.join(', ')}`);
  }
  
  const client = getRedisClient();
  
  try {
    // Store by token address
    const tokenKey = `deployment:${sanitizeRedisKey(deployment.tokenAddress)}`;
    await client.set(tokenKey, deployment);
    await client.expire(tokenKey, 90 * 24 * 60 * 60); // 90 days retention
    
    // Store in daily deployment list
    const dateKey = `deployments:${deployment.deploymentDate.split('T')[0]}`;
    const existingDeployments = (await client.get<DeploymentData[]>(dateKey)) || [];
    
    // Add if not already present
    const exists = existingDeployments.some(
      d => d.tokenAddress.toLowerCase() === deployment.tokenAddress.toLowerCase()
    );
    
    if (!exists) {
      existingDeployments.push(deployment);
      await client.set(dateKey, existingDeployments);
      await client.expire(dateKey, 90 * 24 * 60 * 60); // 90 days retention
    }
  } catch (error) {
    console.error('Error storing deployment for monitoring:', error);
    throw new Error('Failed to store deployment data');
  }
}