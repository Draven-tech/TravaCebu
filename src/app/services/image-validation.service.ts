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

      // Set timeout
      const timeout = setTimeout(() => {
        cleanup();
        this.cacheValidation(url, false);
        resolve(false);
      }, timeoutMs);

      // Clear timeout if image loads
      img.onload = () => {
        clearTimeout(timeout);
        cleanup();
        this.cacheValidation(url, true);
        resolve(true);
      };

      img.src = url;
    });
  }

  /**
   * Validates multiple image URLs in parallel
   * @param urls Array of image URLs to validate
   * @param timeoutMs Timeout in milliseconds for each image
   * @returns Promise<Map<string, boolean>> - Map of URL to validation result
   */
  async validateMultipleImages(urls: string[], timeoutMs: number = 5000): Promise<Map<string, boolean>> {
    const results = new Map<string, boolean>();
    
    const validationPromises = urls.map(async (url) => {
      const isValid = await this.validateImageUrl(url, timeoutMs);
      results.set(url, isValid);
    });

    await Promise.all(validationPromises);
    return results;
  }

  /**
   * Checks if a Google Places photo reference is likely to be broken
   * @param photoReference The Google Places photo reference
   * @returns boolean - true if likely broken
   */
  isLikelyBrokenPhotoReference(photoReference: string): boolean {
    // Google Places photo references should be long strings
    if (!photoReference || photoReference.length < 50) {
      return true;
    }

    // Check for common patterns that indicate broken references
    const brokenPatterns = [
      /^[0-9]+$/, // Only numbers
      /^[a-zA-Z]+$/, // Only letters
      /^.{1,20}$/, // Too short
    ];

    return brokenPatterns.some(pattern => pattern.test(photoReference));
  }

  /**
   * Generates a fallback image URL for broken Google Places images
   * @param placeName The name of the place
   * @returns string - Fallback image URL
   */
  getFallbackImageUrl(placeName: string): string {
    // You can implement various fallback strategies here
    // For now, return a placeholder service URL
    const encodedName = encodeURIComponent(placeName);
    return `https://via.placeholder.com/400x300/cccccc/666666?text=${encodedName}`;
  }

  /**
   * Clears the validation cache
   */
  clearCache(): void {
    this.validationCache.clear();
  }

  /**
   * Clears expired entries from the cache
   */
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
