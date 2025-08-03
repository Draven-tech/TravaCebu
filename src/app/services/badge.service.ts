import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

export interface Badge {
  id: string;
  title: string;
  description: string;
  icon: string;
  lockedIcon: string;
  tier: 'bronze' | 'silver' | 'gold' | 'locked';
  progress: number;
  maxProgress: number;
  isUnlocked: boolean;
  achievedAt?: Date;
}

export interface UserBadgeProgress {
  profile_complete: {
    tier: 'bronze' | 'silver' | 'gold' | 'locked';
    progress: number;
    unlocked: boolean;
    achievedAt?: Date;
  };
  bucket_list: {
    tier: 'bronze' | 'silver' | 'gold' | 'locked';
    progress: number;
    unlocked: boolean;
    achievedAt?: Date;
  };
}

@Injectable({
  providedIn: 'root'
})
export class BadgeService {
  
  // Badge definitions
  private readonly BADGE_DEFINITIONS = {
    profile_complete: {
      id: 'profile_complete',
      title: 'Profile Complete',
      description: 'Complete your profile information by filling out your name, username, bio, and uploading a profile picture.',
      icon: 'assets/badges/accountComplete.png',
      lockedIcon: 'assets/badges/lockedAccountComplete.png',
      maxProgress: 100
    },
         bucket_list: {
       id: 'bucket_list',
       title: 'Bucket List Master',
       description: 'Add items to your bucket list to unlock different tiers. 5+ items for Bronze, 15+ for Silver, 25+ for Gold.',
       icon: 'assets/badges/bronzeBucketListBadge.png',
       lockedIcon: 'assets/badges/lockedBucketListBadge.png',
       maxProgress: 25
     }
  };

  constructor(
    private firestore: AngularFirestore,
    private afAuth: AngularFireAuth
  ) {}

  /**
   * Get all available badges for a user
   */
  getUserBadges(userId: string): Observable<Badge[]> {
    return this.getUserBadgeProgress(userId).pipe(
      map(progress => {
        return Object.keys(this.BADGE_DEFINITIONS).map(badgeId => {
          const definition = this.BADGE_DEFINITIONS[badgeId as keyof typeof this.BADGE_DEFINITIONS];
          const userProgress = progress[badgeId as keyof UserBadgeProgress];
          
                     return {
             id: definition.id,
             title: definition.title,
             description: definition.description,
             icon: this.getBadgeIcon(badgeId, userProgress?.tier || 'locked'),
             lockedIcon: definition.lockedIcon,
             tier: userProgress?.tier || 'locked',
             progress: userProgress?.progress || 0,
             maxProgress: definition.maxProgress,
             isUnlocked: userProgress?.unlocked || false,
             achievedAt: userProgress?.achievedAt ? this.convertFirestoreTimestamp(userProgress.achievedAt) : undefined
           };
        });
      })
    );
  }

  /**
   * Get the appropriate badge icon based on badge type and tier
   */
  private getBadgeIcon(badgeId: string, tier: string): string {
    if (badgeId === 'bucket_list') {
      switch (tier) {
        case 'bronze': return 'assets/badges/bronzeBucketListBadge.png';
        case 'silver': return 'assets/badges/silverBucketListBadge.png';
        case 'gold': return 'assets/badges/goldBucketListBadge.png';
        default: return 'assets/badges/lockedBucketListBadge.png';
      }
    }
    
    // Default for other badges
    return this.BADGE_DEFINITIONS[badgeId as keyof typeof this.BADGE_DEFINITIONS]?.icon || '';
  }

  /**
   * Convert Firestore timestamp to JavaScript Date
   */
  private convertFirestoreTimestamp(timestamp: any): Date {
    if (!timestamp) return new Date();
    
    // If it's already a Date object, return it
    if (timestamp instanceof Date) {
      return timestamp;
    }
    
    // If it's a Firestore Timestamp, convert to Date
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
    
    // If it's a timestamp number, create Date from it
    if (typeof timestamp === 'number') {
      return new Date(timestamp);
    }
    
    // If it's a string, try to parse it
    if (typeof timestamp === 'string') {
      return new Date(timestamp);
    }
    
    // Fallback to current date
    return new Date();
  }

  /**
   * Get user's badge progress from Firestore
   */
  getUserBadgeProgress(userId: string): Observable<UserBadgeProgress> {
    return this.firestore.collection('users').doc(userId).valueChanges().pipe(
      map((userData: any) => {
        return userData?.badges || {
          profile_complete: {
            tier: 'locked',
            progress: 0,
            unlocked: false
          },
          bucket_list: {
            tier: 'locked',
            progress: 0,
            unlocked: false
          }
        };
      })
    );
  }

