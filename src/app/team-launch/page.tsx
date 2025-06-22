"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useFarcasterAuth } from "@/components/providers/FarcasterAuthProvider";
import { useHaptic } from "@/providers/HapticProvider";
import { useForm } from "react-hook-form";
import { ArrowLeft, Plus, Trash2, Users, Lock, Vault, FileText, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { toast } from "sonner";
import { cn } from "@/lib/utils";

type TeamMember = {
  id: string;
  username: string;
  address: string;
  allocation: number;
  isCreator?: boolean;
};

type VestingSchedule = {
  enabled: boolean;
  cliffPeriod: number;
  vestingDuration: number;
  preset?: "3months" | "6months" | "1year" | "custom";
};

type FormData = {
  teamMembers: TeamMember[];
  vestingSchedule: VestingSchedule;
  treasuryPercentage: number;
  tokenName: string;
  tokenSymbol: string;
  tokenDescription: string;
  tokenImage: File | null;
};

type Step = "team" | "vesting" | "treasury" | "token" | "review";

const STEPS: { id: Step; title: string; icon: React.ComponentType<{ className?: string }> }[] = [
  { id: "team", title: "Team Configuration", icon: Users },
  { id: "vesting", title: "Vesting Schedule", icon: Lock },
  { id: "treasury", title: "Treasury Allocation", icon: Vault },
  { id: "token", title: "Token Details", icon: FileText },
  { id: "review", title: "Review & Deploy", icon: Check },
];

const VESTING_PRESETS = {
  "3months": { cliff: 0, duration: 3, label: "3 months" },
  "6months": { cliff: 1, duration: 6, label: "6 months" },
  "1year": { cliff: 3, duration: 12, label: "1 year" },
  "custom": { cliff: 0, duration: 0, label: "Custom" },
};

export default function TeamLaunchPage() {
  const router = useRouter();
  const { user, isAuthenticated, isLoading } = useFarcasterAuth();
  const { triggerHaptic } = useHaptic();
  const [currentStep, setCurrentStep] = useState<Step>("team");
  const [isDeploying, setIsDeploying] = useState(false);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const form = useForm<FormData>({
    defaultValues: {
      teamMembers: [
        {
          id: "creator",
          username: user?.username || "",
          address: "",
          allocation: 100,
          isCreator: true,
        },
      ],
      vestingSchedule: {
        enabled: false,
        cliffPeriod: 0,
        vestingDuration: 0,
      },
      treasuryPercentage: 0,
      tokenName: "",
      tokenSymbol: "",
      tokenDescription: "",
      tokenImage: null,
    },
  });

  const { watch, setValue, setError, clearErrors, formState: { errors } } = form;
  const teamMembers = watch("teamMembers");
  const vestingSchedule = watch("vestingSchedule");
  const treasuryPercentage = watch("treasuryPercentage");

  // Redirect if not authenticated
  useEffect(() => {
    if (!isLoading && !isAuthenticated) {
      router.push("/");
    }
  }, [isAuthenticated, isLoading, router]);

  // Update creator username when user data is available
  useEffect(() => {
    if (user?.username) {
      setValue("teamMembers.0.username", user.username);
    }
  }, [user, setValue]);

  // Handle image preview
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      setValue("tokenImage", file);
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const addTeamMember = () => {
    if (teamMembers.length >= 10) {
      toast.error("Maximum 10 team members allowed");
      return;
    }
    
    const newMember: TeamMember = {
      id: Date.now().toString(),
      username: "",
      address: "",
      allocation: 0,
    };
    
    // Auto-adjust allocations
    const newMembers = [...teamMembers, newMember];
    const equalAllocation = Math.floor(100 / newMembers.length);
    const remainder = 100 - (equalAllocation * newMembers.length);
    
    const adjustedMembers = newMembers.map((member, index) => ({
      ...member,
      allocation: index === 0 ? equalAllocation + remainder : equalAllocation,
    }));
    
    setValue("teamMembers", adjustedMembers);
    triggerHaptic("selection");
  };

  const removeTeamMember = (id: string) => {
    const filteredMembers = teamMembers.filter(m => m.id !== id);
    
    // Auto-adjust allocations
    const totalAllocation = 100;
    const equalAllocation = Math.floor(totalAllocation / filteredMembers.length);
    const remainder = totalAllocation - (equalAllocation * filteredMembers.length);
    
    const adjustedMembers = filteredMembers.map((member, index) => ({
      ...member,
      allocation: index === 0 ? equalAllocation + remainder : equalAllocation,
    }));
    
    setValue("teamMembers", adjustedMembers);
    triggerHaptic("selection");
  };

  const applyVestingPreset = (preset: keyof typeof VESTING_PRESETS) => {
    const { cliff, duration } = VESTING_PRESETS[preset];
    setValue("vestingSchedule", {
      enabled: true,
      cliffPeriod: cliff,
      vestingDuration: duration,
      preset,
    });
    triggerHaptic("selection");
  };

  const validateStep = (step: Step): boolean => {
    clearErrors();
    
    switch (step) {
      case "team":
        // Validate team members
        let hasErrors = false;
        teamMembers.forEach((member, index) => {
          if (!member.isCreator && !member.username) {
            setError(`teamMembers.${index}.username`, { message: "Username is required" });
            hasErrors = true;
          }
          if (member.allocation < 0 || member.allocation > 100) {
            setError(`teamMembers.${index}.allocation`, { message: "Allocation must be between 0 and 100" });
            hasErrors = true;
          }
        });
        
        // Check total allocation
        const totalAllocation = teamMembers.reduce((sum, m) => sum + m.allocation, 0);
        if (totalAllocation !== 100) {
          toast.error("Team allocations must total 100%");
          hasErrors = true;
        }
        
        // Check for duplicates
        const usernames = teamMembers.map(m => m.username).filter(Boolean);
        if (usernames.length !== new Set(usernames).size) {
          toast.error("This member is already in the team");
          hasErrors = true;
        }
        
        return !hasErrors;
        
      case "vesting":
        if (vestingSchedule.enabled) {
          if (vestingSchedule.cliffPeriod < 0) {
            setError("vestingSchedule.cliffPeriod", { message: "Cliff period must be at least 0 months" });
            return false;
          }
          if (vestingSchedule.vestingDuration < 1) {
            setError("vestingSchedule.vestingDuration", { message: "Vesting duration must be at least 1 month" });
            return false;
          }
        }
        return true;
        
      case "treasury":
        if (treasuryPercentage < 0 || treasuryPercentage > 50) {
          setError("treasuryPercentage", { message: "Treasury allocation must be between 0 and 50%" });
          return false;
        }
        return true;
        
      case "token":
        const tokenName = watch("tokenName");
        const tokenSymbol = watch("tokenSymbol");
        
        if (!tokenName) {
          setError("tokenName", { message: "Token name is required" });
          return false;
        }
        if (!tokenSymbol) {
          setError("tokenSymbol", { message: "Token symbol is required" });
          return false;
        }
        if (tokenSymbol.length < 3 || tokenSymbol.length > 10) {
          setError("tokenSymbol", { message: "Symbol must be 3-10 characters" });
          return false;
        }
        return true;
        
      default:
        return true;
    }
  };

  const handleNext = () => {
    const currentIndex = STEPS.findIndex(s => s.id === currentStep);
    if (currentIndex < STEPS.length - 1) {
      if (validateStep(currentStep)) {
        setCurrentStep(STEPS[currentIndex + 1].id);
        triggerHaptic("selection");
      } else {
        triggerHaptic("error");
      }
    }
  };

  const handleBack = () => {
    const currentIndex = STEPS.findIndex(s => s.id === currentStep);
    if (currentIndex > 0) {
      setCurrentStep(STEPS[currentIndex - 1].id);
      triggerHaptic("selection");
    } else {
      router.back();
    }
  };

  const handleDeploy = async () => {
    if (!validateStep("token")) {
      triggerHaptic("error");
      return;
    }
    
    setIsDeploying(true);
    triggerHaptic("success");
    
    try {
      // TODO: Implement actual deployment
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      toast.success("Team token deployed successfully!");
      router.push("/");
    } catch (error) {
      console.error("Deployment error:", error);
      toast.error("Failed to deploy token. Please try again.");
      triggerHaptic("error");
    } finally {
      setIsDeploying(false);
    }
  };

  const currentStepIndex = STEPS.findIndex(s => s.id === currentStep);
  const progress = ((currentStepIndex + 1) / STEPS.length) * 100;

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div data-testid="loading-spinner" className="text-center">
          <Skeleton className="h-8 w-8 rounded-full mx-auto mb-4" />
          <p className="text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="flex items-center justify-between p-4 border-b border-border">
        <button
          onClick={handleBack}
          className="p-2 -ml-2 hover:bg-accent rounded-lg"
        >
          <ArrowLeft className="w-6 h-6 text-foreground" />
        </button>
        <h1 className="text-lg font-semibold text-foreground">Team Token Launch</h1>
        <div className="w-10" />
      </div>

      {/* Progress */}
      <div className="px-4 py-3">
        <div className="flex items-center justify-between mb-2">
          <p className="text-sm text-muted-foreground">
            Step {currentStepIndex + 1} of {STEPS.length}
          </p>
          <p className="text-sm font-medium">{STEPS[currentStepIndex].title}</p>
        </div>
        <Progress value={progress} className="h-2" />
      </div>

      {/* Progress Steps */}
      <div className="flex justify-center gap-2 px-4 py-2 mb-4">
        {STEPS.map((step, index) => (
          <div
            key={step.id}
            data-testid={`progress-step-${index}`}
            className={cn(
              "w-2 h-2 rounded-full transition-colors",
              index <= currentStepIndex ? "bg-primary" : "bg-muted",
              index === currentStepIndex && "active"
            )}
          />
        ))}
      </div>

      {/* Content */}
      <div data-testid="team-launch-container" className="px-4 pb-24">
        {currentStep === "team" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">Team Configuration</h2>
              <p className="text-muted-foreground">Create a token with your team</p>
              <p className="text-muted-foreground">Distribute ownership among team members</p>
            </div>

            <div className="space-y-4">
              {teamMembers.map((member, index) => (
                <Card key={member.id} data-testid={`team-member-${index}`} className="p-4">
                  <div className="space-y-4">
                    <div className="flex items-center justify-between">
                      <h4 className="font-medium">
                        {member.isCreator ? "You" : `Team Member ${index}`}
                      </h4>
                      {!member.isCreator && (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => removeTeamMember(member.id)}
                          className="text-destructive hover:text-destructive/90"
                        >
                          <Trash2 className="w-4 h-4 mr-1" />
                          Remove
                        </Button>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label htmlFor={`member-${member.id}-username`}>
                          {member.isCreator ? "Your Username" : "Username or ENS"}
                        </Label>
                        <Input
                          id={`member-${member.id}-username`}
                          type="text"
                          value={member.username}
                          onChange={(e) => setValue(`teamMembers.${index}.username`, e.target.value)}
                          readOnly={member.isCreator}
                          placeholder={member.isCreator ? "" : "username.eth"}
                          className={cn(
                            "min-h-[44px]",
                            errors.teamMembers?.[index]?.username && "border-destructive"
                          )}
                        />
                        {errors.teamMembers?.[index]?.username && (
                          <p className="text-sm text-destructive mt-1">
                            {errors.teamMembers[index].username?.message}
                          </p>
                        )}
                      </div>

                      <div>
                        <Label htmlFor={`member-${member.id}-allocation`}>Allocation %</Label>
                        <Input
                          id={`member-${member.id}-allocation`}
                          type="number"
                          name="allocation"
                          value={member.allocation}
                          onChange={(e) => setValue(`teamMembers.${index}.allocation`, parseInt(e.target.value) || 0)}
                          readOnly={teamMembers.length === 1}
                          min="0"
                          max="100"
                          className={cn(
                            "min-h-[44px]",
                            errors.teamMembers?.[index]?.allocation && "border-destructive"
                          )}
                        />
                        {errors.teamMembers?.[index]?.allocation && (
                          <p className="text-sm text-destructive mt-1">
                            {errors.teamMembers[index].allocation?.message}
                          </p>
                        )}
                      </div>
                    </div>

                    {!member.isCreator && (
                      <div>
                        <Label htmlFor={`member-${member.id}-address`}>Wallet Address</Label>
                        <Input
                          id={`member-${member.id}-address`}
                          type="text"
                          value={member.address}
                          onChange={(e) => setValue(`teamMembers.${index}.address`, e.target.value)}
                          placeholder="0x..."
                          className="min-h-[44px]"
                        />
                      </div>
                    )}
                  </div>
                </Card>
              ))}
            </div>

            <Button
              type="button"
              variant="outline"
              onClick={addTeamMember}
              disabled={teamMembers.length >= 10}
              className="w-full min-h-[44px]"
            >
              <Plus className="w-4 h-4 mr-2" />
              Add Team Member
            </Button>

            {teamMembers.length >= 10 && (
              <p className="text-sm text-muted-foreground text-center">
                Maximum 10 team members
              </p>
            )}
          </div>
        )}

        {currentStep === "vesting" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">Vesting Schedule</h2>
              <p className="text-muted-foreground">Lock team tokens for a period of time</p>
            </div>

            <Card className="p-6">
              <div className="flex items-center space-x-2 mb-6">
                <Checkbox
                  id="enable-vesting"
                  checked={vestingSchedule.enabled}
                  onCheckedChange={(checked) => 
                    setValue("vestingSchedule.enabled", checked as boolean)
                  }
                />
                <Label htmlFor="enable-vesting" className="font-medium">
                  Enable Vesting
                </Label>
              </div>

              {vestingSchedule.enabled && (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
                    {Object.entries(VESTING_PRESETS).map(([key, preset]) => (
                      <Button
                        key={key}
                        type="button"
                        variant={vestingSchedule.preset === key ? "default" : "outline"}
                        onClick={() => applyVestingPreset(key as keyof typeof VESTING_PRESETS)}
                        className="min-h-[44px]"
                      >
                        {preset.label}
                      </Button>
                    ))}
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <Label htmlFor="cliff-period">Cliff Period (months)</Label>
                      <Input
                        id="cliff-period"
                        type="number"
                        value={vestingSchedule.cliffPeriod}
                        onChange={(e) => setValue("vestingSchedule.cliffPeriod", parseInt(e.target.value) || 0)}
                        min="0"
                        className={cn(
                          "min-h-[44px]",
                          errors.vestingSchedule?.cliffPeriod && "border-destructive"
                        )}
                      />
                      {errors.vestingSchedule?.cliffPeriod && (
                        <p className="text-sm text-destructive mt-1">
                          {errors.vestingSchedule.cliffPeriod.message}
                        </p>
                      )}
                    </div>

                    <div>
                      <Label htmlFor="vesting-duration">Vesting Duration (months)</Label>
                      <Input
                        id="vesting-duration"
                        type="number"
                        value={vestingSchedule.vestingDuration}
                        onChange={(e) => setValue("vestingSchedule.vestingDuration", parseInt(e.target.value) || 0)}
                        min="1"
                        className={cn(
                          "min-h-[44px]",
                          errors.vestingSchedule?.vestingDuration && "border-destructive"
                        )}
                      />
                      {errors.vestingSchedule?.vestingDuration && (
                        <p className="text-sm text-destructive mt-1">
                          {errors.vestingSchedule.vestingDuration.message}
                        </p>
                      )}
                    </div>
                  </div>

                  <Alert>
                    <AlertDescription>
                      <p className="font-medium mb-1">How vesting works:</p>
                      <ul className="text-sm space-y-1">
                        <li>• No tokens released until cliff period ends</li>
                        <li>• Linear release after cliff period</li>
                      </ul>
                    </AlertDescription>
                  </Alert>
                </div>
              )}
            </Card>
          </div>
        )}

        {currentStep === "treasury" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">Treasury Allocation</h2>
              <p className="text-muted-foreground">Reserve tokens for future use</p>
            </div>

            <Card className="p-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="treasury-percentage">Treasury %</Label>
                  <Input
                    id="treasury-percentage"
                    type="number"
                    value={treasuryPercentage}
                    onChange={(e) => setValue("treasuryPercentage", parseInt(e.target.value) || 0)}
                    min="0"
                    max="50"
                    className={cn(
                      "min-h-[44px]",
                      errors.treasuryPercentage && "border-destructive"
                    )}
                  />
                  {errors.treasuryPercentage && (
                    <p className="text-sm text-destructive mt-1">
                      {errors.treasuryPercentage.message}
                    </p>
                  )}
                </div>

                {treasuryPercentage > 0 && (
                  <Alert>
                    <AlertDescription>
                      <p className="font-medium">
                        {100 - treasuryPercentage}% available for team distribution
                      </p>
                    </AlertDescription>
                  </Alert>
                )}
              </div>
            </Card>
          </div>
        )}

        {currentStep === "token" && (
          <div className="space-y-6">
            <div>
              <h2 className="text-xl font-semibold mb-2">Token Details</h2>
              <p className="text-muted-foreground">Configure your team token</p>
            </div>

            <Card className="p-6">
              <div className="space-y-4">
                <div>
                  <Label htmlFor="token-name">Token Name</Label>
                  <Input
                    id="token-name"
                    type="text"
                    value={watch("tokenName")}
                    onChange={(e) => setValue("tokenName", e.target.value)}
                    placeholder="My Team Token"
                    className={cn(
                      "min-h-[44px]",
                      errors.tokenName && "border-destructive"
                    )}
                  />
                  {errors.tokenName && (
                    <p className="text-sm text-destructive mt-1">
                      {errors.tokenName.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="token-symbol">Token Symbol</Label>
                  <Input
                    id="token-symbol"
                    type="text"
                    value={watch("tokenSymbol")}
                    onChange={(e) => setValue("tokenSymbol", e.target.value.toUpperCase())}
                    placeholder="TEAM"
                    className={cn(
                      "min-h-[44px]",
                      errors.tokenSymbol && "border-destructive"
                    )}
                  />
                  {errors.tokenSymbol && (
                    <p className="text-sm text-destructive mt-1">
                      {errors.tokenSymbol.message}
                    </p>
                  )}
                </div>

                <div>
                  <Label htmlFor="token-description">Description (optional)</Label>
                  <Input
                    id="token-description"
                    type="text"
                    value={watch("tokenDescription")}
                    onChange={(e) => setValue("tokenDescription", e.target.value)}
                    placeholder="A token for our amazing team"
                    className="min-h-[44px]"
                  />
                </div>

                <div>
                  <Label htmlFor="token-image">Token Image (optional)</Label>
                  <Input
                    id="token-image"
                    type="file"
                    accept="image/*"
                    onChange={handleImageChange}
                    className="min-h-[44px]"
                  />
                  {imagePreview && (
                    <div className="mt-2">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={imagePreview}
                        alt="Token preview"
                        className="w-20 h-20 rounded-lg object-cover"
                      />
                    </div>
                  )}
                </div>
              </div>
            </Card>
          </div>
        )}

        {currentStep === "review" && (
          <div className="space-y-6">
            <div>
              <h1 className="text-xl font-semibold mb-2">Review Team Token</h1>
              <p className="text-muted-foreground">Review your configuration before deployment</p>
            </div>

            <Card className="p-6">
              <div className="space-y-4">
                <div>
                  <p className="text-sm text-muted-foreground">Team Members</p>
                  <p className="font-medium">Team Members: {teamMembers.length}</p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Treasury</p>
                  <p className="font-medium">Treasury: {treasuryPercentage}%</p>
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Vesting</p>
                  <p className="font-medium">
                    Vesting: {vestingSchedule.enabled ? "Enabled" : "Disabled"}
                  </p>
                  {vestingSchedule.enabled && (
                    <p className="text-sm text-muted-foreground">
                      {vestingSchedule.cliffPeriod} month cliff, {vestingSchedule.vestingDuration} month duration
                    </p>
                  )}
                </div>

                <div>
                  <p className="text-sm text-muted-foreground">Token</p>
                  <p className="font-medium">{watch("tokenName")} ({watch("tokenSymbol")})</p>
                </div>
              </div>
            </Card>
          </div>
        )}
      </div>

      {/* Footer Actions */}
      <div className="fixed bottom-0 left-0 right-0 bg-background border-t border-border p-4">
        <div className="flex gap-3">
          {currentStep !== "team" && (
            <Button
              variant="outline"
              onClick={handleBack}
              className="flex-1 min-h-[44px]"
            >
              Back
            </Button>
          )}
          
          {currentStep === "review" ? (
            <Button
              onClick={handleDeploy}
              disabled={isDeploying}
              className="flex-1 min-h-[44px]"
            >
              {isDeploying ? "Deploying..." : "Review & Deploy"}
            </Button>
          ) : (
            <Button
              onClick={handleNext}
              className="flex-1 min-h-[44px]"
            >
              Continue
            </Button>
          )}
        </div>
      </div>
    </div>
  );
}