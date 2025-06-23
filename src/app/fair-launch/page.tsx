'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useFarcasterAuth } from '@/components/providers/FarcasterAuthProvider';
import { useHaptic } from '@/providers/HapticProvider';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import BottomNavigation from '@/components/BottomNavigation';
import { WhitelistManager } from '@/components/fair-launch/WhitelistManager';
import { ArrowLeft, ArrowRight, Upload, Calendar, DollarSign, Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import Image from 'next/image';

const fairLaunchFormSchema = z.object({
  tokenName: z.string().min(1, 'Token name is required').max(50),
  tokenSymbol: z.string().min(1, 'Token symbol is required').max(10),
  description: z.string().max(500).optional(),
  minContribution: z.string().refine((val) => parseFloat(val) > 0, 'Must be greater than 0'),
  maxContribution: z.string().refine((val) => parseFloat(val) > 0, 'Must be greater than 0'),
  targetRaise: z.string().refine((val) => parseFloat(val) > 0, 'Must be greater than 0'),
  launchStartTime: z.string().min(1, 'Launch start time is required'),
  launchDuration: z.string().min(1, 'Launch duration is required'),
});

type FairLaunchFormData = z.infer<typeof fairLaunchFormSchema>;

export default function FairLaunchPage() {
  const router = useRouter();
  const { isAuthenticated, user } = useFarcasterAuth();
  const haptic = useHaptic();
  const [currentStep, setCurrentStep] = useState(1);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [whitelist, setWhitelist] = useState<string[]>([]);
  const [isDeploying, setIsDeploying] = useState(false);

  const form = useForm<FairLaunchFormData>({
    resolver: zodResolver(fairLaunchFormSchema),
    defaultValues: {
      tokenName: '',
      tokenSymbol: '',
      description: '',
      minContribution: '0.01',
      maxContribution: '1',
      targetRaise: '100',
      launchStartTime: '',
      launchDuration: '24',
    },
  });

  useEffect(() => {
    if (!isAuthenticated) {
      router.push('/');
    }
  }, [isAuthenticated, router]);

  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setImageFile(file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleNext = async () => {
    let isValid = false;
    
    switch (currentStep) {
      case 1:
        isValid = await form.trigger(['tokenName', 'tokenSymbol', 'description']);
        break;
      case 2:
        isValid = whitelist.length > 0;
        if (!isValid) {
          form.setError('root', { message: 'Please add at least one user to the whitelist' });
        }
        break;
      case 3:
        isValid = await form.trigger(['minContribution', 'maxContribution', 'targetRaise']);
        if (isValid) {
          const min = parseFloat(form.getValues('minContribution'));
          const max = parseFloat(form.getValues('maxContribution'));
          const target = parseFloat(form.getValues('targetRaise'));
          if (min > max) {
            form.setError('minContribution', { message: 'Must be less than max' });
            isValid = false;
          }
          if (max > target) {
            form.setError('maxContribution', { message: 'Cannot exceed target' });
            isValid = false;
          }
        }
        break;
      case 4:
        isValid = await form.trigger(['launchStartTime', 'launchDuration']);
        break;
    }

    if (isValid) {
      haptic.navigationTap();
      setCurrentStep(currentStep + 1);
    }
  };

  const handleBack = () => {
    haptic.navigationTap();
    setCurrentStep(currentStep - 1);
  };

  const handleDeploy = async () => {
    if (!user?.fid || !imageFile) return;

    setIsDeploying(true);
    haptic.buttonPress();

    try {
      // Upload image to IPFS first
      const formData = new FormData();
      formData.append('file', imageFile);
      
      const uploadResponse = await fetch('/api/upload', {
        method: 'POST',
        body: formData,
      });

      if (!uploadResponse.ok) throw new Error('Failed to upload image');
      
      const { url: imageUrl } = await uploadResponse.json();

      // Deploy fair launch token
      const launchData = {
        fid: user.fid.toString(),
        ...form.getValues(),
        imageUrl,
        whitelist,
        launchStartTime: new Date(form.getValues('launchStartTime')).toISOString(),
        launchDuration: parseInt(form.getValues('launchDuration')) * 3600, // Convert hours to seconds
      };

      const response = await fetch('/api/deploy/fair', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(launchData),
      });

      if (!response.ok) throw new Error('Failed to deploy token');

      const result = await response.json();
      haptic.buttonPress('destructive');
      
      // Redirect to success page or token page
      router.push(`/token/${result.tokenAddress || 'pending'}`);
    } catch (error) {
      console.error('Deployment error:', error);
      haptic.buttonPress('destructive');
      // Handle error
    } finally {
      setIsDeploying(false);
    }
  };

  const totalSteps = 5;

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-secondary/20">
      <div className="container max-w-2xl mx-auto px-4 py-6 pb-24">
        <div className="flex items-center justify-between mb-6">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => currentStep > 1 ? handleBack() : router.back()}
            className="gap-2"
          >
            <ArrowLeft className="h-4 w-4" />
            {currentStep > 1 ? 'Back' : 'Cancel'}
          </Button>
          <p className="text-sm text-muted-foreground">
            Step {currentStep} of {totalSteps}
          </p>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Fair Launch Setup</CardTitle>
            <CardDescription>
              Create a token with whitelist-based fair distribution
            </CardDescription>
          </CardHeader>
          <CardContent>
            <form onSubmit={form.handleSubmit(handleDeploy)} className="space-y-6">
              {/* Step 1: Basic Info */}
              {currentStep === 1 && (
                <div className="space-y-4">
                  <div>
                    <Label htmlFor="tokenName">Token Name</Label>
                    <Input
                      id="tokenName"
                      {...form.register('tokenName')}
                      placeholder="My Fair Token"
                      className="mt-1"
                    />
                    {form.formState.errors.tokenName && (
                      <p className="text-sm text-destructive mt-1">
                        {form.formState.errors.tokenName.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="tokenSymbol">Token Ticker</Label>
                    <Input
                      id="tokenSymbol"
                      {...form.register('tokenSymbol')}
                      placeholder="FAIR"
                      className="mt-1"
                      onChange={(e) => {
                        e.target.value = e.target.value.toUpperCase();
                        form.register('tokenSymbol').onChange(e);
                      }}
                    />
                    {form.formState.errors.tokenSymbol && (
                      <p className="text-sm text-destructive mt-1">
                        {form.formState.errors.tokenSymbol.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="description">Token Description (Optional)</Label>
                    <Textarea
                      id="description"
                      {...form.register('description')}
                      placeholder="Describe your token..."
                      className="mt-1"
                      rows={3}
                    />
                  </div>

                  <div>
                    <Label htmlFor="image">Upload Token Image</Label>
                    <div className="mt-1">
                      <label
                        htmlFor="image"
                        className={cn(
                          "flex flex-col items-center justify-center w-full h-32 border-2 border-dashed rounded-lg cursor-pointer",
                          "hover:bg-secondary/50 transition-colors",
                          imagePreview && "border-primary"
                        )}
                      >
                        {imagePreview ? (
                          <Image
                            src={imagePreview}
                            alt="Token preview"
                            width={128}
                            height={128}
                            className="h-full w-auto object-contain"
                          />
                        ) : (
                          <div className="flex flex-col items-center justify-center pt-5 pb-6">
                            <Upload className="h-8 w-8 mb-2 text-muted-foreground" />
                            <p className="text-sm text-muted-foreground">
                              Click to upload image
                            </p>
                          </div>
                        )}
                        <input
                          id="image"
                          type="file"
                          className="hidden"
                          accept="image/*"
                          onChange={handleImageUpload}
                        />
                      </label>
                    </div>
                  </div>
                </div>
              )}

              {/* Step 2: Whitelist Management */}
              {currentStep === 2 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Users className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold">Whitelist Management</h3>
                  </div>
                  <WhitelistManager onWhitelistChange={setWhitelist} />
                  {form.formState.errors.root && (
                    <p className="text-sm text-destructive">
                      {form.formState.errors.root.message}
                    </p>
                  )}
                </div>
              )}

              {/* Step 3: Contribution Limits */}
              {currentStep === 3 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <DollarSign className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold">Contribution Limits</h3>
                  </div>

                  <div>
                    <Label htmlFor="minContribution">Minimum Contribution (ETH)</Label>
                    <Input
                      id="minContribution"
                      type="number"
                      step="0.001"
                      {...form.register('minContribution')}
                      className="mt-1"
                    />
                    {form.formState.errors.minContribution && (
                      <p className="text-sm text-destructive mt-1">
                        {form.formState.errors.minContribution.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="maxContribution">Maximum Contribution (ETH)</Label>
                    <Input
                      id="maxContribution"
                      type="number"
                      step="0.001"
                      {...form.register('maxContribution')}
                      className="mt-1"
                    />
                    {form.formState.errors.maxContribution && (
                      <p className="text-sm text-destructive mt-1">
                        {form.formState.errors.maxContribution.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="targetRaise">Target Raise Amount (ETH)</Label>
                    <Input
                      id="targetRaise"
                      type="number"
                      step="0.001"
                      {...form.register('targetRaise')}
                      className="mt-1"
                    />
                    {form.formState.errors.targetRaise && (
                      <p className="text-sm text-destructive mt-1">
                        {form.formState.errors.targetRaise.message}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Step 4: Launch Schedule */}
              {currentStep === 4 && (
                <div className="space-y-4">
                  <div className="flex items-center gap-2 mb-4">
                    <Calendar className="h-5 w-5 text-primary" />
                    <h3 className="text-lg font-semibold">Launch Schedule</h3>
                  </div>

                  <div>
                    <Label htmlFor="launchStartTime">Launch Start Time</Label>
                    <Input
                      id="launchStartTime"
                      type="datetime-local"
                      {...form.register('launchStartTime')}
                      className="mt-1"
                      min={new Date().toISOString().slice(0, 16)}
                    />
                    {form.formState.errors.launchStartTime && (
                      <p className="text-sm text-destructive mt-1">
                        {form.formState.errors.launchStartTime.message}
                      </p>
                    )}
                  </div>

                  <div>
                    <Label htmlFor="launchDuration">Launch Duration (hours)</Label>
                    <Input
                      id="launchDuration"
                      type="number"
                      step="1"
                      min="1"
                      max="168"
                      {...form.register('launchDuration')}
                      className="mt-1"
                    />
                    <p className="text-xs text-muted-foreground mt-1">
                      Between 1 hour and 7 days
                    </p>
                    {form.formState.errors.launchDuration && (
                      <p className="text-sm text-destructive mt-1">
                        {form.formState.errors.launchDuration.message}
                      </p>
                    )}
                  </div>
                </div>
              )}

              {/* Step 5: Review & Deploy */}
              {currentStep === 5 && (
                <div className="space-y-4">
                  <h3 className="text-lg font-semibold mb-4">Review & Deploy</h3>
                  
                  <div className="space-y-3 bg-secondary/50 rounded-lg p-4">
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Token</span>
                      <span className="font-medium">
                        {form.getValues('tokenName')} (${form.getValues('tokenSymbol')})
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Whitelisted Users</span>
                      <span className="font-medium">{whitelist.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Contribution Range</span>
                      <span className="font-medium">
                        {form.getValues('minContribution')} - {form.getValues('maxContribution')} ETH
                      </span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Target Raise</span>
                      <span className="font-medium">{form.getValues('targetRaise')} ETH</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-sm text-muted-foreground">Launch Duration</span>
                      <span className="font-medium">{form.getValues('launchDuration')} hours</span>
                    </div>
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    size="lg"
                    disabled={isDeploying}
                  >
                    {isDeploying ? 'Deploying...' : 'Deploy Fair Launch Token'}
                  </Button>
                </div>
              )}

              {/* Navigation Buttons */}
              {currentStep < 5 && (
                <div className="flex justify-end pt-4">
                  <Button
                    type="button"
                    onClick={handleNext}
                    className="gap-2"
                  >
                    Next
                    <ArrowRight className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </form>
          </CardContent>
        </Card>
      </div>
      <BottomNavigation />
    </div>
  );
}