"use client";

import React from 'react';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { WizardStepProps } from '../types';
import { Info } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { LiquidityCurveDesigner } from '@/components/liquidity';

const LIQUIDITY_CURVES = [
  { value: 'linear', label: 'Linear', description: 'Constant price curve' },
  { value: 'exponential', label: 'Exponential', description: 'Rapid price growth' },
  { value: 'logarithmic', label: 'Logarithmic', description: 'Gradual price growth' },
  { value: 'sigmoid', label: 'Sigmoid', description: 'S-shaped curve' },
  { value: 'custom', label: 'Custom', description: 'Design your own curve' },
];

export function LiquidityStep({ data, onChange, errors, isActive }: WizardStepProps) {
  const handleLiquidityAmountChange = (value: string) => {
    const numericValue = value.replace(/[^0-9.]/g, '');
    onChange('liquidityAmount', numericValue);
  };

  const handleSlippageChange = (value: number[]) => {
    onChange('maxSlippage', value[0]);
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="liquidityAmount">Initial Liquidity (ETH)</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-4 h-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p>The amount of ETH to provide as initial liquidity</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Input
            id="liquidityAmount"
            type="text"
            inputMode="decimal"
            placeholder="0.1"
            value={data.liquidityAmount || ''}
            onChange={(e) => handleLiquidityAmountChange(e.target.value)}
            disabled={!isActive}
            className={errors?.liquidityAmount ? 'border-destructive' : ''}
          />
          {errors?.liquidityAmount && (
            <p className="text-sm text-destructive">{errors.liquidityAmount}</p>
          )}
          <p className="text-xs text-muted-foreground">
            Minimum: 0.01 ETH | Recommended: 0.1 ETH
          </p>
        </div>

        <div className="space-y-3">
          <div className="flex items-center gap-2">
            <Label>Liquidity Curve</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-4 h-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p>How price changes with token supply</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <RadioGroup
            value={data.liquidityCurve || 'linear'}
            onValueChange={(value) => onChange('liquidityCurve', value)}
            disabled={!isActive}
          >
            {LIQUIDITY_CURVES.map((curve) => (
              <Card key={curve.value} className="cursor-pointer hover:bg-accent/50">
                <label className="flex items-start gap-3 p-4 cursor-pointer">
                  <RadioGroupItem value={curve.value} className="mt-1" />
                  <div className="flex-1">
                    <div className="font-medium">{curve.label}</div>
                    <div className="text-sm text-muted-foreground">
                      {curve.description}
                    </div>
                  </div>
                </label>
              </Card>
            ))}
          </RadioGroup>
          {errors?.liquidityCurve && (
            <p className="text-sm text-destructive">{errors.liquidityCurve}</p>
          )}
        </div>

        {data.liquidityCurve === 'custom' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2">
              <Label>Custom Liquidity Positions</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-4 h-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent className="max-w-xs">
                  <p>Design up to 7 liquidity positions with custom price ranges and allocations. This allows for advanced liquidity strategies.</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <LiquidityCurveDesigner
              value={data.liquidityPositions || []}
              onChange={(positions) => onChange('liquidityPositions', positions)}
              disabled={!isActive}
              maxPositions={7}
              showPresets={true}
              showVisualization={true}
              showPriceImpact={true}
            />
          </div>
        )}

        <div className="space-y-2">
          <div className="flex items-center gap-2">
            <Label htmlFor="lpTokenSymbol">LP Token Symbol</Label>
            <Tooltip>
              <TooltipTrigger asChild>
                <Info className="w-4 h-4 text-muted-foreground" />
              </TooltipTrigger>
              <TooltipContent>
                <p>Symbol for liquidity provider tokens</p>
              </TooltipContent>
            </Tooltip>
          </div>
          <Input
            id="lpTokenSymbol"
            placeholder="e.g., DEGEN-LP"
            value={data.lpTokenSymbol || ''}
            onChange={(e) => onChange('lpTokenSymbol', e.target.value.toUpperCase())}
            disabled={!isActive}
            maxLength={20}
            className={errors?.lpTokenSymbol ? 'border-destructive' : ''}
          />
          {errors?.lpTokenSymbol && (
            <p className="text-sm text-destructive">{errors.lpTokenSymbol}</p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Label>Max Slippage</Label>
              <Tooltip>
                <TooltipTrigger asChild>
                  <Info className="w-4 h-4 text-muted-foreground" />
                </TooltipTrigger>
                <TooltipContent>
                  <p>Maximum price impact allowed per trade</p>
                </TooltipContent>
              </Tooltip>
            </div>
            <span className="text-sm font-medium">{data.maxSlippage || 5}%</span>
          </div>
          <Slider
            value={[data.maxSlippage || 5]}
            onValueChange={handleSlippageChange}
            disabled={!isActive}
            min={1}
            max={50}
            step={1}
            className="w-full"
          />
          <div className="flex justify-between text-xs text-muted-foreground">
            <span>1%</span>
            <span>Conservative: 3-5%</span>
            <span>50%</span>
          </div>
        </div>

        <Card className="bg-muted/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Liquidity Settings Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            <div className="flex justify-between">
              <span className="text-muted-foreground">Initial Liquidity:</span>
              <span>{data.liquidityAmount || '0'} ETH</span>
            </div>
            <div className="flex justify-between">
              <span className="text-muted-foreground">Curve Type:</span>
              <span className="capitalize">{data.liquidityCurve || 'Linear'}</span>
            </div>
            {data.liquidityCurve === 'custom' && data.liquidityPositions && data.liquidityPositions.length > 0 && (
              <div className="flex justify-between">
                <span className="text-muted-foreground">Custom Positions:</span>
                <span>{data.liquidityPositions.length} positions</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-muted-foreground">Max Slippage:</span>
              <span>{data.maxSlippage || 5}%</span>
            </div>
          </CardContent>
        </Card>
      </div>
    </TooltipProvider>
  );
}