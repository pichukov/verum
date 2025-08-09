import { Component, signal, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserPaymentPreferencesService, UserPaymentPreferences } from '../../../services/user-payment-preferences.service';
import { FeeCalculationService } from '../../../services/fee-calculation.service';
import { ToastService } from '../../../services/toast.service';

@Component({
  selector: 'app-payment-preferences',
  standalone: true,
  imports: [CommonModule, FormsModule],
  templateUrl: './payment-preferences.component.html',
  styleUrls: ['./payment-preferences.component.scss']
})
export class PaymentPreferencesComponent implements OnInit {
  private userPaymentPreferences = inject(UserPaymentPreferencesService);
  private feeCalculationService = inject(FeeCalculationService);
  private toastService = inject(ToastService);

  // UI state
  isExpanded = signal(false);
  
  // Form data
  customAmountsEnabled = signal(false);
  customAmounts = signal<UserPaymentPreferences>({});
  
  // Calculated amounts for comparison
  calculatedAmounts = signal<{
    subscribe: number;
    comment: number;
    like: number;
    post: number;
    note: number;
    story: number;
  }>({
    subscribe: 0,
    comment: 0,
    like: 0,
    post: 0,
    note: 0,
    story: 0
  });

  ngOnInit() {
    // Load current preferences
    this.loadCurrentPreferences();
    
    // Load calculated amounts for comparison
    this.loadCalculatedAmounts();
  }

  private loadCurrentPreferences(): void {
    const preferences = this.userPaymentPreferences.preferences();
    this.customAmountsEnabled.set(preferences.useCustomAmounts);
    this.customAmounts.set({ ...preferences.customAmounts });
  }

  private loadCalculatedAmounts(): void {
    // Temporarily disable custom amounts to get calculated values
    const wasEnabled = this.userPaymentPreferences.isUsingCustomAmounts();
    if (wasEnabled) {
      this.userPaymentPreferences.setUseCustomAmounts(false);
    }

    this.feeCalculationService.calculateAllAmounts().subscribe(amounts => {
      this.calculatedAmounts.set(amounts);
      
      // Restore original setting
      if (wasEnabled) {
        this.userPaymentPreferences.setUseCustomAmounts(true);
      }
    });
  }

  toggleExpanded(): void {
    this.isExpanded.update(expanded => !expanded);
  }

  toggleCustomAmounts(): void {
    const newState = !this.customAmountsEnabled();
    this.customAmountsEnabled.set(newState);
    this.userPaymentPreferences.setUseCustomAmounts(newState);
    
    if (newState) {
      this.toastService.success('Custom payment amounts enabled', 'Payment Preferences');
    } else {
      this.toastService.info('Using dynamic payment amounts', 'Payment Preferences');
    }
  }

  setCustomAmount(action: keyof UserPaymentPreferences, event: Event): void {
    const input = event.target as HTMLInputElement;
    const value = parseFloat(input.value);
    
    if (isNaN(value) || value <= 0) {
      this.toastService.error('Please enter a valid amount greater than 0', 'Invalid Amount');
      return;
    }

    try {
      this.userPaymentPreferences.setCustomAmount(action, value);
      
      // Update local state
      this.customAmounts.update(amounts => ({
        ...amounts,
        [action]: value
      }));
      
      this.toastService.success(
        `${action.charAt(0).toUpperCase() + action.slice(1)} amount set to ${value.toFixed(3)} KAS`,
        'Payment Updated'
      );
    } catch (error: any) {
      this.toastService.error(error.message, 'Error');
    }
  }

  removeCustomAmount(action: keyof UserPaymentPreferences): void {
    this.userPaymentPreferences.removeCustomAmount(action);
    
    // Update local state
    this.customAmounts.update(amounts => {
      const newAmounts = { ...amounts };
      delete newAmounts[action];
      return newAmounts;
    });
    
    this.toastService.info(
      `${action.charAt(0).toUpperCase() + action.slice(1)} amount reset to dynamic calculation`,
      'Payment Reset'
    );
  }

  resetAllPreferences(): void {
    if (confirm('Are you sure you want to reset all payment preferences to defaults?')) {
      this.userPaymentPreferences.resetToDefaults();
      this.loadCurrentPreferences();
      this.toastService.success('All payment preferences reset to defaults', 'Reset Complete');
    }
  }

  exportPreferences(): void {
    try {
      const exported = this.userPaymentPreferences.exportPreferences();
      
      // Create a downloadable file
      const blob = new Blob([exported], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = 'verum-payment-preferences.json';
      link.click();
      URL.revokeObjectURL(url);
      
      this.toastService.success('Payment preferences exported', 'Export Complete');
    } catch (error) {
      this.toastService.error('Failed to export preferences', 'Export Error');
    }
  }

  importPreferences(event: Event): void {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (!file) return;
    
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const content = e.target?.result as string;
        this.userPaymentPreferences.importPreferences(content);
        this.loadCurrentPreferences();
        this.toastService.success('Payment preferences imported successfully', 'Import Complete');
      } catch (error: any) {
        this.toastService.error('Failed to import preferences: ' + error.message, 'Import Error');
      }
    };
    reader.readAsText(file);
    
    // Reset the input
    input.value = '';
  }

  formatKasAmount(amount: number): string {
    return this.feeCalculationService.formatKasAmount(amount);
  }

  getSavingsInfo(action: keyof UserPaymentPreferences): { 
    savings: number; 
    savingsFormatted: string; 
    isHigher: boolean;
  } {
    const custom = this.customAmounts()[action];
    const calculated = this.calculatedAmounts()[action];
    
    if (custom === undefined) {
      return { savings: 0, savingsFormatted: '0.000 KAS', isHigher: false };
    }
    
    const savings = calculated - custom;
    return {
      savings,
      savingsFormatted: this.formatKasAmount(Math.abs(savings)),
      isHigher: custom > calculated
    };
  }
}