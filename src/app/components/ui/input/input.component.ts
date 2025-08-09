import { Component, Input, forwardRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';
import { FontAwesomeModule } from '@fortawesome/angular-fontawesome';

@Component({
  selector: 'app-input',
  standalone: true,
  imports: [CommonModule, FontAwesomeModule],
  providers: [
    {
      provide: NG_VALUE_ACCESSOR,
      useExisting: forwardRef(() => InputComponent),
      multi: true
    }
  ],
  template: `
    <div class="input-wrapper">
      @if (label) {
        <label 
          [for]="inputId"
          class="block text-label font-medium text-black-800 dark:text-white-200 mb-1">
          {{ label }}
          @if (required) {
            <span class="text-red-800 ml-1">*</span>
          }
        </label>
      }
      
      <div class="relative">
        <input
          [id]="inputId"
          [type]="type"
          [placeholder]="placeholder"
          [disabled]="disabled"
          [readonly]="readonly"
          [class]="getInputClasses()"
          [value]="value"
          (input)="onInput($event)"
          (blur)="onBlur()"
          (focus)="onFocus()" />
        
        @if (hasError) {
          <div class="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none">
            <fa-icon [icon]="['fas', 'exclamation-triangle']" class="text-red-800"></fa-icon>
          </div>
        }
      </div>
      
      @if (hasError && errorMessage) {
        <p class="mt-1 text-label text-red-800">
          {{ errorMessage }}
        </p>
      }
      
      @if (!hasError && helperText) {
        <p class="mt-1 text-label text-black-500 dark:text-white-500">
          {{ helperText }}
        </p>
      }
    </div>
  `,
  styles: [`
    .input {
      @apply w-full px-3 py-2.5 text-body rounded-md border transition-colors duration-200;
      @apply focus:outline-none focus:ring-2 focus:ring-offset-0;
      @apply disabled:opacity-50 disabled:cursor-not-allowed;
      @apply placeholder:text-black-400 dark:placeholder:text-white-500;
    }
    
    /* Cyberpunk input placeholder */
    :host-context(.cyberpunk-theme) .input {
      @apply rounded-none;
      
      &::placeholder {
        @apply text-cyber-gray-5;
        opacity: 0.5;
      }
    }

    .input-default {
      @apply border-white-400 dark:border-black-700 bg-white-900 dark:bg-black-800 text-black-800 dark:text-white-200;
      @apply focus:border-kaspa-600 focus:ring-kaspa-500;
    }
    
    /* Cyberpunk input styles */
    :host-context(.cyberpunk-theme) .input-default {
      @apply border-neon-cyan/30 bg-cyber-dark-3 text-white-200;
      @apply focus:border-neon-cyan focus:ring-neon-cyan/20;
    }

    .input-error {
      @apply border-red-800 bg-white-900 dark:bg-black-800 text-black-800 dark:text-white-200;
      @apply focus:border-red-800 focus:ring-red-500;
    }

    .input-sm {
      @apply px-2.5 py-1.5 text-label;
    }

    .input-md {
      @apply px-3 py-2.5 text-body;
    }

    .input-lg {
      @apply px-4 py-3 text-h5;
    }
  `]
})
export class InputComponent implements ControlValueAccessor {
  @Input() label?: string;
  @Input() placeholder?: string;
  @Input() type: string = 'text';
  @Input() size: 'sm' | 'md' | 'lg' = 'md';
  @Input() disabled: boolean = false;
  @Input() readonly: boolean = false;
  @Input() required: boolean = false;
  @Input() errorMessage?: string;
  @Input() helperText?: string;

  value: string = '';
  inputId = `input-${Math.random().toString(36).substr(2, 9)}`;

  private onChange = (value: string) => {};
  private onTouched = () => {};

  get hasError(): boolean {
    return !!this.errorMessage;
  }

  writeValue(value: string): void {
    this.value = value || '';
  }

  registerOnChange(fn: (value: string) => void): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: () => void): void {
    this.onTouched = fn;
  }

  setDisabledState(isDisabled: boolean): void {
    this.disabled = isDisabled;
  }

  onInput(event: Event): void {
    const target = event.target as HTMLInputElement;
    this.value = target.value;
    this.onChange(this.value);
  }

  onBlur(): void {
    this.onTouched();
  }

  onFocus(): void {
    // Handle focus events if needed
  }

  getInputClasses(): string {
    return [
      'input',
      this.hasError ? 'input-error' : 'input-default',
      `input-${this.size}`
    ].join(' ');
  }
}