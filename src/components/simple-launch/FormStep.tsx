import { useRef } from "react";
import Image from "next/image";
import { Plus, Camera, Upload, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Slider } from "@/components/ui/slider";
import { Label } from "@/components/ui/label";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { UseFormReturn } from "react-hook-form";
import { useWallet } from "@/providers/WalletProvider";
import { useFarcasterAuth } from "@/components/providers/FarcasterAuthProvider";
import { WalletButton } from "@/components/wallet/WalletButton";
import { CastContextDisplay } from "@/components/CastContextDisplay";
import { cn } from "@/lib/utils";
import { PRESET_FEE_STRUCTURES, calculateCreatorPlatformSplit } from "@/lib/feeCalculations";

type FormData = {
  name: string;
  symbol: string;
  image: File | null;
  creatorFeePercentage: number;
  platformFeePercentage: number;
};

interface FormStepProps {
  form: UseFormReturn<FormData>;
  imagePreview: string | null;
  setImagePreview: (preview: string | null) => void;
  enableCreatorRewards: boolean;
  setEnableCreatorRewards: (enabled: boolean) => void;
  requireWallet: boolean;
  showDebug: boolean;
  setShowDebug: (show: boolean) => void;
  onSubmit: () => void;
  cameraSupported?: boolean;
}

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function FormStep({
  form,
  imagePreview,
  setImagePreview,
  enableCreatorRewards,
  setEnableCreatorRewards,
  requireWallet,
  showDebug,
  setShowDebug,
  onSubmit,
  cameraSupported = false,
}: FormStepProps) {
  const { isConnected, address } = useWallet();
  const { user, castContext } = useFarcasterAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    register,
    formState: { errors },
    watch,
    setValue,
    trigger,
  } = form;

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

  return (
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
            <div className="relative w-full h-48">
              <Image
                src={imagePreview}
                fill
                alt="Token preview"
                className="object-cover rounded-lg"
                sizes="(max-width: 768px) 100vw, (max-width: 1200px) 50vw, 33vw"
                priority
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
        <TooltipProvider>
          <Card className="mb-6">
            <CardContent className="pt-6">
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Label>Fee Split</Label>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <Info className="w-4 h-4 text-muted-foreground" />
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>Configure how trading fees are distributed</p>
                      </TooltipContent>
                    </Tooltip>
                  </div>
                  <span className="text-sm font-medium">
                    {watch("creatorFeePercentage")}% / {watch("platformFeePercentage")}%
                  </span>
                </div>
                
                <Slider
                  value={[watch("creatorFeePercentage") || 80]}
                  onValueChange={(value) => {
                    const split = calculateCreatorPlatformSplit(value[0]);
                    setValue("creatorFeePercentage", split.creatorPercentage);
                    setValue("platformFeePercentage", split.platformPercentage);
                  }}
                  min={50}
                  max={95}
                  step={5}
                  className="w-full"
                  data-testid="fee-slider"
                />
                
                <div className="flex justify-between text-xs text-muted-foreground">
                  <span>Creator: {watch("creatorFeePercentage")}%</span>
                  <span>Platform: {watch("platformFeePercentage")}%</span>
                </div>
                
                <div className="grid grid-cols-3 gap-2 mt-4">
                  {Object.values(PRESET_FEE_STRUCTURES).map((preset) => (
                    <Button
                      key={preset.name}
                      type="button"
                      variant="outline"
                      size="sm"
                      onClick={() => {
                        setValue("creatorFeePercentage", preset.creatorPercentage);
                        setValue("platformFeePercentage", preset.platformPercentage);
                      }}
                      className={cn(
                        "text-xs",
                        watch("creatorFeePercentage") === preset.creatorPercentage && "ring-2 ring-primary"
                      )}
                    >
                      {preset.description}
                    </Button>
                  ))}
                </div>
              </div>
            </CardContent>
          </Card>
        </TooltipProvider>
        
        {/* Launch Button */}
        <Button
          type="button"
          onClick={onSubmit}
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
  );
}