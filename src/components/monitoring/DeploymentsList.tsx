import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { ExternalLink } from 'lucide-react';
import type { DeploymentData } from './types';

interface DeploymentsListProps {
  deployments: DeploymentData[];
}

export function DeploymentsList({ deployments }: DeploymentsListProps) {
  const formatAddress = (address: string) => {
    return `${address.slice(0, 6)}...${address.slice(-4)}`;
  };

  const getBaseScanUrl = (address: string, type: 'address' | 'tx') => {
    const baseUrl = process.env.NEXT_PUBLIC_BASE_NETWORK === 'mainnet' 
      ? 'https://basescan.org'
      : 'https://sepolia.basescan.org';
    return `${baseUrl}/${type}/${address}`;
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>Recent Deployments</CardTitle>
        <CardDescription>
          All token deployments in the selected period
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {deployments.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8">
              No deployments found in this period
            </p>
          ) : (
            deployments.map((deployment) => (
              <div
                key={deployment.tokenAddress}
                className="border rounded-lg p-4 space-y-2"
              >
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-semibold">{deployment.name}</h3>
                      <Badge variant="outline" className="text-xs">
                        {deployment.symbol}
                      </Badge>
                    </div>
                    <div className="text-sm text-muted-foreground space-y-1">
                      <div className="flex items-center gap-2">
                        <span>Token:</span>
                        <a
                          href={getBaseScanUrl(deployment.tokenAddress, 'address')}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="font-mono text-xs hover:underline inline-flex items-center gap-1"
                        >
                          {formatAddress(deployment.tokenAddress)}
                          <ExternalLink className="h-3 w-3" />
                        </a>
                      </div>
                      <div>
                        <span>Creator FID:</span> {deployment.fid}
                      </div>
                      <div>
                        <span>Deployed:</span> {new Date(deployment.createdAt).toLocaleString()}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    {deployment.creatorReward !== undefined ? (
                      <div>
                        <Badge
                          variant={deployment.creatorReward > 0 ? "default" : "secondary"}
                          className="mb-1"
                        >
                          {deployment.creatorReward}% rewards
                        </Badge>
                        {deployment.creatorRewardRecipient && (
                          <div className="text-xs text-muted-foreground mt-1">
                            {formatAddress(deployment.creatorRewardRecipient)}
                          </div>
                        )}
                      </div>
                    ) : (
                      <Badge variant="outline">No rewards</Badge>
                    )}
                  </div>
                </div>
                
                {deployment.txHash && (
                  <div className="pt-2 border-t">
                    <a
                      href={getBaseScanUrl(deployment.txHash, 'tx')}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-xs text-muted-foreground hover:underline inline-flex items-center gap-1"
                    >
                      View transaction
                      <ExternalLink className="h-3 w-3" />
                    </a>
                  </div>
                )}
              </div>
            ))
          )}
        </div>
      </CardContent>
    </Card>
  );
}