import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';

export interface TierHistoryRow {
  tier: 'bronze' | 'silver' | 'gold' | 'profile_complete';
  at: Date;
}

export interface TierAchievedAtStored {
  bronze?: any;
  silver?: any;
  gold?: any;
}

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
  /** Metal badges: per-tier dates. Profile Complete: one row when unlocked. */
  tierHistory: TierHistoryRow[];
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
    tierAchievedAt?: TierAchievedAtStored;
  };
  photo_enthusiast: {
    tier: 'bronze' | 'silver' | 'gold' | 'locked';
    progress: number;
    unlocked: boolean;
    achievedAt?: Date;
    tierAchievedAt?: TierAchievedAtStored;
  };
  social_butterfly: {
    tier: 'bronze' | 'silver' | 'gold' | 'locked';
    progress: number;
    unlocked: boolean;
    achievedAt?: Date;
    tierAchievedAt?: TierAchievedAtStored;
  };
  explorer: {
    tier: 'bronze' | 'silver' | 'gold' | 'locked';
    progress: number;
    unlocked: boolean;
    achievedAt?: Date;
    tierAchievedAt?: TierAchievedAtStored;
  };
}

const METAL_TIER_BADGE_ID_LIST = ['bucket_list', 'photo_enthusiast', 'social_butterfly', 'explorer'] as const;

export function isMetalTierBadgeId(badgeId: string): boolean {
  return (METAL_TIER_BADGE_ID_LIST as readonly string[]).includes(badgeId);
}

