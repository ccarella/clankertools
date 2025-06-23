import { getRedisClient } from '@/lib/redis';
import { sanitizeRedisKey } from '@/lib/security/input-validation';
import {
  fetchDeploymentData,
  verifyOnChainRewards,
  detectDiscrepancies,
  type DeploymentData,
  type OnChainRewards,
  type RewardDiscrepancy,
  type WeeklyReportData,
} from './rewards-monitor';

export interface WeeklyReport {
  id: string;
  generatedAt: string;
  period: {
    startDate: string;
    endDate: string;
  };
  executiveSummary: {
    totalDeployments: number;
    totalRevenue: string;
    creatorRevenue: string;
    platformRevenue: string;
    averageCreatorShare: number;
    discrepancyRate: number;
    healthScore: number;
  };
  deploymentStatistics: {
    totalCount: number;
    averagePerDay: number;
    peakDay: {
      date: string;
      count: number;
    };
    byNetwork: {
      base: number;
      'base-sepolia': number;
    };
    uniqueCreators: number;
  };
  revenueBreakdown: {
    totalCollected: string;
    creatorFees: {
      amount: string;
      percentage: number;
    };
    platformFees: {
      amount: string;
      percentage: number;
    };
    averageFeePerDeployment: string;
    topTokensByRevenue: Array<{
      tokenAddress: string;
      tokenName: string;
      revenue: string;
    }>;
  };
  discrepancyAnalysis: {
    totalDiscrepancies: number;
    severityBreakdown: {
      high: number;
      medium: number;
      low: number;
    };
    totalValueAtRisk: string;
    topDiscrepancies: RewardDiscrepancy[];
    recommendations: string[];
  };
  trends: {
    deploymentTrend: 'increasing' | 'decreasing' | 'stable';
    revenueTrend: 'increasing' | 'decreasing' | 'stable';
    discrepancyTrend: 'improving' | 'worsening' | 'stable';
  };
  recommendations: string[];
  rawData: WeeklyReportData;
}

function formatBigIntToString(value: bigint): string {
  // Convert to ETH assuming 18 decimals
  const eth = Number(value) / 1e18;
  return eth.toFixed(6);
}

function calculateHealthScore(report: WeeklyReportData): number {
  let score = 100;
  
  // Deduct points for discrepancies
  const discrepancyRate = report.deploymentsWithDiscrepancies / Math.max(report.totalDeployments, 1);
  score -= discrepancyRate * 30;
  
  // Deduct points for severe discrepancies
  const severeCount = report.discrepancies.filter(d => d.severity === 'high').length;
  score -= severeCount * 5;
  
  // Deduct points if creator percentage is too low
  if (report.averageCreatorPercentage < 75) {
    score -= 10;
  }
  
  return Math.max(0, Math.min(100, Math.round(score)));
}

function analyzeTrends(
  currentWeek: WeeklyReportData,
  previousWeek?: WeeklyReportData
): WeeklyReport['trends'] {
  if (!previousWeek) {
    return {
      deploymentTrend: 'stable',
      revenueTrend: 'stable',
      discrepancyTrend: 'stable',
    };
  }
  
  // Deployment trend
  const deploymentChange = currentWeek.totalDeployments - previousWeek.totalDeployments;
  const deploymentTrend = 
    deploymentChange > previousWeek.totalDeployments * 0.1 ? 'increasing' :
    deploymentChange < -previousWeek.totalDeployments * 0.1 ? 'decreasing' : 'stable';
  
  // Revenue trend
  const revenueChange = Number(currentWeek.totalFeesCollected - previousWeek.totalFeesCollected);
  const previousRevenue = Number(previousWeek.totalFeesCollected);
  const revenueTrend = 
    revenueChange > previousRevenue * 0.1 ? 'increasing' :
    revenueChange < -previousRevenue * 0.1 ? 'decreasing' : 'stable';
  
  // Discrepancy trend
  const currentDiscrepancyRate = currentWeek.deploymentsWithDiscrepancies / Math.max(currentWeek.totalDeployments, 1);
  const previousDiscrepancyRate = previousWeek.deploymentsWithDiscrepancies / Math.max(previousWeek.totalDeployments, 1);
  const discrepancyTrend = 
    currentDiscrepancyRate < previousDiscrepancyRate * 0.9 ? 'improving' :
    currentDiscrepancyRate > previousDiscrepancyRate * 1.1 ? 'worsening' : 'stable';
  
  return { deploymentTrend, revenueTrend, discrepancyTrend };
}

