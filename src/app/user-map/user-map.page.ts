import { Component, AfterViewInit, OnDestroy, NgZone, ComponentFactoryResolver, ViewContainerRef, Injector } from '@angular/core';
import { NavController, ToastController, ModalController, LoadingController, AlertController } from '@ionic/angular';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { HttpClient } from '@angular/common/http';
import * as L from 'leaflet';
import { TouristSpotSheetComponent } from '../components/tourist-spot-sheet/tourist-spot-sheet.component';
import { Geolocation } from '@capacitor/geolocation';
import { DaySpotPickerComponent } from '../components/day-spot-picker/day-spot-picker.component';
import { environment } from '../../environments/environment';
import { RouteDetailsOverlayComponent } from '../components/route-details-overlay/route-details-overlay.component';
import { GeofencingService } from '../services/geofencing.service';
import { Subscription } from 'rxjs';


// services imports
import { BucketService } from '../services/bucket-list.service';
import { DirectionsService } from '../services/directions.service';
import { ApiTrackerService } from '../services/api-tracker.service';
import { ItineraryService, ItineraryDay } from '../services/itinerary.service';
import { CalendarService, CalendarEvent } from '../services/calendar.service';
import { BadgeService } from '../services/badge.service';
import { BudgetService } from '../services/budget.service';

