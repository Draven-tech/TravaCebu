import { Component, OnInit } from '@angular/core';
import { AlertController, NavController, ToastController } from '@ionic/angular';
import { PendingTouristSpotService, PendingTouristSpot } from '../../services/pending-tourist-spot.service';

@Component({
  selector: 'app-my-submissions',
  templateUrl: './my-submissions.page.html',
  styleUrls: ['./my-submissions.page.scss'],
  standalone: false,
})
export class MySubmissionsPage implements OnInit {
  submittedSpots: PendingTouristSpot[] = [];
  isLoading = true;
  selectedTab = 'pending';

  constructor(
    private alertCtrl: AlertController,
    private navCtrl: NavController,
    private toastCtrl: ToastController,
    private pendingSpotService: PendingTouristSpotService
  ) {}

  ngOnInit() {
    this.loadSubmissions();
  }

  loadSubmissions() {
    this.isLoading = true;
    this.pendingSpotService.getUserSubmittedSpots().subscribe((spots: PendingTouristSpot[]) => {
      this.submittedSpots = spots;
      this.isLoading = false;
    });
  }

  getSpotsByStatus(status: string): PendingTouristSpot[] {
    return this.submittedSpots.filter(spot => spot.status === status);
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

  formatDate(date: any): string {
    if (!date) return 'N/A';
    
    if (typeof date === 'object' && 'seconds' in date) {
      // Firestore Timestamp object
      const seconds = (date as any).seconds;
      if (typeof seconds === 'number') {
        return new Date(seconds * 1000).toLocaleDateString();
      }
    } else if (date instanceof Date) {
      // JavaScript Date object
      return date.toLocaleDateString();
    } else {
      // Try to convert string or number
      try {
        return new Date(date).toLocaleDateString();
      } catch {
        return 'N/A';
      }
    }
    return 'N/A';
  }

  async viewSpotDetails(spot: PendingTouristSpot) {
    // Fix the date conversion for Firestore timestamps
    let submittedDate = 'N/A';
    if (spot.submittedAt) {
      if (typeof spot.submittedAt === 'object' && 'seconds' in spot.submittedAt) {
        // Firestore Timestamp object
        const seconds = (spot.submittedAt as any).seconds;
        if (typeof seconds === 'number') {
          submittedDate = new Date(seconds * 1000).toLocaleDateString();
        }
      } else if (spot.submittedAt instanceof Date) {
        // JavaScript Date object
        submittedDate = spot.submittedAt.toLocaleDateString();
      } else {
        // Try to convert string or number
        submittedDate = new Date(spot.submittedAt).toLocaleDateString();
      }
    }

    const alert = await this.alertCtrl.create({
      header: spot.name,
      message: `
Description: ${spot.description}

Category: ${spot.category}

Location: ${spot.location.lat.toFixed(4)}, ${spot.location.lng.toFixed(4)}

Submitted on: ${submittedDate}

Status: ${spot.status.charAt(0).toUpperCase() + spot.status.slice(1)}

Rating: ${spot.rating || 'N/A'}

Total Ratings: ${spot.userRatingsTotal || 'N/A'}${spot.reviewNotes ? `

Admin Notes: ${spot.reviewNotes}` : ''}`,
      buttons: ['Close']
    });
    await alert.present();
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
    this.loadSubmissions();
    event.target.complete();
  }
}