function generateRecommendations(report: WeeklyReportData, healthScore: number): string[] {
  const recommendations: string[] = [];
  
  // Health score based recommendations
  if (healthScore < 70) {
    recommendations.push('Critical: System health score is below 70. Immediate investigation required.');
  }
  
  // Discrepancy based recommendations
  const discrepancyRate = report.deploymentsWithDiscrepancies / Math.max(report.totalDeployments, 1);
  if (discrepancyRate > 0.2) {
    recommendations.push('High discrepancy rate detected. Review fee distribution configuration.');
  }
  
  const highSeverityCount = report.discrepancies.filter(d => d.severity === 'high').length;
  if (highSeverityCount > 0) {
    recommendations.push(`${highSeverityCount} high-severity discrepancies found. Investigate token contracts immediately.`);
  }
  
  // Creator percentage recommendations
  if (report.averageCreatorPercentage < 75) {
    recommendations.push('Average creator share is below 75%. Consider reviewing platform fee structure.');
  }
  
  // Volume based recommendations
  if (report.totalDeployments === 0) {
    recommendations.push('No deployments recorded this week. Check system connectivity and API health.');
  } else if (report.totalDeployments < 10) {
    recommendations.push('Low deployment volume. Consider marketing initiatives to increase platform usage.');
  }
  
  // Revenue recommendations
  if (report.totalFeesCollected === BigInt(0)) {
    recommendations.push('No fees collected this week. Verify fee collection mechanisms are functioning.');
  }
  
  return recommendations;
}

async function enrichDeploymentData(deployments: DeploymentData[]): Promise<{
  deployments: DeploymentData[];
  onChainRewards: Map<string, OnChainRewards>;
  uniqueCreators: Set<string>;
  networkBreakdown: { base: number; 'base-sepolia': number };
}> {
  const onChainRewards = new Map<string, OnChainRewards>();
  const uniqueCreators = new Set<string>();
  const networkBreakdown = { base: 0, 'base-sepolia': 0 };
  
  for (const deployment of deployments) {
    // Track unique creators
    uniqueCreators.add(deployment.creatorAddress.toLowerCase());
    
    // Track network breakdown
    networkBreakdown[deployment.network]++;
    
    // Fetch on-chain rewards
    const rewards = await verifyOnChainRewards(deployment.tokenAddress);
    if (rewards) {
      onChainRewards.set(deployment.tokenAddress.toLowerCase(), rewards);
    }
  }
  
  return { deployments, onChainRewards, uniqueCreators, networkBreakdown };
}

