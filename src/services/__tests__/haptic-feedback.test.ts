import { HapticFeedbackService } from '../haptic-feedback';
import { mockSDK, resetSDKMocks } from '@/__mocks__/@farcaster/frame-sdk';

describe('HapticFeedbackService', () => {
  let hapticService: HapticFeedbackService;

  beforeEach(() => {
    resetSDKMocks();
    hapticService = new HapticFeedbackService();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('initialization', () => {
    it('should initialize with haptics disabled by default', () => {
      expect(hapticService.isEnabled()).toBe(false);
    });

    it('should check SDK capabilities on init', async () => {
      mockSDK.getCapabilities.mockResolvedValue(['haptics.impactOccurred']);
      await hapticService.init();
      
      expect(mockSDK.getCapabilities).toHaveBeenCalled();
      expect(hapticService.isSupported()).toBe(true);
    });

    it('should handle missing haptic capabilities', async () => {
      mockSDK.getCapabilities.mockResolvedValue([]);
      await hapticService.init();
      
      expect(hapticService.isSupported()).toBe(false);
    });

    it('should restore saved preferences from localStorage', async () => {
      localStorage.setItem('haptic-feedback-enabled', 'true');
      mockSDK.getCapabilities.mockResolvedValue(['haptics.impactOccurred']);
      
      await hapticService.init();
      
      expect(hapticService.isEnabled()).toBe(true);
    });
  });

  describe('enable/disable functionality', () => {
    beforeEach(async () => {
      mockSDK.getCapabilities.mockResolvedValue(['haptics.impactOccurred']);
      await hapticService.init();
    });

    it('should enable haptic feedback when supported', () => {
      hapticService.enable();
      expect(hapticService.isEnabled()).toBe(true);
      expect(localStorage.getItem('haptic-feedback-enabled')).toBe('true');
    });

    it('should disable haptic feedback', () => {
      hapticService.enable();
      hapticService.disable();
      
      expect(hapticService.isEnabled()).toBe(false);
      expect(localStorage.getItem('haptic-feedback-enabled')).toBe('false');
    });

    it('should not enable haptics when not supported', async () => {
      mockSDK.getCapabilities.mockResolvedValue([]);
      const unsupportedService = new HapticFeedbackService();
      await unsupportedService.init();
      
      unsupportedService.enable();
      expect(unsupportedService.isEnabled()).toBe(false);
    });

    it('should toggle haptic feedback state', () => {
      expect(hapticService.isEnabled()).toBe(false);
      
      hapticService.toggle();
      expect(hapticService.isEnabled()).toBe(true);
      
      hapticService.toggle();
      expect(hapticService.isEnabled()).toBe(false);
    });
  });

  describe('navigation feedback', () => {
    beforeEach(async () => {
      mockSDK.getCapabilities.mockResolvedValue(['haptics.impactOccurred', 'haptics.selectionChanged']);
      await hapticService.init();
      hapticService.enable();
    });

    it('should trigger light impact for tab navigation', async () => {
      await hapticService.navigationTap();
      
      expect(mockSDK.haptics.impactOccurred).toHaveBeenCalledWith('light');
    });

    it('should trigger selection changed for menu item selection', async () => {
      await hapticService.menuItemSelect();
      
      expect(mockSDK.haptics.selectionChanged).toHaveBeenCalled();
    });

    it('should not trigger haptics when disabled', async () => {
      hapticService.disable();
      
      await hapticService.navigationTap();
      await hapticService.menuItemSelect();
      
      expect(mockSDK.haptics.impactOccurred).not.toHaveBeenCalled();
      expect(mockSDK.haptics.selectionChanged).not.toHaveBeenCalled();
    });

    it('should handle SDK errors gracefully', async () => {
      mockSDK.haptics.impactOccurred.mockRejectedValue(new Error('Haptic failed'));
      
      await expect(hapticService.navigationTap()).resolves.not.toThrow();
    });
  });

  describe('button feedback', () => {
    beforeEach(async () => {
      mockSDK.getCapabilities.mockResolvedValue(['haptics.impactOccurred']);
      await hapticService.init();
      hapticService.enable();
    });

    it('should trigger medium impact for standard button press', async () => {
      await hapticService.buttonPress();
      
      expect(mockSDK.haptics.impactOccurred).toHaveBeenCalledWith('medium');
    });

    it('should trigger heavy impact for destructive button press', async () => {
      await hapticService.buttonPress('destructive');
      
      expect(mockSDK.haptics.impactOccurred).toHaveBeenCalledWith('heavy');
    });

    it('should trigger soft impact for ghost button press', async () => {
      await hapticService.buttonPress('ghost');
      
      expect(mockSDK.haptics.impactOccurred).toHaveBeenCalledWith('soft');
    });
  });

  describe('toggle feedback', () => {
    beforeEach(async () => {
      mockSDK.getCapabilities.mockResolvedValue(['haptics.notificationOccurred']);
      await hapticService.init();
      hapticService.enable();
    });

    it('should trigger success notification for toggle on', async () => {
      await hapticService.toggleStateChange(true);
      
      expect(mockSDK.haptics.notificationOccurred).toHaveBeenCalledWith('success');
    });

    it('should trigger warning notification for toggle off', async () => {
      await hapticService.toggleStateChange(false);
      
      expect(mockSDK.haptics.notificationOccurred).toHaveBeenCalledWith('warning');
    });
  });

  describe('dropdown feedback', () => {
    beforeEach(async () => {
      mockSDK.getCapabilities.mockResolvedValue(['haptics.selectionChanged', 'haptics.impactOccurred']);
      await hapticService.init();
      hapticService.enable();
    });

    it('should trigger light impact for dropdown open', async () => {
      await hapticService.dropdownOpen();
      
      expect(mockSDK.haptics.impactOccurred).toHaveBeenCalledWith('light');
    });

    it('should trigger selection changed for dropdown item hover', async () => {
      await hapticService.dropdownItemHover();
      
      expect(mockSDK.haptics.selectionChanged).toHaveBeenCalled();
    });
  });

  describe('card interaction feedback', () => {
    beforeEach(async () => {
      mockSDK.getCapabilities.mockResolvedValue(['haptics.impactOccurred']);
      await hapticService.init();
      hapticService.enable();
    });

    it('should trigger rigid impact for card selection', async () => {
      await hapticService.cardSelect();
      
      expect(mockSDK.haptics.impactOccurred).toHaveBeenCalledWith('rigid');
    });
  });

  describe('capability fallbacks', () => {
    it('should skip unsupported haptic methods gracefully', async () => {
      mockSDK.getCapabilities.mockResolvedValue(['haptics.impactOccurred']);
      await hapticService.init();
      hapticService.enable();
      
      // selectionChanged not in capabilities
      await hapticService.menuItemSelect();
      
      expect(mockSDK.haptics.selectionChanged).not.toHaveBeenCalled();
      expect(mockSDK.haptics.impactOccurred).not.toHaveBeenCalled();
    });
  });
});