"use client";

import { useState, useEffect, lazy, Suspense } from "react";
import { ArrowLeft } from "lucide-react";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useWallet } from "@/providers/WalletProvider";
import { useFarcasterAuth } from "@/components/providers/FarcasterAuthProvider";
import { Skeleton } from "@/components/ui/skeleton";
import { PRESET_FEE_STRUCTURES } from "@/lib/feeCalculations";

// Lazy load components for better performance
const FormStep = lazy(() => import("@/components/simple-launch").then(m => ({ default: m.FormStep })));
const ReviewStep = lazy(() => import("@/components/simple-launch").then(m => ({ default: m.ReviewStep })));
const DeployingStep = lazy(() => import("@/components/simple-launch").then(m => ({ default: m.DeployingStep })));
const SuccessStep = lazy(() => import("@/components/simple-launch").then(m => ({ default: m.SuccessStep })));
const ErrorStep = lazy(() => import("@/components/simple-launch").then(m => ({ default: m.ErrorStep })));

type FormData = {
  name: string;
  symbol: string;
  image: File | null;
  creatorFeePercentage: number;
  platformFeePercentage: number;
};

type ViewState = "form" | "review" | "deploying" | "success" | "error";

// Loading skeleton for lazy loaded components
function StepSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-12 w-full" />
      <Skeleton className="h-48 w-full" />
      <Skeleton className="h-12 w-full" />
    </div>
  );
}

