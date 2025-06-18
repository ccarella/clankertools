import Link from 'next/link';
import { LucideIcon } from 'lucide-react';

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
  iconColor = 'bg-primary'
}: LaunchOptionCardProps) {
  return (
    <Link href={href} className="block">
      <div className="flex items-center p-4 bg-background border border-border rounded-xl hover:bg-accent/5 transition-colors">
        <div className={`flex items-center justify-center w-12 h-12 rounded-xl ${iconColor} mr-4`}>
          <Icon size={24} className="text-white" />
        </div>
        <div className="flex-1">
          <h3 className="font-semibold text-foreground text-lg mb-1">
            {title}
          </h3>
          <p className="text-muted-foreground text-sm">
            {description}
          </p>
        </div>
      </div>
    </Link>
  );
}