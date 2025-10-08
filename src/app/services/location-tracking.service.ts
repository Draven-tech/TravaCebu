import { Injectable, NgZone } from '@angular/core';
import { Geolocation } from '@capacitor/geolocation';
import { ToastController } from '@ionic/angular';
import { Subject } from 'rxjs';

export interface UserLocation {
  lat: number;
  lng: number;
  isReal: boolean;
  accuracy?: number;
  timestamp?: number;
}

@Injectable({
  providedIn: 'root'
})
export class LocationTrackingService {
  private locationWatcher?: string;
  private isLocationTracking: boolean = false;
  private locationUpdateInterval: number = 10000; // Update every 10 seconds
  private userLocation: UserLocation | null = null;
  
  // Observable to emit location updates
  private locationUpdate$ = new Subject<UserLocation>();
  public locationUpdates = this.locationUpdate$.asObservable();

  constructor(
    private ngZone: NgZone,
    private toastCtrl: ToastController
  ) { }

  /**
   * Get current user location
   */
  getUserLocation(): UserLocation | null {
    return this.userLocation;
  }

  /**
   * Check if location tracking is active
   */
  isTrackingActive(): boolean {
    return this.isLocationTracking;
  }

  /**
   * Check if user location is real GPS
   */
  isRealLocation(): boolean {
    return this.userLocation?.isReal || false;
  }

  /**
   * Get location status text
   */
  getLocationStatusText(): string {
    if (this.isLocationTracking) {
      return this.userLocation?.isReal ? 'GPS Tracking' : 'Default Location';
    }
    return this.userLocation?.isReal ? 'GPS Location' : 'Default Location';
  }

  /**
   * Start location tracking
   */
  async startLocationTracking(): Promise<void> {
    try {
      if (this.isLocationTracking) {
        return;
      }

      // Request permissions
      const permissions = await Geolocation.requestPermissions();
      if (permissions.location !== 'granted') {
        await this.showToast('Location permission denied. Using default location.');
        this.setDefaultLocation();
        return;
      }

      // Get initial location
      await this.getCurrentLocation();

      // Start watching position
      this.locationWatcher = await Geolocation.watchPosition(
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 5000
        },
        (position) => {
          this.ngZone.run(() => {
            this.updateUserLocation(position);
          });
        }
      );

      this.isLocationTracking = true;

    } catch (error) {
      console.error('Error starting location tracking:', error);
      await this.showToast('Error starting location tracking. Using default location.');
      this.setDefaultLocation();
    }
  }

  /**
   * Stop location tracking
   */
  async stopLocationTracking(): Promise<void> {
    try {
      if (this.locationWatcher) {
        await Geolocation.clearWatch({ id: this.locationWatcher });
        this.locationWatcher = undefined;
      }
      
      this.isLocationTracking = false;
    } catch (error) {
      console.error('Error stopping location tracking:', error);
    }
  }

  /**
   * Get current location once
   */
  async getCurrentLocation(): Promise<UserLocation | null> {
    try {
      const permissions = await Geolocation.checkPermissions();
      if (permissions.location !== 'granted') {
        await this.showToast('Location permission not granted. Using default location.');
        this.setDefaultLocation();
        return this.userLocation;
      }

      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 5000
      });

      this.updateUserLocation(position);
      return this.userLocation;

    } catch (error) {
      console.error('Error getting current location:', error);
      await this.showToast('Error getting location. Using default location.');
      this.setDefaultLocation();
      return this.userLocation;
    }
  }

  /**
   * Update user location from position
   */
  private async updateUserLocation(position: any): Promise<void> {
    if (!position || !position.coords) {
      console.error('Invalid position data');
      return;
    }

    const { latitude, longitude, accuracy } = position.coords;
    
    // Check if coordinates are within reasonable bounds for Cebu
    if (!this.isWithinCebu(latitude, longitude)) {
      this.setDefaultLocation();
      return;
    }

    // Snap location to nearest road using OSRM
    const snappedLocation = await this.snapLocationToRoad(latitude, longitude);

    this.userLocation = {
      lat: snappedLocation.lat,
      lng: snappedLocation.lng,
      isReal: true,
      accuracy: accuracy,
      timestamp: Date.now()
    };

    // Emit location update
    this.locationUpdate$.next(this.userLocation);
  }

  /**
   * Snap location to nearest road using OSRM
   */
  private async snapLocationToRoad(lat: number, lng: number): Promise<{ lat: number; lng: number }> {
    try {
      const response = await fetch(`https://router.project-osrm.org/nearest/v1/driving/${lng},${lat}?number=1`);
      const data = await response.json();
      
      if (data.code === 'Ok' && data.waypoints && data.waypoints.length > 0) {
        const snapped = data.waypoints[0].location;
        return { lat: snapped[1], lng: snapped[0] };
      }
    } catch (error) {
      console.error('Error snapping location to road:', error);
    }
    
    // Return original coordinates if snapping fails
    return { lat, lng };
  }

  /**
   * Set default location (Cebu City center)
   */
  private setDefaultLocation(): void {
    this.userLocation = {
      lat: 10.3157,
      lng: 123.8854,
      isReal: false,
      timestamp: Date.now()
    };
    
    // Emit default location update
    this.locationUpdate$.next(this.userLocation);
  }

  /**
   * Check if coordinates are within Cebu bounds
   */
  private isWithinCebu(lat: number, lng: number): boolean {
    // Cebu bounds: roughly 10.0-11.0 lat, 123.5-124.5 lng
    return lat >= 10.0 && lat <= 11.0 && lng >= 123.5 && lng <= 124.5;
  }

  /**
   * Show toast message
   */
  private async showToast(message: string): Promise<void> {
    const toast = await this.toastCtrl.create({
      message: message,
      duration: 3000,
      position: 'bottom'
    });
    await toast.present();
  }

  /**
   * Get location with fallback
   */
  async getLocationWithFallback(): Promise<UserLocation> {
    if (this.userLocation) {
      return this.userLocation;
    }

    await this.getCurrentLocation();
    return this.userLocation || this.getDefaultLocation();
  }

  /**
   * Get default location
   */
  getDefaultLocation(): UserLocation {
    return {
      lat: 10.3157,
      lng: 123.8854,
      isReal: false,
      timestamp: Date.now()
    };
  }

  /**
   * Check if location is recent (within 5 minutes)
   */
  isLocationRecent(): boolean {
    if (!this.userLocation || !this.userLocation.timestamp) {
      return false;
    }
    
    const fiveMinutesAgo = Date.now() - (5 * 60 * 1000);
    return this.userLocation.timestamp > fiveMinutesAgo;
  }

  /**
   * Force location refresh
   */
  async refreshLocation(): Promise<UserLocation | null> {
    return await this.getCurrentLocation();
  }
}
