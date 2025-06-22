import React from 'react';

// Create a generic icon component
const createMockIcon = (displayName: string) => {
  const MockIcon = React.forwardRef<SVGSVGElement, React.SVGProps<SVGSVGElement>>(
    (props, ref) => (
      <svg
        ref={ref}
        width="24"
        height="24"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        data-testid={`icon-${displayName.toLowerCase()}`}
        {...props}
      />
    )
  );
  MockIcon.displayName = displayName;
  return MockIcon;
};

// Export all icons as mock components
export const Activity = createMockIcon('Activity');
export const AlertCircle = createMockIcon('AlertCircle');
export const ArrowLeft = createMockIcon('ArrowLeft');
export const BarChart3 = createMockIcon('BarChart3');
export const Calculator = createMockIcon('Calculator');
export const Calendar = createMockIcon('Calendar');
export const Camera = createMockIcon('Camera');
export const Check = createMockIcon('Check');
export const Clock = createMockIcon('Clock');
export const CheckCircle = createMockIcon('CheckCircle');
export const CheckCircle2 = createMockIcon('CheckCircle2');
export const CheckIcon = createMockIcon('CheckIcon');
export const ChevronDown = createMockIcon('ChevronDown');
export const ChevronDownIcon = createMockIcon('ChevronDownIcon');
export const ChevronRightIcon = createMockIcon('ChevronRightIcon');
export const ChevronUpIcon = createMockIcon('ChevronUpIcon');
export const Circle = createMockIcon('Circle');
export const CircleDot = createMockIcon('CircleDot');
export const CircleIcon = createMockIcon('CircleIcon');
export const Coins = createMockIcon('Coins');
export const Copy = createMockIcon('Copy');
export const DollarSign = createMockIcon('DollarSign');
export const Edit2 = createMockIcon('Edit2');
export const ExternalLink = createMockIcon('ExternalLink');
export const Gift = createMockIcon('Gift');
export const Info = createMockIcon('Info');
export const Loader2 = createMockIcon('Loader2');
export const Lock = createMockIcon('Lock');
export const LogOut = createMockIcon('LogOut');
export const MessageSquare = createMockIcon('MessageSquare');
export const Package = createMockIcon('Package');
export const PieChart = createMockIcon('PieChart');
export const Plus = createMockIcon('Plus');
export const RefreshCw = createMockIcon('RefreshCw');
export const Scale = createMockIcon('Scale');
export const Settings = createMockIcon('Settings');
export const Share2 = createMockIcon('Share2');
export const Shield = createMockIcon('Shield');
export const Smile = createMockIcon('Smile');
export const SquareStack = createMockIcon('SquareStack');
export const Trash2 = createMockIcon('Trash2');
export const TrendingDown = createMockIcon('TrendingDown');
export const TrendingUp = createMockIcon('TrendingUp');
export const Trophy = createMockIcon('Trophy');
export const Upload = createMockIcon('Upload');
export const User = createMockIcon('User');
export const Users = createMockIcon('Users');
export const Wallet = createMockIcon('Wallet');
export const X = createMockIcon('X');
export const Zap = createMockIcon('Zap');

// Export LucideIcon type
export type LucideIcon = React.FC<React.SVGProps<SVGSVGElement>>;