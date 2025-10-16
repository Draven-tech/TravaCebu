import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';

@Injectable({
  providedIn: 'root'
})
export class ModalCommunicationService {
  private itinerarySelectionSubject = new BehaviorSubject<number | null>(null);
  public itinerarySelection$ = this.itinerarySelectionSubject.asObservable();

  selectItinerary(index: number): void {
    console.log('ModalCommunicationService: Itinerary selected:', index);
    this.itinerarySelectionSubject.next(index);
  }

  clearSelection(): void {
    this.itinerarySelectionSubject.next(null);
  }
}
