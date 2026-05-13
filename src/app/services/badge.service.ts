import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { Observable, of } from 'rxjs';
import { map, switchMap } from 'rxjs/operators';
import {
  USER_SOCIAL_COMMENTS_MADE_COUNT_FIELD,
  USER_SOCIAL_LIKES_GIVEN_COUNT_FIELD,
  USER_SOCIAL_POSTS_CREATED_COUNT_FIELD
} from './user-social-counts.service';

/** Top-level on `users/{uid}`; incremented when a signed-in user submits a spot review (tourist-spot-detail). */
const SPOT_REVIEWS_SUBMITTED_COUNT_FIELD = 'spotReviewsSubmittedCount';

///////////////////////////////////////////////////// global ///////////////////////////////////////////////////

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
  itinerary_planner: {
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
  consistency: {
    tier: 'bronze' | 'silver' | 'gold' | 'locked';
    progress: number;
    unlocked: boolean;
    achievedAt?: Date;
    tierAchievedAt?: TierAchievedAtStored;
  };
  local_expert: {
    tier: 'bronze' | 'silver' | 'gold' | 'locked';
    progress: number;
    unlocked: boolean;
    achievedAt?: Date;
    tierAchievedAt?: TierAchievedAtStored;
  };
  review_master: {
    tier: 'bronze' | 'silver' | 'gold' | 'locked';
    progress: number;
    unlocked: boolean;
    achievedAt?: Date;
    tierAchievedAt?: TierAchievedAtStored;
  };
}

const METAL_TIER_BADGE_ID_LIST = [
  'itinerary_planner',
  'photo_enthusiast',
  'social_butterfly',
  'explorer',
  'consistency',
  'local_expert',
  'review_master'
] as const;

export function isMetalTierBadgeId(badgeId: string): boolean {
  return (METAL_TIER_BADGE_ID_LIST as readonly string[]).includes(badgeId);
}

@Injectable({
  providedIn: 'root'
})
export class BadgeService {
  ///////////////////////////////////////////////////// badge service — definitions & constructor /////////////////////////////////////////////////////

  private readonly BADGE_DEFINITIONS = {
    profile_complete: {
      id: 'profile_complete',
      title: 'Profile Complete',
      description: 'Complete your profile information by filling out your name, username, bio, and uploading a profile picture.',
      icon: 'assets/badges/accountComplete.png',
      lockedIcon: 'assets/badges/lockedAccountComplete.png',
      maxProgress: 100
    },
    itinerary_planner: {
      id: 'itinerary_planner',
      title: 'Itinerary Planner Master',
      description:
        'Add tourist spots to your itinerary planner draft to unlock tiers. 5+ spots for Bronze, 15+ for Silver, 25+ for Gold.',
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
      description:
        'Engage with the community. Uses your profile counters: posts created, likes you give on posts, and comments you write. Bronze: 5+ posts, 20+ likes given, 10+ comments. Silver: 20 / 50 / 25. Gold: 50 / 100 / 50.',
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
    },
    consistency: {
      id: 'consistency',
      title: 'Consistency Champion',
      description: 'Log in daily to build your streak. 7-day streak for Bronze, 30-day for Silver, 100-day for Gold.',
      icon: 'assets/badges/bronzeConsistencyBadge.png',
      lockedIcon: 'assets/badges/lockedConsistencyBadge.png',
      maxProgress: 100
    },
    local_expert: {
      id: 'local_expert',
      title: 'Local Expert',
      description: 'Suggest new spots and submit local tips. 1 suggestion + 1 tip for Bronze, 5 + 5 for Silver, 10 + 10 for Gold.',
      icon: 'assets/badges/bronzeLocalExpertBadge.png',
      lockedIcon: 'assets/badges/lockedLocalExpertBadge.png',
      maxProgress: 10
    },
    review_master: {
      id: 'review_master',
      title: 'Review Master',
      description:
        'Submit tourist spot reviews while signed in. 5+ reviews for Bronze, 15+ for Silver, 30+ for Gold. Each submission counts toward your total.',
      icon: 'assets/badges/bronzeReviewMasterBadge.png',
      lockedIcon: 'assets/badges/lockedReviewMasterBadge.png',
      maxProgress: 30
    }
  };

  constructor(
    private firestore: AngularFirestore,
    private afAuth: AngularFireAuth
  ) {}

  ///////////////////////////////////////////////////// shared — read APIs /////////////////////////////////////////////////////

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

