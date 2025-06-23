import { NextRequest, NextResponse } from 'next/server';
import { getRedisClient } from '@/lib/redis';

export const runtime = 'edge';

interface WalletData {
  address: string;
  enableCreatorRewards: boolean;
  connectedAt: number;
}

interface DeploymentData {
  tokenAddress: string;
  name: string;
  symbol: string;
  createdAt: string;
  fid: string;
  creatorAdmin?: string;
  creatorRewardRecipient?: string;
  creatorReward?: number;
  txHash?: string;
}

interface RewardDiscrepancy {
  tokenAddress: string;
  name: string;
  symbol: string;
  deployedAt: string;
  fid: string;
  issue: string;
  expected?: string;
  actual?: string;
}

interface MonitoringReport {
  period: {
    start: string;
    end: string;
  };
  summary: {
    totalDeployments: number;
    deploymentsWithRewards: number;
    deploymentsWithoutRewards: number;
    discrepanciesFound: number;
  };
  discrepancies: RewardDiscrepancy[];
  deployments: DeploymentData[];
}

// Security headers configuration
function getSecurityHeaders(): Headers {
  const headers = new Headers();
  
  // CORS headers - restrict to same origin for admin endpoints
  headers.set('Access-Control-Allow-Origin', process.env.NEXT_PUBLIC_URL || '*');
  headers.set('Access-Control-Allow-Methods', 'GET, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  headers.set('Access-Control-Max-Age', '86400');
  
  // Security headers
  headers.set('X-Content-Type-Options', 'nosniff');
  headers.set('X-Frame-Options', 'DENY');
  headers.set('X-XSS-Protection', '1; mode=block');
  headers.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  
  return headers;
}

// Simple authentication check
function isAuthorized(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  const adminToken = process.env.ADMIN_API_TOKEN;
  
  if (!adminToken) {
    console.warn('ADMIN_API_TOKEN not configured');
    return false;
  }
  
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return false;
  }
  
  const token = authHeader.substring(7);
  return token === adminToken;
}

export async function OPTIONS() {
  const headers = getSecurityHeaders();
  return new NextResponse(null, { status: 204, headers });
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    if (!isAuthorized(request)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401, headers: getSecurityHeaders() }
      );
    }

    // Parse query parameters
    const searchParams = request.nextUrl.searchParams;
    const startDate = searchParams.get('start');
    const endDate = searchParams.get('end');
    
    // Default to last 7 days if no dates provided
    const now = new Date();
    const end = endDate ? new Date(endDate) : now;
    const start = startDate ? new Date(startDate) : new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // Validate date range
    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      return NextResponse.json(
        { error: 'Invalid date format' },
        { status: 400, headers: getSecurityHeaders() }
      );
    }
    
    if (start > end) {
      return NextResponse.json(
        { error: 'Start date must be before end date' },
        { status: 400, headers: getSecurityHeaders() }
      );
    }
    
    // Maximum date range of 90 days
    const maxRange = 90 * 24 * 60 * 60 * 1000;
    if (end.getTime() - start.getTime() > maxRange) {
      return NextResponse.json(
        { error: 'Date range cannot exceed 90 days' },
        { status: 400, headers: getSecurityHeaders() }
      );
    }

    const redis = getRedisClient();
    const deployments: DeploymentData[] = [];
    const discrepancies: RewardDiscrepancy[] = [];
    
    // Scan for all user token keys
    // Note: In production, you might want to maintain a separate index of deployments
    let cursor = 0;
    const pattern = 'user:tokens:*';
    
    do {
      const result = await redis.scan(cursor, {
        match: pattern,
        count: 100
      });
      
      cursor = parseInt(result[0]);
      const keys = result[1];
      
      // Process each user's tokens
      for (const key of keys) {
        const fid = key.split(':')[2];
        const userTokens = await redis.get(key) || [];
        
        // Check if user has a connected wallet
        const walletKey = `wallet:${fid}`;
        const walletData = await redis.get<WalletData>(walletKey);
        
        // Filter tokens by date range
        const tokenArray = Array.isArray(userTokens) ? userTokens : [];
        for (const token of tokenArray) {
          const tokenData = token as { address: string; name: string; symbol: string; createdAt: string };
          const tokenDate = new Date(tokenData.createdAt);
          if (tokenDate >= start && tokenDate <= end) {
            const deployment: DeploymentData = {
              tokenAddress: tokenData.address,
              name: tokenData.name,
              symbol: tokenData.symbol,
              createdAt: tokenData.createdAt,
              fid,
            };
            
            // Check for deployment details
            const deploymentKey = `deployment:${tokenData.address}`;
            const deploymentDetails = await redis.get(deploymentKey) as Record<string, unknown> | null;
            
            if (deploymentDetails) {
              deployment.creatorAdmin = deploymentDetails.creatorAdmin as string;
              deployment.creatorRewardRecipient = deploymentDetails.creatorRewardRecipient as string;
              deployment.creatorReward = deploymentDetails.creatorReward as number;
              deployment.txHash = deploymentDetails.txHash as string;
            }
            
            deployments.push(deployment);
            
            // Check for discrepancies
            if (walletData && walletData.enableCreatorRewards) {
              // User had wallet connected with rewards enabled
              if (!deployment.creatorRewardRecipient || 
                  deployment.creatorRewardRecipient.toLowerCase() !== walletData.address.toLowerCase()) {
                discrepancies.push({
                  tokenAddress: tokenData.address,
                  name: tokenData.name,
                  symbol: tokenData.symbol,
                  deployedAt: tokenData.createdAt,
                  fid,
                  issue: 'Creator reward recipient mismatch',
                  expected: walletData.address,
                  actual: deployment.creatorRewardRecipient || 'deployer address'
                });
              }
            }
            
            // Check if creator rewards were properly set
            if (deployment.creatorReward === 0 || deployment.creatorReward === undefined) {
              discrepancies.push({
                tokenAddress: tokenData.address,
                name: tokenData.name,
                symbol: tokenData.symbol,
                deployedAt: tokenData.createdAt,
                fid,
                issue: 'No creator rewards configured',
                expected: '80%',
                actual: `${deployment.creatorReward || 0}%`
              });
            }
          }
        }
      }
    } while (cursor !== 0);

    // Calculate summary statistics
    const deploymentsWithRewards = deployments.filter(d => 
      d.creatorRewardRecipient && d.creatorReward && d.creatorReward > 0
    ).length;
    
    const report: MonitoringReport = {
      period: {
        start: start.toISOString(),
        end: end.toISOString()
      },
      summary: {
        totalDeployments: deployments.length,
        deploymentsWithRewards,
        deploymentsWithoutRewards: deployments.length - deploymentsWithRewards,
        discrepanciesFound: discrepancies.length
      },
      discrepancies: discrepancies.sort((a, b) => 
        new Date(b.deployedAt).getTime() - new Date(a.deployedAt).getTime()
      ),
      deployments: deployments.sort((a, b) => 
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
      )
    };

    return NextResponse.json(report, { headers: getSecurityHeaders() });
  } catch (error) {
    console.error('Error in rewards monitoring:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500, headers: getSecurityHeaders() }
    );
  }
}