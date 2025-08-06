import { Component, OnInit } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AlertController, NavController, ToastController } from '@ionic/angular';
import { AuthService } from '../../services/auth.service';
import { PendingTouristSpotService, PendingTouristSpot } from '../../services/pending-tourist-spot.service';

@Component({
  selector: 'app-pending-spots',
  templateUrl: './pending-spots.page.html',
  styleUrls: ['./pending-spots.page.scss'],
  standalone: false,
})
export class PendingSpotsPage implements OnInit {
  pendingSpots: PendingTouristSpot[] = [];
  approvedSpots: PendingTouristSpot[] = [];
  rejectedSpots: PendingTouristSpot[] = [];
  isLoading = true;
  selectedTab = 'pending';
  reviewNotes = '';

  constructor(
    private firestore: AngularFirestore,
    private alertCtrl: AlertController,
    private navCtrl: NavController,
    private toastCtrl: ToastController,
    private authService: AuthService,
    private pendingSpotService: PendingTouristSpotService
  ) {}

  async ngOnInit() {
    await this.checkAdminAccess();
    this.loadSpots();
  }

  async checkAdminAccess() {
    const isAdmin = await this.authService.isAdmin();
    if (!isAdmin) {
      this.showAlert('Access Denied', 'You must be logged in as an admin to access this page.');
      this.navCtrl.navigateBack('/admin/login');
      return;
    }
  }

  loadSpots() {
    this.isLoading = true;

    // Load pending spots
    this.pendingSpotService.getPendingSpots().subscribe((spots: PendingTouristSpot[]) => {
      this.pendingSpots = spots;
      this.isLoading = false;
    }, error => {
      console.error('Error loading pending spots:', error);
      this.isLoading = false;
    });

    // Load approved spots
    this.pendingSpotService.getSpotsByStatus('approved').subscribe((spots: PendingTouristSpot[]) => {
      this.approvedSpots = spots;
    }, error => {
      console.error('Error loading approved spots:', error);
    });

    // Load rejected spots
    this.pendingSpotService.getSpotsByStatus('rejected').subscribe((spots: PendingTouristSpot[]) => {
      this.rejectedSpots = spots;
    }, error => {
      console.error('Error loading rejected spots:', error);
    });
  }

  async approveSpot(spot: PendingTouristSpot) {
    const alert = await this.alertCtrl.create({
      header: 'Approve Tourist Spot',
      message: `Are you sure you want to approve "${spot.name}"?`,
      inputs: [
        {
          name: 'notes',
          type: 'textarea',
          placeholder: 'Optional review notes...',
          value: this.reviewNotes
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Approve',
          handler: async (data) => {
            try {
              await this.pendingSpotService.approveSpot(spot.id!, data.notes);
              this.showToast(`"${spot.name}" has been approved!`, 'success');
              this.reviewNotes = '';
              // Reload data to update the UI immediately
              this.loadSpots();
            } catch (error) {
              console.error('Error approving spot:', error);
              this.showToast('Error approving spot', 'danger');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async rejectSpot(spot: PendingTouristSpot) {
    const alert = await this.alertCtrl.create({
      header: 'Reject Tourist Spot',
      message: `Are you sure you want to reject "${spot.name}"?`,
      inputs: [
        {
          name: 'notes',
          type: 'textarea',
          placeholder: 'Please provide a reason for rejection...',
          value: this.reviewNotes
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Reject',
          handler: async (data) => {
            if (!data.notes || data.notes.trim() === '') {
              this.showToast('Please provide a reason for rejection', 'warning');
              return;
            }
            try {
              await this.pendingSpotService.rejectSpot(spot.id!, data.notes);
              this.showToast(`"${spot.name}" has been rejected.`, 'warning');
              this.reviewNotes = '';
              // Reload data to update the UI immediately
              this.loadSpots();
            } catch (error) {
              console.error('Error rejecting spot:', error);
              this.showToast('Error rejecting spot', 'danger');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async deleteSpot(spot: PendingTouristSpot) {
    const alert = await this.alertCtrl.create({
      header: 'Delete Submission',
      message: `Are you sure you want to permanently delete "${spot.name}"? This action cannot be undone.`,
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
              await this.pendingSpotService.deletePendingSpot(spot.id!);
              this.showToast(`"${spot.name}" has been deleted.`, 'success');
              // Reload data to update the UI immediately
              this.loadSpots();
            } catch (error) {
              console.error('Error deleting spot:', error);
              this.showToast('Error deleting spot', 'danger');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  async viewSpotDetails(spot: PendingTouristSpot) {
    const alert = await this.alertCtrl.create({
      header: spot.name,
      message: `
        <strong>Description:</strong> ${spot.description}<br><br>
        <strong>Category:</strong> ${spot.category}<br><br>
        <strong>Location:</strong> ${spot.location.lat}, ${spot.location.lng}<br><br>
        <strong>Submitted by:</strong> ${spot.submittedByEmail}<br><br>
        <strong>Submitted on:</strong> ${new Date(spot.submittedAt).toLocaleDateString()}<br><br>
        <strong>Rating:</strong> ${spot.rating || 'N/A'}<br><br>
        <strong>Total Ratings:</strong> ${spot.userRatingsTotal || 'N/A'}
      `,
      buttons: ['Close']
    });
    await alert.present();
  }

  getStatusColor(status: string): string {
    switch (status) {
      case 'pending': return 'warning';
      case 'approved': return 'success';
      case 'rejected': return 'danger';
      default: return 'medium';
    }
  }

  getStatusIcon(status: string): string {
    switch (status) {
      case 'pending': return 'time-outline';
      case 'approved': return 'checkmark-circle-outline';
      case 'rejected': return 'close-circle-outline';
      default: return 'help-circle-outline';
    }
  }

  async showAlert(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['OK']
    });
    await alert.present();
  }

  async showToast(message: string, color: string) {
    const toast = await this.toastCtrl.create({
      message,
      duration: 3000,
      color,
      position: 'top'
    });
    toast.present();
  }

  refreshData(event: any) {
    this.loadSpots();
    event.target.complete();
  }
} 