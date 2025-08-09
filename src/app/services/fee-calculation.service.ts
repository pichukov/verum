import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, BehaviorSubject, map, catchError, of } from 'rxjs';
import { UserPaymentPreferencesService } from './user-payment-preferences.service';

export interface ActionAmounts {
  subscribe: number;
  comment: number;
  like: number;
  post: number;
  note: number;
  story: number;
}

export interface PriceInfo {
  kasPrice: number;
  lastUpdated: Date;
  basePrice: number; // $0.05 reference price
}

export interface EconomicExplanation {
  action: string;
  percentage: number;
  kasAmount: number;
  usdEquivalent: number;
  reasoning: string;
}

interface KaspaPriceResponse {
  price: number;
}

@Injectable({
  providedIn: 'root'
})
export class FeeCalculationService {
  // Note: This service calculates PAYMENT AMOUNTS for actions, not gas fees.
  // Gas fees are handled separately by the transaction service.
  private readonly BASE_USD_PRICE = 0.05; // $0.05 reference price for 100%
  private readonly BASE_MIN_PAYMENT_AMOUNT = 0.1; // Base minimum 0.1 KAS for wallet compatibility
  private readonly ACTION_PERCENTAGES = {
    subscribe: 1.0,   // 100%
    comment: 0.3,     // 30%
    like: 0.05,       // 5%
    post: 20.0,       // 20x base amount (1 KAS default at $0.05 = $1.00)
    note: 20.0,       // Same as post - encrypted notes have same value
    story: 20.0       // Same as post - stories have same value as posts
  };

  // Dynamic minimum amount calculation based on wallet state
  private dynamicMinAmount = this.BASE_MIN_PAYMENT_AMOUNT;

  private currentPrice$ = new BehaviorSubject<PriceInfo>({
    kasPrice: this.BASE_USD_PRICE,
    lastUpdated: new Date(),
    basePrice: this.BASE_USD_PRICE
  });

  private userPaymentPreferences = inject(UserPaymentPreferencesService);

  constructor(private http: HttpClient) {
    // Initialize with base price immediately
    this.currentPrice$.next({
      kasPrice: this.BASE_USD_PRICE,
      lastUpdated: new Date(),
      basePrice: this.BASE_USD_PRICE
    });
    
    // Then fetch real price
    this.updateKasPrice();
    // Update price every 5 minutes
    setInterval(() => this.updateKasPrice(), 5 * 60 * 1000);
  }

  /**
   * Fetches current KAS price from official Kaspa REST API
   * Uses api.kaspa.org/info/price endpoint
   */
  private updateKasPrice(): void {
    // Using official Kaspa REST API
    this.http.get<KaspaPriceResponse>('https://api.kaspa.org/info/price')
      .pipe(
        map(response => {
          // The API returns { price: number }
          const price = response?.price;
          if (typeof price === 'number' && price > 0) {
            return price;
          }
          return this.BASE_USD_PRICE;
        }),
        catchError((error) => {
          return of(this.BASE_USD_PRICE);
        })
      )
      .subscribe(price => {
        this.currentPrice$.next({
          kasPrice: price,
          lastUpdated: new Date(),
          basePrice: this.BASE_USD_PRICE
        });
      });
  }

  /**
   * Get current KAS price information
   */
  getCurrentPrice(): Observable<PriceInfo> {
    return this.currentPrice$.asObservable();
  }

