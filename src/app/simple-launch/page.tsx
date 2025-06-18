"use client";

import { ArrowLeft, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useRouter } from "next/navigation";

export default function SimpleLaunchPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <button
          onClick={() => router.back()}
          className="p-2 -ml-2 hover:bg-accent rounded-lg"
        >
          <ArrowLeft className="w-6 h-6 text-foreground" />
        </button>
        <h1 className="text-lg font-semibold text-foreground">Simple Launch</h1>
        <div className="w-10" /> {/* Spacer for centering */}
      </div>

      {/* Content */}
      <div className="p-6 space-y-6">
        {/* Name Field */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Name</label>
          <Input 
            placeholder="My Token"
            className="h-12 text-base"
          />
        </div>

        {/* Symbol Field */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Symbol</label>
          <Input 
            placeholder="MYT"
            className="h-12 text-base"
          />
        </div>

        {/* Image Upload */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Image</label>
          <Card className="p-8 border-2 border-dashed border-border hover:border-primary/50 transition-colors cursor-pointer">
            <div className="flex flex-col items-center justify-center text-center">
              <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                <Plus className="w-6 h-6 text-muted-foreground" />
              </div>
              <p className="text-sm text-muted-foreground">
                Click to upload or drag and drop
              </p>
            </div>
          </Card>
        </div>

        {/* Split Information */}
        <div className="pt-8 border-t border-border">
          <p className="text-center text-lg font-medium text-foreground mb-8">
            80% / 20% split
          </p>
          
          {/* Launch Button */}
          <Button 
            className="w-full h-12 text-lg font-medium bg-primary hover:bg-primary/90"
            size="lg"
          >
            Launch Token
          </Button>
        </div>
      </div>
    </div>
  );
}