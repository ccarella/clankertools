'use client';

import React, { useState, useEffect } from 'react';
import { useFarcasterAuth } from '@/components/providers/FarcasterAuthProvider';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';

interface NotificationPreferences {
  tokenLaunched: boolean;
  tokenMilestones: boolean;
  followerActivity: boolean;
  castMentions: boolean;
  creatorRewards: boolean;
}

const defaultPreferences: NotificationPreferences = {
  tokenLaunched: true,
  tokenMilestones: true,
  followerActivity: true,
  castMentions: true,
  creatorRewards: true,
};

const preferencesInfo = {
  tokenLaunched: {
    label: 'Token Launched',
    description: 'Get notified when your tokens are successfully launched',
  },
  tokenMilestones: {
    label: 'Token Milestones',
    description: 'Receive updates on trading volume and holder milestones',
  },
  followerActivity: {
    label: 'Follower Activity',
    description: 'Know when notable accounts follow you',
  },
  castMentions: {
    label: 'Cast Mentions',
    description: 'Get alerted when you\'re mentioned in casts',
  },
  creatorRewards: {
    label: 'Creator Rewards',
    description: 'Track your creator reward earnings',
  },
};

export function NotificationPreferences() {
  const { isAuthenticated, user } = useFarcasterAuth();
  const [preferences, setPreferences] = useState<NotificationPreferences>(defaultPreferences);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isAuthenticated && user?.fid) {
      loadPreferences();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated, user?.fid]);

  const loadPreferences = async () => {
    if (!user?.fid) return;

    try {
      setIsLoading(true);
      setError(null);
      const response = await fetch(`/api/notifications/preferences?fid=${user.fid}`);
      
      if (!response.ok) {
        throw new Error('Failed to load preferences');
      }

      const data = await response.json();
      setPreferences(data);
    } catch (err) {
      setError('Failed to load preferences');
      console.error('Error loading preferences:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const savePreferences = async (newPreferences: NotificationPreferences) => {
    if (!user?.fid) return;

    try {
      setIsSaving(true);
      setError(null);
      const response = await fetch('/api/notifications/preferences', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          fid: user.fid,
          preferences: newPreferences,
        }),
      });

      if (!response.ok) {
        throw new Error('Failed to save preferences');
      }
    } catch (err) {
      setError('Failed to save preferences');
      console.error('Error saving preferences:', err);
      // Revert preferences on error
      loadPreferences();
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggle = (key: keyof NotificationPreferences) => {
    const newPreferences = {
      ...preferences,
      [key]: !preferences[key],
    };
    setPreferences(newPreferences);
    savePreferences(newPreferences);
  };

  if (!isAuthenticated) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-center text-muted-foreground">
            Please sign in to manage notification preferences
          </p>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Notification Preferences</CardTitle>
          <CardDescription>Loading preferences...</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {Object.keys(preferencesInfo).map((key) => (
            <div key={key} className="flex items-center space-x-4">
              <Skeleton className="h-6 w-6" />
              <div className="flex-1 space-y-1">
                <Skeleton className="h-4 w-32" />
                <Skeleton className="h-3 w-48" />
              </div>
            </div>
          ))}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Notification Preferences</CardTitle>
        <CardDescription>
          Choose which notifications you&apos;d like to receive
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="space-y-4">
          {Object.entries(preferencesInfo).map(([key, info]) => {
            const prefKey = key as keyof NotificationPreferences;
            return (
              <div key={key} className="flex items-start space-x-3">
                <Checkbox
                  id={key}
                  checked={preferences[prefKey]}
                  onCheckedChange={() => handleToggle(prefKey)}
                  disabled={isSaving}
                  aria-label={info.label}
                />
                <div className="space-y-1">
                  <Label
                    htmlFor={key}
                    className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                  >
                    {info.label}
                  </Label>
                  <p className="text-sm text-muted-foreground">
                    {info.description}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}