'use client';

import { useHaptic } from '@/providers/HapticProvider';
import { Checkbox } from '@/components/ui/checkbox';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';

export default function Settings() {
  const haptic = useHaptic();

  return (
    <div className="flex flex-col min-h-screen pb-20">
      <div className="flex-1 px-4 py-6">
        <h1 className="text-2xl font-bold mb-6">Settings</h1>
        
        <Card>
          <CardHeader>
            <CardTitle>User Preferences</CardTitle>
            <CardDescription>
              Customize your app experience
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center space-x-2">
              <Checkbox
                id="haptic-feedback"
                checked={haptic.isEnabled()}
                onCheckedChange={(checked) => {
                  if (checked) {
                    haptic.enable();
                  } else {
                    haptic.disable();
                  }
                }}
                disabled={!haptic.isSupported()}
              />
              <Label 
                htmlFor="haptic-feedback" 
                className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
              >
                Enable haptic feedback
                {!haptic.isSupported() && (
                  <span className="text-muted-foreground text-xs block mt-1">
                    Not supported on this device
                  </span>
                )}
              </Label>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}