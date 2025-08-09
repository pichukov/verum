import { Injectable, inject, signal } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, throwError, BehaviorSubject } from 'rxjs';
import { catchError, retry, tap, map } from 'rxjs/operators';
import { 
  KaspaTransactionResponse, 
  FeeEstimate, 
  KaspaFeeEstimateResponse,
  KaspaRestApiError 
} from '../types/transaction';

export interface ApiEndpoint {
  name: string;
  url: string;
  isActive: boolean;
  network: string;
}

@Injectable({
  providedIn: 'root'
})
export class KaspaApiService {
  private http = inject(HttpClient);
  
  // Network-specific API endpoints
  private apiEndpoints: { [network: string]: ApiEndpoint[] } = {
    'kaspa-mainnet': [
      { name: 'Mainnet Primary', url: 'https://api.kaspa.org', isActive: true, network: 'kaspa-mainnet' },
      { name: 'Mainnet Secondary', url: 'https://kaspa.aspectron.org', isActive: false, network: 'kaspa-mainnet' },
    ],
    'kaspa-testnet-11': [
      { name: 'Testnet-11 Primary', url: 'https://api-tn11.kaspa.org', isActive: true, network: 'kaspa-testnet-11' },
    ],
    'kaspa-testnet-10': [
      { name: 'Testnet-10 Primary', url: 'https://api-tn10.kaspa.org', isActive: true, network: 'kaspa-testnet-10' },
    ],
    'kaspa-devnet': [
      { name: 'Devnet Primary', url: 'https://api.kaspa.org', isActive: true, network: 'kaspa-devnet' },
    ]
  };
  
  private currentNetwork = 'kaspa-mainnet'; // Default to mainnet
  private currentEndpointIndex = 0;
  private _currentEndpoint = signal<ApiEndpoint>(this.apiEndpoints['kaspa-mainnet'][0]);
  
  public readonly currentEndpoint = this._currentEndpoint.asReadonly();
  
  constructor() {
    // Load saved endpoint preference from localStorage
    const savedEndpoint = localStorage.getItem('kaspa-api-endpoint');
    const savedNetwork = localStorage.getItem('kaspa-api-network');
    
    if (savedNetwork && this.apiEndpoints[savedNetwork]) {
      this.currentNetwork = savedNetwork;
    }
    
    if (savedEndpoint) {
      const endpoints = this.apiEndpoints[this.currentNetwork];
      const endpointIndex = endpoints.findIndex(e => e.url === savedEndpoint);
      if (endpointIndex !== -1) {
        this.switchToEndpoint(endpointIndex);
      } else {
        this._currentEndpoint.set(endpoints[0]);
      }
    }
  }
  
  private get baseUrl(): string {
    // For now, use direct URLs in development too since proxy isn't working
    const endpoints = this.apiEndpoints[this.currentNetwork];
    const url = endpoints[this.currentEndpointIndex]?.url || this.apiEndpoints['kaspa-mainnet'][0].url;
    
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      console.log(`[KaspaAPI] 🌐 Using direct URL in development: ${url} (network: ${this.currentNetwork})`);
    } else {
      console.log(`[KaspaAPI] 🌐 Using production URL: ${url} (network: ${this.currentNetwork})`);
    }
    
