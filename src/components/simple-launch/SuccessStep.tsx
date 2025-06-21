import { Check } from "lucide-react";

export function SuccessStep() {
  return (
    <div className="flex flex-col items-center justify-center py-20">
      <div 
        className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center mb-6"
        data-testid="success-icon"
      >
        <Check className="w-8 h-8 text-green-600" />
      </div>
      <h2 className="text-xl font-semibold text-foreground mb-2">
        Token Deployed!
      </h2>
      <p className="text-muted-foreground text-center">
        Redirecting to your token page...
      </p>
    </div>
  );
}