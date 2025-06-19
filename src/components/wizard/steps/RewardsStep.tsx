"use client";

import React, { useState } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent } from '@/components/ui/card';
import { WizardStepProps } from '../types';
import { Info, Plus, X, Users, Wallet } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface RewardSplit {
  address: string;
  percentage: number;
  name?: string;
}

export function RewardsStep({ data, onChange, errors, isActive }: WizardStepProps) {
  const [newAddress, setNewAddress] = useState('');
  const [newPercentage, setNewPercentage] = useState('');
  const [newName, setNewName] = useState('');

  const splits: RewardSplit[] = data.rewardSplits || [];
  const totalPercentage = splits.reduce((sum, split) => sum + split.percentage, 0);

  const addSplit = () => {
    if (!newAddress || !newPercentage) return;
    
    const percentage = parseFloat(newPercentage);
    if (percentage <= 0 || percentage > 100) return;
    
    if (totalPercentage + percentage > 100) return;

    const newSplits = [...splits, {
      address: newAddress,
      percentage,
      name: newName || undefined,
    }];

    onChange('rewardSplits', newSplits);
    setNewAddress('');
    setNewPercentage('');
    setNewName('');
  };

  const removeSplit = (index: number) => {
    const newSplits = splits.filter((_, i) => i !== index);
    onChange('rewardSplits', newSplits);
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Label htmlFor="creatorRewards">Enable Creator Rewards</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-4 h-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Earn a percentage of trading fees</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-xs text-muted-foreground">
                Receive rewards from trading activity
              </p>
            </div>
            <Switch
              id="creatorRewards"
              checked={data.creatorRewardsEnabled !== false}
              onCheckedChange={(checked) => onChange('creatorRewardsEnabled', checked)}
              disabled={!isActive}
            />
          </div>

          {data.creatorRewardsEnabled !== false && (
            <Card className="bg-muted/30">
              <CardContent className="pt-4 space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="creatorAddress">Creator Wallet Address</Label>
                  <div className="flex gap-2">
                    <Wallet className="w-5 h-5 text-muted-foreground mt-2" />
                    <Input
                      id="creatorAddress"
                      placeholder="0x..."
                      value={data.creatorAddress || ''}
                      onChange={(e) => onChange('creatorAddress', e.target.value)}
                      disabled={!isActive}
                      className={errors?.creatorAddress ? 'border-destructive' : ''}
                    />
                  </div>
                  {errors?.creatorAddress && (
                    <p className="text-sm text-destructive">{errors.creatorAddress}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Your connected wallet will be used by default
                  </p>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="creatorPercentage">Creator Reward Percentage</Label>
                  <Input
                    id="creatorPercentage"
                    type="number"
                    step="0.1"
                    min="0.1"
                    max="10"
                    placeholder="1"
                    value={data.creatorPercentage || ''}
                    onChange={(e) => onChange('creatorPercentage', parseFloat(e.target.value))}
                    disabled={!isActive}
                    className={errors?.creatorPercentage ? 'border-destructive' : ''}
                  />
                  {errors?.creatorPercentage && (
                    <p className="text-sm text-destructive">{errors.creatorPercentage}</p>
                  )}
                  <p className="text-xs text-muted-foreground">
                    Percentage of trading fees (0.1% - 10%)
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center gap-2">
            <Users className="w-5 h-5 text-muted-foreground" />
            <Label>Revenue Splits</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-4 h-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Share rewards with team members or partners</p>
              </TooltipContent>
            </Tooltip>
          </div>

          {splits.length > 0 && (
            <div className="space-y-2">
              {splits.map((split, index) => (
                <Card key={index}>
                  <CardContent className="flex items-center justify-between p-3">
                    <div className="flex-1">
                      <p className="text-sm font-medium">
                        {split.name || `Address ${index + 1}`}
                      </p>
                      <p className="text-xs text-muted-foreground font-mono">
                        {split.address.slice(0, 6)}...{split.address.slice(-4)}
                      </p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className="text-sm font-medium">{split.percentage}%</span>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => removeSplit(index)}
                        disabled={!isActive}
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          <Card className="border-dashed">
            <CardContent className="p-4 space-y-3">
              <div className="grid gap-2">
                <Input
                  placeholder="Wallet address (0x...)"
                  value={newAddress}
                  onChange={(e) => setNewAddress(e.target.value)}
                  disabled={!isActive || totalPercentage >= 100}
                />
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    placeholder="Name (optional)"
                    value={newName}
                    onChange={(e) => setNewName(e.target.value)}
                    disabled={!isActive || totalPercentage >= 100}
                  />
                  <Input
                    type="number"
                    placeholder="Percentage"
                    value={newPercentage}
                    onChange={(e) => setNewPercentage(e.target.value)}
                    disabled={!isActive || totalPercentage >= 100}
                    min="0.1"
                    max={100 - totalPercentage}
                    step="0.1"
                  />
                </div>
              </div>
              <Button
                onClick={addSplit}
                disabled={!isActive || !newAddress || !newPercentage || totalPercentage >= 100}
                className="w-full"
                variant="outline"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Split Recipient
              </Button>
            </CardContent>
          </Card>

          {totalPercentage > 0 && (
            <div className="flex justify-between items-center p-3 bg-muted rounded-lg">
              <span className="text-sm text-muted-foreground">Total Split:</span>
              <span className={`text-sm font-medium ${totalPercentage > 100 ? 'text-destructive' : ''}`}>
                {totalPercentage}%
              </span>
            </div>
          )}

          {errors?.rewardSplits && (
            <p className="text-sm text-destructive">{errors.rewardSplits}</p>
          )}
        </div>
      </div>
    </TooltipProvider>
  );
}