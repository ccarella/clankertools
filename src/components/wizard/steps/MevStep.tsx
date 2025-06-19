"use client";

import React from 'react';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WizardStepProps } from '../types';
import { Info, Shield, Zap, AlertCircle } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription } from '@/components/ui/alert';

const MEV_STRATEGIES = [
  {
    value: 'none',
    label: 'No Protection',
    description: 'Standard trading without MEV protection',
    risk: 'high',
  },
  {
    value: 'flashbots',
    label: 'Flashbots Protection',
    description: 'Route through private mempool',
    risk: 'low',
  },
  {
    value: 'mevBlocker',
    label: 'MEV Blocker',
    description: 'Active MEV blocking strategies',
    risk: 'low',
  },
  {
    value: 'custom',
    label: 'Custom Strategy',
    description: 'Define your own MEV protection',
    risk: 'medium',
  },
];

export function MevStep({ data, onChange, errors, isActive }: WizardStepProps) {
  return (
    <TooltipProvider>
      <div className="space-y-6">
        <Alert>
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            MEV (Maximum Extractable Value) protection helps prevent sandwich attacks 
            and front-running during trades.
          </AlertDescription>
        </Alert>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Label htmlFor="mevProtection">Enable MEV Protection</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-4 h-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Protect traders from MEV attacks</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-xs text-muted-foreground">
                Recommended for fair launches
              </p>
            </div>
            <Switch
              id="mevProtection"
              checked={data.mevProtectionEnabled || false}
              onCheckedChange={(checked) => onChange('mevProtectionEnabled', checked)}
              disabled={!isActive}
            />
          </div>

          {data.mevProtectionEnabled && (
            <div className="space-y-3">
              <Label>Protection Strategy</Label>
              <RadioGroup
                value={data.mevStrategy || 'flashbots'}
                onValueChange={(value) => onChange('mevStrategy', value)}
                disabled={!isActive}
              >
                {MEV_STRATEGIES.map((strategy) => (
                  <Card key={strategy.value} className="cursor-pointer hover:bg-accent/50">
                    <label className="flex items-start gap-3 p-4 cursor-pointer">
                      <RadioGroupItem value={strategy.value} className="mt-1" />
                      <div className="flex-1">
                        <div className="flex items-center gap-2">
                          <span className="font-medium">{strategy.label}</span>
                          <span className={`text-xs px-2 py-0.5 rounded-full ${
                            strategy.risk === 'low' 
                              ? 'bg-green-500/20 text-green-600' 
                              : strategy.risk === 'medium'
                              ? 'bg-yellow-500/20 text-yellow-600'
                              : 'bg-red-500/20 text-red-600'
                          }`}>
                            {strategy.risk} risk
                          </span>
                        </div>
                        <p className="text-sm text-muted-foreground mt-1">
                          {strategy.description}
                        </p>
                      </div>
                    </label>
                  </Card>
                ))}
              </RadioGroup>
              {errors?.mevStrategy && (
                <p className="text-sm text-destructive">{errors.mevStrategy}</p>
              )}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Label htmlFor="privateLaunch">Private Launch</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-4 h-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Launch with whitelisted addresses only</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-xs text-muted-foreground">
                Initial trading limited to allowlist
              </p>
            </div>
            <Switch
              id="privateLaunch"
              checked={data.privateLaunch || false}
              onCheckedChange={(checked) => onChange('privateLaunch', checked)}
              disabled={!isActive}
            />
          </div>

          {data.privateLaunch && (
            <Card className="bg-muted/30">
              <CardContent className="pt-4">
                <p className="text-sm text-muted-foreground mb-3">
                  You&apos;ll be able to manage the allowlist after deployment
                </p>
                <div className="flex items-center gap-2 text-sm">
                  <Shield className="w-4 h-4 text-primary" />
                  <span>Enhanced protection during launch phase</span>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Zap className="w-4 h-4" />
              MEV Protection Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Protection Status:</span>
              <span className={data.mevProtectionEnabled ? 'text-green-600' : 'text-yellow-600'}>
                {data.mevProtectionEnabled ? 'Enabled' : 'Disabled'}
              </span>
            </div>
            {data.mevProtectionEnabled && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Strategy:</span>
                <span className="capitalize">
                  {MEV_STRATEGIES.find(s => s.value === data.mevStrategy)?.label || 'Flashbots'}
                </span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Launch Type:</span>
              <span>{data.privateLaunch ? 'Private (Allowlist)' : 'Public'}</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}