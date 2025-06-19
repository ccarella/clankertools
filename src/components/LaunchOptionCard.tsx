import { LucideIcon } from 'lucide-react';
import LaunchOptionCardClient from './LaunchOptionCardClient';

interface LaunchOptionCardProps {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
  iconColor?: string;
}

export default function LaunchOptionCard({ 
  title, 
  description, 
  href, 
  icon: Icon,
  iconColor = 'bg-purple-500'
}: LaunchOptionCardProps) {
  return (
    <LaunchOptionCardClient
      title={title}
      description={description}
      href={href}
      iconColor={iconColor}
    >
      <Icon size={20} className="text-white" />
    </LaunchOptionCardClient>
  );
}