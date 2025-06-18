"use client";

import { ArrowLeft, CheckCircle, TrendingUp, Settings, Gift, Package, Shield, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { useRouter } from "next/navigation";

interface StepItem {
  id: string;
  title: string;
  icon: React.ReactNode;
  status: "complete" | "current" | "pending";
}

const steps: StepItem[] = [
  {
    id: "token-basics",
    title: "Token Basics",
    icon: <CheckCircle className="w-6 h-6" />,
    status: "complete"
  },
  {
    id: "liquidity-curve",
    title: "Liquidity Curve",
    icon: <TrendingUp className="w-6 h-6" />,
    status: "current"
  },
  {
    id: "fee-settings",
    title: "Fee Settings",
    icon: <Settings className="w-6 h-6" />,
    status: "pending"
  },
  {
    id: "rewards-splits",
    title: "Rewards & Splits",
    icon: <Gift className="w-6 h-6" />,
    status: "pending"
  },
  {
    id: "extensions",
    title: "Extensions",
    icon: <Package className="w-6 h-6" />,
    status: "pending"
  },
  {
    id: "mev",
    title: "MEV",
    icon: <Shield className="w-6 h-6" />,
    status: "pending"
  }
];

export default function TheWorksPage() {
  const router = useRouter();

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="flex items-center p-4 border-b border-border">
        <button
          onClick={() => router.back()}
          className="p-2 -ml-2 hover:bg-accent rounded-lg"
        >
          <ArrowLeft className="w-6 h-6 text-primary" />
        </button>
      </div>

      {/* Content */}
      <div className="p-6">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-foreground mb-2">The Works</h1>
          <p className="text-muted-foreground">1/6</p>
        </div>

        {/* Steps List */}
        <div className="space-y-4 mb-8">
          {steps.map((step) => (
            <Card key={step.id} className="p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-4">
                  <div 
                    className={`p-2 rounded-full ${
                      step.status === "complete" 
                        ? "bg-primary text-primary-foreground" 
                        : step.status === "current"
                        ? "bg-primary text-primary-foreground"
                        : "bg-muted text-muted-foreground"
                    }`}
                  >
                    {step.icon}
                  </div>
                  <div>
                    <h3 className="font-medium text-foreground">{step.title}</h3>
                    {step.status === "complete" && (
                      <p className="text-sm text-primary">complete</p>
                    )}
                  </div>
                </div>
                {step.status !== "complete" && (
                  <ChevronRight className="w-5 h-5 text-muted-foreground" />
                )}
              </div>
            </Card>
          ))}
        </div>

        {/* Bottom Button */}
        <Button 
          className="w-full h-12 text-lg font-medium bg-primary hover:bg-primary/90"
          size="lg"
        >
          Review & Deploy
        </Button>
      </div>
    </div>
  );
}