import { Component, Input } from '@angular/core';
import { ModalController } from '@ionic/angular';
import { ItineraryEditorComponent } from './itinerary-editor.component';
import { ItineraryService, ItineraryDay, ItinerarySpot } from '../services/itinerary.service';

@Component({
  selector: 'app-itinerary-modal',
  template: `
    <ion-header>
      <ion-toolbar color="warning">
        <ion-title>Your Itinerary</ion-title>
        <ion-buttons slot="end">
          <ion-button (click)="editItinerary()">
            <ion-icon name="create-outline"></ion-icon>
            Edit
          </ion-button>
          <ion-button (click)="close()">
            <ion-icon name="close"></ion-icon>
          </ion-button>
        </ion-buttons>
      </ion-toolbar>
    </ion-header>

    <ion-content>
      <div class="itinerary-container">
        <div *ngFor="let day of itinerary" class="day-section">
          <h3 class="day-title">Day {{ day.day }}</h3>
          <div *ngFor="let spot of day.spots; let i = index" class="spot-item">
            <div class="spot-name">{{ i + 1 }}. {{ spot.name }}</div>
            <div class="spot-details">
              <span class="time">⏰ {{ spot.timeSlot }}</span>
              <span class="duration">⏱️ {{ spot.estimatedDuration }}</span>
            </div>
            <div class="spot-category">📍 {{ spot.category }}</div>
            <div *ngIf="spot.mealType">
              <div *ngIf="spot.chosenRestaurant">
                <strong>Chosen Restaurant:</strong>
                <a [href]="getGoogleMapsUrl(spot.chosenRestaurant)" target="_blank">{{ spot.chosenRestaurant.name }}</a>
                <ion-button size="small" fill="clear" color="danger" (click)="clearRestaurantChoice(spot)">Clear</ion-button>
              </div>
              <div *ngIf="!spot.chosenRestaurant && spot.restaurantSuggestions && spot.restaurantSuggestions.length > 0">
                <div class="restaurant-title">Choose a Restaurant:</div>
                <ul>
                  <li *ngFor="let rest of spot.restaurantSuggestions | slice:0:3">
                    <a [href]="getGoogleMapsUrl(rest)" target="_blank">{{ rest.name }}</a>
                    <span *ngIf="rest.rating"> ({{ rest.rating }}★)</span>
                    <ion-button size="small" fill="outline" color="success" (click)="chooseRestaurant(spot, rest)">Choose</ion-button>
                  </li>
                </ul>
                <ion-button size="small" fill="clear" color="medium" (click)="skipRestaurant(spot)">Skip</ion-button>
              </div>
              <div *ngIf="!spot.chosenRestaurant && (!spot.restaurantSuggestions || spot.restaurantSuggestions.length === 0)">
                <em>Restaurant suggestions will appear here after saving.</em>
              </div>
            </div>
          </div>
          <div *ngIf="day.hotelSuggestions && day.hotelSuggestions.length > 0">
            <div *ngIf="day.chosenHotel">
              <strong>Chosen Hotel:</strong>
              <a [href]="getAgodaUrl(day.chosenHotel)" target="_blank">{{ day.chosenHotel.name }}</a>
              <ion-button size="small" fill="clear" color="danger" (click)="clearHotelChoice(day)">Clear</ion-button>
            </div>
            <div *ngIf="!day.chosenHotel">
              <div class="hotel-title">Choose a Hotel (End of Day):</div>
              <ul>
                <li *ngFor="let hotel of day.hotelSuggestions | slice:0:3">
                  <span>{{ hotel.name }}</span>
                  <span *ngIf="hotel.rating"> ({{ hotel.rating }}★)</span>
                  <ion-button size="small" fill="outline" color="success" (click)="chooseHotel(day, hotel)">Choose</ion-button>
                  <ion-button size="small" fill="outline" color="primary" [href]="getAgodaUrl(hotel)" target="_blank">Book Now</ion-button>
                </li>
              </ul>
              <ion-button size="small" fill="clear" color="medium" (click)="skipHotel(day)">Skip</ion-button>
            </div>
          </div>
          <div *ngIf="!day.hotelSuggestions && day.spots.length > 0">
            <em>Hotel suggestions will appear here after saving.</em>
          </div>
        </div>
      </div>
    </ion-content>

    <ion-footer>
      <ion-toolbar>
        <ion-button expand="block" color="success" (click)="fetchSuggestions()" [disabled]="fetchingSuggestions">
          <ion-spinner *ngIf="fetchingSuggestions" name="crescent"></ion-spinner>
          <span *ngIf="!fetchingSuggestions">Save & Fetch Suggestions</span>
        </ion-button>
        <ion-button expand="block" color="warning" (click)="saveToNotes()">
          Save to Notes
        </ion-button>
        <ion-button expand="block" fill="clear" (click)="close()">
          Close
        </ion-button>
      </ion-toolbar>
    </ion-footer>
  `,
  styles: [`
    .itinerary-container {
      padding: 16px;
    }
    .day-section {
      margin-bottom: 24px;
    }
    .day-title {
      color: #e74c3c;
      font-size: 1.3rem;
      font-weight: 700;
      margin: 16px 0 12px 0;
      border-bottom: 2px solid #e74c3c;
      padding-bottom: 8px;
    }
    .spot-item {
      background: #f8f9fa;
      border-radius: 12px;
      padding: 16px;
      margin: 12px 0;
      border-left: 4px solid #e74c3c;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }
    .spot-name {
      font-size: 1.1rem;
      font-weight: 700;
      color: #2D3748;
      margin-bottom: 8px;
    }
    .spot-details {
      margin-bottom: 6px;
    }
    .time, .duration {
      color: #6c757d;
      font-size: 0.9rem;
      margin-right: 16px;
    }
    .spot-category {
      color: #e74c3c;
      font-size: 0.85rem;
      font-weight: 600;
      text-transform: uppercase;
    }
    .restaurant-section {
      margin-top: 8px;
      font-size: 0.95rem;
    }
    .restaurant-title {
      font-weight: 600;
      color: #2D3748;
      margin-bottom: 4px;
    }
    .hotel-section {
      margin-top: 16px;
      font-size: 0.95rem;
    }
    .hotel-title {
      font-weight: 600;
      color: #2D3748;
      margin-bottom: 4px;
    }
  `],
  standalone: false
})
export class ItineraryModalComponent {
  @Input() itinerary: ItineraryDay[] = [];
  fetchingSuggestions = false;

