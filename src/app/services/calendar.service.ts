import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';

export interface CalendarEvent {
  id?: string;
  title: string;
  start: string;
  end?: string;
  color?: string;
  textColor?: string;
  allDay?: boolean;
  extendedProps?: any;
  userId?: string;
}

@Injectable({
  providedIn: 'root'
})
export class CalendarService {

  constructor(
    private firestore: AngularFirestore,
    private afAuth: AngularFireAuth
  ) { }

  /**
   * Save itinerary events to both localStorage and Firestore
   */
  async saveItineraryEvents(events: CalendarEvent[]): Promise<void> {
    try {
      // Get current user
      const user = await this.afAuth.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Add userId to events
      const eventsWithUserId = events.map(event => ({
        ...event,
        userId: user.uid,
        createdAt: new Date()
      }));

      // Save to localStorage for immediate access
      localStorage.setItem('user_itinerary_events', JSON.stringify(eventsWithUserId));

      // Save to Firestore for persistence
      const batch = this.firestore.firestore.batch();
      
      eventsWithUserId.forEach(event => {
        const eventRef = this.firestore.collection('user_itinerary_events').doc().ref;
        batch.set(eventRef, event);
      });

      await batch.commit();
      
    } catch (error) {
      console.error('Error saving itinerary events:', error);
      throw error;
    }
  }

    /**
   * Load itinerary events for the current user
   */
  async loadItineraryEvents(): Promise<CalendarEvent[]> {
    try {
      const user = await this.afAuth.currentUser;
      if (!user) {
        return this.loadFromLocalStorage();
      }

      // Try to load from Firestore first
      const snapshot = await this.firestore
        .collection('user_itinerary_events', ref => 
          ref.where('userId', '==', user.uid)
        )
        .get()
        .toPromise();

      if (snapshot && !snapshot.empty) {
        const events = snapshot.docs.map(doc => {
          const data = doc.data() as any;
          console.log('Firestore event data:', data);
          return {
            id: doc.id,
            ...data
          };
        }) as CalendarEvent[];
       
        console.log('Processed events from Firestore:', events);
        
        // Update localStorage with Firestore data
        localStorage.setItem('user_itinerary_events', JSON.stringify(events));
        return events;
      }

      // Fallback to localStorage
      return this.loadFromLocalStorage();
      
    } catch (error) {
      console.error('Error loading itinerary events:', error);
      return this.loadFromLocalStorage();
    }
  }

  /**
   * Load events from localStorage
   */
  private loadFromLocalStorage(): CalendarEvent[] {
    try {
      const savedEvents = localStorage.getItem('user_itinerary_events');
      console.log('Raw localStorage data:', savedEvents);
      if (savedEvents) {
        const parsed = JSON.parse(savedEvents);
        console.log('Parsed localStorage events:', parsed);
        return parsed;
      }
    } catch (error) {
      console.error('Error loading from localStorage:', error);
    }
    return [];
  }

  /**
   * Clear all itinerary events for the current user
   */
  async clearItineraryEvents(): Promise<void> {
    try {
      const user = await this.afAuth.currentUser;
      if (user) {
        // Clear from Firestore
        const snapshot = await this.firestore
          .collection('user_itinerary_events', ref => 
            ref.where('userId', '==', user.uid)
          )
          .get()
          .toPromise();

        if (snapshot && !snapshot.empty) {
          const batch = this.firestore.firestore.batch();
          snapshot.docs.forEach(doc => {
            batch.delete(doc.ref);
          });
          await batch.commit();
        }
      }

      // Clear from localStorage
      localStorage.removeItem('user_itinerary_events');
      
    } catch (error) {
      console.error('Error clearing itinerary events:', error);
      throw error;
    }
  }
} 