"use client";

import React, { useMemo } from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WizardStepProps } from '../types';
import { Info, Calculator, PieChart } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import {
  calculateCreatorPlatformSplit,
  PRESET_FEE_STRUCTURES,
} from '@/lib/feeCalculations';

const FEE_MIN = 50;
const FEE_MAX = 95;

export function FeesStep({ data, onChange, errors, isActive }: WizardStepProps) {
  const handleFeeChange = (field: string, value: number[]) => {
    onChange(field, value[0]);
  };

  const totalFees = (data.swapFee || 0.3) + (data.protocolFee || 0.1);
  
  const creatorPercentage = data.creatorFeePercentage ?? 80;
  const platformPercentage = data.platformFeePercentage ?? 20;

  const handleCreatorFeeChange = (value: number[]) => {
    const newCreatorPercentage = value[0];
    const split = calculateCreatorPlatformSplit(newCreatorPercentage);
    onChange('creatorFeePercentage', split.creatorPercentage);
    onChange('platformFeePercentage', split.platformPercentage);
  };

  const applyPreset = (preset: typeof PRESET_FEE_STRUCTURES.standard) => {
    onChange('creatorFeePercentage', preset.creatorPercentage);
    onChange('platformFeePercentage', preset.platformPercentage);
  };

  const isPresetActive = (preset: typeof PRESET_FEE_STRUCTURES.standard) => {
    return creatorPercentage === preset.creatorPercentage && 
           platformPercentage === preset.platformPercentage;
  };

  const pieChartPath = useMemo(() => {
    const radius = 40;
    const centerX = 50;
    const centerY = 50;
    
    const angle = (creatorPercentage / 100) * 360;
    const largeArcFlag = angle > 180 ? 1 : 0;
    
    const endAngle = (angle - 90) * (Math.PI / 180);
    const endX = centerX + radius * Math.cos(endAngle);
    const endY = centerY + radius * Math.sin(endAngle);
    
    return {
      creator: `M ${centerX} ${centerY - radius} A ${radius} ${radius} 0 ${largeArcFlag} 1 ${endX} ${endY} L ${centerX} ${centerY} Z`,
      platform: `M ${endX} ${endY} A ${radius} ${radius} 0 ${1 - largeArcFlag} 1 ${centerX} ${centerY - radius} L ${centerX} ${centerY} Z`,
    };
  }, [creatorPercentage]);

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label>Swap Fee</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-4 h-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Fee charged on each swap transaction</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <span className="text-sm font-medium">{data.swapFee || 0.3}%</span>
          </div>
          <Slider
            value={[data.swapFee || 0.3]}
            onValueChange={(value) => handleFeeChange('swapFee', value)}
            disabled={!isActive}
            min={0.01}
            max={3}
            step={0.01}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0.01%</span>
            <span>Standard: 0.3%</span>
            <span>3%</span>
          </div>
          {errors?.swapFee && (
            <p className="text-sm text-destructive">{errors.swapFee}</p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label>Protocol Fee</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-4 h-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Fee that goes to the protocol treasury</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <span className="text-sm font-medium">{data.protocolFee || 0.1}%</span>
          </div>
          <Slider
            value={[data.protocolFee || 0.1]}
            onValueChange={(value) => handleFeeChange('protocolFee', value)}
            disabled={!isActive}
            min={0}
            max={1}
            step={0.01}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>0%</span>
            <span>Standard: 0.1%</span>
            <span>1%</span>
          </div>
          {errors?.protocolFee && (
            <p className="text-sm text-destructive">{errors.protocolFee}</p>
          )}
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Label htmlFor="dynamicFees">Dynamic Fees</Label>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-4 h-4 text-muted-foreground" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Adjust fees based on market volatility</p>
                  </TooltipContent>
                </Tooltip>
              </div>
              <p className="text-xs text-muted-foreground">
                Automatically adjust fees during high volatility
              </p>
            </div>
            <Switch
              id="dynamicFees"
              checked={data.dynamicFees || false}
              onCheckedChange={(checked) => onChange('dynamicFees', checked)}
              disabled={!isActive}
            />
          </div>

          {data.dynamicFees && (
            <Card className="bg-muted/30">
              <CardContent className="pt-4 space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="minFee">Minimum Fee (%)</Label>
                  <Input
                    id="minFee"
                    type="number"
                    step="0.01"
                    min="0.01"
                    max={data.maxFee || 3}
                    placeholder="0.1"
                    value={data.minFee || ''}
                    onChange={(e) => onChange('minFee', parseFloat(e.target.value))}
                    disabled={!isActive}
                    className={errors?.minFee ? 'border-destructive' : ''}
                  />
                  {errors?.minFee && (
                    <p className="text-sm text-destructive">{errors.minFee}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="maxFee">Maximum Fee (%)</Label>
                  <Input
                    id="maxFee"
                    type="number"
                    step="0.01"
                    min={data.minFee || 0.01}
                    max="10"
                    placeholder="3"
                    value={data.maxFee || ''}
                    onChange={(e) => onChange('maxFee', parseFloat(e.target.value))}
                    disabled={!isActive}
                    className={errors?.maxFee ? 'border-destructive' : ''}
                  />
                  {errors?.maxFee && (
                    <p className="text-sm text-destructive">{errors.maxFee}</p>
                  )}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <Card className="bg-primary/5">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm flex items-center gap-2">
              <Calculator className="w-4 h-4" />
              Fee Summary
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Total Trading Fee:</span>
              <span className="font-medium">{totalFees.toFixed(2)}%</span>
            </div>
            <div className="text-xs text-muted-foreground space-y-1">
              <div className="flex justify-between">
                <span>• Swap Fee:</span>
                <span>{data.swapFee || 0.3}%</span>
              </div>
              <div className="flex justify-between">
                <span>• Protocol Fee:</span>
                <span>{data.protocolFee || 0.1}%</span>
              </div>
            </div>
            {data.dynamicFees && (
              <div className="pt-2 border-t text-xs text-muted-foreground">
                <p>Dynamic range: {data.minFee || 0.1}% - {data.maxFee || 3}%</p>
              </div>
            )}
          </CardContent>
        </Card>

        <div className="border-t pt-6">
          <h4 className="text-sm font-medium mb-4">Creator/Platform Fee Split</h4>
          
          <div className="space-y-4">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label htmlFor="creator-fee">Creator Fee</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-4 h-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Percentage of trading fees that go to the token creator</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <span className="text-sm font-medium">{creatorPercentage}%</span>
              </div>
              <Slider
                id="creator-fee"
                data-testid="creator-fee-slider"
                value={[creatorPercentage]}
                onValueChange={handleCreatorFeeChange}
                disabled={!isActive}
                min={FEE_MIN}
                max={FEE_MAX}
                step={1}
                className="w-full"
                aria-label="Creator fee percentage"
                aria-valuemin={FEE_MIN}
                aria-valuemax={FEE_MAX}
                aria-valuenow={creatorPercentage}
              />
              <div className="flex justify-between text-xs text-muted-foreground">
                <span>{FEE_MIN}%</span>
                <span>Creator Fee</span>
                <span>{FEE_MAX}%</span>
              </div>
              {errors?.creatorFeePercentage && (
                <p className="text-sm text-destructive">{errors.creatorFeePercentage}</p>
              )}
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <Label>Platform Fee</Label>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Info className="w-4 h-4 text-muted-foreground" />
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>Percentage of trading fees that support the platform</p>
                    </TooltipContent>
                  </Tooltip>
                </div>
                <span className="text-sm font-medium">{platformPercentage}%</span>
              </div>
              <div className="h-2 bg-muted rounded-full overflow-hidden">
                <div 
                  className="h-full bg-muted-foreground transition-all duration-300"
                  style={{ width: `${platformPercentage}%` }}
                />
              </div>
            </div>
          </div>

          <Card className="mt-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <PieChart className="w-4 h-4" />
                Fee Distribution
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center justify-between gap-8">
                <div className="relative w-[100px] h-[100px]">
                  <svg
                    viewBox="0 0 100 100"
                    className="w-full h-full"
                    data-testid="fee-pie-chart"
                  >
                    <path
                      d={pieChartPath.creator}
                      fill="hsl(var(--primary))"
                      data-testid="creator-segment"
                      data-percentage={creatorPercentage}
                    />
                    <path
                      d={pieChartPath.platform}
                      fill="hsl(var(--muted-foreground))"
                      data-testid="platform-segment"
                      data-percentage={platformPercentage}
                    />
                  </svg>
                </div>
                <div className="flex-1 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-primary" />
                      <span className="text-sm">Creator: {creatorPercentage}%</span>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <div className="w-3 h-3 rounded-full bg-muted-foreground" />
                      <span className="text-sm">Platform: {platformPercentage}%</span>
                    </div>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>

          <div className="space-y-3 mt-4">
            <Label>Preset Fee Structures</Label>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <Button
                variant="outline"
                size="sm"
                data-testid="preset-standard"
                onClick={() => applyPreset(PRESET_FEE_STRUCTURES.standard)}
                disabled={!isActive}
                className={cn(
                  "h-auto py-3 px-4 justify-start",
                  isPresetActive(PRESET_FEE_STRUCTURES.standard) && "ring-2 ring-primary"
                )}
              >
                <div className="text-left">
                  <div className="font-medium">Standard (80/20)</div>
                  <div className="text-xs text-muted-foreground">Most common split</div>
                </div>
              </Button>

              <Button
                variant="outline"
                size="sm"
                data-testid="preset-creator"
                onClick={() => applyPreset(PRESET_FEE_STRUCTURES.creatorFocused)}
                disabled={!isActive}
                className={cn(
                  "h-auto py-3 px-4 justify-start",
                  isPresetActive(PRESET_FEE_STRUCTURES.creatorFocused) && "ring-2 ring-primary"
                )}
              >
                <div className="text-left">
                  <div className="font-medium">Creator Focused (90/10)</div>
                  <div className="text-xs text-muted-foreground">Maximum creator rewards</div>
                </div>
              </Button>

              <Button
                variant="outline"
                size="sm"
                data-testid="preset-balanced"
                onClick={() => applyPreset(PRESET_FEE_STRUCTURES.balanced)}
                disabled={!isActive}
                className={cn(
                  "h-auto py-3 px-4 justify-start",
                  isPresetActive(PRESET_FEE_STRUCTURES.balanced) && "ring-2 ring-primary"
                )}
              >
                <div className="text-left">
                  <div className="font-medium">Balanced (70/30)</div>
                  <div className="text-xs text-muted-foreground">Sustainable growth</div>
                </div>
              </Button>
            </div>
          </div>
        </div>
      </div>
    </TooltipProvider>
  );
}