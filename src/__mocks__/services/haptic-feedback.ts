export class HapticFeedbackService {
  private static instance: HapticFeedbackService;
  
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
  navigationTap: jest.fn().mockResolvedValue(undefined),
  menuItemSelect: jest.fn().mockResolvedValue(undefined),
  buttonPress: jest.fn().mockResolvedValue(undefined),
  toggleStateChange: jest.fn().mockResolvedValue(undefined),
  dropdownOpen: jest.fn().mockResolvedValue(undefined),
  dropdownItemHover: jest.fn().mockResolvedValue(undefined),
  cardSelect: jest.fn().mockResolvedValue(undefined),
});