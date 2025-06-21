"use client";

import React, { useCallback, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Plus, Info, AlertCircle, TrendingUp } from 'lucide-react';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useHaptic } from '@/providers/HapticProvider';
import { LiquidityPosition } from './LiquidityPosition';
import { CurveVisualization } from './CurveVisualization';
import { 
  validatePositions, 
  normalizeAllocations, 
  generatePresetCurve,
  calculatePriceImpact,
  CURVE_PRESETS,
} from './curveUtils';
import { LiquidityCurveDesignerProps, LiquidityPositionData, PresetType } from './types';
import { cn } from '@/lib/utils';

export function LiquidityCurveDesigner({
  value = [],
  onChange,
  maxPositions = 7,
  disabled = false,
  showPresets = true,
  showVisualization = true,
  showPriceImpact = true,
  className,
}: LiquidityCurveDesignerProps) {
  const haptic = useHaptic();
  const [selectedPreset, setSelectedPreset] = useState<PresetType | null>(null);

  const validation = useMemo(() => validatePositions(value), [value]);
  const totalAllocation = useMemo(() => 
    value.reduce((sum, pos) => sum + pos.allocation, 0), 
    [value]
  );

  const canAddPosition = value.length < maxPositions && !disabled;

  const handleAddPosition = useCallback(() => {
    if (!canAddPosition) return;
    
    haptic.buttonPress('default');
    
    const newPosition: LiquidityPositionData = {
      id: `pos-${Date.now()}`,
      rangeStart: 0,
      rangeEnd: 100,
      allocation: 100 - totalAllocation,
    };

    // If we have existing positions, try to be smart about the range
    if (value.length > 0) {
      // Find gaps in coverage
      const sortedPositions = [...value].sort((a, b) => a.rangeStart - b.rangeStart);
      let gapStart = 0;
      
      for (const pos of sortedPositions) {
        if (pos.rangeStart > gapStart) {
          // Found a gap
          newPosition.rangeStart = gapStart;
          newPosition.rangeEnd = pos.rangeStart;
          break;
        }
        gapStart = Math.max(gapStart, pos.rangeEnd);
      }
      
      // If no gap found, add at the end
      if (newPosition.rangeStart === 0 && newPosition.rangeEnd === 100 && gapStart < 100) {
        newPosition.rangeStart = gapStart;
        newPosition.rangeEnd = 100;
      }

      // Auto-balance allocations
      const positions = [...value, newPosition];
      onChange(normalizeAllocations(positions));
    } else {
      onChange([newPosition]);
    }
  }, [value, onChange, canAddPosition, totalAllocation, haptic]);

  const handlePositionChange = useCallback((index: number, updatedPosition: LiquidityPositionData) => {
    const newPositions = [...value];
    newPositions[index] = updatedPosition;
    onChange(newPositions);
  }, [value, onChange]);

  const handleRemovePosition = useCallback((index: number) => {
    const newPositions = value.filter((_, i) => i !== index);
    // Normalize allocations after removal
    onChange(normalizeAllocations(newPositions));
  }, [value, onChange]);

  const handlePresetSelect = useCallback((preset: PresetType) => {
    haptic.buttonPress('default');
    setSelectedPreset(preset);
    const presetPositions = generatePresetCurve(preset);
    onChange(presetPositions);
  }, [onChange, haptic]);

  const priceImpact = useMemo(() => {
    if (!showPriceImpact || value.length === 0) return null;
    
    // Calculate impact at different price points
    const impacts = [
      { price: 25, impact: calculatePriceImpact(value, 25, 1) },
      { price: 50, impact: calculatePriceImpact(value, 50, 1) },
      { price: 75, impact: calculatePriceImpact(value, 75, 1) },
    ];
    
    return impacts;
  }, [value, showPriceImpact]);

  return (
    <TooltipProvider>
      <div className={cn("space-y-4", className)}>
        {showPresets && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                Preset Curves
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Info className="w-4 h-4 text-muted-foreground" aria-label="Learn about liquidity curves" />
                  </TooltipTrigger>
                  <TooltipContent>
                    <p>Choose a preset curve template or create your own custom distribution</p>
                  </TooltipContent>
                </Tooltip>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 gap-2">
                {Object.entries(CURVE_PRESETS).map(([key, preset]) => (
                  <Button
                    key={key}
                    variant={selectedPreset === key ? "default" : "outline"}
                    size="sm"
                    onClick={() => handlePresetSelect(key as PresetType)}
                    disabled={disabled}
                    className="justify-start"
                  >
                    <span className="mr-2">{preset.icon}</span>
                    {preset.name}
                  </Button>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {showVisualization && value.length > 0 && (
          <CurveVisualization 
            positions={value} 
            height={200}
            showGrid
            showTooltip
            currentPrice={50}
          />
        )}

        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold">
              Liquidity Positions
            </h3>
            <span className="text-sm text-muted-foreground">
              {value.length} of {maxPositions} positions
            </span>
          </div>

          {value.length === 0 ? (
            <Card className="p-8 text-center">
              <p className="text-muted-foreground mb-4">
                Tap to add your first liquidity position
              </p>
              <Button
                onClick={handleAddPosition}
                disabled={!canAddPosition}
                size="lg"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Position
              </Button>
            </Card>
          ) : (
            <>
              {value.map((position, index) => (
                <LiquidityPosition
                  key={position.id}
                  position={position}
                  index={index}
                  totalPositions={value.length}
                  onChange={(pos) => handlePositionChange(index, pos)}
                  onRemove={() => handleRemovePosition(index)}
                  disabled={disabled}
                  canRemove={value.length > 1}
                />
              ))}
              
              <Button
                onClick={handleAddPosition}
                disabled={!canAddPosition}
                variant="outline"
                className="w-full"
              >
                <Plus className="w-4 h-4 mr-2" />
                Add Position
                {!canAddPosition && value.length >= maxPositions && (
                  <span className="ml-2 text-xs">(Maximum positions reached)</span>
                )}
              </Button>
            </>
          )}
        </div>

        {!validation.isValid && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {validation.errors.map((error, i) => (
                <div key={i}>{error}</div>
              ))}
              {Math.abs(totalAllocation - 100) > 0.01 && (
                <div>Currently: {totalAllocation.toFixed(1)}%</div>
              )}
            </AlertDescription>
          </Alert>
        )}

        {validation.warnings && validation.warnings.length > 0 && (
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              {validation.warnings.map((warning, i) => (
                <div key={i}>{warning}</div>
              ))}
            </AlertDescription>
          </Alert>
        )}

        {showPriceImpact && priceImpact && (
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm flex items-center gap-2">
                <TrendingUp className="w-4 h-4" />
                Estimated Price Impact
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2 text-sm">
                {priceImpact.map(({ price, impact }) => (
                  <div key={price} className="flex justify-between">
                    <span className="text-muted-foreground">At {price}% price:</span>
                    <span className={cn(
                      "font-medium",
                      impact > 10 ? "text-amber-600" : "text-green-600"
                    )}>
                      ~{impact.toFixed(2)}% per trade
                    </span>
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </TooltipProvider>
  );
}