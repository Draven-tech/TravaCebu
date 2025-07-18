import { Injectable } from '@angular/core';

@Injectable({
  providedIn: 'root'
})
export class BucketService {
  private storageKey = 'bucketList';

  constructor() {}

  getBucket(): any[] {
    const raw = localStorage.getItem(this.storageKey);
    return raw ? JSON.parse(raw) : [];
  }

  addToBucket(spot: any): void {
    const current = this.getBucket();
    const exists = current.find((s: any) => s.id === spot.id);
    if (!exists) {
      current.push(spot);
      localStorage.setItem(this.storageKey, JSON.stringify(current));
    }
  }

  removeFromBucket(id: string): void {
    const current = this.getBucket().filter((s: any) => s.id !== id);
    localStorage.setItem(this.storageKey, JSON.stringify(current));
  }

  clearBucket(): void {
    localStorage.removeItem(this.storageKey);
  }

  // Add method to get all spot IDs in the bucket list
  getBucketSpotIds(): string[] {
    return this.getBucket().map(spot => spot.id);
  }
}
