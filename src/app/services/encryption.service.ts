import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class EncryptionService {
  
  /**
   * Encrypt text using AES-GCM with a password
   */
  public async encryptText(text: string, password: string): Promise<string> {
    try {
      // Generate salt for key derivation
      const salt = crypto.getRandomValues(new Uint8Array(16));
      
      // Derive key from password
      const key = await this.deriveKey(password, salt);
      
      // Generate initialization vector
      const iv = crypto.getRandomValues(new Uint8Array(12));
      
      // Encode text
      const encoder = new TextEncoder();
      const data = encoder.encode(text);
      
      // Encrypt
      const encryptedData = await crypto.subtle.encrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        key,
        data
      );
      
      // Combine salt + iv + encrypted data
      const combined = new Uint8Array(salt.length + iv.length + encryptedData.byteLength);
      combined.set(salt, 0);
      combined.set(iv, salt.length);
      combined.set(new Uint8Array(encryptedData), salt.length + iv.length);
      
      // Convert to base64
      return btoa(String.fromCharCode(...combined));
    } catch (error) {
      console.error('Encryption error:', error);
      throw new Error('Failed to encrypt text');
    }
  }
  
  /**
   * Decrypt text using AES-GCM with a password
   */
  public async decryptText(encryptedBase64: string, password: string): Promise<string> {
    try {
      // Decode from base64
      const combined = Uint8Array.from(atob(encryptedBase64), c => c.charCodeAt(0));
      
      // Extract salt, iv, and encrypted data
      const salt = combined.slice(0, 16);
      const iv = combined.slice(16, 28);
      const encryptedData = combined.slice(28);
      
      // Derive key from password
      const key = await this.deriveKey(password, salt);
      
      // Decrypt
      const decryptedData = await crypto.subtle.decrypt(
        {
          name: 'AES-GCM',
          iv: iv
        },
        key,
        encryptedData
      );
      
      // Decode text
      const decoder = new TextDecoder();
      return decoder.decode(decryptedData);
    } catch (error) {
      console.error('Decryption error:', error);
      throw new Error('Failed to decrypt text. Please check your password.');
    }
  }
  
  /**
   * Derive a cryptographic key from a password
   */
  private async deriveKey(password: string, salt: Uint8Array): Promise<CryptoKey> {
    // Import password as key material
    const encoder = new TextEncoder();
    const keyMaterial = await crypto.subtle.importKey(
      'raw',
      encoder.encode(password),
      'PBKDF2',
      false,
      ['deriveKey']
    );
    
    // Derive key using PBKDF2
    return crypto.subtle.deriveKey(
      {
        name: 'PBKDF2',
        salt: salt,
        iterations: 100000,
        hash: 'SHA-256'
      },
      keyMaterial,
      {
        name: 'AES-GCM',
        length: 256
      },
      false,
      ['encrypt', 'decrypt']
    );
  }
  
  /**
   * Create a simple hash of a password for UI validation (not for security)
   */
  public async hashPassword(password: string): Promise<string> {
    const encoder = new TextEncoder();
    const data = encoder.encode(password);
    const hashBuffer = await crypto.subtle.digest('SHA-256', data);
    const hashArray = Array.from(new Uint8Array(hashBuffer));
    return hashArray.map(b => b.toString(16).padStart(2, '0')).join('');
  }
}