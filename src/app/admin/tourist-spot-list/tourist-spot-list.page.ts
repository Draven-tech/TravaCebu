import { Component, OnInit } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AlertController, ModalController, NavController } from '@ionic/angular';
import { TouristSpotDetailPage } from '../tourist-spot-detail/tourist-spot-detail.page';
import { DatePipe } from '@angular/common';
import { StorageService } from '../../services/storage.service';

@Component({
  standalone: false,
  selector: 'app-tourist-spot-list',
  templateUrl: './tourist-spot-list.page.html',
  styleUrls: ['./tourist-spot-list.page.scss'],
})
export class TouristSpotListPage implements OnInit {
  spots: any[] = [];
  isLoading = true;
  searchQuery = '';

  constructor(
    private firestore: AngularFirestore,
    private alertCtrl: AlertController,
    private modalCtrl: ModalController,
    private navCtrl: NavController,
    private storageService: StorageService,
    public datePipe: DatePipe
  ) {}

  ngOnInit() {
    this.loadSpots();
  }

  loadSpots() {
    this.isLoading = true;
    this.firestore.collection('tourist_spots', ref => ref.orderBy('createdAt', 'desc'))
      .valueChanges({ idField: 'id' })
      .subscribe({
        next: (spots) => {
          // Convert Firestore Timestamps to JS Dates
          this.spots = spots.map((spot: any) => ({
            ...spot,
            createdAt: spot.createdAt && spot.createdAt.toDate ? spot.createdAt.toDate() : spot.createdAt,
            updatedAt: spot.updatedAt && spot.updatedAt.toDate ? spot.updatedAt.toDate() : spot.updatedAt
          }));
          this.isLoading = false;
        },
        error: (err) => {
          console.error('Error loading spots:', err);
          this.isLoading = false;
          this.showAlert('Error', 'Failed to load spots');
        }
      });
  }

  refreshSpots() {
    this.loadSpots();
  }

  async openSpotDetail(spotData: any) {
    const modal = await this.modalCtrl.create({
      component: TouristSpotDetailPage,
      componentProps: {
        spot: spotData
      }
    });
    await modal.present();
  }
  
  editSpot(spot: any) {
    this.navCtrl.navigateForward(['/admin/tourist-spot-editor'], {
      state: { spot } // Changed to pass object directly
    });
  }
  navigateToEditor() {
    this.navCtrl.navigateForward('/admin/tourist-spot-editor');
  }

  async deleteSpot(id: string) {
    const alert = await this.alertCtrl.create({
      header: 'Confirm Delete',
      message: 'Are you sure you want to delete this tourist spot? This will also delete the associated image.',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Delete',
          handler: async () => {
            try {
              // First, get the spot data to find the image URL
              const spotDoc = await this.firestore.collection('tourist_spots').doc(id).get().toPromise();
              const spotData = spotDoc?.data() as any;
              
              // Delete the image from storage if it exists
              if (spotData?.img) {
                await this.storageService.deleteFileByURL(spotData.img);
                console.log('Image deleted from storage:', spotData.img);
              }
              
              // Delete the Firestore document
              await this.firestore.collection('tourist_spots').doc(id).delete();
              
              this.showAlert('Success', 'Tourist spot and associated image deleted successfully');
            } catch (err) {
              console.error('Error deleting tourist spot:', err);
              this.showAlert('Error', 'Failed to delete tourist spot');
            }
          }
        }
      ]
    });
    await alert.present();
  }

  private async showAlert(header: string, message: string) {
    const alert = await this.alertCtrl.create({
      header,
      message,
      buttons: ['OK']
    });
    await alert.present();
  }

  filterSpots() {
    if (!this.searchQuery) {
      return this.spots;
    }
    return this.spots.filter(spot => 
      spot.name.toLowerCase().includes(this.searchQuery.toLowerCase()) ||
      spot.description.toLowerCase().includes(this.searchQuery.toLowerCase())
    );
  }
}