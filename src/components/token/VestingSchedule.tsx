'use client';

import React, { useState, useCallback, useMemo } from 'react';
import { Calendar, Clock, TrendingUp, AlertCircle } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Slider } from '@/components/ui/slider';

export type VestingType = 'linear' | 'cliff';

export interface VestingConfig {
  type: VestingType;
  durationMonths: number;
  cliffMonths?: number;
}

export interface VestingScheduleProps {
  config: VestingConfig;
  onChange: (config: VestingConfig) => void;
  disabled?: boolean;
}

const PRESET_DURATIONS = [
  { label: '3 Months', months: 3 },
  { label: '6 Months', months: 6 },
  { label: '1 Year', months: 12 },
  { label: '2 Years', months: 24 },
  { label: '3 Years', months: 36 },
  { label: '4 Years', months: 48 },
];

export function VestingSchedule({
  config,
  onChange,
  disabled = false,
}: VestingScheduleProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateDuration = useCallback((months: number): boolean => {
    if (months < 1) {
      setErrors(prev => ({ ...prev, duration: 'Duration must be at least 1 month' }));
      return false;
    }
    if (months > 60) {
      setErrors(prev => ({ ...prev, duration: 'Duration cannot exceed 60 months' }));
      return false;
    }
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.duration;
      return newErrors;
    });
    return true;
  }, []);

  const validateCliff = useCallback((cliffMonths: number, totalMonths: number): boolean => {
    if (cliffMonths < 0) {
      setErrors(prev => ({ ...prev, cliff: 'Cliff period cannot be negative' }));
      return false;
    }
    if (cliffMonths >= totalMonths) {
      setErrors(prev => ({ ...prev, cliff: 'Cliff period must be less than total duration' }));
      return false;
    }
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors.cliff;
      return newErrors;
    });
    return true;
  }, []);

  const handleTypeChange = useCallback((type: VestingType) => {
    const newConfig: VestingConfig = {
      ...config,
      type,
    };
    
    if (type === 'cliff') {
      delete newConfig.cliffMonths;
    } else if (type === 'linear' && !config.cliffMonths) {
      newConfig.cliffMonths = 0;
    }
    
    onChange(newConfig);
  }, [config, onChange]);

  const handleDurationChange = useCallback((months: number) => {
    if (validateDuration(months)) {
      const newConfig = { ...config, durationMonths: months };
      
      if (config.type === 'linear' && config.cliffMonths && config.cliffMonths >= months) {
        newConfig.cliffMonths = Math.max(0, months - 1);
      }
      
      onChange(newConfig);
    }
  }, [config, onChange, validateDuration]);

  const handleCliffChange = useCallback((cliff: number) => {
    if (validateCliff(cliff, config.durationMonths)) {
      onChange({
        ...config,
        cliffMonths: cliff,
      });
    }
  }, [config, onChange, validateCliff]);

  const getVestingVisualization = useMemo(() => {
    const points = [];
    const totalMonths = config.durationMonths;
    const cliffMonths = config.cliffMonths || 0;
    
    if (config.type === 'cliff') {
      points.push({ month: 0, percentage: 0 });
      points.push({ month: totalMonths - 0.01, percentage: 0 });
      points.push({ month: totalMonths, percentage: 100 });
    } else if (config.type === 'linear') {
      if (cliffMonths > 0) {
        points.push({ month: 0, percentage: 0 });
        points.push({ month: cliffMonths, percentage: 0 });
        
        const remainingMonths = totalMonths - cliffMonths;
        for (let i = 1; i <= 4; i++) {
          const month = cliffMonths + (remainingMonths * i / 4);
          const percentage = (i * 25);
          points.push({ month, percentage });
        }
      } else {
        for (let i = 0; i <= 4; i++) {
          points.push({
            month: (totalMonths * i) / 4,
            percentage: i * 25,
          });
        }
      }
    }
    
    return points;
  }, [config]);

  const formatDuration = useCallback((months: number): string => {
    if (months === 12) return '1 Year';
    if (months === 24) return '2 Years';
    if (months === 36) return '3 Years';
    if (months === 48) return '4 Years';
    if (months === 60) return '5 Years';
    if (months % 12 === 0) return `${months / 12} Years`;
    if (months === 1) return '1 Month';
    return `${months} Months`;
  }, []);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Clock className="h-5 w-5" />
          Vesting Schedule
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Vesting Type Selection */}
        <div className="space-y-3">
          <Label className="text-base font-medium">Vesting Type</Label>
          <RadioGroup
            value={config.type}
            onValueChange={handleTypeChange}
            disabled={disabled}
            className="grid grid-cols-1 sm:grid-cols-2 gap-4"
          >
            <label
              htmlFor="linear-vesting"
              className={`relative flex cursor-pointer items-start space-x-3 rounded-lg border p-4 transition-colors ${
                config.type === 'linear' 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-200 hover:border-gray-300'
              } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              <RadioGroupItem value="linear" id="linear-vesting" />
              <div className="flex-1">
                <div className="font-medium">Linear Vesting</div>
                <div className="text-sm text-gray-600">
                  Tokens unlock gradually over time
                </div>
              </div>
            </label>
            
            <label
              htmlFor="cliff-vesting"
              className={`relative flex cursor-pointer items-start space-x-3 rounded-lg border p-4 transition-colors ${
                config.type === 'cliff' 
                  ? 'border-blue-500 bg-blue-50' 
                  : 'border-gray-200 hover:border-gray-300'
              } ${disabled ? 'cursor-not-allowed opacity-50' : ''}`}
            >
              <RadioGroupItem value="cliff" id="cliff-vesting" />
              <div className="flex-1">
                <div className="font-medium">Cliff Vesting</div>
                <div className="text-sm text-gray-600">
                  All tokens unlock at the end
                </div>
              </div>
            </label>
          </RadioGroup>
        </div>

        {/* Duration Selection */}
        <div className="space-y-3">
          <Label htmlFor="duration" className="text-base font-medium">
            Duration
          </Label>
          
          {/* Preset Options */}
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-6">
            {PRESET_DURATIONS.map((preset) => (
              <Button
                key={preset.months}
                type="button"
                variant={config.durationMonths === preset.months ? 'default' : 'outline'}
                size="sm"
                onClick={() => handleDurationChange(preset.months)}
                disabled={disabled}
                className="h-10"
              >
                {preset.label}
              </Button>
            ))}
          </div>
          
          {/* Custom Duration Input */}
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="flex-1">
                <Slider
                  min={1}
                  max={60}
                  step={1}
                  value={[config.durationMonths]}
                  onValueChange={([value]) => handleDurationChange(value)}
                  disabled={disabled}
                  className="w-full"
                  aria-label="duration-slider"
                />
              </div>
              <div className="w-24">
                <Input
                  id="duration"
                  type="number"
                  min={1}
                  max={60}
                  value={config.durationMonths}
                  onChange={(e) => {
                    const value = parseInt(e.target.value) || 0;
                    handleDurationChange(value);
                  }}
                  disabled={disabled}
                  className={`text-center ${errors.duration ? 'border-red-500' : ''}`}
                  aria-describedby={errors.duration ? 'duration-error' : undefined}
                />
              </div>
              <span className="text-sm text-gray-600">months</span>
            </div>
            {errors.duration && (
              <div
                id="duration-error"
                className="flex items-center gap-1 text-sm text-red-600"
                role="alert"
              >
                <AlertCircle className="h-3 w-3" />
                {errors.duration}
              </div>
            )}
          </div>
        </div>

        {/* Cliff Period (for Linear Vesting) */}
        {config.type === 'linear' && (
          <div className="space-y-3">
            <Label htmlFor="cliff" className="text-base font-medium">
              Cliff Period (Optional)
            </Label>
            <p className="text-sm text-gray-600">
              Initial period where no tokens are vested
            </p>
            
            <div className="space-y-2">
              <div className="flex items-center gap-3">
                <div className="flex-1">
                  <Slider
                    min={0}
                    max={Math.max(0, config.durationMonths - 1)}
                    step={1}
                    value={[config.cliffMonths || 0]}
                    onValueChange={([value]) => handleCliffChange(value)}
                    disabled={disabled}
                    className="w-full"
                    aria-label="cliff-slider"
                  />
                </div>
                <div className="w-24">
                  <Input
                    id="cliff"
                    type="number"
                    min={0}
                    max={config.durationMonths - 1}
                    value={config.cliffMonths || 0}
                    onChange={(e) => {
                      const value = parseInt(e.target.value) || 0;
                      handleCliffChange(value);
                    }}
                    disabled={disabled}
                    className={`text-center ${errors.cliff ? 'border-red-500' : ''}`}
                    aria-describedby={errors.cliff ? 'cliff-error' : undefined}
                  />
                </div>
                <span className="text-sm text-gray-600">months</span>
              </div>
              {errors.cliff && (
                <div
                  id="cliff-error"
                  className="flex items-center gap-1 text-sm text-red-600"
                  role="alert"
                >
                  <AlertCircle className="h-3 w-3" />
                  {errors.cliff}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Visual Preview */}
        <div className="space-y-3">
          <Label className="text-base font-medium flex items-center gap-2">
            <TrendingUp className="h-4 w-4" />
            Schedule Preview
          </Label>
          
          <div className="bg-gray-50 rounded-lg p-4">
            {/* Chart */}
            <div className="relative h-48 mb-4">
              <svg
                viewBox="0 0 400 200"
                className="w-full h-full"
                role="img"
                aria-label="Vesting schedule visualization"
              >
                {/* Grid lines */}
                {[0, 25, 50, 75, 100].map((y) => (
                  <line
                    key={y}
                    x1="40"
                    y1={180 - (y * 1.6)}
                    x2="380"
                    y2={180 - (y * 1.6)}
                    stroke="#e5e7eb"
                    strokeWidth="1"
                  />
                ))}
                
                {/* Axes */}
                <line x1="40" y1="180" x2="380" y2="180" stroke="#6b7280" strokeWidth="2" />
                <line x1="40" y1="20" x2="40" y2="180" stroke="#6b7280" strokeWidth="2" />
                
                {/* Y-axis labels */}
                {[0, 25, 50, 75, 100].map((y) => (
                  <text
                    key={y}
                    x="30"
                    y={185 - (y * 1.6)}
                    textAnchor="end"
                    className="fill-gray-600 text-xs"
                  >
                    {y}%
                  </text>
                ))}
                
                {/* Vesting curve */}
                <polyline
                  points={getVestingVisualization
                    .map((point) => {
                      const x = 40 + (point.month / config.durationMonths) * 340;
                      const y = 180 - (point.percentage * 1.6);
                      return `${x},${y}`;
                    })
                    .join(' ')}
                  fill="none"
                  stroke="#3b82f6"
                  strokeWidth="3"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
                
                {/* Data points */}
                {getVestingVisualization.map((point, index) => (
                  <circle
                    key={index}
                    cx={40 + (point.month / config.durationMonths) * 340}
                    cy={180 - (point.percentage * 1.6)}
                    r="4"
                    fill="#3b82f6"
                  />
                ))}
                
                {/* X-axis labels */}
                <text x="40" y="195" textAnchor="middle" className="fill-gray-600 text-xs">
                  0
                </text>
                <text x="380" y="195" textAnchor="middle" className="fill-gray-600 text-xs">
                  {formatDuration(config.durationMonths)}
                </text>
              </svg>
            </div>
            
            {/* Summary */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div className="flex items-center gap-2">
                <Calendar className="h-4 w-4 text-gray-500" />
                <span className="text-gray-600">Total Duration:</span>
                <span className="font-medium">{formatDuration(config.durationMonths)}</span>
              </div>
              
              {config.type === 'linear' && config.cliffMonths ? (
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-gray-500" />
                  <span className="text-gray-600">Cliff Period:</span>
                  <span className="font-medium">{formatDuration(config.cliffMonths)}</span>
                </div>
              ) : null}
              
              <div className="flex items-center gap-2">
                <TrendingUp className="h-4 w-4 text-gray-500" />
                <span className="text-gray-600">Type:</span>
                <span className="font-medium capitalize">{config.type} Vesting</span>
              </div>
              
              <div className="flex items-center gap-2">
                <span className="text-gray-600">First Unlock:</span>
                <span className="font-medium">
                  {config.type === 'cliff' 
                    ? `100% at ${formatDuration(config.durationMonths)}`
                    : config.cliffMonths 
                      ? `After ${formatDuration(config.cliffMonths)}`
                      : 'Immediate'
                  }
                </span>
              </div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}