import { MapManagementService } from '../services/map-management.service';
import { RoutePlanningService, RouteInfo } from '../services/route-planning.service';
import { JeepneyRoutingService } from '../services/jeepney-routing.service';
import { LocationTrackingService, UserLocation } from '../services/location-tracking.service';
import { MapUIService } from '../services/map-ui.service';
import { MapUtilitiesService } from '../services/map-utilities.service';


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
  
  // Pin system for route markers
  private routeMarkers: L.Marker[] = [];
  itinerary: ItineraryDay[] = [];
  navigationInstructions: string[] = [];
  navigating: boolean = false;

  // Add missing properties for template
  selectedTab: string = 'spots';
  selectedTile: string = 'osm';
  selectedItineraryIndex: number = -1; // Start with no selection
  availableItineraries: any[] = [];
  currentRouteInfo: any = null;
  stageRouteOptions: any[] = []; // Store multiple route options for each stage
  selectedStageForOptions: number = -1; // Track which stage's options are being shown
  selectedSegmentIndex: number = -1; // Track selected route segment for navigation
  
  // Loading modal properties
  loadingModal: any = null;
  loadingProgress: string = '';
  
  // Location tracking
  private locationWatcher?: any;
  private isLocationTracking: boolean = false;
  private locationUpdateInterval: number = 10000; // update every 10 seconds
  
  // Jeepney routes loaded from Firebase
  jeepneyRoutes: any[] = [];
  isLoadingJeepneyRoutes: boolean = false;
  isGeneratingRoute: boolean = false;

  // Fullscreen mode
  isFullscreen: boolean = false;

  // Subscription for location updates
  private locationSubscription?: Subscription;

  constructor(
    private navCtrl: NavController,
    private afAuth: AngularFireAuth,
    private firestore: AngularFirestore,
    private http: HttpClient,
    private toastCtrl: ToastController,
    private ngZone: NgZone,
    private modalCtrl: ModalController,
    private loadingCtrl: LoadingController,
    private alertCtrl: AlertController,
    private componentFactoryResolver: ComponentFactoryResolver,
    private viewContainerRef: ViewContainerRef,
    private injector: Injector,
    private geofencingService: GeofencingService,



    // services imports
    bucketService: BucketService,
    private directionsService: DirectionsService,
    private apiTracker: ApiTrackerService,
    private itineraryService: ItineraryService,
    private calendarService: CalendarService,
    private badgeService: BadgeService,
    private budgetService: BudgetService,
    private mapManagement: MapManagementService,
    private routePlanning: RoutePlanningService,
    private jeepneyRouting: JeepneyRoutingService,
    private locationTracking: LocationTrackingService,
    private mapUI: MapUIService,
    private mapUtils: MapUtilitiesService
  ) {
    this.bucketService = bucketService;
  }

  async onTabChange(): Promise<void> {
    this.mapManagement.clearAllMarkers();
    this.mapManagement.clearRouteMarkers();
    this.mapManagement.clearAllRouteLines();
    
    this.mapManagement.invalidateSize();
    
    if (this.selectedTab === 'directions') {
      await this.loadAvailableItineraries();
      await this.loadJeepneyRoutes();
      
      // If an itinerary is already selected, show it
      if (this.selectedItineraryIndex >= 0 && this.availableItineraries.length > 0) {
        await this.showDirectionsAndRoutes();
      }
    } else if (this.selectedTab === 'spots') {
      this.showTouristSpots();
    }
  }


  onTileChange(): void {
    this.mapManagement.changeTileLayer(this.selectedTile);
  }


  async loadAvailableItineraries(): Promise<void> {
    try {
      const events = await this.calendarService.loadItineraryEvents();
      
      if (events && events.length > 0) {
        const itineraries = this.mapUtils.groupEventsIntoItineraries(events);
        
        if (itineraries.length > 0) {
          this.availableItineraries = itineraries;
        } else {
          this.availableItineraries = [];
        }
      } else {
        this.availableItineraries = [];
      }
    } catch (error) {
      this.availableItineraries = [];
    }
  }

  async loadJeepneyRoutes(): Promise<void> {
    this.isLoadingJeepneyRoutes = true;
    
    try {
      const routesSnapshot = await this.firestore.collection('jeepney_routes').get().toPromise();
      this.jeepneyRoutes = routesSnapshot?.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as any)
      })) || [];
      
    } catch (error) {
      // Silently handle error
    } finally {
      this.isLoadingJeepneyRoutes = false;
    }
  }

  async loadItineraryRoutes(): Promise<void> {
    if (this.selectedItineraryIndex < 0 || this.selectedItineraryIndex >= this.availableItineraries.length) {
      // Clear any existing route data when no itinerary is selected
      this.currentRouteInfo = null;
      this.mapManagement.clearAllRouteLines();
      this.mapManagement.clearAllMarkers();
      return;
    }
    
    if (this.availableItineraries.length > 0 && this.selectedItineraryIndex < this.availableItineraries.length) {
      const selectedItinerary = this.availableItineraries[this.selectedItineraryIndex];
      
      // Clear any existing routes when itinerary changes
      this.mapManagement.clearAllRouteLines();
      this.mapManagement.clearAllMarkers();
      this.currentRouteInfo = null;
      
      // Show markers immediately when itinerary is selected
      this.mapManagement.showItinerarySpots(selectedItinerary, this.mapUI);
      
      // Start geofencing for the selected itinerary
      await this.geofencingService.startMonitoring(selectedItinerary.days);
      
      // Generate route information for the selected itinerary
      await this.generateRouteForItinerary(selectedItinerary);
    } else {
      this.currentRouteInfo = null;
    }
  }

  formatItineraryTitle(itinerary: any): string {
    if (!itinerary) return 'Unknown Itinerary';
    
    // Try to get a meaningful name from the itinerary
    const dayCount = itinerary.days?.length || 0;
    const spotCount = itinerary.days?.[0]?.spots?.length || 0;
    
    if (itinerary.name && itinerary.name !== `Itinerary for Unknown Date`) {
      return `${itinerary.name} (${dayCount} day${dayCount > 1 ? 's' : ''}, ${spotCount} spots)`;
    }
    
    return `Itinerary for Unknown Date (${dayCount} day${dayCount > 1 ? 's' : ''}, ${spotCount} spots)`;
  }

  async showDirectionsAndRoutes(): Promise<void> {
    if (this.availableItineraries.length === 0) {
      await this.loadAvailableItineraries();
    }
    
    if (this.availableItineraries.length > 0 && this.selectedItineraryIndex >= 0) {
      const selectedItinerary = this.availableItineraries[this.selectedItineraryIndex];
      
      // Show itinerary spots on map
      this.mapManagement.showItinerarySpots(selectedItinerary, this.mapUI);
      
      await this.generateRouteForItinerary(selectedItinerary);
    }
  }
  
  get isOnline(): boolean {
    return this.mapUtils.isOnline();
  }

  get isRealLocation(): boolean {
    return this.locationTracking.isRealLocation();
  }

  get locationStatusText(): string {
    return this.locationTracking.getLocationStatusText();
  }

  get isLocationTrackingActive(): boolean {
    return this.locationTracking.isTrackingActive();
  }

  get userLocation(): any {
    return this.locationTracking.getUserLocation();
  }

  async ngAfterViewInit(): Promise<void> {
    try {
      this.mapManagement.initMap();
      
      // Subscribe to location updates to display user marker
      this.locationSubscription = this.locationTracking.locationUpdates.subscribe(
        (location: UserLocation) => {
          this.ngZone.run(() => {
            this.updateUserMarker(location);
          });
        }
      );
      
      await this.locationTracking.startLocationTracking();
      
      await this.loadTouristSpots();
      
      // Wait a bit for map to be fully initialized
      setTimeout(() => {
        // Show tourist spots by default since selectedTab is 'spots'
        this.showTouristSpots();
      }, 500);
      
      this.setupGlobalFunctions();
      
      window.addEventListener('online', () => this.onNetworkStatusChange(true));
      window.addEventListener('offline', () => this.onNetworkStatusChange(false));
      
    } catch (error) {
      await this.showToast('Error initializing map');
    }
  }


  // ===== TEMPLATE METHODS =====

  async showCuratedRouteDetailsSheet(): Promise<void> {
    if (!this.currentRouteInfo) {
      await this.showToast('No route information available');
      return;
    }

    const modal = await this.modalCtrl.create({
      component: RouteDetailsOverlayComponent,
      componentProps: {
        routeInfo: this.currentRouteInfo,
        availableRestaurants: this.touristSpots.filter(spot => spot.eventType === 'restaurant'),
        availableHotels: this.touristSpots.filter(spot => spot.eventType === 'hotel')
      },
      backdropDismiss: true
    });
    await modal.present();
  }


  async showUserLocation(): Promise<void> {
    const userLocation = this.locationTracking.getUserLocation();
    if (userLocation) {
      this.mapManagement.centerOnLocation(userLocation.lat, userLocation.lng, 15);
    } else {
      await this.locationTracking.getCurrentLocation();
      const newLocation = this.locationTracking.getUserLocation();
      if (newLocation) {
        this.mapManagement.centerOnLocation(newLocation.lat, newLocation.lng, 15);
      }
    }
  }

  async toggleLocationTracking(): Promise<void> {
    if (this.locationTracking.isTrackingActive()) {
      await this.locationTracking.stopLocationTracking();
    } else {
      await this.locationTracking.startLocationTracking();
    }
  }

  getSegmentTitle(segment: any): string {
    if (segment.type === 'jeepney' || segment.type === 'bus') {
      return `${segment.jeepneyCode || 'Transit'} (${segment.fromName || segment.from} → ${segment.toName || segment.to})`;
    } else if (segment.type === 'walk') {
      return `Walk (${segment.fromName || segment.from} → ${segment.toName || segment.to})`;
    } else {
      return `${segment.fromName || segment.from} → ${segment.toName || segment.to}`;
    }
  }

  async showSegmentSelector(): Promise<void> {
    if (!this.currentRouteInfo || !this.currentRouteInfo.segments) {
      return;
    }

    const alert = await this.alertCtrl.create({
      header: 'Navigate to Route Segment',
      subHeader: `Select a segment to view on the map`,
      inputs: this.currentRouteInfo.segments.map((segment: any, index: number) => ({
        name: 'segment',
        type: 'radio' as const,
        label: `Segment ${index + 1}: ${this.getSegmentTitle(segment)}`,
        value: index,
        checked: index === 0
      })),
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Go to Segment',
          handler: (selectedIndex: number) => {
            this.navigateToSegment(selectedIndex);
          }
        }
      ]
    });

    await alert.present();
  }

  navigateToSegment(segmentIndex: number): void {
    if (!this.currentRouteInfo || !this.currentRouteInfo.segments || segmentIndex < 0) {
      return;
    }

    const segment = this.currentRouteInfo.segments[segmentIndex];
    if (!segment) return;

    // Try multiple ways to get segment coordinates
    let lat, lng;
    
    // Special handling for meal and accommodation segments
    if (segment.type === 'meal' || segment.type === 'accommodation') {
      const placeName = segment.from || segment.to || segment.placeName;
      
      if (placeName && typeof placeName === 'string') {
        const cleanName = placeName.replace(/🍽️|🏨|🛏️/g, '').trim();
        
        // Search in tourist spots
        const foundSpot = this.touristSpots.find(spot => 
          spot.name.toLowerCase().includes(cleanName.toLowerCase()) ||
          cleanName.toLowerCase().includes(spot.name.toLowerCase())
        );
        
        if (foundSpot && foundSpot.location) {
          lat = foundSpot.location.lat;
          lng = foundSpot.location.lng;
        }
        
        // If not found in tourist spots, try itinerary data
        if (!lat && this.availableItineraries && this.selectedItineraryIndex >= 0) {
          const currentItinerary = this.availableItineraries[this.selectedItineraryIndex];
          if (currentItinerary && currentItinerary.days) {
            currentItinerary.days.forEach((day: any) => {
              day.spots?.forEach((spot: any) => {
                if (spot.name.toLowerCase().includes(cleanName.toLowerCase()) ||
                    (spot.chosenRestaurant && spot.chosenRestaurant.name.toLowerCase().includes(cleanName.toLowerCase())) ||
                    (spot.chosenHotel && spot.chosenHotel.name.toLowerCase().includes(cleanName.toLowerCase()))) {
                  lat = spot.location?.lat;
                  lng = spot.location?.lng;
                }
              });
            });
          }
        }
      }
    }
    
    // Regular coordinate extraction for transportation segments
    if (!lat || !lng) {
      // Method 1: from.lat/lng
      if (segment.from && segment.from.lat && segment.from.lng) {
        lat = segment.from.lat;
        lng = segment.from.lng;
      }
      // Method 2: from.location.lat/lng
      else if (segment.from && segment.from.location && segment.from.location.lat && segment.from.location.lng) {
        lat = segment.from.location.lat;
        lng = segment.from.location.lng;
      }
      // Method 3: fromLocation
      else if (segment.fromLocation && segment.fromLocation.lat && segment.fromLocation.lng) {
        lat = segment.fromLocation.lat;
        lng = segment.fromLocation.lng;
      }
      // Method 4: to.lat/lng (use destination if from is missing)
      else if (segment.to && segment.to.lat && segment.to.lng) {
        lat = segment.to.lat;
        lng = segment.to.lng;
      }
      // Method 5: to.location.lat/lng
      else if (segment.to && segment.to.location && segment.to.location.lat && segment.to.location.lng) {
        lat = segment.to.location.lat;
        lng = segment.to.location.lng;
      }
      // Method 6: toLocation
      else if (segment.toLocation && segment.toLocation.lat && segment.toLocation.lng) {
        lat = segment.toLocation.lat;
        lng = segment.toLocation.lng;
      }
      // Method 7: Try to find coordinates from polyline
      else if (segment.polyline) {
        try {
          let decodedPoints: any[] = [];
          
          if (typeof segment.polyline === 'string') {
            decodedPoints = this.mapUtils.decodePolyline(segment.polyline);
          } else if (segment.polyline.points) {
            decodedPoints = this.mapUtils.decodePolyline(segment.polyline.points);
          } else if (Array.isArray(segment.polyline) && segment.polyline.length > 0) {
            // Already decoded array from OSRM
            lat = segment.polyline[0].lat;
            lng = segment.polyline[0].lng;
          }
          
          if (!lat && decodedPoints.length > 0) {
            lat = decodedPoints[0][0];
            lng = decodedPoints[0][1];
          }
        } catch (error) {
          // Silently handle polyline decode errors
        }
      }
    }

    if (lat && lng && lat !== 0 && lng !== 0) {
      // Pan to the segment location with zoom
      const map = this.mapManagement.getMap();
      if (map) {
        map.setView([lat, lng], 16, {
          animate: true,
          duration: 1
        });
      }

      // Show toast with segment info
      this.showToast(`📍 Navigated to Segment ${segmentIndex + 1}: ${this.getSegmentTitle(segment)}`);
    } else {
      this.showToast(`⚠️ Could not find coordinates for Segment ${segmentIndex + 1}`);
    }
  }

  async navigateNextItineraryStep(): Promise<void> {
    // Implementation for navigation
  }

  async showStageRouteOptions(stageIndex: number): Promise<void> {
    if (this.selectedStageForOptions === stageIndex) {
      this.selectedStageForOptions = -1;
      return;
    }
    
    this.selectedStageForOptions = stageIndex;
    
    try {
      const selectedItinerary = this.availableItineraries[this.selectedItineraryIndex];
      if (!selectedItinerary || !selectedItinerary.spots[stageIndex]) return;
      
      const userLocation = await this.locationTracking.getLocationWithFallback();
      const destination = selectedItinerary.spots[stageIndex];
      
      const routes = await this.jeepneyRouting.findMultipleJeepneyRoutesWithWaypoints(
        userLocation,
        destination
      );
      
      this.stageRouteOptions = routes;
      
    } catch (error) {
      await this.showToast('Error generating route options');
    }
  }

  async selectStageRoute(stageIndex: number, routeIndex: number): Promise<void> {
    if (stageIndex === -1 || !this.stageRouteOptions[routeIndex]) return;
    
    const selectedRoute = this.stageRouteOptions[routeIndex];
    
    if (this.currentRouteInfo) {
      this.currentRouteInfo.segments = selectedRoute.segments;
      this.currentRouteInfo.totalDuration = selectedRoute.totalDuration;
      this.currentRouteInfo.totalDistance = selectedRoute.totalDistance;
      this.currentRouteInfo.summary = selectedRoute.summary;
      
      this.displayRouteOnMap(this.currentRouteInfo);
      this.showToast('Route updated');
    }
  }

  hasJeepneySegments(route: any): boolean {
    return route?.segments?.some((segment: any) => segment.type === 'jeepney') || false;
  }

  formatDuration(seconds: number): string {
    return this.mapUtils.formatDuration(seconds);
  }

  selectRoute(routeIndex: number): void {
    if (this.currentRouteInfo && this.currentRouteInfo.suggestedRoutes) {
      this.currentRouteInfo.selectedRouteIndex = routeIndex;
      const selectedRoute = this.currentRouteInfo.suggestedRoutes[routeIndex];
      this.currentRouteInfo.segments = selectedRoute.segments;
      this.currentRouteInfo.totalDuration = selectedRoute.totalDuration;
      this.currentRouteInfo.totalDistance = selectedRoute.totalDistance;
      this.currentRouteInfo.summary = selectedRoute.summary;
      
      this.displayRouteOnMap(this.currentRouteInfo);
    }
  }

  toggleMapType(): void {
    this.selectedTile = this.selectedTile === 'osm' ? 'satellite' : 'osm';
    this.mapManagement.changeTileLayer(this.selectedTile);
  }

  toggleFullscreen(): void {
    this.isFullscreen = !this.isFullscreen;
  }




  async generateRouteForItinerary(itinerary: any): Promise<void> {
    try {
      this.isGeneratingRoute = true;
      
      // Show loading modal
      await this.showLoadingModal('🚀 Starting route generation...');
      
      const userLocation = await this.locationTracking.getLocationWithFallback();
      
      this.currentRouteInfo = await this.routePlanning.generateRouteInfo(
        itinerary,
        userLocation,
        (message: string) => this.updateLoadingProgress(message)
      );
      
      // Ensure segments have proper stage and estimatedTime properties
      if (this.currentRouteInfo && this.currentRouteInfo.segments) {
        this.currentRouteInfo.segments.forEach((segment: any, index: number) => {
          segment.stage = index + 1;
          segment.estimatedTime = this.mapUtils.formatDuration(segment.duration);
        });
      }
      
      // Dismiss loading modal
      await this.dismissLoadingModal();
      
      // Display route on map
      this.displayRouteOnMap(this.currentRouteInfo);
      
      // Show success message
      await this.showToast('✅ Route generation completed!');
      
    } catch (error) {
      await this.dismissLoadingModal();
      await this.showToast('❌ Error generating routes. Please try again.');
    } finally {
      this.isGeneratingRoute = false;
      this.loadingProgress = '';
    }
  }

  displayRouteOnMap(routeInfo: any): void {
    if (!routeInfo || !routeInfo.segments) {
      return;
    }
    
    try {
      this.mapManagement.clearAllRouteLines();
      
      routeInfo.segments.forEach((segment: any) => {
        // Draw segment based on type
        if ((segment.type === 'jeepney' || segment.type === 'bus') && segment.jeepneyCode) {
          // Draw jeepney/bus route with code
          this.drawJeepneySegment(segment);
        } else if (segment.type === 'walk') {
          // Draw walking segment
          this.drawWalkingSegment(segment);
        }
      });
      
    } catch (error) {
      // Silently handle display errors
    }
  }
  
  private drawJeepneySegment(segment: any): void {
    if (!segment.from || !segment.to) return;
    
    const fromLat = segment.from.lat || segment.from.location?.lat;
    const fromLng = segment.from.lng || segment.from.location?.lng;
    const toLat = segment.to.lat || segment.to.location?.lat;
    const toLng = segment.to.lng || segment.to.location?.lng;
    
    if (!fromLat || !fromLng || !toLat || !toLng) return;
    
    // Check if we have polyline data from Google Maps
    let polylinePoints: [number, number][] = [];
    
    if (segment.polyline) {
      try {
        // Handle different polyline formats
        if (typeof segment.polyline === 'string') {
          // Encoded polyline string from Google Maps
          polylinePoints = this.mapUtils.decodePolyline(segment.polyline);
        } else if (segment.polyline.points) {
          // Polyline object with points property
          polylinePoints = this.mapUtils.decodePolyline(segment.polyline.points);
        } else if (Array.isArray(segment.polyline)) {
          // Already decoded array of {lat, lng} from OSRM
          polylinePoints = segment.polyline.map((p: any) => [p.lat, p.lng]);
        }
      } catch (error) {
        polylinePoints = [[fromLat, fromLng], [toLat, toLng]];
      }
    } else {
      polylinePoints = [[fromLat, fromLng], [toLat, toLng]];
    }
    
    // Draw jeepney route line
    const jeepneyLine = L.polyline(polylinePoints, {
      color: '#FF5722',
      weight: 6,
      opacity: 0.8,
      dashArray: '0'
    });
    
    this.mapManagement.addRouteLine(jeepneyLine);
    
    // Add jeepney code marker at midpoint
    const midIndex = Math.floor(polylinePoints.length / 2);
    const midPoint = polylinePoints[midIndex];
    
    const jeepneyMarker = L.marker([midPoint[0], midPoint[1]], {
      icon: L.divIcon({
        html: `<div style="
          background: #FF5722;
          color: white;
          border: 2px solid white;
          border-radius: 8px;
          padding: 4px 8px;
          font-size: 14px;
          font-weight: bold;
          box-shadow: 0 2px 6px rgba(0,0,0,0.4);
          text-align: center;
        ">${segment.jeepneyCode || '🚌'}</div>`,
        iconSize: [50, 30],
        iconAnchor: [25, 15]
      })
    });
    
    jeepneyMarker.bindPopup(`
      <div style="text-align: center;">
        <strong>🚌 Jeepney ${segment.jeepneyCode}</strong><br>
        <small>${segment.description || 'Jeepney Route'}</small><br>
        <small>Distance: ${this.mapUtils.formatDistance(segment.distance || 0)}</small><br>
        <small>Duration: ${this.mapUtils.formatDuration(segment.duration || 0)}</small>
      </div>
    `);
    
    this.mapManagement.addRouteMarker(jeepneyMarker);
  }
  
  private drawWalkingSegment(segment: any): void {
    if (!segment.from || !segment.to) return;
    
    const fromLat = segment.from.lat || segment.from.location?.lat;
    const fromLng = segment.from.lng || segment.from.location?.lng;
    const toLat = segment.to.lat || segment.to.location?.lat;
    const toLng = segment.to.lng || segment.to.location?.lng;
    
    if (!fromLat || !fromLng || !toLat || !toLng) return;
    
    // Check if we have polyline data
    let polylinePoints: [number, number][] = [];
    
    if (segment.polyline) {
      try {
        // Handle different polyline formats
        if (typeof segment.polyline === 'string') {
          // Encoded polyline string from Google Maps
          polylinePoints = this.mapUtils.decodePolyline(segment.polyline);
        } else if (segment.polyline.points) {
          // Polyline object with points property
          polylinePoints = this.mapUtils.decodePolyline(segment.polyline.points);
        } else if (Array.isArray(segment.polyline)) {
          // Already decoded array of {lat, lng} from OSRM
          polylinePoints = segment.polyline.map((p: any) => [p.lat, p.lng]);
        }
      } catch (error) {
        polylinePoints = [[fromLat, fromLng], [toLat, toLng]];
      }
    } else {
      // No polyline - draw straight line
      polylinePoints = [[fromLat, fromLng], [toLat, toLng]];
    }
    
    // Draw walking route line
    const walkLine = L.polyline(polylinePoints, {
      color: '#4CAF50',
      weight: 5,
      opacity: 0.8,
      dashArray: '15, 10'
    });
    
    this.mapManagement.addRouteLine(walkLine);
    
    // Add walking marker at midpoint (only if we have multiple points)
    if (polylinePoints.length > 1) {
      const midIndex = Math.floor(polylinePoints.length / 2);
      const midPoint = polylinePoints[midIndex];
      
      const walkMarker = L.marker([midPoint[0], midPoint[1]], {
        icon: L.divIcon({
          html: `<div style="
            background: #4CAF50;
            color: white;
            border: 1px solid white;
            border-radius: 4px;
            padding: 2px 4px;
            font-size: 8px;
            font-weight: bold;
            box-shadow: 0 1px 2px rgba(0,0,0,0.2);
            text-align: center;
          ">🚶</div>`,
          iconSize: [35, 15],
          iconAnchor: [17, 7]
        })
      });
      
      walkMarker.bindPopup(`
        <div style="text-align: center;">
          <strong>🚶 Walking</strong><br>
          <small>${segment.description || 'Walk to destination'}</small><br>
          <small>Distance: ${this.mapUtils.formatDistance(segment.distance || 0)}</small><br>
          <small>Duration: ${this.mapUtils.formatDuration(segment.duration || 0)}</small>
        </div>
      `);
      
      this.mapManagement.addRouteMarker(walkMarker);
    }
  }

  async loadTouristSpots(): Promise<void> {
    try {
      const cached = localStorage.getItem('tourist_spots_cache');
      if (cached) {
        this.touristSpots = JSON.parse(cached);
        return;
      }
      
      const spotsSnapshot = await this.firestore.collection('tourist_spots').get().toPromise();
      this.touristSpots = spotsSnapshot?.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as any)
      })) || [];
      
      localStorage.setItem('tourist_spots_cache', JSON.stringify(this.touristSpots));
      
    } catch (error) {
      await this.showToast('Error loading tourist spots');
    }
  }

  async showTouristSpots(): Promise<void> {
    this.mapManagement.showTouristSpots(this.touristSpots, this.mapUI);
  }


  setupGlobalFunctions(): void {
    (window as any).openSpotDetails = (spotName: string) => {
      const spot = this.touristSpots.find(s => s.name === spotName);
      if (spot) {
        this.openSpotSheet(spot);
      }
    };
  }

  /**
   * Show loading modal with progress message
   */
  private async showLoadingModal(message: string): Promise<void> {
    if (this.loadingModal) {
      await this.dismissLoadingModal(); // Close existing modal first
    }

    this.loadingProgress = message;
    
    // Create a proper Ionic loading controller
    this.loadingModal = await this.loadingCtrl.create({
      message: message,
      spinner: 'crescent',
      translucent: true,
      cssClass: 'route-loading-modal'
    });
    
    await this.loadingModal.present();
  }

  /**
   * Update loading modal progress message
   */
  private async updateLoadingProgress(message: string): Promise<void> {
    this.loadingProgress = message;
    
    // Update the loading message
    if (this.loadingModal) {
      await this.dismissLoadingModal();
      await this.showLoadingModal(message);
    }
  }

  /**
   * Dismiss loading modal
   */
  private async dismissLoadingModal(): Promise<void> {
    if (this.loadingModal) {
      try {
        await this.loadingModal.dismiss();
      } catch (error) {
        // Silently handle already dismissed modal
      }
      this.loadingModal = null;
    }
  }

  async openSpotSheet(spot: any): Promise<void> {
    const modal = await this.modalCtrl.create({
      component: TouristSpotSheetComponent,
      componentProps: { spot },
      backdropDismiss: true
    });
    await modal.present();
  }

  private async showToast(message: string): Promise<void> {
    const toast = await this.toastCtrl.create({
      message: message,
      duration: 3000,
      position: 'bottom'
    });
    await toast.present();
  }

  private onNetworkStatusChange(isOnline: boolean): void {
    if (isOnline) {
      this.refreshTouristSpots();
    } else {
      this.showToast('You are offline. Using cached data.');
    }
  }

  private async refreshTouristSpots(): Promise<void> {
    try {
      localStorage.removeItem('tourist_spots_cache');
      await this.loadTouristSpots();
      if (this.selectedTab === 'spots') {
        this.showTouristSpots();
      }
    } catch (error) {
      // Silently handle error
    }
  }

  /**
   * Update or create user location marker on the map
   */
  private updateUserMarker(location: UserLocation): void {
    if (!location) {
      return;
    }

    // Remove existing user marker if present
    if (this.userMarker) {
      this.mapManagement.getMap()?.removeLayer(this.userMarker);
    }

    // Create new user marker using MapUIService
    this.userMarker = this.mapUI.createUserLocationMarker(
      location.lat,
      location.lng,
      location.isReal
    );

    // Add marker to map
    const map = this.mapManagement.getMap();
    if (map) {
      this.userMarker.addTo(map);

      // Add popup to marker
      const popupContent = `
        <div style="min-width: 150px;">
          <h4 style="margin: 0 0 8px 0; color: #333;">
            ${location.isReal ? '📍 Your Location (GPS)' : '📍 Default Location'}
          </h4>
          ${location.accuracy ? `<p style="margin: 4px 0; color: #666;">Accuracy: ${Math.round(location.accuracy)}m</p>` : ''}
        </div>
      `;
      this.userMarker.bindPopup(popupContent);
    }
  }

  ngOnDestroy(): void {
    // Unsubscribe from location updates
    if (this.locationSubscription) {
      this.locationSubscription.unsubscribe();
    }
    
    this.locationTracking.stopLocationTracking();
    
    this.mapManagement.removeMap();
    
    window.removeEventListener('online', () => this.onNetworkStatusChange(true));
    window.removeEventListener('offline', () => this.onNetworkStatusChange(false));
  }
}