  constructor(private modalCtrl: ModalController, private itineraryService: ItineraryService) {}

  async fetchSuggestions() {
    this.fetchingSuggestions = true;
    this.itinerary = await this.itineraryService.fetchSuggestionsForItinerary(this.itinerary);
    this.fetchingSuggestions = false;
  }

  chooseRestaurant(spot: ItinerarySpot, restaurant: any) {
    spot.chosenRestaurant = restaurant;
  }
  skipRestaurant(spot: ItinerarySpot) {
    spot.chosenRestaurant = { name: 'User will decide on the day' };
  }
  clearRestaurantChoice(spot: ItinerarySpot) {
    spot.chosenRestaurant = undefined;
  }

  chooseHotel(day: ItineraryDay, hotel: any) {
    day.chosenHotel = hotel;
  }
  skipHotel(day: ItineraryDay) {
    day.chosenHotel = { name: 'User will decide on the day' };
  }
  clearHotelChoice(day: ItineraryDay) {
    day.chosenHotel = undefined;
  }

  async editItinerary() {
    // Get all spots from the itinerary to use as available spots
    const allSpots = this.itinerary.reduce((spots: any[], day: ItineraryDay) => {
      return spots.concat(day.spots);
    }, []);
    
    const modal = await this.modalCtrl.create({
      component: ItineraryEditorComponent,
      componentProps: {
        itinerary: this.itinerary,
        availableSpots: allSpots // Pass all spots as available for editing
      },
      cssClass: 'itinerary-editor-modal'
    });
    modal.onDidDismiss().then(result => {
      if (result.data) {
        this.itinerary = result.data;
      }
    });
    await modal.present();
  }

  close() {
    this.modalCtrl.dismiss();
  }

  saveToNotes() {
    let notes = '=== MY CEBU ITINERARY ===\n\n';
    this.itinerary.forEach(day => {
      notes += `DAY ${day.day}\n`;
      notes += '='.repeat(20) + '\n';
      day.spots.forEach((spot: any, index: number) => {
        notes += `${index + 1}. ${spot.name}\n`;
        notes += `   Time: ${spot.timeSlot}\n`;
        notes += `   Duration: ${spot.estimatedDuration}\n`;
        notes += `   Category: ${spot.category}\n`;
        if (spot.description) {
          notes += `   Notes: ${spot.description}\n`;
        }
        if (spot.chosenRestaurant) {
          notes += `   Restaurant: ${spot.chosenRestaurant.name}\n`;
        }
        notes += '\n';
      });
      if (day.chosenHotel) {
        notes += `Hotel: ${day.chosenHotel.name}\n`;
      }
      notes += '\n';
    });
    // Copy to clipboard
    if (navigator.clipboard) {
      navigator.clipboard.writeText(notes).then(() => {
        this.showAlert('Saved!', 'Itinerary copied to clipboard. You can paste it in your notes app.');
      }).catch(() => {
        this.showAlert('Itinerary Generated', 'Please manually copy the itinerary.');
      });
    } else {
      this.showAlert('Itinerary Generated', 'Please manually copy the itinerary.');
    }
  }

  getGoogleMapsUrl(place: any): string {
    return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}`;
  }

  getAgodaUrl(hotel: any): string {
    // Use Agoda search with hotel name
    return `https://www.agoda.com/search?city=cebu&query=${encodeURIComponent(hotel.name)}`;
  }

  private async showAlert(header: string, message: string) {
    // You can implement a simple alert here or use a toast
    console.log(`${header}: ${message}`);
  }
} 