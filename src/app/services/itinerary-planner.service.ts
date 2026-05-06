import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { BadgeService } from './badge.service';

@Injectable({
  providedIn: 'root'
})
export class ItineraryPlannerService {
  private plannerSpotIds = new Set<string>();

  constructor(
    private firestore: AngularFirestore,
    private afAuth: AngularFireAuth,
    private badgeService: BadgeService
  ) { }

  // 🔐 Get current user ID
  private async getCurrentUserId(): Promise<string | null> {
    const user = await this.afAuth.currentUser;
    return user?.uid || null;
  }

  async getPlannerSpots(): Promise<any[]> {
    const userId = await this.getCurrentUserId();
    if (!userId) return [];

    try {
      const doc = await this.firestore.collection('users').doc(userId).get().toPromise();
      const data = doc?.data() as any;
      const spots = Array.isArray(data?.plannerDraftSpots) ? data.plannerDraftSpots : [];
      this.updatePlannerSpotCache(spots);
      return spots;
    } catch (error) {
      console.error('Error getting planner spots:', error);
      return [];
    }
  }

  async setPlannerSpots(spots: any[]): Promise<void> {
    const userId = await this.getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');

    await this.firestore.collection('users').doc(userId).set(
      {
        plannerDraftSpots: Array.isArray(spots) ? spots : [],
        plannerDraftUpdatedAt: new Date()
      },
      { merge: true }
    );
    this.updatePlannerSpotCache(spots);
  }

  isInPlanner(spotId: string): boolean {
    return this.plannerSpotIds.has(spotId);
  }

  private updatePlannerSpotCache(spots: any[]): void {
    this.plannerSpotIds = new Set(
      (Array.isArray(spots) ? spots : [])
        .map((spot: any) => spot?.id)
        .filter((id: any): id is string => typeof id === 'string' && id.length > 0)
    );
  }

  async addSpotToPlanner(spot: any): Promise<boolean> {
    const spots = await this.getPlannerSpots();
    const exists = spots.some((s: any) => s?.id === spot?.id);
    if (exists) return false;

    const newSpot = {
      id: spot.id,
      name: spot.name,
      img: spot.img,
      category: spot.category,
      location: spot.location,
      description: spot.description
    };

    await this.setPlannerSpots([...spots, newSpot]);
    return true;
  }

  async removeSpotFromPlanner(spotId: string): Promise<void> {
    const spots = await this.getPlannerSpots();
    const filtered = spots.filter((s: any) => s?.id !== spotId);
    await this.setPlannerSpots(filtered);
  }

  async clearPlannerSpots(): Promise<void> {
    await this.setPlannerSpots([]);
  }

  // 🆕 CREATE itinerary
  async createItinerary(data: any): Promise<string> {
    const userId = await this.getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');

    const docRef = this.firestore
      .collection(`users/${userId}/itineraries`)
      .doc(); // auto ID

    const itinerary = {
      name: data.name?.trim() || `My Trip`,
      createdAt: new Date(),
      startDate: data.startDate || null,
      days: data.days || 1,
      spots: [], // initially empty
      ...data
    };

    await docRef.set(itinerary);

    await this.triggerBadgeEvaluation(userId);
    const itineraryId = docRef.ref.id;
    
    return docRef.ref.id;
  }

