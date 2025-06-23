import { getRedisClient } from '@/lib/redis';
import { sanitizeRedisKey, validateInput, schemas } from '@/lib/security/input-validation';
import {
  fetchDeploymentData,
  verifyOnChainRewards,
  detectDiscrepancies,
  RewardDiscrepancy,
  DeploymentData,
} from './rewards-monitor';
import { z } from 'zod';

export type AlertSeverity = 'low' | 'medium' | 'high' | 'critical';
export type AlertStatus = 'active' | 'acknowledged' | 'resolved';

export interface AlertData {
  id: string;
  tokenAddress: string;
  tokenName: string;
  severity: AlertSeverity;
  type: 'fee_discrepancy' | 'reward_mismatch' | 'configuration_error';
  title: string;
  description: string;
  revenueAffected: bigint;
  percentageDifference: number;
  deploymentData?: DeploymentData;
  discrepancy?: RewardDiscrepancy;
  status: AlertStatus;
  createdAt: string;
  acknowledgedAt?: string;
  resolvedAt?: string;
}

// Schema for alert validation
const alertDataSchema = z.object({
  id: z.string().min(1),
  tokenAddress: schemas.tokenAddress,
  tokenName: z.string().min(1).max(100),
  severity: z.enum(['low', 'medium', 'high', 'critical']),
  type: z.enum(['fee_discrepancy', 'reward_mismatch', 'configuration_error']),
  title: z.string().min(1).max(200),
  description: z.string().min(1).max(1000),
  revenueAffected: z.bigint(),
  percentageDifference: z.number().min(0).max(100),
  status: z.enum(['active', 'acknowledged', 'resolved']),
  createdAt: z.string().datetime(),
  acknowledgedAt: z.string().datetime().optional(),
  resolvedAt: z.string().datetime().optional(),
});

/**
 * Main function to run periodic discrepancy checks
 */
export async function checkForDiscrepancies(
  lookbackHours: number = 24
): Promise<AlertData[]> {
  const alerts: AlertData[] = [];
  const endDate = new Date();
  const startDate = new Date(endDate.getTime() - lookbackHours * 60 * 60 * 1000);

  try {
    // Fetch recent deployments
    const deployments = await fetchDeploymentData(startDate, endDate);
    
    if (deployments.length === 0) {
      console.log(`No deployments found in the last ${lookbackHours} hours`);
      return alerts;
    }

    console.log(`Checking ${deployments.length} deployments for discrepancies...`);

    // Check each deployment for discrepancies
    for (const deployment of deployments) {
      try {
        const onChainRewards = await verifyOnChainRewards(deployment.tokenAddress);
        
        if (!onChainRewards) {
          console.warn(`Could not fetch on-chain rewards for ${deployment.tokenAddress}`);
          continue;
        }

        // Skip if no fees collected yet
        if (onChainRewards.totalFeesCollected === BigInt(0)) {
          continue;
        }

        const discrepancy = detectDiscrepancies(deployment, onChainRewards);
        
        if (discrepancy) {
          // Create alert for the discrepancy
          const alert = await createDiscrepancyAlert(deployment, discrepancy, onChainRewards.totalFeesCollected);
          alerts.push(alert);
          
          // Store the alert
          await storeAlert(alert);
          
          // Send the alert
          await sendAlert(alert);
        }
      } catch (error) {
        console.error(`Error checking discrepancy for ${deployment.tokenAddress}:`, error);
      }
    }

    console.log(`Found ${alerts.length} discrepancies requiring alerts`);
    return alerts;
  } catch (error) {
    console.error('Error in checkForDiscrepancies:', error);
    throw new Error('Failed to check for discrepancies');
  }
}

/**
 * Creates an alert object from a discrepancy
 */
function createDiscrepancyAlert(
  deployment: DeploymentData,
  discrepancy: RewardDiscrepancy,
  totalFeesCollected: bigint
): AlertData {
  const severity = categorizeAlertSeverity(discrepancy, totalFeesCollected);
  
  const alert: AlertData = {
    id: `alert_${deployment.tokenAddress}_${Date.now()}`,
    tokenAddress: deployment.tokenAddress,
    tokenName: deployment.tokenName,
    severity,
    type: 'fee_discrepancy',
    title: `Fee Distribution Discrepancy - ${deployment.tokenName}`,
    description: `Expected creator percentage: ${discrepancy.expectedCreatorPercentage}%, ` +
                `Actual: ${discrepancy.actualCreatorPercentage}%. ` +
                `Difference: ${discrepancy.percentageDifference.toFixed(2)}%. ` +
                `Revenue difference: ${discrepancy.feeDifference.toString()} wei.`,
    revenueAffected: discrepancy.feeDifference < 0 ? -discrepancy.feeDifference : discrepancy.feeDifference,
    percentageDifference: discrepancy.percentageDifference,
    deploymentData: deployment,
    discrepancy,
    status: 'active',
    createdAt: new Date().toISOString(),
  };

  return alert;
}

