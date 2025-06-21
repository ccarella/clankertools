"use client";

import React, { useCallback, useMemo } from 'react';
import { Card } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Slider } from '@/components/ui/slider';
import { Button } from '@/components/ui/button';
import { Trash2, AlertCircle } from 'lucide-react';
import { useHaptic } from '@/providers/HapticProvider';
import { LiquidityPositionProps } from './types';
import { cn } from '@/lib/utils';

const POSITION_COLORS = [
  'rgb(59, 130, 246)', // blue-500
  'rgb(168, 85, 247)', // purple-500
  'rgb(34, 197, 94)',  // green-500
  'rgb(251, 146, 60)', // orange-500
  'rgb(239, 68, 68)',  // red-500
  'rgb(236, 72, 153)', // pink-500
  'rgb(6, 182, 212)',  // cyan-500
];

export function LiquidityPosition({
  position,
  index,
  totalPositions,
  onChange,
  onRemove,
  disabled = false,
  canRemove = true,
  positionColors = POSITION_COLORS,
}: LiquidityPositionProps) {
  const haptic = useHaptic();
  const positionNumber = index + 1;
  const color = positionColors[index % positionColors.length];

  const isNarrowRange = position.rangeEnd - position.rangeStart < 5;
  const isWideRange = position.rangeEnd - position.rangeStart === 100;
  const isLowAllocation = position.allocation < 5;

  const handleRangeChange = useCallback((value: number[]) => {
    if (value.length < 2) return;
    
    const [start, end] = value;
    if (end <= start) return; // Prevent invalid range
    
    haptic.sliderChange();
    onChange({
      ...position,
      rangeStart: start,
      rangeEnd: end,
    });
  }, [position, onChange, haptic]);

  const handleAllocationChange = useCallback((value: number[]) => {
    const allocation = value[0];
    if (allocation <= 0 || allocation > 100) return;
    
    haptic.sliderChange();
    onChange({
      ...position,
      allocation,
    });
  }, [position, onChange, haptic]);

  const handleRemove = useCallback(() => {
    haptic.buttonPress('destructive');
    onRemove();
  }, [onRemove, haptic]);

  const handleCardTouch = useCallback(() => {
    haptic.cardSelect();
  }, [haptic]);

  const rangePreview = useMemo(() => {
    const width = position.rangeEnd - position.rangeStart;
    return (
      <div 
        className="relative h-2 bg-muted rounded-full overflow-hidden"
        aria-label="Range preview"
      >
        <div
          className="absolute h-full transition-all duration-200"
          style={{
            left: `${position.rangeStart}%`,
            width: `${width}%`,
            backgroundColor: color,
            opacity: 0.8,
          }}
        />
      </div>
    );
  }, [position.rangeStart, position.rangeEnd, color]);

  return (
    <Card 
      className={cn(
        "p-4 space-y-4 transition-all duration-200",
        "hover:shadow-lg",
        disabled && "opacity-50"
      )}
      data-testid="position-card"
      onTouchEnd={handleCardTouch}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div
            className="w-4 h-4 rounded-full"
            style={{ backgroundColor: color }}
            data-testid="position-color-indicator"
          />
          <h3 className="font-semibold">Position {positionNumber}</h3>
        </div>
        {canRemove && (
          <Button
            variant="ghost"
            size="sm"
            onClick={handleRemove}
            disabled={disabled}
            aria-label={`Remove position ${positionNumber}`}
            className="h-8 w-8 p-0"
          >
            <Trash2 className="w-4 h-4" />
          </Button>
        )}
      </div>

      <div className="space-y-4">
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Price Range</Label>
            <span className="text-sm font-medium">
              {position.rangeStart}% - {position.rangeEnd}%
            </span>
          </div>
          {rangePreview}
          <Slider
            value={[position.rangeStart, position.rangeEnd]}
            onValueChange={handleRangeChange}
            min={0}
            max={100}
            step={1}
            disabled={disabled}
            className="touch-none"
            aria-label={`Price range for position ${positionNumber}`}
          />
          {isNarrowRange && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Very narrow range - high concentration
            </p>
          )}
          {isWideRange && (
            <p className="text-xs text-blue-600">
              Full range position
            </p>
          )}
        </div>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <Label>Allocation</Label>
            <span className="text-sm font-medium">
              {position.allocation}% <span className="text-muted-foreground">({(position.allocation / 100).toFixed(2)})</span>
            </span>
          </div>
          <Slider
            value={[position.allocation]}
            onValueChange={handleAllocationChange}
            min={0.1}
            max={100}
            step={0.1}
            disabled={disabled}
            className="touch-none"
            aria-label="Allocation percentage"
          />
          {isLowAllocation && (
            <p className="text-xs text-amber-600 flex items-center gap-1">
              <AlertCircle className="w-3 h-3" />
              Low allocation warning
            </p>
          )}
        </div>
      </div>
    </Card>
  );
}