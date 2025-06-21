"use client";

import React, { useMemo } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Trash2, Info, AlertCircle } from 'lucide-react';
import { useHaptic } from '@/providers/HapticProvider';

export interface LiquidityPosition {
  id: string;
  minPrice: number;
  maxPrice: number;
  allocation: number;
}

interface LiquidityCurveDesignerProps {
  positions: LiquidityPosition[];
  onChange: (positions: LiquidityPosition[]) => void;
  maxPositions?: number;
}

const PRESET_CURVES = {
  balanced: [
    { id: 'p1', minPrice: 0, maxPrice: 33, allocation: 33.33 },
    { id: 'p2', minPrice: 33, maxPrice: 66, allocation: 33.34 },
    { id: 'p3', minPrice: 66, maxPrice: 100, allocation: 33.33 },
  ],
  concentrated: [
    { id: 'p1', minPrice: 40, maxPrice: 60, allocation: 70 },
    { id: 'p2', minPrice: 20, maxPrice: 40, allocation: 15 },
    { id: 'p3', minPrice: 60, maxPrice: 80, allocation: 15 },
  ],
  wideRange: [
    { id: 'p1', minPrice: 0, maxPrice: 100, allocation: 100 },
  ],
};

export function LiquidityCurveDesigner({ 
  positions, 
  onChange, 
  maxPositions = 7 
}: LiquidityCurveDesignerProps) {
  const haptic = useHaptic();

  const totalAllocation = useMemo(() => {
    return positions.reduce((sum, pos) => sum + pos.allocation, 0);
  }, [positions]);

  const isValidAllocation = Math.abs(totalAllocation - 100) < 0.01;

  const addPosition = () => {
    if (positions.length >= maxPositions) return;

    haptic.buttonPress('default');
    const newPosition: LiquidityPosition = {
      id: `pos-${Date.now()}`,
      minPrice: 0,
      maxPrice: 100,
      allocation: positions.length === 0 ? 100 : 0,
    };
    onChange([...positions, newPosition]);
  };

  const removePosition = (id: string) => {
    haptic.buttonPress('destructive');
    onChange(positions.filter(pos => pos.id !== id));
  };

  const updatePosition = (id: string, updates: Partial<LiquidityPosition>) => {
    haptic.toggleStateChange(true);
    onChange(positions.map(pos => 
      pos.id === id ? { ...pos, ...updates } : pos
    ));
  };

  const applyPreset = (presetName: keyof typeof PRESET_CURVES) => {
    haptic.cardSelect();
    onChange(PRESET_CURVES[presetName].map(pos => ({ ...pos })));
  };

  const calculatePriceImpact = (position: LiquidityPosition) => {
    const range = position.maxPrice - position.minPrice;
    const concentration = position.allocation / range;
    return Math.min(concentration * 2, 100);
  };

  return (
    <TooltipProvider>
      <div className="space-y-6">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Liquidity Positions</h3>
          <span className="text-sm text-muted-foreground">
            {positions.length} / {maxPositions} positions
          </span>
        </div>

        <div className="flex gap-2 flex-wrap">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => applyPreset('balanced')}
          >
            Balanced
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => applyPreset('concentrated')}
          >
            Concentrated
          </Button>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => applyPreset('wideRange')}
          >
            Wide Range
          </Button>
        </div>

        <div className="space-y-4">
          {positions.map((position, index) => (
            <Card key={position.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-sm">Position {index + 1}</CardTitle>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => removePosition(position.id)}
                    aria-label={`Remove position ${index + 1}`}
                    className="h-8 w-8"
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Price Range</Label>
                    <span className="text-sm text-muted-foreground">
                      ${position.minPrice} - ${position.maxPrice}
                    </span>
                  </div>
                  <Slider
                    value={[position.minPrice, position.maxPrice]}
                    onValueChange={([min, max]) => {
                      updatePosition(position.id, { minPrice: min, maxPrice: max });
                    }}
                    min={0}
                    max={100}
                    step={1}
                    className="touch-none"
                  />
                </div>

                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Label htmlFor={`allocation-${position.id}`}>
                      Allocation
                    </Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="h-4 w-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Percentage of liquidity for this position</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <div className="flex items-center gap-2">
                    <Input
                      id={`allocation-${position.id}`}
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={position.allocation}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0;
                        updatePosition(position.id, { allocation: Math.min(100, Math.max(0, value)) });
                      }}
                      className="w-24"
                      aria-label={`Allocation for position ${index + 1}`}
                    />
                    <span className="text-sm text-muted-foreground">%</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-sm">
                  <span className="text-muted-foreground">Price Impact:</span>
                  <span className={calculatePriceImpact(position) > 50 ? 'text-destructive' : ''}>
                    ~{calculatePriceImpact(position).toFixed(1)}%
                  </span>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {positions.length < maxPositions && (
          <Button
            type="button"
            variant="outline"
            onClick={addPosition}
            className="w-full"
            disabled={positions.length >= maxPositions}
          >
            <Plus className="h-4 w-4 mr-2" />
            Add Position
          </Button>
        )}

        {!isValidAllocation && positions.length > 0 && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Total allocation must equal 100% (currently {totalAllocation.toFixed(2)}%)
            </AlertDescription>
          </Alert>
        )}

        <Card className="bg-muted/50">
          <CardHeader className="pb-3">
            <CardTitle className="text-sm">Liquidity Curve Preview</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="relative h-48 w-full">
              <svg
                data-testid="liquidity-curve-svg"
                className="h-full w-full"
                viewBox="0 0 300 150"
                preserveAspectRatio="none"
              >
                <defs>
                  <linearGradient id="curveGradient" x1="0%" y1="0%" x2="0%" y2="100%">
                    <stop offset="0%" stopColor="hsl(var(--primary))" stopOpacity="0.3" />
                    <stop offset="100%" stopColor="hsl(var(--primary))" stopOpacity="0.1" />
                  </linearGradient>
                </defs>
                
                {positions.map((position) => {
                  const x = (position.minPrice / 100) * 300;
                  const width = ((position.maxPrice - position.minPrice) / 100) * 300;
                  const height = (position.allocation / 100) * 150;
                  const y = 150 - height;
                  
                  return (
                    <rect
                      key={position.id}
                      x={x}
                      y={y}
                      width={width}
                      height={height}
                      fill="url(#curveGradient)"
                      stroke="hsl(var(--primary))"
                      strokeWidth="2"
                    />
                  );
                })}
                
                <line
                  x1="0"
                  y1="150"
                  x2="300"
                  y2="150"
                  stroke="hsl(var(--border))"
                  strokeWidth="1"
                />
                <line
                  x1="0"
                  y1="0"
                  x2="0"
                  y2="150"
                  stroke="hsl(var(--border))"
                  strokeWidth="1"
                />
              </svg>
              
              <div className="absolute bottom-0 left-0 right-0 flex justify-between text-xs text-muted-foreground px-1">
                <span>$0</span>
                <span>$50</span>
                <span>$100</span>
              </div>
            </div>
          </CardContent>
        </Card>

        <Alert>
          <Info className="h-4 w-4" />
          <AlertDescription>
            Price Impact varies based on liquidity concentration. Higher concentration 
            in narrow ranges provides better prices but higher slippage.
          </AlertDescription>
        </Alert>
      </div>
    </TooltipProvider>
  );
}