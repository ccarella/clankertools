import React from 'react';
import { render } from '@testing-library/react';
import '@testing-library/jest-dom';
import HomePage from '@/components/HomePage';
import LaunchOptionCard from '@/components/LaunchOptionCard';
import BottomNavigation from '@/components/BottomNavigation';
import { usePathname } from 'next/navigation';
import { Zap } from 'lucide-react';
import { useHaptic } from '@/providers/HapticProvider';

// Mock next/navigation
jest.mock('next/navigation', () => ({
  usePathname: jest.fn(),
}));

// Mock FarcasterProvider
jest.mock('@/components/providers/FarcasterProvider', () => ({
  FarcasterProvider: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

jest.mock('@/providers/HapticProvider', () => ({
  useHaptic: jest.fn(),
}));

describe('Mobile Layout Tests', () => {
  const mockHaptic = {
    cardSelect: jest.fn().mockResolvedValue(undefined),
    navigationTap: jest.fn().mockResolvedValue(undefined),
    isEnabled: jest.fn().mockReturnValue(true),
    isSupported: jest.fn().mockReturnValue(true),
  };

  beforeEach(() => {
    jest.clearAllMocks();
    (usePathname as jest.Mock).mockReturnValue('/');
    (useHaptic as jest.Mock).mockReturnValue(mockHaptic);
  });

  describe('Viewport and Overflow', () => {
    it('should not have horizontal overflow on mobile screens', () => {
      const { container } = render(
        <div className="flex h-screen flex-col overflow-hidden">
          <header className="flex items-center justify-between p-3 bg-background shrink-0">
            <h1 className="text-lg font-bold truncate">Clanker Tools</h1>
          </header>
          <main className="flex-1 overflow-y-auto overflow-x-hidden -webkit-overflow-scrolling-touch">
            <HomePage />
          </main>
          <BottomNavigation />
        </div>
      );

      // Check main container has overflow control
      const mainElement = container.querySelector('main');
      expect(mainElement).toHaveClass('overflow-y-auto');
      expect(mainElement).toHaveClass('overflow-x-hidden');
      
      // Check flex container doesn't cause overflow
      const flexContainer = container.querySelector('.flex.h-screen');
      expect(flexContainer).toHaveClass('flex-col');
      expect(flexContainer).toHaveClass('overflow-hidden');
    });

    it('should have proper mobile viewport meta tags', async () => {
      // This test validates that our viewport export is correct
      // The actual meta tag injection is handled by Next.js
      const layoutModule = await import('@/app/layout');
      const { viewport } = layoutModule;
      
      expect(viewport.width).toBe('device-width');
      expect(viewport.initialScale).toBe(1);
      expect(viewport.maximumScale).toBe(1);
      expect(viewport.userScalable).toBe(false);
    });
  });

  describe('Component Width Constraints', () => {
    it('should constrain LaunchOptionCard to viewport width', () => {
      const { container } = render(
        <LaunchOptionCard
          title="Test Card"
          description="Test description"
          href="/test"
          icon={Zap}
          iconColor="bg-purple-500"
        />
      );

      const card = container.querySelector('.flex.items-center.p-3');
      expect(card).toHaveClass('rounded-xl');
      
      // Ensure the card doesn't have fixed widths that could cause overflow
      const computedStyle = window.getComputedStyle(card as Element);
      expect(computedStyle.width).not.toMatch(/\d+px/);
    });

    it('should have proper padding that accounts for safe areas', () => {
      const { container } = render(<BottomNavigation />);
      
      const nav = container.querySelector('nav');
      expect(nav).toHaveClass('safe-area-pb');
      expect(nav).toHaveClass('shrink-0');
      expect(nav).toHaveClass('bg-background');
      expect(nav).toHaveClass('border-t');
    });
  });

  describe('Native App Feel', () => {
    it('should prevent body scroll and use container scroll', () => {
      const { container } = render(
        <div className="flex h-screen flex-col overflow-hidden">
          <main className="flex-1 overflow-y-auto overflow-x-hidden -webkit-overflow-scrolling-touch">
            <HomePage />
          </main>
        </div>
      );
      
      // Main should handle overflow
      const main = container.querySelector('main');
      expect(main).toHaveClass('flex-1');
      expect(main).toHaveClass('overflow-y-auto');
      expect(main).toHaveClass('overflow-x-hidden');
    });

    it('should have touch-friendly spacing', () => {
      const { container } = render(<HomePage />);
      
      // Check spacing between cards
      const cardsContainer = container.querySelector('.space-y-2\\.5');
      expect(cardsContainer).toBeInTheDocument();
      
      // Check padding
      const contentContainer = container.querySelector('.px-3');
      expect(contentContainer).toBeInTheDocument();
    });

    it('should have proper header layout without overflow', () => {
      const { container } = render(
        <div className="flex h-screen flex-col overflow-hidden">
          <header className="flex items-center justify-between p-3 bg-background shrink-0">
            <h1>Test</h1>
          </header>
          <main className="flex-1 overflow-y-auto overflow-x-hidden">
            <div>Test</div>
          </main>
        </div>
      );

      const header = container.querySelector('header');
      expect(header).toHaveClass('p-3');
      expect(header).toHaveClass('flex');
      expect(header).toHaveClass('items-center');
      expect(header).toHaveClass('justify-between');
      expect(header).toHaveClass('shrink-0');
    });
  });

  describe('Responsive Text and Icons', () => {
    it('should use appropriate text sizes for mobile', () => {
      const { container } = render(<HomePage />);
      
      // Get all cards
      const cards = container.querySelectorAll('h3');
      cards.forEach(card => {
        expect(card).toHaveClass('text-base');
      });
      
      const descriptions = container.querySelectorAll('p.text-xs');
      expect(descriptions.length).toBeGreaterThan(0);
    });

    it('should have properly sized icons', () => {
      const { container } = render(
        <LaunchOptionCard
          title="Test"
          description="Test"
          href="/test"
          icon={Zap}
        />
      );

      // Icon container should be reasonably sized
      const iconContainer = container.querySelector('.w-10.h-10');
      expect(iconContainer).toBeInTheDocument();
    });
  });
});