export async function generateWeeklyReport(endDate?: Date): Promise<WeeklyReport> {
  // Calculate date range
  const end = endDate || new Date();
  const start = new Date(end);
  start.setDate(start.getDate() - 7);
  
  // Fetch deployment data
  const deployments = await fetchDeploymentData(start, end);
  
  // Enrich deployment data
  const { onChainRewards, uniqueCreators, networkBreakdown } = await enrichDeploymentData(deployments);
  
  // Calculate statistics
  let totalFeesCollected = BigInt(0);
  let totalCreatorFees = BigInt(0);
  let totalPlatformFees = BigInt(0);
  const discrepancies: RewardDiscrepancy[] = [];
  const deploymentsByDay: Record<string, number> = {};
  const feesByDay: Record<string, bigint> = {};
  const tokenRevenues: Array<{ tokenAddress: string; tokenName: string; revenue: bigint }> = [];
  
  for (const deployment of deployments) {
    const rewards = onChainRewards.get(deployment.tokenAddress.toLowerCase());
    
    if (rewards) {
      totalFeesCollected += rewards.totalFeesCollected;
      totalCreatorFees += rewards.creatorFeesReceived;
      totalPlatformFees += rewards.platformFeesReceived;
      
      // Track token revenues
      if (rewards.totalFeesCollected > BigInt(0)) {
        tokenRevenues.push({
          tokenAddress: deployment.tokenAddress,
          tokenName: deployment.tokenName,
          revenue: rewards.totalFeesCollected,
        });
      }
      
      // Check for discrepancies
      const discrepancy = detectDiscrepancies(deployment, rewards);
      if (discrepancy) {
        discrepancies.push(discrepancy);
      }
    }
    
    // Track deployments by day
    const dayKey = deployment.deploymentDate.split('T')[0];
    deploymentsByDay[dayKey] = (deploymentsByDay[dayKey] || 0) + 1;
    
    // Track fees by day
    if (rewards) {
      feesByDay[dayKey] = (feesByDay[dayKey] || BigInt(0)) + rewards.totalFeesCollected;
    }
  }
  
  // Sort token revenues
  tokenRevenues.sort((a, b) => Number(b.revenue - a.revenue));
  
  // Find peak deployment day
  let peakDay = { date: '', count: 0 };
  for (const [date, count] of Object.entries(deploymentsByDay)) {
    if (count > peakDay.count) {
      peakDay = { date, count };
    }
  }
  
  // Calculate averages
  const averageCreatorPercentage = deployments.length > 0
    ? deployments.reduce((sum, d) => sum + (d.expectedCreatorPercentage || 80), 0) / deployments.length
    : 80;
  
  const averagePerDay = deployments.length / 7;
  const averageFeePerDeployment = deployments.length > 0
    ? totalFeesCollected / BigInt(deployments.length)
    : BigInt(0);
  
  // Create raw report data
  const rawData: WeeklyReportData = {
    startDate: start.toISOString(),
    endDate: end.toISOString(),
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
  
  const healthScore = calculateHealthScore(rawData);
  
  // Get previous week's report for trend analysis
  const previousWeekEnd = new Date(start);
  previousWeekEnd.setDate(previousWeekEnd.getDate() - 1);
  const previousReportId = `weekly-report-${previousWeekEnd.toISOString().split('T')[0]}`;
  const client = getRedisClient();
  const previousReport = await client.get<WeeklyReport>(previousReportId);
  
  const trends = analyzeTrends(rawData, previousReport?.rawData);
  
  // Calculate discrepancy severity breakdown
  const severityBreakdown = {
    high: discrepancies.filter(d => d.severity === 'high').length,
    medium: discrepancies.filter(d => d.severity === 'medium').length,
    low: discrepancies.filter(d => d.severity === 'low').length,
  };
  
  // Calculate total value at risk
  const totalValueAtRisk = discrepancies.reduce(
    (sum, d) => sum + (d.feeDifference < 0 ? -d.feeDifference : d.feeDifference),
    BigInt(0)
  );
  
  // Generate discrepancy recommendations
  const discrepancyRecommendations: string[] = [];
  if (severityBreakdown.high > 0) {
    discrepancyRecommendations.push('Investigate high-severity discrepancies immediately');
  }
  if (discrepancies.length > deployments.length * 0.1) {
    discrepancyRecommendations.push('Review smart contract fee distribution logic');
  }
  if (totalValueAtRisk > totalFeesCollected / BigInt(10)) {
    discrepancyRecommendations.push('Significant value at risk - audit fee collection process');
  }
  
  const recommendations = generateRecommendations(rawData, healthScore);
  
  // Create the report
  const report: WeeklyReport = {
    id: `weekly-report-${end.toISOString().split('T')[0]}`,
    generatedAt: new Date().toISOString(),
    period: {
      startDate: start.toISOString(),
      endDate: end.toISOString(),
    },
    executiveSummary: {
      totalDeployments: deployments.length,
      totalRevenue: formatBigIntToString(totalFeesCollected),
      creatorRevenue: formatBigIntToString(totalCreatorFees),
      platformRevenue: formatBigIntToString(totalPlatformFees),
      averageCreatorShare: averageCreatorPercentage,
      discrepancyRate: deployments.length > 0 ? (discrepancies.length / deployments.length) * 100 : 0,
      healthScore,
    },
    deploymentStatistics: {
      totalCount: deployments.length,
      averagePerDay,
      peakDay,
      byNetwork: networkBreakdown,
      uniqueCreators: uniqueCreators.size,
    },
    revenueBreakdown: {
      totalCollected: formatBigIntToString(totalFeesCollected),
      creatorFees: {
        amount: formatBigIntToString(totalCreatorFees),
        percentage: totalFeesCollected > BigInt(0)
          ? Number((totalCreatorFees * BigInt(100)) / totalFeesCollected)
          : 0,
      },
      platformFees: {
        amount: formatBigIntToString(totalPlatformFees),
        percentage: totalFeesCollected > BigInt(0)
          ? Number((totalPlatformFees * BigInt(100)) / totalFeesCollected)
          : 0,
      },
      averageFeePerDeployment: formatBigIntToString(averageFeePerDeployment),
      topTokensByRevenue: tokenRevenues.slice(0, 5).map(t => ({
        tokenAddress: t.tokenAddress,
        tokenName: t.tokenName,
        revenue: formatBigIntToString(t.revenue),
      })),
    },
    discrepancyAnalysis: {
      totalDiscrepancies: discrepancies.length,
      severityBreakdown,
      totalValueAtRisk: formatBigIntToString(totalValueAtRisk),
      topDiscrepancies: discrepancies.slice(0, 5),
      recommendations: discrepancyRecommendations,
    },
    trends,
    recommendations,
    rawData,
  };
  
  // Store the report
  await storeReport(report);
  
  return report;
}

async function storeReport(report: WeeklyReport): Promise<void> {
  const client = getRedisClient();
  const key = sanitizeRedisKey(report.id);
  
  try {
    await client.set(key, report);
    await client.expire(key, 90 * 24 * 60 * 60); // 90 days retention
    
    // Update report index
    const indexKey = 'weekly-reports:index';
    const index = (await client.get<string[]>(indexKey)) || [];
    
    if (!index.includes(report.id)) {
      index.push(report.id);
      // Keep only last 13 weeks in index
      if (index.length > 13) {
        index.shift();
      }
      await client.set(indexKey, index);
    }
  } catch (error) {
    console.error('Error storing weekly report:', error);
    throw new Error('Failed to store weekly report');
  }
}

export async function getReportHistory(limit = 12): Promise<WeeklyReport[]> {
  const client = getRedisClient();
  
  try {
    const indexKey = 'weekly-reports:index';
    const index = (await client.get<string[]>(indexKey)) || [];
    
    // Get the most recent reports
    const recentIds = index.slice(-limit).reverse();
    const reports: WeeklyReport[] = [];
    
    for (const id of recentIds) {
      const report = await client.get<WeeklyReport>(sanitizeRedisKey(id));
      if (report) {
        reports.push(report);
      }
    }
    
    return reports;
  } catch (error) {
    console.error('Error fetching report history:', error);
    throw new Error('Failed to fetch report history');
  }
}

export function generateMarkdownReport(report: WeeklyReport): string {
  const md: string[] = [];
  
  md.push(`# Weekly Report - ${report.period.startDate.split('T')[0]} to ${report.period.endDate.split('T')[0]}`);
  md.push(`Generated: ${report.generatedAt}\n`);
  
  md.push('## Executive Summary');
  md.push(`- **Health Score**: ${report.executiveSummary.healthScore}/100`);
  md.push(`- **Total Deployments**: ${report.executiveSummary.totalDeployments}`);
  md.push(`- **Total Revenue**: ${report.executiveSummary.totalRevenue} ETH`);
  md.push(`- **Creator Revenue**: ${report.executiveSummary.creatorRevenue} ETH (${report.executiveSummary.averageCreatorShare}%)`);
  md.push(`- **Platform Revenue**: ${report.executiveSummary.platformRevenue} ETH`);
  md.push(`- **Discrepancy Rate**: ${report.executiveSummary.discrepancyRate.toFixed(2)}%\n`);
  
  md.push('## Deployment Statistics');
  md.push(`- **Total Deployments**: ${report.deploymentStatistics.totalCount}`);
  md.push(`- **Average per Day**: ${report.deploymentStatistics.averagePerDay.toFixed(2)}`);
  md.push(`- **Peak Day**: ${report.deploymentStatistics.peakDay.date} (${report.deploymentStatistics.peakDay.count} deployments)`);
  md.push(`- **Unique Creators**: ${report.deploymentStatistics.uniqueCreators}`);
  md.push(`- **Network Distribution**:`);
  md.push(`  - Base: ${report.deploymentStatistics.byNetwork.base}`);
  md.push(`  - Base Sepolia: ${report.deploymentStatistics.byNetwork['base-sepolia']}\n`);
  
  md.push('## Revenue Breakdown');
  md.push(`- **Total Collected**: ${report.revenueBreakdown.totalCollected} ETH`);
  md.push(`- **Creator Fees**: ${report.revenueBreakdown.creatorFees.amount} ETH (${report.revenueBreakdown.creatorFees.percentage}%)`);
  md.push(`- **Platform Fees**: ${report.revenueBreakdown.platformFees.amount} ETH (${report.revenueBreakdown.platformFees.percentage}%)`);
  md.push(`- **Average per Deployment**: ${report.revenueBreakdown.averageFeePerDeployment} ETH\n`);
  
  if (report.revenueBreakdown.topTokensByRevenue.length > 0) {
    md.push('### Top Tokens by Revenue');
    report.revenueBreakdown.topTokensByRevenue.forEach((token, i) => {
      md.push(`${i + 1}. **${token.tokenName}** - ${token.revenue} ETH`);
    });
    md.push('');
  }
  
  md.push('## Discrepancy Analysis');
  md.push(`- **Total Discrepancies**: ${report.discrepancyAnalysis.totalDiscrepancies}`);
  md.push(`- **Severity Breakdown**:`);
  md.push(`  - High: ${report.discrepancyAnalysis.severityBreakdown.high}`);
  md.push(`  - Medium: ${report.discrepancyAnalysis.severityBreakdown.medium}`);
  md.push(`  - Low: ${report.discrepancyAnalysis.severityBreakdown.low}`);
  md.push(`- **Total Value at Risk**: ${report.discrepancyAnalysis.totalValueAtRisk} ETH\n`);
  
  if (report.discrepancyAnalysis.topDiscrepancies.length > 0) {
    md.push('### Top Discrepancies');
    report.discrepancyAnalysis.topDiscrepancies.forEach((d, i) => {
      md.push(`${i + 1}. **${d.tokenName}** (${d.severity})`);
      md.push(`   - Expected: ${d.expectedCreatorPercentage}%, Actual: ${d.actualCreatorPercentage}%`);
      md.push(`   - Difference: ${d.percentageDifference.toFixed(2)}%`);
    });
    md.push('');
  }
  
  md.push('## Trends');
  md.push(`- **Deployment Trend**: ${report.trends.deploymentTrend}`);
  md.push(`- **Revenue Trend**: ${report.trends.revenueTrend}`);
  md.push(`- **Discrepancy Trend**: ${report.trends.discrepancyTrend}\n`);
  
  if (report.recommendations.length > 0) {
    md.push('## Recommendations');
    report.recommendations.forEach(rec => {
      md.push(`- ${rec}`);
    });
  }
  
  return md.join('\n');
}