@Injectable({
  providedIn: 'root'
})
export class BadgeService {
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
            achievedAt: userProgress?.achievedAt ? this.convertFirestoreTimestamp(userProgress.achievedAt) : undefined,
            tierHistory: this.buildDisplayTierHistory(badgeId, userProgress)
          };
        });
      })
    );
  }

  private tierRank(tier: string): number {
    const m: Record<string, number> = { locked: 0, bronze: 1, silver: 2, gold: 3 };
    return m[tier] ?? 0;
  }

  private cloneTierAchievedMapFromDb(raw: any): Record<string, any> {
    const out: Record<string, any> = {};
    if (!raw || typeof raw !== 'object') {
      return out;
    }
    (['bronze', 'silver', 'gold'] as const).forEach((k) => {
      if (raw[k] != null) {
        out[k] = raw[k];
      }
    });
    return out;
  }

  /**
   * Display-only tier history. Prefers per-tier `tierAchievedAt`; for legacy data without it,
   * uses `achievedAt` once and ties it to the current tier.
   */
  private buildDisplayTierHistory(badgeId: string, userProgress: any): TierHistoryRow[] {
    if (badgeId === 'profile_complete') {
      if (userProgress?.unlocked && userProgress.achievedAt) {
        return [
          {
            tier: 'profile_complete',
            at: this.convertFirestoreTimestamp(userProgress.achievedAt)
          }
        ];
      }
      return [];
    }
    if (!isMetalTierBadgeId(badgeId)) {
      return [];
    }
    const fromDoc = this.cloneTierAchievedMapFromDb(userProgress?.tierAchievedAt);
    const hasAny = ['bronze', 'silver', 'gold'].some((k) => fromDoc[k] != null);
    if (!hasAny && userProgress?.unlocked && userProgress.tier && userProgress.tier !== 'locked' && userProgress.achievedAt) {
      fromDoc[userProgress.tier] = userProgress.achievedAt;
    }
    const order: Array<'bronze' | 'silver' | 'gold'> = ['bronze', 'silver', 'gold'];
    return order
      .filter((t) => fromDoc[t] != null)
      .map((tier) => ({ tier, at: this.convertFirestoreTimestamp(fromDoc[tier]) }));
  }

  private buildTierAchievedMapForUpdate(currentRaw: any, previousTier: string, newTier: 'bronze' | 'silver' | 'gold' | 'locked'): Record<string, any> {
    const base = this.cloneTierAchievedMapFromDb(currentRaw);
    const p = this.tierRank(previousTier);
    const n = this.tierRank(newTier);
    if (n > p && newTier !== 'locked') {
      base[newTier] = new Date();
    }
    return base;
  }

  private buildMetalTierBadgeState(
    currentBadges: any,
    currentTier: string,
    newTier: 'bronze' | 'silver' | 'gold' | 'locked',
    wasUnlocked: boolean,
    unlocked: boolean,
    progress: number
  ) {
    const shouldStampAchievedAt =
      this.tierRank(newTier) > this.tierRank(currentTier) || (unlocked && !wasUnlocked);
    const newAchievedAt = shouldStampAchievedAt
      ? new Date()
      : this.toDateOrUndefined(currentBadges?.achievedAt);
    const tierMap = this.buildTierAchievedMapForUpdate(
      currentBadges?.tierAchievedAt,
      currentTier,
      newTier
    );
    if (newTier !== 'locked' && unlocked) {
      const t = newTier;
      if (!tierMap[t]) {
        if (newAchievedAt) {
          tierMap[t] = newAchievedAt;
        } else {
          const fallback = this.toDateOrUndefined(currentBadges?.achievedAt) ?? new Date();
          tierMap[t] = fallback;
        }
      }
    }
    return {
      tier: newTier,
      progress,
      unlocked,
      achievedAt: newAchievedAt,
      tierAchievedAt: tierMap
    };
  }

  /** Coerce existing Firestore/Date values; otherwise undefined (omit in write). */
  private toDateOrUndefined(value: any): Date | undefined {
    if (value == null) {
      return undefined;
    }
    if (value instanceof Date) {
      return value;
    }
    if (value?.toDate && typeof value.toDate === 'function') {
      return value.toDate();
    }
    const d = new Date(value);
    return isNaN(d.getTime()) ? undefined : d;
  }

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
    
    return this.BADGE_DEFINITIONS[badgeId as keyof typeof this.BADGE_DEFINITIONS]?.icon || '';
  }

  private convertFirestoreTimestamp(timestamp: any): Date {
    if (!timestamp) return new Date();
    
    if (timestamp instanceof Date) {
      return timestamp;
    }
    
    if (timestamp.toDate && typeof timestamp.toDate === 'function') {
      return timestamp.toDate();
    }
    
    if (typeof timestamp === 'number') {
      return new Date(timestamp);
    }
    
    if (typeof timestamp === 'string') {
      return new Date(timestamp);
    }
    
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
    
    const currentBadges = userData?.badges?.profile_complete;
    const currentTier = currentBadges?.tier || 'locked';
    const currentUnlocked = currentBadges?.unlocked || false;
    
    let tier: 'bronze' | 'silver' | 'gold' | 'locked' = currentTier;
    let unlocked = currentUnlocked;
    
    if (isComplete && currentTier !== 'gold') {
      tier = 'gold';
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
   * App stores firstName/lastName (and sometimes fullName). Count name as present if
   * fullName is set, or first + last are set (edit profile + register do not set fullName).
   */
  private hasProfileDisplayName(userData: any): boolean {
    if (!userData) {
      return false;
    }
    if (String(userData.fullName || '').trim().length > 0) {
      return true;
    }
    if (String(userData.firstName || '').trim() && String(userData.lastName || '').trim()) {
      return true;
    }
    return false;
  }

  /**
   * Check if user profile is complete
   */
  private isProfileComplete(userData: any): boolean {
    return !!(
      this.hasProfileDisplayName(userData) &&
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

    if (this.hasProfileDisplayName(userData)) {
      completedFields++;
    }
    if (userData?.username?.trim()) {
      completedFields++;
    }
    if (userData?.bio?.trim()) {
      completedFields++;
    }
    if (userData?.photoURL && userData?.photoURL !== 'assets/img/default.png') {
      completedFields++;
    }

    return Math.round((completedFields / totalFields) * 100);
  }

  /**
   * Firestore does not allow `undefined` in field values; strip before write.
   */
  private deepOmitUndefined<T>(value: T): T {
    if (value === undefined) {
      return value as T;
    }
    if (value === null) {
      return value;
    }
    if (value instanceof Date) {
      return value;
    }
    if (typeof value !== 'object') {
      return value;
    }
    if (Array.isArray(value)) {
      return value
        .map((item) => this.deepOmitUndefined(item))
        .filter((item) => item !== undefined) as T;
    }
    if (typeof (value as any).toDate === 'function') {
      return value;
    }
    const out: Record<string, any> = {};
    for (const k of Object.keys(value as object)) {
      const v = this.deepOmitUndefined((value as any)[k]);
      if (v !== undefined) {
        out[k] = v;
      }
    }
    return out as T;
  }

  /**
   * Update user's badge progress in Firestore
   */
  private async updateUserBadge(userId: string, badgeId: string, progress: any): Promise<void> {
    const userRef = this.firestore.collection('users').doc(userId);
    const cleaned = this.deepOmitUndefined(progress) as any;

    try {
      await userRef.update({
        [`badges.${badgeId}`]: cleaned
      });
    } catch (e: any) {
      const msg = typeof e?.message === 'string' ? e.message : '';
      const isMissingDoc =
        e?.code === 'not-found' || msg.includes('No document to update') || msg.includes('NOT_FOUND');
      if (isMissingDoc) {
        await userRef.set(
          { badges: { [badgeId]: cleaned } } as any,
          { merge: true }
        );
        return;
      }
      console.error(`[BadgeService] updateUserBadge failed for ${badgeId}:`, e);
      throw e;
    }
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
    const steps: Array<() => Promise<void>> = [
      () => this.evaluateProfileCompletionBadge(userId, userData),
      () => this.evaluateBucketListBadge(userId, userData),
      () => this.evaluatePhotoEnthusiastBadge(userId, userData),
      () => this.evaluateSocialButterflyBadge(userId, userData),
      () => this.evaluateExplorerBadge(userId, userData)
    ];
    for (const run of steps) {
      try {
        await run();
      } catch (e) {
        console.error('[BadgeService] evaluateAllBadges step failed:', e);
      }
    }
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

    const currentBadges = userData?.badges?.bucket_list;
    const currentTier = currentBadges?.tier || 'locked';
    const currentUnlocked = currentBadges?.unlocked || false;
    
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

    // Only update if upgrading the badge
    if (!currentBadges || 
        (tier !== currentTier) || 
        (bucketListCount !== currentBadges.progress) || 
        (unlocked !== currentUnlocked)) {
      await this.updateUserBadge(
        userId,
        'bucket_list',
        this.buildMetalTierBadgeState(currentBadges, currentTier, tier, currentUnlocked, unlocked, bucketListCount)
      );
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

    const currentBadges = userData?.badges?.photo_enthusiast;
    const currentTier = currentBadges?.tier || 'locked';
    const currentUnlocked = currentBadges?.unlocked || false;
    
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

    // Only update if upgrading the badge
    if (!currentBadges || 
        (tier !== currentTier) || 
        (photoCount !== currentBadges.progress) || 
        (unlocked !== currentUnlocked)) {
      await this.updateUserBadge(
        userId,
        'photo_enthusiast',
        this.buildMetalTierBadgeState(currentBadges, currentTier, tier, currentUnlocked, unlocked, photoCount)
      );
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

    // Calculate overall progress (combined score)
    const progress = postsCount + totalLikesReceived + totalCommentsMade;
    
    const currentBadges = userData?.badges?.social_butterfly;
    const currentTier = currentBadges?.tier || 'locked';
    const currentUnlocked = currentBadges?.unlocked || false;
    
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

    // Only update if upgrading the badge
    if (!currentBadges || 
        (tier !== currentTier) || 
        (progress !== currentBadges.progress) || 
        (unlocked !== currentUnlocked)) {
      await this.updateUserBadge(
        userId,
        'social_butterfly',
        this.buildMetalTierBadgeState(currentBadges, currentTier, tier, currentUnlocked, unlocked, progress)
      );
    }
  }

  /**
   * Evaluate and update user's explorer badge based on location visits
   */
  async evaluateExplorerBadge(userId: string, userData: any): Promise<void> {
    let uniqueSpotsVisited = 0;
    
    try {
      const visitedSnapshot = await this.firestore
        .collection(`users/${userId}/visitedSpots`)
        .get()
        .toPromise();

      uniqueSpotsVisited = visitedSnapshot?.size ?? 0;
    } catch (error) {
      console.error('Error getting visited spots from subcollection:', error);
      uniqueSpotsVisited = 0;
    }

    const currentBadges = userData?.badges?.explorer;
    const currentTier = currentBadges?.tier || 'locked';
    const currentUnlocked = currentBadges?.unlocked || false;
    
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

    // Only update if upgrading the badge
    if (!currentBadges || 
        (tier !== currentTier) || 
        (uniqueSpotsVisited !== currentBadges.progress) || 
        (unlocked !== currentUnlocked)) {
      await this.updateUserBadge(
        userId,
        'explorer',
        this.buildMetalTierBadgeState(
          currentBadges,
          currentTier,
          tier,
          currentUnlocked,
          unlocked,
          uniqueSpotsVisited
        )
      );
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
      const visitedRef = this.firestore
        .collection(`users/${userId}/visitedSpots`)
        .doc(spotId);

      const existingVisit = await visitedRef.get().toPromise();
      if (existingVisit?.exists) {
        return false;
      }

      const userSnapshot = await this.firestore.collection('users').doc(userId).get().toPromise();
      const userData = userSnapshot?.data() as any;

      await visitedRef.set(
        {
          spotId,
          spotName,
          visitedAt: new Date(),
          location: userData?.location || null,
          source: 'badge_service'
        },
        { merge: true }
      );

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
