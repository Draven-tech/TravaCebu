import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class ImageValidationService {
  private validationCache = new Map<string, { isValid: boolean; timestamp: Date }>();
  private readonly CACHE_DURATION_MS = 5 * 60 * 1000; // 5 minutes

  constructor() {}

  /**
   * Validates if an image URL is accessible
   * @param url The image URL to validate
   * @param timeoutMs Timeout in milliseconds (default: 5000)
   * @returns Promise<boolean> - true if image loads successfully
   */
  async validateImageUrl(url: string, timeoutMs: number = 5000): Promise<boolean> {
    // Check cache first
    const cached = this.validationCache.get(url);
    if (cached && this.isCacheValid(cached.timestamp)) {
      return cached.isValid;
    }

    return new Promise((resolve) => {
      const img = new Image();
      
      const cleanup = () => {
        img.onload = null;
        img.onerror = null;
      };

      img.onload = () => {
        cleanup();
        this.cacheValidation(url, true);
        resolve(true);
      };

      img.onerror = () => {
        cleanup();
        this.cacheValidation(url, false);
        resolve(false);
      };

      const timeout = setTimeout(() => {
        cleanup();
        this.cacheValidation(url, false);
        resolve(false);
      }, timeoutMs);

      img.onload = () => {
        clearTimeout(timeout);
        cleanup();
        this.cacheValidation(url, true);
        resolve(true);
      };

      img.src = url;
    });
  }

  async validateMultipleImages(urls: string[], timeoutMs: number = 5000): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    
    const validationPromises = urls.map(async (url) => {
      const isValid = await this.validateImageUrl(url, timeoutMs);
      results.set(url, isValid);
    });

    await Promise.all(validationPromises);
    return results;
  }

  isLikelyBrokenPhotoReference(photoReference: string): boolean {
    if (!photoReference || photoReference.length < 50) {
      return true;
    }
    const brokenPatterns = [
      /^[0-9]+$/, 
      /^[a-zA-Z]+$/,
      /^.{1,20}$/,
    ];

    return brokenPatterns.some(pattern => pattern.test(photoReference));
  }

  getFallbackImageUrl(placeName: string): string {
    const encodedName = encodeURIComponent(placeName);
    return `https://via.placeholder.com/400x300/cccccc/666666?text=${encodedName}`;
  }

  clearCache(): void {
    this.validationCache.clear();
  }

  clearExpiredCache(): void {
    const now = new Date();
    for (const [url, data] of this.validationCache.entries()) {
      if (!this.isCacheValid(data.timestamp)) {
        this.validationCache.delete(url);
      }
    }
  }

  private cacheValidation(url: string, isValid: boolean): void {
    this.validationCache.set(url, {
      isValid,
      timestamp: new Date()
    });
  }

  private isCacheValid(timestamp: Date): boolean {
    const now = new Date();
    return (now.getTime() - timestamp.getTime()) < this.CACHE_DURATION_MS;
  }
}