    return url;
  }
  
  /**
   * Set the network for API calls
   */
  public setNetwork(network: string): void {
    if (this.apiEndpoints[network]) {
      this.currentNetwork = network;
      this.currentEndpointIndex = 0; // Reset to first endpoint
      this._currentEndpoint.set(this.apiEndpoints[network][0]);

      // Save preference
      localStorage.setItem('kaspa-api-network', network);
      localStorage.setItem('kaspa-api-endpoint', this.apiEndpoints[network][0].url);
    } else {
      this.currentNetwork = 'kaspa-mainnet';
      this.currentEndpointIndex = 0;
      this._currentEndpoint.set(this.apiEndpoints['kaspa-mainnet'][0]);
    }
  }
  
  /**
   * Auto-detect network from wallet address
   */
  public setNetworkFromAddress(address: string): void {
    if (!address) {
      console.log('[KaspaAPI] ⚠️ setNetworkFromAddress called with empty address');
      return;
    }
    
    let network = 'kaspa-mainnet'; // Default
    
    if (address.startsWith('kaspatest:')) {
      // For testnet addresses, default to testnet-10
      network = 'kaspa-testnet-10';
      console.log(`[KaspaAPI] 🎯 Detected testnet address, setting network to: ${network}`);
    } else if (address.startsWith('kaspadev:')) {
      network = 'kaspa-devnet';
      console.log(`[KaspaAPI] 🎯 Detected devnet address, setting network to: ${network}`);
    } else {
      console.log(`[KaspaAPI] 🎯 Detected mainnet address, setting network to: ${network}`);
    }
    
    this.setNetwork(network);
  }
  
  private handleError = (error: HttpErrorResponse): Observable<never> => {
    
    let errorMessage = 'An unknown error occurred';
    
    if (error.error instanceof ErrorEvent) {
      // Client-side error
      errorMessage = `Client Error: ${error.error.message}`;
    } else {
      // Server-side error
      errorMessage = error.error?.message || `Server Error: ${error.status} ${error.statusText}`;
      
      // Try next endpoint if current one fails
      if (error.status >= 500 || error.status === 0) {
        this.tryNextEndpoint();
      }
    }
    
    return throwError(() => ({
      error: error.error?.error || 'API_ERROR',
      message: errorMessage,
      status: error.status || 0
    } as KaspaRestApiError));
  };
  
  private tryNextEndpoint(): void {
    const endpoints = this.apiEndpoints[this.currentNetwork];
    const nextIndex = (this.currentEndpointIndex + 1) % endpoints.length;
    if (nextIndex !== this.currentEndpointIndex) {
      this.switchToEndpoint(nextIndex);
    }
  }
  
  public switchToEndpoint(index: number): void {
    const endpoints = this.apiEndpoints[this.currentNetwork];
    if (index >= 0 && index < endpoints.length) {
      this.currentEndpointIndex = index;
      this._currentEndpoint.set(endpoints[index]);
      
      // Save preference
      localStorage.setItem('kaspa-api-endpoint', endpoints[index].url);
    }
  }
  
  public getAvailableEndpoints(): ApiEndpoint[] {
    return [...this.apiEndpoints[this.currentNetwork]];
  }
  
  public getCurrentNetwork(): string {
    return this.currentNetwork;
  }
  
  /**
   * Get all transactions for a specific address
   */
  public getAddressTransactions(
    address: string, 
    limit: number = 50, 
    offset: number = 0
  ): Observable<any> {
    // Ensure address is properly encoded
    const encodedAddress = encodeURIComponent(address);
    const url = `${this.baseUrl}/addresses/${encodedAddress}/full-transactions`;
    const params = { limit: limit.toString(), offset: offset.toString() };
    
    console.log(`[KaspaAPI] 🌍 GET ${url}?limit=${limit}&offset=${offset}`);
    
    return this.http.get<any>(url, { params })
      .pipe(
        tap(response => {
          if (Array.isArray(response)) {
            console.log(`[KaspaAPI] ✅ Got ${response.length} transactions for ${address.substring(0, 20)}... (direct array format)`);
          } else if (response?.transactions) {
            console.log(`[KaspaAPI] ✅ Got ${response.transactions.length} transactions for ${address.substring(0, 20)}... (object format)`);
          } else {
            console.log(`[KaspaAPI] ⚠️ Unexpected response format:`, response);
          }
        }),
        retry(2),
        catchError((error) => {
          console.error(`[KaspaAPI] 💥 Error fetching transactions for ${address.substring(0, 20)}...:`, error);
          return this.handleError(error);
        })
      );
  }
  
  /**
   * Get transactions after a specific transaction ID
   */
  public getAddressTransactionsAfter(
    address: string,
    afterTransactionId: string,
    limit: number = 50
  ): Observable<KaspaTransactionResponse> {
    const url = `${this.baseUrl}/addresses/${address}/full-transactions`;
    const params = { 
      after: afterTransactionId,
      limit: limit.toString()
    };
    
    return this.http.get<KaspaTransactionResponse>(url, { params })
      .pipe(
        retry(2),
        catchError(this.handleError)
      );
  }
  
  /**
   * Get transactions before a specific transaction ID
   */
  public getAddressTransactionsBefore(
    address: string,
    beforeTransactionId: string,
    limit: number = 50
  ): Observable<KaspaTransactionResponse> {
    const url = `${this.baseUrl}/addresses/${address}/full-transactions`;
    const params = { 
      before: beforeTransactionId,
      limit: limit.toString()
    };
    
    return this.http.get<KaspaTransactionResponse>(url, { params })
      .pipe(
        retry(2),
        catchError(this.handleError)
      );
  }
  
  /**
   * Get current fee estimates
   */
  public getFeeEstimate(): Observable<KaspaFeeEstimateResponse> {
    const url = `${this.baseUrl}/info/fee-estimate`;
    
    return this.http.get<KaspaFeeEstimateResponse>(url)
      .pipe(
        retry(2),
        catchError(this.handleError)
      );
  }
  
  /**
   * Get specific transaction by ID
   */
  public getTransaction(transactionId: string): Observable<any> {
    const url = `${this.baseUrl}/transactions/${transactionId}`;
    
    return this.http.get(url)
      .pipe(
        retry(2),
        catchError(this.handleError)
      );
  }
  
  /**
   * Submit a transaction (if not handled by Kasware)
   */
  public submitTransaction(transactionHex: string): Observable<any> {
    const url = `${this.baseUrl}/transactions`;
    
    return this.http.post(url, { transaction: transactionHex })
      .pipe(
        catchError(this.handleError)
      );
  }
  
  /**
   * Get network info
   */
  public getNetworkInfo(): Observable<any> {
    const url = `${this.baseUrl}/info/network`;
    
    return this.http.get(url)
      .pipe(
        retry(2),
        catchError(this.handleError)
      );
  }
  
  /**
   * Health check for current endpoint
   */
  public healthCheck(): Observable<any> {
    const url = `${this.baseUrl}/info/health`;
    
    return this.http.get(url)
      .pipe(
        catchError(this.handleError)
      );
  }
}