  /**
   * Calculate payment amount in KAS for a specific action
   * Checks user preferences first, then falls back to dynamic calculation
   * Formula: (basePrice * actionPercentage) / currentKasPrice
   * Applies minimum threshold of 0.1 KAS for wallet compatibility
   */
  calculateActionAmount(action: keyof typeof this.ACTION_PERCENTAGES): Observable<number> {
    // Check if user has custom amounts enabled and set for this action
    const customAmount = this.userPaymentPreferences.getCustomAmount(action);
    if (customAmount !== undefined) {
      return new BehaviorSubject(customAmount).asObservable();
    }
    
    // Special handling for post and note actions - flat 1 KAS rate
    if (action === 'post' || action === 'note') {
      return new BehaviorSubject(1.0).asObservable(); // Flat 1 KAS
    }
    
    return this.currentPrice$.pipe(
      map(priceInfo => {
        const percentage = this.ACTION_PERCENTAGES[action];
        const usdAmount = this.BASE_USD_PRICE * percentage;
        const calculatedAmount = usdAmount / priceInfo.kasPrice;
        
        // Apply dynamic minimum threshold for wallet compatibility
        const finalAmount = Math.max(calculatedAmount, this.dynamicMinAmount);
        
        return finalAmount;
      })
    );
  }

  /**
   * Calculate all action payment amounts
   * Uses user preferences when available, falls back to dynamic calculation
   */
  calculateAllAmounts(): Observable<ActionAmounts> {
    return this.currentPrice$.pipe(
      map(priceInfo => {
        const amounts: ActionAmounts = {
          subscribe: 0,
          comment: 0,
          like: 0,
          post: 0,
          note: 0,
          story: 0
        };

        Object.keys(this.ACTION_PERCENTAGES).forEach(action => {
          const key = action as keyof typeof this.ACTION_PERCENTAGES;
          
          // Check for custom amount first
          const customAmount = this.userPaymentPreferences.getCustomAmount(key);
          if (customAmount !== undefined) {
            amounts[key] = customAmount;
            return;
          }
          
          // Special handling for post and note actions - flat 1 KAS rate
          if (key === 'post' || key === 'note') {
            amounts[key] = 1.0;
            return;
          }
          
          // Use calculated amount if no custom preference
          const percentage = this.ACTION_PERCENTAGES[key];
          const usdAmount = this.BASE_USD_PRICE * percentage;
          const calculatedAmount = usdAmount / priceInfo.kasPrice;
          // Apply minimum threshold
          amounts[key] = Math.max(calculatedAmount, this.dynamicMinAmount);
        });

        return amounts;
      })
    );
  }

  /**
   * Get economic explanation for fee structure
   */
  getEconomicExplanation(): Observable<EconomicExplanation[]> {
    return this.currentPrice$.pipe(
      map(priceInfo => {
        const explanations: EconomicExplanation[] = [];

        Object.entries(this.ACTION_PERCENTAGES).forEach(([action, percentage]) => {
          const usdAmount = this.BASE_USD_PRICE * percentage;
          const kasAmount = usdAmount / priceInfo.kasPrice;

          let reasoning = '';
          switch (action) {
            case 'subscribe':
              reasoning = 'Subscription requires full commitment and creates ongoing relationship between users. High fee prevents spam subscriptions and ensures genuine interest.';
              break;
            case 'comment':
              reasoning = 'Comments contribute meaningful content to discussions. Moderate fee encourages quality while remaining accessible for active participation.';
              break;
            case 'like':
              reasoning = 'Likes are simple engagement actions. Low fee enables frequent interaction while still preventing bot abuse.';
              break;
          }

          explanations.push({
            action,
            percentage: percentage * 100,
            kasAmount,
            usdEquivalent: usdAmount,
            reasoning
          });
        });

        return explanations;
      })
    );
  }

  /**
   * Get fee comparison at different KAS prices
   */
  getAmountProjections(kasPrices: number[]): ActionAmounts[] {
    return kasPrices.map(kasPrice => {
      const amounts: ActionAmounts = {
        subscribe: 0,
        comment: 0,
        like: 0,
        post: 0,
        note: 0,
        story: 0
      };

      Object.keys(this.ACTION_PERCENTAGES).forEach(action => {
        const key = action as keyof typeof this.ACTION_PERCENTAGES;
        
        // Special handling for post and note actions - flat 1 KAS rate
        if (key === 'post' || key === 'note') {
          amounts[key] = 1.0;
          return;
        }
        
        const percentage = this.ACTION_PERCENTAGES[key];
        const usdAmount = this.BASE_USD_PRICE * percentage;
        const calculatedAmount = usdAmount / kasPrice;
        // Apply minimum threshold
        amounts[key] = Math.max(calculatedAmount, this.dynamicMinAmount);
      });

      return amounts;
    });
  }