/**
 * Categorizes alert severity based on discrepancy details
 */
export function categorizeAlertSeverity(
  discrepancy: RewardDiscrepancy,
  totalFeesCollected: bigint
): AlertSeverity {
  const percentDiff = discrepancy.percentageDifference;
  const feeDiff = discrepancy.feeDifference < 0 ? -discrepancy.feeDifference : discrepancy.feeDifference;
  
  // Calculate the financial impact as a percentage of total fees
  const financialImpactPercent = totalFeesCollected > 0 
    ? Number((feeDiff * BigInt(100)) / totalFeesCollected)
    : 0;

  // Critical: High percentage difference AND significant revenue impact
  if (percentDiff >= 10 && (feeDiff > BigInt(10000000000000000) || financialImpactPercent > 10)) {
    return 'critical';
  }
  
  // High: Significant percentage difference OR high revenue impact
  if (percentDiff >= 5 || feeDiff > BigInt(1000000000000000) || financialImpactPercent > 5) {
    return 'high';
  }
  
  // Medium: Moderate differences
  if (percentDiff >= 2 || feeDiff > BigInt(100000000000000)) {
    return 'medium';
  }
  
  // Low: Minor differences
  return 'low';
}

/**
 * Sends alert notifications
 * TODO: Integrate with notification services (Discord, Telegram, Email, etc.)
 */
export async function sendAlert(alert: AlertData): Promise<void> {
  // Validate alert data
  const validation = validateInput(alert, alertDataSchema);
  if (!validation.success) {
    throw new Error(`Invalid alert data: ${validation.errors.join(', ')}`);
  }

  // Console log for now
  console.log('🚨 ALERT:', {
    severity: alert.severity.toUpperCase(),
    token: alert.tokenName,
    type: alert.type,
    title: alert.title,
    description: alert.description,
    revenueAffected: alert.revenueAffected.toString(),
    percentageDifference: `${alert.percentageDifference.toFixed(2)}%`,
  });

  // TODO: Implement actual notification sending
  // - Discord webhook
  // - Telegram bot
  // - Email notifications
  // - Slack integration
  // - PagerDuty for critical alerts
}

/**
 * Stores alert in Redis with expiry
 */
export async function storeAlert(alert: AlertData): Promise<void> {
  // Validate alert data
  const validation = validateInput(alert, alertDataSchema);
  if (!validation.success) {
    throw new Error(`Invalid alert data: ${validation.errors.join(', ')}`);
  }

  const client = getRedisClient();
  
  try {
    // Store individual alert
    const alertKey = `alert:${sanitizeRedisKey(alert.id)}`;
    await client.set(alertKey, alert);
    await client.expire(alertKey, 30 * 24 * 60 * 60); // 30 days retention
    
    // Add to severity-based index
    const severityKey = `alerts:severity:${alert.severity}:${new Date().toISOString().split('T')[0]}`;
    const severityAlerts = (await client.get<string[]>(severityKey)) || [];
    if (!severityAlerts.includes(alert.id)) {
      severityAlerts.push(alert.id);
      await client.set(severityKey, severityAlerts);
      await client.expire(severityKey, 30 * 24 * 60 * 60);
    }
    
    // Add to token-based index
    const tokenKey = `alerts:token:${sanitizeRedisKey(alert.tokenAddress)}`;
    const tokenAlerts = (await client.get<string[]>(tokenKey)) || [];
    if (!tokenAlerts.includes(alert.id)) {
      tokenAlerts.push(alert.id);
      await client.set(tokenKey, tokenAlerts);
      await client.expire(tokenKey, 30 * 24 * 60 * 60);
    }
    
    // Add to active alerts list if status is active
    if (alert.status === 'active') {
      const activeKey = 'alerts:active';
      const activeAlerts = (await client.get<string[]>(activeKey)) || [];
      if (!activeAlerts.includes(alert.id)) {
        activeAlerts.push(alert.id);
        await client.set(activeKey, activeAlerts);
      }
    }
  } catch (error) {
    console.error('Error storing alert:', error);
    throw new Error('Failed to store alert data');
  }
}

/**
 * Retrieves recent alerts for dashboard display
 */
