import { Component, ViewChild, OnInit, ElementRef  } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AuthService } from '../services/auth.service';
import { NavController, AlertController, LoadingController } from '@ionic/angular';
import { StorageService } from '../services/storage.service';
import { ActionSheetController, ModalController } from '@ionic/angular';
import { ViewProfilePictureComponent } from '../modals/view-profile-picture/view-profile-picture.component';
import { EditProfileModalComponent } from '../modals/edit-profile-modal/edit-profile-modal.component';
import { MenuController } from '@ionic/angular';
import { CreatePostModalComponent } from '../modals/create-post-modal/create-post-modal.component';
import { CommentsModalComponent } from '../modals/comments-modal/comments-modal.component';
import { BadgeService, Badge } from '../services/badge.service';
import { BadgeDetailModalComponent } from '../modals/badge-detail-modal/badge-detail-modal.component';
import { BucketService } from '../services/bucket-list.service';

// Post interface
interface Post {
  id?: string;
  userId: string;
  userName: string;
  userPhotoURL: string;
  content?: string;
  imageUrl?: string;
  touristSpotName?: string;
  touristSpotLocation?: any;
  likes?: string[];
  comments?: Comment[];
  timestamp: any;
  isPublic: boolean;
  liked?: boolean; // For UI state
  postType?: 'regular' | 'shared_itinerary';
  sharedItinerary?: {
    itineraryId: string;
    itineraryName: string;
    itineraryDate: string;
    spots: Array<{
      name: string;
      location?: string;
      timeSlot?: string;
      duration?: string;
    }>;
    totalSpots: number;
  };
}

interface Comment {
  id?: string;
  userId: string;
  userName: string;
  userPhotoURL: string;
  content: string;
  timestamp: any;
}

@Component({
  selector: 'app-user-profile',
  templateUrl: './user-profile.page.html',
  styleUrls: ['./user-profile.page.scss'],
  standalone: false,
})
export class UserProfilePage implements OnInit {
  userId: string | null = null;
  userData: any = null;
  uploading: boolean = false;
  activeTab = 'tab-1';
  
  // Posts data
  posts: Post[] = [];
  userPosts: Post[] = [];
  loadingPosts = false;

  // Badge data
  userBadges: Badge[] = [];
  loadingBadges = false;
  badgesLoaded = false; // Flag to prevent multiple loads

  @ViewChild('avatarInput') avatarInput!: ElementRef<HTMLInputElement>;

  constructor(
    private route: ActivatedRoute,
    private afAuth: AngularFireAuth,
    private firestore: AngularFirestore,
    private authService: AuthService,
    private navCtrl: NavController,
    private storageService: StorageService,
    private alertCtrl: AlertController,
    private actionSheetCtrl: ActionSheetController,
    private modalCtrl: ModalController,
    private menuCtrl: MenuController,
    private badgeService: BadgeService,
    private bucketService: BucketService,
    private loadingCtrl: LoadingController
  ) {}

  async ngOnInit() {
    // Get Firebase Auth UID
    const currentUser = await this.afAuth.currentUser;
    this.userId = this.route.snapshot.paramMap.get('uid') ?? currentUser?.uid ?? null;
    if (!this.userId) {
      return;
    }
    
    // Load user profile data
    this.firestore.collection('users').doc(this.userId).valueChanges().subscribe(async (data) => {
      this.userData = data;
      
      // Only evaluate badges once when data is first loaded
      if (this.userId && data && !this.badgesLoaded) {
        await this.badgeService.evaluateAllBadges(this.userId, data);
        this.badgesLoaded = true;
      }
    });

    this.menuCtrl.enable(true, 'main-menu');
    
    // Load posts
    this.loadPosts();
    
    // Load badges
    this.loadBadges();
  }

