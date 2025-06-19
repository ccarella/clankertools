"use client";

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { 
  CheckCircle2, 
  Wallet, 
  TrendingUp, 
  Settings, 
  Gift, 
  Package, 
  Shield,
  Edit2,
  AlertCircle
} from 'lucide-react';
import { WizardData } from './types';

interface ReviewScreenProps {
  data: WizardData;
  onEdit: (stepIndex: number) => void;
  onDeploy: () => Promise<void>;
  isDeploying?: boolean;
}

interface SectionItem {
  label: string;
  value: string;
  isBadge?: boolean;
}

export function ReviewScreen({ data, onEdit, onDeploy, isDeploying }: ReviewScreenProps) {
  const sections: Array<{
    title: string;
    icon: React.ComponentType<{ className?: string }>;
    stepIndex: number;
    items: SectionItem[];
  }> = [
    {
      title: 'Token Basics',
      icon: CheckCircle2,
      stepIndex: 0,
      items: [
        { label: 'Name', value: data.name || '' },
        { label: 'Symbol', value: data.symbol || '' },
        { label: 'Description', value: data.description || 'Not provided' },
        { label: 'Image', value: data.image ? 'Uploaded' : 'Not provided' },
      ],
    },
    {
      title: 'Liquidity Settings',
      icon: TrendingUp,
      stepIndex: 1,
      items: [
        { label: 'Initial Liquidity', value: `${data.liquidityAmount || 0} ETH` },
        { label: 'Liquidity Curve', value: data.liquidityCurve || 'Linear' },
        { label: 'LP Token Symbol', value: data.lpTokenSymbol || 'Auto-generated' },
        { label: 'Max Slippage', value: `${data.maxSlippage || 5}%` },
      ],
    },
    {
      title: 'Fee Configuration',
      icon: Settings,
      stepIndex: 2,
      items: [
        { label: 'Swap Fee', value: `${data.swapFee || 0.3}%` },
        { label: 'Protocol Fee', value: `${data.protocolFee || 0.1}%` },
        { label: 'Dynamic Fees', value: data.dynamicFees ? 'Enabled' : 'Disabled' },
        ...(data.dynamicFees ? [
          { label: 'Fee Range', value: `${data.minFee || 0.1}% - ${data.maxFee || 3}%` },
        ] : []),
      ],
    },
    {
      title: 'Rewards & Splits',
      icon: Gift,
      stepIndex: 3,
      items: [
        { 
          label: 'Creator Rewards', 
          value: data.creatorRewardsEnabled !== false ? 'Enabled' : 'Disabled' 
        },
        ...(data.creatorRewardsEnabled !== false ? [
          { label: 'Creator Address', value: formatAddress(data.creatorAddress) },
          { label: 'Creator Percentage', value: `${data.creatorPercentage || 1}%` },
        ] : []),
        { 
          label: 'Revenue Splits', 
          value: data.rewardSplits && data.rewardSplits.length > 0 
            ? `${data.rewardSplits.length} recipients` 
            : 'None' 
        },
      ],
    },
    {
      title: 'Extensions',
      icon: Package,
      stepIndex: 4,
      items: [
        { 
          label: 'Active Extensions', 
          value: data.extensions && data.extensions.length > 0 
            ? `${data.extensions.length} enabled` 
            : 'None' 
        },
        ...(data.extensions || []).map((ext: string) => ({
          label: '', 
          value: formatExtensionName(ext),
          isBadge: true,
        })),
      ],
    },
    {
      title: 'MEV Protection',
      icon: Shield,
      stepIndex: 5,
      items: [
        { 
          label: 'MEV Protection', 
          value: data.mevProtectionEnabled ? 'Enabled' : 'Disabled' 
        },
        ...(data.mevProtectionEnabled ? [
          { label: 'Strategy', value: formatMevStrategy(data.mevStrategy) },
        ] : []),
        { 
          label: 'Launch Type', 
          value: data.privateLaunch ? 'Private (Allowlist)' : 'Public' 
        },
      ],
    },
  ];

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6 pb-32">
      <div className="text-center space-y-2 mb-8">
        <h1 className="text-3xl font-bold">Review Configuration</h1>
        <p className="text-muted-foreground">
          Review your token settings before deployment
        </p>
      </div>

      <div className="grid gap-4">
        {sections.map((section) => {
          const Icon = section.icon;
          return (
            <Card key={section.title}>
              <CardHeader>
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="p-2 bg-primary/10 rounded-lg">
                      <Icon className="w-5 h-5 text-primary" />
                    </div>
                    <CardTitle className="text-lg">{section.title}</CardTitle>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onEdit(section.stepIndex)}
                  >
                    <Edit2 className="w-4 h-4 mr-1" />
                    Edit
                  </Button>
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {section.items.map((item, index) => (
                    <div key={index}>
                      {item.isBadge ? (
                        <Badge variant="secondary" className="mr-2">
                          {item.value}
                        </Badge>
                      ) : item.label ? (
                        <div className="flex justify-between items-center">
                          <span className="text-sm text-muted-foreground">
                            {item.label}
                          </span>
                          <span className="text-sm font-medium">
                            {item.value}
                          </span>
                        </div>
                      ) : null}
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      <Card className="bg-yellow-500/10 border-yellow-500/20">
        <CardContent className="flex items-start gap-3 pt-6">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div className="space-y-1">
            <p className="text-sm font-medium">Deployment Notice</p>
            <p className="text-sm text-muted-foreground">
              Once deployed, token parameters cannot be changed. Please review all 
              settings carefully before proceeding.
            </p>
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3 fixed bottom-0 left-0 right-0 p-6 bg-background border-t">
        <div className="max-w-4xl mx-auto w-full flex gap-3">
          <Button
            variant="outline"
            onClick={() => onEdit(0)}
            className="flex-1"
            disabled={isDeploying}
          >
            Back to Edit
          </Button>
          <Button
            onClick={onDeploy}
            disabled={isDeploying}
            className="flex-1"
          >
            {isDeploying ? (
              <>
                <span className="animate-spin mr-2">⏳</span>
                Deploying...
              </>
            ) : (
              <>
                <Wallet className="w-4 h-4 mr-2" />
                Deploy Token
              </>
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

function formatAddress(address?: string): string {
  if (!address) return 'Not provided';
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function formatExtensionName(extension: string): string {
  const names: Record<string, string> = {
    antiBot: 'Anti-Bot Protection',
    autoLiquidity: 'Auto-Liquidity',
    buybackBurn: 'Buyback & Burn',
    vestingSchedule: 'Vesting Schedule',
    staking: 'Staking Rewards',
    governance: 'Governance',
  };
  return names[extension] || extension;
}

function formatMevStrategy(strategy?: string): string {
  const strategies: Record<string, string> = {
    none: 'No Protection',
    flashbots: 'Flashbots',
    mevBlocker: 'MEV Blocker',
    custom: 'Custom Strategy',
  };
  return strategies[strategy || ''] || 'Flashbots';
}