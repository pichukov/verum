import { Injectable } from '@angular/core';

export interface ImageCompressionOptions {
  maxWidth?: number;
  maxHeight?: number;
  quality?: number;
  format?: 'jpeg' | 'png' | 'webp';
  maxSizeBytes?: number;
}

@Injectable({
  providedIn: 'root'
})
export class ImageCompressionService {
  
  /**
   * Compress an image file to fit within payload constraints
   * Target: ~300-500 bytes raw (400-700 bytes Base64) for avatar images
   */
  public async compressImage(
    file: File,
    options: ImageCompressionOptions = {}
  ): Promise<string> {
    const defaultOptions = {
      maxWidth: 64,
      maxHeight: 64,
      quality: 0.5,
      format: 'jpeg' as const,
      maxSizeBytes: 300
    };
    
    const opts = { ...defaultOptions, ...options };
    
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }
          
          // Calculate dimensions maintaining aspect ratio
          const { width, height } = this.calculateDimensions(
            img.width,
            img.height,
            opts.maxWidth!,
            opts.maxHeight!
          );
          
          canvas.width = width;
          canvas.height = height;
          
          // Draw and compress
          ctx.drawImage(img, 0, 0, width, height);
          
          this.compressToTargetSize(canvas, opts)
            .then(resolve)
            .catch(reject);
            
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
      
