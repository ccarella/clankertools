import {
  checkForDiscrepancies,
  getRecentAlerts,
  updateAlertStatus,
} from './alerts';

/**
 * Example: Running periodic discrepancy checks
 * This could be called from a cron job or scheduled task
 */
async function runPeriodicCheck() {
  try {
    console.log('Starting discrepancy check...');
    
    // Check last 24 hours of deployments
    const alerts = await checkForDiscrepancies(24);
    
    console.log(`Found ${alerts.length} discrepancies`);
    
    // Process critical alerts immediately
    const criticalAlerts = alerts.filter(alert => alert.severity === 'critical');
    if (criticalAlerts.length > 0) {
      console.log(`CRITICAL: ${criticalAlerts.length} critical alerts found!`);
      // TODO: Send urgent notifications (PagerDuty, SMS, etc.)
    }
  } catch (error) {
    console.error('Error during periodic check:', error);
  }
}

/**
 * Example: Retrieving alerts for a dashboard
 */
async function getDashboardAlerts() {
  try {
    // Get all active alerts from the last 7 days
    const activeAlerts = await getRecentAlerts({
      status: 'active',
      limit: 20,
    });
    
    // Get critical alerts specifically
    const criticalAlerts = await getRecentAlerts({
      severity: 'critical',
      limit: 10,
    });
    
    // Get alerts for a specific token
    const tokenAlerts = await getRecentAlerts({
      tokenAddress: '0x1234567890123456789012345678901234567890',
      limit: 5,
    });
    
    return {
      active: activeAlerts,
      critical: criticalAlerts,
      byToken: tokenAlerts,
    };
  } catch (error) {
    console.error('Error fetching dashboard alerts:', error);
    return { active: [], critical: [], byToken: [] };
  }
}

/**
 * Example: Alert management workflow
 */
async function handleAlert(alertId: string) {
  try {
    // First, acknowledge the alert to show it's being investigated
    await updateAlertStatus(alertId, 'acknowledged');
    console.log(`Alert ${alertId} acknowledged`);
    
    // Investigate the issue...
    // ... perform checks, contact token creator, etc ...
    
    // Once resolved, mark as resolved
    await updateAlertStatus(alertId, 'resolved');
    console.log(`Alert ${alertId} resolved`);
  } catch (error) {
    console.error('Error handling alert:', error);
  }
}

/**
 * Example: Monitoring specific tokens
 */
async function monitorHighValueTokens() {
  const highValueTokens = [
    '0x1234567890123456789012345678901234567890',
    '0x2345678901234567890123456789012345678901',
    // ... more token addresses
  ];
  
  try {
    for (const tokenAddress of highValueTokens) {
      const alerts = await getRecentAlerts({
        tokenAddress,
        startDate: new Date(Date.now() - 24 * 60 * 60 * 1000), // Last 24 hours
      });
      
      if (alerts.length > 0) {
        console.log(`Token ${tokenAddress} has ${alerts.length} alerts`);
        // Send specific notifications for high-value tokens
      }
    }
  } catch (error) {
    console.error('Error monitoring high-value tokens:', error);
  }
}

/**
 * Example: Alert summary report
 */
async function generateAlertSummary() {
  try {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
    
    // Get all alerts from the past week
    const allAlerts = await getRecentAlerts({
      startDate: weekAgo,
      endDate: now,
      limit: 1000,
    });
    
    // Group by severity
    const bySeverity = allAlerts.reduce((acc, alert) => {
      acc[alert.severity] = (acc[alert.severity] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Group by status
    const byStatus = allAlerts.reduce((acc, alert) => {
      acc[alert.status] = (acc[alert.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    
    // Calculate total revenue affected
    const totalRevenueAffected = allAlerts.reduce(
      (sum, alert) => sum + alert.revenueAffected,
      BigInt(0)
    );
    
    return {
      totalAlerts: allAlerts.length,
      bySeverity,
      byStatus,
      totalRevenueAffected: totalRevenueAffected.toString(),
      averagePercentageDifference:
        allAlerts.reduce((sum, alert) => sum + alert.percentageDifference, 0) / allAlerts.length,
    };
  } catch (error) {
    console.error('Error generating alert summary:', error);
    return null;
  }
}

// Export functions for use in other modules
export {
  runPeriodicCheck,
  getDashboardAlerts,
  handleAlert,
  monitorHighValueTokens,
  generateAlertSummary,
};