'use client';

import React from 'react';
import { useFarcasterAuth } from '@/components/providers/FarcasterAuthProvider';
import { Button, ButtonProps } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { 
  DropdownMenu, 
  DropdownMenuContent, 
  DropdownMenuItem, 
  DropdownMenuTrigger,
  DropdownMenuSeparator,
  DropdownMenuLabel
} from '@/components/ui/dropdown-menu';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Skeleton } from '@/components/ui/skeleton';
import { LogOut, User, Loader2, X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface SignInButtonProps extends Omit<ButtonProps, 'onClick'> {
  showSkeleton?: boolean;
}

export function SignInButton({ 
  className, 
  variant = 'default', 
  size = 'default',
  showSkeleton = false,
  ...props 
}: SignInButtonProps) {
  const { user, isAuthenticated, isLoading, error, signIn, signOut, clearError } = useFarcasterAuth();

  // Show skeleton loading state if requested
  if (showSkeleton && isLoading) {
    return (
      <Skeleton 
        data-testid="loading-skeleton" 
        className={cn('h-10 w-32', className)} 
      />
    );
  }

  // Show error alert if there's an error
  if (error) {
    return (
      <div className="space-y-2">
        <Alert variant="destructive" className="py-2">
          <AlertDescription className="flex items-center justify-between">
            <span className="text-sm">{error}</span>
            <Button
              variant="ghost"
              size="sm"
              onClick={clearError}
              className="h-auto p-1"
              aria-label="Dismiss"
            >
              <X className="h-3 w-3" />
            </Button>
          </AlertDescription>
        </Alert>
        <Button
          variant={variant}
          size={size}
          onClick={signIn}
          disabled={isLoading}
          className={className}
          {...props}
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Signing in...
            </>
          ) : (
            'Sign in with Farcaster'
          )}
        </Button>
      </div>
    );
  }

  // Show sign in button if not authenticated
  if (!isAuthenticated) {
    return (
      <Button
        variant={variant}
        size={size}
        onClick={signIn}
        disabled={isLoading}
        className={className}
        {...props}
      >
        {isLoading ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Signing in...
          </>
        ) : (
          'Sign in with Farcaster'
        )}
      </Button>
    );
  }

  // Show user dropdown if authenticated
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant={variant}
          size={size}
          className={cn('gap-2', className)}
          aria-label="User menu"
          {...props}
        >
          <Avatar className="h-6 w-6">
            {user?.pfpUrl ? (
              <AvatarImage src={user.pfpUrl} alt={user.displayName || user.username || 'User'} />
            ) : (
              <AvatarFallback className="bg-gradient-to-br from-violet-500 to-purple-600">
                <User className="h-3 w-3" />
              </AvatarFallback>
            )}
          </Avatar>
          <span className="text-sm font-medium">
            {user?.displayName || `@${user?.username}` || 'User'}
          </span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel className="font-normal">
          <div className="flex flex-col space-y-1">
            {user?.displayName && (
              <p className="text-sm font-medium leading-none">{user.displayName}</p>
            )}
            {user?.username && (
              <p className="text-sm text-muted-foreground">@{user.username}</p>
            )}
            <p className="text-xs text-muted-foreground">FID: {user?.fid}</p>
          </div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={signOut} className="cursor-pointer">
          <LogOut className="mr-2 h-4 w-4" />
          Sign out
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}