export enum DiscrepancyType {
  MISSING_CREATOR_REWARD = 'MISSING_CREATOR_REWARD',
  MISSING_PLATFORM_FEE = 'MISSING_PLATFORM_FEE',
  INCORRECT_CREATOR_AMOUNT = 'INCORRECT_CREATOR_AMOUNT',
  INCORRECT_PLATFORM_AMOUNT = 'INCORRECT_PLATFORM_AMOUNT',
  DELAYED_PAYMENT = 'DELAYED_PAYMENT',
  UNKNOWN_RECIPIENT = 'UNKNOWN_RECIPIENT'
}

export interface DeploymentMonitoringData {
  tokenAddress: string
  deploymentTxHash: string
  timestamp: number
  expectedCreatorReward: bigint
  expectedPlatformFee: bigint
  actualCreatorReward: bigint
  actualPlatformFee: bigint
  creatorAddress: string
  platformFeeRecipient: string
  totalRevenueGenerated: bigint
  discrepancyDetected: boolean
  discrepancyDetails?: {
    type: DiscrepancyType
    description: string
    expectedValue?: string
    actualValue?: string
  }
}

export interface WeeklyReportData {
  reportPeriod: {
    startDate: Date
    endDate: Date
  }
  totalDeployments: number
  totalRevenueGenerated: bigint
  totalCreatorRewards: bigint
  totalPlatformFees: bigint
  discrepancyCount: number
  deploymentBreakdown: DeploymentMonitoringData[]
}

export interface AlertData {
  id: string
  type: 'DISCREPANCY' | 'THRESHOLD_EXCEEDED' | 'SYSTEM_ERROR'
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL'
  title: string
  message: string
  timestamp: number
  metadata?: {
    tokenAddress?: string
    deploymentTxHash?: string
    discrepancyType?: DiscrepancyType
    affectedAmount?: string
    [key: string]: unknown
  }
  acknowledged: boolean
  acknowledgedAt?: number
  acknowledgedBy?: string
}

export interface MonitoringThresholds {
  maxDiscrepancyAmount: bigint
  maxDiscrepancyPercentage: number
  alertDelayMinutes: number
  criticalDiscrepancyCount: number
}

export interface MonitoringStatus {
  isActive: boolean
  lastCheckTimestamp: number
  nextCheckTimestamp: number
  deploymentsMonitored: number
  discrepanciesDetected: number
  totalRevenueTracked: bigint
}

export interface RevenueMetrics {
  period: 'DAILY' | 'WEEKLY' | 'MONTHLY' | 'ALL_TIME'
  totalRevenue: bigint
  creatorRewards: bigint
  platformFees: bigint
  deploymentCount: number
  averageRevenuePerDeployment: bigint
  discrepancyRate: number
}

export interface MonitoringConfig {
  enabled: boolean
  checkIntervalMinutes: number
  thresholds: MonitoringThresholds
  alertChannels: Array<'EMAIL' | 'WEBHOOK' | 'CONSOLE'>
  webhookUrl?: string
  emailRecipients?: string[]
}

export type MonitoringEvent = 
  | { type: 'DEPLOYMENT_DETECTED'; data: { tokenAddress: string; txHash: string } }
  | { type: 'DISCREPANCY_FOUND'; data: DeploymentMonitoringData }
  | { type: 'ALERT_CREATED'; data: AlertData }
  | { type: 'REPORT_GENERATED'; data: WeeklyReportData }
  | { type: 'MONITORING_ERROR'; data: { error: string; context?: unknown } }

export interface MonitoringEventHandler {
  handleEvent: (event: MonitoringEvent) => Promise<void>
}