import { Zap, Scale, Users, Smile, Settings } from 'lucide-react';
import LaunchOptionCard from '@/components/LaunchOptionCard';

const launchOptions = [
  {
    title: 'Simple Launch',
    description: 'One-tap token launch',
    href: '/simple-launch',
    icon: Zap,
    iconColor: 'bg-purple-500',
  },
  {
    title: 'Fair Launch',
    description: 'Fair and transparent launch',
    href: '/fair-launch',
    icon: Scale,
    iconColor: 'bg-purple-500',
  },
  {
    title: 'Team/Project',
    description: 'Launch for teams or projects',
    href: '/team-launch',
    icon: Users,
    iconColor: 'bg-purple-500',
  },
  {
    title: 'Memecoin Degen',
    description: 'For meme and community tokens',
    href: '/memecoin-launch',
    icon: Smile,
    iconColor: 'bg-purple-500',
  },
  {
    title: 'The Works (Advanced)',
    description: 'Full configuration options',
    href: '/configurator',
    icon: Settings,
    iconColor: 'bg-purple-500',
  },
];

export default function HomePage() {
  return (
    <div className="flex flex-col min-h-screen pb-20">
      <div className="flex-1 px-4 py-6">
        <div className="space-y-3">
          {launchOptions.map((option) => (
            <LaunchOptionCard
              key={option.href}
              title={option.title}
              description={option.description}
              href={option.href}
              icon={option.icon}
              iconColor={option.iconColor}
            />
          ))}
        </div>
      </div>
    </div>
  );
}