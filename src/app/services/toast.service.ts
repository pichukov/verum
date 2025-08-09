import { Injectable, signal } from '@angular/core';

export interface Toast {
  id: string;
  type: 'success' | 'error' | 'warning' | 'info';
  title?: string;
  message: string;
  duration?: number;
  dismissible?: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class ToastService {
  private _toasts = signal<Toast[]>([]);
  public readonly toasts = this._toasts.asReadonly();

  private generateId(): string {
    return Math.random().toString(36).substr(2, 9);
  }

  public show(toast: Omit<Toast, 'id'>): string {
    const id = this.generateId();
    const newToast: Toast = {
      id,
      dismissible: true,
      duration: 5000,
      ...toast
    };

    this._toasts.update(toasts => [...toasts, newToast]);

    // Auto dismiss if duration is set
    if (newToast.duration && newToast.duration > 0) {
      setTimeout(() => {
        this.dismiss(id);
      }, newToast.duration);
    }

    return id;
  }

  public success(message: string, title?: string): string {
    return this.show({
      type: 'success',
      title,
      message
    });
  }

  public error(message: string, title?: string): string {
    return this.show({
      type: 'error',
      title,
      message,
      duration: 8000 // Longer duration for errors
    });
  }

  public warning(message: string, title?: string): string {
    return this.show({
      type: 'warning',
      title,
      message
    });
  }

  public info(message: string, title?: string): string {
    return this.show({
      type: 'info',
      title,
      message
    });
  }

  public dismiss(id: string): void {
    this._toasts.update(toasts => toasts.filter(toast => toast.id !== id));
  }

  public clear(): void {
    this._toasts.set([]);
  }
}