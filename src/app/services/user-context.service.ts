import { Injectable, signal } from '@angular/core';
import { UserProfile } from '../types/transaction';

/**
 * Service to manage user context and START transaction reference
 * This helps with the new v0.2 protocol where all transactions reference the user's START transaction
 */
@Injectable({
  providedIn: 'root'
})
export class UserContextService {
  // Current user's START transaction ID (cached for performance)
  private _currentUserStartTxId = signal<string | null>(null);
  public readonly currentUserStartTxId = this._currentUserStartTxId.asReadonly();
  
  // Current user profile (for easy access)
  private _currentUserProfile = signal<UserProfile | null>(null);
  public readonly currentUserProfile = this._currentUserProfile.asReadonly();

  constructor() {}

  /**
   * Set the current user profile and extract START transaction ID
   */
  setCurrentUser(profile: UserProfile | null): void {
    this._currentUserProfile.set(profile);
    
    if (profile) {
      this._currentUserStartTxId.set(profile.startTransactionId);
      console.log(`[UserContext] Set current user START transaction ID: ${profile.startTransactionId}`);
    } else {
      this._currentUserStartTxId.set(null);
      console.log(`[UserContext] Cleared current user START transaction ID`);
    }
  }

  /**
   * Get the current user's START transaction ID
   */
  getCurrentUserStartTxId(): string | null {
    return this._currentUserStartTxId();
  }

  /**
   * Check if we have a valid user context
   */
  hasValidUserContext(): boolean {
    return this._currentUserStartTxId() !== null;
  }

  /**
   * Clear user context (on logout/disconnect)
   */
  clearUserContext(): void {
    this._currentUserProfile.set(null);
    this._currentUserStartTxId.set(null);
    console.log(`[UserContext] Cleared user context`);
  }
}