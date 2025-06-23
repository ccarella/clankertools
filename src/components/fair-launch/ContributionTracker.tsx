'use client';

import React from 'react';
import { cn } from '@/lib/utils';
import { Progress } from '@/components/ui/progress';

interface ContributionTrackerProps {
  totalRaised: number;
  targetAmount: number;
  contributorCount: number;
  userContribution?: number;
  minContribution: number;
  maxContribution: number;
  className?: string;
}

export function ContributionTracker({
  totalRaised,
  targetAmount,
  contributorCount,
  userContribution,
  minContribution,
  maxContribution,
  className,
}: ContributionTrackerProps) {
  const progressPercentage = Math.min((totalRaised / targetAmount) * 100, 100);

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);
  };

  return (
    <div className={cn('space-y-4 p-6 rounded-lg bg-background/50 backdrop-blur border', className)}>
      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-muted-foreground">Total Raised</p>
          <p className="text-sm font-medium">{progressPercentage.toFixed(0)}%</p>
        </div>
        <div className="mb-2">
          <p className="text-2xl font-bold">{formatCurrency(totalRaised)}</p>
          <p className="text-sm text-muted-foreground">of {formatCurrency(targetAmount)}</p>
        </div>
        <Progress value={progressPercentage} className="h-2" />
      </div>

      <div className="flex items-center justify-between pt-2 border-t">
        <div>
          <p className="text-sm text-muted-foreground">Contributors</p>
          <p className="font-medium">{contributorCount} Contributors</p>
        </div>
        <div className="text-right">
          <p className="text-sm text-muted-foreground">Limits</p>
          <p className="text-xs">
            Min: {formatCurrency(minContribution)} / Max: {formatCurrency(maxContribution)}
          </p>
        </div>
      </div>

      {userContribution !== undefined && (
        <div className="pt-4 border-t">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">Your Contribution</p>
            <p className="text-lg font-bold text-primary">{formatCurrency(userContribution)}</p>
          </div>
        </div>
      )}
    </div>
  );
}