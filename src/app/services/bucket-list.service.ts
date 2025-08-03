import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { BadgeService } from './badge.service';

@Injectable({
  providedIn: 'root'
})
export class BucketService {
  constructor(
    private firestore: AngularFirestore,
    private afAuth: AngularFireAuth,
    private badgeService: BadgeService
  ) {}

  // Get current user ID
  private async getCurrentUserId(): Promise<string | null> {
    const user = await this.afAuth.currentUser;
    return user?.uid || null;
  }

  // Get user's bucket list
  async getBucket(): Promise<any[]> {
    const userId = await this.getCurrentUserId();
    if (!userId) {
      return [];
    }

    try {
      const snapshot = await this.firestore
        .collection(`users/${userId}/bucketList`)
        .get()
        .toPromise();
      
      return snapshot?.docs.map(doc => ({ ...(doc.data() as any), id: doc.id })) || [];
    } catch (error) {
      console.error('Error getting bucket list:', error);
      return [];
    }
  }

  // Add spot to user's bucket list
  async addToBucket(spot: any): Promise<void> {
    const userId = await this.getCurrentUserId();
    if (!userId) {
      throw new Error('User not authenticated');
    }

    const bucketItem = {
      spotId: spot.id,
      name: spot.name,
      img: spot.img,
      category: spot.category,
      location: spot.location,
      description: spot.description,
      addedAt: new Date(),
      // Keep original spot data for compatibility
      ...spot
    };

    try {
      await this.firestore
        .collection(`users/${userId}/bucketList`)
        .doc(spot.id)
        .set(bucketItem);
      
      // Trigger badge evaluation after adding item
      await this.triggerBadgeEvaluation(userId);
    } catch (error) {
      console.error('Error adding to bucket list:', error);
      throw error;
    }
  }

  // Remove spot from user's bucket list
  async removeFromBucket(spotId: string): Promise<void> {
    const userId = await this.getCurrentUserId();
    if (!userId) {
      throw new Error('User not authenticated');
    }

    try {
      await this.firestore
        .collection(`users/${userId}/bucketList`)
        .doc(spotId)
        .delete();
      
      // Trigger badge evaluation after removing item
      await this.triggerBadgeEvaluation(userId);
    } catch (error) {
      console.error('Error removing from bucket list:', error);
      throw error;
    }
  }

  // Clear user's entire bucket list
  async clearBucket(): Promise<void> {
    const userId = await this.getCurrentUserId();
    if (!userId) {
      throw new Error('User not authenticated');
    }

    try {
      const batch = this.firestore.firestore.batch();
      const bucketListRef = this.firestore.collection(`users/${userId}/bucketList`);
      
      const snapshot = await bucketListRef.get().toPromise();
      snapshot?.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      
      // Trigger badge evaluation after clearing bucket list
      await this.triggerBadgeEvaluation(userId);
    } catch (error) {
      console.error('Error clearing bucket list:', error);
      throw error;
    }
  }

  // Get all spot IDs in user's bucket list
  async getBucketSpotIds(): Promise<string[]> {
    const bucket = await this.getBucket();
    return bucket.map(spot => spot.spotId || spot.id);
  }

  // Check if a spot is in user's bucket list
  async isInBucket(spotId: string): Promise<boolean> {
    const spotIds = await this.getBucketSpotIds();
    return spotIds.includes(spotId);
  }

  // Get bucket list count
  async getBucketCount(): Promise<number> {
    const bucket = await this.getBucket();
    return bucket.length;
  }

  // Trigger badge evaluation after bucket list changes
  private async triggerBadgeEvaluation(userId: string): Promise<void> {
    try {
      // Get current user data
      const userDoc = await this.firestore.collection('users').doc(userId).get().toPromise();
      const userData = userDoc?.data();
      
      if (userData) {
        // Trigger badge evaluation
        await this.badgeService.evaluateAllBadges(userId, userData);
        console.log('Badge evaluation triggered after bucket list change');
      }
    } catch (error) {
      console.error('Error triggering badge evaluation:', error);
    }
  }
}
