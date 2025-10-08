import { Component, Input, OnInit, OnDestroy } from '@angular/core';
import { IonicModule, ModalController, AlertController, ToastController } from '@ionic/angular';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { BudgetService, BudgetSummary } from '../../services/budget.service';
import { PlacesService } from '../../services/places.service';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-route-details-overlay',
  templateUrl: './route-details-overlay.component.html',
  styleUrls: ['./route-details-overlay.component.scss'],
  standalone: false,
})
export class RouteDetailsOverlayComponent implements OnInit, OnDestroy {
  @Input() routeInfo: any;
  @Input() itineraryId?: string;
  @Input() currentItinerary?: any;
  selectedAlternativeIndex: number = -1; // -1 means main route, 0+ means alternative
  budgetSummary?: BudgetSummary;
  availableRestaurants: any[] = [];
  availableHotels: any[] = [];
  
  private subscriptions: Subscription[] = [];

  constructor(
    private budgetService: BudgetService,
    private modalCtrl: ModalController,
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private placesService: PlacesService
  ) {}

  ngOnInit() {
    // Prevent body scroll when overlay is open
    document.body.style.overflow = 'hidden';
    
    // Load budget data if itineraryId is provided
    if (this.itineraryId) {
      this.loadBudgetData();
    }
    
    // Load restaurants and hotels from itinerary for dropdowns
    this.loadItineraryPlaces();
  }

  ngOnDestroy() {
    // Restore body scroll when overlay is closed
    document.body.style.overflow = '';
    
    // Clean up subscriptions
    this.subscriptions.forEach(sub => sub.unsubscribe());
  }

  private loadBudgetData() {
    if (!this.itineraryId) {
      console.warn('âš ï¸ No itineraryId provided for budget data');
      return;
    }

    const budgetSubscription = this.budgetService.getBudgetSummary(this.itineraryId)
      .subscribe(summary => {
        this.budgetSummary = summary;
      });
    this.subscriptions.push(budgetSubscription);
  }

  private loadItineraryPlaces() {
    this.availableRestaurants = [];
    this.availableHotels = [];

    if (!this.currentItinerary) {
      return;
    }

    // Extract restaurants and hotels from itinerary spots
    if (this.currentItinerary.days) {
      this.currentItinerary.days.forEach((day: any) => {
        // Get restaurants and hotels from spots (they are stored as separate events)
        day.spots?.forEach((spot: any) => {
          // Check if this spot is a restaurant
          if (spot.eventType === 'restaurant') {
            this.availableRestaurants.push({
              name: spot.name,
              rating: spot.rating,
              vicinity: spot.vicinity
            });
          }
          
          // Check if this spot is a hotel
          if (spot.eventType === 'hotel') {
            this.availableHotels.push({
              name: spot.name,
              rating: spot.rating,
              vicinity: spot.vicinity
            });
          }
          
          // Also check for traditional chosenRestaurant/chosenHotel structure (backup)
          if (spot.chosenRestaurant) {
            this.availableRestaurants.push(spot.chosenRestaurant);
          }
          if (spot.chosenHotel) {
            this.availableHotels.push(spot.chosenHotel);
          }
        });
      });
    }

    // Remove duplicates based on name
    this.availableRestaurants = this.removeDuplicatePlaces(this.availableRestaurants);
    this.availableHotels = this.removeDuplicatePlaces(this.availableHotels);
    
    console.log('Available restaurants:', this.availableRestaurants);
    console.log('Available hotels:', this.availableHotels);
  }

  private removeDuplicatePlaces(places: any[]): any[] {
    const seen = new Set();
    return places.filter(place => {
      const name = place.name;
      if (seen.has(name)) {
        return false;
      }
      seen.add(name);
      return true;
    });
  }

  getRouteSteps(segment: any): any[] {
    const steps = [];
    
    // Handle API routes (Google Directions)
    if (segment.mode === 'walking' || segment.mode === 'WALKING' || 
        (segment.polylines && segment.polylines.some((polyline: any) => polyline.mode === 'WALKING'))) {
      steps.push({
        type: 'walk',
        duration: segment.duration || 'Unknown',
        icon: 'walk'
      });
    } else if (segment.mode === 'transit' || segment.mode === 'TRANSIT' ||
               (segment.polylines && segment.polylines.some((polyline: any) => polyline.mode === 'TRANSIT'))) {
      const transitType = segment.transitType || 'bus';
      steps.push({
        type: transitType,
        duration: segment.duration || 'Unknown',
        code: segment.transitDetails || 'Transit',
        icon: transitType === 'jeepney' ? 'car' : 'bus'
      });
    }
    
    return steps.length > 0 ? steps : [{
      type: 'walk',
      duration: '30 min',
      icon: 'walk'
    }];
  }

