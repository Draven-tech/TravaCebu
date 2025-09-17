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
  status?: string;
  createdAt?: Date;
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

      // Clean and prepare events for Firestore (remove undefined values)
      const cleanedEvents = events.map(event => {
        const cleanedEvent = {
          ...event,
          userId: user.uid,
          createdAt: new Date()
        };

        // Clean extendedProps to remove undefined values
        if (cleanedEvent.extendedProps) {
          const cleanedExtendedProps: any = {};
          Object.keys(cleanedEvent.extendedProps).forEach(key => {
            const value = cleanedEvent.extendedProps[key];
            if (value !== undefined && value !== null) {
              cleanedExtendedProps[key] = value;
            }
          });
          cleanedEvent.extendedProps = cleanedExtendedProps;
        }

        return cleanedEvent;
      });

      // Save to localStorage for immediate access
      localStorage.setItem('user_itinerary_events', JSON.stringify(cleanedEvents));

      // Save to Firestore for persistence
      const batch = this.firestore.firestore.batch();
      
      cleanedEvents.forEach(event => {
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
          return {
            id: doc.id,
            ...data
          };
        }) as CalendarEvent[];
       
        // Filter out completed events
        const activeEvents = events.filter(event => event.status !== 'completed');
       
        // Update localStorage with filtered data
        localStorage.setItem('user_itinerary_events', JSON.stringify(activeEvents));
        return activeEvents;
      }

      // Fallback to localStorage
      return this.loadFromLocalStorage();
      
    } catch (error) {
      console.error('Error loading itinerary events:', error);
      return this.loadFromLocalStorage();
    }
  }

  /**
   * Force refresh from Firestore (bypass localStorage cache)
   */
  async forceRefreshFromFirestore(): Promise<CalendarEvent[]> {
    try {
      const user = await this.afAuth.currentUser;
      if (!user) {
        return [];
      }

      // Clear localStorage cache first
      localStorage.removeItem('user_itinerary_events');

      // Load fresh from Firestore
      const snapshot = await this.firestore
        .collection('user_itinerary_events', ref => 
          ref.where('userId', '==', user.uid)
        )
        .get()
        .toPromise();

      if (snapshot && !snapshot.empty) {
        const events = snapshot.docs.map(doc => {
          const data = doc.data() as any;
          return {
            id: doc.id,
            ...data
          };
        }) as CalendarEvent[];
       
        // Filter out completed events
        const activeEvents = events.filter(event => event.status !== 'completed');
       
        // Update localStorage with fresh data
        localStorage.setItem('user_itinerary_events', JSON.stringify(activeEvents));
        
        return activeEvents;
      }

      return [];
      
    } catch (error) {
      console.error('Error force refreshing from Firestore:', error);
      return [];
    }
  }

  /**
   * Load events from localStorage
   */
  private loadFromLocalStorage(): CalendarEvent[] {
    try {
      const savedEvents = localStorage.getItem('user_itinerary_events');
      if (savedEvents) {
        const parsed = JSON.parse(savedEvents);
        // Filter out completed events
        return parsed.filter((event: CalendarEvent) => event.status !== 'completed');
      }
    } catch (error) {
      console.error('Error loading from localStorage:', error);
    }
    return [];
  }

  /**
   * Update an existing event
   */
  async updateEvent(event: CalendarEvent): Promise<void> {
    try {
      const user = await this.afAuth.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }

      if (!event.id) {
        throw new Error('Event ID is required for update');
      }

      // Update the event with current timestamp
      const updatedEvent = {
        ...event,
        userId: user.uid,
        updatedAt: new Date()
      };

      // Clean extendedProps to remove undefined values
      if (updatedEvent.extendedProps) {
        const cleanedExtendedProps: any = {};
        Object.keys(updatedEvent.extendedProps).forEach(key => {
          const value = updatedEvent.extendedProps[key];
          if (value !== undefined && value !== null) {
            cleanedExtendedProps[key] = value;
          }
        });
        updatedEvent.extendedProps = cleanedExtendedProps;
      }

      // Update in Firestore
      await this.firestore
        .collection('user_itinerary_events')
        .doc(event.id)
        .update(updatedEvent);

      // Update in localStorage
      const savedEvents = localStorage.getItem('user_itinerary_events');
      if (savedEvents) {
        const events = JSON.parse(savedEvents) as CalendarEvent[];
        const updatedEvents = events.map(e => e.id === event.id ? updatedEvent : e);
        localStorage.setItem('user_itinerary_events', JSON.stringify(updatedEvents));
      }
      
    } catch (error) {
      console.error('Error updating event:', error);
      throw error;
    }
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

  /**
   * Clear events for specific dates only (to prevent duplication when editing)
   */
  async clearEventsForDates(dates: string[]): Promise<void> {
    try {
      const user = await this.afAuth.currentUser;
      if (!user || dates.length === 0) {
        return;
      }

      // Clear from Firestore for specific dates
      const snapshot = await this.firestore
        .collection('user_itinerary_events', ref => 
          ref.where('userId', '==', user.uid)
        )
        .get()
        .toPromise();

      if (snapshot && !snapshot.empty) {
        const batch = this.firestore.firestore.batch();
        let hasEventsToDelete = false;

        snapshot.docs.forEach(doc => {
          const eventData = doc.data() as CalendarEvent;
          const eventDate = eventData.start.split('T')[0]; // Get just the date part
          
          // Only delete events that match the specified dates
          if (dates.includes(eventDate)) {
            batch.delete(doc.ref);
            hasEventsToDelete = true;
          }
        });

        if (hasEventsToDelete) {
          await batch.commit();
        }
      }

      // Clear from localStorage for specific dates
      const savedEvents = localStorage.getItem('user_itinerary_events');
      if (savedEvents) {
        const events = JSON.parse(savedEvents) as CalendarEvent[];
        const filteredEvents = events.filter(event => {
          const eventDate = event.start.split('T')[0];
          return !dates.includes(eventDate);
        });
        localStorage.setItem('user_itinerary_events', JSON.stringify(filteredEvents));
      }
      
    } catch (error) {
      console.error('Error clearing events for dates:', error);
      throw error;
    }
  }

  /**
   * Update event status (e.g., mark as completed)
   */
  async updateEventStatus(eventId: string, status: string): Promise<void> {
    try {
      const user = await this.afAuth.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Update in Firestore
      await this.firestore
        .collection('user_itinerary_events')
        .doc(eventId)
        .update({
          status: status,
          updatedAt: new Date()
        });

      // Update in localStorage - load all events first
      const savedEvents = localStorage.getItem('user_itinerary_events');
      if (savedEvents) {
        const allEvents = JSON.parse(savedEvents) as CalendarEvent[];
        const updatedEvents = allEvents.map(event => 
          event.id === eventId ? { ...event, status } : event
        );
        localStorage.setItem('user_itinerary_events', JSON.stringify(updatedEvents));
      }

    } catch (error) {
      console.error('Error updating event status:', error);
      throw error;
    }
  }

  /**
   * Delete a specific event by ID
   */
  async deleteEvent(eventId: string): Promise<void> {
    try {
      const user = await this.afAuth.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }

      // Delete from Firestore
      await this.firestore
        .collection('user_itinerary_events')
        .doc(eventId)
        .delete();

      // Remove from localStorage
      const savedEvents = localStorage.getItem('user_itinerary_events');
      if (savedEvents) {
        const events = JSON.parse(savedEvents) as CalendarEvent[];
        const filteredEvents = events.filter(event => event.id !== eventId);
        localStorage.setItem('user_itinerary_events', JSON.stringify(filteredEvents));
      }

    } catch (error) {
      console.error('Error deleting event:', error);
      throw error;
    }
  }

  /**
   * Load ALL itinerary events (including completed ones) for admin/completed views
   */
  async loadAllItineraryEvents(): Promise<CalendarEvent[]> {
    try {
      const user = await this.afAuth.currentUser;
      if (!user) {
        return [];
      }

      // Load ALL events from Firestore (including completed)
      const snapshot = await this.firestore
        .collection('user_itinerary_events', ref => 
          ref.where('userId', '==', user.uid)
        )
        .get()
        .toPromise();

      if (snapshot && !snapshot.empty) {
        const events = snapshot.docs.map(doc => {
          const data = doc.data() as any;
          return {
            id: doc.id,
            ...data
          };
        }) as CalendarEvent[];
       
        return events; // Return ALL events, don't filter
      }

      return [];
      
    } catch (error) {
      console.error('Error loading all itinerary events:', error);
      return [];
    }
  }
} 