import { Component, AfterViewInit, OnDestroy, NgZone, ComponentFactoryResolver, ViewContainerRef, Injector } from '@angular/core';
import { NavController, ToastController, ModalController, LoadingController, AlertController } from '@ionic/angular';
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
import { BudgetService } from '../services/budget.service';
import { GeofencingService } from '../services/geofencing.service';

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
  isGeneratingRoute: boolean = false;
  isLoadingJeepneyRoutes: boolean = false;
  
  // Location tracking
  private locationWatcher?: any;
  private isLocationTracking: boolean = false;
  private locationUpdateInterval: number = 10000; // Update every 10 seconds
  
  // Jeepney routes loaded from Firebase
  jeepneyRoutes: any[] = [];
  
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
    private loadingCtrl: LoadingController,
    private alertCtrl: AlertController,
    private directionsService: DirectionsService,
    private apiTracker: ApiTrackerService,
    private itineraryService: ItineraryService,
    private calendarService: CalendarService,
    private componentFactoryResolver: ComponentFactoryResolver,
    private viewContainerRef: ViewContainerRef,
    private injector: Injector,
    private badgeService: BadgeService,
    private budgetService: BudgetService,
    private geofencingService: GeofencingService,
    
    private mapManagement: MapManagementService,
    private routePlanning: RoutePlanningService,
    private jeepneyRouting: JeepneyRoutingService,
    private locationTracking: LocationTrackingService,
    private mapUI: MapUIService,
    private mapUtils: MapUtilitiesService
  ) {
    this.bucketService = bucketService;
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
      console.error('Error in ngAfterViewInit:', error);
      await this.showToast('Error initializing map');
    }
  }

  async onTabChange(): Promise<void> {
    this.mapManagement.clearAllMarkers();
    this.mapManagement.clearRouteMarkers();
    this.mapManagement.clearAllRouteLines();
    
    this.mapManagement.invalidateSize();
    
    if (this.selectedTab === 'directions') {
      await this.loadAvailableItineraries();
      await this.loadJeepneyRoutes();
      await this.showDirectionsAndRoutes();
    } else if (this.selectedTab === 'spots') {
      this.showTouristSpots();
    }
  }

  onTileChange(): void {
    this.mapManagement.changeTileLayer(this.selectedTile);
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

  async loadItineraryRoutes(): Promise<void> {
    // Load itinerary routes from calendar service
    try {
      const events = await this.calendarService.loadItineraryEvents();
      
      if (events && events.length > 0) {
        const itineraries = this.mapUtils.groupEventsIntoItineraries(events);
        this.availableItineraries = itineraries;
      } else {
        this.availableItineraries = [];
      }
    } catch (error) {
      console.error('Error loading itinerary routes:', error);
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

  async showSegmentSelector(): Promise<void> {
    // Implementation for segment selector
    console.log('Show segment selector');
  }

  async navigateNextItineraryStep(): Promise<void> {
    // Implementation for navigation
    console.log('Navigate next step');
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
      console.error('Error generating route options:', error);
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

  // ===== CORE METHODS =====

  async loadAvailableItineraries(): Promise<void> {
    try {
      console.log('📅 Loading available itineraries...');
      
      // Load only active (non-completed) itineraries for the dropdown
      const events = await this.calendarService.loadItineraryEvents();
      
      if (events && events.length > 0) {
        const itineraries = this.mapUtils.groupEventsIntoItineraries(events);
        
        if (itineraries.length > 0) {
          this.availableItineraries = itineraries;
          console.log('Loaded itineraries:', this.availableItineraries.length);
        } else {
          this.availableItineraries = [];
          console.log('No itineraries found');
        }
      } else {
        this.availableItineraries = [];
        console.log('No events found');
      }
    } catch (error) {
      console.error('Error loading itinerary data:', error);
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
      console.error('Error loading jeepney routes:', error);
    } finally {
      this.isLoadingJeepneyRoutes = false;
    }
  }

  async showDirectionsAndRoutes(): Promise<void> {
    if (this.availableItineraries.length === 0) {
      await this.loadAvailableItineraries();
    }
    
    if (this.availableItineraries.length > 0 && this.selectedItineraryIndex >= 0) {
      const selectedItinerary = this.availableItineraries[this.selectedItineraryIndex];
      await this.generateRouteForItinerary(selectedItinerary);
    }
  }

  async generateRouteForItinerary(itinerary: any): Promise<void> {
    try {
      this.isGeneratingRoute = true;
      this.loadingProgress = 'Generating route...';
      
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
      
      this.displayRouteOnMap(this.currentRouteInfo);
      
    } catch (error) {
      console.error('Error generating route:', error);
      await this.showToast('Error generating route');
    } finally {
      this.isGeneratingRoute = false;
      this.loadingProgress = '';
    }
  }

  displayRouteOnMap(routeInfo: any): void {
    try {
      this.mapManagement.clearAllRouteLines();
      
      for (const segment of routeInfo.segments) {
        if (segment.polyline) {
          const coordinates = this.mapUtils.decodePolyline(segment.polyline);
          const polyline = L.polyline(coordinates, {
            color: segment.type === 'walk' ? '#4caf50' : '#1976d2',
            weight: 4,
            opacity: 0.8
          });
          
          this.mapManagement.addRouteLine(polyline);
        } else if (segment.from && segment.to) {
          // Create a simple line between points if no polyline
          const polyline = L.polyline([
            [segment.from.lat, segment.from.lng],
            [segment.to.lat, segment.to.lng]
          ], {
            color: segment.type === 'walk' ? '#4caf50' : '#1976d2',
            weight: 4,
            opacity: 0.8
          });
          
          this.mapManagement.addRouteLine(polyline);
        }
      }
      
    } catch (error) {
      console.error('Error displaying route on map:', error);
    }
  }

  async loadTouristSpots(): Promise<void> {
    try {
      console.log('📍 Loading tourist spots...');
      
      const cached = localStorage.getItem('tourist_spots_cache');
      if (cached) {
        this.touristSpots = JSON.parse(cached);
        console.log('Loaded from cache:', this.touristSpots.length, 'spots');
        return;
      }
      
      console.log('Fetching from Firestore...');
      const spotsSnapshot = await this.firestore.collection('tourist_spots').get().toPromise();
      this.touristSpots = spotsSnapshot?.docs.map(doc => ({
        id: doc.id,
        ...(doc.data() as any)
      })) || [];
      
      console.log('Loaded from Firestore:', this.touristSpots.length, 'spots');
      localStorage.setItem('tourist_spots_cache', JSON.stringify(this.touristSpots));
      
    } catch (error) {
      console.error('Error loading tourist spots:', error);
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
        console.log('Loading modal already dismissed');
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
      console.error('Error refreshing tourist spots:', error);
    }
  }

  ngOnDestroy(): void {
    this.locationTracking.stopLocationTracking();
    
    this.mapManagement.removeMap();
    
    window.removeEventListener('online', () => this.onNetworkStatusChange(true));
    window.removeEventListener('offline', () => this.onNetworkStatusChange(false));
  }
}
