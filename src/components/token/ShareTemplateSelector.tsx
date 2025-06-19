'use client';

import { useState } from 'react';
import { getAllShareTemplates, ShareTemplateParams } from '@/lib/share-templates';
import FarcasterShare from './FarcasterShare';
import { cn } from '@/lib/utils';

interface ShareTemplateSelectorProps {
  tokenName: string;
  tokenSymbol: string;
  tokenAddress: string;
  marketCap?: string;
  holders?: number;
  volume24h?: string;
  channel?: string;
}

export default function ShareTemplateSelector({
  tokenName,
  tokenSymbol,
  tokenAddress,
  marketCap,
  holders,
  volume24h,
  channel,
}: ShareTemplateSelectorProps) {
  const [selectedTemplate, setSelectedTemplate] = useState('launch');
  const [customText, setCustomText] = useState('');
  const [showTemplates, setShowTemplates] = useState(false);

  const templates = getAllShareTemplates();
  const currentTemplate = templates.find(([key]) => key === selectedTemplate)?.[1];

  const shareParams: ShareTemplateParams = {
    tokenName,
    tokenSymbol,
    tokenAddress,
    marketCap,
    holders,
    volume24h,
    customText,
  };

  const message = currentTemplate?.message(shareParams) || '';

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Share on Farcaster</h3>
        <button
          onClick={() => setShowTemplates(!showTemplates)}
          className="text-sm text-primary hover:underline"
        >
          {showTemplates ? 'Hide' : 'Customize'} message
        </button>
      </div>

      {showTemplates && (
        <div className="space-y-4 p-4 bg-muted/30 rounded-lg">
          <div className="grid grid-cols-2 gap-2">
            {templates.map(([key, template]) => (
              <button
                key={key}
                onClick={() => setSelectedTemplate(key)}
                className={cn(
                  "flex items-center gap-2 p-3 rounded-lg border text-left transition-colors",
                  selectedTemplate === key
                    ? "border-primary bg-primary/10"
                    : "border-border hover:border-primary/50"
                )}
              >
                <span className="text-2xl">{template.icon}</span>
                <span className="text-sm font-medium">{template.name}</span>
              </button>
            ))}
          </div>

          {selectedTemplate === 'custom' && (
            <textarea
              value={customText}
              onChange={(e) => setCustomText(e.target.value)}
              placeholder="Write your custom message..."
              className="w-full p-3 rounded-lg border bg-background resize-none"
              rows={3}
            />
          )}

          <div className="p-3 bg-muted rounded-lg">
            <p className="text-sm font-medium mb-1">Preview:</p>
            <p className="text-sm whitespace-pre-wrap">{message}</p>
          </div>
        </div>
      )}

      <FarcasterShare
        tokenName={tokenName}
        tokenSymbol={tokenSymbol}
        tokenAddress={tokenAddress}
        message={message}
        channel={channel}
      />
    </div>
  );
}