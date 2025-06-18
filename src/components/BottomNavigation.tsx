'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { SquareStack, BarChart3, Settings } from 'lucide-react';

const navigationItems = [
  {
    name: 'Templates',
    href: '/',
    icon: SquareStack,
  },
  {
    name: 'Dashboard',
    href: '/dashboard',
    icon: BarChart3,
  },
  {
    name: 'Settings',
    href: '/settings',
    icon: Settings,
  },
];

export default function BottomNavigation() {
  const pathname = usePathname();

  return (
    <nav className="bg-background border-t border-border safe-area-pb shrink-0">
      <div className="flex items-center justify-around h-14">
        {navigationItems.map((item) => {
          const isActive = pathname === item.href;
          const Icon = item.icon;
          
          return (
            <Link
              key={item.name}
              href={item.href}
              className="flex flex-col items-center justify-center flex-1 h-full space-y-0.5 active:bg-accent/10 transition-colors"
            >
              <Icon 
                size={20} 
                className={isActive ? 'text-primary' : 'text-muted-foreground'} 
              />
              <span 
                className={`text-[10px] ${
                  isActive ? 'text-primary font-medium' : 'text-muted-foreground'
                }`}
              >
                {item.name}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}