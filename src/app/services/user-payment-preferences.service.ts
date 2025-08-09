import { Injectable, signal } from '@angular/core';

export interface UserPaymentPreferences {
  subscribe?: number;  // Custom amount in KAS for subscribe action
  comment?: number;    // Custom amount in KAS for comment action
  like?: number;       // Custom amount in KAS for like action
  post?: number;       // Custom amount in KAS for post action (sent to self)
  note?: number;       // Custom amount in KAS for note action (sent to self)
  story?: number;      // Custom amount in KAS for story action (sent to self)
}

export interface PaymentPreferenceSettings {
  useCustomAmounts: boolean;
  customAmounts: UserPaymentPreferences;
  lastUpdated: number;
}

@Injectable({
  providedIn: 'root'
})
export class UserPaymentPreferencesService {
  private readonly STORAGE_KEY = 'verum_payment_preferences';
  private readonly DEFAULT_SETTINGS: PaymentPreferenceSettings = {
    useCustomAmounts: false,
    customAmounts: {},
    lastUpdated: Date.now()
  };

  // Reactive state
  private _preferences = signal<PaymentPreferenceSettings>(this.DEFAULT_SETTINGS);
  public readonly preferences = this._preferences.asReadonly();

  constructor() {
    this.loadPreferences();
  }

  /**
   * Load preferences from localStorage
   */
  private loadPreferences(): void {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as PaymentPreferenceSettings;
        this._preferences.set({
          ...this.DEFAULT_SETTINGS,
          ...parsed
        });
      }
    } catch (error) {
      this._preferences.set(this.DEFAULT_SETTINGS);
    }
  }

  /**
   * Save preferences to localStorage
   */
  private savePreferences(): void {
    try {
      const current = this._preferences();
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(current));
    } catch (error) {
    }
  }

  /**
   * Enable or disable custom payment amounts
   */
  setUseCustomAmounts(enabled: boolean): void {
    this._preferences.update(prefs => ({
      ...prefs,
      useCustomAmounts: enabled,
      lastUpdated: Date.now()
    }));
    this.savePreferences();
    
  }

  /**
   * Set custom amount for a specific action
   */
  setCustomAmount(action: keyof UserPaymentPreferences, amount: number): void {
    if (amount <= 0) {
      throw new Error('Payment amount must be greater than 0');
    }

    this._preferences.update(prefs => ({
      ...prefs,
      customAmounts: {
        ...prefs.customAmounts,
        [action]: amount
      },
      lastUpdated: Date.now()
    }));
    this.savePreferences();
    
  }

  /**
   * Remove custom amount for a specific action (revert to calculated)
   */
  removeCustomAmount(action: keyof UserPaymentPreferences): void {
    this._preferences.update(prefs => {
      const newCustomAmounts = { ...prefs.customAmounts };
      delete newCustomAmounts[action];
      
      return {
        ...prefs,
        customAmounts: newCustomAmounts,
        lastUpdated: Date.now()
      };
    });
    this.savePreferences();
    
  }

  /**
   * Get custom amount for a specific action (if set and enabled)
   */
  getCustomAmount(action: keyof UserPaymentPreferences): number | undefined {
    const prefs = this._preferences();
    
    if (!prefs.useCustomAmounts) {
      return undefined; // Custom amounts disabled
    }
    
    return prefs.customAmounts[action];
  }

  /**
   * Check if custom amounts are enabled
   */
  isUsingCustomAmounts(): boolean {
    return this._preferences().useCustomAmounts;
  }

  /**
   * Get all current custom amounts
   */
  getAllCustomAmounts(): UserPaymentPreferences {
    return { ...this._preferences().customAmounts };
  }

  /**
   * Bulk update custom amounts
   */
  setMultipleCustomAmounts(amounts: UserPaymentPreferences): void {
    // Validate all amounts
    Object.entries(amounts).forEach(([action, amount]) => {
      if (amount !== undefined && amount <= 0) {
        throw new Error(`Payment amount for ${action} must be greater than 0`);
      }
    });

    this._preferences.update(prefs => ({
      ...prefs,
      customAmounts: {
        ...prefs.customAmounts,
        ...amounts
      },
      lastUpdated: Date.now()
    }));
    this.savePreferences();
    
  }

  /**
   * Reset all preferences to defaults
   */
  resetToDefaults(): void {
    this._preferences.set({
      ...this.DEFAULT_SETTINGS,
      lastUpdated: Date.now()
    });
    this.savePreferences();
    
  }

  /**
   * Get preferences summary for display
   */
  getPreferencesSummary(): {
    enabled: boolean;
    customCount: number;
    amounts: UserPaymentPreferences;
  } {
    const prefs = this._preferences();
    return {
      enabled: prefs.useCustomAmounts,
      customCount: Object.keys(prefs.customAmounts).length,
      amounts: prefs.customAmounts
    };
  }

  /**
   * Export preferences (for backup/sharing)
   */
  exportPreferences(): string {
    return JSON.stringify(this._preferences(), null, 2);
  }

  /**
   * Import preferences (from backup/sharing)
   */
  importPreferences(jsonData: string): void {
    try {
      const imported = JSON.parse(jsonData) as PaymentPreferenceSettings;
      
      // Validate imported data
      if (typeof imported.useCustomAmounts !== 'boolean') {
        throw new Error('Invalid preferences format');
      }
      
      // Validate custom amounts
      if (imported.customAmounts) {
        Object.entries(imported.customAmounts).forEach(([action, amount]) => {
          if (amount !== undefined && (typeof amount !== 'number' || amount <= 0)) {
            throw new Error(`Invalid amount for ${action}: ${amount}`);
          }
        });
      }
      
      this._preferences.set({
        ...imported,
        lastUpdated: Date.now()
      });
      this.savePreferences();
      
    } catch (error) {
      throw new Error('Invalid preferences format');
    }
  }
}