'use client';

import React, { useEffect, useState } from 'react';
import { cn } from '@/lib/utils';

interface CountdownTimerProps {
  targetDate: Date;
  onComplete?: () => void;
  className?: string;
}

export function CountdownTimer({ targetDate, onComplete, className }: CountdownTimerProps) {
  const [timeLeft, setTimeLeft] = useState({
    hours: 0,
    minutes: 0,
    seconds: 0,
    isComplete: false,
  });

  useEffect(() => {
    const calculateTimeLeft = () => {
      const difference = targetDate.getTime() - new Date().getTime();
      
      if (difference <= 0) {
        setTimeLeft({ hours: 0, minutes: 0, seconds: 0, isComplete: true });
        onComplete?.();
        return false;
      }

      const hours = Math.floor(difference / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));
      const seconds = Math.floor((difference % (1000 * 60)) / 1000);

      setTimeLeft({ hours, minutes, seconds, isComplete: false });
      return true;
    };

    calculateTimeLeft();
    const interval = setInterval(() => {
      const shouldContinue = calculateTimeLeft();
      if (!shouldContinue) {
        clearInterval(interval);
      }
    }, 1000);

    return () => clearInterval(interval);
  }, [targetDate, onComplete]);

  if (timeLeft.isComplete) {
    return (
      <div className={cn('text-center p-6 rounded-lg bg-green-500/10 border border-green-500/20', className)}>
        <p className="text-2xl font-bold text-green-500">Launch Started!</p>
      </div>
    );
  }

  return (
    <div className={cn('text-center p-6 rounded-lg bg-background/50 backdrop-blur border', className)}>
      <p className="text-sm text-muted-foreground mb-2">Time until launch</p>
      <div className="flex items-center justify-center gap-4 text-4xl font-mono font-bold">
        <div className="flex flex-col items-center">
          <span className="text-primary">{timeLeft.hours}h</span>
        </div>
        <span className="text-muted-foreground">:</span>
        <div className="flex flex-col items-center">
          <span className="text-primary">{timeLeft.minutes}m</span>
        </div>
        <span className="text-muted-foreground">:</span>
        <div className="flex flex-col items-center">
          <span className="text-primary">{timeLeft.seconds}s</span>
        </div>
      </div>
    </div>
  );
}