  /**
   * Format KAS amount to readable string - always show in KAS with 3 decimal places
   */
  formatKasAmount(amount: number): string {
    return `${amount.toFixed(3)} KAS`;
  }

  /**
   * Get fee summary for display
   */
  getFeeSummary(): Observable<string> {
    return this.currentPrice$.pipe(
      map(priceInfo => {
        const subscriptionFee = (this.BASE_USD_PRICE * this.ACTION_PERCENTAGES.subscribe) / priceInfo.kasPrice;
        const commentFee = (this.BASE_USD_PRICE * this.ACTION_PERCENTAGES.comment) / priceInfo.kasPrice;
        const likeFee = (this.BASE_USD_PRICE * this.ACTION_PERCENTAGES.like) / priceInfo.kasPrice;

        return `Current fees (KAS @ $${priceInfo.kasPrice.toFixed(4)}): ` +
               `Subscribe: ${this.formatKasAmount(subscriptionFee)}, ` +
               `Comment: ${this.formatKasAmount(commentFee)}, ` +
               `Like: ${this.formatKasAmount(likeFee)}`;
      })
    );
  }
  
  /**
   * Adjust minimum payment amount based on wallet feedback
   * This method can be called when a transaction fails due to mass issues
   */
  adjustMinimumAmountForMassIssue(): void {
    const previousAmount = this.dynamicMinAmount;
    // Increase minimum by 10% when mass issues occur
    this.dynamicMinAmount = Math.round((this.dynamicMinAmount * 1.1) * 1000) / 1000; // Round to 3 decimals
  }

  /**
   * Reset minimum amount to base value
   */
  resetMinimumAmount(): void {
    const previousAmount = this.dynamicMinAmount;
    this.dynamicMinAmount = this.BASE_MIN_PAYMENT_AMOUNT;
  }

  /**
   * Get current minimum amount
   */
  getCurrentMinimumAmount(): number {
    return this.dynamicMinAmount;
  }

  /**
   * Set a specific minimum amount (for manual adjustment)
   */
  setMinimumAmount(amount: number): void {
    const previousAmount = this.dynamicMinAmount;
    this.dynamicMinAmount = Math.max(amount, this.BASE_MIN_PAYMENT_AMOUNT); // Never go below base minimum
  }

  /**
   * Get payment source information for display purposes
   */
  getPaymentSourceInfo(action: keyof typeof this.ACTION_PERCENTAGES): { 
    isCustom: boolean; 
    amount: number | undefined; 
    source: string;
  } {
    const customAmount = this.userPaymentPreferences.getCustomAmount(action);
    return {
      isCustom: customAmount !== undefined,
      amount: customAmount,
      source: customAmount !== undefined ? 'User Preference' : 'Dynamic Calculation'
    };
  }

  /**
   * Check if user has custom payment amounts enabled
   */
  isUsingCustomAmounts(): boolean {
    return this.userPaymentPreferences.isUsingCustomAmounts();
  }

  /**
   * Get user payment preferences service reference for UI components
   */
  getUserPaymentPreferences(): UserPaymentPreferencesService {
    return this.userPaymentPreferences;
  }

  /**
   * Backward compatibility method - redirects to calculateActionAmount
   * @deprecated Use calculateActionAmount instead
   */
  calculateActionFee(action: keyof typeof this.ACTION_PERCENTAGES): Observable<number> {
    return this.calculateActionAmount(action);
  }
}