export async function getRecentAlerts(
  options: {
    limit?: number;
    severity?: AlertSeverity;
    status?: AlertStatus;
    tokenAddress?: string;
    startDate?: Date;
    endDate?: Date;
  } = {}
): Promise<AlertData[]> {
  const {
    limit = 50,
    severity,
    status,
    tokenAddress,
    startDate = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Default 7 days
    endDate = new Date(),
  } = options;

  const client = getRedisClient();
  const alerts: AlertData[] = [];
  const processedIds = new Set<string>();

  try {
    // If filtering by token address
    if (tokenAddress) {
      const validation = validateInput(tokenAddress, schemas.tokenAddress);
      if (!validation.success) {
        throw new Error('Invalid token address format');
      }
      
      const tokenKey = `alerts:token:${sanitizeRedisKey(tokenAddress)}`;
      const tokenAlertIds = (await client.get<string[]>(tokenKey)) || [];
      
      for (const alertId of tokenAlertIds) {
        if (processedIds.has(alertId)) continue;
        
        const alertKey = `alert:${sanitizeRedisKey(alertId)}`;
        const alert = await client.get<AlertData>(alertKey);
        
        if (alert && isAlertInDateRange(alert, startDate, endDate)) {
          alerts.push(alert);
          processedIds.add(alertId);
        }
      }
    }

    // If filtering by severity
    if (severity && !tokenAddress) {
      const currentDate = new Date(startDate);
      while (currentDate <= endDate) {
        const dateKey = currentDate.toISOString().split('T')[0];
        const severityKey = `alerts:severity:${severity}:${dateKey}`;
        const severityAlertIds = (await client.get<string[]>(severityKey)) || [];
        
        for (const alertId of severityAlertIds) {
          if (processedIds.has(alertId)) continue;
          
          const alertKey = `alert:${sanitizeRedisKey(alertId)}`;
          const alert = await client.get<AlertData>(alertKey);
          
          if (alert) {
            alerts.push(alert);
            processedIds.add(alertId);
          }
        }
        
        currentDate.setDate(currentDate.getDate() + 1);
      }
    }

    // If no specific filters, get active alerts
    if (!tokenAddress && !severity) {
      const activeKey = 'alerts:active';
      const activeAlertIds = (await client.get<string[]>(activeKey)) || [];
      
      for (const alertId of activeAlertIds) {
        if (processedIds.has(alertId)) continue;
        
        const alertKey = `alert:${sanitizeRedisKey(alertId)}`;
        const alert = await client.get<AlertData>(alertKey);
        
        if (alert && isAlertInDateRange(alert, startDate, endDate)) {
          alerts.push(alert);
          processedIds.add(alertId);
        }
      }
    }

    // Filter by status if specified
    let filteredAlerts = alerts;
    if (status) {
      filteredAlerts = alerts.filter(alert => alert.status === status);
    }

    // Sort by creation date (newest first) and severity
    filteredAlerts.sort((a, b) => {
      const severityOrder = { critical: 0, high: 1, medium: 2, low: 3 };
      if (a.severity !== b.severity) {
        return severityOrder[a.severity] - severityOrder[b.severity];
      }
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });

    // Apply limit
    return filteredAlerts.slice(0, limit);
  } catch (error) {
    console.error('Error retrieving recent alerts:', error);
    throw new Error('Failed to retrieve alert data');
  }
}

/**
 * Helper function to check if alert is within date range
 */
function isAlertInDateRange(alert: AlertData, startDate: Date, endDate: Date): boolean {
  const alertDate = new Date(alert.createdAt);
  return alertDate >= startDate && alertDate <= endDate;
}

/**
 * Updates alert status (acknowledge or resolve)
 */
export async function updateAlertStatus(
  alertId: string,
  status: 'acknowledged' | 'resolved'
): Promise<void> {
  const client = getRedisClient();
  const alertKey = `alert:${sanitizeRedisKey(alertId)}`;
  
  try {
    const alert = await client.get<AlertData>(alertKey);
    if (!alert) {
      throw new Error('Alert not found');
    }

    // Update alert status and timestamp
    alert.status = status;
    if (status === 'acknowledged') {
      alert.acknowledgedAt = new Date().toISOString();
    } else if (status === 'resolved') {
      alert.resolvedAt = new Date().toISOString();
    }

    // Save updated alert
    await client.set(alertKey, alert);

    // Remove from active alerts if resolved
    if (status === 'resolved') {
      const activeKey = 'alerts:active';
      const activeAlerts = (await client.get<string[]>(activeKey)) || [];
      const updatedActiveAlerts = activeAlerts.filter(id => id !== alertId);
      await client.set(activeKey, updatedActiveAlerts);
    }
  } catch (error) {
    console.error('Error updating alert status:', error);
    if (error instanceof Error && error.message === 'Alert not found') {
      throw error;
    }
    throw new Error('Failed to update alert status');
  }
}