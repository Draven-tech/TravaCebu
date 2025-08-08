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
  photo_enthusiast: {
    tier: 'bronze' | 'silver' | 'gold' | 'locked';
    progress: number;
    unlocked: boolean;
    achievedAt?: Date;
  };
  social_butterfly: {
    tier: 'bronze' | 'silver' | 'gold' | 'locked';
    progress: number;
    unlocked: boolean;
    achievedAt?: Date;
  };
  explorer: {
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
    },
    photo_enthusiast: {
      id: 'photo_enthusiast',
      title: 'Photo Enthusiast',
      description: 'Share photos of your travel experiences to document your adventures. 10+ photos for Bronze, 50+ for Silver, 100+ for Gold.',
      icon: 'assets/badges/bronzePhotoEnthusiastBadge.png',
      lockedIcon: 'assets/badges/lockedPhotoEnthusiastBadge.png',
      maxProgress: 100
    },
    social_butterfly: {
      id: 'social_butterfly',
      title: 'Social Butterfly',
      description: 'Engage with the community through posts and interactions. 5+ posts + 20+ likes + 10+ comments for Bronze, 20+ posts + 50+ likes + 25+ comments for Silver, 50+ posts + 100+ likes + 50+ comments for Gold.',
      icon: 'assets/badges/bronzeSocialButterflyBadge.png',
      lockedIcon: 'assets/badges/lockedSocialButterflyBadge.png',
      maxProgress: 200
    },
    explorer: {
      id: 'explorer',
      title: 'Explorer',
      description: 'Visit different tourist spots in Cebu to unlock exploration achievements. The app automatically detects when you visit spots using GPS. 5+ spots for Bronze, 15+ for Silver, 30+ for Gold.',
      icon: 'assets/badges/bronzeExplorerBadge.png',
      lockedIcon: 'assets/badges/lockedExplorerBadge.png',
      maxProgress: 30
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
    
    if (badgeId === 'photo_enthusiast') {
      switch (tier) {
        case 'bronze': return 'assets/badges/bronzePhotoEnthusiastBadge.png';
        case 'silver': return 'assets/badges/silverPhotoEnthusiastBadge.png';
        case 'gold': return 'assets/badges/goldPhotoEnthusiastBadge.png';
        default: return 'assets/badges/lockedPhotoEnthusiastBadge.png';
      }
    }
    
    if (badgeId === 'social_butterfly') {
      switch (tier) {
        case 'bronze': return 'assets/badges/bronzeSocialButterflyBadge.png';
        case 'silver': return 'assets/badges/silverSocialButterflyBadge.png';
        case 'gold': return 'assets/badges/goldSocialButterflyBadge.png';
        default: return 'assets/badges/lockedSocialButterflyBadge.png';
      }
    }
    
    if (badgeId === 'explorer') {
      switch (tier) {
        case 'bronze': return 'assets/badges/bronzeExplorerBadge.png';
        case 'silver': return 'assets/badges/silverExplorerBadge.png';
        case 'gold': return 'assets/badges/goldExplorerBadge.png';
        default: return 'assets/badges/lockedExplorerBadge.png';
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
          },
          photo_enthusiast: {
            tier: 'locked',
            progress: 0,
            unlocked: false
          },
          social_butterfly: {
            tier: 'locked',
            progress: 0,
            unlocked: false
          },
          explorer: {
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
    await this.evaluatePhotoEnthusiastBadge(userId, userData);
    await this.evaluateSocialButterflyBadge(userId, userData);
    await this.evaluateExplorerBadge(userId, userData);
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

  /**
   * Evaluate and update user's photo enthusiast badge
   */
  async evaluatePhotoEnthusiastBadge(userId: string, userData: any): Promise<void> {
    // Query the posts collection to count posts with images
    let photoCount = 0;
    
    try {
      const postsSnapshot = await this.firestore
        .collection('posts', ref => ref.where('userId', '==', userId))
        .get()
        .toPromise();
      
      // Count posts that have an imageUrl
      photoCount = postsSnapshot?.docs.filter(doc => {
        const postData = doc.data() as any;
        return postData.imageUrl && postData.imageUrl.trim() !== '';
      }).length || 0;
    } catch (error) {
      console.error('Error getting photo count:', error);
      photoCount = 0;
    }
    
    console.log('Photo enthusiast count:', photoCount);
    
    // Get current badge status - only upgrade, never downgrade
    const currentBadges = userData?.badges?.photo_enthusiast;
    const currentTier = currentBadges?.tier || 'locked';
    const currentUnlocked = currentBadges?.unlocked || false;
    
    // Determine new tier - only upgrade if conditions are met
    let tier: 'bronze' | 'silver' | 'gold' | 'locked' = currentTier;
    let unlocked = currentUnlocked;

    if (photoCount >= 100 && currentTier !== 'gold') {
      tier = 'gold';
      unlocked = true;
    } else if (photoCount >= 50 && currentTier !== 'silver' && currentTier !== 'gold') {
      tier = 'silver';
      unlocked = true;
    } else if (photoCount >= 10 && currentTier === 'locked') {
      tier = 'bronze';
      unlocked = true;
    }

    console.log('Photo enthusiast badge evaluation:', { tier, progress: photoCount, unlocked });

    // Only update if upgrading the badge
    if (!currentBadges || 
        (tier !== currentTier) || 
        (photoCount !== currentBadges.progress) || 
        (unlocked !== currentUnlocked)) {
      console.log('Updating photo enthusiast badge...');
      await this.updateUserBadge(userId, 'photo_enthusiast', {
        tier,
        progress: photoCount,
        unlocked,
        achievedAt: unlocked && !currentUnlocked ? new Date() : currentBadges?.achievedAt
      });
    }
  }

  /**
   * Evaluate and update user's social butterfly badge
   */
  async evaluateSocialButterflyBadge(userId: string, userData: any): Promise<void> {
    // Query the posts collection to get user's posts and calculate metrics
    let postsCount = 0;
    let totalLikesReceived = 0;
    let totalCommentsMade = 0;
    
    try {
      // Get user's posts
      const postsSnapshot = await this.firestore
        .collection('posts', ref => ref.where('userId', '==', userId))
        .get()
        .toPromise();
      
      postsCount = postsSnapshot?.docs.length || 0;
      
      // Calculate total likes received on user's posts
      postsSnapshot?.docs.forEach(doc => {
        const postData = doc.data() as any;
        totalLikesReceived += (postData.likes?.length || 0);
      });
      
      // Get all posts to count user's comments
      const allPostsSnapshot = await this.firestore
        .collection('posts')
        .get()
        .toPromise();
      
      // Count comments made by the user
      allPostsSnapshot?.docs.forEach(doc => {
        const postData = doc.data() as any;
        if (postData.comments && Array.isArray(postData.comments)) {
          const userComments = postData.comments.filter((comment: any) => comment.userId === userId);
          totalCommentsMade += userComments.length;
        }
      });
      
    } catch (error) {
      console.error('Error getting social metrics:', error);
      postsCount = 0;
      totalLikesReceived = 0;
      totalCommentsMade = 0;
    }
    
    console.log('Social butterfly metrics:', { postsCount, totalLikesReceived, totalCommentsMade });
    
    // Calculate overall progress (combined score)
    const progress = postsCount + totalLikesReceived + totalCommentsMade;
    
    // Get current badge status - only upgrade, never downgrade
    const currentBadges = userData?.badges?.social_butterfly;
    const currentTier = currentBadges?.tier || 'locked';
    const currentUnlocked = currentBadges?.unlocked || false;
    
    // Determine new tier - only upgrade if conditions are met
    let tier: 'bronze' | 'silver' | 'gold' | 'locked' = currentTier;
    let unlocked = currentUnlocked;

    // Bronze: 5+ posts + 20+ likes + 10+ comments (total 35+)
    // Silver: 20+ posts + 50+ likes + 25+ comments (total 95+)
    // Gold: 50+ posts + 100+ likes + 50+ comments (total 200+)
    if (postsCount >= 50 && totalLikesReceived >= 100 && totalCommentsMade >= 50 && currentTier !== 'gold') {
      tier = 'gold';
      unlocked = true;
    } else if (postsCount >= 20 && totalLikesReceived >= 50 && totalCommentsMade >= 25 && currentTier !== 'silver' && currentTier !== 'gold') {
      tier = 'silver';
      unlocked = true;
    } else if (postsCount >= 5 && totalLikesReceived >= 20 && totalCommentsMade >= 10 && currentTier === 'locked') {
      tier = 'bronze';
      unlocked = true;
    }

    console.log('Social butterfly badge evaluation:', { tier, progress, unlocked, postsCount, totalLikesReceived, totalCommentsMade });

    // Only update if upgrading the badge
    if (!currentBadges || 
        (tier !== currentTier) || 
        (progress !== currentBadges.progress) || 
        (unlocked !== currentUnlocked)) {
      console.log('Updating social butterfly badge...');
      await this.updateUserBadge(userId, 'social_butterfly', {
        tier,
        progress,
        unlocked,
        achievedAt: unlocked && !currentUnlocked ? new Date() : currentBadges?.achievedAt
      });
    }
  }

  /**
   * Evaluate and update user's explorer badge based on location visits
   */
  async evaluateExplorerBadge(userId: string, userData: any): Promise<void> {
    let uniqueSpotsVisited = 0;
    
    try {
      // Get user's visited spots from their profile
      const userDoc = await this.firestore.collection('users').doc(userId).get().toPromise();
      const userDataFromFirestore = userDoc?.data() as any;
      
      // Count unique visited spots
      if (userDataFromFirestore?.visitedSpots) {
        uniqueSpotsVisited = Object.keys(userDataFromFirestore.visitedSpots).length;
      }
      
    } catch (error) {
      console.error('Error getting visited spots:', error);
      uniqueSpotsVisited = 0;
    }
    
    console.log('Unique spots visited (location-based):', uniqueSpotsVisited);
    
    // Get current badge status - only upgrade, never downgrade
    const currentBadges = userData?.badges?.explorer;
    const currentTier = currentBadges?.tier || 'locked';
    const currentUnlocked = currentBadges?.unlocked || false;
    
    // Determine new tier - only upgrade if conditions are met
    let tier: 'bronze' | 'silver' | 'gold' | 'locked' = currentTier;
    let unlocked = currentUnlocked;

    if (uniqueSpotsVisited >= 30 && currentTier !== 'gold') {
      tier = 'gold';
      unlocked = true;
    } else if (uniqueSpotsVisited >= 15 && currentTier !== 'silver' && currentTier !== 'gold') {
      tier = 'silver';
      unlocked = true;
    } else if (uniqueSpotsVisited >= 5 && currentTier === 'locked') {
      tier = 'bronze';
      unlocked = true;
    }

    console.log('Explorer badge evaluation (location-based):', { tier, progress: uniqueSpotsVisited, unlocked });

    // Only update if upgrading the badge
    if (!currentBadges || 
        (tier !== currentTier) || 
        (uniqueSpotsVisited !== currentBadges.progress) || 
        (unlocked !== currentUnlocked)) {
      console.log('Updating explorer badge (location-based)...');
      await this.updateUserBadge(userId, 'explorer', {
        tier,
        progress: uniqueSpotsVisited,
        unlocked,
        achievedAt: unlocked && !currentUnlocked ? new Date() : currentBadges?.achievedAt
      });
    }
  }

  /**
   * Check if user is near a tourist spot and record the visit
   */
  async checkProximityAndRecordVisit(userId: string, userLocation: { lat: number, lng: number }): Promise<void> {
    try {
      // Get all tourist spots
      const spotsSnapshot = await this.firestore.collection('tourist_spots').get().toPromise();
      const touristSpots = spotsSnapshot?.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as any)
      })) || [];

      // Check proximity to each spot (100 meters radius)
      const proximityRadius = 100; // meters
      let newVisitRecorded = false;

      for (const spot of touristSpots) {
        if (spot.location && spot.location.lat && spot.location.lng) {
          const distance = this.getDistance(userLocation, spot.location);
          
          if (distance <= proximityRadius) {
            // User is near this spot, record the visit
            const visitRecorded = await this.recordSpotVisit(userId, spot.id, spot.name);
            if (visitRecorded) {
              newVisitRecorded = true;
              console.log(`📍 User visited ${spot.name} (${distance.toFixed(0)}m away)`);
            }
          }
        }
      }

      // If a new visit was recorded, evaluate the explorer badge
      if (newVisitRecorded) {
        const userDoc = await this.firestore.collection('users').doc(userId).get().toPromise();
        const userData = userDoc?.data() as any;
        await this.evaluateExplorerBadge(userId, userData);
      }

    } catch (error) {
      console.error('Error checking proximity and recording visits:', error);
    }
  }

  /**
   * Record a spot visit for a user
   */
  private async recordSpotVisit(userId: string, spotId: string, spotName: string): Promise<boolean> {
    try {
      const userRef = this.firestore.collection('users').doc(userId);
      const userDoc = await userRef.get().toPromise();
      const userData = userDoc?.data() as any;

      // Initialize visitedSpots if it doesn't exist
      const visitedSpots = userData?.visitedSpots || {};

      // Check if this spot was already visited
      if (visitedSpots[spotId]) {
        return false; // Already visited
      }

      // Record the visit with timestamp
      visitedSpots[spotId] = {
        spotName: spotName,
        visitedAt: new Date(),
        location: userData?.location || null
      };

      // Update user document
      await userRef.update({
        visitedSpots: visitedSpots
      });

      console.log(`✅ Recorded visit to ${spotName} for user ${userId}`);
      return true;

    } catch (error) {
      console.error('Error recording spot visit:', error);
      return false;
    }
  }

  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  private getDistance(point1: { lat: number, lng: number }, point2: { lat: number, lng: number }): number {
    const R = 6371e3; // Earth's radius in meters
    const toRad = (x: number) => x * Math.PI / 180;
    const dLat = toRad(point2.lat - point1.lat);
    const dLng = toRad(point2.lng - point1.lng);
    const lat1 = toRad(point1.lat);
    const lat2 = toRad(point2.lat);
    const aVal = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
    return R * c;
  }
} 