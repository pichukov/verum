import { Component, input, output, signal, inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';
import { ImageCompressionService } from '../../../services/image-compression.service';

@Component({
  selector: 'app-avatar-uploader',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule],
  template: `
    <div class="avatar-uploader">
      <!-- Current Avatar Display -->
      <div class="avatar-container" [class.has-avatar]="currentAvatar()">
        <div class="avatar-display" (click)="triggerFileInput()">
          @if (currentAvatar()) {
            <img 
              [src]="currentAvatar()" 
              [alt]="altText()"
              class="avatar-image">
          } @else {
            <div class="avatar-placeholder">
              <fa-icon [icon]="['fas', 'user']" class="placeholder-icon"></fa-icon>
            </div>
          }
          
          <!-- Upload overlay -->
          <div class="upload-overlay">
            <fa-icon [icon]="['fas', 'camera']" class="camera-icon"></fa-icon>
            <span class="upload-text">{{ currentAvatar() ? 'Change' : 'Upload' }}</span>
          </div>
          
          <!-- Loading overlay -->
          @if (isProcessing()) {
            <div class="loading-overlay">
              <div class="spinner"></div>
            </div>
          }
        </div>
        
        <!-- Remove button -->
        @if (currentAvatar() && allowRemove()) {
          <button 
            (click)="removeAvatar()"
            class="remove-button"
            type="button"
            title="Remove avatar">
            <fa-icon [icon]="['fas', 'times']"></fa-icon>
          </button>
        }
      </div>
      
      <!-- File input -->
      <input
        #fileInput
        type="file"
        accept="image/*"
        (change)="onFileSelected($event)"
        class="file-input"
        [disabled]="isProcessing()">
      
      <!-- Upload info -->
      <div class="upload-info">
        <p class="info-text">
          <fa-icon [icon]="['fas', 'info-circle']" class="info-icon"></fa-icon>
          Auto-converted to 16x16 pixel art for blockchain storage
        </p>
        <p class="supported-formats">
          Supported: JPEG, PNG, WebP, GIF
        </p>
      </div>
      
      <!-- Error message -->
      @if (errorMessage()) {
        <div class="error-message">
          <fa-icon [icon]="['fas', 'exclamation-triangle']" class="error-icon"></fa-icon>
          {{ errorMessage() }}
        </div>
      }
    </div>
  `,
  styles: [`
    .avatar-uploader {
      @apply flex flex-col items-center space-y-4 mt-4;
    }
    
    .avatar-container {
      @apply relative;
    }
    
    .avatar-display {
      @apply relative w-24 h-24 rounded-full overflow-hidden cursor-pointer;
      @apply border-2 border-white-300 dark:border-black-600;
      @apply hover:border-kaspa-400 dark:hover:border-kaspa-500;
      @apply transition-all duration-200;
    }
    
    .avatar-image {
      @apply w-full h-full object-cover;
    }
    
    .avatar-placeholder {
      @apply w-full h-full bg-white-200 dark:bg-black-700;
      @apply flex items-center justify-center;
    }
    
    .placeholder-icon {
      @apply text-2xl text-black-400 dark:text-white-400;
    }
    
    .upload-overlay {
      @apply absolute inset-0 bg-black-900 bg-opacity-60;
      @apply flex flex-col items-center justify-center;
      @apply opacity-0 hover:opacity-100;
      @apply transition-opacity duration-200;
    }
    
    .camera-icon {
      @apply text-white text-lg mb-1;
    }
    
    .upload-text {
      @apply text-white text-xs font-medium;
    }
    
    .loading-overlay {
      @apply absolute inset-0 bg-black-900 bg-opacity-60;
      @apply flex items-center justify-center;
    }
    
    .spinner {
      @apply w-6 h-6 border-2 border-white border-t-transparent rounded-full animate-spin;
    }
    
    .remove-button {
      @apply absolute -top-2 -right-2 w-6 h-6;
      @apply bg-red-500 hover:bg-red-600 text-white;
      @apply rounded-full flex items-center justify-center;
      @apply transition-colors duration-200;
      @apply shadow-medium;
    }
    
    .remove-button fa-icon {
      @apply text-xs;
    }
    
    .file-input {
      @apply hidden;
    }
    
    .upload-info {
      @apply text-center space-y-1;
    }
    
    .info-text {
      @apply text-sm text-black-600 dark:text-white-400;
      @apply flex items-center justify-center gap-2;
    }
    
    .info-icon {
      @apply text-kaspa-500;
    }
    
    .supported-formats {
      @apply text-xs text-black-500 dark:text-white-400;
    }
    
    .error-message {
      @apply flex items-center space-x-2 text-sm text-red-600 dark:text-red-400;
      @apply bg-red-50 dark:bg-red-900/20 px-3 py-2 rounded-md;
    }
    
    .error-icon {
      @apply text-red-500;
    }
    
    /* Size variants */
    .avatar-uploader.size-sm .avatar-display {
      @apply w-16 h-16;
    }
    
    .avatar-uploader.size-lg .avatar-display {
      @apply w-32 h-32;
    }
    
    .avatar-uploader.size-xl .avatar-display {
      @apply w-40 h-40;
    }
  `]
})
export class AvatarUploaderComponent {
  private imageService = inject(ImageCompressionService);
  
