"use client";

import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WizardStepProps } from '../types';
import { Info, Calculator } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

export function FeesStep({ data, onChange, errors, isActive }: WizardStepProps) {
  const handleFeeChange = (field: string, value: number[]) => {
    onChange(field, value[0]);
  };

  const totalFees = (data.swapFee || 0.3) + (data.protocolFee || 0.1);

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
      </div>
    </TooltipProvider>
  );
}