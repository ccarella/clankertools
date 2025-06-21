'use client';

import React, { useState, useCallback } from 'react';
import { Plus, Trash2, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { isValidAddress, validatePercentage, validateTotalPercentage } from '@/lib/validation';
import { formatFeePercentage } from '@/lib/feeCalculations';

export interface RewardRecipient {
  id: string;
  address: string;
  percentage: number;
  label: string;
}

export interface RewardSplitsProps {
  recipients: RewardRecipient[];
  onChange: (recipients: RewardRecipient[]) => void;
  maxRecipients?: number;
  platformFeePercentage?: number;
  disabled?: boolean;
}

export function RewardSplits({
  recipients,
  onChange,
  maxRecipients = 6,
  platformFeePercentage = 20,
  disabled = false,
}: RewardSplitsProps) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const generateId = useCallback(() => {
    return `recipient-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
  }, []);

  const addRecipient = useCallback(() => {
    if (recipients.length >= maxRecipients) return;

    const newRecipient: RewardRecipient = {
      id: generateId(),
      address: '',
      percentage: 0,
      label: '',
    };

    onChange([...recipients, newRecipient]);
  }, [recipients, maxRecipients, generateId, onChange]);

  const removeRecipient = useCallback((id: string) => {
    onChange(recipients.filter(r => r.id !== id));
    
    // Clear any errors for the removed recipient
    setErrors(prev => {
      const newErrors = { ...prev };
      delete newErrors[`${id}-address`];
      delete newErrors[`${id}-percentage`];
      return newErrors;
    });
  }, [recipients, onChange]);

  const updateRecipient = useCallback((id: string, field: keyof RewardRecipient, value: string | number) => {
    const updatedRecipients = recipients.map(r => 
      r.id === id ? { ...r, [field]: value } : r
    );
    onChange(updatedRecipients);

    // Clear error for this field when user starts typing
    if (field === 'address' || field === 'percentage') {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[`${id}-${field}`];
        return newErrors;
      });
    }
  }, [recipients, onChange]);

  const validateAddress = useCallback((id: string, address: string) => {
    if (!address) return;

    if (!isValidAddress(address)) {
      setErrors(prev => ({
        ...prev,
        [`${id}-address`]: 'Invalid address format. Use Ethereum address (0x...) or ENS name (.eth)',
      }));
    } else {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[`${id}-address`];
        return newErrors;
      });
    }
  }, []);

  const validateRecipientPercentage = useCallback((id: string, percentage: number) => {
    const validation = validatePercentage(percentage, 0, 100);
    
    if (!validation.isValid) {
      setErrors(prev => ({
        ...prev,
        [`${id}-percentage`]: validation.error!,
      }));
    } else {
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[`${id}-percentage`];
        return newErrors;
      });
    }
  }, []);

  // Calculate total percentage validation
  const percentages = recipients.map(r => r.percentage);
  const totalValidation = validateTotalPercentage(percentages, platformFeePercentage);

  const getSplitVisualization = useCallback(() => {
    const splits = [
      ...recipients.map(r => ({
        label: r.label || 'Unnamed',
        percentage: r.percentage,
        color: 'bg-blue-500',
      })),
      {
        label: 'Platform',
        percentage: platformFeePercentage,
        color: 'bg-gray-500',
      },
    ];

    return splits.filter(s => s.percentage > 0);
  }, [recipients, platformFeePercentage]);

  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          Reward Distribution
          {totalValidation.isValid && totalValidation.total === 100 && (
            <CheckCircle2 className="h-5 w-5 text-green-500" />
          )}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Platform Fee Section */}
        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg">
          <div>
            <div className="font-medium text-gray-900">Platform Fee</div>
            <div className="text-sm text-gray-600">Fixed platform commission</div>
          </div>
          <div className="text-lg font-semibold text-gray-900">
            {formatFeePercentage(platformFeePercentage)}
          </div>
        </div>

        {/* Recipients List */}
        <div className="space-y-4">
          {recipients.map((recipient, index) => (
            <div key={recipient.id} className="p-4 border border-gray-200 rounded-lg space-y-3">
              <div className="flex items-center justify-between">
                <h4 className="font-medium text-gray-900">
                  Recipient {index + 1}
                </h4>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => removeRecipient(recipient.id)}
                  disabled={disabled}
                  aria-label={`Remove recipient ${index + 1}`}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4" />
                  Remove
                </Button>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                {/* Address Input */}
                <div className="space-y-1">
                  <Label htmlFor={`${recipient.id}-address`} className="text-sm font-medium">
                    Address *
                  </Label>
                  <Input
                    id={`${recipient.id}-address`}
                    type="text"
                    placeholder="0x... or name.eth"
                    value={recipient.address}
                    onChange={(e) => updateRecipient(recipient.id, 'address', e.target.value)}
                    onBlur={(e) => validateAddress(recipient.id, e.target.value)}
                    disabled={disabled}
                    className={errors[`${recipient.id}-address`] ? 'border-red-500' : ''}
                    aria-describedby={errors[`${recipient.id}-address`] ? `${recipient.id}-address-error` : undefined}
                  />
                  {errors[`${recipient.id}-address`] && (
                    <div
                      id={`${recipient.id}-address-error`}
                      className="flex items-center gap-1 text-sm text-red-600"
                      role="alert"
                    >
                      <AlertCircle className="h-3 w-3" />
                      {errors[`${recipient.id}-address`]}
                    </div>
                  )}
                </div>

                {/* Percentage Input */}
                <div className="space-y-1">
                  <Label htmlFor={`${recipient.id}-percentage`} className="text-sm font-medium">
                    Percentage *
                  </Label>
                  <div className="relative">
                    <Input
                      id={`${recipient.id}-percentage`}
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      placeholder="0"
                      value={recipient.percentage || ''}
                      onChange={(e) => {
                        const value = parseFloat(e.target.value) || 0;
                        updateRecipient(recipient.id, 'percentage', value);
                        validateRecipientPercentage(recipient.id, value);
                      }}
                      disabled={disabled}
                      className={errors[`${recipient.id}-percentage`] ? 'border-red-500 pr-8' : 'pr-8'}
                      aria-describedby={errors[`${recipient.id}-percentage`] ? `${recipient.id}-percentage-error` : undefined}
                    />
                    <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                      <span className="text-gray-500 text-sm">%</span>
                    </div>
                  </div>
                  {errors[`${recipient.id}-percentage`] && (
                    <div
                      id={`${recipient.id}-percentage-error`}
                      className="flex items-center gap-1 text-sm text-red-600"
                      role="alert"
                    >
                      <AlertCircle className="h-3 w-3" />
                      {errors[`${recipient.id}-percentage`]}
                    </div>
                  )}
                </div>

                {/* Label Input */}
                <div className="space-y-1">
                  <Label htmlFor={`${recipient.id}-label`} className="text-sm font-medium">
                    Label
                  </Label>
                  <Input
                    id={`${recipient.id}-label`}
                    type="text"
                    placeholder="e.g., Team Lead"
                    value={recipient.label}
                    onChange={(e) => updateRecipient(recipient.id, 'label', e.target.value)}
                    disabled={disabled}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Add Recipient Button */}
        <Button
          type="button"
          variant="outline"
          onClick={addRecipient}
          disabled={disabled || recipients.length >= maxRecipients}
          className="w-full"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Recipient ({recipients.length}/{maxRecipients})
        </Button>

        {/* Total Validation */}
        <div className="space-y-2">
          <div className="flex items-center justify-between text-sm">
            <span className="text-gray-600">Total Allocated:</span>
            <span className={`font-medium ${totalValidation.total === 100 ? 'text-green-600' : totalValidation.total > 100 ? 'text-red-600' : 'text-gray-900'}`}>
              {formatFeePercentage(totalValidation.total)}
            </span>
          </div>
          
          {totalValidation.remaining > 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-gray-600">Available:</span>
              <span className="font-medium text-blue-600">
                {formatFeePercentage(totalValidation.remaining)} available
              </span>
            </div>
          )}
          
          {!totalValidation.isValid && (
            <div className="flex items-center gap-2 text-sm text-red-600" role="alert">
              <AlertCircle className="h-4 w-4" />
              {totalValidation.error}
            </div>
          )}
        </div>

        {/* Visual Split Representation */}
        {(recipients.length > 0 || platformFeePercentage > 0) && (
          <div className="space-y-3" data-testid="split-visualization">
            <Label className="text-sm font-medium">Split Visualization</Label>
            
            {/* Horizontal Bar Chart */}
            <div className="relative h-8 bg-gray-200 rounded-lg overflow-hidden">
              {getSplitVisualization().map((split, index) => {
                const widthPercentage = (split.percentage / 100) * 100;
                return (
                  <div
                    key={`${split.label}-${index}`}
                    className={`absolute top-0 h-full ${split.color} transition-all duration-300`}
                    style={{
                      left: `${getSplitVisualization()
                        .slice(0, index)
                        .reduce((sum, s) => sum + s.percentage, 0)}%`,
                      width: `${widthPercentage}%`,
                    }}
                  />
                );
              })}
            </div>
            
            {/* Legend */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm">
              {getSplitVisualization().map((split, index) => (
                <div key={`legend-${split.label}-${index}`} className="flex items-center gap-2">
                  <div className={`w-3 h-3 rounded ${split.color}`} />
                  <span className="text-gray-700">
                    {split.label}: {formatFeePercentage(split.percentage)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}