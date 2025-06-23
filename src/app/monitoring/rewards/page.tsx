'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useFarcasterAuth } from '@/components/providers/FarcasterAuthProvider';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { RewardsSummary } from '@/components/monitoring/RewardsSummary';
import { DeploymentsList } from '@/components/monitoring/DeploymentsList';
import { DiscrepancyAlerts } from '@/components/monitoring/DiscrepancyAlerts';
import { LoadingState } from '@/components/monitoring/LoadingState';
import { ErrorState } from '@/components/monitoring/ErrorState';
import type { MonitoringReport } from '@/components/monitoring/types';

const DATE_RANGES = [
  { value: '7d', label: 'Last 7 days' },
  { value: '30d', label: 'Last 30 days' },
  { value: '90d', label: 'Last 90 days' },
];

export default function RewardsMonitoring() {
  const router = useRouter();
  const { isAuthenticated } = useFarcasterAuth();
  const [dateRange, setDateRange] = useState('7d');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [report, setReport] = useState<MonitoringReport | null>(null);
  const [retryCounter, setRetryCounter] = useState(0);

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, router]);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      setError(null);

      const end = new Date();
      const start = new Date();
      
      switch (dateRange) {
        case '30d':
          start.setDate(start.getDate() - 30);
          break;
        case '90d':
          start.setDate(start.getDate() - 90);
          break;
        default:
          start.setDate(start.getDate() - 7);
      }

      try {
        const adminToken = localStorage.getItem('adminToken');
        if (!adminToken) {
          setError('Admin token required. Please set it in browser console: localStorage.setItem("adminToken", "your-token")');
          return;
        }

        const response = await fetch(`/api/monitoring/rewards?start=${start.toISOString()}&end=${end.toISOString()}`, {
          headers: {
            'Authorization': `Bearer ${adminToken}`,
          },
        });

        if (!response.ok) {
          if (response.status === 401) {
            throw new Error('Invalid admin token');
          }
          throw new Error('Failed to fetch monitoring data');
        }

        const data = await response.json();
        setReport(data);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'An error occurred');
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [dateRange, retryCounter]);

  const fetchMonitoringData = () => {
    setRetryCounter(prev => prev + 1);
  };

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="flex flex-col min-h-screen pb-20">
      <div className="flex-1 px-4 py-6">
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <h1 className="text-2xl font-bold">Rewards Monitoring</h1>
            <Badge variant="secondary">Admin</Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            Monitor token deployments and creator reward distributions
          </p>
        </div>

        <div className="mb-6">
          <Select value={dateRange} onValueChange={setDateRange}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Select date range" />
            </SelectTrigger>
            <SelectContent>
              {DATE_RANGES.map((range) => (
                <SelectItem key={range.value} value={range.value}>
                  {range.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {loading && <LoadingState />}
        
        {error && <ErrorState error={error} onRetry={fetchMonitoringData} />}
        
        {!loading && !error && report && (
          <div className="space-y-6">
            <RewardsSummary summary={report.summary} />
            
            {report.discrepancies.length > 0 && (
              <DiscrepancyAlerts discrepancies={report.discrepancies} />
            )}
            
            <DeploymentsList deployments={report.deployments} />
          </div>
        )}
      </div>
    </div>
  );
}