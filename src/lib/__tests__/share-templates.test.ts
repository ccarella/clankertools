import { shareTemplates, getShareTemplate, getAllShareTemplates } from '../share-templates';

describe('share-templates', () => {
  const defaultParams = {
    tokenName: 'Test Token',
    tokenSymbol: 'TEST',
    tokenAddress: '0x1234567890abcdef',
  };

  describe('shareTemplates', () => {
    it('has launch template', () => {
      const template = shareTemplates.launch;
      expect(template.name).toBe('Launch Announcement');
      expect(template.icon).toBe('🚀');
      expect(template.message(defaultParams)).toContain('Just launched Test Token ($TEST)');
    });

    it('has milestone template with optional params', () => {
      const template = shareTemplates.milestone;
      expect(template.name).toBe('Milestone Update');
      
      const messageWithAllParams = template.message({
        ...defaultParams,
        marketCap: '$1M',
        holders: 100,
      });
      expect(messageWithAllParams).toContain('Market Cap: $1M');
      expect(messageWithAllParams).toContain('Holders: 100');
      
      const messageWithPartialParams = template.message({
        ...defaultParams,
        marketCap: '$500K',
      });
      expect(messageWithPartialParams).toContain('Market Cap: $500K');
      expect(messageWithPartialParams).not.toContain('Holders:');
    });

    it('has reward template', () => {
      const template = shareTemplates.reward;
      expect(template.name).toBe('Reward Claim');
      expect(template.message(defaultParams)).toContain('Creator rewards are now available');
    });

    it('has custom template with fallback', () => {
      const template = shareTemplates.custom;
      expect(template.name).toBe('Custom Message');
      
      const customMessage = template.message({
        ...defaultParams,
        customText: 'This is my custom message!',
      });
      expect(customMessage).toBe('This is my custom message!');
      
      const fallbackMessage = template.message(defaultParams);
      expect(fallbackMessage).toContain('Check out Test Token ($TEST)');
    });

    it('has mooning template', () => {
      const template = shareTemplates.mooning;
      expect(template.name).toBe('Price Action');
      expect(template.message(defaultParams)).toContain('absolutely mooning');
    });

    it('has community template', () => {
      const template = shareTemplates.community;
      expect(template.name).toBe('Community Call');
      
      const messageWithHolders = template.message({
        ...defaultParams,
        holders: 50,
      });
      expect(messageWithHolders).toContain('50 holders and counting');
      
      const messageWithoutHolders = template.message(defaultParams);
      expect(messageWithoutHolders).toContain('community is growing strong');
      expect(messageWithoutHolders).not.toContain('holders and counting');
    });
  });

  describe('getShareTemplate', () => {
    it('returns template for valid key', () => {
      const template = getShareTemplate('launch');
      expect(template).toBeDefined();
      expect(template?.name).toBe('Launch Announcement');
    });

    it('returns undefined for invalid key', () => {
      const template = getShareTemplate('invalid');
      expect(template).toBeUndefined();
    });
  });

  describe('getAllShareTemplates', () => {
    it('returns all templates as entries', () => {
      const templates = getAllShareTemplates();
      expect(templates).toHaveLength(6);
      expect(templates[0][0]).toBe('launch');
      expect(templates[0][1].name).toBe('Launch Announcement');
    });
  });
});