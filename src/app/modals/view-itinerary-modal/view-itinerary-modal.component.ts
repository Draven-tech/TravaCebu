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
      const totalMinutesA = this.parseTimeSlotToMinutes(a.timeSlot || '00:00');
      const totalMinutesB = this.parseTimeSlotToMinutes(b.timeSlot || '00:00');
      return totalMinutesA - totalMinutesB;
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
    if (isNaN(date.getTime())) {
      return 'Unknown time';
    }
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  }

  /** Handles plain HH:mm or same-day ranges like "09:00 – 17:00" (en dash or hyphen). */
  getSpotTimeDisplay(dayDate: string, timeSlot: string): string {
    if (!timeSlot) return 'Unknown time';
    const trimmed = String(timeSlot).trim();
    if (!dayDate) return trimmed || 'Unknown time';
    const rangeParts = trimmed.split(/\s*[–-]\s*/).map((s) => s.trim()).filter(Boolean);
    const hmRe = /^(\d{1,2}):(\d{2})$/;

    if (rangeParts.length === 2 && hmRe.test(rangeParts[0]) && hmRe.test(rangeParts[1])) {
      const a = this.formatClockOnDay(dayDate, rangeParts[0]);
      const b = this.formatClockOnDay(dayDate, rangeParts[1]);
      return `${a} – ${b}`;
    }

    if (hmRe.test(trimmed)) {
      return this.formatClockOnDay(dayDate, trimmed);
    }

    const fallback = new Date(`${dayDate}T${trimmed}`);
    return isNaN(fallback.getTime()) ? trimmed : this.getTimeDisplay(`${dayDate}T${trimmed}`);
  }

  private parseTimeSlotToMinutes(timeSlot: string): number {
    const m = String(timeSlot).match(/(\d{1,2}):(\d{2})/);
    if (!m) return 0;
    const hours = Number(m[1]);
    const minutes = Number(m[2]);
    if (Number.isNaN(hours) || Number.isNaN(minutes)) return 0;
    return hours * 60 + minutes;
  }

  private formatClockOnDay(dayDate: string, hm: string): string {
    const normalized = this.normalizeHm(hm);
    const d = new Date(`${dayDate}T${normalized}:00`);
    if (isNaN(d.getTime())) return hm;
    return d.toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });
  }

  private normalizeHm(hm: string): string {
    const parts = hm.split(':');
    const h = Number(parts[0]);
    const m = parts[1] ?? '00';
    if (Number.isNaN(h)) return '00:00';
    return `${String(h).padStart(2, '0')}:${m.padStart(2, '0')}`;
  }
}