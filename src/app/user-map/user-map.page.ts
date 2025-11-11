import { Component, AfterViewInit, OnDestroy, NgZone, ComponentFactoryResolver, ViewContainerRef, Injector } from '@angular/core';
import { NavController, ToastController, ModalController, LoadingController, AlertController } from '@ionic/angular';
import { AngularFireAuth } from '@angular/fire/compat/auth';
import { AngularFirestore } from '@angular/fire/compat/firestore';
import { HttpClient } from '@angular/common/http';
import * as L from 'leaflet';
import { TouristSpotSheetComponent } from '../components/tourist-spot-sheet/tourist-spot-sheet.component';
import { Geolocation } from '@capacitor/geolocation';
import { App } from '@capacitor/app';
import { DaySpotPickerComponent } from '../components/day-spot-picker/day-spot-picker.component';
import { environment } from '../../environments/environment';
import { ItineraryControlsModalComponent } from '../modals/itinerary-controls-modal/itinerary-controls-modal.component';
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
import { ItinerarySessionService, ItinerarySession } from '../services/itinerary-session.service';
import { ModalCommunicationService } from '../services/modal-communication.service';


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
  filteredSpots: any[] = [];
  showSearchResults: boolean = false;
  public bucketService: BucketService;
  private routeLine?: L.Polyline;
  private routeLines: (L.Polyline | L.Marker)[] = [];
  
  // Pin system for route markers
  private routeMarkers: L.Marker[] = [];
  itinerary: ItineraryDay[] = [];

  // Add missing properties for template
  selectedTile: string = 'osm';
  selectedItineraryIndex: number = -1; // Start with no selection
  availableItineraries: any[] = [];
  currentRouteInfo: any = null;
  stageRouteOptions: any[] = []; // Store multiple route options for each stage
  selectedStageForOptions: number = -1; // Track which stage's options are being shown
  selectedSegmentIndex: number = -1; // Track selected route segment for navigation
  currentSegmentIndex: number = 0; // Track which segment is currently being displayed
  
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
  
  // Stage notification visibility
  showStageNotification: boolean = true;

  // Subscriptions
  private locationSubscription?: Subscription;
  private appStateSubscription?: any;
  private spotsSubscription?: Subscription;

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
    private mapUtils: MapUtilitiesService,
    private itinerarySession: ItinerarySessionService,
    private modalCommunication: ModalCommunicationService
  ) {
    this.bucketService = bucketService;
  }

  // Method to update map display based on current state
  async updateMapDisplay(): Promise<void> {
    this.mapManagement.clearAllMarkers();
    this.mapManagement.clearRouteMarkers();
    this.mapManagement.clearAllRouteLines();
    
    this.mapManagement.invalidateSize();
    
    if (this.selectedItineraryIndex >= 0) {
      // Show itinerary spots and routes
      await this.showDirectionsAndRoutes();
    } else {
      // Show all tourist spots
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
    // Ensure we have itineraries loaded
    if (this.availableItineraries.length === 0) {
      console.log('No itineraries available, loading them first...');
      await this.loadAvailableItineraries();
      await this.loadJeepneyRoutes();
    }
    
    if (this.selectedItineraryIndex < 0 || this.selectedItineraryIndex >= this.availableItineraries.length) {
      // Clear any existing route data when no itinerary is selected
      this.currentRouteInfo = null;
      this.mapManagement.clearAllRouteLines();
      this.mapManagement.clearAllMarkers();
      // Update map to show all tourist spots
      this.updateMapDisplay();
      return;
    }
    
    if (this.availableItineraries.length > 0 && this.selectedItineraryIndex < this.availableItineraries.length) {
      const selectedItinerary = this.availableItineraries[this.selectedItineraryIndex];
      
      try {
        // Start or update itinerary session
        this.itinerarySession.startSession(this.selectedItineraryIndex, selectedItinerary);
        
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
      } catch (error) {
        console.error('Error loading itinerary routes:', error);
        this.showToast('Error loading itinerary routes');
        // Clear the failed session
        this.itinerarySession.endSession();
        this.selectedItineraryIndex = -1;
        this.currentSegmentIndex = 0;
        this.updateMapDisplay();
      }
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
      
      // Check for existing itinerary session
      await this.checkForExistingSession();
      
      // Subscribe to modal communication service
      this.modalCommunication.itinerarySelection$.subscribe((index: number | null) => {
        if (index !== null) {
          console.log('Received itinerary selection from service:', index);
          this.selectedItineraryIndex = index;
          this.loadItineraryRoutes();
        }
      });
      
      // Listen for app state changes (pause/background)
      this.appStateSubscription = App.addListener('appStateChange', (state) => {
        console.log('App state changed. isActive:', state.isActive);
        
        if (!state.isActive) {
          // App is going to background or being closed
          console.log('App going to background - stopping itinerary if active');
          if (this.selectedItineraryIndex >= 0 && this.currentRouteInfo) {
            this.stopItinerary();
          }
        }
      });
      
      // Wait a bit for map to be fully initialized
      setTimeout(() => {
        // Show tourist spots by default (no itinerary selected)
        this.updateMapDisplay();
      }, 500);
      
      this.setupGlobalFunctions();
      
      window.addEventListener('online', () => this.onNetworkStatusChange(true));
      window.addEventListener('offline', () => this.onNetworkStatusChange(false));
      
      // Listen for browser close/refresh (for web version)
      window.addEventListener('beforeunload', () => {
        console.log('Browser closing/refreshing - stopping itinerary if active');
        if (this.selectedItineraryIndex >= 0 && this.currentRouteInfo) {
          this.stopItinerary();
        }
      });
      
    } catch (error) {
      await this.showToast('Error initializing map');
    }
  }


  // /////////////////////////////////////SESSION MANAGEMENT///////////////////////////////////////////////////

  async checkForExistingSession(): Promise<void> {
    const currentSession = this.itinerarySession.getCurrentSession();
    if (currentSession && currentSession.isActive) {
      console.log('Resuming existing session:', currentSession);
      
      try {
        // Add timeout to prevent infinite loading
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(() => reject(new Error('Session resumption timeout')), 10000); // 10 second timeout
        });
        
        const resumptionPromise = this.resumeSessionWithTimeout(currentSession);
        
        await Promise.race([resumptionPromise, timeoutPromise]);
        
      } catch (error) {
        console.error('Error resuming session:', error);
        // Clear the invalid session
        this.itinerarySession.endSession();
        this.selectedItineraryIndex = -1;
        this.currentSegmentIndex = 0;
        this.updateMapDisplay();
        this.showToast(' Could not resume previous session');
      }
    }
  }

  private async resumeSessionWithTimeout(currentSession: any): Promise<void> {
    // First, ensure we have the itineraries loaded
    if (this.availableItineraries.length === 0) {
      console.log('Loading itineraries for session resumption...');
      await this.loadAvailableItineraries();
      await this.loadJeepneyRoutes();
    }
    
    // Verify the session is still valid
    if (currentSession.selectedItineraryIndex >= 0 && currentSession.selectedItineraryIndex < this.availableItineraries.length) {
      // Restore session state
      this.selectedItineraryIndex = currentSession.selectedItineraryIndex;
      this.currentSegmentIndex = currentSession.currentSegmentIndex;
      
      // Load the itinerary routes
      await this.loadItineraryRoutes();
      
      // Show a toast about session resumption
      this.showToast(`🔄 Resumed session: ${this.formatItineraryTitle(currentSession.selectedItinerary)}`);
    } else {
      console.log('Session is invalid, clearing it');
      this.itinerarySession.endSession();
      this.selectedItineraryIndex = -1;
      this.currentSegmentIndex = 0;
      this.updateMapDisplay();
    }
  }

  /////////////////////////////////////////////TEMPLATE METHODS ///////////////////////////////////

  async showItineraryControlsModal(): Promise<void> {
    // Load itineraries if not already loaded
    if (this.availableItineraries.length === 0) {
      console.log('Loading itineraries...');
      await this.loadAvailableItineraries();
      await this.loadJeepneyRoutes();
    }
    
    console.log('Available itineraries:', this.availableItineraries.length);
    
    const modal = await this.modalCtrl.create({
      component: ItineraryControlsModalComponent,
      componentProps: {
        availableItineraries: this.availableItineraries,
        selectedItineraryIndex: this.selectedItineraryIndex,
        currentRouteInfo: this.currentRouteInfo,
        currentSegmentIndex: this.currentSegmentIndex,
        isLocationTrackingActive: this.isLocationTrackingActive,
        isRealLocation: this.isRealLocation,
        locationStatusText: this.locationStatusText,
        isLoadingJeepneyRoutes: this.isLoadingJeepneyRoutes,
        isGeneratingRoute: this.isGeneratingRoute
      },
      backdropDismiss: true,
      showBackdrop: true,
      cssClass: 'itinerary-controls-modal',
      breakpoints: [0, 0.3, 0.7, 0.95],
      initialBreakpoint: 0.7
    });

    // Handle events from the modal
    modal.onDidDismiss().then((result) => {
      if (result.data) {
        // Handle any data returned from modal if needed
        if (result.data.action === 'showUserLocation') {
          this.showUserLocation();
        } else if (result.data.action === 'toggleLocationTracking') {
          this.toggleLocationTracking();
        } else if (result.data.action === 'nextSegment') {
          this.nextSegment();
        } else if (result.data.action === 'showSegmentSelector') {
          this.showSegmentSelector();
        } else if (result.data.action === 'stopItinerary') {
          this.stopItinerary();
        } else if (result.data.action === 'cancelRouteGeneration') {
          this.cancelRouteGeneration();
        }
      }
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

  getCurrentStageDescription(): string {
    if (!this.currentRouteInfo || !this.currentRouteInfo.segments || this.currentSegmentIndex < 0) {
      return 'No stage selected';
    }
    
    const segment = this.currentRouteInfo.segments[this.currentSegmentIndex];
    if (!segment) {
      return 'Invalid stage';
    }
    
    return this.getSegmentTitle(segment);
  }


  stopItinerary(): void {
    console.log('Stopping itinerary...');
    
    // Clear route visualization
    this.mapManagement.clearAllRouteLines();
    this.mapManagement.clearRouteMarkers();
    
    // Reset route state
    this.currentRouteInfo = null;
    this.selectedItineraryIndex = -1;
    this.currentSegmentIndex = 0;
    
    // Reset notification visibility
    this.showStageNotification = true;
    
    // End session
    this.itinerarySession.endSession();
    
    // Clear modal communication
    this.modalCommunication.clearSelection();
    
    // Update map to show all tourist spots
    this.updateMapDisplay();
    
    // Show confirmation
    this.showToast('Itinerary stopped');
    
    console.log('Itinerary stopped successfully');
  }

  cancelRouteGeneration(): void {
    console.log('Cancelling route generation...');
    
    // Reset loading states
    this.isLoadingJeepneyRoutes = false;
    this.isGeneratingRoute = false;
    
    // Reset route state
    this.currentRouteInfo = null;
    this.selectedItineraryIndex = -1;
    this.currentSegmentIndex = 0;
    
    // Reset notification visibility
    this.showStageNotification = true;
    
    // End session
    this.itinerarySession.endSession();
    
    // Clear modal communication
    this.modalCommunication.clearSelection();
    
    // Update map to show all tourist spots
    this.updateMapDisplay();
    
    // Show confirmation
    this.showToast('Route generation cancelled');
    
    console.log('Route generation cancelled successfully');
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

      // Stage info is shown in the persistent yellow banner
    } else {
      this.showToast(`Could not find coordinates for Segment ${segmentIndex + 1}`);
    }
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

  nextSegment(): void {
    if (!this.currentRouteInfo || !this.currentRouteInfo.segments) {
      return;
    }
    
    // Move to next segment (loop back to first when reaching the end)
    this.currentSegmentIndex = (this.currentSegmentIndex + 1) % this.currentRouteInfo.segments.length;
    
    // Update session with new current segment
    this.itinerarySession.updateCurrentSegment(this.currentSegmentIndex);
    
    // Display only the current segment
    this.displayCurrentSegment();
    
    // Stage info is now shown in the yellow banner at the top
  }

  previousSegment(): void {
    if (!this.currentRouteInfo || !this.currentRouteInfo.segments) {
      return;
    }
    
    // Move to previous segment (loop to last when at the beginning)
    this.currentSegmentIndex = this.currentSegmentIndex > 0 
      ? this.currentSegmentIndex - 1 
      : this.currentRouteInfo.segments.length - 1;
    
    // Update session with new current segment
    this.itinerarySession.updateCurrentSegment(this.currentSegmentIndex);
    
    // Display only the current segment
    this.displayCurrentSegment();
    
    // Stage info is now shown in the yellow banner at the top
  }

  displayCurrentSegment(): void {
    if (!this.currentRouteInfo || !this.currentRouteInfo.segments) {
      return;
    }
    
    try {
      // Clear all existing route lines
      this.mapManagement.clearAllRouteLines();
      
      // Get the current segment
      const segment = this.currentRouteInfo.segments[this.currentSegmentIndex];
      
      if (!segment) return;
      
      // Draw only the current segment based on type
      if ((segment.type === 'jeepney' || segment.type === 'bus') && segment.jeepneyCode) {
        this.drawJeepneySegment(segment);
      } else if (segment.type === 'walk') {
        this.drawWalkingSegment(segment);
      }
      
      // Center map on the segment
      this.navigateToSegment(this.currentSegmentIndex);
      
    } catch (error) {
      // Silently handle display errors
    }
  }




  async generateRouteForItinerary(itinerary: any): Promise<void> {
    try {
      this.isGeneratingRoute = true;
      
      // Show loading modal
      await this.showLoadingModal('Starting route generation...');
      
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
      await this.showToast('Route generation completed!');
      
    } catch (error) {
      await this.dismissLoadingModal();
      await this.showToast('Error generating routes. Please try again.');
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
      // Reset to first segment when displaying a new route
      this.currentSegmentIndex = 0;
      
      // Display only the first segment
      this.displayCurrentSegment();
      
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
        <strong>Jeepney ${segment.jeepneyCode}</strong><br>
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
          <strong>Walking</strong><br>
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
      if (cached && !this.touristSpots.length) {
        this.touristSpots = JSON.parse(cached);
      }

      if (this.spotsSubscription) {
        this.spotsSubscription.unsubscribe();
      }

      this.spotsSubscription = this.firestore
        .collection('tourist_spots')
        .valueChanges({ idField: 'id' })
        .subscribe({
          next: (spots) => {
            this.ngZone.run(() => {
              this.touristSpots = (spots || []) as any[];
              localStorage.setItem('tourist_spots_cache', JSON.stringify(this.touristSpots));

              if (this.selectedItineraryIndex < 0) {
                this.updateMapDisplay();
              } else if (
                this.selectedItineraryIndex >= 0 &&
                this.availableItineraries[this.selectedItineraryIndex]
              ) {
                this.mapManagement.showItinerarySpots(
                  this.availableItineraries[this.selectedItineraryIndex],
                  this.mapUI
                );
              }
            });
          },
          error: async () => {
            const saved = localStorage.getItem('tourist_spots_cache');
            if (saved) {
              this.touristSpots = JSON.parse(saved);
              if (this.selectedItineraryIndex < 0) {
                this.updateMapDisplay();
              }
            }
            await this.showToast('Error syncing spots; showing cached data');
          },
        });
    } catch (error) {
      const cached = localStorage.getItem('tourist_spots_cache');
      if (cached) {
        this.touristSpots = JSON.parse(cached);
        if (this.selectedItineraryIndex < 0) {
          this.updateMapDisplay();
        }
      }
      await this.showToast('Error initializing tourist spots');
    }
  }

  async showTouristSpots(): Promise<void> {
    this.mapManagement.showTouristSpots(this.touristSpots, this.mapUI);
  }

  /**
   * Filter tourist spots based on search query
   */
  onSearchChange(): void {
    const query = this.searchQuery.trim().toLowerCase();
    
    if (query.length === 0) {
      this.filteredSpots = [];
      this.showSearchResults = false;
      return;
    }
    
    // Filter spots that match the search query
    this.filteredSpots = this.touristSpots.filter(spot => 
      spot.name.toLowerCase().includes(query) ||
      spot.description?.toLowerCase().includes(query) ||
      spot.location_name?.toLowerCase().includes(query) ||
      spot.eventType?.toLowerCase().includes(query)
    ).slice(0, 8); // Limit to 8 results for better UX
    
    this.showSearchResults = this.filteredSpots.length > 0;
  }

  /**
   * Navigate to selected spot from search
   */
  selectSearchResult(spot: any): void {
    if (!spot || !spot.location) {
      this.showToast('Location not available for this spot');
      return;
    }
    
    // Clear search
    this.searchQuery = '';
    this.filteredSpots = [];
    this.showSearchResults = false;
    
    // Center map on the spot
    this.mapManagement.centerOnLocation(spot.location.lat, spot.location.lng, 16);
    
    // Open spot details sheet
    this.openSpotSheet(spot);
    
    // Show toast
    this.showToast(`📍 ${spot.name}`);
  }

  /**
   * Clear search results
   */
  clearSearch(): void {
    this.searchQuery = '';
    this.filteredSpots = [];
    this.showSearchResults = false;
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
            ${location.isReal ? 'Your Location (GPS)' : 'Default Location'}
          </h4>
          ${location.accuracy ? `<p style="margin: 4px 0; color: #666;">Accuracy: ${Math.round(location.accuracy)}m</p>` : ''}
        </div>
      `;
      this.userMarker.bindPopup(popupContent);
    }
  }

  ngOnDestroy(): void {
    // Stop itinerary if active
    if (this.selectedItineraryIndex >= 0 && this.currentRouteInfo) {
      console.log('Component destroying - stopping active itinerary');
      this.stopItinerary();
    }
    
    // Unsubscribe from location updates
    if (this.locationSubscription) {
      this.locationSubscription.unsubscribe();
    }
    
    if (this.spotsSubscription) {
      this.spotsSubscription.unsubscribe();
    }
    
    // Remove app state listener
    if (this.appStateSubscription) {
      this.appStateSubscription.remove();
    }
    
    this.locationTracking.stopLocationTracking();
    
    this.mapManagement.removeMap();
    
    window.removeEventListener('online', () => this.onNetworkStatusChange(true));
    window.removeEventListener('offline', () => this.onNetworkStatusChange(false));
    window.removeEventListener('beforeunload', () => {});
  }
}
