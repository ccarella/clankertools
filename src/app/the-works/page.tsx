"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { WizardContainer, WizardStep, WizardData } from "@/components/wizard";
import { ReviewScreen } from "@/components/wizard/ReviewScreen";
import { 
  TokenBasicsStep, 
  LiquidityStep, 
  FeesStep, 
  RewardsStep, 
  ExtensionsStep, 
  MevStep 
} from "@/components/wizard/steps";
import { toast } from "sonner";

const wizardSteps: WizardStep[] = [
  {
    id: "token-basics",
    title: "Token Basics",
    description: "Configure basic token parameters",
    fields: ["name", "symbol", "description", "image"],
    component: TokenBasicsStep,
    validate: async (data) => {
      const errors: string[] = [];
      if (!data.name) errors.push("Token name is required");
      if (!data.symbol) errors.push("Token symbol is required");
      if (data.symbol && (data.symbol.length < 3 || data.symbol.length > 10)) {
        errors.push("Symbol must be 3-10 characters");
      }
      return {
        isValid: errors.length === 0,
        errors,
      };
    },
  },
  {
    id: "liquidity",
    title: "Liquidity Settings",
    description: "Configure liquidity parameters",
    fields: ["liquidityAmount", "liquidityCurve", "lpTokenSymbol", "maxSlippage", "curvePositions"],
    component: LiquidityStep,
    validate: async (data) => {
      const errors: string[] = [];
      if (!data.liquidityAmount) errors.push("Liquidity amount is required");
      if (data.liquidityAmount && parseFloat(data.liquidityAmount) < 0.01) {
        errors.push("Minimum liquidity is 0.01 ETH");
      }
      
      if (data.liquidityCurve === 'custom') {
        const positions = (data.curvePositions as { allocation: number }[]) || [];
        if (positions.length === 0) {
          errors.push("At least one liquidity position is required for custom curves");
        } else {
          const totalAllocation = positions.reduce((sum, pos) => sum + (pos.allocation || 0), 0);
          if (Math.abs(totalAllocation - 100) > 0.01) {
            errors.push("Total allocation must equal 100%");
          }
        }
      }
      
      return {
        isValid: errors.length === 0,
        errors,
      };
    },
  },
  {
    id: "fees",
    title: "Fee Configuration",
    description: "Set up fee structure",
    fields: ["swapFee", "protocolFee", "dynamicFees", "minFee", "maxFee", "creatorFeePercentage", "platformFeePercentage"],
    component: FeesStep,
    validate: async (data) => {
      const errors: string[] = [];
      if (data.dynamicFees && (!data.minFee || !data.maxFee)) {
        errors.push("Min and max fees are required when dynamic fees are enabled");
      }
      if (data.minFee && data.maxFee && data.minFee >= data.maxFee) {
        errors.push("Minimum fee must be less than maximum fee");
      }
      return {
        isValid: errors.length === 0,
        errors,
      };
    },
  },
  {
    id: "rewards",
    title: "Rewards & Splits",
    description: "Configure creator rewards and revenue splits",
    fields: ["creatorRewardsEnabled", "creatorAddress", "creatorPercentage", "rewardSplits"],
    component: RewardsStep,
    validate: async (data) => {
      const errors: string[] = [];
      if (data.creatorRewardsEnabled && !data.creatorAddress) {
        errors.push("Creator wallet address is required");
      }
      if (data.rewardSplits) {
        const totalPercentage = (data.rewardSplits || []).reduce((sum: number, split: { percentage: number }) => 
          sum + split.percentage, 0
        );
        if (totalPercentage > 100) {
          errors.push("Total split percentage cannot exceed 100%");
        }
      }
      return {
        isValid: errors.length === 0,
        errors,
      };
    },
  },
  {
    id: "extensions",
    title: "Extensions",
    description: "Add optional features",
    fields: ["extensions"],
    component: ExtensionsStep,
  },
  {
    id: "mev",
    title: "MEV Protection",
    description: "Configure MEV protection settings",
    fields: ["mevProtectionEnabled", "mevStrategy", "privateLaunch"],
    component: MevStep,
  },
];

export default function TheWorksPage() {
  const router = useRouter();
  const [isReviewing, setIsReviewing] = useState(false);

  const handleComplete = async (data: WizardData) => {
    setIsReviewing(true);
    
    try {
      console.log("Deploying token with data:", data);
      
      // TODO: Implement actual deployment
      // const response = await fetch('/api/deploy/advanced', {
      //   method: 'POST',
      //   headers: { 'Content-Type': 'application/json' },
      //   body: JSON.stringify(data),
      // });
      
      // Simulate deployment
      await new Promise(resolve => setTimeout(resolve, 2000));
      
      toast.success("Token deployed successfully!");
      router.push('/'); // Or redirect to token detail page
    } catch (error) {
      console.error("Error deploying token:", error);
      toast.error("Failed to deploy token. Please try again.");
    } finally {
      setIsReviewing(false);
    }
  };

  const ReviewComponent = ({ data, onEdit }: { data: WizardData; onEdit: (stepIndex: number) => void }) => (
    <ReviewScreen 
      data={data} 
      onEdit={onEdit} 
      onDeploy={() => handleComplete(data)}
      isDeploying={isReviewing}
    />
  );

  return (
    <div className="min-h-screen bg-background">
      <WizardContainer
        steps={wizardSteps}
        onComplete={handleComplete}
        persistKey="advanced-token-config"
        className="pb-20"
        reviewComponent={ReviewComponent}
      />
    </div>
  );
}