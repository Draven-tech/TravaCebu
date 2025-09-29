import { Injectable } from '@angular/core';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';

export interface GlobalEvent {
  id?: string;
  name: string;
  description: string;
  date: string;
  time: string;
  location: string;
  spotId: string;
  imageUrl: string;
  createdBy: string; // userId of creator (admin or user)
  createdByType: 'admin' | 'user';
  eventType: 'admin_event' | 'user_itinerary' | 'tourist_spot' | 'restaurant' | 'hotel';
  status: 'active' | 'completed';
  createdAt: Date;
  updatedAt?: Date;
}

// Legacy interface for backward compatibility
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
   * GLOBAL EVENT METHODS - NEW UNIFIED SYSTEM
   */

  /**
   * Save a new global event (admin or user)
   */
  async saveGlobalEvent(event: Omit<GlobalEvent, 'id' | 'createdAt' | 'createdBy'>): Promise<string> {
    try {
      const user = await this.afAuth.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }

      const newEvent: GlobalEvent = {
        ...event,
        createdBy: user.uid,
        createdAt: new Date(),
        status: 'active'
      };

      // Save to 'events' collection
      const docRef = await this.firestore.collection('events').add(newEvent);
      
      return docRef.id;
      
    } catch (error) {
      console.error('Error saving global event:', error);
      throw error;
    }
  }

  /**
   * Load all global events (visible to everyone)
   */
  async loadAllGlobalEvents(): Promise<GlobalEvent[]> {
    try {
      const snapshot = await this.firestore
        .collection('events')
        .get()
        .toPromise();

      if (snapshot && !snapshot.empty) {
        const events = snapshot.docs.map((doc: any) => {
          const data = doc.data() as any;
          return {
            id: doc.id,
            ...data
          };
        }) as GlobalEvent[];
        
        return events;
      }

      return [];
      
    } catch (error) {
      console.error('Error loading global events:', error);
      return [];
    }
  }

  /**
   * Load events for admin (all events they created)
   */
  async loadAdminEvents(): Promise<GlobalEvent[]> {
    try {
      const user = await this.afAuth.currentUser;
      if (!user) {
        throw new Error('Admin not authenticated');
      }

      const events = await this.loadAllGlobalEvents();
      
      // Filter for events created by this admin
      const adminEvents = events.filter(event => 
        event.createdByType === 'admin' && event.createdBy === user.uid
      );
      
      return adminEvents;
      
    } catch (error) {
      console.error('Error loading admin events:', error);
      return [];
    }
  }

  /**
   * Load events for user calendar (user's events + all admin events)
   */
  async loadUserCalendarEvents(): Promise<GlobalEvent[]> {
    try {
      const user = await this.afAuth.currentUser;
      if (!user) {
        console.error('User not authenticated for calendar events');
        return [];
      }

      const allEvents = await this.loadAllGlobalEvents();
      
      // Include user's own events + all admin events
      const userCalendarEvents = allEvents.filter(event => {
        // Include user's own events
        const isUserEvent = event.createdBy === user.uid && event.createdByType === 'user';
        
        // Include all admin events (visible to everyone)
        const isAdminEvent = event.createdByType === 'admin';
        
        return isUserEvent || isAdminEvent;
      });
      return userCalendarEvents;
      
    } catch (error) {
      console.error('Error loading user calendar events:', error);
      return [];
    }
  }

  /**
   * Update an existing global event
   */
  async updateGlobalEvent(eventId: string, updates: Partial<GlobalEvent>): Promise<void> {
    try {
      const user = await this.afAuth.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }

      const updateData = {
        ...updates,
        updatedAt: new Date()
      };

      await this.firestore.collection('events').doc(eventId).update(updateData);
      } catch (error) {
      console.error('Error updating event:', error);
      throw error;
    }
  }

  /**
   * Delete a global event
   */
  async deleteGlobalEvent(eventId: string): Promise<void> {
    try {
      await this.firestore.collection('events').doc(eventId).delete();
      } catch (error) {
      console.error('Error deleting event:', error);
      throw error;
    }
  }

  /**
   * LEGACY METHODS - Keep for backward compatibility
   */

  /**
   * Save itinerary events to user_itinerary_events collection (legacy)
   */
  async saveItineraryEvents(events: CalendarEvent[]): Promise<void> {
    try {
      const user = await this.afAuth.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }

      const cleanedEvents = events.map(event => {
        const cleanedEvent = {
          ...event,
          userId: user.uid,
          createdAt: new Date()
        };

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

      localStorage.setItem('user_itinerary_events', JSON.stringify(cleanedEvents));

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
   * Load itinerary events for the current user (legacy)
   */
  async loadItineraryEvents(): Promise<CalendarEvent[]> {
    try {
      const user = await this.afAuth.currentUser;
      if (!user) {
        return this.loadFromLocalStorage();
      }

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
       
        const activeEvents = events.filter(event => event.status !== 'completed');
        localStorage.setItem('user_itinerary_events', JSON.stringify(activeEvents));
        return activeEvents;
      }

      return this.loadFromLocalStorage();
      
    } catch (error) {
      console.error('Error loading itinerary events:', error);
      return this.loadFromLocalStorage();
    }
  }

  /**
   * Load from localStorage (fallback)
   */
  private loadFromLocalStorage(): CalendarEvent[] {
    try {
      const savedEvents = localStorage.getItem('user_itinerary_events');
      if (savedEvents) {
        const parsed = JSON.parse(savedEvents);
        return parsed.filter((event: CalendarEvent) => event.status !== 'completed');
      }
    } catch (error) {
      console.error('Error loading from localStorage:', error);
    }
    return [];
  }

  /**
   * Force refresh from Firestore (legacy)
   */
  async forceRefreshFromFirestore(): Promise<CalendarEvent[]> {
    try {
      const user = await this.afAuth.currentUser;
      if (!user) {
        return [];
      }

      localStorage.removeItem('user_itinerary_events');

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
       
        const activeEvents = events.filter(event => event.status !== 'completed');
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
   * Update an existing event (legacy)
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

      const updatedEvent = {
        ...event,
        userId: user.uid,
        updatedAt: new Date()
      };

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

      await this.firestore
        .collection('user_itinerary_events')
        .doc(event.id)
        .update(updatedEvent);

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
   * Clear all itinerary events for the current user (legacy)
   */
  async clearItineraryEvents(): Promise<void> {
    try {
      const user = await this.afAuth.currentUser;
      if (user) {
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

      localStorage.removeItem('user_itinerary_events');
      
    } catch (error) {
      console.error('Error clearing itinerary events:', error);
      throw error;
    }
  }

  /**
   * Clear events for specific dates only (legacy)
   */
  async clearEventsForDates(dates: string[]): Promise<void> {
    try {
      const user = await this.afAuth.currentUser;
      if (!user || dates.length === 0) {
        return;
      }

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
          const eventDate = eventData.start.split('T')[0];
          
          if (dates.includes(eventDate)) {
            batch.delete(doc.ref);
            hasEventsToDelete = true;
          }
        });

        if (hasEventsToDelete) {
          await batch.commit();
        }
      }

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
   * Update event status (legacy)
   */
  async updateEventStatus(eventId: string, status: string): Promise<void> {
    try {
      const user = await this.afAuth.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }

      await this.firestore
        .collection('user_itinerary_events')
        .doc(eventId)
        .update({
          status: status,
          updatedAt: new Date()
        });

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
   * Delete a specific event by ID (legacy)
   */
  async deleteEvent(eventId: string): Promise<void> {
    try {
      const user = await this.afAuth.currentUser;
      if (!user) {
        throw new Error('User not authenticated');
      }

      await this.firestore
        .collection('user_itinerary_events')
        .doc(eventId)
        .delete();

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
   * Load ALL itinerary events (including completed ones) for admin/completed views (legacy)
   */
  async loadAllItineraryEvents(): Promise<CalendarEvent[]> {
    try {
      const user = await this.afAuth.currentUser;
      if (!user) {
        return [];
      }

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
       
        return events;
      }

      return [];
      
    } catch (error) {
      console.error('Error loading all itinerary events:', error);
      return [];
    }
  }

  /**
   * CONVERSION HELPERS
   */

  /**
   * Convert GlobalEvent to CalendarEvent format (for backward compatibility)
   */
  globalEventToCalendarEvent(globalEvent: GlobalEvent): CalendarEvent {
    return {
      id: globalEvent.id,
      title: globalEvent.name,
      start: `${globalEvent.date}T${globalEvent.time}:00`,
      end: `${globalEvent.date}T${globalEvent.time}:00`,
      color: globalEvent.createdByType === 'admin' ? '#ffc107' : '#28a745',
      textColor: '#fff',
      allDay: false,
      extendedProps: {
        type: globalEvent.eventType,
        description: globalEvent.description,
        location: globalEvent.location,
        spotId: globalEvent.spotId,
        imageUrl: globalEvent.imageUrl,
        isAdminEvent: globalEvent.createdByType === 'admin',
        createdByType: globalEvent.createdByType
      },
      userId: globalEvent.createdBy,
      status: globalEvent.status,
      createdAt: globalEvent.createdAt
    };
  }

  /**
   * Convert CalendarEvent to GlobalEvent format
   */
  calendarEventToGlobalEvent(calendarEvent: CalendarEvent, createdByType: 'admin' | 'user'): GlobalEvent {
    return {
      id: calendarEvent.id,
      name: calendarEvent.title,
      description: calendarEvent.extendedProps?.description || '',
      date: calendarEvent.start.split('T')[0],
      time: calendarEvent.start.split('T')[1]?.substring(0, 5) || '',
      location: calendarEvent.extendedProps?.location || '',
      spotId: calendarEvent.extendedProps?.spotId || '',
      imageUrl: calendarEvent.extendedProps?.imageUrl || '',
      createdBy: calendarEvent.userId || '',
      createdByType: createdByType,
      eventType: calendarEvent.extendedProps?.type || (createdByType === 'admin' ? 'admin_event' : 'user_itinerary'),
      status: (calendarEvent.status as 'active' | 'completed') || 'active',
      createdAt: calendarEvent.createdAt || new Date(),
      updatedAt: calendarEvent.extendedProps?.updatedAt
    };
  }

  /**
   * Load completed itineraries for sharing (simplified format)
   */
  async loadCompletedItinerariesForSharing(): Promise<any[]> {
    try {
      const user = await this.afAuth.currentUser;
      if (!user) {
        return [];
      }

      const allEvents = await this.loadAllItineraryEvents();
      const completedEvents = allEvents.filter(event => event.status === 'completed');
      
      // Group completed events into itineraries (same logic as completed-itineraries page)
      const itineraries: any[] = [];
      const groupedEvents = new Map<string, CalendarEvent[]>();

      // Group events by date
      completedEvents.forEach(event => {
        const date = event.start.split('T')[0];
        if (!groupedEvents.has(date)) {
          groupedEvents.set(date, []);
        }
        groupedEvents.get(date)!.push(event);
      });

      // Convert grouped events to itineraries
      groupedEvents.forEach((dayEvents, date) => {
        if (dayEvents.length > 0) {
          dayEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
          
          const itinerary = {
            id: `completed_itinerary_${date}`,
            name: `My Cebu Adventure - ${this.getDateDisplay(date)}`,
            date: date,
            spots: dayEvents.map(event => ({
              name: event.title,
              type: event.extendedProps?.type || 'tourist_spot',
              location: event.extendedProps?.location,
              timeSlot: event.start?.split('T')[1]?.substring(0, 5) || '09:00',
              duration: event.extendedProps?.duration || '2 hours'
            }))
          };
          
          itineraries.push(itinerary);
        }
      });

      return itineraries;
      
    } catch (error) {
      console.error('Error loading completed itineraries for sharing:', error);
      return [];
    }
  }

  private getDateDisplay(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      month: 'short', 
      day: 'numeric',
      year: 'numeric'
    });
  }
}
