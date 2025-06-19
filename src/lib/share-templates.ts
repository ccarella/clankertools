export interface ShareTemplate {
  name: string;
  message: (params: ShareTemplateParams) => string;
  icon?: string;
}

export interface ShareTemplateParams {
  tokenName: string;
  tokenSymbol: string;
  tokenAddress: string;
  marketCap?: string;
  holders?: number;
  volume24h?: string;
  customText?: string;
}

export const shareTemplates: Record<string, ShareTemplate> = {
  launch: {
    name: 'Launch Announcement',
    message: ({ tokenName, tokenSymbol }) => 
      `🚀 Just launched ${tokenName} ($${tokenSymbol}) on @clanker!\n\nLet's go to the moon together! 🌙`,
    icon: '🚀',
  },
  milestone: {
    name: 'Milestone Update',
    message: ({ tokenName, tokenSymbol, marketCap, holders }) => {
      const parts = [`📈 ${tokenName} ($${tokenSymbol}) update:`];
      if (marketCap) parts.push(`Market Cap: ${marketCap}`);
      if (holders) parts.push(`Holders: ${holders}`);
      parts.push('\nJoin the movement! 🔥');
      return parts.join('\n');
    },
    icon: '📈',
  },
  reward: {
    name: 'Reward Claim',
    message: ({ tokenName, tokenSymbol }) => 
      `💰 Creator rewards are now available for ${tokenName} ($${tokenSymbol})!\n\nClaim your rewards and keep building! 🛠️`,
    icon: '💰',
  },
  custom: {
    name: 'Custom Message',
    message: ({ tokenName, tokenSymbol, customText }) => 
      customText || `Check out ${tokenName} ($${tokenSymbol}) on @clanker!`,
    icon: '✍️',
  },
  mooning: {
    name: 'Price Action',
    message: ({ tokenName, tokenSymbol }) => 
      `🌙 ${tokenName} ($${tokenSymbol}) is absolutely mooning right now!\n\nDon't miss the rocket ship! 🚀`,
    icon: '🌙',
  },
  community: {
    name: 'Community Call',
    message: ({ tokenName, tokenSymbol, holders }) => 
      `👥 ${tokenName} ($${tokenSymbol}) community is growing strong!\n\n${holders ? `${holders} holders and counting! ` : ''}Join us! 💪`,
    icon: '👥',
  },
};

export function getShareTemplate(templateKey: string): ShareTemplate | undefined {
  return shareTemplates[templateKey];
}

export function getAllShareTemplates(): Array<[string, ShareTemplate]> {
  return Object.entries(shareTemplates);
}