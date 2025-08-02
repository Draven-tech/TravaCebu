import { Component, ViewChild, OnInit, ElementRef  } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AuthService } from '../services/auth.service';
import { NavController, AlertController } from '@ionic/angular';
import { StorageService } from '../services/storage.service';
import { ActionSheetController, ModalController } from '@ionic/angular';
import { ViewProfilePictureComponent } from '../modals/view-profile-picture/view-profile-picture.component';
import { EditProfileModalComponent } from '../modals/edit-profile-modal/edit-profile-modal.component';
import { MenuController } from '@ionic/angular';
import { CreatePostModalComponent } from '../modals/create-post-modal/create-post-modal.component';
import { CommentsModalComponent } from '../modals/comments-modal/comments-modal.component';

// Post interface
interface Post {
  id?: string;
  userId: string;
  userName: string;
  userPhotoURL: string;
  content?: string;
  imageUrl?: string;
  touristSpotId?: string;
  touristSpotName?: string;
  touristSpotLocation?: any;
  likes?: string[];
  comments?: Comment[];
  timestamp: any;
  isPublic: boolean;
  liked?: boolean; // For UI state
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
    private menuCtrl: MenuController
  ) {}

  async ngOnInit() {
    // Get Firebase Auth UID
    const currentUser = await this.afAuth.currentUser;
    this.userId = this.route.snapshot.paramMap.get('uid') ?? currentUser?.uid ?? null;
    if (!this.userId) {
      return;
    }
    
    // Load user profile data
    this.firestore.collection('users').doc(this.userId).valueChanges().subscribe(data => {
      this.userData = data;
    });

    this.menuCtrl.enable(true, 'main-menu');
    
    // Load posts
    this.loadPosts();
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
}
