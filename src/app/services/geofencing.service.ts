import { Injectable } from '@angular/core';
import { BehaviorSubject } from 'rxjs';
import { ToastController, Platform } from '@ionic/angular';
import { Geolocation } from '@capacitor/geolocation';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { AngularFireAuth } from '@angular/fire/compat/auth';

import { BadgeService } from './badge.service';

export interface VisitRecord {
  id?: string;
  userId: string;
  touristSpotId: string;
  touristSpotName: string;
  visitDate: Date;
  latitude: number;
  longitude: number;
  accuracy?: number | null;
  confirmed: boolean;
}

export interface GeofenceSpot {
  id: string;
  touristSpotId?: string;
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
  private currentPosition: { lat: number; lng: number; accuracy?: number | null; timestamp: number } | null = null;
  private monitoredSpots: GeofenceSpot[] = [];
  private visitedSpots: Set<string> = new Set();
  private positionWatchId: string | null = null;
  private checkInterval: any;
  private dwellStartTimes = new Map<string, number>();
  
  private monitoringStatusSubject = new BehaviorSubject<boolean>(false);
  private visitedSpotsSubject = new BehaviorSubject<Set<string>>(new Set());
  
  public monitoringStatus$ = this.monitoringStatusSubject.asObservable();
  public visitedSpots$ = this.visitedSpotsSubject.asObservable();

  private readonly DEFAULT_RADIUS = 100;
  private readonly LOCATION_CHECK_INTERVAL = 10000; 
  private readonly MIN_DWELL_TIME = 15000;
  private readonly MAX_ACCEPTABLE_ACCURACY = 30;

  constructor(
    private toastCtrl: ToastController,
    private platform: Platform,
    private firestore: AngularFirestore,
    private afAuth: AngularFireAuth,
    private badgeService: BadgeService
  ) {
    this.loadVisitedSpots();
  }

