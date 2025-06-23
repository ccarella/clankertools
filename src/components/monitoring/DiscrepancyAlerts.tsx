import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, AlertTriangle } from 'lucide-react';
import type { RewardDiscrepancy } from './types';

interface DiscrepancyAlertsProps {
  discrepancies: RewardDiscrepancy[];
}

export function DiscrepancyAlerts({ discrepancies }: DiscrepancyAlertsProps) {
  const getSeverity = (issue: string): 'high' | 'medium' => {
    if (issue.includes('mismatch') || issue.includes('No creator rewards')) {
      return 'high';
    }
    return 'medium';
  };

  const groupedDiscrepancies = discrepancies.reduce((acc, disc) => {
    const severity = getSeverity(disc.issue);
    if (!acc[severity]) {
      acc[severity] = [];
    }
    acc[severity].push(disc);
    return acc;
  }, {} as Record<string, RewardDiscrepancy[]>);

  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Discrepancy Alerts</h2>
      
      {groupedDiscrepancies.high && groupedDiscrepancies.high.length > 0 && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>High Priority Issues</AlertTitle>
          <AlertDescription>
            <div className="mt-2 space-y-2">
              {groupedDiscrepancies.high.slice(0, 5).map((disc, idx) => (
                <div key={idx} className="text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="destructive" className="text-xs">
                      {disc.issue}
                    </Badge>
                    <span className="font-mono text-xs">FID: {disc.fid}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {disc.name} ({disc.symbol}) - {new Date(disc.deployedAt).toLocaleDateString()}
                  </div>
                  {disc.expected && disc.actual && (
                    <div className="text-xs mt-1">
                      Expected: {disc.expected} → Actual: {disc.actual}
                    </div>
                  )}
                </div>
              ))}
              {groupedDiscrepancies.high.length > 5 && (
                <p className="text-xs text-muted-foreground mt-2">
                  ... and {groupedDiscrepancies.high.length - 5} more
                </p>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}
      
      {groupedDiscrepancies.medium && groupedDiscrepancies.medium.length > 0 && (
        <Alert>
          <AlertTriangle className="h-4 w-4" />
          <AlertTitle>Medium Priority Issues</AlertTitle>
          <AlertDescription>
            <div className="mt-2 space-y-2">
              {groupedDiscrepancies.medium.slice(0, 3).map((disc, idx) => (
                <div key={idx} className="text-sm">
                  <div className="flex items-center gap-2 mb-1">
                    <Badge variant="secondary" className="text-xs">
                      {disc.issue}
                    </Badge>
                    <span className="font-mono text-xs">FID: {disc.fid}</span>
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {disc.name} ({disc.symbol})
                  </div>
                </div>
              ))}
              {groupedDiscrepancies.medium.length > 3 && (
                <p className="text-xs text-muted-foreground mt-2">
                  ... and {groupedDiscrepancies.medium.length - 3} more
                </p>
              )}
            </div>
          </AlertDescription>
        </Alert>
      )}
    </div>
  );
}