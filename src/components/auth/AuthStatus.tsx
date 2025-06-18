'use client';

import React from 'react';
import { useFarcasterAuth } from '@/components/providers/FarcasterAuthProvider';

export function AuthStatus() {
  const { user, isAuthenticated, isLoading, error } = useFarcasterAuth();

  if (isLoading) {
    return <div className="text-sm text-muted-foreground">Loading...</div>;
  }

  if (error) {
    return <div className="text-sm text-destructive">Error: {error}</div>;
  }

  if (isAuthenticated && user) {
    return (
      <div className="text-sm text-muted-foreground">
        Signed in as {user.displayName || `@${user.username}`} (FID: {user.fid})
      </div>
    );
  }

  return <div className="text-sm text-muted-foreground">Not signed in</div>;
}