export default function SimpleLaunchPage() {
  const router = useRouter();
  const { isConnected, address } = useWallet();
  const { user, castContext } = useFarcasterAuth();
  const [viewState, setViewState] = useState<ViewState>("form");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [deploymentError, setDeploymentError] = useState<string>("");
  const [errorDetails, setErrorDetails] = useState<Record<string, unknown> | null>(null);
  const [debugInfo, setDebugInfo] = useState<Record<string, unknown> | null>(null);
  const [cameraSupported, setCameraSupported] = useState(false);
  const [enableCreatorRewards, setEnableCreatorRewards] = useState(true);
  const [showDebug, setShowDebug] = useState(false);
  const [requireWallet, setRequireWallet] = useState(false);
  const [deploymentData, setDeploymentData] = useState<{
    name: string;
    symbol: string;
    imageUrl: string;
    description?: string;
    marketCap: string;
    creatorReward: number;
    deployerAddress: string;
  } | null>(null);
  const [targetChainId, setTargetChainId] = useState<number | undefined>(undefined);
  const [showClientDeployment, setShowClientDeployment] = useState(false);

  const form = useForm<FormData>({
    defaultValues: {
      name: "",
      symbol: "",
      image: null,
      creatorFeePercentage: PRESET_FEE_STRUCTURES.standard.creatorPercentage,
      platformFeePercentage: PRESET_FEE_STRUCTURES.standard.platformPercentage,
    },
  });

  const { handleSubmit, watch, setValue } = form;

  // Check for camera support
  useEffect(() => {
    if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(() => setCameraSupported(true))
        .catch(() => setCameraSupported(false));
    }
  }, []);

  // Fetch wallet requirement config
  useEffect(() => {
    fetch('/api/config/wallet-requirement')
      .then(res => res.json())
      .then(data => {
        setRequireWallet(data.requireWallet);
        if (data.requireWallet) {
          setEnableCreatorRewards(true);
        }
      })
      .catch(err => {
        console.error('Failed to fetch wallet requirement config:', err);
        setRequireWallet(false);
      });
  }, []);

  // Auto-uppercase symbol
  const symbolValue = watch("symbol");
  useEffect(() => {
    if (symbolValue && symbolValue !== symbolValue.toUpperCase()) {
      setValue("symbol", symbolValue.toUpperCase());
    }
  }, [symbolValue, setValue]);

  const onSubmit = async (data: FormData) => {
    if (viewState === "form") {
      setViewState("review");
      return;
    }

    if (viewState === "review") {
      setViewState("deploying");
      
      try {
        // Ensure wallet is connected if required
        if (requireWallet && !isConnected) {
          throw new Error("Wallet connection required for deployment");
        }

        // Store wallet connection data if user is connected
        if (user && isConnected && address) {
          try {
            await fetch("/api/connectWallet", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                fid: user.fid,
                walletAddress: address,
                enableCreatorRewards,
              }),
            });
          } catch (error) {
            console.error("Failed to store wallet connection:", error);
          }
        }

        // Convert image to base64 for API
        let imageBase64 = "";
        if (data.image) {
          const reader = new FileReader();
          imageBase64 = await new Promise((resolve) => {
            reader.onloadend = () => resolve(reader.result as string);
            reader.readAsDataURL(data.image!);
          });
        }

        // Prepare deployment request
        const deploymentRequest = {
          tokenName: data.name,
          tokenSymbol: data.symbol,
          imageFile: imageBase64,
          description: "",
          userFid: user?.fid || 0,
          walletAddress: address || "",
          castContext: castContext || undefined,
          creatorFeePercentage: data.creatorFeePercentage,
          platformFeePercentage: data.platformFeePercentage,
        };

        // Call prepare API to get deployment data
        const response = await fetch("/api/deploy/simple/prepare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(deploymentRequest),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          if (result.errorDetails) {
            setErrorDetails(result.errorDetails);
          }
          if (result.debugInfo) {
            setDebugInfo(result.debugInfo);
          }
          throw new Error(result.error || "Deployment preparation failed");
        }

        // Set deployment data and show client deployment component
        setDeploymentData(result.deploymentData);
        setTargetChainId(result.chainId);
        setShowClientDeployment(true);
      } catch (error) {
        console.error("Deployment preparation error:", error);
        setDeploymentError(error instanceof Error ? error.message : "Deployment preparation failed");
        setViewState("error");
      }
    }
  };

  const handleDeploymentSuccess = (result: { tokenAddress: string; transactionHash: string }) => {
    setViewState("success");
    setShowClientDeployment(false);
    
    // Redirect to token page after a short delay
    setTimeout(() => {
      router.push(`/token/${result.tokenAddress}`);
    }, 2000);
  };

  const handleDeploymentError = (error: Error) => {
    console.error("Deployment error:", error);
    setDeploymentError(error.message);
    setViewState("error");
    setShowClientDeployment(false);
  };

  const handleBack = () => {
    if (viewState === "review") {
      setViewState("form");
    } else {
      router.back();
    }
  };

  const handleTryAgain = () => {
    setViewState("review");
    setDeploymentError("");
    setErrorDetails(null);
    setDebugInfo(null);
  };

  const handleStartOver = () => {
    setViewState("form");
    setDeploymentError("");
    setErrorDetails(null);
    setDebugInfo(null);
  };

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
        <h1 className="text-lg font-semibold text-foreground">
          {viewState === "review" ? "Review Your Token" : "Simple Launch"}
        </h1>
        <div className="w-10" />
      </div>

      {/* Content */}
      <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
        <Suspense fallback={<StepSkeleton />}>
          {viewState === "form" && (
            <FormStep
              form={form}
              imagePreview={imagePreview}
              setImagePreview={setImagePreview}
              enableCreatorRewards={enableCreatorRewards}
              setEnableCreatorRewards={setEnableCreatorRewards}
              requireWallet={requireWallet}
              showDebug={showDebug}
              setShowDebug={setShowDebug}
              onSubmit={handleSubmit(onSubmit)}
              cameraSupported={cameraSupported}
            />
          )}

          {viewState === "review" && (
            <ReviewStep
              form={form}
              imagePreview={imagePreview}
              enableCreatorRewards={enableCreatorRewards}
              onConfirm={handleSubmit(onSubmit)}
              onEdit={() => setViewState("form")}
            />
          )}

          {viewState === "deploying" && (
            <DeployingStep
              showClientDeployment={showClientDeployment}
              deploymentData={deploymentData}
              targetChainId={targetChainId}
              onSuccess={handleDeploymentSuccess}
              onError={handleDeploymentError}
            />
          )}

          {viewState === "success" && <SuccessStep />}

          {viewState === "error" && (
            <ErrorStep
              deploymentError={deploymentError}
              errorDetails={errorDetails}
              debugInfo={debugInfo}
              onTryAgain={handleTryAgain}
              onStartOver={handleStartOver}
            />
          )}
        </Suspense>
      </form>
    </div>
  );
}