  /**
   * Evaluate and update user's profile completion badge
   */
  async evaluateProfileCompletionBadge(userId: string, userData: any): Promise<void> {
    const isComplete = this.isProfileComplete(userData);
    const progress = isComplete ? 100 : this.calculateProfileProgress(userData);
    
    // Get current badge status - only upgrade, never downgrade
    const currentBadges = userData?.badges?.profile_complete;
    const currentTier = currentBadges?.tier || 'locked';
    const currentUnlocked = currentBadges?.unlocked || false;
    
    // Determine new tier - only upgrade if conditions are met
    let tier: 'bronze' | 'silver' | 'gold' | 'locked' = currentTier;
    let unlocked = currentUnlocked;
    
    if (isComplete && currentTier === 'locked') {
      tier = 'bronze';
      unlocked = true;
    }

    // Only update if upgrading the badge
    if (!currentBadges || 
        (tier !== currentTier) || 
        (progress !== currentBadges.progress) || 
        (unlocked !== currentUnlocked)) {
      await this.updateUserBadge(userId, 'profile_complete', {
        tier,
        progress,
        unlocked,
        achievedAt: unlocked && !currentUnlocked ? new Date() : currentBadges?.achievedAt
      });
    }
  }

  /**
   * Check if user profile is complete
   */
  private isProfileComplete(userData: any): boolean {
    return !!(
      userData?.fullName?.trim() &&
      userData?.username?.trim() &&
      userData?.bio?.trim() &&
      userData?.photoURL &&
      userData?.photoURL !== 'assets/img/default.png'
    );
  }

  /**
   * Calculate profile completion percentage
   */
  private calculateProfileProgress(userData: any): number {
    let completedFields = 0;
    const totalFields = 4;

    if (userData?.fullName?.trim()) completedFields++;
    if (userData?.username?.trim()) completedFields++;
    if (userData?.bio?.trim()) completedFields++;
    if (userData?.photoURL && userData?.photoURL !== 'assets/img/default.png') completedFields++;

    return Math.round((completedFields / totalFields) * 100);
  }

  /**
   * Update user's badge progress in Firestore
   */
  private async updateUserBadge(userId: string, badgeId: string, progress: any): Promise<void> {
    const userRef = this.firestore.collection('users').doc(userId);
    
    await userRef.update({
      [`badges.${badgeId}`]: progress
    });
  }

  /**
   * Get current user's badges
   */
  getCurrentUserBadges(): Observable<Badge[]> {
    return this.afAuth.user.pipe(
      switchMap(user => {
        if (user) {
          return this.getUserBadges(user.uid);
        }
        return of([]);
      })
    );
  }

  /**
   * Evaluate all badges for current user
   */
  async evaluateAllBadges(userId: string, userData: any): Promise<void> {
    await this.evaluateProfileCompletionBadge(userId, userData);
    await this.evaluateBucketListBadge(userId, userData);
  }

  /**
   * Evaluate and update user's bucket list badge
   */
  async evaluateBucketListBadge(userId: string, userData: any): Promise<void> {
    // Query the bucket list sub-collection to get the actual count
    let bucketListCount = 0;
    
    try {
      const bucketListSnapshot = await this.firestore
        .collection(`users/${userId}/bucketList`)
        .get()
        .toPromise();
      
      bucketListCount = bucketListSnapshot?.docs.length || 0;
    } catch (error) {
      console.error('Error getting bucket list count:', error);
      bucketListCount = 0;
    }
    
    console.log('Bucket list count:', bucketListCount);
    
    // Get current badge status - only upgrade, never downgrade
    const currentBadges = userData?.badges?.bucket_list;
    const currentTier = currentBadges?.tier || 'locked';
    const currentUnlocked = currentBadges?.unlocked || false;
    
    // Determine new tier - only upgrade if conditions are met
    let tier: 'bronze' | 'silver' | 'gold' | 'locked' = currentTier;
    let unlocked = currentUnlocked;

    if (bucketListCount >= 25 && currentTier !== 'gold') {
      tier = 'gold';
      unlocked = true;
    } else if (bucketListCount >= 15 && currentTier !== 'silver' && currentTier !== 'gold') {
      tier = 'silver';
      unlocked = true;
    } else if (bucketListCount >= 5 && currentTier === 'locked') {
      tier = 'bronze';
      unlocked = true;
    }

    console.log('Bucket list badge evaluation:', { tier, progress: bucketListCount, unlocked });

    // Only update if upgrading the badge
    if (!currentBadges || 
        (tier !== currentTier) || 
        (bucketListCount !== currentBadges.progress) || 
        (unlocked !== currentUnlocked)) {
      console.log('Updating bucket list badge...');
      await this.updateUserBadge(userId, 'bucket_list', {
        tier,
        progress: bucketListCount,
        unlocked,
        achievedAt: unlocked && !currentUnlocked ? new Date() : currentBadges?.achievedAt
      });
    }
  }
} 