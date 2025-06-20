"use client";

import { useState, useRef, useEffect } from "react";
import { ArrowLeft, Plus, Camera, Upload, Check, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { useRouter } from "next/navigation";
import { useForm } from "react-hook-form";
import { useWallet } from "@/providers/WalletProvider";
import { useFarcasterAuth } from "@/components/providers/FarcasterAuthProvider";
import { WalletButton } from "@/components/wallet/WalletButton";
import { CastContextDisplay } from "@/components/CastContextDisplay";
import { ClientDeployment } from "@/components/deploy/ClientDeployment";

type FormData = {
  name: string;
  symbol: string;
  image: File | null;
};

type ViewState = "form" | "review" | "deploying" | "success" | "error";

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

function renderValue(value: unknown): React.ReactNode {
  if (value === null || value === undefined) return null;
  if (typeof value === 'string' || typeof value === 'number') {
    return value;
  }
  if (typeof value === 'boolean') {
    return value.toString();
  }
  return String(value);
}

export default function SimpleLaunchPage() {
  const router = useRouter();
  const { isConnected, address, connect, isLoading, error: walletError } = useWallet();
  const { user, castContext } = useFarcasterAuth();
  const [viewState, setViewState] = useState<ViewState>("form");
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [deploymentError, setDeploymentError] = useState<string>("");
  const [errorDetails, setErrorDetails] = useState<Record<string, unknown> | null>(null);
  const [debugInfo, setDebugInfo] = useState<Record<string, unknown> | null>(null);
  const [, setTokenAddress] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);
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
  const [showClientDeployment, setShowClientDeployment] = useState(false);

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
        // Default to not required on error
        setRequireWallet(false);
      });
  }, []);

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
            // Continue with deployment even if wallet storage fails
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
        };

        // Debug logging
        console.log('Deployment request:', {
          ...deploymentRequest,
          imageFile: deploymentRequest.imageFile ? `${deploymentRequest.imageFile.substring(0, 50)}...` : 'No image',
          user,
          address,
        });

        // Call prepare API to get deployment data
        const response = await fetch("/api/deploy/simple/prepare", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(deploymentRequest),
        });

        const result = await response.json();

        if (!response.ok || !result.success) {
          // Store detailed error information
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
        setShowClientDeployment(true);
      } catch (error) {
        console.error("Deployment preparation error:", error);
        setDeploymentError(error instanceof Error ? error.message : "Deployment preparation failed");
        setViewState("error");
      }
    }
  };

  const handleDeploymentSuccess = (result: { tokenAddress: string; transactionHash: string }) => {
    setTokenAddress(result.tokenAddress);
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
            {/* Cast Context Display */}
            {castContext && (
              <CastContextDisplay context={castContext} />
            )}
            
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
                data-testid="file-input"
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

            {/* Wallet Connection Section */}
            {user && (
              <div className="space-y-4 pt-6 border-t border-border">
                <div className="space-y-2">
                  <label className="text-sm font-medium text-foreground">
                    Creator Rewards Wallet
                    {requireWallet && !isConnected && (
                      <span className="text-destructive ml-2">*Wallet required</span>
                    )}
                  </label>
                  <p className="text-sm text-muted-foreground">
                    {requireWallet
                      ? "Connect your wallet to receive creator rewards"
                      : "Connect your wallet to receive 80% of the platform fees"
                    }
                  </p>
                </div>
                
                {!isConnected ? (
                  <>
                    <WalletButton />
                    {requireWallet && (
                      <p className="text-sm text-destructive text-center">
                        Connect wallet to continue
                      </p>
                    )}
                  </>
                ) : (
                  <div className="space-y-4">
                    <div className="flex items-center justify-between p-3 bg-muted/20 rounded-lg">
                      <span className="text-sm">Connected: {truncateAddress(address!)}</span>
                      <WalletButton />
                    </div>
                    
                    <div className="flex items-center space-x-2">
                      <Checkbox
                        id="creator-rewards"
                        checked={enableCreatorRewards}
                        onCheckedChange={(checked) => setEnableCreatorRewards(!!checked)}
                        disabled={requireWallet}
                      />
                      <label
                        htmlFor="creator-rewards"
                        className="text-sm font-medium leading-none peer-disabled:cursor-not-allowed peer-disabled:opacity-70"
                      >
                        Use this wallet for creator rewards
                      </label>
                    </div>
                  </div>
                )}
              </div>
            )}

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
                disabled={requireWallet && !isConnected}
              >
                Launch Token
              </Button>
              
              {/* Debug Toggle (Mini App Helper) */}
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="w-full mt-2 text-xs text-muted-foreground"
                onClick={() => setShowDebug(!showDebug)}
              >
                {showDebug ? "Hide" : "Show"} Debug Info
              </Button>
              
              {/* Debug Information */}
              {showDebug && (
                <Card className="mt-4 p-3 bg-muted/50 text-xs">
                  <h4 className="font-semibold mb-2">Debug Info</h4>
                  <div className="space-y-1 font-mono">
                    <div>Name: {watch("name") || "empty"}</div>
                    <div>Symbol: {watch("symbol") || "empty"}</div>
                    <div>Image: {watch("image") ? `${(watch("image")!.size / 1024).toFixed(2)} KB` : "not selected"}</div>
                    <div>Image Type: {watch("image")?.type || "none"}</div>
                    <div>FID: {user?.fid || "not authenticated"}</div>
                    <div>Cast Context: {castContext ? "present" : "none"}</div>
                    <div>Wallet: {isConnected ? truncateAddress(address!) : "not connected"}</div>
                    <div>Creator Rewards: {enableCreatorRewards ? "enabled" : "disabled"}</div>
                  </div>
                </Card>
              )}
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
                {user && isConnected && enableCreatorRewards && (
                  <div className="flex justify-between py-2 border-b border-border">
                    <span className="text-muted-foreground">Creator Wallet</span>
                    <span className="font-medium text-sm">{truncateAddress(address!)}</span>
                  </div>
                )}
              </div>
            </Card>

            <div className="space-y-3">
              {!isConnected ? (
                <>
                  <Button
                    type="button"
                    onClick={connect}
                    disabled={isLoading}
                    className="w-full h-12 text-lg font-medium bg-primary hover:bg-primary/90"
                    size="lg"
                  >
                    <Wallet className="w-4 h-4 mr-2" />
                    {isLoading ? 'Connecting...' : 'Connect Wallet'}
                  </Button>
                  {walletError && !isLoading && (
                    <p className="text-sm text-destructive text-center">
                      {walletError}
                    </p>
                  )}
                </>
              ) : (
                <Button
                  type="submit"
                  className="w-full h-12 text-lg font-medium bg-primary hover:bg-primary/90"
                  size="lg"
                >
                  Confirm & Launch
                </Button>
              )}
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
          <div className="space-y-6">
            {!showClientDeployment ? (
              <div className="flex flex-col items-center justify-center py-20">
                <div className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-6" />
                <h2 className="text-xl font-semibold text-foreground mb-2">
                  Preparing Deployment
                </h2>
                <p className="text-muted-foreground text-center">
                  Uploading image and preparing token data...
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <h2 className="text-xl font-semibold text-foreground text-center mb-4">
                  Deploy Your Token
                </h2>
                <p className="text-muted-foreground text-center mb-6">
                  Confirm the transaction in your wallet to deploy the token
                </p>
                {deploymentData && (
                  <ClientDeployment
                    tokenData={deploymentData}
                    onSuccess={handleDeploymentSuccess}
                    onError={handleDeploymentError}
                  />
                )}
              </div>
            )}
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
          <div className="flex flex-col items-center justify-center py-20 max-w-2xl mx-auto">
            <div className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-6">
              <span className="text-2xl">⚠️</span>
            </div>
            <h2 className="text-xl font-semibold text-foreground mb-2">
              Deployment Failed
            </h2>
            <p className="text-muted-foreground text-center mb-6">
              {deploymentError}
            </p>
            
            {/* Detailed Error Information */}
            {errorDetails && (
              <Card className="w-full p-4 mb-6 bg-destructive/5 border-destructive/20">
                <h3 className="font-semibold mb-2 text-sm">Error Details</h3>
                <div className="space-y-2 text-sm">
                  {'type' in errorDetails && errorDetails.type ? (
                    <div>
                      <span className="font-medium">Type:</span> {renderValue(errorDetails.type)}
                    </div>
                  ) : null}
                  {'userMessage' in errorDetails && errorDetails.userMessage ? (
                    <div className="text-destructive">
                      {renderValue(errorDetails.userMessage)}
                    </div>
                  ) : null}
                  {'code' in errorDetails && errorDetails.code ? (
                    <div className="text-xs">
                      <span className="font-medium">Error Code:</span> {renderValue(errorDetails.code)}
                    </div>
                  ) : null}
                  {'details' in errorDetails && errorDetails.details ? (
                    <div className="text-xs text-muted-foreground mt-2">
                      <span className="font-medium">Technical:</span> {renderValue(errorDetails.details)}
                    </div>
                  ) : null}
                </div>
              </Card>
            )}
            
            {/* Debug Information */}
            {debugInfo && (
              <Card className="w-full p-4 mb-6 bg-muted/50">
                <h3 className="font-semibold mb-2 text-sm">Debug Information</h3>
                <div className="space-y-1 text-xs font-mono">
                  {'step' in debugInfo && debugInfo.step ? (
                    <div>Failed Step: {renderValue(debugInfo.step)}</div>
                  ) : null}
                  {'network' in debugInfo && debugInfo.network ? (
                    <div>Network: {renderValue(debugInfo.network)}</div>
                  ) : null}
                  {'attempt' in debugInfo && debugInfo.attempt ? (
                    <div>Attempt: {renderValue(debugInfo.attempt)}/{renderValue(debugInfo.maxRetries || 3)}</div>
                  ) : null}
                  {'requestId' in debugInfo && debugInfo.requestId ? (
                    <div>Request ID: {renderValue(debugInfo.requestId)}</div>
                  ) : null}
                  {'timestamp' in debugInfo && debugInfo.timestamp ? (
                    <div>Time: {new Date(String(debugInfo.timestamp)).toLocaleTimeString()}</div>
                  ) : null}
                  
                  {/* Request Context */}
                  {'requestContext' in debugInfo && debugInfo.requestContext && typeof debugInfo.requestContext === 'object' ? (
                    <>
                      <div className="mt-2 font-semibold">Request Context:</div>
                      <div className="ml-2">
                        {'hasImage' in debugInfo.requestContext && (
                          <div>Has Image: {debugInfo.requestContext.hasImage ? "Yes" : "No"}</div>
                        )}
                        {'imageSize' in debugInfo.requestContext && debugInfo.requestContext.imageSize !== undefined ? (
                          <div>Image Size: {(Number(debugInfo.requestContext.imageSize) / 1024).toFixed(2)} KB</div>
                        ) : null}
                        {'imageType' in debugInfo.requestContext && debugInfo.requestContext.imageType ? (
                          <div>Image Type: {renderValue(debugInfo.requestContext.imageType)}</div>
                        ) : null}
                        {'fid' in debugInfo.requestContext && debugInfo.requestContext.fid ? (
                          <div>FID: {renderValue(debugInfo.requestContext.fid)}</div>
                        ) : null}
                        {'hasCastContext' in debugInfo.requestContext && (
                          <div>Cast Context: {debugInfo.requestContext.hasCastContext ? "Yes" : "No"}</div>
                        )}
                      </div>
                    </>
                  ) : null}
                  
                  {/* Validation Errors */}
                  {'validationErrors' in debugInfo && Array.isArray(debugInfo.validationErrors) && debugInfo.validationErrors.length > 0 ? (
                    <>
                      <div className="mt-2 font-semibold">Missing Fields:</div>
                      <div className="ml-2 text-destructive">
                        {debugInfo.validationErrors.join(', ')}
                      </div>
                    </>
                  ) : null}
                  
                  {/* Missing Config */}
                  {'missingConfig' in debugInfo && Array.isArray(debugInfo.missingConfig) && debugInfo.missingConfig.length > 0 ? (
                    <>
                      <div className="mt-2 font-semibold">Missing Configuration:</div>
                      <div className="ml-2 text-destructive">
                        {debugInfo.missingConfig.join(', ')}
                      </div>
                    </>
                  ) : null}
                  
                  {/* Deployment Params */}
                  {'deploymentParams' in debugInfo && debugInfo.deploymentParams && typeof debugInfo.deploymentParams === 'object' ? (
                    <>
                      <div className="mt-2 font-semibold">Deployment Parameters:</div>
                      <div className="ml-2">
                        {'name' in debugInfo.deploymentParams && (
                          <div>Name: {renderValue(debugInfo.deploymentParams.name)}</div>
                        )}
                        {'symbol' in debugInfo.deploymentParams && (
                          <div>Symbol: {renderValue(debugInfo.deploymentParams.symbol)}</div>
                        )}
                        {'chainId' in debugInfo.deploymentParams && (
                          <div>Chain ID: {renderValue(debugInfo.deploymentParams.chainId)}</div>
                        )}
                      </div>
                    </>
                  ) : null}
                </div>
              </Card>
            )}
            
            <div className="flex flex-col space-y-2 w-full max-w-xs">
              <Button
                type="button"
                onClick={handleTryAgain}
                className="w-full"
              >
                Try Again
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => {
                  setViewState("form");
                  setDeploymentError("");
                  setErrorDetails(null);
                  setDebugInfo(null);
                }}
                className="w-full"
              >
                Start Over
              </Button>
            </div>
          </div>
        )}
      </form>
    </div>
  );
}