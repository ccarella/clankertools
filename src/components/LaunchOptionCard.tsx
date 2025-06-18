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
      <div className="flex items-center p-3 bg-background border border-border rounded-xl hover:bg-accent/5 active:bg-accent/10 transition-colors">
        <div className={`flex items-center justify-center w-10 h-10 rounded-xl ${iconColor} mr-3 shrink-0`}>
          <Icon size={20} className="text-white" />
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