  getStepIcon(type: string): string {
    switch (type) {
      case 'walk': return 'walk';
      case 'jeepney': return 'car';
      case 'bus': return 'bus';
      default: return 'walk';
    }
  }

  getStepColor(type: string): string {
    switch (type) {
      case 'walk': return 'success';
      case 'jeepney': return 'warning';
      case 'bus': return 'primary';
      default: return 'success';
    }
  }

  getCurrentTime(): string {
    const now = new Date();
    const hours = now.getHours().toString().padStart(2, '0');
    const minutes = now.getMinutes().toString().padStart(2, '0');
    return `${hours}:${minutes}`;
  }

  getEstimatedFare(): string {
    if (!this.routeInfo?.segments) {
      return 'â‚±0';
    }

    let jeepneyCount = 0;

    // Count jeepney and bus segments
    this.routeInfo.segments.forEach((segment: any) => {
      if ((segment.type === 'jeepney' || segment.type === 'bus') && segment.jeepneyCode) {
        jeepneyCount++;
      }
    });

    if (jeepneyCount === 0) {
      return 'â‚±0';
    }

    // Standard jeepney fare in Cebu is â‚±12-15 per ride
    const minFare = jeepneyCount * 12;
    const maxFare = jeepneyCount * 15;

    if (minFare === maxFare) {
      return `â‚±${minFare}`;
    }

    return `â‚±${minFare}-${maxFare}`;
  }

  // Get individual segment fare range
  getSegmentFare(segment: any): string {
    if (segment.type === 'jeepney' || segment.type === 'bus') {
      return 'â‚±12-15'; // Standard jeepney/bus fare range in Cebu
    }
    return segment.fare || ''; // Return existing fare if available
  }

  getRouteAlternatives(): any[] {
    if (this.routeInfo?.alternatives) {
      return this.routeInfo.alternatives;
    }
    return [];
  }

  getCurrentRouteSegments(): any[] {
    if (this.selectedAlternativeIndex >= 0 && this.routeInfo?.alternatives) {
      // Return segments from selected alternative route
      return this.routeInfo.alternatives[this.selectedAlternativeIndex].segments;
    }
    // Return segments from main route
    return this.routeInfo?.segments || [];
  }

  selectAlternative(index: number): void {
    this.selectedAlternativeIndex = index;
  }

  startNavigation() {
    // Implement navigation logic
    this.close();
  }

  shareRoute() {
    // Implement share logic
    this.close();
  }

  close() {
    // Remove the overlay from DOM
    const overlay = document.querySelector('app-route-details-overlay');
    if (overlay) {
      overlay.remove();
    }
  }

  // Budget Tracking Methods (Quick logging only)

  async addQuickTransportExpense() {
    const estimatedFare = this.getEstimatedFare();
    // Extract average from range (e.g., "â‚±12-15" -> 13.5, "â‚±26" -> 26)
    let fareAmount = 13; // Default fallback
    
    if (estimatedFare.includes('-')) {
      const rangeParts = estimatedFare.replace('â‚±', '').split('-');
      const min = parseFloat(rangeParts[0]);
      const max = parseFloat(rangeParts[1]);
      fareAmount = Math.round((min + max) / 2); // Use middle of range
    } else {
      fareAmount = parseFloat(estimatedFare.replace('â‚±', '')) || 13;
    }

    const alert = await this.alertCtrl.create({
      header: 'Log Transportation Expense',
      subHeader: 'How much did you actually pay for this route?',
      message: `Estimated fare: ${estimatedFare} (You can adjust this amount)`,
      inputs: [
        {
          name: 'amount',
          type: 'number',
          placeholder: 'Actual amount paid (â‚±)',
          value: fareAmount,
          min: 0
        },
        {
          name: 'description',
          type: 'text',
          placeholder: 'Transportation details',
          value: this.getTransportDescription()
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Log Expense',
          handler: async (data) => {
            if (data.amount && parseFloat(data.amount) > 0) {
              try {
                await this.budgetService.addTransportationExpense(
                  parseFloat(data.amount),
                  data.description || 'Transportation expense',
                  this.getJeepneyCodesFromRoute(),
                  this.itineraryId,
                  undefined // dayNumber is undefined for route-level expenses
                );
                await this.showToast('Transportation expense logged!', 'success');
                // Refresh budget data to update total after a short delay
                setTimeout(() => {
                  this.loadBudgetData();
                }, 500);
              } catch (error) {
                console.error('Error logging transport expense:', error);
                await this.showToast('Failed to log expense', 'danger');
              }
            } else {
              await this.showToast('Please enter a valid amount', 'warning');
              return false;
            }
            return true;
          }
        }
      ]
    });

    await alert.present();
  }

