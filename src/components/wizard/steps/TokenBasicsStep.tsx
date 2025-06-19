"use client";

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { WizardStepProps } from '../types';
import { Upload, X } from 'lucide-react';

export function TokenBasicsStep({ data, onChange, errors, isActive }: WizardStepProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [charCount, setCharCount] = useState(0);

  useEffect(() => {
    if (data.image && typeof data.image === 'string') {
      setImagePreview(data.image);
    }
    if (data.description) {
      setCharCount(data.description.length);
    }
  }, [data.image, data.description]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      onChange('image', file);
      
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSymbolChange = (value: string) => {
    const uppercaseValue = value.toUpperCase().replace(/[^A-Z]/g, '');
    onChange('symbol', uppercaseValue);
  };

  const handleDescriptionChange = (value: string) => {
    if (value.length <= 280) {
      onChange('description', value);
      setCharCount(value.length);
    }
  };

  const removeImage = () => {
    onChange('image', null);
    setImagePreview(null);
  };

  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Label htmlFor="name">Token Name</Label>
        <Input
          id="name"
          placeholder="e.g., Degen Token"
          value={data.name || ''}
          onChange={(e) => onChange('name', e.target.value)}
          disabled={!isActive}
          className={errors?.name ? 'border-destructive' : ''}
        />
        {errors?.name && (
          <p className="text-sm text-destructive">{errors.name}</p>
        )}
      </div>

      <div className="space-y-2">
        <Label htmlFor="symbol">Token Symbol</Label>
        <Input
          id="symbol"
          placeholder="e.g., DEGEN"
          value={data.symbol || ''}
          onChange={(e) => handleSymbolChange(e.target.value)}
          disabled={!isActive}
          maxLength={10}
          className={errors?.symbol ? 'border-destructive' : ''}
        />
        {errors?.symbol && (
          <p className="text-sm text-destructive">{errors.symbol}</p>
        )}
        <p className="text-xs text-muted-foreground">
          3-10 characters, uppercase only
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description</Label>
        <Textarea
          id="description"
          placeholder="Tell us about your token..."
          value={data.description || ''}
          onChange={(e) => handleDescriptionChange(e.target.value)}
          disabled={!isActive}
          rows={4}
          className={errors?.description ? 'border-destructive' : ''}
        />
        {errors?.description && (
          <p className="text-sm text-destructive">{errors.description}</p>
        )}
        <p className="text-xs text-muted-foreground text-right">
          {charCount}/280
        </p>
      </div>

      <div className="space-y-2">
        <Label htmlFor="image">Token Image</Label>
        {imagePreview ? (
          <Card className="p-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <Image
                  src={imagePreview}
                  alt="Token preview"
                  className="w-16 h-16 rounded-lg object-cover"
                  width={64}
                  height={64}
                />
                <div>
                  <p className="text-sm font-medium">Image uploaded</p>
                  <p className="text-xs text-muted-foreground">
                    Click to change
                  </p>
                </div>
              </div>
              <button
                onClick={removeImage}
                disabled={!isActive}
                className="p-2 hover:bg-accent rounded-lg"
                type="button"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </Card>
        ) : (
          <label
            htmlFor="image"
            className={`flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer hover:bg-accent/50 transition-colors ${
              !isActive ? 'opacity-50 cursor-not-allowed' : ''
            } ${errors?.image ? 'border-destructive' : 'border-muted-foreground/25'}`}
          >
            <Upload className="w-8 h-8 text-muted-foreground mb-2" />
            <p className="text-sm text-muted-foreground">
              Click to upload image
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              PNG, JPG up to 5MB
            </p>
          </label>
        )}
        <input
          id="image"
          type="file"
          accept="image/*"
          onChange={handleImageUpload}
          disabled={!isActive}
          className="sr-only"
        />
        {errors?.image && (
          <p className="text-sm text-destructive">{errors.image}</p>
        )}
      </div>
    </div>
  );
}