  async startMonitoring(itinerary: any[]): Promise<void> {
    try {
      if (!this.isLocationAvailable()) {
        throw new Error('Location services not available');
      }

      if (!this.platform.is('desktop')) {
        try {
          const permissions = await Geolocation.requestPermissions();
          if (permissions.location !== 'granted') {
            throw new Error('Location permission denied');
          }
        } catch (permError) {
        }
      }

      this.monitoredSpots = this.extractTouristSpotsFromItinerary(itinerary);
      
      if (this.monitoredSpots.length === 0) {
        return;
      }

      await this.startLocationMonitoring();
      
      this.isMonitoring = true;
      this.monitoringStatusSubject.next(true);

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

  async stopMonitoring(): Promise<void> {
    this.isMonitoring = false;
    this.monitoredSpots = [];
    
    if (this.positionWatchId) {
      if (this.platform.is('desktop') || this.platform.is('mobileweb')) {
        navigator.geolocation.clearWatch(parseInt(this.positionWatchId));
      } else {
        await Geolocation.clearWatch({ id: this.positionWatchId });
      }
      this.positionWatchId = null;
    }
    
    if (this.checkInterval) {
      clearInterval(this.checkInterval);
      this.checkInterval = null;
    }
    
    this.monitoringStatusSubject.next(false);
  }

  private async startLocationMonitoring(): Promise<void> {
    if (this.platform.is('desktop') || this.platform.is('mobileweb')) {
      await this.startWebLocationMonitoring();
    } else {
      await this.startNativeLocationMonitoring();
    }
  }

  private async startWebLocationMonitoring(): Promise<void> {
    if (!navigator.geolocation) {
      throw new Error('Geolocation is not supported by this browser');
    }

    const position = await new Promise<GeolocationPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(resolve, reject, {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      });
    });
    
    this.currentPosition = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy ?? null,
      timestamp: Date.now()
    };

    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        this.currentPosition = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy ?? null,
          timestamp: Date.now()
        };
        void this.checkGeofences();
      },
      (error) => {
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 60000
      }
    );

    this.positionWatchId = watchId.toString();

    this.checkInterval = setInterval(() => {
      if (this.currentPosition) {
        void this.checkGeofences();
      }
    }, this.LOCATION_CHECK_INTERVAL);
  }

  private async startNativeLocationMonitoring(): Promise<void> {
    const position = await Geolocation.getCurrentPosition({
      enableHighAccuracy: true,
      timeout: 10000
    });
    
    this.currentPosition = {
      lat: position.coords.latitude,
      lng: position.coords.longitude,
      accuracy: position.coords.accuracy ?? null,
      timestamp: Date.now()
    };

    this.positionWatchId = await Geolocation.watchPosition({
      enableHighAccuracy: true,
      timeout: 10000
    }, (position, err) => {
      if (position) {
        this.currentPosition = {
          lat: position.coords.latitude,
          lng: position.coords.longitude,
          accuracy: position.coords.accuracy ?? null,
          timestamp: Date.now()
        };
        void this.checkGeofences();
      }
    });

    this.checkInterval = setInterval(() => {
      if (this.currentPosition) {
        void this.checkGeofences();
      }
    }, this.LOCATION_CHECK_INTERVAL);
  }

  private async checkGeofences(): Promise<void> {
    if (!this.currentPosition || !this.isMonitoring) {
      return;
    }

    for (const spot of this.monitoredSpots) {
      if (this.visitedSpots.has(spot.id)) {
        this.dwellStartTimes.delete(spot.id);
        continue;
      }

      const distance = this.calculateDistance(
        this.currentPosition.lat,
        this.currentPosition.lng,
        spot.latitude,
        spot.longitude
      );

      if (distance <= spot.radius && this.isLocationAccurate()) {
        await this.handleDwellConfirmation(spot);
      } else {
        this.dwellStartTimes.delete(spot.id);
      }
    }
  }

  private isLocationAccurate(): boolean {
    if (!this.currentPosition) {
      return false;
    }

    if (this.currentPosition.accuracy == null) {
      return true;
    }

    return this.currentPosition.accuracy <= this.MAX_ACCEPTABLE_ACCURACY;
  }

  private async handleDwellConfirmation(spot: GeofenceSpot): Promise<void> {
    const startTime = this.dwellStartTimes.get(spot.id);
    const now = Date.now();

    if (!startTime) {
      this.dwellStartTimes.set(spot.id, now);
      return;
    }

    if (now - startTime >= this.MIN_DWELL_TIME) {
      this.dwellStartTimes.delete(spot.id);
      await this.confirmVisit(spot);
    }
  }

  private async confirmVisit(spot: GeofenceSpot): Promise<void> {
    try {
      const canonicalSpotId = spot.touristSpotId || spot.id;

      this.visitedSpots.add(canonicalSpotId);
      this.visitedSpotsSubject.next(new Set(this.visitedSpots));

      const visitRecord: VisitRecord = {
        userId: 'anonymous',
        touristSpotId: canonicalSpotId,
        touristSpotName: spot.name,
        visitDate: new Date(),
        latitude: this.currentPosition!.lat,
        longitude: this.currentPosition!.lng,
        accuracy: this.currentPosition?.accuracy ?? null,
        confirmed: true
      };

      const user = await this.afAuth.currentUser;
      if (user) {
        visitRecord.userId = user.uid;
        await this.persistVisitToFirestore(user.uid, { ...spot, id: canonicalSpotId, touristSpotId: canonicalSpotId }, visitRecord);
      }

      await this.saveVisitRecord(visitRecord);
      this.saveVisitedSpots();

      const toast = await this.toastCtrl.create({
        message: `Visit to ${spot.name} recorded automatically!`,
        duration: 4000,
        position: 'top',
        color: 'success',
        icon: 'checkmark-circle'
      });
      await toast.present();

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

  private async persistVisitToFirestore(userId: string, spot: GeofenceSpot, visitRecord: VisitRecord): Promise<void> {
    try {
      const visitedAt = visitRecord.visitDate;
      const canonicalSpotId = spot.touristSpotId || spot.id;

      const visitedRef = this.firestore.collection(`users/${userId}/visitedSpots`).doc(canonicalSpotId);
      await visitedRef.set({
        spotId: canonicalSpotId,
        touristSpotId: canonicalSpotId,
        name: spot.name,
        latitude: spot.latitude,
        longitude: spot.longitude,
        visitedAt,
        accuracy: visitRecord.accuracy ?? null,
        source: 'geofence'
      }, { merge: true });

      const userDocRef = this.firestore.collection('users').doc(userId);
      const updatedUserSnapshot = await userDocRef.get().toPromise();
      const updatedUserData = updatedUserSnapshot?.data();

      if (updatedUserData) {
        await this.badgeService.evaluateExplorerBadge(userId, updatedUserData);
      }
    } catch (error) {
      console.error('Failed to persist visit to Firestore:', error);
    }
  }

  private extractTouristSpotsFromItinerary(itinerary: any[]): GeofenceSpot[] {
    const uniqueSpots = new Map<string, GeofenceSpot>();
    
    itinerary.forEach(day => {
      if (!day?.spots || !Array.isArray(day.spots)) {
        return;
      }

      day.spots.forEach((spot: any) => {
        const canonicalSpotId = spot?.touristSpotId || spot?.spotId || spot?.id;
        if (!canonicalSpotId) {
          console.warn('[GeofencingService] Skipping itinerary spot without a Firestore document ID. Geofence not created.', spot);
          return;
        }

        const lat = spot?.location?.lat;
        const lng = spot?.location?.lng;
        if (typeof lat !== 'number' || typeof lng !== 'number' || isNaN(lat) || isNaN(lng)) {
          console.warn('[GeofencingService] Skipping itinerary spot without valid coordinates. Geofence not created.', spot);
          return;
        }

        if (!uniqueSpots.has(canonicalSpotId)) {
          uniqueSpots.set(canonicalSpotId, {
            id: canonicalSpotId,
            touristSpotId: canonicalSpotId,
            name: spot?.name || 'Unknown Spot',
            latitude: lat,
            longitude: lng,
            radius: this.DEFAULT_RADIUS
          });
        }
      });
    });
    
    return Array.from(uniqueSpots.values());
  }

  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371e3; // Earth's radius in meters
    const phi1 = lat1 * Math.PI / 180;
    const phi2 = lat2 * Math.PI / 180;
    const deltaPhi = (lat2 - lat1) * Math.PI / 180;
    const deltaLambda = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(deltaPhi/2) * Math.sin(deltaPhi/2) +
              Math.cos(phi1) * Math.cos(phi2) *
              Math.sin(deltaLambda/2) * Math.sin(deltaLambda/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));

    return R * c;
  }

  private async saveVisitRecord(visitRecord: VisitRecord): Promise<void> {
    
    const existingRecords = JSON.parse(localStorage.getItem('visit_records') || '[]');
    visitRecord.id = `visit_${Date.now()}_${Math.random()}`;
    existingRecords.push(visitRecord);
    localStorage.setItem('visit_records', JSON.stringify(existingRecords));
  }

  private loadVisitedSpots(): void {
    const stored = localStorage.getItem('visited_spots');
    if (stored) {
      try {
        const visitedArray = JSON.parse(stored);
        this.visitedSpots = new Set(visitedArray);
        this.visitedSpotsSubject.next(new Set(this.visitedSpots));
      } catch (error) {
        console.error('Error loading visited spots:', error);
      }
    }
  }

  private saveVisitedSpots(): void {
    const visitedArray = Array.from(this.visitedSpots);
    localStorage.setItem('visited_spots', JSON.stringify(visitedArray));
  }

  hasVisited(spotId: string): boolean {
    return this.visitedSpots.has(spotId);
  }

  getVisitedSpots(): Set<string> {
    return new Set(this.visitedSpots);
  }

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

  isCurrentlyMonitoring(): boolean {
    return this.isMonitoring;
  }

  getMonitoredSpots(): GeofenceSpot[] {
    return [...this.monitoredSpots];
  }

  private isLocationAvailable(): boolean {
    if (this.platform.is('desktop') || this.platform.is('mobileweb')) {
      return 'geolocation' in navigator;
    }
    return true; // Assume available on native mobile
  }
}
