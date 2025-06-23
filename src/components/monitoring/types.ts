export interface DeploymentData {
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

export interface RewardDiscrepancy {
  tokenAddress: string;
  name: string;
  symbol: string;
  deployedAt: string;
  fid: string;
  issue: string;
  expected?: string;
  actual?: string;
}

export interface MonitoringSummary {
  totalDeployments: number;
  deploymentsWithRewards: number;
  deploymentsWithoutRewards: number;
  discrepanciesFound: number;
}

export interface MonitoringReport {
  period: {
    start: string;
    end: string;
  };
  summary: MonitoringSummary;
  discrepancies: RewardDiscrepancy[];
  deployments: DeploymentData[];
}