  /**
   * Get user's badge progress from Firestore
   */
  getUserBadgeProgress(userId: string): Observable<UserBadgeProgress> {
    const defaultBadges: UserBadgeProgress = {
      profile_complete: {
        tier: 'locked',
        progress: 0,
        unlocked: false
      },
      itinerary_planner: {
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
      },
      consistency: {
        tier: 'locked',
        progress: 0,
        unlocked: false
      },
      local_expert: {
        tier: 'locked',
        progress: 0,
        unlocked: false
      },
      review_master: {
        tier: 'locked',
        progress: 0,
        unlocked: false
      }
    };

    return this.firestore.collection('users').doc(userId).valueChanges().pipe(
      map((userData: any) => {
        const raw = userData?.badges;
        if (!raw) {
          return defaultBadges;
        }
        return {
          profile_complete: { ...defaultBadges.profile_complete, ...raw.profile_complete },
          itinerary_planner: { ...defaultBadges.itinerary_planner, ...raw.itinerary_planner },
          photo_enthusiast: { ...defaultBadges.photo_enthusiast, ...raw.photo_enthusiast },
          social_butterfly: { ...defaultBadges.social_butterfly, ...raw.social_butterfly },
          explorer: { ...defaultBadges.explorer, ...raw.explorer },
          consistency: { ...defaultBadges.consistency, ...raw.consistency },
          local_expert: { ...defaultBadges.local_expert, ...raw.local_expert },
          review_master: { ...defaultBadges.review_master, ...raw.review_master }
        };
      })
    );
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

  ///////////////////////////////////////////////////// shared — metal tier & display helpers /////////////////////////////////////////////////////

  private tierRank(tier: string): number {
    const m: Record<string, number> = { locked: 0, bronze: 1, silver: 2, gold: 3 };
    return m[tier] ?? 0;
  }

  private readNonNegativeUserCounter(data: any, field: string): number {  // my safe number reader.
    if (!data) {
      return 0;
    }
    const raw = data[field];
    if (typeof raw === 'number' && !Number.isNaN(raw)) {
      return Math.max(0, Math.floor(raw));
    }
    if (raw != null) {
      const n = Math.floor(Number(raw));
      if (!Number.isNaN(n)) {
        return Math.max(0, n);
      }
    }
    return 0;
  }

  private maxMetalTierFromTierAchievedAt(raw: any): 'bronze' | 'silver' | 'gold' | 'locked' {
    const m = this.cloneTierAchievedMapFromDb(raw);
    if (m['gold'] != null) return 'gold';
    if (m['silver'] != null) return 'silver';
    if (m['bronze'] != null) return 'bronze';
    return 'locked';
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
    if (badgeId === 'itinerary_planner') {
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

    if (badgeId === 'consistency') {
      switch (tier) {
        case 'bronze': return 'assets/badges/bronzeConsistencyBadge.png';
        case 'silver': return 'assets/badges/silverConsistencyBadge.png';
        case 'gold': return 'assets/badges/goldConsistencyBadge.png';
        default: return 'assets/badges/lockedConsistencyBadge.png';
      }
    }

    if (badgeId === 'local_expert') {
      switch (tier) {
        case 'bronze': return 'assets/badges/bronzeLocalExpertBadge.png';
        case 'silver': return 'assets/badges/silverLocalExpertBadge.png';
        case 'gold': return 'assets/badges/goldLocalExpertBadge.png';
        default: return 'assets/badges/lockedLocalExpertBadge.png';
      }
    }

    if (badgeId === 'review_master') {
      switch (tier) {
        case 'bronze': return 'assets/badges/bronzeReviewMasterBadge.png';
        case 'silver': return 'assets/badges/silverReviewMasterBadge.png';
        case 'gold': return 'assets/badges/goldReviewMasterBadge.png';
        default: return 'assets/badges/lockedReviewMasterBadge.png';
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

  ///////////////////////////////////////////////////// shared — Firestore persistence /////////////////////////////////////////////////////

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

  ///////////////////////////////////////////////////// orchestration — evaluate all /////////////////////////////////////////////////////

  /**
   * Evaluate all badges for current user
   */
  async evaluateAllBadges(userId: string, userData: any): Promise<void> {
    const steps: Array<() => Promise<void>> = [
      () => this.evaluateProfileCompletionBadge(userId, userData),
      () => this.evaluateItineraryPlannerBadge(userId, userData),
      () => this.evaluatePhotoEnthusiastBadge(userId, userData),
      () => this.evaluateSocialButterflyBadge(userId, userData),
      () => this.evaluateExplorerBadge(userId, userData),
      () => this.evaluateConsistencyBadge(userId, userData),
      () => this.evaluateLocalExpertBadge(userId, userData),
      () => this.evaluateReviewMasterBadge(userId, userData)
    ];
    for (const run of steps) {
      try {
        await run();
      } catch (e) {
        console.error('[BadgeService] evaluateAllBadges step failed:', e);
      }
    }
  }

  ///////////////////////////////////////////////////// profile complete /////////////////////////////////////////////////////

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


  private isProfileComplete(userData: any): boolean {
    return !!(
      this.hasProfileDisplayName(userData) &&
      userData?.username?.trim() &&
      userData?.bio?.trim() &&
      userData?.photoURL &&
      userData?.photoURL !== 'assets/img/default.png'
    );
  }


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

  ///////////////////////////////////////////////////// itinerary planner master /////////////////////////////////////////////////////

  async evaluateItineraryPlannerBadge(userId: string, userData: any): Promise<void> {
    const draft = userData?.plannerDraftSpots;
    const plannerDraftCount = Array.isArray(draft) ? draft.length : 0;

    const currentBadges = userData?.badges?.itinerary_planner;
    const storedTier = currentBadges?.tier || 'locked';
    const storedUnlocked = currentBadges?.unlocked || false;

    const historyFloor = this.maxMetalTierFromTierAchievedAt(currentBadges?.tierAchievedAt);
    let baselineTier: 'bronze' | 'silver' | 'gold' | 'locked' = storedTier;
    if (this.tierRank(historyFloor) > this.tierRank(storedTier)) {
      baselineTier = historyFloor;
    }
    const baselineUnlocked = this.tierRank(baselineTier) > 0 || storedUnlocked;

    let tier: 'bronze' | 'silver' | 'gold' | 'locked' = baselineTier;
    let unlocked = baselineUnlocked;

    if (plannerDraftCount >= 25 && baselineTier !== 'gold') {
      tier = 'gold';
      unlocked = true;
    } else if (
      plannerDraftCount >= 15 &&
      baselineTier !== 'silver' &&
      baselineTier !== 'gold'
    ) {
      tier = 'silver';
      unlocked = true;
    } else if (plannerDraftCount >= 5 && baselineTier === 'locked') {
      tier = 'bronze';
      unlocked = true;
    }

    if (
      !currentBadges ||
      tier !== storedTier ||
      plannerDraftCount !== currentBadges.progress ||
      unlocked !== storedUnlocked
    ) {
      await this.updateUserBadge(
        userId,
        'itinerary_planner',
        this.buildMetalTierBadgeState(
          currentBadges,
          baselineTier,
          tier,
          storedUnlocked,
          unlocked,
          plannerDraftCount
        )
      );
    }
  }

  ///////////////////////////////////////////////////// photo enthusiast /////////////////////////////////////////////////////


  async evaluatePhotoEnthusiastBadge(userId: string, userData: any): Promise<void> {
    let photoCount = 0;
    
    try {
      const postsSnapshot = await this.firestore
        .collection('posts', ref => ref.where('userId', '==', userId))
        .get()
        .toPromise();
      
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

    if (photoCount >= 3 && currentTier !== 'gold') {
      tier = 'gold';
      unlocked = true;
    } else if (photoCount >= 2 && currentTier !== 'silver' && currentTier !== 'gold') {
      tier = 'silver';
      unlocked = true;
    } else if (photoCount >= 1 && currentTier === 'locked') {
      tier = 'bronze';
      unlocked = true;
    }

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

  ///////////////////////////////////////////////////// social butterfly /////////////////////////////////////////////////////

  async evaluateSocialButterflyBadge(userId: string, userData: any): Promise<void> {
    let source: any = userData;
    try {
      const snap = await this.firestore.collection('users').doc(userId).get().toPromise();
      if (snap?.exists) {
        source = snap.data() ?? userData;
      }
    } catch (e) {
      console.warn(
        '[BadgeService] evaluateSocialButterflyBadge: could not refresh user doc; using passed userData.',
        e
      );
      source = userData;
    }

    const postsCount = this.readNonNegativeUserCounter(source, USER_SOCIAL_POSTS_CREATED_COUNT_FIELD);
    const likesGivenCount = this.readNonNegativeUserCounter(source, USER_SOCIAL_LIKES_GIVEN_COUNT_FIELD);
    const commentsMadeCount = this.readNonNegativeUserCounter(source, USER_SOCIAL_COMMENTS_MADE_COUNT_FIELD);

    const progress = postsCount + likesGivenCount + commentsMadeCount;

    const currentBadges = source?.badges?.social_butterfly;
    const currentTier = currentBadges?.tier || 'locked';
    const currentUnlocked = currentBadges?.unlocked || false;

    let tier: 'bronze' | 'silver' | 'gold' | 'locked' = currentTier;
    let unlocked = currentUnlocked;

    if (postsCount >= 3 && likesGivenCount >= 3 && commentsMadeCount >= 3 && currentTier !== 'gold') {
      tier = 'gold';
      unlocked = true;
    } else if (
      postsCount >= 2 &&
      likesGivenCount >= 2 &&
      commentsMadeCount >= 2 &&
      currentTier !== 'silver' &&
      currentTier !== 'gold'
    ) {
      tier = 'silver';
      unlocked = true;
    } else if (
      postsCount >= 1 && 
      likesGivenCount >= 1 
      && commentsMadeCount >= 1 && 
      currentTier === 'locked') {
      tier = 'bronze';
      unlocked = true;
    }

    if (
      !currentBadges ||
      tier !== currentTier ||
      progress !== currentBadges.progress ||
      unlocked !== currentUnlocked
    ) {
      await this.updateUserBadge(
        userId,
        'social_butterfly',
        this.buildMetalTierBadgeState(currentBadges, currentTier, tier, currentUnlocked, unlocked, progress)
      );
    }
  }

  ///////////////////////////////////////////////////// explorer /////////////////////////////////////////////////////


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

  ///////////////////////////////////////////////////// review master /////////////////////////////////////////////////////

  async evaluateReviewMasterBadge(userId: string, userData: any): Promise<void> {
    const raw = userData?.[SPOT_REVIEWS_SUBMITTED_COUNT_FIELD];
    const reviewCount =
      typeof raw === 'number' && !Number.isNaN(raw) ? raw : Math.max(0, Math.floor(Number(raw)) || 0);

    const currentBadges = userData?.badges?.review_master;
    const currentTier = currentBadges?.tier || 'locked';
    const currentUnlocked = currentBadges?.unlocked || false;

    let tier: 'bronze' | 'silver' | 'gold' | 'locked' = currentTier;
    let unlocked = currentUnlocked;

    if (reviewCount >= 30 && currentTier !== 'gold') {
      tier = 'gold';
      unlocked = true;
    } else if (reviewCount >= 15 && currentTier !== 'silver' && currentTier !== 'gold') {
      tier = 'silver';
      unlocked = true;
    } else if (reviewCount >= 5 && currentTier === 'locked') {
      tier = 'bronze';
      unlocked = true;
    }

    if (
      !currentBadges ||
      tier !== currentTier ||
      reviewCount !== currentBadges.progress ||
      unlocked !== currentUnlocked
    ) {
      await this.updateUserBadge(
        userId,
        'review_master',
        this.buildMetalTierBadgeState(
          currentBadges,
          currentTier,
          tier,
          currentUnlocked,
          unlocked,
          reviewCount
        )
      );
    }
  }

 ///////////////////////////////////////////////////////////////////////////////////////////////////////////////////////


  async checkProximityAndRecordVisit(userId: string, userLocation: { lat: number, lng: number }): Promise<void> { // checket for user near spto
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
            const visitRecorded = await this.recordSpotVisit(userId, spot.id, spot.name); // will record 
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

  ///////////////////////////////////////////////////// consistency /////////////////////////////////////////////////////

  async updateLoginStreak(userId: string): Promise<void> {
    try {
      const userRef = this.firestore.collection('users').doc(userId);
      const snap = await userRef.get().toPromise();
      const data = (snap?.data() as any) || {};

      const today = this.toLocalDateString(new Date());
      if (data.lastLoginDate === today) {
        return;
      }

      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayStr = this.toLocalDateString(yesterday);

      const previousStreak = typeof data.loginStreak === 'number' ? data.loginStreak : 0;
      const newStreak = data.lastLoginDate === yesterdayStr ? previousStreak + 1 : 1;
      const longest = Math.max(newStreak, typeof data.longestStreak === 'number' ? data.longestStreak : 0);

      await userRef.update({
        lastLoginDate: today,
        loginStreak: newStreak,
        longestStreak: longest
      });

      await this.evaluateConsistencyBadge(userId, {
        ...data,
        lastLoginDate: today,
        loginStreak: newStreak,
        longestStreak: longest
      });
    } catch (error) {
      console.error('Error updating login streak:', error);
    }
  }

  async evaluateConsistencyBadge(userId: string, userData: any): Promise<void> {
    const currentStreak = typeof userData?.loginStreak === 'number' ? userData.loginStreak : 0;
    const longestStreak = typeof userData?.longestStreak === 'number' ? userData.longestStreak : 0;
    const progress = Math.max(currentStreak, longestStreak);

    const currentBadges = userData?.badges?.consistency;
    const storedTier = currentBadges?.tier || 'locked';
    const storedUnlocked = currentBadges?.unlocked || false;

    const historyFloor = this.maxMetalTierFromTierAchievedAt(currentBadges?.tierAchievedAt);
    let baselineTier: 'bronze' | 'silver' | 'gold' | 'locked' = storedTier;
    if (this.tierRank(historyFloor) > this.tierRank(storedTier)) {
      baselineTier = historyFloor;
    }
    const baselineUnlocked = this.tierRank(baselineTier) > 0 || storedUnlocked;

    let tier: 'bronze' | 'silver' | 'gold' | 'locked' = baselineTier;
    let unlocked = baselineUnlocked;

    if (progress >= 100 && baselineTier !== 'gold') {
      tier = 'gold';
      unlocked = true;
    } else if (progress >= 30 && baselineTier !== 'silver' && baselineTier !== 'gold') {
      tier = 'silver';
      unlocked = true;
    } else if (progress >= 7 && baselineTier === 'locked') {
      tier = 'bronze';
      unlocked = true;
    }

    if (
      !currentBadges ||
      tier !== storedTier ||
      progress !== currentBadges.progress ||
      unlocked !== storedUnlocked
    ) {
      await this.updateUserBadge(
        userId,
        'consistency',
        this.buildMetalTierBadgeState(
          currentBadges,
          baselineTier,
          tier,
          storedUnlocked,
          unlocked,
          progress
        )
      );
    }
  }

  ///////////////////////////////////////////////////// local expert /////////////////////////////////////////////////////


  async evaluateLocalExpertBadge(userId: string, userData: any): Promise<void> {
    let suggestedSpotsCount = 0;
    let submittedTipsCount = 0;

    try {
      const [spotsSnapshot, tipsSnapshot] = await Promise.all([
        this.firestore
          .collection('pending_tourist_spots', ref => ref.where('submittedBy', '==', userId))
          .get()
          .toPromise(),
        this.firestore
          .collection('pending_local_tips', ref => ref.where('submittedBy', '==', userId))
          .get()
          .toPromise()
      ]);

      suggestedSpotsCount = spotsSnapshot?.docs.length || 0;
      submittedTipsCount = tipsSnapshot?.docs.length || 0;
    } catch (error) {
      console.error('Error getting local expert metrics:', error);
      suggestedSpotsCount = 0;
      submittedTipsCount = 0;
    }

    const progress = Math.min(suggestedSpotsCount, submittedTipsCount);

    const currentBadges = userData?.badges?.local_expert;
    const storedTier = currentBadges?.tier || 'locked';
    const storedUnlocked = currentBadges?.unlocked || false;

    const historyFloor = this.maxMetalTierFromTierAchievedAt(currentBadges?.tierAchievedAt);
    let baselineTier: 'bronze' | 'silver' | 'gold' | 'locked' = storedTier;
    if (this.tierRank(historyFloor) > this.tierRank(storedTier)) {
      baselineTier = historyFloor;
    }
    const baselineUnlocked = this.tierRank(baselineTier) > 0 || storedUnlocked;

    let tier: 'bronze' | 'silver' | 'gold' | 'locked' = baselineTier;
    let unlocked = baselineUnlocked;

    if (progress >= 10 && baselineTier !== 'gold') {
      tier = 'gold';
      unlocked = true;
    } else if (progress >= 5 && baselineTier !== 'silver' && baselineTier !== 'gold') {
      tier = 'silver';
      unlocked = true;
    } else if (progress >= 1 && baselineTier === 'locked') {
      tier = 'bronze';
      unlocked = true;
    }

    if (
      !currentBadges ||
      tier !== storedTier ||
      progress !== currentBadges.progress ||
      unlocked !== storedUnlocked
    ) {
      await this.updateUserBadge(
        userId,
        'local_expert',
        this.buildMetalTierBadgeState(
          currentBadges,
          baselineTier,
          tier,
          storedUnlocked,
          unlocked,
          progress
        )
      );
    }
  }


  private toLocalDateString(date: Date): string {  // for date
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  }
}