  async getItineraries(): Promise<any[]> {
    const userId = await this.getCurrentUserId();
    if (!userId) return [];

    try {
      const snapshot = await this.firestore
        .collection(`users/${userId}/itineraries`)
        .get()
        .toPromise();

      return snapshot?.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as any)
      })) || [];

    } catch (error) {
      console.error('Error getting itineraries:', error);
      return [];
    }
  }

  // 📄 GET single itinerary
  async getItineraryById(itineraryId: string): Promise<any | null> {
    const userId = await this.getCurrentUserId();
    if (!userId) return null;

    try {
      const doc = await this.firestore
        .collection(`users/${userId}/itineraries`)
        .doc(itineraryId)
        .get()
        .toPromise();

      return doc?.exists ? { id: doc.id, ...(doc.data() as any) } : null;

    } catch (error) {
      console.error('Error getting itinerary:', error);
      return null;
    }
  }

  // ➕ ADD spot to itinerary
  async addSpotToItinerary(itineraryId: string, spot: any, day: number): Promise<void> {
    const userId = await this.getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');

    const itineraryRef = this.firestore
      .collection(`users/${userId}/itineraries`)
      .doc(itineraryId);

    try {
      const doc = await itineraryRef.get().toPromise();
      const data = doc?.data() as any;

      const spots = data?.spots || [];

      // Prevent duplicate spots in same itinerary
      const exists = spots.some((s: any) => s.spotId === spot.id);
      if (exists) return;

      const newSpot = {
        spotId: spot.id,
        name: spot.name,
        img: spot.img,
        location: spot.location,
        category: spot.category,
        day: day,
        addedAt: new Date(),
        ...spot
      };

      await itineraryRef.update({
        spots: [...spots, newSpot]
      });

      await this.triggerBadgeEvaluation(userId);

    } catch (error) {
      console.error('Error adding spot:', error);
      throw error;
    }
  }

  // ❌ REMOVE spot from itinerary
  async removeSpotFromItinerary(itineraryId: string, spotId: string): Promise<void> {
    const userId = await this.getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');

    const itineraryRef = this.firestore
      .collection(`users/${userId}/itineraries`)
      .doc(itineraryId);

    try {
      const doc = await itineraryRef.get().toPromise();
      const data = doc?.data() as any;

      const updatedSpots = (data?.spots || []).filter(
        (s: any) => s.spotId !== spotId
      );

      await itineraryRef.update({
        spots: updatedSpots
      });

      await this.triggerBadgeEvaluation(userId);

    } catch (error) {
      console.error('Error removing spot:', error);
      throw error;
    }
  }

  // 🔄 UPDATE spot day (drag & drop support later)
  async updateSpotDay(itineraryId: string, spotId: string, newDay: number): Promise<void> {
    const userId = await this.getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');

    const itineraryRef = this.firestore
      .collection(`users/${userId}/itineraries`)
      .doc(itineraryId);

    try {
      const doc = await itineraryRef.get().toPromise();
      const data = doc?.data() as any;

      const updatedSpots = (data?.spots || []).map((s: any) => {
        if (s.spotId === spotId) {
          return { ...s, day: newDay };
        }
        return s;
      });

      await itineraryRef.update({
        spots: updatedSpots
      });

    } catch (error) {
      console.error('Error updating spot day:', error);
      throw error;
    }
  }

  // 🧹 DELETE itinerary
  async deleteItinerary(itineraryId: string): Promise<void> {
    const userId = await this.getCurrentUserId();
    if (!userId) throw new Error('User not authenticated');

    try {
      await this.firestore
        .collection(`users/${userId}/itineraries`)
        .doc(itineraryId)
        .delete();

      await this.triggerBadgeEvaluation(userId);

    } catch (error) {
      console.error('Error deleting itinerary:', error);
      throw error;
    }
  }

  // 🔢 COUNT itineraries
  async getItineraryCount(): Promise<number> {
    const itineraries = await this.getItineraries();
    return itineraries.length;
  }

  // 🏆 Badge trigger (same pattern as bucket)
  private async triggerBadgeEvaluation(userId: string): Promise<void> {
    try {
      const userDoc = await this.firestore
        .collection('users')
        .doc(userId)
        .get()
        .toPromise();

      const userData = userDoc?.data();

      if (userData) {
        await this.badgeService.evaluateAllBadges(userId, userData);
      }

    } catch (error) {
      console.error('Error triggering badge evaluation:', error);
    }
  }
    async clearItinerary(): Promise<void> {
    const userId = await this.getCurrentUserId();
    if (!userId) {
      throw new Error('User not authenticated');
    }

    try {
      const batch = this.firestore.firestore.batch();
      const bucketListRef = this.firestore.collection(`users/${userId}/itineraries`);
      
      const snapshot = await bucketListRef.get().toPromise();
      snapshot?.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      
      await batch.commit();
      
      // Trigger badge evaluation after clearing bucket list
      await this.triggerBadgeEvaluation(userId);
    } catch (error) {
      console.error('Error clearing itinerary', error);
      throw error;
    }
  }

  async clearSpotsFromItinerary(itineraryId: string): Promise<void> {
  const userId = await this.getCurrentUserId();
  if (!userId) throw new Error('User not authenticated');

  try {
    await this.firestore
      .collection(`users/${userId}/itineraries`)
      .doc(itineraryId)
      .update({
        spots: []
      });

  } catch (error) {
    console.error('Error clearing spots:', error);
    throw error;
  }
}
}