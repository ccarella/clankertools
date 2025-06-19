'use client';

import { useFarcasterAuth } from '@/components/providers/FarcasterAuthProvider';
import { useNeynarUser } from '@/hooks/useNeynar';
import { AuthStatus } from '@/components/auth';
import { ProfileBadge } from '@/components/profile';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';

export default function ProfilePage() {
  const { user, isAuthenticated, isLoading, getQuickAuthToken } = useFarcasterAuth();
  const { user: neynarUser, loading: neynarLoading, error: neynarError } = useNeynarUser({ fid: user?.fid });

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
        <Card className="max-w-2xl mx-auto">
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
      <Card className="max-w-2xl mx-auto">
        <CardHeader>
          <CardTitle>Profile</CardTitle>
          <CardDescription>
            <AuthStatus />
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isAuthenticated && user ? (
            <div className="space-y-6">
              {neynarLoading ? (
                <div data-testid="profile-badge-skeleton">
                  <ProfileBadge user={null} loading />
                </div>
              ) : neynarError ? (
                <div className="space-y-4">
                  <p className="text-sm text-destructive">Failed to load extended profile</p>
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
                </div>
              ) : neynarUser ? (
                <>
                  <ProfileBadge user={neynarUser} variant="expanded" />
                  
                  <Separator />
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <p className="text-2xl font-bold">{neynarUser.followerCount || 0}</p>
                      <p className="text-sm text-muted-foreground">followers</p>
                    </div>
                    <div className="space-y-1">
                      <p className="text-2xl font-bold">{neynarUser.followingCount || 0}</p>
                      <p className="text-sm text-muted-foreground">following</p>
                    </div>
                  </div>
                  
                  {neynarUser.profile?.bio?.text && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <h3 className="font-medium">Bio</h3>
                        <p className="text-sm text-muted-foreground">{neynarUser.profile.bio.text}</p>
                      </div>
                    </>
                  )}
                  
                  {neynarUser.verifications && neynarUser.verifications.length > 0 && (
                    <>
                      <Separator />
                      <div className="space-y-2">
                        <h3 className="font-medium">Verified Addresses</h3>
                        <div className="space-y-2">
                          {neynarUser.verifications.map((addr, i) => (
                            <Badge key={`addr-${i}`} variant="secondary" className="font-mono text-xs">
                              {addr}
                            </Badge>
                          ))}
                        </div>
                      </div>
                    </>
                  )}
                </>
              ) : (
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
                </div>
              )}
              
              <Separator />
              
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