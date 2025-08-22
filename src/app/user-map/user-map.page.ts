import { Component, AfterViewInit, OnDestroy, NgZone, ComponentFactoryResolver, ViewContainerRef, Injector } from '@angular/core';
import { NavController, ToastController, ModalController } from '@ionic/angular';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { HttpClient } from '@angular/common/http';
import { BucketService } from '../services/bucket-list.service';
import * as L from 'leaflet';
import { TouristSpotSheetComponent } from './tourist-spot-sheet.component';
import { DirectionsService } from '../services/directions.service';
import { ApiTrackerService } from '../services/api-tracker.service';
import { Geolocation } from '@capacitor/geolocation';
import { ItineraryService, ItineraryDay } from '../services/itinerary.service';
import { DaySpotPickerComponent } from './day-spot-picker.component';
import { CalendarService, CalendarEvent } from '../services/calendar.service';
import { environment } from '../../environments/environment';
import { RouteDetailsOverlayComponent } from './route-details-overlay.component';
import { BadgeService } from '../services/badge.service';

@Component({
  selector: 'app-user-map',
  templateUrl: './user-map.page.html',
  styleUrls: ['./user-map.page.scss'],
  standalone: false,
})
export class UserMapPage implements AfterViewInit, OnDestroy {
  private map!: L.Map;
  private markers: L.Marker[] = [];
  private userMarker?: L.Marker;
  private stopMarker?: L.Marker;
  private walkLine?: L.Polyline;
  private jeepneyLine?: L.Polyline;
  searchQuery: string = '';
  touristSpots: any[] = [];
  public bucketService: BucketService;
  private routeLine?: L.Polyline;
  private routeLines: (L.Polyline | L.Marker)[] = [];
  
  // Pin system for API routes
  private apiMarkers: L.Marker[] = [];
  private apiRouteLines: (L.Polyline | L.Marker)[] = [];
  itinerary: ItineraryDay[] = [];
  navigationInstructions: string[] = [];
  navigating: boolean = false;

  // Add missing properties for template
  selectedTab: string = 'spots';
  selectedTile: string = 'osm';
  selectedItineraryIndex: number = -1; // Start with no selection
  availableItineraries: any[] = [];
  currentRouteInfo: any = null;
  routeType: string = 'api'; // Focus purely on API routes
  apiRouteInfo: any = null;
  isLoadingApiRoutes: boolean = false;
  

  
  // Simulated user location for PC development
  userLocation = {
    lat: 10.28538157993902, // Simulated location for PC development
    lng: 123.869115789095,
    name: 'Simulated Location (PC Development)',
    isReal: false
  };
  
  // Location tracking
  private locationWatcher?: string;
  private isLocationTracking: boolean = false;
  private locationUpdateInterval: number = 10000; // Update every 10 seconds
  
  // Jeepney routes loaded from Firebase
  jeepneyRoutes: any[] = [];
  isLoadingJeepneyRoutes: boolean = false;
  
  // Fullscreen mode
  isFullscreen: boolean = false;

  constructor(
    private navCtrl: NavController,
    private afAuth: AngularFireAuth,
    private firestore: AngularFirestore,
    private http: HttpClient,
    bucketService: BucketService,
    private toastCtrl: ToastController,
    private ngZone: NgZone,
    private modalCtrl: ModalController,
    private directionsService: DirectionsService,
    private apiTracker: ApiTrackerService,
    private itineraryService: ItineraryService,
    private calendarService: CalendarService,
    private componentFactoryResolver: ComponentFactoryResolver,
    private viewContainerRef: ViewContainerRef,
    private injector: Injector,
    private badgeService: BadgeService
  ) {
    this.bucketService = bucketService;
  }

  // Add missing methods for template
  async onTabChange() {
    // Clear all existing layers
    this.map.eachLayer((layer) => {
      if (layer instanceof L.Marker || layer instanceof L.Polyline) {
        this.map.removeLayer(layer);
      }
    });
    
    // Reset all marker arrays and references
    this.markers = [];
    this.apiMarkers = [];
    this.routeLines = [];
    this.apiRouteLines = [];
    this.userMarker = undefined;
    this.stopMarker = undefined;
    this.walkLine = undefined;
    this.jeepneyLine = undefined;
    this.routeLine = undefined;
    
    // Force map refresh
    this.map.invalidateSize();
    
    if (this.selectedTab === 'directions') {
      await this.loadAvailableItineraries();
      await this.loadJeepneyRoutes(); // Load jeepney routes first
      await this.showDirectionsAndRoutes();
      
      // Don't automatically load routes - let user choose route type first
    } else if (this.selectedTab === 'spots') {
      this.showTouristSpots();
    }
  }

  async onRouteTypeChange() {
    if (this.selectedTab === 'directions') {
      // Clear all existing routes and markers
      this.clearAllRouteLines();
      this.clearAllMarkers();
      
      // Always use API routes
      await this.fetchApiRoutes();
    }
  }

