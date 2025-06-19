export class HapticFeedbackService {
  private static instance: HapticFeedbackService;
  
  // Mock state methods
  init = jest.fn().mockResolvedValue(undefined);
  isEnabled = jest.fn().mockReturnValue(false);
  isSupported = jest.fn().mockReturnValue(true);
  enable = jest.fn();
  disable = jest.fn();
  toggle = jest.fn();
  
  // Mock all the haptic methods
  navigationTap = jest.fn().mockResolvedValue(undefined);
  menuItemSelect = jest.fn().mockResolvedValue(undefined);
  buttonPress = jest.fn().mockResolvedValue(undefined);
  toggleStateChange = jest.fn().mockResolvedValue(undefined);
  dropdownOpen = jest.fn().mockResolvedValue(undefined);
  dropdownItemHover = jest.fn().mockResolvedValue(undefined);
  cardSelect = jest.fn().mockResolvedValue(undefined);
  
  static getInstance(): HapticFeedbackService {
    if (!HapticFeedbackService.instance) {
      HapticFeedbackService.instance = new HapticFeedbackService();
    }
    return HapticFeedbackService.instance;
  }
  
  // Reset all mocks for testing
  static resetMocks() {
    if (HapticFeedbackService.instance) {
      HapticFeedbackService.instance.init.mockClear();
      HapticFeedbackService.instance.isEnabled.mockClear();
      HapticFeedbackService.instance.isSupported.mockClear();
      HapticFeedbackService.instance.enable.mockClear();
      HapticFeedbackService.instance.disable.mockClear();
      HapticFeedbackService.instance.toggle.mockClear();
      HapticFeedbackService.instance.navigationTap.mockClear();
      HapticFeedbackService.instance.menuItemSelect.mockClear();
      HapticFeedbackService.instance.buttonPress.mockClear();
      HapticFeedbackService.instance.toggleStateChange.mockClear();
      HapticFeedbackService.instance.dropdownOpen.mockClear();
      HapticFeedbackService.instance.dropdownItemHover.mockClear();
      HapticFeedbackService.instance.cardSelect.mockClear();
    }
  }
}

// Export mock factory for manual mocking
export const mockHapticFeedbackService = () => ({
  init: jest.fn().mockResolvedValue(undefined),
  isEnabled: jest.fn().mockReturnValue(false),
  isSupported: jest.fn().mockReturnValue(true),
  enable: jest.fn(),
  disable: jest.fn(),
  toggle: jest.fn(),
  navigationTap: jest.fn().mockResolvedValue(undefined),
  menuItemSelect: jest.fn().mockResolvedValue(undefined),
  buttonPress: jest.fn().mockResolvedValue(undefined),
  toggleStateChange: jest.fn().mockResolvedValue(undefined),
  dropdownOpen: jest.fn().mockResolvedValue(undefined),
  dropdownItemHover: jest.fn().mockResolvedValue(undefined),
  cardSelect: jest.fn().mockResolvedValue(undefined),
});

// Export the async getter
export const getHapticFeedbackService = jest.fn().mockResolvedValue(HapticFeedbackService.getInstance());