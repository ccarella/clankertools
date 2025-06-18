"use client";

import { useState, useRef } from "react";
import { ArrowLeft, Plus, Camera, Upload, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { Clanker, PublicClient, WalletClient } from "clanker-sdk";
import { createPublicClient, createWalletClient, http } from "viem";
import { base } from "viem/chains";
import { privateKeyToAccount } from "viem/accounts";

type FormData = {
  name: string;
  symbol: string;
  image: File | null;
};

type ViewState = "form" | "review" | "deploying" | "success" | "error";

export default function SimpleLaunchPage() {
  const router = useRouter();
  const [viewState, setViewState] = useState<ViewState>("form");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [deploymentError, setDeploymentError] = useState<string>("");
  const [, setTokenAddress] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [cameraSupported, setCameraSupported] = useState(false);

  const {
    register,
    handleSubmit,
    formState: { errors },
    watch,
    setValue,
    trigger,
  } = useForm<FormData>({
    defaultValues: {
      name: "",
      symbol: "",
      image: null,
    },
  });

  // Check for camera support
  useState(() => {
    if (typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(() => setCameraSupported(true))
        .catch(() => setCameraSupported(false));
    }
  });

  const handleImageUpload = (file: File) => {
    setValue("image", file);
    trigger("image");

    const reader = new FileReader();
    reader.onloadend = () => {
      setImagePreview(reader.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleImageUpload(file);
    }
  };

  const handleCameraCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      // Camera capture logic would go here
      // For now, just trigger file input
      fileInputRef.current?.click();
      stream.getTracks().forEach(track => track.stop());
    } catch (error) {
      console.error("Camera access denied:", error);
      fileInputRef.current?.click();
    }
  };

  const onSubmit = async (data: FormData) => {
    if (viewState === "form") {
      setViewState("review");
      return;
    }

    if (viewState === "review") {
      setViewState("deploying");
      
      try {
        // For demo purposes, we'll need proper wallet setup
        // This is a placeholder - in production, you'd use the user's connected wallet
        const account = privateKeyToAccount('0x0000000000000000000000000000000000000000000000000000000000000001' as `0x${string}`);
        
        const publicClient = createPublicClient({
          chain: base,
          transport: http(),
        }) as PublicClient;
        
        const wallet = createWalletClient({
          account,
          chain: base,
          transport: http(),
        }) as WalletClient;
        
        // Initialize Clanker client
        const clanker = new Clanker({
          wallet,
          publicClient,
        });
        
        // Convert image file to IPFS URL (placeholder - would need actual IPFS upload)
        const imageUrl = "ipfs://placeholder-image-hash";
        
        // Deploy token with proper configuration
        const tokenAddress = await clanker.deployToken({
          name: data.name,
          symbol: data.symbol,
          image: imageUrl,
          pool: {
            quoteToken: "0x4200000000000000000000000000000000000006" as `0x${string}`, // WETH on Base
            initialMarketCap: "0.1", // 0.1 ETH initial market cap
          },
          rewardsConfig: {
            creatorReward: 80, // 80% creator reward
            creatorAdmin: account.address,
            creatorRewardRecipient: account.address,
            interfaceAdmin: "0x1eaf444ebDf6495C57aD52A04C61521bBf564ace" as `0x${string}`,
            interfaceRewardRecipient: "0x1eaf444ebDf6495C57aD52A04C61521bBf564ace" as `0x${string}`,
          },
        });

        setTokenAddress(tokenAddress);
        setViewState("success");
        
        // Redirect to token page after a short delay
        setTimeout(() => {
          router.push(`/token/${tokenAddress}`);
        }, 2000);
      } catch (error) {
        console.error("Deployment error:", error);
        setDeploymentError(error instanceof Error ? error.message : "Deployment failed");
        setViewState("error");
      }
    }
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
  };

  // Auto-uppercase symbol
  const symbolValue = watch("symbol");
  if (symbolValue && symbolValue !== symbolValue.toUpperCase()) {
    setValue("symbol", symbolValue.toUpperCase());
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
        <h1 className="text-lg font-semibold text-foreground">
          {viewState === "review" ? "Review Your Token" : "Simple Launch"}
        </h1>
        <div className="w-10" />
      </div>

      {/* Content */}
      <form onSubmit={handleSubmit(onSubmit)} className="p-6 space-y-6">
        {viewState === "form" && (
          <>
            {/* Name Field */}
            <div className="space-y-2">
              <label htmlFor="name" className="text-sm font-medium text-foreground">
                Name
              </label>
              <Input
                id="name"
                placeholder="My Token"
                className="h-12 text-base"
                {...register("name", {
                  required: "Name is required",
                  maxLength: {
                    value: 32,
                    message: "Name must be 32 characters or less",
                  },
                })}
              />
              {errors.name && (
                <p className="text-sm text-destructive">{errors.name.message}</p>
              )}
            </div>

            {/* Symbol Field */}
            <div className="space-y-2">
              <label htmlFor="symbol" className="text-sm font-medium text-foreground">
                Symbol
              </label>
              <Input
                id="symbol"
                placeholder="MYT"
                className="h-12 text-base"
                {...register("symbol", {
                  required: "Symbol is required",
                  minLength: {
                    value: 3,
                    message: "Symbol must be between 3 and 8 characters",
                  },
                  maxLength: {
                    value: 8,
                    message: "Symbol must be between 3 and 8 characters",
                  },
                })}
              />
              {errors.symbol && (
                <p className="text-sm text-destructive">{errors.symbol.message}</p>
              )}
            </div>

            {/* Image Upload */}
            <div className="space-y-2">
              <label className="text-sm font-medium text-foreground">Image</label>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture={cameraSupported ? "environment" : undefined}
                className="hidden"
                onChange={handleFileInputChange}
              />
              
              {!imagePreview ? (
                <Card 
                  className="p-8 border-2 border-dashed border-border hover:border-primary/50 transition-colors cursor-pointer"
                  onClick={() => fileInputRef.current?.click()}
                >
                  <div className="flex flex-col items-center justify-center text-center">
                    <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                      <Plus className="w-6 h-6 text-muted-foreground" />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      Click to upload or drag and drop
                    </p>
                    {cameraSupported && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        className="mt-2"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCameraCapture();
                        }}
                      >
                        <Camera className="w-4 h-4 mr-2" />
                        Take Photo
                      </Button>
                    )}
                  </div>
                </Card>
              ) : (
                <Card className="p-4">
                  <div className="relative">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imagePreview}
                      alt="Token preview"
                      className="w-full h-48 object-cover rounded-lg"
                    />
                    <Button
                      type="button"
                      variant="secondary"
                      size="sm"
                      className="absolute top-2 right-2"
                      onClick={() => fileInputRef.current?.click()}
                    >
                      <Upload className="w-4 h-4 mr-2" />
                      Change
                    </Button>
                  </div>
                </Card>
              )}
              
              <input type="hidden" {...register("image", { required: "Image is required" })} />
              {errors.image && (
                <p className="text-sm text-destructive">{errors.image.message}</p>
              )}
            </div>

            {/* Split Information */}
            <div className="pt-8 border-t border-border">
              <p className="text-center text-lg font-medium text-foreground mb-8">
                80% / 20% split
              </p>
              
              {/* Launch Button */}
              <Button
                type="submit"
                className="w-full h-12 text-lg font-medium bg-primary hover:bg-primary/90"
                size="lg"
              >
                Launch Token
              </Button>
            </div>
          </>
        )}

        {viewState === "review" && (
          <div className="space-y-6">
            {/* Token Preview */}
            <Card className="p-6">
              <div className="flex items-center space-x-4 mb-6">
                {imagePreview && (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={imagePreview}
                      alt="Token"
                      className="w-20 h-20 rounded-full object-cover"
                    />
                  </>
                )}
                <div>
                  <h3 className="text-xl font-semibold text-foreground">
                    {watch("name")}
                  </h3>
                  <p className="text-lg text-muted-foreground">{watch("symbol")}</p>
                </div>
              </div>

              <div className="space-y-4">
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Total Supply</span>
                  <span className="font-medium">1,000,000,000</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Paired Token</span>
                  <span className="font-medium">WETH</span>
                </div>
                <div className="flex justify-between py-2 border-b border-border">
                  <span className="text-muted-foreground">Initial Liquidity</span>
                  <span className="font-medium">100%</span>
                </div>
                <div className="py-2">
                  <div className="flex justify-between mb-2">
                    <span className="text-muted-foreground">Fee Split</span>
                    <span className="font-medium">1% Total</span>
                  </div>
                  <div className="ml-4 space-y-1">
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">80% Creator</span>
                      <span>0.8%</span>
                    </div>
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">20% Platform</span>
                      <span>0.2%</span>
                    </div>
                  </div>
                </div>
              </div>
            </Card>

            <div className="space-y-3">
              <Button
                type="submit"
                className="w-full h-12 text-lg font-medium bg-primary hover:bg-primary/90"
                size="lg"
              >
                Confirm & Launch
              </Button>
              <Button
                type="button"
                variant="outline"
                className="w-full h-12"
                size="lg"
                onClick={() => setViewState("form")}
              >
                Edit
              </Button>
            </div>
          </div>
        )}

        {viewState === "deploying" && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-6" />
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Deploying Your Token
            </h2>
            <p className="text-muted-foreground text-center">
              This may take a few moments...
            </p>
          </div>
        )}

        {viewState === "success" && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-6">
              <Check className="w-8 h-8 text-green-600" />
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Token Deployed!
            </h2>
            <p className="text-muted-foreground text-center">
              Redirecting to your token page...
            </p>
          </div>
        )}

        {viewState === "error" && (
          <div className="flex flex-col items-center justify-center py-20">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
              <span className="text-2xl">⚠️</span>
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Deployment Failed
            </h2>
            <p className="text-muted-foreground text-center mb-6">
              {deploymentError}
            </p>
            <Button
              type="button"
              onClick={handleTryAgain}
              className="w-full max-w-xs"
            >
              Try Again
            </Button>
          </div>
        )}
      </form>
    </div>
  );
}