  onTileChange() {
    if (this.map) {
      // Remove existing tile layer
      this.map.eachLayer((layer) => {
        if (layer instanceof L.TileLayer) {
          this.map.removeLayer(layer);
        }
      });

      // Add new tile layer based on selection
      let tileUrl: string;
      if (this.selectedTile === 'esri') {
        tileUrl = 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}';
      } else {
        tileUrl = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
      }

      L.tileLayer(tileUrl, {
        attribution: this.selectedTile === 'esri' ? '© Esri' : '© OpenStreetMap contributors',
        maxZoom: 18,
      }).addTo(this.map);
    }
  }

  async loadAvailableItineraries() {
    try {
      const events = await this.calendarService.forceRefreshFromFirestore();
      
      if (events && events.length > 0) {
        const itineraries = this.groupEventsIntoItineraries(events);
        
        if (itineraries.length > 0) {
          this.availableItineraries = itineraries;
        } else {
          this.availableItineraries = [];
        }
      } else {
        this.availableItineraries = [];
      }
    } catch (error) {
      console.error('Error loading itinerary data:', error);
      this.availableItineraries = [];
    }
  }

  async loadJeepneyRoutes(): Promise<void> {
    this.isLoadingJeepneyRoutes = true;
    
    try {
      // Try to load from cache first
      const cached = localStorage.getItem('jeepney_routes_cache');
      if (cached) {
        this.jeepneyRoutes = JSON.parse(cached);
        this.isLoadingJeepneyRoutes = false;
        return;
      }
      
      // Load from Firebase
      const routesSnapshot = await this.firestore.collection('jeepney_routes').get().toPromise();
      
      if (routesSnapshot && !routesSnapshot.empty) {
        this.jeepneyRoutes = routesSnapshot.docs.map(doc => {
          const data = doc.data() as any;
          const route = { id: doc.id, ...data };
          
          // Keep points as waypoints for route tracking
          // Don't convert to stops since these are tracking points, not actual stops
          
          return route;
        });
        // Cache the routes
        localStorage.setItem('jeepney_routes_cache', JSON.stringify(this.jeepneyRoutes));
      } else {
        // Fallback to default routes if Firebase is empty
        this.jeepneyRoutes = this.getDefaultJeepneyRoutes();
      }
    } catch (error) {
      console.error('Error loading jeepney routes:', error);
      // Fallback to default routes
      this.jeepneyRoutes = this.getDefaultJeepneyRoutes();
    } finally {
      this.isLoadingJeepneyRoutes = false;
    }
  }

  private getDefaultJeepneyRoutes(): any[] {
    return [
      {
        code: '12C',
        name: 'Cebu City - Mandaue City',
        color: '#FF5722',
        stops: [
          { name: 'Saint Anthony Hospital', lat: 10.3157, lng: 123.8854 },
          { name: 'Sto Nino Church', lat: 10.2957, lng: 123.8814 },
          { name: 'Carbon Market', lat: 10.2857, lng: 123.8754 },
          { name: 'Colon Street', lat: 10.2757, lng: 123.8694 }
        ]
      },
      {
        code: '01A',
        name: 'Cebu City - Talisay City',
        color: '#2196F3',
        stops: [
          { name: 'Sto Nino Church', lat: 10.2957, lng: 123.8814 },
          { name: 'Fuente Osmeña', lat: 10.3057, lng: 123.8914 },
          { name: 'Ayala Center Cebu', lat: 10.3257, lng: 123.9014 },
          { name: 'Talisay City', lat: 10.2557, lng: 123.8514 }
        ]
      },
      {
        code: '04C',
        name: 'Cebu City - Mactan Airport',
        color: '#4CAF50',
        stops: [
          { name: 'Fuente Osmeña', lat: 10.3057, lng: 123.8914 },
          { name: 'SM City Cebu', lat: 10.3357, lng: 123.9114 },
          { name: 'Mactan Airport', lat: 10.3157, lng: 123.9814 }
        ]
      }
    ];
  }

  private groupEventsIntoItineraries(events: any[]): any[] {
    const itineraries: any[] = [];
    const groupedEvents = new Map<string, any[]>();

    // Group events by date
    events.forEach(event => {
      const date = event.start.split('T')[0]; // Get just the date part
      if (!groupedEvents.has(date)) {
        groupedEvents.set(date, []);
      }
      groupedEvents.get(date)!.push(event);
    });

    // Convert grouped events to itineraries
    groupedEvents.forEach((dayEvents, date) => {
      if (dayEvents.length > 0) {
        // Sort events by start time
        dayEvents.sort((a, b) => new Date(a.start).getTime() - new Date(b.start).getTime());
        
        const firstEvent = dayEvents[0];
        const lastEvent = dayEvents[dayEvents.length - 1];
        
        const itinerary = {
          id: `itinerary_${date}`,
          name: `Itinerary for ${this.getDateDisplay(date)}`,
          start: firstEvent.start,
          end: lastEvent.end,
          date: date,
          status: firstEvent.status || 'active',
          days: [{
            day: 1,
            date: date,
            spots: dayEvents.map((event: any) => {
              // Try to get location from event first, then from tourist spots
              let location = event.extendedProps?.location || { lat: 0, lng: 0 };
              
              // If location is invalid (0,0), try to find it in tourist spots
              if ((location.lat === 0 && location.lng === 0) || !location.lat || !location.lng) {
                const matchingSpot = this.touristSpots.find(spot => 
                  spot.name === event.title || 
                  spot.id === event.extendedProps?.spotId
                );
                if (matchingSpot && matchingSpot.location) {
                  location = matchingSpot.location;
                }
              }
              
              return {
                id: event.extendedProps?.spotId || event.id || '',
                name: event.title || 'Unknown Spot',
                description: event.extendedProps?.description || '',
                category: event.extendedProps?.category || 'GENERAL',
                timeSlot: event.start?.split('T')[1]?.substring(0, 5) || '09:00',
                estimatedDuration: event.extendedProps?.duration || '2 hours',
                durationMinutes: event.extendedProps?.durationMinutes || 120,
                location: location,
                img: event.extendedProps?.img || 'assets/img/default.png',
                mealType: event.extendedProps?.mealType || null
              };
            })
          }]
        };
        
        itineraries.push(itinerary);
      }
    });

    return itineraries;
  }

  private getDateDisplay(dateString: string): string {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', { 
      weekday: 'long', 
      year: 'numeric', 
      month: 'long', 
      day: 'numeric' 
    });
  }





  loadItineraryRoutes() {
    if (this.selectedItineraryIndex < 0 || this.selectedItineraryIndex >= this.availableItineraries.length) {
      // Clear any existing route data when no itinerary is selected
      this.currentRouteInfo = null;
      this.apiRouteInfo = null;
      this.clearAllRouteLines();
      this.clearAllMarkers();
      return;
    }
    
    if (this.availableItineraries.length > 0 && this.selectedItineraryIndex < this.availableItineraries.length) {
      const selectedItinerary = this.availableItineraries[this.selectedItineraryIndex];
      
      // Clear any existing routes when itinerary changes
      this.clearAllRouteLines();
      this.clearAllMarkers();
      this.currentRouteInfo = null;
      this.apiRouteInfo = null;
      
      // Show markers immediately when itinerary is selected
      this.showItineraryMarkersOnly(selectedItinerary);
      
      // Automatically fetch API routes
      this.fetchApiRoutes();
    } else {
      this.currentRouteInfo = null;
      this.apiRouteInfo = null;
    }
  }

  formatItineraryTitle(itinerary: any): string {
    if (!itinerary) return 'Unknown Itinerary';
    
    // Try to get a meaningful name from the itinerary
    const dayCount = itinerary.days?.length || 0;
    const spotCount = itinerary.days?.[0]?.spots?.length || 0;
    
    if (itinerary.name && itinerary.name !== `Day ${1} Itinerary`) {
      return `${itinerary.name} (${dayCount} day${dayCount > 1 ? 's' : ''}, ${spotCount} spots)`;
    }
    
    return `Day ${1} Itinerary - ${spotCount} spots`;
  }

  private showItineraryMarkersOnly(itinerary: any): void {
    if (!itinerary || !itinerary.days) {
      return;
    }

    // Use real user location
    const userLocation = this.userLocation;

    // Clear existing markers
    this.apiMarkers.forEach(marker => {
      if (this.map.hasLayer(marker)) {
        this.map.removeLayer(marker);
      }
    });
    this.apiMarkers = [];

    // Add user location marker
    const userMarker = L.marker([userLocation.lat, userLocation.lng], {
      icon: L.divIcon({
        html: `<div style="
          background: #28a745;
          color: white;
          border-radius: 50%;
          width: 25px;
          height: 25px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          border: 2px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        ">📍</div>`,
        className: 'user-location-marker',
        iconSize: [25, 25],
        iconAnchor: [12, 12]
      })
    }).addTo(this.map);

    // Add popup for user location
    userMarker.bindPopup(`
      <div style="min-width: 150px;">
        <h4 style="margin: 0 0 8px 0; color: #333;">Your Location</h4>
        <p style="margin: 4px 0; color: #666;">${userLocation.name}</p>
      </div>
    `);

    this.apiMarkers.push(userMarker);

    // Create a map to track unique locations and prevent duplicates
    const locationMap = new Map<string, any>();
    let spotIndex = 1;

    // Add markers for each spot
    itinerary.days.forEach((day: any) => {
      if (day.spots) {
        const daySpotsArray = Array.isArray(day.spots) ? day.spots : Object.values(day.spots);
        daySpotsArray.forEach((spot: any) => {
          if (spot && spot.location && spot.location.lat && spot.location.lng) {
            // Create a unique key for this location (rounded to 4 decimal places to handle slight variations)
            const locationKey = `${spot.location.lat.toFixed(4)},${spot.location.lng.toFixed(4)}`;
            
            // Check if we already have a marker at this location
            if (locationMap.has(locationKey)) {
              return; // Skip creating duplicate marker
            }
            
            // Add to location map to prevent duplicates
            locationMap.set(locationKey, spot);
            
            const spotMarker = L.marker([spot.location.lat, spot.location.lng], {
              icon: this.getApiRouteMarkerIcon(spot, spotIndex)
            }).addTo(this.map);

            // Add popup for spot marker
            spotMarker.bindPopup(this.createDirectionSpotPopup(spot, spotIndex));
            this.apiMarkers.push(spotMarker);
            spotIndex++;
          }
        });
      }
    });

    // Fit map to show all markers
    if (this.apiMarkers.length > 0) {
      const group = L.featureGroup(this.apiMarkers);
      this.map.fitBounds(group.getBounds().pad(0.1));
    }
  }

  getRouteIcon(segmentType: string): string {
    switch (segmentType) {
      case 'walk': return 'walk';
      case 'jeepney': return 'car';
      case 'transfer': return 'swap-horizontal';
      case 'meal': return 'restaurant';
      default: return 'location';
    }
  }

  getRouteColor(segmentType: string): string {
    switch (segmentType) {
      case 'walk': return 'success';
      case 'jeepney': return 'warning';
      case 'transfer': return 'secondary';
      case 'meal': return 'primary';
      default: return 'medium';
    }
  }

  showRouteOnMap(segment: any) {
    // Implementation for showing individual route segment on map
    // This would draw the specific segment on the map
  }

  showAllRoutesOnMap() {
    if (this.currentRouteInfo && this.currentRouteInfo.segments) {
      // Clear existing routes
      if (this.routeLine) this.map.removeLayer(this.routeLine);
      
      // Draw all segments
      this.currentRouteInfo.segments.forEach((segment: any) => {
        // Implementation for drawing all routes
      });
    }
  }

  generateRouteInfo(itinerary: any): any {
    // Generate route information from itinerary using multi-ride jeepney routing
    if (!itinerary || !itinerary.days) return null;

    const segments: any[] = [];
    let totalDuration = 0;
    let totalDistance = 0;

    itinerary.days.forEach((day: any, dayIndex: number) => {
      // Handle different spot data structures
      let spots = [];
      if (day.spots) {
        if (Array.isArray(day.spots)) {
          spots = day.spots;
        } else if (typeof day.spots === 'object') {
          // If spots is an object, convert it to array
          spots = Object.values(day.spots);
        } else {
          spots = [day.spots];
        }
      }
      
      spots.forEach((spot: any, spotIndex: number) => {
        if (!spot || !spot.name) return;
        
        // Get jeepney route for this spot
        const jeepneyRoute = this.findBestJeepneyRoute(this.userLocation, spot);
        
        if (jeepneyRoute && jeepneyRoute.segments) {
          // Use the detailed segments from multi-ride routing
          jeepneyRoute.segments.forEach((segment: any) => {
            segments.push({
              type: segment.type,
              from: segment.from,
              to: segment.to,
              estimatedTime: segment.estimatedTime,
              description: segment.description,
              jeepneyCode: segment.jeepneyCode || null,
              mealType: null,
              distance: segment.distance
            });
            
            // Add to totals
            if (segment.distance) {
              totalDistance += segment.distance / 1000; // Convert to km
            }
            if (segment.estimatedTime) {
              const timeMatch = segment.estimatedTime.match(/(\d+)/);
              if (timeMatch) {
                totalDuration += parseInt(timeMatch[1]);
              }
            }
          });
        } else {
          // Fallback to simple walking segment
          segments.push({
            type: 'walk',
            from: spotIndex === 0 ? 'Your Location' : spots[spotIndex - 1]?.name || 'Previous Location',
            to: spot.name,
            estimatedTime: '15 min walk',
            description: `Walk to ${spot.name}`,
            jeepneyCode: null,
            mealType: null
          });
          totalDuration += 15;
          totalDistance += 0.5;
        }

        // Add meal segment if specified
        if (spot.mealType) {
          segments.push({
            type: 'meal',
            from: spot.name,
            to: `${spot.name} - ${spot.mealType}`,
            estimatedTime: '1 hour',
            description: `Enjoy ${spot.mealType} at ${spot.name}`,
            jeepneyCode: null,
            mealType: spot.mealType
          });
          totalDuration += 60;
        }
      });
    });

    return {
      segments,
      totalDuration: `${Math.floor(totalDuration / 60)}h ${totalDuration % 60}m`,
      totalDistance: `${totalDistance.toFixed(1)} km`
    };
  }

  ngAfterViewInit(): void {
    setTimeout(() => {
      this.initMap();
      setTimeout(() => {
        if (this.map) this.map.invalidateSize();
      }, 500);
    }, 200);
    this.loadItinerary();
    this.loadAvailableItineraries();
    this.loadJeepneyRoutes();
    
    // Automatically get user location on startup
    this.getUserLocation();
    
    // Start continuous location tracking
    this.startLocationTracking();
    
    // Add global function for popup buttons
    (window as any).openSpotDetails = (spotName: string) => {
      const spot = this.touristSpots.find(s => s.name === spotName);
      if (spot) {
        this.openSpotSheet(spot);
      }
    };
    
    // Show appropriate markers based on initial tab
    setTimeout(() => {
      if (this.selectedTab === 'directions') {
        this.showDirectionsAndRoutes();
      } else {
        this.showTouristSpots();
      }
    }, 1000);
    
    // Monitor network status changes
    window.addEventListener('online', () => {
      console.log('🌐 Network connection restored');
      this.onNetworkStatusChange(true);
    });
    
    window.addEventListener('offline', () => {
      console.log('📱 Network connection lost');
      this.onNetworkStatusChange(false);
    });
  }

  async loadItinerary() {
    // Load itinerary from bucket service or localStorage (as in bucket-list.page.ts)
    const cached = localStorage.getItem('itinerary_suggestions_cache');
    if (cached) {
      try {
        this.itinerary = JSON.parse(cached);
      } catch { }
    }
  }

  // Add Ionic lifecycle hook to ensure map resizes when page is entered
  ionViewDidEnter() {
    setTimeout(() => {
      if (this.map) this.map.invalidateSize();
    }, 300);
  }

  ngOnDestroy(): void {
    // Stop location tracking
    this.stopLocationTracking();
    
    if (this.map) {
      this.map.remove();
    }
    
    // Remove event listeners
    window.removeEventListener('online', () => this.onNetworkStatusChange(true));
    window.removeEventListener('offline', () => this.onNetworkStatusChange(false));
  }

  private onNetworkStatusChange(isOnline: boolean): void {
    if (isOnline) {
      // User came back online - refresh data from Firebase
      this.refreshTouristSpots();
    } else {
      // User went offline - show offline message
      this.showToast('You are offline. Using cached data.');
    }
  }

  // Getter to access window object in template
  get isOnline(): boolean {
    return window.navigator.onLine;
  }

  // Getter to check if user location is real GPS
  get isRealLocation(): boolean {
    return this.userLocation.isReal;
  }

  // Getter to get user location status text
  get locationStatusText(): string {
    if (this.isLocationTracking) {
      return this.userLocation.isReal ? 'GPS Tracking' : 'Default Location';
    }
    return this.userLocation.isReal ? 'GPS Location' : 'Default Location';
  }

  // Getter to check if location tracking is active
  get isLocationTrackingActive(): boolean {
    return this.isLocationTracking;
  }

  private initMap(): void {
    if (this.map) {
      this.map.remove();
    }
    
    const mapElement = document.getElementById('map');
    
    this.map = L.map('map', {
      center: [10.3157, 123.8854],
      zoom: 12,
      zoomControl: true,
      attributionControl: true,
      dragging: true,
      scrollWheelZoom: true,
      doubleClickZoom: true,
      boxZoom: true,
      keyboard: true
    });
    
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '© OpenStreetMap contributors',
      maxZoom: 18,
    }).addTo(this.map);
    
    this.loadTouristSpots();
    setTimeout(() => {
      this.map.invalidateSize();
    }, 300);
  }

  private async loadTouristSpots(): Promise<void> {
    const cacheKey = 'tourist_spots_cache';
    const isOnline = window.navigator.onLine;
    
    if (isOnline) {
      // User has internet - try to load from Firebase first
      try {
        this.firestore.collection('tourist_spots').valueChanges({ idField: 'id' }).subscribe(spots => {
          this.touristSpots = spots || [];
          localStorage.setItem(cacheKey, JSON.stringify(spots));
          this.showTouristSpots();
        });
      } catch (error) {
        console.error('❌ Error loading from Firebase, falling back to cache:', error);
        this.loadSpotsFromCache();
      }
    } else {
      // User is offline - load from cache
      this.loadSpotsFromCache();
    }
  }

  async refreshTouristSpots(): Promise<void> {
    const cacheKey = 'tourist_spots_cache';
    const isOnline = window.navigator.onLine;
    
    if (isOnline) {
      try {
        this.firestore.collection('tourist_spots').valueChanges({ idField: 'id' }).subscribe(spots => {
          this.touristSpots = spots || [];
          localStorage.setItem(cacheKey, JSON.stringify(spots));
          this.showTouristSpots();
        });
      } catch (error) {
        console.error('❌ Error refreshing from Firebase:', error);
        this.loadSpotsFromCache();
      }
    } else {
      this.loadSpotsFromCache();
    }
  }

  async refreshJeepneyRoutes(): Promise<void> {
    const isOnline = window.navigator.onLine;
    
    if (isOnline) {
      try {
        // Clear cache first
        localStorage.removeItem('jeepney_routes_cache');
        // Reload routes
        await this.loadJeepneyRoutes();
      } catch (error) {
        console.error('❌ Error refreshing jeepney routes:', error);
      }
    }
  }


  private loadSpotsFromCache() {
    const cached = localStorage.getItem('tourist_spots_cache');
    if (cached) {
      try {
        this.touristSpots = JSON.parse(cached);
        this.markers.forEach(m => this.map.removeLayer(m));
        this.markers = [];
        this.showTouristSpots();
      } catch (e) {
        console.error('Error parsing cached tourist spots:', e);
      }
    } else {
      console.warn('No cached tourist spots available.');
    }
  }

  private showTouristSpots(): void {
    this.clearAllMarkers();
    const filtered = this.touristSpots.filter(spot =>
      !this.searchQuery || spot.name?.toLowerCase().includes(this.searchQuery.toLowerCase())
    );
    
    // Create a map to track unique locations and prevent duplicates
    const locationMap = new Map<string, any>();
    
    let validSpots = 0;
    filtered.forEach((spot: any, index: number) => {
      if (!spot.location || !spot.location.lat || !spot.location.lng) {
        return;
      }
      
      // Create a unique key for this location (rounded to 4 decimal places to handle slight variations)
      const locationKey = `${spot.location.lat.toFixed(4)},${spot.location.lng.toFixed(4)}`;
      
      // Check if we already have a marker at this location
      if (locationMap.has(locationKey)) {
        const existingSpot = locationMap.get(locationKey);
        // If this spot has more information or is a different type, update it
        if (spot.category && !existingSpot.category) {
          locationMap.set(locationKey, spot);
        }
        return; // Skip creating duplicate marker
      }
      
      // Add to location map to prevent duplicates
      locationMap.set(locationKey, spot);
      
      const marker = L.marker([spot.location.lat, spot.location.lng], {
        icon: L.icon({
          iconUrl: 'assets/leaflet/marker-icon.png',
          shadowUrl: 'assets/leaflet/marker-shadow.png',
          iconSize: [25, 41],
          shadowSize: [41, 41],
          iconAnchor: [12, 41],
          shadowAnchor: [12, 41],
          popupAnchor: [1, -34]
        })
      }).addTo(this.map);
      
      // Add custom popup to prevent default popup with "Rating" and "Location"
      marker.bindPopup(`
        <div style="min-width: 200px;">
          <h4 style="margin: 0 0 8px 0; color: #333;">${spot.name}</h4>
          <p style="margin: 4px 0; color: #666;">
            <strong>Type:</strong> ${spot.category || 'Tourist Spot'}
          </p>
          <button onclick="window.openSpotDetails('${spot.name}')" 
                  style="background: #ff6b35; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; margin-top: 8px;">
            View Details
          </button>
        </div>
      `);
      
      marker.on('click', () => {
        this.ngZone.run(() => {
          this.openSpotSheet(spot);
        });
      });
      this.markers.push(marker);
      validSpots++;
    });
    
    if (this.markers.length > 0) {
      const group = L.featureGroup(this.markers);
      this.map.fitBounds(group.getBounds(), { padding: [50, 50] });
    }
  }

  private async showDirectionsAndRoutes(): Promise<void> {

    this.clearAllMarkers();
    this.clearAllRouteLines();
    
    if (this.availableItineraries.length === 0) {
  
      return;
    }

    const selectedItinerary = this.availableItineraries[this.selectedItineraryIndex];

    
    if (!selectedItinerary || !selectedItinerary.days) {
  
      return;
    }

    // Use real user location
    const userLocation = this.userLocation;


    // Add user location marker
    const userMarkerIcon = L.divIcon({
      className: 'user-location-marker',
      html: `<div style="
        background-color: #4CAF50;
        width: 20px;
        height: 20px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-weight: bold;
        font-size: 12px;
      ">📍</div>`,
      iconSize: [20, 20],
      iconAnchor: [10, 10]
    });

    const userMarker = L.marker([userLocation.lat, userLocation.lng], {
      icon: userMarkerIcon
    }).addTo(this.map);

    userMarker.bindPopup(`
      <div style="text-align: center; min-width: 150px;">
        <h4 style="margin: 0 0 8px 0; color: #333;">📍 Your Location</h4>
        <p style="margin: 4px 0; color: #666; font-size: 0.9em;">Starting point</p>
      </div>
    `);

    this.markers.push(userMarker);

    const itinerarySpots: any[] = [];
    
    // Collect all spots from the selected itinerary
    selectedItinerary.days.forEach((day: any) => {

      
      // Handle different spot data structures
      let spots = [];
      if (day.spots) {
        if (Array.isArray(day.spots)) {
          spots = day.spots;
        } else if (typeof day.spots === 'object') {
          spots = Object.values(day.spots);
        } else {
          spots = [day.spots];
        }
      }
      
      
      
      spots.forEach((spot: any, spotIndex: number) => {
        
        if (spot && spot.location && spot.location.lat && spot.location.lng) {
          itinerarySpots.push({
            ...spot,
            day: day.day,
            timeSlot: spot.timeSlot,
            order: spotIndex
          });
          
        } else {
  
        }
      });
    });


    
    // Create a map to track unique locations and prevent duplicates
    const locationMap = new Map<string, any>();
    let spotIndex = 1;

    // Create markers for each itinerary spot
    itinerarySpots.forEach((spot: any) => {
      // Create a unique key for this location (rounded to 4 decimal places to handle slight variations)
      const locationKey = `${spot.location.lat.toFixed(4)},${spot.location.lng.toFixed(4)}`;
      
      // Check if we already have a marker at this location
      if (locationMap.has(locationKey)) {
        return; // Skip creating duplicate marker
      }
      
      // Add to location map to prevent duplicates
      locationMap.set(locationKey, spot);
      
      const markerIcon = this.getMarkerIconForSpot(spot);
      
      const marker = L.marker([spot.location.lat, spot.location.lng], {
        icon: markerIcon
      }).addTo(this.map);

      // Create popup content with direction info
      const popupContent = this.createDirectionSpotPopup(spot, spotIndex);
      marker.bindPopup(popupContent);

      marker.on('click', () => {
        this.ngZone.run(() => {
          this.openItinerarySpotSheet(spot);
        });
      });

      this.markers.push(marker);
      spotIndex++;
    });

    // Draw complete route from user location through all spots
    if (itinerarySpots.length > 0) {
      this.drawCompleteRoute(userLocation, itinerarySpots);
    }


    
    // Fit map to show all markers including user location
    if (this.markers.length > 0) {
      const group = L.featureGroup(this.markers);
      this.map.fitBounds(group.getBounds(), { padding: [50, 50] });

    } else {

    }
  }

  private clearAllMarkers(): void {
    // Clear all markers
    this.markers.forEach(marker => {
      if (this.map.hasLayer(marker)) {
        this.map.removeLayer(marker);
      }
    });
    this.markers = [];

    // Clear API markers
    this.apiMarkers.forEach(marker => {
      if (this.map.hasLayer(marker)) {
        this.map.removeLayer(marker);
      }
    });
    this.apiMarkers = [];
  }

  private clearApiMarkers(): void {
    // Clear only API markers
    this.apiMarkers.forEach(marker => {
      if (this.map.hasLayer(marker)) {
        this.map.removeLayer(marker);
      }
    });
    this.apiMarkers = [];
  }

  private clearAllRouteLines(): void {
    // Clear all route lines
    this.routeLines.forEach(layer => {
      if (this.map.hasLayer(layer)) {
        this.map.removeLayer(layer);
      }
    });
    this.routeLines = [];

    // Clear API route lines
    this.apiRouteLines.forEach(layer => {
      if (this.map.hasLayer(layer)) {
        this.map.removeLayer(layer);
      }
    });
    this.apiRouteLines = [];
  }

  private getMarkerIconForSpot(spot: any): L.DivIcon {
    let iconColor = '#3388ff'; // Default blue for tourist spots
    let iconName = 'location';

    // Determine icon based on spot type
    if (spot.mealType) {
      iconColor = '#ff6b35'; // Orange for restaurants
      iconName = 'restaurant';
    } else if (spot.category === 'HOTEL' || spot.name.toLowerCase().includes('hotel')) {
      iconColor = '#1976d2'; // Blue for hotels
      iconName = 'bed';
    } else if (spot.category === 'RESTAURANT' || spot.name.toLowerCase().includes('restaurant')) {
      iconColor = '#ff6b35'; // Orange for restaurants
      iconName = 'restaurant';
    } else {
      iconColor = '#4caf50'; // Green for tourist spots
      iconName = 'location';
    }

    return L.divIcon({
      className: 'custom-marker',
      html: `<div style="
        background-color: ${iconColor};
        width: 30px;
        height: 30px;
        border-radius: 50%;
        border: 3px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        display: flex;
        align-items: center;
        justify-content: center;
        color: white;
        font-size: 16px;
        font-weight: bold;
      ">${this.getIconSymbol(iconName)}</div>`,
      iconSize: [30, 30],
      iconAnchor: [15, 15],
      popupAnchor: [0, -15]
    } as L.DivIconOptions);
  }

  private getIconSymbol(iconName: string): string {
    switch (iconName) {
      case 'restaurant': return '🍽️';
      case 'bed': return '🛏️';
      case 'location': return '📍';
      default: return '📍';
    }
  }



  private getApiRouteMarkerIcon(spot: any, order: number): L.DivIcon {
    return L.divIcon({
      html: `<div style="
        background: #007bff;
        color: white;
        border-radius: 50%;
        width: 35px;
        height: 35px;
        display: flex;
        align-items: center;
        justify-content: center;
        font-size: 12px;
        font-weight: bold;
        border: 3px solid white;
        box-shadow: 0 3px 10px rgba(0,0,0,0.4);
        position: relative;
      ">
        <div style="position: absolute; top: -5px; right: -5px; background: #007bff; color: white; border-radius: 50%; width: 20px; height: 20px; display: flex; align-items: center; justify-content: center; font-size: 10px; font-weight: bold; border: 2px solid white;">
          A
        </div>
        🗺️
      </div>`,
      className: 'api-route-marker',
      iconSize: [35, 35],
      iconAnchor: [17, 17]
    });
  }

  private createItinerarySpotPopup(spot: any, order: number): string {
    return `
      <div style="min-width: 200px;">
        <h4 style="margin: 0 0 8px 0; color: #333;">${order}. ${spot.name}</h4>
        <p style="margin: 4px 0; color: #666;">
          <strong>Time:</strong> ${spot.timeSlot || 'TBD'}
        </p>
        <p style="margin: 4px 0; color: #666;">
          <strong>Duration:</strong> ${spot.estimatedDuration || '1 hour'}
        </p>
        ${spot.mealType ? `<p style="margin: 4px 0; color: #ff6b35;"><strong>Meal:</strong> ${spot.mealType}</p>` : ''}
        ${spot.category ? `<p style="margin: 4px 0; color: #666;"><strong>Type:</strong> ${spot.category}</p>` : ''}
        <button onclick="window.openItinerarySpotDetails('${spot.name}')" 
                style="background: #ff6b35; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; margin-top: 8px;">
          View Details
        </button>
      </div>
    `;
  }

  private createDirectionSpotPopup(spot: any, order: number): string {
    const jeepneyCode = this.getJeepneyCodeForSpot(spot, order);
    return `
      <div style="min-width: 250px;">
        <h4 style="margin: 0 0 8px 0; color: #333;">${order}. ${spot.name}</h4>
        <p style="margin: 4px 0; color: #666;">
          <strong>Time:</strong> ${spot.timeSlot || 'TBD'}
        </p>
        <p style="margin: 4px 0; color: #666;">
          <strong>Duration:</strong> ${spot.estimatedDuration || '1 hour'}
        </p>
        ${spot.mealType ? `<p style="margin: 4px 0; color: #ff6b35;"><strong>Meal:</strong> ${spot.mealType}</p>` : ''}
        ${spot.category ? `<p style="margin: 4px 0; color: #666;"><strong>Type:</strong> ${spot.category}</p>` : ''}
        ${jeepneyCode ? 
          jeepneyCode.includes('🚶') ? 
            `<p style="margin: 4px 0; color: #ff6b35; font-weight: bold;"><strong>🚶 Transport:</strong> Walking only - No public transport available</p>` :
            `<p style="margin: 4px 0; color: #1976d2; font-weight: bold;"><strong>🚌 Jeepney:</strong> ${jeepneyCode}</p>`
          : ''
        }
        <button onclick="window.openItinerarySpotDetails('${spot.name}')" 
                style="background: #ff6b35; color: white; border: none; padding: 6px 12px; border-radius: 4px; cursor: pointer; margin-top: 8px;">
          View Details
        </button>
      </div>
    `;
  }

  private openItinerarySpotSheet(spot: any): void {
    // For now, we'll use the same spot sheet component
    // You can create a specialized component for itinerary spots later
    this.openSpotSheet(spot);
  }

  async openSpotSheet(spot: any) {
    const modal = await this.modalCtrl.create({
      component: TouristSpotSheetComponent,
      componentProps: { spot },
      backdropDismiss: true
    });
    modal.onDidDismiss().then(async (result: any) => {
      if (result.data && result.data.addToBucket) {
        try {
          await this.bucketService.addToBucket(result.data.spot);
          this.toastCtrl.create({
            message: `${result.data.spot.name} added to bucket list!`,
            duration: 2000,
            color: 'success',
            position: 'top',
            buttons: [
              {
                icon: 'checkmark-circle',
                side: 'start'
              }
            ]
          }).then(toast => toast.present());
        } catch (error) {
          console.error('Error adding to bucket list:', error);
          this.toastCtrl.create({
            message: 'Failed to add to bucket list. Please try again.',
            duration: 2000,
            color: 'danger',
            position: 'top'
          }).then(toast => toast.present());
        }
      }
    });
    await modal.present();
  }



  goBack() {
    this.navCtrl.back();
  }

  toggleFullscreen() {
    this.isFullscreen = !this.isFullscreen;
    
    // Force map to resize when toggling fullscreen
    setTimeout(() => {
      if (this.map) {
        this.map.invalidateSize();
      }
    }, 100);
  }

  toggleMapType() {
    // Toggle between satellite and street view
    this.selectedTile = this.selectedTile === 'esri' ? 'osm' : 'esri';
    this.onTileChange();
  }



  // Fetch and display a transit route from current location to a tourist spot
  async showRouteToSpot(spot: any) {
    // Example: Use a fixed origin for demo, replace with user's location if available
    const origin = 'Cebu City, Cebu';
    const destination = `${spot.location.lat},${spot.location.lng}`;
    // Check limiter
    const canCall = await this.apiTracker.canCallApiToday('directions', 100);
    if (!canCall) {
      this.toastCtrl.create({
        message: 'You have reached your daily limit for route requests. Please try again tomorrow.',
        duration: 3000,
        color: 'danger'
      }).then(toast => toast.present());
      return;
    }
    // Log the API call
    this.apiTracker.logApiCall('directions', 'route', { origin, destination });
    // Fetch route
    this.directionsService.getTransitRoute(origin, destination).subscribe((result: any) => {
      if (result.status === 'OK' && result.routes.length > 0) {
        const polyline = result.routes[0].overview_polyline.points;
        const latlngs = this.decodePolyline(polyline);
        // Remove existing route if any
        if (this.routeLine) this.map.removeLayer(this.routeLine);
        this.routeLine = L.polyline(latlngs, { color: 'blue', weight: 5 }).addTo(this.map);
        this.map.fitBounds(this.routeLine.getBounds(), { padding: [50, 50] });
      } else {
        this.toastCtrl.create({
          message: 'No route found.',
          duration: 2000,
          color: 'warning'
        }).then(toast => toast.present());
      }
    }, error => {
      this.toastCtrl.create({
        message: 'Error fetching route.',
        duration: 2000,
        color: 'danger'
      }).then(toast => toast.present());
    });
  }

  async getUserLocation(): Promise<void> {
    // For PC development, use simulated location instead of real GPS
    this.userLocation = {
      lat: 10.28538157993902, // Simulated location for PC development
      lng: 123.869115789095,
      name: 'Simulated Location (PC Development)',
      isReal: false
    };
    
    // Add or update user marker on map
    if (this.userMarker) {
      this.map.removeLayer(this.userMarker);
    }
    
    this.userMarker = L.marker([this.userLocation.lat, this.userLocation.lng], {
      icon: L.divIcon({
        html: `<div style="
          background: #1976d2;
          color: white;
          border-radius: 50%;
          width: 20px;
          height: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        ">📍</div>`,
        className: 'user-location-marker',
        iconSize: [20, 20],
        iconAnchor: [10, 10]
      })
    }).addTo(this.map);
    
    // Center map on user location
    this.map.setView([this.userLocation.lat, this.userLocation.lng], 15);
    
    console.log('✅ Simulated user location set:', this.userLocation);
  }

  // Start continuous location tracking
  async startLocationTracking(): Promise<void> {
    if (this.isLocationTracking) {
      console.log('📍 Location tracking already active');
      return;
    }

    try {
      // Request permissions first
      const permissionStatus = await Geolocation.checkPermissions();
      if (permissionStatus.location !== 'granted') {
        const requestResult = await Geolocation.requestPermissions();
        if (requestResult.location !== 'granted') {
          this.showToast('Location permission is required for tracking');
          return;
        }
      }

      // Start watching location
      this.locationWatcher = await Geolocation.watchPosition(
        {
          enableHighAccuracy: true,
          timeout: 10000,
          maximumAge: 5000
        },
        (position) => {
          this.ngZone.run(() => {
            this.updateUserLocationFromPosition(position);
          });
        }
      );

      this.isLocationTracking = true;
      console.log('📍 Location tracking started');
      this.showToast('Location tracking activated');
    } catch (error) {
      console.error('❌ Error starting location tracking:', error);
      this.showToast('Could not start location tracking');
    }
  }

  // Stop continuous location tracking
  async stopLocationTracking(): Promise<void> {
    if (!this.isLocationTracking || !this.locationWatcher) {
      return;
    }

    try {
      await Geolocation.clearWatch({ id: this.locationWatcher });
      this.locationWatcher = undefined;
      this.isLocationTracking = false;
      console.log('📍 Location tracking stopped');
      this.showToast('Location tracking deactivated');
    } catch (error) {
      console.error('❌ Error stopping location tracking:', error);
    }
  }

  // Update user location from position update
  private async updateUserLocationFromPosition(position: any): Promise<void> {
    try {
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      
      // Snap location to nearest road using OSRM
      const snappedLocation = await this.snapLocationToRoad(lat, lng);
      
      // Update user location with real GPS coordinates
      this.userLocation = {
        lat: snappedLocation.lat,
        lng: snappedLocation.lng,
        name: 'Current Location',
        isReal: true
      };
      
      // Update user marker on map
      if (this.userMarker) {
        this.userMarker.setLatLng([snappedLocation.lat, snappedLocation.lng]);
      } else {
        // Create marker if it doesn't exist
        this.userMarker = L.marker([snappedLocation.lat, snappedLocation.lng], {
          icon: L.divIcon({
            html: `<div style="
              background: #1976d2;
              color: white;
              border-radius: 50%;
              width: 20px;
              height: 20px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 12px;
              border: 2px solid white;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            ">📍</div>`,
            className: 'user-location-marker',
            iconSize: [20, 20],
            iconAnchor: [10, 10]
          })
        }).addTo(this.map);
      }
      
      console.log('📍 Location updated via tracking:', this.userLocation);
      
      // Check proximity to tourist spots and record visits
      try {
        const currentUser = await this.afAuth.currentUser;
        if (currentUser) {
          await this.badgeService.checkProximityAndRecordVisit(currentUser.uid, this.userLocation);
        }
      } catch (error) {
        console.error('❌ Error checking proximity for badges:', error);
      }
    } catch (error) {
      console.error('❌ Error updating location from tracking:', error);
    }
  }

  // Toggle location tracking on/off
  async toggleLocationTracking(): Promise<void> {
    if (this.isLocationTracking) {
      await this.stopLocationTracking();
    } else {
      await this.startLocationTracking();
    }
  }

  async showUserLocation() {
    try {
      const position = await Geolocation.getCurrentPosition();
      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      
      // Snap location to nearest road using OSRM
      const snappedLocation = await this.snapLocationToRoad(lat, lng);
      
      if (this.userMarker) {
        this.map.removeLayer(this.userMarker);
      }
      
      // Add new user marker with snapped location
      this.userMarker = L.marker([snappedLocation.lat, snappedLocation.lng], {
        icon: L.divIcon({
          html: `<div style="
            background: #1976d2;
            color: white;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 12px;
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          ">📍</div>`,
          className: 'user-location-marker',
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        })
      }).addTo(this.map);
      
      // Center map on snapped user location
      this.map.setView([snappedLocation.lat, snappedLocation.lng], 15);
      
      // Update user location with real GPS coordinates
      this.userLocation = {
        lat: snappedLocation.lat,
        lng: snappedLocation.lng,
        name: 'Current Location',
        isReal: true
      };
      
      this.showToast('Location updated and snapped to nearest road!');
      
      // Check proximity to tourist spots and record visits
      try {
        const currentUser = await this.afAuth.currentUser;
        if (currentUser) {
          await this.badgeService.checkProximityAndRecordVisit(currentUser.uid, this.userLocation);
        }
      } catch (error) {
        console.error('❌ Error checking proximity for badges:', error);
      }
      
      return { lat: snappedLocation.lat, lng: snappedLocation.lng };
    } catch (error) {
      console.error('Error getting location:', error);
      this.showToast('Could not get your location. Please check your GPS settings.');
      return this.userLocation;
    }
  }

  private async snapLocationToRoad(lat: number, lng: number): Promise<{lat: number, lng: number}> {
    try {
      // Use OSRM to snap location to nearest road
      const response = await this.http.get(`http://localhost:3000/osrm/nearest/${lng},${lat}`).toPromise() as any;
      
      if (response && response.waypoints && response.waypoints[0] && response.waypoints[0].location) {
        const [snappedLng, snappedLat] = response.waypoints[0].location;
        return { lat: snappedLat, lng: snappedLng };
      }
    } catch (error) {
      console.warn('Could not snap location to road, using original coordinates:', error);
    }
    
    // Fallback to original coordinates if snapping fails
    return { lat, lng };
  }

  async navigateNextItineraryStep() {
    this.navigating = true;
    this.navigationInstructions = [];

    // Check if itinerary exists
    if (!this.itinerary || this.itinerary.length === 0) {
      this.navigationInstructions = ['No itinerary found. Please create an itinerary first.'];
      this.navigating = false;
      return;
    }

    // Show day/spot picker modal
    const modal = await this.modalCtrl.create({
      component: DaySpotPickerComponent,
      componentProps: {
        itinerary: this.itinerary
      },
      breakpoints: [0, 0.5, 0.8],
      initialBreakpoint: 0.5
    });

    await modal.present();

    const result = await modal.onWillDismiss();
    if (result.data) {
      const { dayIndex, spotIndex } = result.data;
      await this.navigateToDaySpot(dayIndex, spotIndex);
    } else {
      this.navigating = false;
    }
  }

  async navigateToDaySpot(dayIndex: number, spotIndex: number = 0) {
    if (!this.itinerary || dayIndex >= this.itinerary.length) {
      this.navigationInstructions = ['Invalid day selection.'];
      this.navigating = false;
      return;
    }

    const day = this.itinerary[dayIndex];
    if (!day.spots || spotIndex >= day.spots.length) {
      this.navigationInstructions = ['No spots available for this day.'];
      this.navigating = false;
      return;
    }

    const targetSpot = day.spots[spotIndex];

    // 1. Get user location
    const userLoc = await this.showUserLocation();

    // 2. Find all curated jeepney routes that end at this spot
    const routesSnap = await this.firestore.collection('jeepney_routes', ref =>
      ref.where('points', 'array-contains', { lat: targetSpot.location.lat, lng: targetSpot.location.lng })
    ).get().toPromise();

    // Fix TypeScript errors with proper null checking
    if (!routesSnap || routesSnap.empty) {
      this.navigationInstructions = ['No curated jeepney route found to this spot.'];
      this.navigating = false;
      return;
    }

    let bestRoute: any = null;
    let bestStart: any = null;
    let minDist = Infinity;

    // 3. For each route, find the start point closest to user
    for (const doc of routesSnap.docs) {
      const route = doc.data() as any; // Type assertion to fix 'unknown' type
      if (!route.points || route.points.length < 2) continue;
      const start = route.points[0];
      const dist = this.getDistance(userLoc, start);
      if (dist < minDist) {
        minDist = dist;
        bestRoute = route;
        bestStart = start;
      }
    }

    if (!bestRoute) {
      this.navigationInstructions = ['No suitable jeepney route found to this spot.'];
      this.navigating = false;
      return;
    }

    // 4. Show walking route to start
    if (this.walkLine) this.map.removeLayer(this.walkLine);
    if (this.stopMarker) this.map.removeLayer(this.stopMarker);

    this.stopMarker = L.marker([bestStart.lat, bestStart.lng], {
      icon: L.icon({
        iconUrl: 'assets/leaflet/marker-icon.png',
        shadowUrl: 'assets/leaflet/marker-shadow.png',
        iconSize: [25, 41],
        shadowSize: [41, 41],
        iconAnchor: [12, 41],
        shadowAnchor: [12, 41],
        popupAnchor: [1, -34],
        className: 'jeepney-stop-marker'
      })
    }).addTo(this.map);

    this.walkLine = L.polyline([
      [userLoc.lat, userLoc.lng],
      [bestStart.lat, bestStart.lng]
    ], { color: 'green', weight: 4, dashArray: '5, 10' }).addTo(this.map);

    // 5. Show jeepney route
    if (this.jeepneyLine) this.map.removeLayer(this.jeepneyLine);
    this.jeepneyLine = L.polyline(
      bestRoute.points.map((p: any) => [p.lat, p.lng]),
      { color: 'orange', weight: 5 }
    ).addTo(this.map);

    // 6. Show instructions with day and spot info
    this.navigationInstructions = [
      `<b>Day ${day.day} - ${targetSpot.name}</b>`,
      `Time: ${targetSpot.timeSlot}`,
      `Walk to jeepney stop at (${bestStart.lat.toFixed(5)}, ${bestStart.lng.toFixed(5)})`,
      `Take jeepney code <b>${bestRoute.code}</b>`,
      `Get off at your destination: ${targetSpot.name}`,
      `Estimated duration: ${targetSpot.estimatedDuration}`
    ];

    // 7. Fit map to show the entire route
    this.map.fitBounds([
      [userLoc.lat, userLoc.lng],
      [bestStart.lat, bestStart.lng],
      ...bestRoute.points.map((p: any) => [p.lat, p.lng])
    ], { padding: [50, 50] });

    this.navigating = false;
  }

  // Helper method to get current day based on itinerary start date
  getCurrentDayIndex(): number {
    // For now, return 0 (first day) - this can be enhanced later
    // to calculate based on actual start date vs current date
    return 0;
  }

  // Helper method to get next unvisited spot for a given day
  getNextUnvisitedSpot(dayIndex: number): number {
    const day = this.itinerary[dayIndex];
    if (!day || !day.spots) return 0;

    // For now, return the first spot - this can be enhanced later
    // to track visited spots and return the next unvisited one
    return 0;
  }

  getDistance(a: { lat: number, lng: number }, b: { lat: number, lng: number }) {
    // Haversine formula
    const R = 6371e3;
    const toRad = (x: number) => x * Math.PI / 180;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const aVal = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1) * Math.cos(lat2) *
      Math.sin(dLng / 2) * Math.sin(dLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(aVal), Math.sqrt(1 - aVal));
    return R * c;
  }

  // Polyline decoder (Google encoded polyline algorithm)
  decodePolyline(encoded: string): L.LatLng[] {
    let points: L.LatLng[] = [];
    let index = 0, len = encoded.length;
    let lat = 0, lng = 0;
    while (index < len) {
      let b, shift = 0, result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      let dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += dlat;
      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      let dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lng += dlng;
      points.push(L.latLng(lat / 1e5, lng / 1e5));
    }
    return points;
  }

  private getJeepneyCodeForSpot(spot: any, order: number): string {
    // Find the best jeepney route for this spot
          const bestRoute = this.findBestJeepneyRoute(this.userLocation, spot);
    
    if (!bestRoute) {
      return '🚶‍♂️ Walk';
    }

    // Handle new multi-ride format
    if (bestRoute.segments) {
      const jeepneySegments = bestRoute.segments.filter((seg: any) => seg.type === 'jeepney');
      if (jeepneySegments.length === 1) {
        return `🚌 ${jeepneySegments[0].jeepneyCode}`;
      } else if (jeepneySegments.length > 1) {
        const codes = jeepneySegments.map((seg: any) => seg.jeepneyCode).join(' → ');
        return `🚌 ${codes}`;
      }
    }

    // Fallback for old format
    if (bestRoute.code) {
      return `🚌 ${bestRoute.code}`;
    }

    return '🚶‍♂️ Walk';
  }

  private findBestJeepneyRoute(from: any, to: any): any {
    if (!this.jeepneyRoutes || this.jeepneyRoutes.length === 0) {
      return null;
    }

    // First try the new waypoint-based approach
    const waypointRoute = this.findJeepneyRouteWithWaypoints(from, to);
    if (waypointRoute) {
      return waypointRoute;
    }

    // Fallback to old stop-based approach for routes with actual stops
    const fromStop = this.getNearestJeepneyStop(from);
    const toStop = this.getNearestJeepneyStop(to);
    
    // If either stop is too far (>500m), suggest walking first
    if (fromStop.distance > 500 || toStop.distance > 500) {
      const walkThenJeepney = this.createWalkThenJeepneyRoute(from, to, fromStop, toStop);
      if (walkThenJeepney) {
        return walkThenJeepney;
      }
    }
    
    // Try direct route between stops
    const directRoute = this.findRouteBetweenStops(fromStop.stop, toStop.stop);
    if (directRoute) {
      return directRoute;
    }
    
    // Try single ride option
    const singleRide = this.findSingleRideRoute(from, to);
    
    // Try multi-ride option (up to 2 transfers)
    const multiRide = this.findMultiRideRoute(from, to);
    
    // Compare and return the better option
    if (!singleRide && !multiRide) {
      return null;
    }
    
    if (!singleRide) {
      return multiRide;
    }
    
    if (!multiRide) {
      return singleRide;
    }
    
    // Compare total scores (lower is better)
    const singleScore = singleRide.totalScore;
    const multiScore = multiRide.totalScore;
    
    const bestRoute = singleScore <= multiScore ? singleRide : multiRide;
    return bestRoute;
  }

  private findSingleRideRoute(from: any, to: any): any {
    let bestRoute = null;
    let bestScore = Infinity;

    for (const route of this.jeepneyRoutes) {
      if (!route.stops || !Array.isArray(route.stops) || route.stops.length === 0) {
        continue;
      }

      // Find nearest stops for origin and destination
      const fromStop = this.findNearestStop(from, route.stops);
      const toStop = this.findNearestStop(to, route.stops);

      if (fromStop && toStop) {
        // Calculate route score (lower is better)
        const distance = this.getRouteDistance(route, fromStop, toStop);
        const walkDistance = this.getDistance(from, fromStop) + this.getDistance(to, toStop);
        const totalScore = distance + walkDistance * 1.5; // Reduced walking penalty

        // More aggressive threshold - accept routes up to 3km total
        if (totalScore < bestScore && totalScore < 3000) {
          bestScore = totalScore;
          bestRoute = {
            type: 'single',
            route,
            fromStop,
            toStop,
            walkDistance,
            jeepneyDistance: distance,
            totalScore,
            segments: [{
              type: 'walk',
              from: 'Your Location',
              to: fromStop.name,
              distance: this.getDistance(from, fromStop),
              estimatedTime: `${Math.round(this.getDistance(from, fromStop) / 80)} min walk`
            }, {
              type: 'jeepney',
              from: fromStop.name,
              to: toStop.name,
              jeepneyCode: route.code,
              routeName: route.name,
              distance: distance,
              estimatedTime: `${Math.round(distance / 200)} min jeepney`,
              description: `Take jeepney ${route.code} (${route.name})`
            }, {
              type: 'walk',
              from: toStop.name,
              to: 'Destination',
              distance: this.getDistance(to, toStop),
              estimatedTime: `${Math.round(this.getDistance(to, toStop) / 80)} min walk`
            }]
          };
        }
      }
    }

    return bestRoute;
  }

  private findMultiRideRoute(from: any, to: any): any {
    let bestRoute = null;
    let bestScore = Infinity;

    // Try all combinations of 2 routes (1 transfer)
    for (const route1 of this.jeepneyRoutes) {
      if (!route1.stops || !Array.isArray(route1.stops) || route1.stops.length === 0) {
        continue;
      }

      for (const route2 of this.jeepneyRoutes) {
        if (route1 === route2 || !route2.stops || !Array.isArray(route2.stops) || route2.stops.length === 0) {
          continue;
        }

        // Find transfer point (common stops or nearby stops)
        const transferPoint = this.findTransferPoint(route1, route2);
        if (!transferPoint) {
          continue;
        }

        // Calculate segments
        const fromStop1 = this.findNearestStop(from, route1.stops);
        const toStop1 = transferPoint.route1Stop;
        const fromStop2 = transferPoint.route2Stop;
        const toStop2 = this.findNearestStop(to, route2.stops);

        if (fromStop1 && toStop1 && fromStop2 && toStop2) {
          const walkToFirst = this.getDistance(from, fromStop1);
          const jeepney1Distance = this.getRouteDistance(route1, fromStop1, toStop1);
          const transferWalk = this.getDistance(toStop1, fromStop2);
          const jeepney2Distance = this.getRouteDistance(route2, fromStop2, toStop2);
          const walkToDest = this.getDistance(toStop2, to);

          const totalScore = walkToFirst * 2 + jeepney1Distance + transferWalk * 2 + jeepney2Distance + walkToDest * 2;

          if (totalScore < bestScore) {
            bestScore = totalScore;
            bestRoute = {
              type: 'multi',
              totalScore,
              segments: [{
                type: 'walk',
                from: 'Your Location',
                to: fromStop1.name,
                distance: walkToFirst,
                estimatedTime: `${Math.round(walkToFirst / 80)} min walk`
              }, {
                type: 'jeepney',
                from: fromStop1.name,
                to: toStop1.name,
                jeepneyCode: route1.code,
                routeName: route1.name,
                distance: jeepney1Distance,
                estimatedTime: `${Math.round(jeepney1Distance / 200)} min jeepney`,
                description: `Take jeepney ${route1.code} (${route1.name})`
              }, {
                type: 'transfer',
                from: toStop1.name,
                to: fromStop2.name,
                distance: transferWalk,
                estimatedTime: `${Math.round(transferWalk / 80)} min walk`,
                description: `Transfer: Walk to ${fromStop2.name}`
              }, {
                type: 'jeepney',
                from: fromStop2.name,
                to: toStop2.name,
                jeepneyCode: route2.code,
                routeName: route2.name,
                distance: jeepney2Distance,
                estimatedTime: `${Math.round(jeepney2Distance / 200)} min jeepney`,
                description: `Take jeepney ${route2.code} (${route2.name})`
              }, {
                type: 'walk',
                from: toStop2.name,
                to: 'Destination',
                distance: walkToDest,
                estimatedTime: `${Math.round(walkToDest / 80)} min walk`
              }]
            };
          }
        }
      }
    }

    return bestRoute;
  }

  private findTransferPoint(route1: any, route2: any): any {
    // Find common stops or nearby stops between two routes
    const commonStops = [];
    
    for (const stop1 of route1.stops) {
      for (const stop2 of route2.stops) {
        const distance = this.getDistance(stop1, stop2);
        if (distance < 500) { // Within 500m considered transferable
          commonStops.push({
            route1Stop: stop1,
            route2Stop: stop2,
            distance
          });
        }
      }
    }

    if (commonStops.length === 0) {
      return null;
    }

    // Return the closest transfer point
    return commonStops.reduce((closest, current) => 
      current.distance < closest.distance ? current : closest
    );
  }

  private findNearestStop(location: any, stops: any[]): any {
    // Check if stops array is valid
    if (!stops || !Array.isArray(stops) || stops.length === 0) {
      return null;
    }
    
    let nearestStop = null;
    let shortestDistance = Infinity;

    stops.forEach(stop => {
      if (stop && stop.lat && stop.lng) {
        const distance = this.getDistance(location, stop);
        if (distance < shortestDistance) {
          shortestDistance = distance;
          nearestStop = stop;
        }
      }
    });

    return nearestStop;
  }

  private getRouteDistance(route: any, fromStop: any, toStop: any): number {
    // Check if route and stops are valid
    if (!route || !route.stops || !Array.isArray(route.stops) || !fromStop || !toStop) {
      return Infinity;
    }
    
    const fromIndex = route.stops.findIndex((stop: any) => 
      stop && stop.name === fromStop.name
    );
    const toIndex = route.stops.findIndex((stop: any) => 
      stop && stop.name === toStop.name
    );

    if (fromIndex === -1 || toIndex === -1) return Infinity;

    let distance = 0;
    const start = Math.min(fromIndex, toIndex);
    const end = Math.max(fromIndex, toIndex);

    for (let i = start; i < end && i + 1 < route.stops.length; i++) {
      if (route.stops[i] && route.stops[i + 1]) {
        distance += this.getDistance(route.stops[i], route.stops[i + 1]);
      }
    }

    return distance;
  }

  private getNearestJeepneyStop(location: any): { stop: any, route: any, distance: number } {
    // Check if jeepney routes are loaded
    if (!this.jeepneyRoutes || this.jeepneyRoutes.length === 0) {
      return { stop: null, route: null, distance: Infinity };
    }
    
    let nearestStop = null;
    let nearestRoute = null;
    let shortestDistance = Infinity;

    this.jeepneyRoutes.forEach(route => {
      // Check if route has points (waypoints) or stops
      const routePoints = route.points || route.stops || [];
      
      routePoints.forEach((point: any) => {
        if (point && point.lat && point.lng) {
          const distance = this.getDistance(location, point);
          if (distance < shortestDistance) {
            shortestDistance = distance;
            nearestStop = point;
            nearestRoute = route;
          }
        }
      });
    });

    return { stop: nearestStop, route: nearestRoute, distance: shortestDistance };
  }

  // New helper method for Cebu-specific routes
  private findRouteBetweenStops(fromStop: any, toStop: any): any {
    if (!fromStop || !toStop) {
      return null;
    }

    // Check if both stops are on the same route
    const sameRoute = this.jeepneyRoutes.find(route => 
      route.stops && route.stops.some((s: any) => s.name === fromStop.name) &&
      route.stops.some((s: any) => s.name === toStop.name)
    );
    
    if (sameRoute) {
      const distance = this.getRouteDistance(sameRoute, fromStop, toStop);
      return {
        type: 'direct',
        route: sameRoute,
        fromStop,
        toStop,
        distance: distance,
        totalScore: distance,
        segments: [{
          type: 'jeepney',
          from: fromStop.name,
          to: toStop.name,
          jeepneyCode: sameRoute.code,
          routeName: sameRoute.name,
          distance: distance,
          estimatedTime: `${Math.round(distance / 200)} min jeepney`,
          description: `Take jeepney ${sameRoute.code} (${sameRoute.name}) from ${fromStop.name} to ${toStop.name}`
        }]
      };
    }
    
    // Otherwise find transfer route
    return this.findTransferRoute(fromStop, toStop);
  }

  // New method to find jeepney route using waypoints
  private findMultipleJeepneyRoutesWithWaypoints(from: any, to: any): any[] {
    if (!this.jeepneyRoutes || this.jeepneyRoutes.length === 0) {
      return [];
    }

    const foundRoutes: any[] = [];

    this.jeepneyRoutes.forEach(route => {
      const routePoints = route.points || route.stops || [];
      if (routePoints.length === 0) return;

      // Check if route passes near both origin and destination
      let fromDistance = Infinity;
      let toDistance = Infinity;
      let fromPoint = null;
      let toPoint = null;
      let fromSegmentIndex = -1;
      let toSegmentIndex = -1;

      // Find nearest points to origin and destination (including interpolated points between waypoints)
      
      // Check each waypoint and interpolate between them
      for (let i = 0; i < routePoints.length; i++) {
        const point = routePoints[i];
        if (!point || !point.lat || !point.lng) continue;
        
        // Check the waypoint itself
        const fromDist = this.getDistance(from, point);
        const toDist = this.getDistance(to, point);
        
        if (fromDist < fromDistance) {
          fromDistance = fromDist;
          fromPoint = point;
          fromSegmentIndex = i;
        }
        if (toDist < toDistance) {
          toDistance = toDist;
          toPoint = point;
          toSegmentIndex = i;
        }
        
        // Check interpolated points between this waypoint and the next one
        if (i < routePoints.length - 1) {
          const nextPoint = routePoints[i + 1];
          if (nextPoint && nextPoint.lat && nextPoint.lng) {
            // Interpolate 5 points between waypoints
            for (let j = 1; j <= 5; j++) {
              const t = j / 6; // Interpolation factor (0 to 1)
              const interpolatedLat = point.lat + (nextPoint.lat - point.lat) * t;
              const interpolatedLng = point.lng + (nextPoint.lng - point.lng) * t;
              
              const interpolatedPoint = { lat: interpolatedLat, lng: interpolatedLng };
              const fromDistInterp = this.getDistance(from, interpolatedPoint);
              const toDistInterp = this.getDistance(to, interpolatedPoint);
              
              if (fromDistInterp < fromDistance) {
                fromDistance = fromDistInterp;
                fromPoint = interpolatedPoint;
                fromSegmentIndex = i;
              }
              if (toDistInterp < toDistance) {
                toDistance = toDistInterp;
                toPoint = interpolatedPoint;
                toSegmentIndex = i;
              }
            }
          }
        }
      }

      // If both points are within reasonable distance (1500m), consider this route
      if (fromDistance <= 1500 && toDistance <= 1500) {
        // Calculate route distance between the two points using proper waypoint order
        const routeDistance = this.getRouteDistanceFromPointsInOrder(route, fromPoint, toPoint, fromSegmentIndex, toSegmentIndex);
        const totalScore = fromDistance + toDistance + routeDistance;
        
        foundRoutes.push({
          type: 'waypoint_route',
          route: route,
          fromPoint: fromPoint,
          toPoint: toPoint,
          fromDistance: fromDistance,
          toDistance: toDistance,
          routeDistance: routeDistance,
          totalScore: totalScore,
          fromSegmentIndex: fromSegmentIndex,
          toSegmentIndex: toSegmentIndex,
          segments: [{
            type: 'jeepney',
            from: 'Your Location',
            to: 'Destination',
            jeepneyCode: route.code,
            routeName: route.name || `${route.code} Route`,
            distance: routeDistance,
            estimatedTime: `${Math.round(routeDistance / 200)} min jeepney`,
            description: `Take jeepney ${route.code} from near your location to near your destination`
          }]
        });
      }
    });

    // If no routes found with 1500m radius, try with larger radius for destination only
    if (foundRoutes.length === 0) {
      this.jeepneyRoutes.forEach(route => {
        const routePoints = route.points || route.stops || [];
        if (routePoints.length === 0) return;

        let fromDistance = Infinity;
        let toDistance = Infinity;
        let fromPoint = null;
        let toPoint = null;

        // Find nearest points to origin and destination
        routePoints.forEach((point: any) => {
          if (point && point.lat && point.lng) {
            const fromDist = this.getDistance(from, point);
            const toDist = this.getDistance(to, point);
            
            if (fromDist < fromDistance) {
              fromDistance = fromDist;
              fromPoint = point;
            }
            if (toDist < toDistance) {
              toDistance = toDist;
              toPoint = point;
            }
          }
        });

        // Allow larger radius for destination (2500m) but keep origin at 1500m
        if (fromDistance <= 1500 && toDistance <= 2500) {
          console.log(`  🔄 Extended search: Route ${route.code} - from=${Math.round(fromDistance)}m, to=${Math.round(toDistance)}m`);
          
          const routeDistance = this.getRouteDistanceFromPointsInOrder(route, fromPoint, toPoint);
          const totalScore = fromDistance + toDistance + routeDistance;
          
          foundRoutes.push({
            type: 'waypoint_route',
            route: route,
            fromPoint: fromPoint,
            toPoint: toPoint,
            fromDistance: fromDistance,
            toDistance: toDistance,
            routeDistance: routeDistance,
            totalScore: totalScore,
            segments: [{
              type: 'jeepney',
              from: 'Your Location',
              to: 'Destination',
              jeepneyCode: route.code,
              routeName: route.name || `${route.code} Route`,
              distance: routeDistance,
              estimatedTime: `${Math.round(routeDistance / 200)} min jeepney`,
              description: `Take jeepney ${route.code} from near your location to near your destination`
            }]
          });
        }
      });
    }

    // Sort routes by total score (lower is better) and return top 3
    foundRoutes.sort((a, b) => a.totalScore - b.totalScore);
    return foundRoutes.slice(0, 3);
  }

  private findJeepneyRouteWithWaypoints(from: any, to: any): any {
    const routes = this.findMultipleJeepneyRoutesWithWaypoints(from, to);
    return routes.length > 0 ? routes[0] : null;
  }

  private getRouteDistanceFromPoints(route: any, fromPoint: any, toPoint: any): number {
    return this.getRouteDistanceFromPointsInOrder(route, fromPoint, toPoint);
  }

  private getRouteDistanceFromPointsInOrder(route: any, fromPoint: any, toPoint: any, fromSegmentIndex?: number, toSegmentIndex?: number): number {
    const routePoints = route.points || route.stops || [];
    if (routePoints.length < 2) return 0;

    let fromIndex = -1;
    let toIndex = -1;

    // If segment indices are provided, use them (for interpolated points)
    if (fromSegmentIndex !== undefined && toSegmentIndex !== undefined) {
      fromIndex = fromSegmentIndex;
      toIndex = toSegmentIndex;
    } else {
      // Find indices of the two points with tolerance for floating point precision
      fromIndex = routePoints.findIndex((point: any) => 
        point && Math.abs(point.lat - fromPoint.lat) < 0.0001 && Math.abs(point.lng - fromPoint.lng) < 0.0001
      );
      toIndex = routePoints.findIndex((point: any) => 
        point && Math.abs(point.lat - toPoint.lat) < 0.0001 && Math.abs(point.lng - toPoint.lng) < 0.0001
      );
    }

    if (fromIndex === -1 || toIndex === -1) {
      console.log('❌ Could not find waypoint indices');
      return 0;
    }

    console.log(`📍 Route ${route.code}: fromIndex=${fromIndex}, toIndex=${toIndex}`);

    // Calculate distance along the route following the proper order
    let totalDistance = 0;
    
    // Always go from lower index to higher index to follow waypoint order
    const startIndex = Math.min(fromIndex, toIndex);
    const endIndex = Math.max(fromIndex, toIndex);

    for (let i = startIndex; i < endIndex && i + 1 < routePoints.length; i++) {
      if (routePoints[i] && routePoints[i + 1]) {
        const segmentDistance = this.getDistance(routePoints[i], routePoints[i + 1]);
        totalDistance += segmentDistance;
      }
    }

    console.log(`📏 Route ${route.code} distance (ordered): ${Math.round(totalDistance)}m`);
    return totalDistance;
  }

  private async drawJeepneyRouteWithWaypoints(from: any, to: any, jeepneyRoute: any): Promise<void> {

    
    const route = jeepneyRoute.route;
    const routePoints = route.points || route.stops || [];
    

    
    if (routePoints.length < 2) {

      // Fallback to straight line if no waypoints
      this.drawStraightJeepneyRoute(from, to, jeepneyRoute);
      return;
    }

    // Find the relevant waypoint segment for this route
    const fromPoint = jeepneyRoute.fromPoint;
    const toPoint = jeepneyRoute.toPoint;
    

    
    if (!fromPoint || !toPoint) {

      this.drawStraightJeepneyRoute(from, to, jeepneyRoute);
      return;
    }

    // Use segment indices from the route finding process (for interpolated points)
    const fromIndex = jeepneyRoute.fromSegmentIndex;
    const toIndex = jeepneyRoute.toSegmentIndex;

    if (fromIndex === -1 || toIndex === -1) {
      this.drawStraightJeepneyRoute(from, to, jeepneyRoute);
      return;
    }

    // Create the route path following only the relevant waypoint segment
    const routePath: L.LatLng[] = [];
    
    // Add walking segment from origin to nearest point (waypoint or interpolated)
    routePath.push(L.latLng(from.lat, from.lng));
    
    // Add the nearest point (could be waypoint or interpolated point)
    routePath.push(L.latLng(fromPoint.lat, fromPoint.lng));
    
    // Add only the waypoints between fromIndex and toIndex (relevant segment)
    // IMPORTANT: Always draw from origin to destination, not just min to max index
    const fromIndexActual = jeepneyRoute.fromSegmentIndex;
    const toIndexActual = jeepneyRoute.toSegmentIndex;
    
    // Determine the correct direction based on which point is closer to origin vs destination
    const fromPointToOrigin = this.getDistance(from, routePoints[fromIndexActual]);
    const toPointToOrigin = this.getDistance(from, routePoints[toIndexActual]);
    const fromPointToDest = this.getDistance(to, routePoints[fromIndexActual]);
    const toPointToDest = this.getDistance(to, routePoints[toIndexActual]);
    
    // Determine start and end indices for proper route direction
    let start, end;
    if (fromPointToOrigin < toPointToOrigin && fromPointToDest > toPointToDest) {
      // fromIndex is closer to origin, toIndex is closer to destination
      start = fromIndexActual;
      end = toIndexActual;
    } else if (toPointToOrigin < fromPointToOrigin && toPointToDest > fromPointToDest) {
      // toIndex is closer to origin, fromIndex is closer to destination
      start = toIndexActual;
      end = fromIndexActual;
    } else {
      // Fallback to original logic if direction is unclear
      start = Math.min(fromIndexActual, toIndexActual);
      end = Math.max(fromIndexActual, toIndexActual);
    }
    
    // Draw ALL waypoints between start and end (inclusive)
    if (start <= end) {
      // Forward direction: start to end
      for (let i = start; i <= end && i < routePoints.length; i++) {
        if (routePoints[i] && routePoints[i].lat && routePoints[i].lng) {
          routePath.push(L.latLng(routePoints[i].lat, routePoints[i].lng));
        }
      }
    } else {
      // Backward direction: end to start (reverse order)
      for (let i = end; i <= start && i < routePoints.length; i++) {
        if (routePoints[i] && routePoints[i].lat && routePoints[i].lng) {
          routePath.push(L.latLng(routePoints[i].lat, routePoints[i].lng));
        }
      }
    }
    
    // Add the nearest point to destination (could be waypoint or interpolated point)
    routePath.push(L.latLng(toPoint.lat, toPoint.lng));
    
    // Add walking segment from nearest point to destination
    routePath.push(L.latLng(to.lat, to.lng));
    


    // Draw the complete route path
    const jeepneyColor = jeepneyRoute.route.color || '#1976d2';
    
    // Draw walking segments (dashed grey lines)
    if (routePath.length >= 3) {
      // Walking from origin to first waypoint
      const walkToStart = L.polyline([routePath[0], routePath[1]], {
        color: '#28a745',
        weight: 3,
        opacity: 0.8,
        dashArray: '10, 5'
      }).addTo(this.map);
      this.apiRouteLines.push(walkToStart);

      // Add label to walking segment
      const walkToMidPoint = L.latLng(
        (routePath[0].lat + routePath[1].lat) / 2,
        (routePath[0].lng + routePath[1].lng) / 2
      );
      
      const walkToLabel = L.divIcon({
        html: `<div style="
          background: #28a745;
          color: white;
          border-radius: 4px;
          padding: 2px 6px;
          font-size: 10px;
          font-weight: bold;
          border: 1px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          white-space: nowrap;
          text-align: center;
        ">🚶 Walk to Jeepney</div>`,
        className: 'route-label',
        iconSize: [100, 20],
        iconAnchor: [50, 10]
      });
      
      const walkToLabelMarker = L.marker(walkToMidPoint, {
        icon: walkToLabel
      }).addTo(this.map);
      
      this.apiRouteLines.push(walkToLabelMarker);

      // Walking from last waypoint to destination
      const walkToEnd = L.polyline([routePath[routePath.length - 2], routePath[routePath.length - 1]], {
        color: '#28a745',
        weight: 3,
        opacity: 0.8,
        dashArray: '10, 5'
      }).addTo(this.map);
      this.apiRouteLines.push(walkToEnd);
      
      // Add label to walking segment
      const walkFromMidPoint = L.latLng(
        (routePath[routePath.length - 2].lat + routePath[routePath.length - 1].lat) / 2,
        (routePath[routePath.length - 2].lng + routePath[routePath.length - 1].lng) / 2
      );
      
      const walkFromLabel = L.divIcon({
        html: `<div style="
          background: #28a745;
          color: white;
          border-radius: 4px;
          padding: 2px 6px;
          font-size: 10px;
          font-weight: bold;
          border: 1px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          white-space: nowrap;
          text-align: center;
        ">🚶 Walk to Destination</div>`,
        className: 'route-label',
        iconSize: [120, 20],
        iconAnchor: [60, 10]
      });
      
      const walkFromLabelMarker = L.marker(walkFromMidPoint, {
        icon: walkFromLabel
      }).addTo(this.map);
      
      this.apiRouteLines.push(walkFromLabelMarker);
      
      // Walking markers removed - no longer showing circle pins for walking segments

    }

    // Draw jeepney segment (solid blue line following waypoints)
    if (routePath.length >= 3) {
      const jeepneySegment = routePath.slice(1, routePath.length - 1);

      
      if (jeepneySegment.length >= 2) {
        
        
        // Check distances between consecutive points to see if they form a proper route
        
        
        // Add intermediate points for smoother routes if distances are too large
        const smoothedSegment: L.LatLng[] = [];
        for (let i = 0; i < jeepneySegment.length; i++) {
          smoothedSegment.push(jeepneySegment[i]);
          
          // Add intermediate points if distance to next point is > 500m
          if (i < jeepneySegment.length - 1) {
            const distance = this.getDistance(jeepneySegment[i], jeepneySegment[i + 1]);
            if (distance > 500) {
              const numIntermediates = Math.ceil(distance / 500) - 1;
              
              for (let j = 1; j <= numIntermediates; j++) {
                const ratio = j / (numIntermediates + 1);
                const lat = jeepneySegment[i].lat + (jeepneySegment[i + 1].lat - jeepneySegment[i].lat) * ratio;
                const lng = jeepneySegment[i].lng + (jeepneySegment[i + 1].lng - jeepneySegment[i].lng) * ratio;
                smoothedSegment.push(L.latLng(lat, lng));
              }
            }
          }
        }
        
        const jeepneyLine = L.polyline(smoothedSegment, {
          color: jeepneyColor,
          weight: 6,
          opacity: 0.8,
          dashArray: '0'
        }).addTo(this.map);
        this.apiRouteLines.push(jeepneyLine);
        
        // Add label to jeepney segment
        if (smoothedSegment.length > 0) {
          const jeepneyMidPoint = smoothedSegment[Math.floor(smoothedSegment.length / 2)];
          
          const jeepneyLabel = L.divIcon({
            html: `<div style="
              background: ${jeepneyColor};
              color: white;
              border-radius: 4px;
              padding: 2px 6px;
              font-size: 10px;
              font-weight: bold;
              border: 1px solid white;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
              white-space: nowrap;
              text-align: center;
            ">🚌 ${jeepneyRoute.route.code}</div>`,
            className: 'route-label',
            iconSize: [80, 20],
            iconAnchor: [40, 10]
          });
          
          const jeepneyLabelMarker = L.marker(jeepneyMidPoint, {
            icon: jeepneyLabel
          }).addTo(this.map);
          
          this.apiRouteLines.push(jeepneyLabelMarker);
        }
      }
    }

    // Add jeepney code markers along the route
    if (routePath.length >= 3) {
      const jeepneySegment = routePath.slice(1, routePath.length - 1);
      const midIndex = Math.floor(jeepneySegment.length / 2);
      if (jeepneySegment[midIndex]) {
        const jeepneyMarker = L.marker(jeepneySegment[midIndex], {
          icon: L.divIcon({
            html: `<div style="
              background: ${jeepneyColor};
              color: white;
              border-radius: 50%;
              width: 28px;
              height: 28px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 12px;
              font-weight: bold;
              border: 2px solid white;
              box-shadow: 0 3px 6px rgba(0,0,0,0.4);
            ">${jeepneyRoute.route.code}</div>`,
            className: 'jeepney-code-marker',
            iconSize: [28, 28],
            iconAnchor: [14, 14]
          })
        }).addTo(this.map);
        this.apiRouteLines.push(jeepneyMarker);
      }
    }
  }

  private drawStraightJeepneyRoute(from: any, to: any, jeepneyRoute: any): void {
    // Fallback method for straight line when waypoints aren't available
    const jeepneyColor = jeepneyRoute.route.color || '#1976d2';
    const jeepneyLine = L.polyline([from, to], {
      color: jeepneyColor,
      weight: 6,
      opacity: 0.8,
      dashArray: '0'
    }).addTo(this.map);
    
    const midPoint = L.latLng(
      (from.lat + to.lat) / 2,
      (from.lng + to.lng) / 2
    );
    
    const jeepneyMarker = L.marker(midPoint, {
      icon: L.divIcon({
        html: `<div style="
          background: ${jeepneyColor};
          color: white;
          border-radius: 50%;
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 12px;
          font-weight: bold;
          border: 2px solid white;
          box-shadow: 0 3px 6px rgba(0,0,0,0.4);
        ">${jeepneyRoute.route.code}</div>`,
        className: 'jeepney-code-marker',
        iconSize: [28, 28],
        iconAnchor: [14, 14]
      })
    }).addTo(this.map);
    
    // Add label to straight jeepney route
    const jeepneyLabel = L.divIcon({
      html: `<div style="
        background: ${jeepneyColor};
        color: white;
        border-radius: 4px;
        padding: 2px 6px;
        font-size: 10px;
        font-weight: bold;
        border: 1px solid white;
        box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        white-space: nowrap;
        text-align: center;
      ">🚌 ${jeepneyRoute.route.code}</div>`,
      className: 'route-label',
      iconSize: [80, 20],
      iconAnchor: [40, 10]
    });
    
    const jeepneyLabelMarker = L.marker(midPoint, {
      icon: jeepneyLabel
    }).addTo(this.map);
    
    this.apiRouteLines.push(jeepneyLine, jeepneyMarker, jeepneyLabelMarker);
  }

  private async drawAlternativeJeepneyRoute(from: any, to: any, jeepneyRoute: any, routeIndex: number): Promise<void> {
    const route = jeepneyRoute.route;
    const routePoints = route.points || route.stops || [];
    
    if (routePoints.length < 2) {
      this.drawStraightAlternativeJeepneyRoute(from, to, jeepneyRoute, routeIndex);
      return;
    }

    // Find the relevant waypoint segment for this route
    const fromPoint = jeepneyRoute.fromPoint;
    const toPoint = jeepneyRoute.toPoint;
    
    if (!fromPoint || !toPoint) {
      this.drawStraightAlternativeJeepneyRoute(from, to, jeepneyRoute, routeIndex);
      return;
    }

    // Use segment indices from the route finding process (for interpolated points)
    const fromIndex = jeepneyRoute.fromSegmentIndex;
    const toIndex = jeepneyRoute.toSegmentIndex;

    if (fromIndex === -1 || toIndex === -1) {
      this.drawStraightAlternativeJeepneyRoute(from, to, jeepneyRoute, routeIndex);
      return;
    }

    // Create the route path following only the relevant waypoint segment
    const routePath: L.LatLng[] = [];
    
    // Add walking segment from origin to nearest point (waypoint or interpolated)
    routePath.push(L.latLng(from.lat, from.lng));
    
    // Add the nearest point (could be waypoint or interpolated point)
    routePath.push(L.latLng(fromPoint.lat, fromPoint.lng));
    
    // Add only the waypoints between fromIndex and toIndex (relevant segment)
    const start = Math.min(fromIndex, toIndex);
    const end = Math.max(fromIndex, toIndex);
    for (let i = start; i <= end && i < routePoints.length; i++) {
      if (routePoints[i] && routePoints[i].lat && routePoints[i].lng) {
        routePath.push(L.latLng(routePoints[i].lat, routePoints[i].lng));
      }
    }
    
    // Add the nearest point to destination (could be waypoint or interpolated point)
    routePath.push(L.latLng(toPoint.lat, toPoint.lng));
    
    // Add walking segment from nearest point to destination
    routePath.push(L.latLng(to.lat, to.lng));

    // Draw the alternative route with different styling
    const alternativeColors = ['#ff6b35', '#f7931e', '#ffd23f']; // Orange, amber, yellow
    const routeColor = alternativeColors[routeIndex - 1] || '#ff6b35';
    
    // Draw walking segments (dashed grey lines)
    if (routePath.length >= 3) {
      // Walking from origin to first waypoint
      const walkToStart = L.polyline([routePath[0], routePath[1]], {
        color: '#9e9e9e',
        weight: 3,
        opacity: 0.5,
        dashArray: '5, 5'
      }).addTo(this.map);
      this.apiRouteLines.push(walkToStart);
      
      // Walking from last waypoint to destination
      const walkToEnd = L.polyline([routePath[routePath.length - 2], routePath[routePath.length - 1]], {
        color: '#9e9e9e',
        weight: 3,
        opacity: 0.5,
        dashArray: '5, 5'
      }).addTo(this.map);
      this.apiRouteLines.push(walkToEnd);
    }
    
    // Draw jeepney route (solid colored line)
    if (routePath.length >= 3) {
      const jeepneyPath = routePath.slice(1, -1); // Exclude walking segments
      if (jeepneyPath.length >= 2) {
        const jeepneyLine = L.polyline(jeepneyPath, {
          color: routeColor,
          weight: 4,
          opacity: 0.6,
          dashArray: '10, 5' // Dashed line for alternatives
        }).addTo(this.map);
        this.apiRouteLines.push(jeepneyLine);
      }
    }
    
    // Add jeepney code marker at midpoint of jeepney route
    if (routePath.length >= 3) {
      const jeepneyPath = routePath.slice(1, -1);
      if (jeepneyPath.length > 0) {
        const midIndex = Math.floor(jeepneyPath.length / 2);
        const midPoint = jeepneyPath[midIndex];
        
        const jeepneyMarker = L.marker([midPoint.lat, midPoint.lng], {
          icon: L.divIcon({
            html: `<div style="
              background: ${routeColor};
              color: white;
              border-radius: 4px;
              padding: 3px 6px;
              font-size: 10px;
              font-weight: bold;
              border: 2px solid white;
              box-shadow: 0 2px 4px rgba(0,0,0,0.3);
              white-space: nowrap;
              opacity: 0.8;
            ">${route.code}</div>`,
            className: 'alternative-jeepney-code-marker',
            iconSize: [40, 20],
            iconAnchor: [20, 10]
          })
        }).addTo(this.map);
        
        this.apiRouteLines.push(jeepneyMarker);
      }
    }
  }

  private drawStraightAlternativeJeepneyRoute(from: any, to: any, jeepneyRoute: any, routeIndex: number): void {
    // Fallback method for alternative routes without waypoints
    const alternativeColors = ['#ff6b35', '#f7931e', '#ffd23f']; // Orange, amber, yellow
    const routeColor = alternativeColors[routeIndex - 1] || '#ff6b35';
    
    // Draw straight line from origin to destination
    const jeepneyLine = L.polyline([from, to], {
      color: routeColor,
      weight: 4,
      opacity: 0.6,
      dashArray: '10, 5' // Dashed line for alternatives
            }).addTo(this.map);
        
        this.apiRouteLines.push(jeepneyLine);
    
    // Add jeepney code marker at midpoint
    const midLat = (from.lat + to.lat) / 2;
    const midLng = (from.lng + to.lng) / 2;
    
    const jeepneyMarker = L.marker([midLat, midLng], {
      icon: L.divIcon({
        html: `<div style="
          background: ${routeColor};
          color: white;
          border-radius: 4px;
          padding: 3px 6px;
          font-size: 10px;
          font-weight: bold;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          white-space: nowrap;
          opacity: 0.8;
        ">${jeepneyRoute.route.code}</div>`,
        className: 'alternative-jeepney-code-marker',
        iconSize: [40, 20],
        iconAnchor: [20, 10]
      })
    }).addTo(this.map);
    
    this.apiRouteLines.push(jeepneyMarker);
  }

  private findTransferRoute(fromStop: any, toStop: any): any {
    let bestTransfer = null;
    let bestScore = Infinity;

    // Try all combinations of 2 routes (1 transfer)
    for (const route1 of this.jeepneyRoutes) {
      if (!route1.stops || !Array.isArray(route1.stops)) continue;
      
      for (const route2 of this.jeepneyRoutes) {
        if (!route2.stops || !Array.isArray(route2.stops) || route1.code === route2.code) continue;
        
        // Find transfer point between routes
        const transferPoint = this.findTransferPoint(route1, route2);
        if (!transferPoint) continue;

        // Check if fromStop is on route1 and toStop is on route2
        const fromStopOnRoute1 = route1.stops.some((s: any) => s.name === fromStop.name);
        const toStopOnRoute2 = route2.stops.some((s: any) => s.name === toStop.name);
        
        if (fromStopOnRoute1 && toStopOnRoute2) {
          const distance1 = this.getRouteDistance(route1, fromStop, transferPoint);
          const distance2 = this.getRouteDistance(route2, transferPoint, toStop);
          const totalDistance = distance1 + distance2;
          const transferPenalty = 200; // Penalty for transfer
          const totalScore = totalDistance + transferPenalty;

          if (totalScore < bestScore) {
            bestScore = totalScore;
            bestTransfer = {
              type: 'transfer',
              route1,
              route2,
              fromStop,
              toStop,
              transferPoint,
              distance1,
              distance2,
              totalDistance,
              totalScore,
              segments: [{
                type: 'jeepney',
                from: fromStop.name,
                to: transferPoint.name,
                jeepneyCode: route1.code,
                routeName: route1.name,
                distance: distance1,
                estimatedTime: `${Math.round(distance1 / 200)} min jeepney`,
                description: `Take jeepney ${route1.code} (${route1.name}) from ${fromStop.name} to ${transferPoint.name}`
              }, {
                type: 'transfer',
                from: transferPoint.name,
                to: transferPoint.name,
                description: `Transfer to jeepney ${route2.code} at ${transferPoint.name}`,
                estimatedTime: '5 min transfer'
              }, {
                type: 'jeepney',
                from: transferPoint.name,
                to: toStop.name,
                jeepneyCode: route2.code,
                routeName: route2.name,
                distance: distance2,
                estimatedTime: `${Math.round(distance2 / 200)} min jeepney`,
                description: `Take jeepney ${route2.code} (${route2.name}) from ${transferPoint.name} to ${toStop.name}`
              }]
            };
          }
        }
      }
    }

    return bestTransfer;
  }

  private createWalkThenJeepneyRoute(from: any, to: any, fromStop: any, toStop: any): any {
    // Find route between the two jeepney stops
    const jeepneyRoute = this.findRouteBetweenStops(fromStop.stop, toStop.stop);
    if (!jeepneyRoute) {
      return null;
    }

    const walkToStop = fromStop.distance;
    const walkFromStop = toStop.distance;
    const totalWalkDistance = walkToStop + walkFromStop;
    const totalScore = totalWalkDistance * 1.5 + jeepneyRoute.totalScore;

    return {
      type: 'walk_then_jeepney',
      walkDistance: totalWalkDistance,
      jeepneyRoute: jeepneyRoute,
      totalScore: totalScore,
      fromStop: fromStop,
      toStop: toStop,
      segments: [{
        type: 'walk',
        from: 'Your Location',
        to: fromStop.stop.name,
        distance: walkToStop,
        estimatedTime: `${Math.round(walkToStop / 80)} min walk`,
        description: `Walk ${Math.round(walkToStop)}m to jeepney stop at ${fromStop.stop.name}`
      }, ...jeepneyRoute.segments, {
        type: 'walk',
        from: toStop.stop.name,
        to: 'Destination',
        distance: walkFromStop,
        estimatedTime: `${Math.round(walkFromStop / 80)} min walk`,
        description: `Walk ${Math.round(walkFromStop)}m from jeepney stop to destination`
      }]
    };
  }

  private async drawCompleteRoute(userLocation: any, spots: any[]): Promise<void> {

    
    if (spots.length === 0) {

      return;
    }

    // Create complete route coordinates starting from user location
    const routeCoordinates: L.LatLng[] = [];
    
    // Start with user location
    routeCoordinates.push(L.latLng(userLocation.lat, userLocation.lng));
    
    // Add all spots in sequence
    spots.forEach(spot => {
      if (spot.location && spot.location.lat && spot.location.lng) {
        routeCoordinates.push(L.latLng(spot.location.lat, spot.location.lng));
      }
    });

    if (routeCoordinates.length < 2) {

      return;
    }

    // Get snapped route path using OSRM
    const snappedRoutePath = await this.getSnappedRoutePath(routeCoordinates);

    // Draw the main route line with snapped path
    this.routeLine = L.polyline(snappedRoutePath, {
      color: '#1976d2',
      weight: 4,
      opacity: 0.8,
      dashArray: '10, 5'
    }).addTo(this.map);

    // Add direction arrows and route information
    for (let i = 0; i < routeCoordinates.length - 1; i++) {
      const start = routeCoordinates[i];
      const end = routeCoordinates[i + 1];
      const midPoint = L.latLng(
        (start.lat + end.lat) / 2,
        (start.lng + end.lng) / 2
      );

      // Determine route type and jeepney code
      let routeType = 'walk';
      let jeepneyCode = '';
      let routeDescription = '';

      if (i === 0) {
        // First segment: User location to first spot
        const jeepneyRoute = this.findBestJeepneyRoute(userLocation, spots[0]);
        if (jeepneyRoute && this.jeepneyRoutes.length > 0) {
          routeType = 'jeepney';
          jeepneyCode = jeepneyRoute.code;
          routeDescription = `Take jeepney ${jeepneyRoute.code} from your location to ${spots[0].name}`;
        } else {
          routeType = 'walk';
          routeDescription = `Walk from your location to ${spots[0].name} (no jeepney route available)`;
          if (this.jeepneyRoutes.length === 0) {
            this.showToast(`Jeepney routes not loaded yet. Walking recommended.`);
          } else {
            this.showToast(`No jeepney route available to ${spots[0].name}. Walking recommended.`);
          }
        }
      } else {
        // Between spots
        const currentSpot = spots[i - 1];
        const nextSpot = spots[i];
        
        if (currentSpot.mealType) {
          routeType = 'walk';
          routeDescription = `Walk from ${currentSpot.name} to ${nextSpot.name}`;
        } else {
          const jeepneyRoute = this.findBestJeepneyRoute(currentSpot, nextSpot);
          if (jeepneyRoute && this.jeepneyRoutes.length > 0) {
            routeType = 'jeepney';
            jeepneyCode = jeepneyRoute.code;
            routeDescription = `Take jeepney ${jeepneyRoute.code} from ${currentSpot.name} to ${nextSpot.name}`;
          } else {
            routeType = 'walk';
            routeDescription = `Walk from ${currentSpot.name} to ${nextSpot.name} (no jeepney route available)`;
            if (this.jeepneyRoutes.length === 0) {
              this.showToast(`Jeepney routes not loaded yet. Walking recommended.`);
            } else {
              this.showToast(`No jeepney route available from ${currentSpot.name} to ${nextSpot.name}. Walking recommended.`);
            }
          }
        }
      }

      // Create direction arrow with route info
      const arrowHtml = routeType === 'jeepney' ? '🚌' : '🚶';
      const arrow = L.divIcon({
        className: 'direction-arrow',
        html: `<div style="
          background: ${routeType === 'jeepney' ? '#ff9800' : '#4caf50'};
          color: white;
          border-radius: 50%;
          width: 30px;
          height: 30px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 16px;
          border: 2px solid white;
          box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        ">${arrowHtml}</div>`,
        iconSize: [30, 30],
        iconAnchor: [15, 15]
      });

      const arrowMarker = L.marker(midPoint, { icon: arrow }).addTo(this.map);
      
      // Add popup with route information
      const popupContent = `
        <div style="text-align: center; min-width: 200px;">
          <h4 style="margin: 0 0 8px 0; color: #333;">${routeDescription}</h4>
          ${jeepneyCode ? `<p style="margin: 4px 0; color: #1976d2; font-weight: bold;">🚌 Jeepney Code: ${jeepneyCode}</p>` : ''}
          <p style="margin: 4px 0; color: #666; font-size: 0.9em;">${routeType === 'jeepney' ? 'Public Transport' : 'Walking'}</p>
        </div>
      `;
      
      arrowMarker.bindPopup(popupContent);
    }


  }

  private async getSnappedRoutePath(points: L.LatLng[]): Promise<L.LatLng[]> {
    try {
      // Use OSRM through proxy to snap route to roads
      const coordinates = points.map(p => `${p.lng},${p.lat}`).join(';');
      

      
      const response: any = await this.directionsService.getOsrmRoute(coordinates, 'driving').toPromise();
      
      if (response.code === 'Ok' && response.routes.length > 0) {
        const snappedCoordinates = response.routes[0].geometry.coordinates.map((coord: [number, number]) =>
          L.latLng(coord[1], coord[0])
        );

        return snappedCoordinates;
      } else {

        return points;
      }
    } catch (error) {
      console.error('OSRM routing error, using straight line:', error);
      return points; // Fallback to straight line
    }
  }



  private async generateCuratedRouteInfo(userLocation: any, spots: any[]): Promise<any> {
    const segments: any[] = [];
    let totalDistance = 0;
    let totalDuration = 0;
    const suggestedRoutes: any[] = [];

    // Process each segment
    for (let i = 0; i < spots.length; i++) {
      const fromLocation = i === 0 ? userLocation : spots[i - 1];
      const toLocation = spots[i];
      
      if (!fromLocation.location && !fromLocation.lat) {
        fromLocation.location = { lat: fromLocation.lat, lng: fromLocation.lng };
      }
      if (!toLocation.location && !toLocation.lat) {
        toLocation.location = { lat: toLocation.lat, lng: toLocation.lng };
      }

      const fromCoords = fromLocation.location || fromLocation;
      const toCoords = toLocation.location || toLocation;

      if (!fromCoords.lat || !fromCoords.lng || !toCoords.lat || !toCoords.lng) {
        continue;
      }

      // Find multiple jeepney routes for this segment
      const jeepneyRoutes = this.findMultipleJeepneyRoutesWithWaypoints(fromCoords, toCoords);
      
      if (jeepneyRoutes.length > 0) {
        // Add all suggested routes to the list
        jeepneyRoutes.forEach((route, index) => {
          suggestedRoutes.push({
            rank: index + 1,
            code: route.route.code,
            name: route.route.name || `${route.route.code} Route`,
            distance: route.routeDistance || 0,
            duration: `${Math.round((route.routeDistance || 0) / 200)} min`,
            fromDistance: route.fromDistance,
            toDistance: route.toDistance,
            totalScore: route.totalScore
          });
        });

        // Use the best route for the main segment
        const bestRoute = jeepneyRoutes[0];
        
        // Add jeepney segment
        const jeepneySegment = {
          type: 'jeepney',
          from: fromLocation.name || 'Your Location',
          to: toLocation.name || 'Destination',
          jeepneyCode: bestRoute.route.code,
          routeName: bestRoute.route.name || `${bestRoute.route.code} Route`,
          distance: bestRoute.routeDistance || 0,
          duration: `${Math.round((bestRoute.routeDistance || 0) / 200)} min`,
          description: `Take jeepney ${bestRoute.route.code} from near your location to near your destination`,
          instructions: `Board jeepney ${bestRoute.route.code} and travel to your destination`,
          alternatives: jeepneyRoutes.slice(1).map(route => ({
            code: route.route.code,
            name: route.route.name || `${route.route.code} Route`,
            distance: route.routeDistance || 0,
            duration: `${Math.round((route.routeDistance || 0) / 200)} min`
          }))
        };
        segments.push(jeepneySegment);
        
        // Add walking segments if needed
        if (bestRoute.fromDistance > 100) {
          const walkToSegment = {
            type: 'walk',
            from: fromLocation.name || 'Your Location',
            to: `Jeepney ${bestRoute.route.code} stop`,
            distance: bestRoute.fromDistance,
            duration: `${Math.round(bestRoute.fromDistance / 80)} min`,
            description: `Walk ${Math.round(bestRoute.fromDistance)}m to jeepney stop`,
            instructions: `Walk to the nearest jeepney ${bestRoute.route.code} stop`
          };
          segments.push(walkToSegment);
        }
        
        if (bestRoute.toDistance > 100) {
          const walkFromSegment = {
            type: 'walk',
            from: `Jeepney ${bestRoute.route.code} stop`,
            to: toLocation.name || 'Destination',
            distance: bestRoute.toDistance,
            duration: `${Math.round(bestRoute.toDistance / 80)} min`,
            description: `Walk ${Math.round(bestRoute.toDistance)}m from jeepney stop`,
            instructions: `Walk from jeepney ${bestRoute.route.code} stop to your destination`
          };
          segments.push(walkFromSegment);
        }
        
        totalDistance += bestRoute.routeDistance || 0;
        totalDuration += Math.round((bestRoute.routeDistance || 0) / 200);
      } else {
        // Add walking segment
        const walkDistance = this.getDistance(fromCoords, toCoords);
        const walkSegment = {
          type: 'walk',
          from: fromLocation.name || 'Your Location',
          to: toLocation.name || 'Destination',
          distance: walkDistance,
          duration: `${Math.round(walkDistance / 80)} min`,
          description: `Walk ${Math.round(walkDistance)}m to your destination`,
          instructions: `Walk directly to your destination`
        };
        segments.push(walkSegment);
        
        totalDistance += walkDistance;
        totalDuration += Math.round(walkDistance / 80);
      }
    }

    return {
      totalDistance: `${Math.round(totalDistance)}m`,
      totalDuration: `${totalDuration} min`,
      segments: segments,
      suggestedRoutes: suggestedRoutes
    };
  }

  async fetchApiRoutes(): Promise<void> {
    this.isLoadingApiRoutes = true;
    
    try {
      if (this.availableItineraries.length === 0) {
        throw new Error('No itineraries available');
      }

      const selectedItinerary = this.availableItineraries[this.selectedItineraryIndex];
      if (!selectedItinerary || !selectedItinerary.days) {
        throw new Error('No valid itinerary selected');
      }

      // Use real user location
      const userLocation = this.userLocation;

      // Extract spots from itinerary
      const spots: any[] = [];
      selectedItinerary.days.forEach((day: any) => {
        if (day.spots) {
          const daySpotsArray = Array.isArray(day.spots) ? day.spots : Object.values(day.spots);
          daySpotsArray.forEach((spot: any) => {
            if (spot && spot.location && spot.location.lat && spot.location.lng) {
              spots.push(spot);
            }
          });
        }
      });

      if (spots.length === 0) {
        throw new Error('No valid spots found in itinerary');
      }

      // Show loading message
      await this.showToast(`Fetching API routes for ${spots.length} spots...`);

      // Fetch routes using Google Directions API
      const apiRoutes = await this.fetchGoogleDirections(userLocation, spots);
      this.apiRouteInfo = apiRoutes;
      
      // Show success message
      await this.showToast(`✅ API routes loaded successfully!`);
      
      // Automatically show the routes on map
      await this.showApiRoutesOnMap();
      
    } catch (error) {
      console.error('Error fetching API routes:', error);
      
      // Show specific error message
      const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';
      await this.showToast(`❌ API Error: ${errorMessage}`);
    } finally {
      this.isLoadingApiRoutes = false;
    }
  }

  private async fetchGoogleDirections(userLocation: any, spots: any[]): Promise<any> {
    const segments: any[] = [];
    let totalDuration = 0;
    let totalDistance = 0;
    let totalFare = 0;
    let routePolylines: any[] = []; // Store polyline data for drawing

    // Create route sequence: user → spot1 → spot2 → ... → spotN
    const routeSequence = [userLocation, ...spots];

    // Generate cache key for this route
    const cacheKey = this.generateRouteCacheKey(routeSequence);
    
    // Check cache first
    const cachedResult = this.getCachedRoute(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    try {
      // Check API limit for multiple calls
      const canCall = await this.apiTracker.canCallApiToday('directions', routeSequence.length * 50);
      if (!canCall) {
        throw new Error('API limit reached for today');
      }

      // Fetch directions for each segment individually
      for (let i = 0; i < routeSequence.length - 1; i++) {
        const from = routeSequence[i];
        const to = routeSequence[i + 1];
        
        const origin = `${from.lat || from.location.lat},${from.lng || from.location.lng}`;
        const destination = `${to.location.lat},${to.location.lng}`;

        // Log API call for this segment
        this.apiTracker.logApiCall('directions', 'segment', { origin, destination, segmentIndex: i });

        // Fetch directions for this segment
        const result: any = await this.directionsService.getDirections(origin, destination, '', 'transit', true).toPromise();
        
        if (result && result.routes && result.routes.length > 0) {
          const route = result.routes[0];
          const leg = route.legs[0]; // Single leg for point-to-point
          
          // Parse steps to get transportation details
          const steps = leg.steps || [];
          const transitSteps = steps.filter((step: any) => step.travel_mode === 'TRANSIT');
          
          let transitDetails = '';
          let transitType = 'unknown';
          if (transitSteps.length > 0) {
            const transit = transitSteps[0].transit_details;
            const lineName = transit.line.name.toLowerCase();
            const vehicleType = transit.line.vehicle?.type || '';
            
            // Determine transit type based on line name and vehicle type
            if (lineName.includes('jeepney') || lineName.includes('jeep') || 
                vehicleType === 'BUS' || lineName.includes('bus')) {
              transitType = 'bus';
            } else if (lineName.includes('jeepney') || lineName.includes('jeep')) {
              transitType = 'jeepney';
            } else {
              // Default to bus for most transit
              transitType = 'bus';
            }
            
            transitDetails = `${transit.line.name} (${transit.line.short_name})`;
          }

          // Extract fare information if available
          let segmentFare = 0;
          
          // Check multiple possible fare structures from Google Directions API
          if (result.fare) {
            if (result.fare.value) {
              segmentFare = result.fare.value;
            } else if (result.fare.amount) {
              segmentFare = result.fare.amount;
            } else if (typeof result.fare === 'number') {
              segmentFare = result.fare;
            }
          }
          
          // If no fare from API, estimate based on transit type and distance
          if (segmentFare === 0 && transitSteps.length > 0) {
            const distanceKm = leg.distance.value / 1000; // Convert to km
            if (transitType === 'jeepney') {
              // Jeepney fare: ₱13-15 base fare
              segmentFare = 1400; // 14 pesos in cents
            } else if (transitType === 'bus') {
              // Bus fare: ₱15-25 depending on distance
              segmentFare = distanceKm > 10 ? 2500 : 1500; // 15-25 pesos in cents
            }
          }

          // Define a color palette for different segments
          const segmentColors = [
            '#ff6b35', // Orange
            '#4ecdc4', // Teal
            '#45b7d1', // Blue
            '#96ceb4', // Mint
            '#feca57', // Yellow
            '#ff9ff3', // Pink
            '#54a0ff', // Light Blue
            '#5f27cd', // Purple
            '#00d2d3', // Cyan
            '#ff9f43'  // Light Orange
          ];

          // Extract polyline data from steps with segment-specific styling
          const legPolylines: any[] = [];
          steps.forEach((step: any, stepIndex: number) => {
            if (step.polyline && step.polyline.points) {
              const decodedPoints = this.decodePolyline(step.polyline.points);
              const segmentColor = segmentColors[i % segmentColors.length]; // Cycle through colors
              const isWalking = step.travel_mode === 'WALKING';
              
              legPolylines.push({
                points: decodedPoints,
                mode: step.travel_mode,
                segmentIndex: i,
                from: from.name || 'User Location',
                to: to.name,
                color: isWalking ? '#28a745' : segmentColor, // Green for walking, segment color for transit
                weight: isWalking ? 3 : 6, // Thinner for walking, thicker for transit
                dashArray: isWalking ? '10, 5' : '0', // Dashed for walking, solid for transit
                instructions: step.html_instructions,
                segmentColor: segmentColor, // Store the segment color for reference
                transitDetails: step.travel_mode === 'TRANSIT' ? transitDetails : null // Add transit details for transit steps
              });

            }
          });

          const segment = {
            from: from.name || 'User Location',
            to: to.name,
            mode: transitSteps.length > 0 ? 'transit' : 'walking',
            transitType: transitType,
            duration: leg.duration.text,
            distance: leg.distance.text,
            instructions: leg.end_address,
            transitDetails: transitDetails,
            polylines: legPolylines,
            segmentIndex: i,
            segmentColor: segmentColors[i % segmentColors.length], // Add segment color
            fare: segmentFare > 0 ? this.formatFare(segmentFare) : null // Add fare information
          };
          
          segments.push(segment);
          routePolylines.push(...legPolylines);

          totalDuration += leg.duration.value;
          totalDistance += leg.distance.value;
          totalFare += segmentFare;
        }
              }

      // Check if any public transport is available
      const hasPublicTransport = segments.some(segment => 
        segment.mode === 'transit' || 
        segment.transitDetails || 
        segment.transitType === 'jeepney' || 
        segment.transitType === 'bus'
      );

      if (!hasPublicTransport && segments.length > 0) {
        const noTransportResult = {
          segments: [],
          totalDuration: '0m',
          totalDistance: '0m',
          totalFare: '₱0.00',
          routePolylines: [],
          noTransportAvailable: true,
          message: "Can't seem to find a way there"
        };
        
        // Cache the no transport result
        this.setCachedRoute(cacheKey, noTransportResult);
        
        return noTransportResult;
      }

      const result = {
        segments: segments,
        totalDuration: this.formatDuration(totalDuration),
        totalDistance: this.formatDistance(totalDistance),
        totalFare: this.formatFare(totalFare),
        routePolylines: routePolylines, // Include polyline data for drawing
        noTransportAvailable: false
      };

      // Cache the successful result
      this.setCachedRoute(cacheKey, result);

      return result;
    } catch (error) {
      console.error('Error fetching Google Directions:', error);
      throw error;
    }
  }

  private formatDuration(seconds: number): string {
    const hours = Math.floor(seconds / 3600);
    const minutes = Math.floor((seconds % 3600) / 60);
    return hours > 0 ? `${hours}h ${minutes}m` : `${minutes}m`;
  }

  private formatDistance(meters: number): string {
    const km = meters / 1000;
    return km >= 1 ? `${km.toFixed(1)} km` : `${meters}m`;
  }

  private formatFare(cents: number): string {
    const pesos = cents / 100; // Convert cents to pesos
    return `₱${pesos.toFixed(2)}`;
  }

  private parseJeepneyLabel(transitDetails: string): string {
    // Parse transit details in format "Jeepney Name (Short Code)"
    // Example: "Inayawan-Colon (11A)" -> "🚌 Inayawan-Colon (11A)"
    
    if (!transitDetails) {
      return '🚌'; // Just show jeepney icon, no "Transit" text
    }
    
    // Check if it's in the expected format "Name (Code)"
    const match = transitDetails.match(/^(.+?)\s*\((.+?)\)$/);
    if (match) {
      const jeepneyName = match[1].trim();
      const jeepneyCode = match[2].trim();
      return `🚌 ${jeepneyName} (${jeepneyCode})`;
    }
    
    // Fallback: just return the transit details with jeepney icon
    return `🚌 ${transitDetails}`;
  }

  async showApiRoutesOnMap(): Promise<void> {
    // Clear existing API routes and markers only
    this.clearAllRouteLines();
    this.clearApiMarkers();
    
    // Keep tourist spot markers and user location markers
    
    if (!this.apiRouteInfo) {
      return;
    }

    // Check if no transport is available
    if (this.apiRouteInfo.noTransportAvailable) {
      // Show tourist spot markers only
      const selectedItinerary = this.availableItineraries[this.selectedItineraryIndex];
      if (selectedItinerary && selectedItinerary.days) {
        selectedItinerary.days.forEach((day: any) => {
          if (day.spots) {
            const daySpotsArray = Array.isArray(day.spots) ? day.spots : Object.values(day.spots);
            daySpotsArray.forEach((spot: any, index: number) => {
              if (spot && spot.location && spot.location.lat && spot.location.lng) {
                const spotMarker = L.marker([spot.location.lat, spot.location.lng], {
                  icon: this.getApiRouteMarkerIcon(spot, index + 1)
                }).addTo(this.map);
                
                spotMarker.bindPopup(this.createDirectionSpotPopup(spot, index + 1));
                this.apiMarkers.push(spotMarker);
              }
            });
          }
        });
      }

      // Show a toast message
      await this.showToast(this.apiRouteInfo.message || "Can't seem to find a way there");
      return;
    }

    // Use real user location
    const userLocation = this.userLocation;

    // Add user location marker for API routes
    const userMarker = L.marker([userLocation.lat, userLocation.lng], {
      icon: L.divIcon({
        html: `<div style="
          background: #28a745;
          color: white;
          border-radius: 50%;
          width: 25px;
          height: 25px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          border: 2px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        ">📍</div>`,
        className: 'user-location-marker',
        iconSize: [25, 25],
        iconAnchor: [12, 12]
      })
    }).addTo(this.map);

    // Add popup for user location
    userMarker.bindPopup(`
      <div style="min-width: 150px;">
        <h4 style="margin: 0 0 8px 0; color: #333;">Your Location</h4>
        <p style="margin: 4px 0; color: #666;">${userLocation.name}</p>
      </div>
    `);

    this.apiMarkers.push(userMarker);

    // Add tourist spot markers for API routes
    const selectedItinerary = this.availableItineraries[this.selectedItineraryIndex];
    if (selectedItinerary && selectedItinerary.days) {
      // Create a map to track unique locations and prevent duplicates
      const locationMap = new Map<string, any>();
      let spotIndex = 1;
      
      selectedItinerary.days.forEach((day: any) => {
        if (day.spots) {
          const daySpotsArray = Array.isArray(day.spots) ? day.spots : Object.values(day.spots);
          daySpotsArray.forEach((spot: any) => {
            if (spot && spot.location && spot.location.lat && spot.location.lng) {
              // Create a unique key for this location (rounded to 4 decimal places to handle slight variations)
              const locationKey = `${spot.location.lat.toFixed(4)},${spot.location.lng.toFixed(4)}`;
              
              // Check if we already have a marker at this location
              if (locationMap.has(locationKey)) {
                return; // Skip creating duplicate marker
              }
              
              // Add to location map to prevent duplicates
              locationMap.set(locationKey, spot);
              
              const spotMarker = L.marker([spot.location.lat, spot.location.lng], {
                icon: this.getApiRouteMarkerIcon(spot, spotIndex)
              }).addTo(this.map);
              spotMarker.bindPopup(this.createDirectionSpotPopup(spot, spotIndex));
              this.apiMarkers.push(spotMarker);
              spotIndex++;
            }
          });
        }
      });
    }

    // Draw API routes on map
    await this.drawApiRoutesOnMap(userLocation, this.apiRouteInfo);
  }

  private async drawApiRoutesOnMap(userLocation: any, apiRouteInfo: any): Promise<void> {
    // Check if we have polyline data from Google Directions
    if (apiRouteInfo.routePolylines && apiRouteInfo.routePolylines.length > 0) {
      
      // Draw each polyline segment from Google Directions with enhanced styling
      apiRouteInfo.routePolylines.forEach((polylineData: any, index: number) => {
        if (polylineData.points && polylineData.points.length > 0) {
          const routeLine = L.polyline(polylineData.points, {
            color: polylineData.color || '#2196f3',
            weight: polylineData.weight || (polylineData.mode === 'walking' ? 3 : 6),
            opacity: 0.8,
            dashArray: polylineData.dashArray || (polylineData.mode === 'walking' ? '10, 5' : '0')
          }).addTo(this.map);
          
          this.apiRouteLines.push(routeLine);
          
          // Add label to the route line
          if (polylineData.points.length > 1) {
            const midPoint = polylineData.points[Math.floor(polylineData.points.length / 2)];
            const labelText = polylineData.mode === 'TRANSIT' ? 
              (polylineData.transitDetails ? this.parseJeepneyLabel(polylineData.transitDetails) : '🚌') : 
              '🚶 Walk';
            
            const routeLabel = L.divIcon({
              html: `<div style="
                background: ${polylineData.color || (polylineData.mode === 'TRANSIT' ? '#ff6b35' : '#28a745')};
                color: white;
                border-radius: 4px;
                padding: 2px 6px;
                font-size: 10px;
                font-weight: bold;
                border: 1px solid white;
                box-shadow: 0 2px 4px rgba(0,0,0,0.3);
                white-space: nowrap;
                text-align: center;
              ">${labelText}</div>`,
              className: 'route-label',
              iconSize: [180, 20],
              iconAnchor: [90, 10]
            });
            
            const labelMarker = L.marker(midPoint, {
              icon: routeLabel
            }).addTo(this.map);
            
            this.apiRouteLines.push(labelMarker);
          }
          
          // Add start and end markers for each segment
          if (polylineData.points.length > 0) {
            const startPoint = polylineData.points[0];
            const endPoint = polylineData.points[polylineData.points.length - 1];
            
            // Start marker with segment-specific styling
            const startMarker = L.marker(startPoint, {
              icon: L.divIcon({
                html: `<div style="
                  background: ${polylineData.color || (polylineData.mode === 'TRANSIT' ? '#ff6b35' : '#28a745')};
                  color: white;
                  border-radius: 50%;
                  width: 24px;
                  height: 24px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 14px;
                  font-weight: bold;
                  border: 2px solid white;
                  box-shadow: 0 3px 6px rgba(0,0,0,0.4);
                ">${polylineData.mode === 'TRANSIT' ? '🚌' : '🚶'}</div>`,
                className: 'segment-marker',
                iconSize: [24, 24],
                iconAnchor: [12, 12]
              })
            }).addTo(this.map);
            
            // End marker with segment-specific styling
            const endMarker = L.marker(endPoint, {
              icon: L.divIcon({
                html: `<div style="
                  background: ${polylineData.color || (polylineData.mode === 'TRANSIT' ? '#ff6b35' : '#28a745')};
                  color: white;
                  border-radius: 50%;
                  width: 24px;
                  height: 24px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 14px;
                  font-weight: bold;
                  border: 2px solid white;
                  box-shadow: 0 3px 6px rgba(0,0,0,0.4);
                ">${polylineData.mode === 'TRANSIT' ? '🚌' : '🚶'}</div>`,
                className: 'segment-marker',
                iconSize: [24, 24],
                iconAnchor: [12, 12]
              })
            }).addTo(this.map);
            
            this.apiRouteLines.push(startMarker, endMarker);
          }
        }
      });
    } else {
      // Fallback to simplified route (current behavior)
      const selectedItinerary = this.availableItineraries[this.selectedItineraryIndex];
      const spots: any[] = [];
      
      selectedItinerary.days.forEach((day: any) => {
        if (day.spots) {
          const daySpotsArray = Array.isArray(day.spots) ? day.spots : Object.values(day.spots);
          daySpotsArray.forEach((spot: any) => {
            if (spot && spot.location && spot.location.lat && spot.location.lng) {
              spots.push(spot);
            }
          });
        }
      });

      // Create route coordinates
      const routeCoordinates: L.LatLng[] = [];
      routeCoordinates.push(L.latLng(userLocation.lat, userLocation.lng));
      spots.forEach(spot => {
        routeCoordinates.push(L.latLng(spot.location.lat, spot.location.lng));
      });

      // Get snapped route path using OSRM for API routes too
      const snappedRoutePath = await this.getSnappedRoutePath(routeCoordinates);

      // Draw API route with different colors for different segments
      const apiSegmentColors = [
        '#9c27b0', // Purple
        '#2196f3', // Blue
        '#4caf50', // Green
        '#ff9800', // Orange
        '#f44336', // Red
        '#00bcd4', // Cyan
        '#795548', // Brown
        '#607d8b'  // Blue Grey
      ];

      // Draw each segment with different colors
      for (let i = 0; i < snappedRoutePath.length - 1; i++) {
        const segmentColor = apiSegmentColors[i % apiSegmentColors.length];
        const segmentLine = L.polyline([snappedRoutePath[i], snappedRoutePath[i + 1]], {
          color: segmentColor,
          weight: 4,
          opacity: 0.8,
          dashArray: '15, 10'
        }).addTo(this.map);
        
        this.apiRouteLines.push(segmentLine);
        
        // Add label to the segment
        const midPoint = L.latLng(
          (snappedRoutePath[i].lat + snappedRoutePath[i + 1].lat) / 2,
          (snappedRoutePath[i].lng + snappedRoutePath[i + 1].lng) / 2
        );
        
        const segmentLabel = L.divIcon({
          html: `<div style="
            background: ${segmentColor};
            color: white;
            border-radius: 4px;
            padding: 2px 6px;
            font-size: 10px;
            font-weight: bold;
            border: 1px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
            white-space: nowrap;
            text-align: center;
          ">🚌 Route ${i + 1}</div>`,
          className: 'route-label',
          iconSize: [90, 20],
          iconAnchor: [45, 10]
        });
        
        const labelMarker = L.marker(midPoint, {
          icon: segmentLabel
        }).addTo(this.map);
        
        this.apiRouteLines.push(labelMarker);
      }

      // Add API route markers
      apiRouteInfo.segments.forEach((segment: any, index: number) => {
        const spot = spots[index];
        if (spot) {
          const markerIcon = L.divIcon({
            className: 'api-route-marker',
            html: `<div style="
              background: ${segment.mode === 'transit' ? '#9c27b0' : '#4caf50'};
              color: white;
              border-radius: 50%;
              width: 32px;
              height: 32px;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 16px;
              border: 2px solid white;
              box-shadow: 0 3px 6px rgba(0,0,0,0.4);
            ">${segment.mode === 'transit' ? '🚌' : '🚶'}</div>`,
            iconSize: [32, 32],
            iconAnchor: [16, 16]
          });

          const marker = L.marker([spot.location.lat, spot.location.lng], {
            icon: markerIcon
          }).addTo(this.map);

          const popupContent = `
            <div style="text-align: center; min-width: 200px;">
              <h4 style="margin: 0 0 8px 0; color: #333;">${segment.from} → ${segment.to}</h4>
              ${segment.transitDetails ? `<p style="margin: 4px 0; color: #9c27b0; font-weight: bold;">🚌 ${segment.transitDetails}</p>` : ''}
              <p style="margin: 4px 0; color: #666; font-size: 0.9em;">⏱️ ${segment.duration}</p>
              <p style="margin: 4px 0; color: #666; font-size: 0.9em;">📏 ${segment.distance}</p>
            </div>
          `;
          
          marker.bindPopup(popupContent);
        }
      });
    }
  }

  getApiRouteIcon(mode: string): string {
    switch (mode) {
      case 'transit': return 'car';
      case 'walking': return 'walk';
      case 'driving': return 'car';
      default: return 'location';
    }
  }

  getApiRouteColor(mode: string): string {
    switch (mode) {
      case 'transit': return 'primary';
      case 'walking': return 'success';
      case 'driving': return 'warning';
      default: return 'medium';
    }
  }

  showApiRouteOnMap(segment: any): void {

    // Implementation for showing individual API route segment
  }

  // Method to display jeepney routes on map for reference
  private showJeepneyRoutesOnMap(): void {
    // Check if jeepney routes are loaded
    if (!this.jeepneyRoutes || this.jeepneyRoutes.length === 0) {
      return;
    }
    
    this.jeepneyRoutes.forEach(route => {
      if (!route || !route.stops || !Array.isArray(route.stops) || route.stops.length === 0) {
        return;
      }
      
      const routeCoordinates = route.stops
        .filter((stop: any) => stop && stop.lat && stop.lng)
        .map((stop: any) => L.latLng(stop.lat, stop.lng));
      
      if (routeCoordinates.length < 2) {
        return;
      }
      
      // Draw jeepney route line
      const jeepneyLine = L.polyline(routeCoordinates, {
        color: route.color || '#FF5722',
        weight: 3,
        opacity: 0.6,
        dashArray: '8, 4'
      }).addTo(this.map);
      
      // Add jeepney route markers
      route.stops.forEach((stop: any, index: number) => {
        if (!stop || !stop.lat || !stop.lng) {
          return;
        }
        
        const markerIcon = L.divIcon({
          className: 'jeepney-stop-marker',
          html: `<div style="
            background: ${route.color || '#FF5722'};
            color: white;
            border-radius: 50%;
            width: 20px;
            height: 20px;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10px;
            font-weight: bold;
            border: 2px solid white;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
          ">${route.code || '?'}</div>`,
          iconSize: [20, 20],
          iconAnchor: [10, 10]
        });

        const marker = L.marker([stop.lat, stop.lng], {
          icon: markerIcon
        }).addTo(this.map);

        const popupContent = `
          <div style="text-align: center; min-width: 150px;">
            <h4 style="margin: 0 0 8px 0; color: #333;">🚌 ${route.code || 'Unknown'}</h4>
            <p style="margin: 4px 0; color: #666; font-size: 0.9em;">${stop.name || 'Unknown Stop'}</p>
            <p style="margin: 4px 0; color: #666; font-size: 0.8em;">${route.name || 'Unknown Route'}</p>
          </div>
        `;
        
        marker.bindPopup(popupContent);
      });
    });
  }

  // Enhanced route finding with walking directions to nearest jeepney stop
  private async findRouteWithWalkingDirections(from: any, to: any): Promise<any> {
    const nearestJeepney = this.getNearestJeepneyStop(from);
    const bestRoute = this.findBestJeepneyRoute(from, to);
    
    if (!bestRoute) {
      return {
        type: 'walking',
        description: `Walk from ${from.name} to ${to.name}`,
        distance: this.getDistance(from, to),
        duration: Math.round(this.getDistance(from, to) / 0.0011), // ~1.1 m/s walking speed
        jeepneyCode: null
      };
    }

    const fromStop = this.findNearestStop(from, bestRoute.stops);
    const toStop = this.findNearestStop(to, bestRoute.stops);
    
    const walkToStop = this.getDistance(from, fromStop);
    const jeepneyDistance = this.getRouteDistance(bestRoute, fromStop, toStop);
    const walkFromStop = this.getDistance(toStop, to);
    
    return {
      type: 'mixed',
      description: `Walk to ${fromStop.name}, take ${bestRoute.code} to ${toStop.name}, walk to ${to.name}`,
      walkToStop: walkToStop,
      jeepneyDistance: jeepneyDistance,
      walkFromStop: walkFromStop,
      totalDistance: walkToStop + jeepneyDistance + walkFromStop,
      jeepneyCode: bestRoute.code,
      fromStop: fromStop,
      toStop: toStop
    };
  }

  // Test proxy connection




  private async showToast(message: string): Promise<void> {
    const toast = await this.toastCtrl.create({
      message: message,
      duration: 3000,
      position: 'bottom',
      color: 'warning'
    });
    toast.present();
  }

    async showCuratedRouteDetailsSheet(): Promise<void> {
    if (this.selectedItineraryIndex < 0) {
      await this.showToast('Please select an itinerary first.');
      return;
    }
    
    if (!this.currentRouteInfo) {
      await this.showToast('No curated route information available. Please select an itinerary and generate curated routes first.');
      return;
    }

    const routeInfo = {
      title: this.formatItineraryTitle(this.availableItineraries[this.selectedItineraryIndex]) + ' (Curated)',
      totalDuration: this.currentRouteInfo.totalDuration,
      totalDistance: this.currentRouteInfo.totalDistance,
      segments: this.currentRouteInfo.segments,
      suggestedRoutes: this.currentRouteInfo.suggestedRoutes || []
    };

    // Create the overlay component dynamically
    const componentFactory = this.componentFactoryResolver.resolveComponentFactory(RouteDetailsOverlayComponent);
    const componentRef = componentFactory.create(this.injector);

    // Set the inputs
    componentRef.instance.routeInfo = routeInfo;
    

    // Attach to the view container
    this.viewContainerRef.insert(componentRef.hostView);
  }

  async showRouteDetailsSheet(): Promise<void> {
    let routeInfo;
    
    if (this.apiRouteInfo) {
      // Check if no transport is available
      if (this.apiRouteInfo.noTransportAvailable) {
        await this.showToast(this.apiRouteInfo.message || "Can't seem to find a way there");
        return;
      }
      
      routeInfo = {
        title: this.formatItineraryTitle(this.availableItineraries[this.selectedItineraryIndex]) + ' (API)',
        totalDuration: this.apiRouteInfo.totalDuration,
        totalDistance: this.apiRouteInfo.totalDistance,
        totalFare: this.apiRouteInfo.totalFare,
        segments: this.apiRouteInfo.segments
      };
    } else {
      await this.showToast('No route information available. Please fetch API routes first.');
      return;
    }

    // Create the overlay component dynamically
    const componentFactory = this.componentFactoryResolver.resolveComponentFactory(RouteDetailsOverlayComponent);
    const componentRef = componentFactory.create(this.injector);

    // Set the inputs
    componentRef.instance.routeInfo = routeInfo;

    // Attach to the view container
    this.viewContainerRef.insert(componentRef.hostView);
  }

  async showApiRouteDetailsSheet(): Promise<void> {
    if (this.selectedItineraryIndex < 0) {
      await this.showToast('Please select an itinerary first.');
      return;
    }
    
    if (!this.apiRouteInfo) {
      await this.showToast('No API route information available');
      return;
    }

    // Check if no transport is available
    if (this.apiRouteInfo.noTransportAvailable) {
      await this.showToast(this.apiRouteInfo.message || "Can't seem to find a way there");
      return;
    }

    const routeInfo = {
      title: this.formatItineraryTitle(this.availableItineraries[this.selectedItineraryIndex]) + ' (API)',
      totalDuration: this.apiRouteInfo.totalDuration,
      totalDistance: this.apiRouteInfo.totalDistance,
      segments: this.apiRouteInfo.segments
    };

    // Create the overlay component dynamically
    const componentFactory = this.componentFactoryResolver.resolveComponentFactory(RouteDetailsOverlayComponent);
    const componentRef = componentFactory.create(this.injector);
    
    // Set the inputs
    componentRef.instance.routeInfo = routeInfo;
    
    
    // Attach to the view container
    this.viewContainerRef.insert(componentRef.hostView);
    

  }

  // New Google Maps-style route drawing method
  private async drawCuratedRouteWithMarkers(userLocation: any, spots: any[]): Promise<void> {
    console.log(`🎯 drawCuratedRouteWithMarkers called with ${spots.length} spots`);
    console.log(`🎯 Spots:`, spots.map(spot => ({ name: spot.name, lat: spot.location?.lat || spot.lat, lng: spot.location?.lng || spot.lng })));
    
    if (spots.length === 0) {
      console.log(`⚠️ No spots to draw`);
      return;
    }

    // Clear existing API routes and markers
    this.apiRouteLines.forEach(line => {
      if (this.map.hasLayer(line)) {
        this.map.removeLayer(line);
      }
    });
    this.apiRouteLines = [];

    this.apiMarkers.forEach(marker => {
      if (this.map.hasLayer(marker)) {
        this.map.removeLayer(marker);
      }
    });
    this.apiMarkers = [];
    


    // Add user location marker
    const userMarker = L.marker([userLocation.lat, userLocation.lng], {
      icon: L.divIcon({
        html: `<div style="
          background: #28a745;
          color: white;
          border-radius: 50%;
          width: 25px;
          height: 25px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          border: 2px solid white;
          box-shadow: 0 2px 8px rgba(0,0,0,0.3);
        ">📍</div>`,
        className: 'user-location-marker',
        iconSize: [25, 25],
        iconAnchor: [12, 12]
      })
    }).addTo(this.map);

    // Add popup for user location
    userMarker.bindPopup(`
      <div style="min-width: 150px;">
        <h4 style="margin: 0 0 8px 0; color: #333;">Your Location</h4>
        <p style="margin: 4px 0; color: #666;">${userLocation.name}</p>
      </div>
    `);

    this.apiMarkers.push(userMarker);

    // Create a map to track unique locations and prevent duplicates
    const locationMap = new Map<string, any>();
    let spotIndex = 1;

    // Process each segment individually to show different line styles like Google Maps
    for (let i = 0; i < spots.length; i++) {
      const fromLocation = i === 0 ? userLocation : spots[i - 1];
      const toLocation = spots[i];
      
      if (!fromLocation.location && !fromLocation.lat) {
        fromLocation.location = { lat: fromLocation.lat, lng: fromLocation.lng };
      }
      if (!toLocation.location && !toLocation.lat) {
        toLocation.location = { lat: toLocation.lat, lng: toLocation.lng };
      }

      const fromCoords = fromLocation.location || fromLocation;
      const toCoords = toLocation.location || toLocation;

      if (!fromCoords.lat || !fromCoords.lng || !toCoords.lat || !toCoords.lng) {
        continue;
      }

      // Create a unique key for this location (rounded to 4 decimal places to handle slight variations)
      const locationKey = `${toCoords.lat.toFixed(4)},${toCoords.lng.toFixed(4)}`;
      
      // Check if we already have a marker at this location
      if (locationMap.has(locationKey)) {
        continue; // Skip creating duplicate marker
      }
      
      // Add to location map to prevent duplicates
      locationMap.set(locationKey, toLocation);

      // Create API marker for destination
      const curatedMarker = L.marker([toCoords.lat, toCoords.lng], {
        icon: this.getApiRouteMarkerIcon(toLocation, spotIndex)
      }).addTo(this.map);

      // Add popup for API marker
      curatedMarker.bindPopup(this.createDirectionSpotPopup(toLocation, spotIndex));
      this.apiMarkers.push(curatedMarker);
      spotIndex++;

      // Find multiple jeepney routes for this segment
      const jeepneyRoutes = this.findMultipleJeepneyRoutesWithWaypoints(fromCoords, toCoords);
      
      if (jeepneyRoutes.length > 0) {
        // Draw the best route as the main route
        const bestRoute = jeepneyRoutes[0];
        await this.drawJeepneyRouteWithWaypoints(fromCoords, toCoords, bestRoute);
        
        // Draw alternative routes with different colors
        for (let j = 1; j < Math.min(jeepneyRoutes.length, 3); j++) {
          const altRoute = jeepneyRoutes[j];
          await this.drawAlternativeJeepneyRoute(fromCoords, toCoords, altRoute, j);
        }
      } else {
        // Draw walking route (light grey line like Google Maps)
        const walkLine = L.polyline([fromCoords, toCoords], {
          color: '#9e9e9e', // Light grey like Google Maps
          weight: 4,
          opacity: 0.7,
          dashArray: '5, 5' // Dashed line for walking
        }).addTo(this.map);
        
        this.apiRouteLines.push(walkLine);
      }
    }

    // Fit map to show all markers
    if (this.apiMarkers.length > 0) {
      const group = L.featureGroup(this.apiMarkers);
      this.map.fitBounds(group.getBounds().pad(0.1));
    }
  }

  // Cache methods for route suggestions
  private generateRouteCacheKey(routeSequence: any[]): string {
    const coordinates = routeSequence.map(point => {
      const lat = point.lat || point.location?.lat;
      const lng = point.lng || point.location?.lng;
      return `${lat.toFixed(4)},${lng.toFixed(4)}`;
    });
    return `route_${coordinates.join('_')}`;
  }

  private getCachedRoute(cacheKey: string): any | null {
    try {
      const cached = localStorage.getItem(`route_cache_${cacheKey}`);
      if (cached) {
        const data = JSON.parse(cached);
        // Check if cache is still valid (24 hours)
        const now = Date.now();
        if (now - data.timestamp < 24 * 60 * 60 * 1000) {
          return data.route;
        } else {
          // Remove expired cache
          localStorage.removeItem(`route_cache_${cacheKey}`);
        }
      }
    } catch (error) {
      // If cache is corrupted, remove it
      localStorage.removeItem(`route_cache_${cacheKey}`);
    }
    return null;
  }

  private setCachedRoute(cacheKey: string, routeData: any): void {
    try {
      const cacheData = {
        route: routeData,
        timestamp: Date.now()
      };
      localStorage.setItem(`route_cache_${cacheKey}`, JSON.stringify(cacheData));
    } catch (error) {
      // If localStorage is full, clear old cache entries
      this.clearOldRouteCache();
      try {
        const cacheData = {
          route: routeData,
          timestamp: Date.now()
        };
        localStorage.setItem(`route_cache_${cacheKey}`, JSON.stringify(cacheData));
      } catch (e) {
        // If still fails, skip caching
      }
    }
  }

  private clearOldRouteCache(): void {
    try {
      const keys = Object.keys(localStorage);
      const routeKeys = keys.filter(key => key.startsWith('route_cache_'));
      
      // Sort by timestamp and remove oldest entries
      const cacheEntries = routeKeys.map(key => {
        try {
          const data = JSON.parse(localStorage.getItem(key) || '{}');
          return { key, timestamp: data.timestamp || 0 };
        } catch {
          return { key, timestamp: 0 };
        }
      }).sort((a, b) => a.timestamp - b.timestamp);

      // Remove oldest 50% of entries
      const toRemove = Math.floor(cacheEntries.length / 2);
      for (let i = 0; i < toRemove; i++) {
        localStorage.removeItem(cacheEntries[i].key);
      }
    } catch (error) {
      // If clearing fails, continue without caching
    }
  }

  // Method to clear all route cache (for testing)
  public clearAllRouteCache(): void {
    try {
      const keys = Object.keys(localStorage);
      const routeKeys = keys.filter(key => key.startsWith('route_cache_'));
      
      routeKeys.forEach(key => {
        localStorage.removeItem(key);
      });
      
      console.log('🗑️ All route cache cleared');
    } catch (error) {
      console.log('⚠️ Error clearing route cache:', error);
    }
  }


}
