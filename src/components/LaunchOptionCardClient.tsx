'use client';

import React from 'react';
import Link from 'next/link';
import { useHaptic } from '@/providers/HapticProvider';

interface LaunchOptionCardClientProps {
  title: string;
  description: string;
  href: string;
  iconColor?: string;
  children: React.ReactNode;
}

export default function LaunchOptionCardClient({ 
  title, 
  description, 
  href, 
  iconColor = 'bg-purple-500',
  children
}: LaunchOptionCardClientProps) {
  const haptic = useHaptic();
  const hasTriggeredRef = React.useRef(false);

  const handleInteraction = () => {
    // Prevent double triggering on devices that fire both touch and click
    if (hasTriggeredRef.current) {
      return;
    }
    hasTriggeredRef.current = true;
    haptic.cardSelect();
    
    // Reset after a short delay
    setTimeout(() => {
      hasTriggeredRef.current = false;
    }, 100);
  };

  return (
    <Link 
      href={href} 
      className="block"
      onClick={handleInteraction}
      onTouchStart={handleInteraction}
    >
      <div className="flex items-center p-3.5 bg-background border border-border rounded-xl hover:bg-card-hover active:scale-[0.98] transition-all">
        <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${iconColor} mr-3 shrink-0`}>
          {children}
        </div>
        <div className="flex-1 min-w-0">
          <h3 className="font-semibold text-foreground text-base mb-0.5 truncate">
            {title}
          </h3>
          <p className="text-muted-foreground text-xs line-clamp-1">
            {description}
          </p>
        </div>
      </div>
    </Link>
  );
}