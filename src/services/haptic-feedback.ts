import sdk from '@farcaster/frame-sdk';

type ButtonVariant = 'default' | 'destructive' | 'outline' | 'secondary' | 'ghost' | 'link';
type HapticCapability = 'haptics.impactOccurred' | 'haptics.notificationOccurred' | 'haptics.selectionChanged';

export class HapticFeedbackService {
  private supported: boolean = false;
  private enabled: boolean = false;
  private capabilities: string[] = [];
  private readonly STORAGE_KEY = 'haptic-feedback-enabled';

  private isReactNative(): boolean {
    return typeof navigator !== 'undefined' && (navigator as any).product === 'ReactNative';
  }

  async init(): Promise<void> {
    try {
      // Check SDK capabilities
      this.capabilities = await sdk.getCapabilities();
      this.supported = this.hasHapticSupport();

      // Restore user preference
      const savedPreference = localStorage.getItem(this.STORAGE_KEY);
      if (savedPreference === 'true' && this.supported) {
        this.enabled = true;
      }
    } catch (error) {
      console.error('Failed to initialize haptic feedback:', error);
      this.supported = false;
    }
  }

  private hasHapticSupport(): boolean {
    return this.capabilities.some(cap => cap.startsWith('haptics.'));
  }

  private hasCapability(capability: HapticCapability): boolean {
    return this.capabilities.includes(capability);
  }

  isSupported(): boolean {
    return this.supported;
  }

  isEnabled(): boolean {
    return this.enabled && this.supported;
  }

  enable(): void {
    if (this.supported) {
      this.enabled = true;
      localStorage.setItem(this.STORAGE_KEY, 'true');
    }
  }

  disable(): void {
    this.enabled = false;
    localStorage.setItem(this.STORAGE_KEY, 'false');
  }

  toggle(): void {
    if (this.enabled) {
      this.disable();
    } else {
      this.enable();
    }
  }

  private async safeHaptic(callback: () => Promise<void>): Promise<void> {
    if (!this.isEnabled()) return;
    
    try {
      await callback();
    } catch (error) {
      console.error('Haptic feedback error:', error);
    }
  }

  // Navigation haptics
  async navigationTap(): Promise<void> {
    await this.safeHaptic(async () => {
      if (this.hasCapability('haptics.impactOccurred')) {
        await sdk.haptics.impactOccurred('light');
      }
    });
  }

  async menuItemSelect(): Promise<void> {
    await this.safeHaptic(async () => {
      if (this.hasCapability('haptics.selectionChanged')) {
        await sdk.haptics.selectionChanged();
      }
    });
  }

  // Button haptics
  async buttonPress(variant: ButtonVariant = 'default'): Promise<void> {
    await this.safeHaptic(async () => {
      if (this.hasCapability('haptics.impactOccurred')) {
        switch (variant) {
          case 'destructive':
            await sdk.haptics.impactOccurred('heavy');
            break;
          case 'ghost':
            await sdk.haptics.impactOccurred('soft');
            break;
          default:
            await sdk.haptics.impactOccurred('medium');
        }
      }
    });
  }

  // Toggle haptics
  async toggleStateChange(isOn: boolean): Promise<void> {
    await this.safeHaptic(async () => {
      if (this.hasCapability('haptics.notificationOccurred')) {
        await sdk.haptics.notificationOccurred(isOn ? 'success' : 'warning');
      }
    });
  }

  // Dropdown haptics
  async dropdownOpen(): Promise<void> {
    await this.safeHaptic(async () => {
      if (this.hasCapability('haptics.impactOccurred')) {
        await sdk.haptics.impactOccurred('light');
      }
    });
  }

  async dropdownItemHover(): Promise<void> {
    await this.safeHaptic(async () => {
      if (this.hasCapability('haptics.selectionChanged')) {
        await sdk.haptics.selectionChanged();
      }
    });
  }

  // Card interaction haptics
  async cardSelect(): Promise<void> {
    await this.safeHaptic(async () => {
      if (this.isReactNative()) {
        const Haptics = await import('react-native-haptic-feedback');
        await Haptics.default.trigger('impactMedium', { enableVibrateFallback: true });
      } else if (this.hasCapability('haptics.impactOccurred')) {
        await sdk.haptics.impactOccurred('rigid');
      }
    });
  }
}

// Singleton instance
let instance: HapticFeedbackService | null = null;

export const getHapticFeedbackService = async (): Promise<HapticFeedbackService> => {
  if (!instance) {
    instance = new HapticFeedbackService();
    await instance.init();
  }
  return instance;
};