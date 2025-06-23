/**
 * Example usage of the weekly report generator
 * 
 * This demonstrates how to generate reports, retrieve history, and export to different formats
 */

import { generateWeeklyReport, getReportHistory, generateMarkdownReport } from './report-generator';
import { storeDeploymentForMonitoring } from './rewards-monitor';

async function exampleUsage() {
  // 1. First, ensure you have deployment data stored
  // This would typically happen when tokens are deployed
  await storeDeploymentForMonitoring({
    tokenAddress: '0x1234567890123456789012345678901234567890',
    tokenName: 'Example Token',
    tokenSymbol: 'EXT',
    creatorAddress: '0xabcdef1234567890123456789012345678901234',
    creatorFid: '12345',
    deploymentDate: new Date().toISOString(),
    transactionHash: '0xabc1234567890123456789012345678901234567890123456789012345678901',
    feeConfiguration: {
      creatorFeePercentage: 80,
      platformFeePercentage: 20,
      totalFeePercentage: 100,
    },
    expectedCreatorPercentage: 80,
    expectedPlatformPercentage: 20,
    network: 'base',
  });

  // 2. Generate a weekly report for the current week
  console.log('Generating weekly report...');
  const currentReport = await generateWeeklyReport();
  
  console.log('Executive Summary:');
  console.log(`- Health Score: ${currentReport.executiveSummary.healthScore}/100`);
  console.log(`- Total Deployments: ${currentReport.executiveSummary.totalDeployments}`);
  console.log(`- Total Revenue: ${currentReport.executiveSummary.totalRevenue} ETH`);
  console.log(`- Discrepancy Rate: ${currentReport.executiveSummary.discrepancyRate.toFixed(2)}%`);

  // 3. Generate a report for a specific week
  const lastWeekEnd = new Date();
  lastWeekEnd.setDate(lastWeekEnd.getDate() - 7);
  await generateWeeklyReport(lastWeekEnd);

  // 4. Get report history
  console.log('\nFetching report history...');
  const history = await getReportHistory(4); // Get last 4 reports
  
  console.log(`Found ${history.length} reports:`);
  history.forEach(report => {
    console.log(`- ${report.id}: ${report.executiveSummary.totalDeployments} deployments, ${report.executiveSummary.healthScore}/100 health`);
  });

  // 5. Export report as markdown
  const markdown = generateMarkdownReport(currentReport);
  console.log('\nMarkdown report preview:');
  console.log(markdown.split('\n').slice(0, 10).join('\n') + '\n...');

  // 6. Access via API
  console.log('\nAPI endpoints available:');
  console.log('- GET /api/monitoring/reports - Get latest report');
  console.log('- GET /api/monitoring/reports?action=history&limit=10 - Get report history');
  console.log('- GET /api/monitoring/reports?action=generate&endDate=2024-01-20 - Generate specific report');
  console.log('- GET /api/monitoring/reports?format=markdown - Export as markdown');
  console.log('- POST /api/monitoring/reports - Generate new report');

  // 7. Check for critical issues
  if (currentReport.executiveSummary.healthScore < 70) {
    console.warn('\n⚠️  CRITICAL: System health is below 70!');
    console.warn('Recommendations:');
    currentReport.recommendations.forEach(rec => console.warn(`- ${rec}`));
  }

  // 8. Analyze trends
  console.log('\nTrends:');
  console.log(`- Deployments: ${currentReport.trends.deploymentTrend}`);
  console.log(`- Revenue: ${currentReport.trends.revenueTrend}`);
  console.log(`- Discrepancies: ${currentReport.trends.discrepancyTrend}`);
}

// Run the example
if (require.main === module) {
  exampleUsage().catch(console.error);
}