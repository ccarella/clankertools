'use client';

import React, { useState } from 'react';
import sdk from '@farcaster/frame-sdk';
import { Button } from '@/components/ui/button';
import { Loader2, Plus } from 'lucide-react';

export function SaveMiniAppButton() {
  const [isLoading, setIsLoading] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const handleAddMiniApp = async () => {
    setIsLoading(true);
    setMessage(null);

    try {
      await sdk.actions.addMiniApp();
      setMessage({ type: 'success', text: 'Mini app added successfully!' });
      setTimeout(() => setMessage(null), 3000);
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      
      if (errorMessage === 'RejectedByUser') {
        setMessage({ type: 'error', text: 'Mini app addition was cancelled' });
      } else if (errorMessage === 'InvalidDomainManifestJson') {
        setMessage({ type: 'error', text: 'Invalid app configuration. Please check your farcaster.json manifest.' });
      } else {
        setMessage({ type: 'error', text: 'Failed to add mini app. Please try again.' });
      }
      
      setTimeout(() => setMessage(null), 5000);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="space-y-2">
      <Button
        onClick={handleAddMiniApp}
        disabled={isLoading}
        className="w-full"
        variant="outline"
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Adding...
          </>
        ) : (
          <>
            <Plus className="mr-2 h-4 w-4" />
            Save Mini App
          </>
        )}
      </Button>
      
      {message && (
        <p className={`text-sm ${message.type === 'success' ? 'text-green-600' : 'text-red-600'}`}>
          {message.text}
        </p>
      )}
    </div>
  );
}