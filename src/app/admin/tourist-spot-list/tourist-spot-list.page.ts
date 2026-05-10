import { Component, OnInit } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AlertController, ModalController, NavController } from '@ionic/angular';
import { TouristSpotDetailPage } from '../tourist-spot-detail/tourist-spot-detail.page';
import { DatePipe } from '@angular/common';
import { StorageService } from '../../services/storage.service';
import { PlacesImageService } from '../../services/places-image.service';
import { firstValueFrom } from 'rxjs';

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

  /** TEMP: remove after all documents have Places metadata */
  bulkSyncRunning = false;
  bulkSyncDone = 0;
  bulkSyncTotal = 0;

  constructor(
    private firestore: AngularFirestore,
    private alertCtrl: AlertController,
    private modalCtrl: ModalController,
    private navCtrl: NavController,
    private storageService: StorageService,
    private placesImageService: PlacesImageService,
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

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }

  /**
   * TEMP: One-click backfill `img`, `googlePlaceTypes`, `exposure`, `googlePlaceId` for every `tourist_spots` doc.
   * Remove this flow after Firestore is fully migrated.
   */
  async tempBulkSyncAllSpotsFromGoogle(): Promise<void> {
    if (this.bulkSyncRunning) {
      return;
    }
    const alert = await this.alertCtrl.create({
      header: 'Reload all tourist spots?',
      message:
        'Documents that already have googlePlaceTypes (from a previous sync) are skipped — no Places call. ' +
        'All other spots are synced: primary image, googlePlaceTypes, exposure, googlePlaceId, updatedAt. ' +
        'Still uses quota for spots that still need syncing; keep the screen awake until finished.',
      buttons: [
        { text: 'Cancel', role: 'cancel' },
        {
          text: 'Start',
          handler: () => {
            void this.runTempBulkPlacesSync();
            return true;
          }
        }
      ]
    });
    await alert.present();
  }

  private async runTempBulkPlacesSync(): Promise<void> {
    this.bulkSyncRunning = true;
    this.bulkSyncDone = 0;
    let updated = 0;
    let skipped = 0;
    let skippedAlreadySynced = 0;
    let failed = 0;
    let noPlacesData = 0;

    try {
      const snap = await this.firestore.collection('tourist_spots').get().toPromise();
      const docs = snap?.docs ?? [];
      this.bulkSyncTotal = docs.length;

      this.placesImageService.clearCache();

      for (const doc of docs) {
        const data = doc.data() as Record<string, unknown>;
        const spot: any = { id: doc.id, ...data };

        if (
          !spot.name ||
          typeof spot.location?.lat !== 'number' ||
          typeof spot.location?.lng !== 'number' ||
          isNaN(spot.location.lat) ||
          isNaN(spot.location.lng)
        ) {
          skipped++;
          this.bulkSyncDone++;
          continue;
        }

        if (this.spotAlreadyHasPlacesMetadata(spot)) {
          skippedAlreadySynced++;
          this.bulkSyncDone++;
          continue;
        }

        try {
          const enhanced = await firstValueFrom(this.placesImageService.retryFetchImages(spot));
          const patch = this.placesImageService.getFirestoreUpdatePayload(enhanced);
          if (patch && Object.keys(patch).length > 0) {
            patch['updatedAt'] = new Date();
            await doc.ref.update(patch);
            updated++;
          } else {
            noPlacesData++;
          }
        } catch (err) {
          console.error('[tempBulkSync] failed for', doc.id, err);
          failed++;
        }

        this.bulkSyncDone++;
        await this.delay(400);
      }

      await this.showAlert(
        'Bulk reload finished',
        `Updated: ${updated}. ` +
          `Skipped (already had googlePlaceTypes): ${skippedAlreadySynced}. ` +
          `Skipped (missing name or lat/lng): ${skipped}. ` +
          `No Places match / empty payload: ${noPlacesData}. ` +
          `Errors: ${failed}.`
      );
    } finally {
      this.bulkSyncRunning = false;
      this.bulkSyncTotal = 0;
      this.bulkSyncDone = 0;
    }
  }

  bulkSyncProgress(): number {
    if (!this.bulkSyncTotal) {
      return 0;
    }
    return this.bulkSyncDone / this.bulkSyncTotal;
  }

  /** Non-empty Places `types[]` means we already did a Places Details sync — skip API */
  private spotAlreadyHasPlacesMetadata(spot: any): boolean {
    const types = spot?.googlePlaceTypes ?? spot?.google_place_types;
    return Array.isArray(types) && types.length > 0;
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
