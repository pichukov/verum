import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ScrollService {
  
  /**
   * Scroll to an element with retry logic
   * @param selector CSS selector or element reference
   * @param options Scroll options and retry configuration
   */
  public scrollToElement(
    selector: string | HTMLElement,
    options: {
      behavior?: ScrollBehavior;
      block?: ScrollLogicalPosition;
      inline?: ScrollLogicalPosition;
      maxRetries?: number;
      retryDelay?: number;
    } = {}
  ): Promise<boolean> {
    const {
      behavior = 'smooth',
      block = 'center',
      inline = 'nearest',
      maxRetries = 10,
      retryDelay = 50
    } = options;

    return new Promise((resolve) => {
      let attempts = 0;

      const tryScroll = () => {
        attempts++;
        
        // Get the element
        const element = typeof selector === 'string' 
          ? document.querySelector(selector) as HTMLElement
          : selector;

        // If element found, scroll to it
        if (element) {
          element.scrollIntoView({
            behavior,
            block,
            inline
          });
          resolve(true);
          return;
        }

        // If not found and haven't exceeded max attempts, try again
        if (attempts < maxRetries) {
          setTimeout(tryScroll, retryDelay);
        } else {
          console.warn(`Could not find element after ${maxRetries} attempts:`, selector);
          resolve(false);
        }
      };

      // Start trying immediately
      tryScroll();
    });
  }

  /**
   * Scroll to loading indicator specifically
   */
  public async scrollToLoadingIndicator(): Promise<boolean> {
    return this.scrollToElement('.loading-state', {
      behavior: 'smooth',
      block: 'center'
    });
  }

  /**
   * Scroll to top of page
   */
  public scrollToTop(smooth: boolean = true): void {
    window.scrollTo({
      top: 0,
      behavior: smooth ? 'smooth' : 'auto'
    });
  }

  /**
   * Scroll to a specific position
   */
  public scrollToPosition(x: number, y: number, smooth: boolean = true): void {
    window.scrollTo({
      left: x,
      top: y,
      behavior: smooth ? 'smooth' : 'auto'
    });
  }

  /**
   * Get current scroll position
   */
  public getScrollPosition(): { x: number; y: number } {
    return {
      x: window.pageXOffset || document.documentElement.scrollLeft,
      y: window.pageYOffset || document.documentElement.scrollTop
    };
  }

  /**
   * Check if element is in viewport
   */
  public isElementInViewport(element: HTMLElement): boolean {
    const rect = element.getBoundingClientRect();
    return (
      rect.top >= 0 &&
      rect.left >= 0 &&
      rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) &&
      rect.right <= (window.innerWidth || document.documentElement.clientWidth)
    );
  }

  /**
   * Scroll to element only if it's not already in viewport
   */
  public async scrollToElementIfNeeded(
    selector: string | HTMLElement,
    options: Parameters<typeof this.scrollToElement>[1] = {}
  ): Promise<boolean> {
    const element = typeof selector === 'string'
      ? document.querySelector(selector) as HTMLElement
      : selector;

    if (element && !this.isElementInViewport(element)) {
      return this.scrollToElement(element, options);
    }

    return Promise.resolve(false);
  }
}