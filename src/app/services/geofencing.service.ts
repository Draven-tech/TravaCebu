import { Injectable } from '@angular/core';
import { BehaviorSubject, Subscription } from 'rxjs';
import { AlertController, ToastController, Platform } from '@ionic/angular';
import { Geolocation } from '@capacitor/geolocation';

export interface VisitRecord {
  id?: string;
  userId: string;
  touristSpotId: string;
  touristSpotName: string;
  visitDate: Date;
  latitude: number;
  longitude: number;
  confirmed: boolean;
}

export interface GeofenceSpot {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number; // in meters
}

@Injectable({
  providedIn: 'root'
})
export class GeofencingService {
  private isMonitoring = false;
  private currentPosition: { lat: number; lng: number } | null = null;
  private monitoredSpots: GeofenceSpot[] = [];
  private visitedSpots: Set<string> = new Set();
  private positionWatchId: string | null = null;
  private checkInterval: any;
  
  // Observables
  private monitoringStatusSubject = new BehaviorSubject<boolean>(false);
  private visitedSpotsSubject = new BehaviorSubject<Set<string>>(new Set());
  
  public monitoringStatus$ = this.monitoringStatusSubject.asObservable();
  public visitedSpots$ = this.visitedSpotsSubject.asObservable();

  // Default geofence radius in meters
  private readonly DEFAULT_RADIUS = 100;
  private readonly LOCATION_CHECK_INTERVAL = 10000; // 10 seconds

  constructor(
    private alertCtrl: AlertController,
    private toastCtrl: ToastController,
    private platform: Platform
  ) {
    this.loadVisitedSpots();
  }

  /**
   * Start geofencing monitoring for an itinerary
   */
  async startMonitoring(itinerary: any[]): Promise<void> {
    try {
      // Check if location is available
      if (!this.isLocationAvailable()) {
        throw new Error('Location services not available');
      }

      // Request permissions (only on mobile)
      if (!this.platform.is('desktop')) {
        try {
          const permissions = await Geolocation.requestPermissions();
          if (permissions.location !== 'granted') {
            throw new Error('Location permission denied');
          }
        } catch (permError) {
          console.warn('Permission request failed, trying without explicit permissions');
        }
      }

      // Extract tourist spots from itinerary
      this.monitoredSpots = this.extractTouristSpotsFromItinerary(itinerary);
      
      if (this.monitoredSpots.length === 0) {
        console.warn('No tourist spots found in itinerary for geofencing');
        return;
      }

      // Start location monitoring
      await this.startLocationMonitoring();
      
      this.isMonitoring = true;
      this.monitoringStatusSubject.next(true);
      
      console.log(`🎯 Geofencing started for ${this.monitoredSpots.length} tourist spots`);
      
      // Show confirmation toast
      const toast = await this.toastCtrl.create({
        message: `Geofencing activated for ${this.monitoredSpots.length} tourist spots in your itinerary`,
        duration: 3000,
        position: 'top',
        color: 'success',
        icon: 'location'
      });
      await toast.present();
      
    } catch (error) {
      console.error('Failed to start geofencing:', error);
      const toast = await this.toastCtrl.create({
        message: 'Failed to start location monitoring. Using manual marking fallback.',
        duration: 3000,
        position: 'top',
        color: 'warning'
      });
      await toast.present();
    }
  }

  /**
   * Stop geofencing monitoring
   */
  async stopMonitoring(): Promise<void> {
    this.isMonitoring = false;
    this.monitoredSpots = [];
    
    // Stop location watch
    if (this.positionWatchId) {
      if (this.platform.is('desktop') || this.platform.is('mobileweb')) {
        // Clear web geolocation watch
        navigator.geolocation.clearWatch(parseInt(this.positionWatchId));
      } else {
        // Clear Capacitor watch
        await Geolocation.clearWatch({ id: this.positionWatchId });
      }
      this.positionWatchId = null;
    }
    
    // Clear check interval
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    this.monitoringStatusSubject.next(false);
    console.log('🛑 Geofencing stopped');
  }

