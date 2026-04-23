import { Component, Input } from '@angular/core';
import { ModalController, IonicModule } from '@ionic/angular';
import { Badge, isMetalTierBadgeId, TierHistoryRow } from '../../services/badge.service';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-badge-detail-modal',
  templateUrl: './badge-detail-modal.component.html',
  styleUrls: ['./badge-detail-modal.component.scss'],
  standalone: true,
  imports: [IonicModule, CommonModule]
})
export class BadgeDetailModalComponent {
  @Input() badge!: Badge;
  showTierHistory = false;

  constructor(private modalCtrl: ModalController) {}

  dismiss() {
    this.modalCtrl.dismiss();
  }

  getBadgeIcon(): string {
    if (!this.badge.isUnlocked) {
      return this.badge.lockedIcon;
    }
    
    // For bucket list badge, use the appropriate tier icon
    if (this.badge.id === 'bucket_list') {
      switch (this.badge.tier) {
        case 'bronze': return 'assets/badges/bronzeBucketListBadge.png';
        case 'silver': return 'assets/badges/silverBucketListBadge.png';
        case 'gold': return 'assets/badges/goldBucketListBadge.png';
        default: return 'assets/badges/lockedBucketListBadge.png';
      }
    }
    
    // For photo enthusiast badge, use the appropriate tier icon
    if (this.badge.id === 'photo_enthusiast') {
      switch (this.badge.tier) {
        case 'bronze': return 'assets/badges/bronzePhotoEnthusiastBadge.png';
        case 'silver': return 'assets/badges/silverPhotoEnthusiastBadge.png';
        case 'gold': return 'assets/badges/goldPhotoEnthusiastBadge.png';
        default: return 'assets/badges/lockedPhotoEnthusiastBadge.png';
      }
    }
    
    // For social butterfly badge, use the appropriate tier icon
    if (this.badge.id === 'social_butterfly') {
      switch (this.badge.tier) {
        case 'bronze': return 'assets/badges/bronzeSocialButterflyBadge.png';
        case 'silver': return 'assets/badges/silverSocialButterflyBadge.png';
        case 'gold': return 'assets/badges/goldSocialButterflyBadge.png';
        default: return 'assets/badges/lockedSocialButterflyBadge.png';
      }
    }
    
    // For explorer badge, use the appropriate tier icon
    if (this.badge.id === 'explorer') {
      switch (this.badge.tier) {
        case 'bronze': return 'assets/badges/bronzeExplorerBadge.png';
        case 'silver': return 'assets/badges/silverExplorerBadge.png';
        case 'gold': return 'assets/badges/goldExplorerBadge.png';
        default: return 'assets/badges/lockedExplorerBadge.png';
      }
    }
    
    return this.badge.icon;
  }

  getTierColor(): string {
    if (!this.badge.isUnlocked) return '#999';
    if (this.badge.id === 'profile_complete') return '#ffd700';
    
    switch (this.badge.tier) {
      case 'bronze': return '#cd7f32';
      case 'silver': return '#c0c0c0';
      case 'gold': return '#ffd700';
      default: return '#999';
    }
  }

  getTierText(): string {
    if (!this.badge.isUnlocked) return 'Locked';
    if (this.badge.id === 'profile_complete') return 'Gold';
    return this.badge.tier.charAt(0).toUpperCase() + this.badge.tier.slice(1);
  }

  getProgressPercentage(): number {
    return (this.badge.progress / this.badge.maxProgress) * 100;
  }

  isMetalTier(): boolean {
    return isMetalTierBadgeId(this.badge.id);
  }

  /** Clock for profile + metal badges; shown even when locked (panel can be empty until earned). */
  showHistoryEntryButton(): boolean {
    return isMetalTierBadgeId(this.badge.id) || this.badge.id === 'profile_complete';
  }

  profileHistoryColumnLabel(): string {
    return this.badge.id === 'profile_complete' ? 'Milestone' : 'Tier';
  }

  historyRowTierColor(row: TierHistoryRow): string {
    if (row.tier === 'profile_complete' || row.tier === 'gold') {
      return '#b8860b';
    }
    if (row.tier === 'silver') {
      return '#5c6b7a';
    }
    if (row.tier === 'bronze') {
      return '#a0522d';
    }
    return '#2c3e50';
  }

  emptyHistoryMessage(): string {
    if (!this.badge.isUnlocked) {
      if (this.badge.id === 'profile_complete') {
        return 'No entries yet. Complete your profile to see the date here.';
      }
      return 'No entries yet. Progress this badge to record tier dates here.';
    }
    return 'No history recorded yet.';
  }

  toggleTierHistory(): void {
    this.showTierHistory = !this.showTierHistory;
  }

  tierLabel(row: TierHistoryRow): string {
    if (row.tier === 'profile_complete') {
      return 'Profile complete';
    }
    return row.tier.charAt(0).toUpperCase() + row.tier.slice(1);
  }

  formatTierDate(d: Date): string {
    if (!d || isNaN(d.getTime())) {
      return '—';
    }
    return d.toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  }
}
