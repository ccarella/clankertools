import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { MonitoringSummary } from './types';

interface RewardsSummaryProps {
  summary: MonitoringSummary;
}

export function RewardsSummary({ summary }: RewardsSummaryProps) {
  const rewardRate = summary.totalDeployments > 0 
    ? (summary.deploymentsWithRewards / summary.totalDeployments * 100).toFixed(1)
    : '0';

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Total Deployments</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold">{summary.totalDeployments}</div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">With Rewards</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-green-600">
            {summary.deploymentsWithRewards}
          </div>
          <p className="text-xs text-muted-foreground mt-1">{rewardRate}%</p>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Without Rewards</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-orange-600">
            {summary.deploymentsWithoutRewards}
          </div>
        </CardContent>
      </Card>
      
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-sm font-medium">Discrepancies</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-2xl font-bold text-red-600">
            {summary.discrepanciesFound}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}