"use client";

import React from 'react';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WizardStepProps } from '../types';
import { Info, Shield, Zap, TrendingUp, Lock, DollarSign, Users } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

const EXTENSIONS = [
  {
    id: 'antiBot',
    name: 'Anti-Bot Protection',
    description: 'Prevent bot attacks during launch',
    icon: Shield,
    recommended: true,
  },
  {
    id: 'autoLiquidity',
    name: 'Auto-Liquidity',
    description: 'Automatically add liquidity from fees',
    icon: Zap,
    recommended: true,
  },
  {
    id: 'buybackBurn',
    name: 'Buyback & Burn',
    description: 'Use fees to buy and burn tokens',
    icon: TrendingUp,
    recommended: false,
  },
  {
    id: 'vestingSchedule',
    name: 'Vesting Schedule',
    description: 'Lock team tokens with vesting',
    icon: Lock,
    recommended: false,
  },
  {
    id: 'staking',
    name: 'Staking Rewards',
    description: 'Enable token staking for rewards',
    icon: DollarSign,
    recommended: false,
  },
  {
    id: 'governance',
    name: 'Governance',
    description: 'Enable on-chain governance',
    icon: Users,
    recommended: false,
  },
];

export function ExtensionsStep({ data, onChange, errors, isActive }: WizardStepProps) {
  const selectedExtensions = data.extensions || [] as string[];

  const toggleExtension = (extensionId: string) => {
    const newExtensions = selectedExtensions.includes(extensionId)
      ? selectedExtensions.filter((id: string) => id !== extensionId)
      : [...selectedExtensions, extensionId];
    
    onChange('extensions', newExtensions);
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground mb-4">
            Add optional features to enhance your token&apos;s functionality
          </p>
        </div>

        <div className="space-y-3">
          {EXTENSIONS.map((extension) => {
            const Icon = extension.icon;
            const isSelected = selectedExtensions.includes(extension.id);

            return (
              <Card
                key={extension.id}
                className={`cursor-pointer transition-colors ${
                  isSelected ? 'border-primary bg-primary/5' : 'hover:bg-accent/50'
                }`}
              >
                <CardContent className="p-4">
                  <label className="flex items-start gap-3 cursor-pointer">
                    <div className="pt-0.5">
                      <Switch
                        checked={isSelected}
                        onCheckedChange={() => toggleExtension(extension.id)}
                        disabled={!isActive}
                      />
                    </div>
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4 text-muted-foreground" />
                        <span className="font-medium">{extension.name}</span>
                        {extension.recommended && (
                          <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
                            Recommended
                          </span>
                        )}
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <Info className="w-3 h-3 text-muted-foreground ml-auto" />
                          </TooltipTrigger>
                          <TooltipContent>
                            <p className="max-w-xs">
                              {getExtensionDetails(extension.id)}
                            </p>
                          </TooltipContent>
                        </Tooltip>
                      </div>
                      <p className="text-sm text-muted-foreground">
                        {extension.description}
                      </p>
                    </div>
                  </label>
                </CardContent>
              </Card>
            );
          })}
        </div>

        {selectedExtensions.length > 0 && (
          <Card className="bg-primary/5">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Selected Extensions</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {selectedExtensions.map((extensionId: string) => {
                  const extension = EXTENSIONS.find(e => e.id === extensionId);
                  if (!extension) return null;
                  const Icon = extension.icon;
                  
                  return (
                    <div key={extensionId} className="flex items-center gap-2 text-sm">
                      <Icon className="w-4 h-4 text-primary" />
                      <span>{extension.name}</span>
                    </div>
                  );
                })}
              </div>
              <p className="text-xs text-muted-foreground mt-3">
                {selectedExtensions.length} extension{selectedExtensions.length !== 1 ? 's' : ''} selected
              </p>
            </CardContent>
          </Card>
        )}

        {errors?.extensions && (
          <p className="text-sm text-destructive">{errors.extensions}</p>
        )}
      </div>
    </TooltipProvider>
  );
}

function getExtensionDetails(extensionId: string): string {
  const details: Record<string, string> = {
    antiBot: 'Implements measures to prevent automated trading bots from manipulating your token during the critical launch phase. Includes transaction limits and cooldown periods.',
    autoLiquidity: 'Automatically captures a portion of transaction fees and adds them to the liquidity pool, increasing stability and reducing price impact over time.',
    buybackBurn: 'Uses accumulated fees to purchase tokens from the market and permanently remove them from circulation, creating deflationary pressure.',
    vestingSchedule: 'Locks team and advisor tokens according to a predefined schedule, building trust by preventing immediate dumps.',
    staking: 'Allows token holders to lock their tokens and earn rewards, encouraging long-term holding and reducing sell pressure.',
    governance: 'Enables token holders to vote on protocol changes and parameter updates, creating a decentralized decision-making process.',
  };
  
  return details[extensionId] || 'No additional details available.';
}