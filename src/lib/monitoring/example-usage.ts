/**
 * Example usage of the rewards monitoring functions
 * This file demonstrates how to use the monitoring system
 */

import {
  fetchDeploymentData,
  calculateExpectedRewards,
  verifyOnChainRewards,
  detectDiscrepancies,
  generateWeeklyReport,
  storeDeploymentForMonitoring,
  type DeploymentData,
} from './rewards-monitor';

// Example: Store a new deployment for monitoring
async function monitorNewDeployment() {
  const deployment: DeploymentData = {
    tokenAddress: '0x1234567890123456789012345678901234567890',
    tokenName: 'My Token',
    tokenSymbol: 'MTK',
    creatorAddress: '0xabcdef1234567890123456789012345678901234',
    creatorFid: '12345',
    deploymentDate: new Date().toISOString(),
    transactionHash: '0x' + '1'.repeat(64),
    feeConfiguration: {
      creatorFeePercentage: 80,
      platformFeePercentage: 20,
      totalFeePercentage: 1,
    },
    expectedCreatorPercentage: 80,
    expectedPlatformPercentage: 20,
    network: 'base',
  };

  await storeDeploymentForMonitoring(deployment);
  console.log('Deployment stored for monitoring');
}

// Example: Generate weekly report
async function generateReport() {
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - 7 * 24 * 60 * 60 * 1000); // 7 days ago

  // Fetch all deployments for the week
  const deployments = await fetchDeploymentData(startDate, endDate);
  console.log(`Found ${deployments.length} deployments this week`);

  // Generate the report
  const report = await generateWeeklyReport(deployments);
  
  console.log('Weekly Report Summary:');
  console.log(`- Total Deployments: ${report.totalDeployments}`);
  console.log(`- Deployments with Discrepancies: ${report.deploymentsWithDiscrepancies}`);
  console.log(`- Total Fees Collected: ${report.totalFeesCollected.toString()}`);
  console.log(`- Average Creator Percentage: ${report.averageCreatorPercentage.toFixed(2)}%`);
  
  // Log high severity discrepancies
  const highSeverity = report.discrepancies.filter(d => d.severity === 'high');
  if (highSeverity.length > 0) {
    console.log('\nHigh Severity Discrepancies:');
    highSeverity.forEach(d => {
      console.log(`- ${d.tokenName}: Expected ${d.expectedCreatorPercentage}%, got ${d.actualCreatorPercentage}%`);
    });
  }
}

// Example: Check a specific token for discrepancies
async function checkToken(tokenAddress: string) {
  // Fetch deployment data (would typically come from storage)
  const deployments = await fetchDeploymentData(new Date('2024-01-01'), new Date());
  const deployment = deployments.find(d => d.tokenAddress === tokenAddress);
  
  if (!deployment) {
    console.log('Deployment not found');
    return;
  }

  // Calculate expected rewards
  const expected = calculateExpectedRewards(deployment);
  console.log(`Expected split: ${expected.expectedCreatorPercentage}/${expected.expectedPlatformPercentage}`);

  // Verify on-chain rewards
  const onChainRewards = await verifyOnChainRewards(tokenAddress);
  if (!onChainRewards) {
    console.log('Could not fetch on-chain rewards');
    return;
  }

  // Check for discrepancies
  const discrepancy = detectDiscrepancies(deployment, onChainRewards);
  if (discrepancy) {
    console.log(`Discrepancy detected: ${discrepancy.severity} severity`);
    console.log(`- Expected: ${discrepancy.expectedCreatorPercentage}%`);
    console.log(`- Actual: ${discrepancy.actualCreatorPercentage}%`);
    console.log(`- Fee difference: ${discrepancy.feeDifference.toString()}`);
  } else {
    console.log('No discrepancies detected');
  }
}

// Example usage
if (require.main === module) {
  // Run examples
  (async () => {
    try {
      await monitorNewDeployment();
      await generateReport();
      await checkToken('0x1234567890123456789012345678901234567890');
    } catch (error) {
      console.error('Error:', error);
    }
  })();
}