  // Inputs
  public currentAvatar = input<string>(''); // Data URL or base64
  public altText = input<string>('Avatar');
  public size = input<number>(64); // Avatar size in pixels
  public maxSizeKB = input<number>(1); // Max size in KB (for display only)
  public allowRemove = input<boolean>(true);
  public disabled = input<boolean>(false);
  
  // Outputs
  public avatarSelected = output<string>(); // Now emits compressed base64 string
  public avatarRemoved = output<void>();
  public error = output<string>();
  
  // State
  public isProcessing = signal<boolean>(false);
  public errorMessage = signal<string>('');
  
  /**
   * Trigger file input click
   */
  public triggerFileInput(): void {
    if (this.disabled() || this.isProcessing()) {
      return;
    }
    
    const fileInput = document.querySelector('.file-input') as HTMLInputElement;
    if (fileInput) {
      fileInput.click();
    }
  }
  
  /**
   * Handle file selection
   */
  public async onFileSelected(event: Event): Promise<void> {
    const input = event.target as HTMLInputElement;
    const file = input.files?.[0];
    
    if (!file) {
      return;
    }
    
    try {
      this.isProcessing.set(true);
      this.errorMessage.set('');
      
      // Validate file
      const validation = this.imageService.validateImageFile(file);
      if (!validation.valid) {
        throw new Error(validation.error!);
      }
      
      // Check dimensions (optional)
      try {
        const dimensions = await this.imageService.getImageDimensions(file);
      } catch (error) {
        // Could not get image dimensions
      }
      
      // Convert to pixel art for ultra-compact blockchain storage
      const compressedBase64 = await this.imageService.compressToPixelArt(file, {
        maxWidth: 16, 
        maxHeight: 16,
        format: 'png',
        maxSizeBytes: 200
      });
      
      // Update preview with compressed image
      const compressedDataUrl = `data:image/jpeg;base64,${compressedBase64}`;
      
      // Emit the compressed base64 string
      this.avatarSelected.emit(compressedBase64);
      
      // Clear the input so the same file can be selected again
      input.value = '';
      
    } catch (error: any) {
      const errorMsg = error.message || 'Failed to process image';
      this.errorMessage.set(errorMsg);
      this.error.emit(errorMsg);
      
      // Clear the input
      input.value = '';
    } finally {
      this.isProcessing.set(false);
    }
  }
  
  /**
   * Remove current avatar
   */
  public removeAvatar(): void {
    if (this.disabled() || this.isProcessing()) {
      return;
    }
    
    this.errorMessage.set('');
    this.avatarRemoved.emit();
  }
  
  /**
   * Clear error message
   */
  public clearError(): void {
    this.errorMessage.set('');
  }
  
  /**
   * Get avatar size class
   */
  public getSizeClass(): string {
    const size = this.size();
    if (size <= 48) return 'size-sm';
    if (size >= 128) return 'size-lg';
    if (size >= 160) return 'size-xl';
    return '';
  }
}