  async loadPosts() {
    this.loadingPosts = true;
    try {
      // Load all public posts for feed
      this.firestore.collection('posts', ref => 
        ref.where('isPublic', '==', true).orderBy('timestamp', 'desc').limit(20)
      ).snapshotChanges().subscribe(async (changes) => {
        const posts = changes.map(c => ({ id: c.payload.doc.id, ...(c.payload.doc.data() as any) }));
        this.posts = await this.processPosts(posts);
        });

      // Load user's posts
      this.firestore.collection('posts', ref => 
        ref.where('userId', '==', this.userId).orderBy('timestamp', 'desc')
      ).snapshotChanges().subscribe(async (changes) => {
        const posts = changes.map(c => ({ id: c.payload.doc.id, ...(c.payload.doc.data() as any) }));
        this.userPosts = await this.processPosts(posts);
        });
    } catch (error) {
      console.error('Error loading posts:', error);
      this.showAlert('Error', 'Failed to load posts');
    } finally {
      this.loadingPosts = false;
    }
  }

  async loadBadges() {
    if (!this.userId || this.badgesLoaded) return;
    
    this.loadingBadges = true;
    try {
      this.badgeService.getUserBadges(this.userId).subscribe(badges => {
        this.userBadges = badges;
        this.badgesLoaded = true;
        });
    } catch (error) {
      console.error('Error loading badges:', error);
      this.showAlert('Error', 'Failed to load badges');
    } finally {
      this.loadingBadges = false;
    }
  }

  async processPosts(posts: any[]): Promise<Post[]> {
    const currentUser = await this.afAuth.currentUser;
    const currentUserId = currentUser?.uid;

    return posts.map(post => ({
      ...post,
      liked: (post.likes || []).includes(currentUserId) || false
    }));
  }

  formatTimestamp(timestamp: any): string {
    if (!timestamp) return '';
    
    const date = timestamp.toDate ? timestamp.toDate() : new Date(timestamp);
    const now = new Date();
    const diffInSeconds = Math.floor((now.getTime() - date.getTime()) / 1000);
    
    if (diffInSeconds < 60) return 'Just now';
    if (diffInSeconds < 3600) return `${Math.floor(diffInSeconds / 60)}m ago`;
    if (diffInSeconds < 86400) return `${Math.floor(diffInSeconds / 3600)}h ago`;
    if (diffInSeconds < 2592000) return `${Math.floor(diffInSeconds / 86400)}d ago`;
    
    return date.toLocaleDateString();
  }

  async openCreatePostModal() {
    const modal = await this.modalCtrl.create({
      component: CreatePostModalComponent,
      cssClass: 'create-post-modal',
      componentProps: {
        userId: this.userId,
        userData: this.userData
      }
    });

    await modal.present();

    const { data } = await modal.onWillDismiss();
    if (data && data.success) {
      this.loadPosts(); // Reload posts after creating
    }
  }

  async toggleLike(post: Post) {
    const currentUser = await this.afAuth.currentUser;
    if (!currentUser) return;

    const currentUserId = currentUser.uid;
    const postRef = this.firestore.collection('posts').doc(post.id);
    
    if (post.liked) {
      // Unlike
      const updatedLikes = (post.likes || []).filter(id => id !== currentUserId);
      await postRef.update({ likes: updatedLikes });
      post.likes = updatedLikes;
      post.liked = false;
    } else {
      // Like
      const updatedLikes = [...(post.likes || []), currentUserId];
      await postRef.update({ likes: updatedLikes });
      post.likes = updatedLikes;
      post.liked = true;
    }
    
    // Evaluate social butterfly badge for the post owner when their post gets liked/unliked
    if (post.userId !== currentUserId) {
      try {
        const postOwnerDoc = await this.firestore.collection('users').doc(post.userId).get().toPromise();
        const postOwnerData = postOwnerDoc?.data();
        
        if (postOwnerData) {
          await this.badgeService.evaluateSocialButterflyBadge(post.userId, postOwnerData);
        }
      } catch (error) {
        console.error('Error evaluating social butterfly badge for post owner:', error);
      }
    }
  }

  async showComments(post: Post) {
    const modal = await this.modalCtrl.create({
      component: CommentsModalComponent,
      cssClass: 'comments-modal',
      componentProps: {
        post: post
      }
    });

    await modal.present();
  }

