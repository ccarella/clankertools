'use client';

import { useFarcasterAuth } from '@/components/providers/FarcasterAuthProvider';
import { AuthStatus } from '@/components/auth';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';

export default function ProfilePage() {
  const { user, isAuthenticated, isLoading, getQuickAuthToken } = useFarcasterAuth();

  const handleGetToken = async () => {
    const token = await getQuickAuthToken();
    if (token) {
      alert('Token obtained successfully!');
    } else {
      alert('Failed to get Quick Auth token');
    }
  };

  if (isLoading) {
    return (
      <div className="container mx-auto px-4 py-12">
        <Card className="max-w-md mx-auto">
          <CardHeader>
            <Skeleton className="h-8 w-32 mb-2" />
            <Skeleton className="h-4 w-48" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-20 w-full" />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-12">
      <Card className="max-w-md mx-auto">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            <AuthStatus />
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isAuthenticated && user ? (
            <div className="space-y-4">
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">FID</p>
                <p className="font-mono">{user.fid}</p>
              </div>
              {user.username && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Username</p>
                  <p className="font-mono">@{user.username}</p>
                </div>
              )}
              {user.displayName && (
                <div className="space-y-2">
                  <p className="text-sm text-muted-foreground">Display Name</p>
                  <p>{user.displayName}</p>
                </div>
              )}
              <Button onClick={handleGetToken} className="w-full">
                Get Quick Auth Token
              </Button>
            </div>
          ) : (
            <p className="text-center text-muted-foreground">
              Sign in to view your profile
            </p>
          )}
        </CardContent>
      </Card>
    </div>
  );
}