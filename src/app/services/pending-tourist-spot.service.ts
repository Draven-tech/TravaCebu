import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Observable } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

export interface PendingTouristSpot {
  id?: string;
  name: string;
  description: string;
  category: string;
  location: {
    lat: number;
    lng: number;
  };
  img: string;
  googlePlaceId?: string;
  rating?: number;
  userRatingsTotal?: number;
  submittedBy: string; // User ID
  submittedByEmail?: string; // User email for admin reference
  status: 'pending' | 'approved' | 'rejected';
  submittedAt: Date;
  reviewedAt?: Date;
  reviewedBy?: string; // Admin ID
  reviewNotes?: string; // Admin notes for rejection
}

@Injectable({
  providedIn: 'root'
})
export class PendingTouristSpotService {

  constructor(
    private firestore: AngularFirestore,
    private afAuth: AngularFireAuth
  ) { }

  /**
   * Submit a new tourist spot for approval
   */
  async submitForApproval(spotData: Omit<PendingTouristSpot, 'id' | 'submittedBy' | 'submittedByEmail' | 'status' | 'submittedAt'>): Promise<void> {
    try {
      const user = await this.afAuth.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }

      const pendingSpot: PendingTouristSpot = {
        ...spotData,
        submittedBy: user.uid,
        submittedByEmail: user.email || '',
        status: 'pending',
        submittedAt: new Date()
      };

      await this.firestore.collection('pending_tourist_spots').add(pendingSpot);
    } catch (error) {
      console.error('Error submitting tourist spot for approval:', error);
      throw error;
    }
  }

  /**
   * Get all pending tourist spots (admin only)
   */
  getPendingSpots(): Observable<PendingTouristSpot[]> {
    return this.firestore
      .collection<PendingTouristSpot>('pending_tourist_spots', ref => 
        ref.where('status', '==', 'pending')
      )
      .valueChanges({ idField: 'id' }).pipe(
        map(spots => spots.sort((a, b) => {
          const dateA = a.submittedAt instanceof Date ? a.submittedAt : new Date(a.submittedAt);
          const dateB = b.submittedAt instanceof Date ? b.submittedAt : new Date(b.submittedAt);
          return dateB.getTime() - dateA.getTime();
        }))
      );
  }

  /**
   * Get all tourist spots by status (admin only)
   */
  getSpotsByStatus(status: 'pending' | 'approved' | 'rejected'): Observable<PendingTouristSpot[]> {
    return this.firestore
      .collection<PendingTouristSpot>('pending_tourist_spots', ref => 
        ref.where('status', '==', status)
      )
      .valueChanges({ idField: 'id' }).pipe(
        map(spots => spots.sort((a, b) => {
          const dateA = a.submittedAt instanceof Date ? a.submittedAt : new Date(a.submittedAt);
          const dateB = b.submittedAt instanceof Date ? b.submittedAt : new Date(b.submittedAt);
          return dateB.getTime() - dateA.getTime();
        }))
      );
  }

  /**
   * Get user's submitted spots
   */
  getUserSubmittedSpots(): Observable<PendingTouristSpot[]> {
    return this.afAuth.user.pipe(
      switchMap(user => {
        if (!user) return [];
        
        return this.firestore
          .collection<PendingTouristSpot>('pending_tourist_spots', ref => 
            ref.where('submittedBy', '==', user.uid)
          )
          .valueChanges({ idField: 'id' }).pipe(
            map(spots => spots.sort((a, b) => {
              const dateA = a.submittedAt instanceof Date ? a.submittedAt : new Date(a.submittedAt);
              const dateB = b.submittedAt instanceof Date ? b.submittedAt : new Date(b.submittedAt);
              return dateB.getTime() - dateA.getTime();
            }))
          );
      })
    );
  }

  /**
   * Approve a tourist spot (admin only)
   */
  async approveSpot(spotId: string, reviewNotes?: string): Promise<void> {
    try {
      const user = await this.afAuth.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }

      const spotRef = this.firestore.collection('pending_tourist_spots').doc(spotId);
      const spotDoc = await spotRef.get().toPromise();
      
      if (!spotDoc?.exists) {
        throw new Error('Spot not found');
      }

      const spotData = spotDoc.data() as PendingTouristSpot;

      // Update the pending spot status
      await spotRef.update({
        status: 'approved',
        reviewedAt: new Date(),
        reviewedBy: user.uid,
        reviewNotes: reviewNotes || ''
      });

      // Add to approved tourist spots collection
      const approvedSpotData = {
        name: spotData.name,
        description: spotData.description,
        category: spotData.category,
        location: spotData.location,
        img: spotData.img,
        googlePlaceId: spotData.googlePlaceId,
        rating: spotData.rating || 0,
        userRatingsTotal: spotData.userRatingsTotal || 0,
        createdAt: spotData.submittedAt,
        updatedAt: new Date(),
        approvedFrom: spotId, // Reference to original submission
        approvedBy: user.uid,
        approvedAt: new Date()
      };

      await this.firestore.collection('tourist_spots').add(approvedSpotData);
    } catch (error) {
      console.error('Error approving tourist spot:', error);
      throw error;
    }
  }

  /**
   * Reject a tourist spot (admin only)
   */
  async rejectSpot(spotId: string, reviewNotes: string): Promise<void> {
    try {
      const user = await this.afAuth.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }

      await this.firestore.collection('pending_tourist_spots').doc(spotId).update({
        status: 'rejected',
        reviewedAt: new Date(),
        reviewedBy: user.uid,
        reviewNotes: reviewNotes
      });
    } catch (error) {
      console.error('Error rejecting tourist spot:', error);
      throw error;
    }
  }

  /**
   * Delete a pending spot (admin only)
   */
  async deletePendingSpot(spotId: string): Promise<void> {
    try {
      await this.firestore.collection('pending_tourist_spots').doc(spotId).delete();
    } catch (error) {
      console.error('Error deleting pending tourist spot:', error);
      throw error;
    }
  }

  /**
   * Get spot by ID
   */
  getSpotById(spotId: string): Observable<PendingTouristSpot | undefined> {
    return this.firestore
      .collection<PendingTouristSpot>('pending_tourist_spots')
      .doc(spotId)
      .valueChanges({ idField: 'id' });
  }

  /**
   * Get count of pending spots (admin only)
   */
  getPendingCount(): Observable<number> {
    return this.firestore
      .collection<PendingTouristSpot>('pending_tourist_spots', ref => 
        ref.where('status', '==', 'pending')
      )
      .valueChanges()
      .pipe(
        map(spots => spots.length)
      );
  }
}