  async sharePost(post: Post) {
    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Share Post',
      buttons: [
        {
          text: 'Copy Link',
          icon: 'link-outline',
          handler: () => {
            // Implement copy link functionality
            this.showAlert('Success', 'Link copied to clipboard');
          }
        },
        {
          text: 'Share via...',
          icon: 'share-outline',
          handler: () => {
            // Implement native sharing
            this.showAlert('Info', 'Native sharing coming soon');
          }
        },
        {
          text: 'Cancel',
          role: 'cancel'
        }
      ]
    });
    await actionSheet.present();
  }

  async showPostOptions(post: Post) {
    const currentUser = await this.afAuth.currentUser;
    const isOwnPost = post.userId === currentUser?.uid;

    const buttons: any[] = [
      {
        text: 'Report',
        icon: 'flag-outline',
        handler: () => {
          this.showAlert('Info', 'Report functionality coming soon');
        }
      }
    ];

    if (isOwnPost) {
      buttons.unshift(
        {
          text: 'Edit Post',
          icon: 'create-outline',
          handler: () => this.editPost(post)
        },
        {
          text: 'Delete Post',
          icon: 'trash-outline',
          handler: () => this.deletePost(post)
        }
      );
    }

    buttons.push({
      text: 'Cancel',
      role: 'cancel'
    });

    const actionSheet = await this.actionSheetCtrl.create({
      header: 'Post Options',
      buttons: buttons
    });
    await actionSheet.present();
  }

  async editPost(post: Post) {
    const modal = await this.modalCtrl.create({
      component: CreatePostModalComponent,
      cssClass: 'create-post-modal',
      componentProps: {
        post: post,
        isEditing: true
      }
    });

    await modal.present();

    const { data } = await modal.onWillDismiss();
    if (data && data.success) {
      this.loadPosts();
    }
  }

  async deletePost(post: Post) {
    const alert = await this.alertCtrl.create({
      header: 'Delete Post',
      message: 'Are you sure you want to delete this post? This action cannot be undone.',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Delete',
          role: 'destructive',
          handler: async () => {
            try {
              await this.firestore.collection('posts').doc(post.id).delete();
              this.showAlert('Success', 'Post deleted successfully');
              this.loadPosts();
            } catch (error) {
              console.error('Error deleting post:', error);
              this.showAlert('Error', 'Failed to delete post');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  openAvatarOptions() {
    this.avatarInput.nativeElement.click();
  }

  setActiveTab(tab: string) {
    this.activeTab = tab;
  }

  async presentAvatarOptions() {
  const actionSheet = await this.actionSheetCtrl.create({
    header: 'Profile Picture',
    cssClass: 'avatar-action-sheet',
    buttons: [
      {
        text: 'View Profile Picture',
        icon: 'eye-outline',
        handler: () => this.viewProfilePicture()
      },
      {
        text: 'Change Profile Picture',
        icon: 'image-outline',
        handler: () => this.avatarInput.nativeElement.click()
      },
      {
        text: 'Cancel',
        icon: 'close',
        role: 'cancel'
      }
    ]
  });
  await actionSheet.present();
}

async viewProfilePicture() {
  const modal = await this.modalCtrl.create({
    component: ViewProfilePictureComponent,
    componentProps: {
      photoURL: this.userData?.photoURL || 'assets/default.png'
    },
    cssClass: 'profile-modal',
    showBackdrop: true,
    backdropDismiss: true
  });
  await modal.present();
}

  async openEditProfileModal() {
  const modal = await this.modalCtrl.create({
    component: EditProfileModalComponent,
    cssClass: 'edit-profile-modal-class fullscreen',
    componentProps: {
      fullName: this.userData?.fullName,
      username: this.userData?.username,
      bio: this.userData?.bio
    },
    backdropDismiss: true,
    showBackdrop: true
  });

  await modal.present();

  const { data } = await modal.onWillDismiss();
  if (data) {
    // update the view with returned data if needed
    this.userData.fullName = data.fullName;
    this.userData.username = data.username;
    this.userData.bio = data.bio;
    
    // Re-evaluate badges after profile update and refresh display
    if (this.userId) {
      await this.badgeService.evaluateAllBadges(this.userId, this.userData);
      this.refreshBadges();
    }
  }
}

  async onAvatarSelected(event: any) {
  const file: File = event.target.files[0];
  if (!file) return;

  const user = await this.afAuth.currentUser;
  const uid = user?.uid;
  if (!uid) return;

  const filePath = `profile_pictures/${uid}_${Date.now()}_${file.name}`;
  this.uploading = true;

  try {
    const url = await this.storageService.uploadFile(filePath, file);
    await this.firestore.collection('users').doc(uid).update({ photoURL: url });
    this.userData.photoURL = url;

    // Re-evaluate badges after profile picture update and refresh display
    await this.badgeService.evaluateAllBadges(uid, this.userData);
    this.refreshBadges();

    this.showAlert('Success', 'Profile picture updated!');
  } catch (err) {
    console.error('Upload error:', err);
    this.showAlert('Error', 'Failed to update profile picture');
  } finally {
    this.uploading = false;
  }
}

  private async showAlert(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['OK']
    });
    await alert.present();
  }

  async logout() {
    await this.authService.logoutUser();
  }

  goToHome() {
    this.navCtrl.navigateForward('/user-dashboard');
  }

  goToMyItineraries() {
    this.navCtrl.navigateForward('/my-itineraries');
  }

  goToCompletedItineraries() {
    this.navCtrl.navigateForward('/completed-itineraries');
  }

  goToMySubmissions() {
    this.navCtrl.navigateForward('/user-profile/my-submissions');
  }

  getBadgeIcon(badge: Badge): string {
    if (!badge.isUnlocked) {
      return badge.lockedIcon;
    }
    
    // For bucket list badge, use the appropriate tier icon
    if (badge.id === 'bucket_list') {
      switch (badge.tier) {
        case 'bronze': return 'assets/badges/bronzeBucketListBadge.png';
        case 'silver': return 'assets/badges/silverBucketListBadge.png';
        case 'gold': return 'assets/badges/goldBucketListBadge.png';
        default: return 'assets/badges/lockedBucketListBadge.png';
      }
    }
    
    // For photo enthusiast badge, use the appropriate tier icon
    if (badge.id === 'photo_enthusiast') {
      switch (badge.tier) {
        case 'bronze': return 'assets/badges/bronzePhotoEnthusiastBadge.png';
        case 'silver': return 'assets/badges/silverPhotoEnthusiastBadge.png';
        case 'gold': return 'assets/badges/goldPhotoEnthusiastBadge.png';
        default: return 'assets/badges/lockedPhotoEnthusiastBadge.png';
      }
    }
    
    // For social butterfly badge, use the appropriate tier icon
    if (badge.id === 'social_butterfly') {
      switch (badge.tier) {
        case 'bronze': return 'assets/badges/bronzeSocialButterflyBadge.png';
        case 'silver': return 'assets/badges/silverSocialButterflyBadge.png';
        case 'gold': return 'assets/badges/goldSocialButterflyBadge.png';
        default: return 'assets/badges/lockedSocialButterflyBadge.png';
      }
    }
    
    // For explorer badge, use the appropriate tier icon
    if (badge.id === 'explorer') {
      switch (badge.tier) {
        case 'bronze': return 'assets/badges/bronzeExplorerBadge.png';
        case 'silver': return 'assets/badges/silverExplorerBadge.png';
        case 'gold': return 'assets/badges/goldExplorerBadge.png';
        default: return 'assets/badges/lockedExplorerBadge.png';
      }
    }
    
    return badge.icon;
  }

  getBadgeTierClass(badge: Badge): string {
    if (!badge.isUnlocked) return 'badge-locked';
    return `badge-${badge.tier}`;
  }

  async refreshBadges() {
    if (!this.userId) return;
    
    // Reset the flag to allow reloading
    this.badgesLoaded = false;
    
    // Reload badges
    this.badgeService.getUserBadges(this.userId).subscribe(badges => {
      this.userBadges = badges;
      this.badgesLoaded = true;
    });
  }

  async evaluateBadges() {
    if (!this.userId || !this.userData) return;
    
    // Manually trigger badge evaluation
    await this.badgeService.evaluateAllBadges(this.userId, this.userData);
    
    // Refresh the display
    this.refreshBadges();
  }

  async forceEvaluateBucketListBadge() {
    if (!this.userId || !this.userData) return;
    
    // Manually trigger bucket list badge evaluation
    await this.badgeService.evaluateAllBadges(this.userId, this.userData);
    
    // Refresh the display
    this.refreshBadges();
  }

  async openBadgeDetail(badge: Badge) {
    const modal = await this.modalCtrl.create({
      component: BadgeDetailModalComponent,
      componentProps: {
        badge: badge
      },
      cssClass: 'custom-badge-modal',
      showBackdrop: false,
      backdropDismiss: false,
      presentingElement: await this.modalCtrl.getTop()
    });

    await modal.present();
  }

  formatDate(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }

  async copyItineraryToBucketList(sharedItinerary: any) {
    if (!this.userId) {
      this.showAlert('Error', 'User not authenticated');
      return;
    }

    const loading = await this.loadingCtrl.create({
      message: 'Adding spots to your bucket list...',
      spinner: 'crescent'
    });
    await loading.present();

    try {
      let addedCount = 0;
      let skippedCount = 0;

      for (const spot of sharedItinerary.spots) {
        try {
          // Only copy tourist spots, skip restaurants and hotels
          const spotType = spot.type || 'tourist_spot';
          if (spotType !== 'tourist_spot') {
            skippedCount++;
            continue;
          }

          // Create a spot object that matches the bucket list format
          const spotData = {
            id: this.generateSpotId(spot.name),
            name: spot.name,
            img: 'assets/img/default-spot.png', // Default image
            category: 'tourist_spot',
            location: spot.location || 'Cebu, Philippines',
            description: `Shared from ${sharedItinerary.itineraryName}`
          };

          // Check if spot is already in bucket list
          const isAlreadyAdded = await this.bucketService.isInBucket(spotData.id);
          
          if (!isAlreadyAdded) {
            await this.bucketService.addToBucket(spotData);
            addedCount++;
          } else {
            skippedCount++;
          }
        } catch (error) {
          console.error('Error adding spot to bucket list:', error);
          skippedCount++;
        }
      }

      await loading.dismiss();

      let message = '';
      if (addedCount > 0) {
        message = `Successfully added ${addedCount} tourist spots to your bucket list!`;
        if (skippedCount > 0) {
          message += ` (${skippedCount} items were skipped - restaurants, hotels, or duplicates)`;
        }
        this.showAlert('Success', message);
      } else if (skippedCount > 0) {
        this.showAlert('Info', 'No tourist spots were available to copy. This itinerary only contains restaurants and hotels, or all spots are already in your bucket list.');
      } else {
        this.showAlert('Error', 'Failed to add spots to your bucket list');
      }

    } catch (error) {
      await loading.dismiss();
      console.error('Error copying itinerary to bucket list:', error);
      this.showAlert('Error', 'Failed to copy itinerary to your bucket list');
    }
  }

  private generateSpotId(spotName: string): string {
    // Generate a simple ID from the spot name
    return spotName.toLowerCase().replace(/\s+/g, '_').replace(/[^a-z0-9_]/g, '');
  }

  getTouristSpotsOnly(spots: any[]): any[] {
    return spots.filter(spot => (spot.type || 'tourist_spot') === 'tourist_spot');
  }

  getTouristSpotsCount(spots: any[]): number {
    return this.getTouristSpotsOnly(spots).length;
  }

  hasNonTouristSpots(spots: any[]): boolean {
    return spots.some(spot => (spot.type || 'tourist_spot') !== 'tourist_spot');
  }

}
