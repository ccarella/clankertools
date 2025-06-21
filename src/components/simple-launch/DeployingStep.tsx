import { ClientDeployment } from "@/components/deploy/ClientDeployment";

interface DeployingStepProps {
  showClientDeployment: boolean;
  deploymentData: {
    name: string;
    symbol: string;
    imageUrl: string;
    description?: string;
    marketCap: string;
    creatorReward: number;
    deployerAddress: string;
  } | null;
  targetChainId?: number;
  onSuccess: (result: { tokenAddress: string; transactionHash: string }) => void;
  onError: (error: Error) => void;
}

export function DeployingStep({
  showClientDeployment,
  deploymentData,
  targetChainId,
  onSuccess,
  onError,
}: DeployingStepProps) {
  return (
    <div className="space-y-6">
      {!showClientDeployment ? (
        <div className="flex flex-col items-center justify-center py-20">
          <div 
            className="w-16 h-16 border-4 border-primary border-t-transparent rounded-full animate-spin mb-6"
            data-testid="loading-spinner"
          />
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
              onSuccess={onSuccess}
              onError={onError}
              targetChainId={targetChainId}
            />
          )}
        </div>
      )}
    </div>
  );
}