  /**
   * Start location monitoring
   */
  private async startLocationMonitoring(): Promise<void> {
    if (this.platform.is('desktop') || this.platform.is('mobileweb')) {
      // Use browser geolocation API for web
      await this.startWebLocationMonitoring();
    } else {
      // Use Capacitor for native mobile
      await this.startNativeLocationMonitoring();
    }
  }

  /**
   * Start location monitoring using browser geolocation (for web)
   */
  private async startWebLocationMonitoring(): Promise<void> {
    if (!navigator.geolocation) {
      throw new Error('Geolocation is not supported by this browser');
    }

    // Get initial position
    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      });
    });
    
    this.currentPosition = {
      lat: position.coords.latitude,
      lng: position.coords.longitude
    };

    // Start watching position
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        this.currentPosition = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        this.checkGeofences();
      },
      (error) => {
        console.warn('Geolocation watch error:', error);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );

    // Store watch ID for cleanup
    this.positionWatchId = watchId.toString();

    // Also check periodically (fallback)
    this.checkInterval = setInterval(() => {
      if (this.currentPosition) {
        this.checkGeofences();
      }
    }, this.LOCATION_CHECK_INTERVAL);
  }

  /**
   * Start location monitoring using Capacitor (for native mobile)
   */
  private async startNativeLocationMonitoring(): Promise<void> {
    // Get initial position
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000
    });
    
    this.currentPosition = {
      lat: position.coords.latitude,
      lng: position.coords.longitude
    };

    // Start watching position
    this.positionWatchId = await Geolocation.watchPosition({
      enableHighAccuracy: true,
      timeout: 10000
    }, (position, err) => {
      if (position) {
        this.currentPosition = {
          lat: position.coords.latitude,
          lng: position.coords.longitude
        };
        this.checkGeofences();
      }
    });

    // Also check periodically (fallback)
    this.checkInterval = setInterval(() => {
      if (this.currentPosition) {
        this.checkGeofences();
      }
    }, this.LOCATION_CHECK_INTERVAL);
  }

  /**
   * Check if user is within any geofence
   */
  private checkGeofences(): void {
    if (!this.currentPosition || !this.isMonitoring) return;

    this.monitoredSpots.forEach(spot => {
      if (!this.visitedSpots.has(spot.id)) {
        const distance = this.calculateDistance(
          this.currentPosition!.lat,
          this.currentPosition!.lng,
          spot.latitude,
          spot.longitude
        );

        if (distance <= spot.radius) {
          this.triggerGeofenceEntry(spot);
        }
      }
    });
  }

  /**
   * Handle geofence entry
   */
  private async triggerGeofenceEntry(spot: GeofenceSpot): Promise<void> {
    console.log(`📍 User entered geofence for: ${spot.name}`);

    const alert = await this.alertCtrl.create({
      header: '📍 Tourist Spot Detected!',
      message: `You're near <strong>${spot.name}</strong>! Would you like to confirm your visit? This will unlock the ability to post reviews for this location.`,
      buttons: [
        {
          text: 'Not Now',
          role: 'cancel',
          cssClass: 'secondary'
        },
        {
          text: 'Confirm Visit',
          cssClass: 'primary',
          handler: () => {
            this.confirmVisit(spot);
          }
        }
      ],
      cssClass: 'geofence-alert'
    });

    await alert.present();
  }

  /**
   * Confirm a visit to a tourist spot
   */
  private async confirmVisit(spot: GeofenceSpot): Promise<void> {
    try {
      // Add to visited spots
      this.visitedSpots.add(spot.id);
      this.visitedSpotsSubject.next(new Set(this.visitedSpots));

      // Create visit record
      const visitRecord: VisitRecord = {
        userId: 'current_user', // Replace with actual user ID
        touristSpotId: spot.id,
        touristSpotName: spot.name,
        visitDate: new Date(),
        latitude: this.currentPosition!.lat,
        longitude: this.currentPosition!.lng,
        confirmed: true
      };

      // Save visit record (implement database save)
      await this.saveVisitRecord(visitRecord);
      
      // Save to local storage
      this.saveVisitedSpots();

      // Show success message
      const toast = await this.toastCtrl.create({
        message: `✅ Visit to ${spot.name} confirmed! You can now post reviews for this location.`,
        duration: 4000,
        position: 'top',
        color: 'success',
        icon: 'checkmark-circle'
      });
      await toast.present();

      console.log(`✅ Visit confirmed for: ${spot.name}`);
      
    } catch (error) {
      console.error('Failed to confirm visit:', error);
      const toast = await this.toastCtrl.create({
        message: 'Failed to confirm visit. Please try again.',
        duration: 3000,
        position: 'top',
        color: 'danger'
      });
      await toast.present();
    }
  }

  /**
   * Extract tourist spots from itinerary
   */
  private extractTouristSpotsFromItinerary(itinerary: any[]): GeofenceSpot[] {
    const spots: GeofenceSpot[] = [];
    
    itinerary.forEach(day => {
      if (day.spots && Array.isArray(day.spots)) {
        day.spots.forEach((spot: any) => {
          if (spot.location && spot.location.lat && spot.location.lng) {
            spots.push({
              id: spot.id || `spot_${Date.now()}_${Math.random()}`,
              name: spot.name || 'Unknown Spot',
              latitude: spot.location.lat,
              longitude: spot.location.lng,
              radius: this.DEFAULT_RADIUS
            });
          }
        });
      }
    });
    
    return spots;
  }

  /**
   * Calculate distance between two points in meters
   */
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(Δφ/2) * Math.sin(Δφ/2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ/2) * Math.sin(Δλ/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  /**
   * Save visit record to database
   */
  private async saveVisitRecord(visitRecord: VisitRecord): Promise<void> {
    // TODO: Implement Firestore save
    console.log('Saving visit record:', visitRecord);
    
    // For now, just store in local storage
    const existingRecords = JSON.parse(localStorage.getItem('visit_records') || '[]');
    visitRecord.id = `visit_${Date.now()}_${Math.random()}`;
    existingRecords.push(visitRecord);
    localStorage.setItem('visit_records', JSON.stringify(existingRecords));
  }

  /**
   * Load visited spots from storage
   */
  private loadVisitedSpots(): void {
    const stored = localStorage.getItem('visited_spots');
    if (stored) {
      try {
        const visitedArray = JSON.parse(stored);
        this.visitedSpots = new Set(visitedArray);
        this.visitedSpotsSubject.next(new Set(this.visitedSpots));
      } catch (error) {
        console.error('Failed to load visited spots:', error);
      }
    }
  }

  /**
   * Save visited spots to storage
   */
  private saveVisitedSpots(): void {
    const visitedArray = Array.from(this.visitedSpots);
    localStorage.setItem('visited_spots', JSON.stringify(visitedArray));
  }

  /**
   * Check if a spot has been visited
   */
  hasVisited(spotId: string): boolean {
    return this.visitedSpots.has(spotId);
  }

  /**
   * Get all visited spots
   */
  getVisitedSpots(): Set<string> {
    return new Set(this.visitedSpots);
  }

  /**
   * Reset visit status for a spot (for "Visit Again" functionality)
   */
  async resetVisitStatus(spotId: string): Promise<void> {
    this.visitedSpots.delete(spotId);
    this.visitedSpotsSubject.next(new Set(this.visitedSpots));
    this.saveVisitedSpots();

    const toast = await this.toastCtrl.create({
      message: 'Visit status reset. You can visit this spot again!',
      duration: 2000,
      position: 'top',
      color: 'primary'
    });
    await toast.present();
  }

  /**
   * Get current monitoring status
   */
  isCurrentlyMonitoring(): boolean {
    return this.isMonitoring;
  }

  /**
   * Get currently monitored spots
   */
  getMonitoredSpots(): GeofenceSpot[] {
    return [...this.monitoredSpots];
  }

  /**
   * Manually confirm a visit (for testing/fallback purposes)
   */
  async manuallyConfirmVisit(spot: GeofenceSpot): Promise<void> {
    await this.confirmVisit(spot);
  }

  /**
   * Check if location services are available
   */
  private isLocationAvailable(): boolean {
    if (this.platform.is('desktop') || this.platform.is('mobileweb')) {
      return 'geolocation' in navigator;
    }
    return true; // Assume available on native mobile
  }
}
