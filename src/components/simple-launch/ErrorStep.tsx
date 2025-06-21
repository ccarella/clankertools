import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

interface ErrorStepProps {
  deploymentError: string;
  errorDetails: Record<string, unknown> | null;
  debugInfo: Record<string, unknown> | null;
  onTryAgain: () => void;
  onStartOver: () => void;
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

export function ErrorStep({
  deploymentError,
  errorDetails,
  debugInfo,
  onTryAgain,
  onStartOver,
}: ErrorStepProps) {
  return (
    <div className="flex flex-col items-center justify-center py-20 max-w-2xl mx-auto">
      <div 
        className="w-16 h-16 rounded-full bg-destructive/10 flex items-center justify-center mb-6"
        data-testid="error-icon"
      >
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
            
            {/* Boolean values */}
            {Object.entries(debugInfo).map(([key, value]) => {
              if (typeof value === 'boolean' && !['hasImage', 'hasCastContext'].includes(key)) {
                return <div key={key}>{renderValue(value)}</div>;
              }
              return null;
            })}
            
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
          onClick={onTryAgain}
          className="w-full"
        >
          Try Again
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={onStartOver}
          className="w-full"
        >
          Start Over
        </Button>
      </div>
    </div>
  );
}