  async addQuickFoodExpense() {
    if (this.availableRestaurants.length === 0) {
      await this.showToast('No restaurants found in your itinerary', 'warning');
      return;
    }

    // First, let user select restaurant
    const restaurantAlert = await this.alertCtrl.create({
      header: 'Select Restaurant',
      inputs: this.availableRestaurants.map((restaurant, index) => ({
        name: 'restaurant',
        type: 'radio' as const,
        label: restaurant.name,
        value: restaurant.name,
        checked: index === 0
      })),
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Continue',
          handler: (selectedRestaurant) => {
            this.showAmountInput('food', selectedRestaurant);
          }
        }
      ]
    });

    await restaurantAlert.present();
  }

  async addQuickAccommodationExpense() {
    if (this.availableHotels.length === 0) {
      await this.showToast('No hotels found in your itinerary', 'warning');
      return;
    }

    // First, let user select hotel
    const hotelAlert = await this.alertCtrl.create({
      header: 'Select Hotel',
      inputs: this.availableHotels.map((hotel, index) => ({
        name: 'hotel',
        type: 'radio' as const,
        label: hotel.name,
        value: hotel.name,
        checked: index === 0
      })),
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Continue',
          handler: (selectedHotel) => {
            this.showAmountInput('accommodation', selectedHotel);
          }
        }
      ]
    });

    await hotelAlert.present();
  }

  private async showAmountInput(category: 'food' | 'accommodation', placeName: string) {
    const alert = await this.alertCtrl.create({
      header: `Log ${category.charAt(0).toUpperCase() + category.slice(1)} Expense`,
      subHeader: `At ${placeName}`,
      inputs: [
        {
          name: 'amount',
          type: 'number' as const,
          placeholder: 'Amount spent (â‚±)',
          min: 0
        }
      ],
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Log Expense',
          handler: async (data) => {
            if (data.amount && parseFloat(data.amount) > 0) {
              try {
                if (category === 'food') {
                  await this.budgetService.addFoodExpense(
                    parseFloat(data.amount),
                    placeName,
                    'meal',
                    this.itineraryId,
                    undefined
                  );
                } else {
                  await this.budgetService.addAccommodationExpense(
                    parseFloat(data.amount),
                    placeName,
                    1,
                    this.itineraryId,
                    undefined
                  );
                }
                await this.showToast(`${category.charAt(0).toUpperCase() + category.slice(1)} expense logged!`, 'success');
                // Refresh budget data to update total after a short delay
                setTimeout(() => {
                  this.loadBudgetData();
                }, 500);
              } catch (error) {
                console.error(`Error logging ${category} expense:`, error);
                await this.showToast('Failed to log expense', 'danger');
              }
            } else {
              await this.showToast('Please enter an amount', 'warning');
              return false;
            }
            return true;
          }
        }
      ]
    });

    await alert.present();
  }

  private getTransportDescription(): string {
    const jeepneyCodes = this.getJeepneyCodesFromRoute();
    if (jeepneyCodes) {
      return `Jeepney ride (${jeepneyCodes})`;
    }
    return 'Transportation expense';
  }

  private getJeepneyCodesFromRoute(): string {
    if (!this.routeInfo?.segments) return '';
    
    const codes = this.routeInfo.segments
      .filter((segment: any) => segment.jeepneyCode)
      .map((segment: any) => segment.jeepneyCode)
      .join(', ');
    
    return codes;
  }

  private async showToast(message: string, color: 'success' | 'warning' | 'danger' = 'success') {
    const toast = await this.toastCtrl.create({
      message,
      duration: 2000,
      color,
      position: 'bottom'
    });
    await toast.present();
  }
}

