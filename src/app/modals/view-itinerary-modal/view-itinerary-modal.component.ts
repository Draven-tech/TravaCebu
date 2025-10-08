import { Component, Input } from '@angular/core';
import { ModalController } from '@ionic/angular';

export interface ViewItinerarySpot {
  id: string;
  name: string;
  description: string;
  category: string;
  timeSlot: string;
  estimatedDuration: string;
  location: { lat: number; lng: number };
  mealType?: string;
  chosenRestaurant?: any;
}

export interface ViewItineraryDay {
  day: number;
  date: string;
  spots: ViewItinerarySpot[];
  restaurants: ViewItinerarySpot[];
  hotels: ViewItinerarySpot[];
  chosenHotel?: any;
}

@Component({
  standalone: false,
  selector: 'app-view-itinerary-modal',
  templateUrl: './view-itinerary-modal.component.html',
  styleUrls: ['./view-itinerary-modal.component.scss']
})
export class ViewItineraryModalComponent {
  @Input() itinerary: ViewItineraryDay[] = [];

  constructor(private modalCtrl: ModalController) {}

  sortByTimeSlot(items: any[]): any[] {
    if (!items || items.length === 0) {
      return items;
    }

    return items.sort((a, b) => {
      const timeA = a.timeSlot || '00:00';
      const timeB = b.timeSlot || '00:00';
      
      // Convert time strings to comparable values
      const [hoursA, minutesA] = timeA.split(':').map(Number);
      const [hoursB, minutesB] = timeB.split(':').map(Number);
      
      const totalMinutesA = hoursA * 60 + minutesA;
      const totalMinutesB = hoursB * 60 + minutesB;
      
      return totalMinutesA - totalMinutesB; // Ascending order (earliest first)
    });
  }

  close() {
    this.modalCtrl.dismiss();
  }

  getDateDisplay(dateString: string): string {
    if (!dateString) return 'Unknown date';
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }

  getTimeDisplay(dateTimeString: string): string {
    if (!dateTimeString) return 'Unknown time';
    const date = new Date(dateTimeString);
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  }

  getCategoryIcon(category: string): string {
    switch (category?.toUpperCase()) {
      case 'RESTAURANT':
        return 'ðŸ½ï¸';
      case 'HOTEL':
        return 'ðŸ¨';
      case 'ATTRACTION':
        return 'ðŸŽ¯';
      case 'SHOPPING':
        return 'ðŸ›ï¸';
      case 'CULTURAL':
        return 'ðŸ›ï¸';
      case 'NATURE':
        return 'ðŸŒ¿';
      default:
        return 'ðŸ“';
    }
  }

  getMealTypeIcon(mealType: string): string {
    switch (mealType?.toLowerCase()) {
      case 'breakfast':
        return 'ðŸŒ…';
      case 'lunch':
        return 'â˜€ï¸';
      case 'dinner':
        return 'ðŸŒ™';
      case 'snack':
        return 'ðŸ¿';
      default:
        return 'ðŸ½ï¸';
    }
  }
}
