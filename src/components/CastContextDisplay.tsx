import React from 'react';
import { CastContext } from '@/lib/types/cast-context';
import { formatCastUrl, truncateCastId } from '@/lib/cast-context';
import { ExternalLink, MessageSquare } from 'lucide-react';

interface CastContextDisplayProps {
  context: CastContext | null;
}

export const CastContextDisplay: React.FC<CastContextDisplayProps> = ({ context }) => {
  if (!context || context.type !== 'cast') {
    return null;
  }

  const castUrl = formatCastUrl(context.castId, context.author.username);
  const parentCastUrl = context.parentCastId 
    ? formatCastUrl(context.parentCastId)
    : null;

  return (
    <div className="rounded-lg border bg-card p-4 text-card-foreground">
      <div className="flex items-start space-x-3">
        <div className="flex-shrink-0">
          {context.author.pfpUrl ? (
            <>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={context.author.pfpUrl}
                alt={context.author.displayName}
                className="h-10 w-10 rounded-full"
              />
            </>
          ) : (
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted">
              <span className="text-sm font-medium">
                {context.author.displayName.slice(0, 2).toUpperCase()}
              </span>
            </div>
          )}
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex items-center space-x-2">
            <MessageSquare className="h-4 w-4 text-muted-foreground" />
            <span className="text-sm text-muted-foreground">Launched from cast</span>
          </div>
          <div className="space-y-1">
            <p className="text-sm">
              <span className="font-medium">{context.author.displayName}</span>
              <span className="text-muted-foreground ml-1">@{context.author.username}</span>
            </p>
            <div className="flex items-center space-x-4 text-xs">
              <a
                href={castUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center space-x-1 text-primary hover:underline"
              >
                <span>View cast</span>
                <ExternalLink className="h-3 w-3" />
              </a>
              {parentCastUrl && (
                <>
                  <span className="text-muted-foreground">•</span>
                  <a
                    href={parentCastUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center space-x-1 text-muted-foreground hover:text-primary hover:underline"
                  >
                    <span>Reply to parent cast</span>
                    <ExternalLink className="h-3 w-3" />
                  </a>
                </>
              )}
            </div>
            <p className="text-xs text-muted-foreground">
              Cast ID: {truncateCastId(context.castId)}
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};