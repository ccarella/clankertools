import { Wallet } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { UseFormReturn } from "react-hook-form";
import { useWallet } from "@/providers/WalletProvider";
import { useFarcasterAuth } from "@/components/providers/FarcasterAuthProvider";

type FormData = {
  name: string;
  symbol: string;
  image: File | null;
  creatorFeePercentage: number;
  platformFeePercentage: number;
};

interface ReviewStepProps {
  form: UseFormReturn<FormData>;
  imagePreview: string | null;
  enableCreatorRewards: boolean;
  onConfirm: () => void;
  onEdit: () => void;
}

function truncateAddress(address: string): string {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function ReviewStep({
  form,
  imagePreview,
  enableCreatorRewards,
  onConfirm,
  onEdit,
}: ReviewStepProps) {
  const { isConnected, address, connect, isLoading, error: walletError } = useWallet();
  const { user } = useFarcasterAuth();
  const { watch } = form;

  return (
    <div className="space-y-6">
      {/* Token Preview */}
      <Card className="p-6">
        <div className="flex items-center space-x-4 mb-6">
          {imagePreview && (
            <div className="relative w-20 h-20">
              <Image
                src={imagePreview}
                alt="Token"
                fill
                className="rounded-full object-cover"
                sizes="80px"
                priority
              />
            </div>
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
                <span className="text-muted-foreground">{watch("creatorFeePercentage")}% Creator</span>
                <span>{(watch("creatorFeePercentage") / 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-muted-foreground">{watch("platformFeePercentage")}% Platform</span>
                <span>{(watch("platformFeePercentage") / 100).toFixed(1)}%</span>
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
            type="button"
            onClick={onConfirm}
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
          onClick={onEdit}
        >
          Edit
        </Button>
      </div>
    </div>
  );
}