      // Convert file to data URL
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      
      reader.readAsDataURL(file);
    });
  }
  
  /**
   * Compress image from data URL
   */
  public async compressImageFromDataUrl(
    dataUrl: string,
    options: ImageCompressionOptions = {}
  ): Promise<string> {
    const defaultOptions = {
      maxWidth: 64,
      maxHeight: 64,
      quality: 0.5,
      format: 'jpeg' as const,
      maxSizeBytes: 300
    };
    
    const opts = { ...defaultOptions, ...options };
    
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }
          
          const { width, height } = this.calculateDimensions(
            img.width,
            img.height,
            opts.maxWidth!,
            opts.maxHeight!
          );
          
          canvas.width = width;
          canvas.height = height;
          ctx.drawImage(img, 0, 0, width, height);
          
          this.compressToTargetSize(canvas, opts)
            .then(resolve)
            .catch(reject);
            
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
      
      img.src = dataUrl;
    });
  }
  
  /**
   * Calculate dimensions maintaining aspect ratio
   */
  private calculateDimensions(
    originalWidth: number,
    originalHeight: number,
    maxWidth: number,
    maxHeight: number
  ): { width: number; height: number } {
    let { width, height } = { width: originalWidth, height: originalHeight };
    
    // Scale down if too large
    if (width > maxWidth) {
      height = (height * maxWidth) / width;
      width = maxWidth;
    }
    
    if (height > maxHeight) {
      width = (width * maxHeight) / height;
      height = maxHeight;
    }
    
    return { width: Math.round(width), height: Math.round(height) };
  }
  
  /**
   * Compress canvas to target size with iterative quality reduction
   */
  private async compressToTargetSize(
    canvas: HTMLCanvasElement,
    options: ImageCompressionOptions
  ): Promise<string> {
    let quality = options.quality || 0.7;
    let result = '';
    let attempts = 0;
    const maxAttempts = 10;
    
    while (attempts < maxAttempts) {
      // Create data URL
      const dataUrl = canvas.toDataURL(`image/${options.format}`, quality);
      
      // Extract base64 part
      const base64 = dataUrl.split(',')[1];
      
      // Calculate size in bytes
      const sizeBytes = Math.ceil(base64.length * 0.75); // Base64 to bytes approximation
      
      if (sizeBytes <= options.maxSizeBytes! || quality <= 0.1) {
        result = base64;
        break;
      }
      
      // Reduce quality and try again
      quality = Math.max(0.1, quality - 0.1);
      attempts++;
    }
    
    if (!result) {
      throw new Error(`Could not compress image to target size of ${options.maxSizeBytes} bytes`);
    }
    
    console.log(`Image compressed to ${Math.ceil(result.length * 0.75)} bytes with quality ${quality}`);
    return result;
  }
  
  /**
   * Validate image file
   */
  public validateImageFile(file: File): { valid: boolean; error?: string } {
    // Check file type
    if (!file.type.startsWith('image/')) {
      return { valid: false, error: 'File must be an image' };
    }
    
    // Check supported formats
    const supportedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!supportedTypes.includes(file.type)) {
      return { valid: false, error: 'Supported formats: JPEG, PNG, WebP, GIF' };
    }
    
    // Check file size (reasonable limit before compression)
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (file.size > maxSize) {
      return { valid: false, error: 'File too large. Maximum 5MB.' };
    }
    
    return { valid: true };
  }
  
  /**
   * Get image dimensions from file
   */
  public getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        resolve({ width: img.width, height: img.height });
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
      
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      
      reader.readAsDataURL(file);
    });
  }
  
  /**
   * Convert image to pixel art style for ultra-compact storage
   */
  public async compressToPixelArt(
    file: File,
    options: ImageCompressionOptions = {}
  ): Promise<string> {
    const defaultOptions = {
      maxWidth: 16,  // Smaller pixel art grid for blockchain constraints
      maxHeight: 16,
      quality: 1.0,  // No JPEG compression artifacts for pixel art
      format: 'png' as const,
      maxSizeBytes: 200  // Much more aggressive compression
    };
    
    const opts = { ...defaultOptions, ...options };
    
    return new Promise((resolve, reject) => {
      const img = new Image();
      
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');
          
          if (!ctx) {
            reject(new Error('Could not get canvas context'));
            return;
          }
          
          // First pass: resize to very small dimensions
          canvas.width = opts.maxWidth!;
          canvas.height = opts.maxHeight!;
          
          // Disable image smoothing for sharp pixels
          ctx.imageSmoothingEnabled = false;
          ctx.drawImage(img, 0, 0, opts.maxWidth!, opts.maxHeight!);
          
          // Get pixel data for color reduction
          const imageData = ctx.getImageData(0, 0, opts.maxWidth!, opts.maxHeight!);
          const pixelArtData = this.reduceColorsForPixelArt(imageData);
          
          // Put the processed data back
          ctx.putImageData(pixelArtData, 0, 0);
          
          // Convert to base64
          const dataUrl = canvas.toDataURL(`image/${opts.format}`, opts.quality);
          const base64 = dataUrl.split(',')[1];
          
          console.log(`Pixel art created: ${Math.ceil(base64.length * 0.75)} bytes, ${opts.maxWidth}x${opts.maxHeight} pixels`);
          resolve(base64);
          
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = () => {
        reject(new Error('Failed to load image'));
      };
      
      // Convert file to data URL
      const reader = new FileReader();
      reader.onload = (e) => {
        img.src = e.target?.result as string;
      };
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      
      reader.readAsDataURL(file);
    });
  }

  /**
   * Reduce colors to create pixel art effect
   */
  private reduceColorsForPixelArt(imageData: ImageData): ImageData {
    const data = imageData.data;
    const colorPalette = 8; // Limited color palette
    
    for (let i = 0; i < data.length; i += 4) {
      // Reduce each color channel to fewer levels
      data[i] = Math.round(data[i] / (255 / colorPalette)) * (255 / colorPalette);     // Red
      data[i + 1] = Math.round(data[i + 1] / (255 / colorPalette)) * (255 / colorPalette); // Green  
      data[i + 2] = Math.round(data[i + 2] / (255 / colorPalette)) * (255 / colorPalette); // Blue
      // Alpha channel remains unchanged
    }
    
    return imageData;
  }

  /**
   * Create a placeholder avatar with initials (optimized for pixel art)
   */
  public createPlaceholderAvatar(
    initials: string,
    size: number = 32,
    backgroundColor: string = '#6B7280',
    textColor: string = '#FFFFFF'
  ): string {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }
    
    canvas.width = size;
    canvas.height = size;
    
    // For very small sizes, create a simple pattern instead of text
    if (size <= 32) {
      return this.createPixelArtPlaceholder(initials, size, backgroundColor, textColor);
    }
    
    // Draw background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, size, size);
    
    // Draw initials
    ctx.fillStyle = textColor;
    ctx.font = `bold ${Math.floor(size * 0.4)}px Arial`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    ctx.fillText(
      initials.toUpperCase().slice(0, 2),
      size / 2,
      size / 2
    );
    
    // Return base64 without data URL prefix
    return canvas.toDataURL('image/png').split(',')[1];
  }
  
  /**
   * Create a pixel art style placeholder (for very small avatars)
   */
  private createPixelArtPlaceholder(
    initials: string,
    size: number,
    backgroundColor: string,
    textColor: string
  ): string {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    
    if (!ctx) {
      throw new Error('Could not get canvas context');
    }
    
    canvas.width = size;
    canvas.height = size;
    
    // Disable smoothing for pixel art
    ctx.imageSmoothingEnabled = false;
    
    // Create a simple pattern based on initials
    const char1 = initials.charCodeAt(0) || 65;
    const char2 = initials.charCodeAt(1) || 65;
    
    // Use character codes to generate a unique pattern
    const pattern = (char1 + char2) % 8;
    
    // Fill background
    ctx.fillStyle = backgroundColor;
    ctx.fillRect(0, 0, size, size);
    
    // Create a simple geometric pattern based on initials
    ctx.fillStyle = textColor;
    
    // Different patterns based on character codes
    switch (pattern) {
      case 0: // Cross pattern
        ctx.fillRect(size/2-1, 0, 2, size);
        ctx.fillRect(0, size/2-1, size, 2);
        break;
      case 1: // Corner squares
        ctx.fillRect(0, 0, size/2, size/2);
        ctx.fillRect(size/2, size/2, size/2, size/2);
        break;
      case 2: // Diamond
        for (let i = 0; i < size; i++) {
          for (let j = 0; j < size; j++) {
            if (Math.abs(i - size/2) + Math.abs(j - size/2) < size/3) {
              ctx.fillRect(i, j, 1, 1);
            }
          }
        }
        break;
      case 3: // Stripes
        for (let i = 0; i < size; i += 2) {
          ctx.fillRect(i, 0, 1, size);
        }
        break;
      case 4: // Checkerboard
        for (let i = 0; i < size; i += 2) {
          for (let j = 0; j < size; j += 2) {
            if ((i + j) % 4 === 0) {
              ctx.fillRect(i, j, 2, 2);
            }
          }
        }
        break;
      default: // Simple center square
        const centerSize = Math.floor(size * 0.6);
        const offset = Math.floor((size - centerSize) / 2);
        ctx.fillRect(offset, offset, centerSize, centerSize);
    }
    
    return canvas.toDataURL('image/png').split(',')[1];
  }
}