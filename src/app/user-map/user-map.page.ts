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
import { ItineraryCompletionModalComponent } from '../modals/itinerary-completion-modal/itinerary-completion-modal.component';
import { LocalTipsModalComponent } from '../modals/local-tips-modal/local-tips-modal.component';
import { GeofencingService } from '../services/geofencing.service';
import { firstValueFrom, Subscription } from 'rxjs';


// services imports
import { BucketService } from '../services/bucket-list.service';
import { DirectionsService } from '../services/directions.service';
import { ApiTrackerService } from '../services/api-tracker.service';
import { ItineraryService, ItineraryDay } from '../services/itinerary.service';
import { CalendarService, CalendarEvent, GlobalEvent } from '../services/calendar.service';
import { EventDetailModalComponent } from '../modals/event-detail-modal/event-detail-modal.component';

import { MapManagementService } from '../services/map-management.service';
import { RoutePlanningService, RouteInfo } from '../services/route-planning.service';
import { JeepneyRoutingService } from '../services/jeepney-routing.service';
import { LocationTrackingService, UserLocation } from '../services/location-tracking.service';
import { MapUIService } from '../services/map-ui.service';
import { MapUtilitiesService } from '../services/map-utilities.service';
import { ItinerarySessionService, ItinerarySession } from '../services/itinerary-session.service';
import { ModalCommunicationService } from '../services/modal-communication.service';
import { LocalTipsService } from '../services/local-tips.service';
import { EmergencyMapFocusPayload, MapFocusIntentService } from '../services/map-focus-intent.service';
import { SegmentCoordinateService } from '../services/segment-coordinate.service';
import { RouteSegmentMapRendererService } from '../services/route-segment-map-renderer.service';
import { ItineraryMapSnapshotService } from '../services/itinerary-map-snapshot.service';
import { ItineraryExpenseSyncService, ItineraryExpensePlanInput } from '../services/itinerary-expense-sync.service';
import { ItineraryRouteLabelService } from '../services/itinerary-route-label.service';
import { UserMapResumeService, ResumableSessionMeta } from '../services/user-map-resume.service';
import { VisitStageCalendarService } from '../services/visit-stage-calendar.service';
import { JeepneyRoutesRepositoryService } from '../services/jeepney-routes-repository.service';
import { TouristSpotsStreamService } from '../services/tourist-spots-stream.service';
import { WalkGuidanceService, WalkGuidanceUiState } from '../services/walk-guidance.service';
import { EmergencyMapDirectionsService } from '../services/emergency-map-directions.service';

interface StopItineraryOptions {
  persistExpenses?: boolean;
  showToast?: boolean;
  expensePlan?: ItineraryExpensePlanInput;
}

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
  /** Fixed copy for the single route-generation loading overlay. */
  private readonly routeLoadingMessage = 'Generating route';
  
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
  hasResumableSession: boolean = false;
  resumableSessionMeta: ResumableSessionMeta = {
    title: '',
    dayLabel: '',
    stageLabel: ''
  };

  // Subscriptions
  private locationSubscription?: Subscription;
  private appStateSubscription?: any;
  private spotsSubscription?: Subscription;
  private geofenceVisitsSubscription?: Subscription;
  private hasInitializedItinerarySelectionSubscription: boolean = false;
  private savedExpensePlan: ItineraryExpensePlanInput | null = null;
  private savedExpensePlanItineraryIndex: number = -1;
  private hasShownResumePromptThisLaunch: boolean = false;

  /** Admin event overlapping today's visit time for the current visit_stop segment (map FAB). */
  visitStageAdminEvent: GlobalEvent | null = null;

  /** Walk-segment guidance: distance along polyline, follow-pan, optional auto-next (no user toggle). */
  lakawWalkRemainingM: number | null = null;
  lakawAutoAdvanceEnabled = false;
  private lastFollowPanMs = 0;
  private lastLakawRemainUiMs = 0;
  private lastLakawRemainMUi: number | null = null;
  /** Prevents double auto-advance on the same segment index. */
  private lakawAutoAdvancedForSegmentIndex: number | null = null;
  /** Last walk segment we reset Lakaw polyline UI for (avoid resetting on repeated paints). */
  private lakawWalkPolylineSyncSegmentIndex: number | null = null;
  private readonly longWalkThresholdMeters = 1000;
  private warnedLongWalkSegments = new Set<number>();

  /** Marker + popup when opening the map from Emergency Information. */
  private emergencyFocusMarker?: L.Marker;

  /** When true, route panel shows a one-off trip to an emergency POI (not a calendar itinerary). */
  emergencyDirectionsMode = false;

  private walkGuidanceUi(): WalkGuidanceUiState {
    return {
      lakawWalkRemainingM: this.lakawWalkRemainingM,
      lastLakawRemainUiMs: this.lastLakawRemainUiMs,
      lastLakawRemainMUi: this.lastLakawRemainMUi,
      lastFollowPanMs: this.lastFollowPanMs,
      lakawAutoAdvancedForSegmentIndex: this.lakawAutoAdvancedForSegmentIndex,
      lakawWalkPolylineSyncSegmentIndex: this.lakawWalkPolylineSyncSegmentIndex,
    };
  }

  private applyWalkGuidanceUi(s: WalkGuidanceUiState): void {
    this.lakawWalkRemainingM = s.lakawWalkRemainingM;
    this.lastLakawRemainUiMs = s.lastLakawRemainUiMs;
    this.lastLakawRemainMUi = s.lastLakawRemainMUi;
    this.lastFollowPanMs = s.lastFollowPanMs;
    this.lakawAutoAdvancedForSegmentIndex = s.lakawAutoAdvancedForSegmentIndex;
    this.lakawWalkPolylineSyncSegmentIndex = s.lakawWalkPolylineSyncSegmentIndex;
  }

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
    private mapManagement: MapManagementService,
    private routePlanning: RoutePlanningService,
    private jeepneyRouting: JeepneyRoutingService,
    private locationTracking: LocationTrackingService,
    private mapUI: MapUIService,
    private mapUtils: MapUtilitiesService,
    private itinerarySession: ItinerarySessionService,
    private modalCommunication: ModalCommunicationService,
    private localTipsService: LocalTipsService,
    private mapFocusIntent: MapFocusIntentService,
    private segmentCoordinate: SegmentCoordinateService,
    private routeSegmentRenderer: RouteSegmentMapRendererService,
    private itineraryMapSnapshot: ItineraryMapSnapshotService,
    private itineraryExpenseSync: ItineraryExpenseSyncService,
    private routeLabels: ItineraryRouteLabelService,
    private userMapResume: UserMapResumeService,
    private visitStageCalendar: VisitStageCalendarService,
    private jeepneyRoutesRepo: JeepneyRoutesRepositoryService,
    private touristSpotsStream: TouristSpotsStreamService,
    private walkGuidance: WalkGuidanceService,
    private emergencyMapDirections: EmergencyMapDirectionsService
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
      // Force-refresh from Firestore so newly created itineraries appear immediately.
      let events = await this.calendarService.forceRefreshFromFirestore();
      if (!events || events.length === 0) {
        events = await this.calendarService.loadItineraryEvents();
      }
      
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

    this.refreshResumableSessionState();
  }

  async loadJeepneyRoutes(): Promise<void> {
    this.isLoadingJeepneyRoutes = true;

    try {
      this.jeepneyRoutes = await this.jeepneyRoutesRepo.fetchAllRoutes(this.firestore);
    } catch (error) {
      // Silently handle error
    } finally {
      this.isLoadingJeepneyRoutes = false;
    }
  }

  async loadItineraryRoutes(options: { preserveSessionProgress?: boolean } = {}): Promise<void> {
    const preserveSessionProgress = options.preserveSessionProgress ?? false;

    // Ensure we have itineraries loaded
    if (this.availableItineraries.length === 0) {
      console.log('No itineraries available, loading them first...');
      await this.loadAvailableItineraries();
      await this.loadJeepneyRoutes();
    }
    
    if (this.selectedItineraryIndex < 0 || this.selectedItineraryIndex >= this.availableItineraries.length) {
      // Clear any existing route data when no itinerary is selected
      this.emergencyDirectionsMode = false;
      this.currentRouteInfo = null;
      this.warnedLongWalkSegments.clear();
      this.mapManagement.clearAllRouteLines();
      this.mapManagement.clearAllMarkers();
      // Update map to show all tourist spots
      this.updateMapDisplay();
      return;
    }
    
    if (this.availableItineraries.length > 0 && this.selectedItineraryIndex < this.availableItineraries.length) {
      const selectedItinerary = this.availableItineraries[this.selectedItineraryIndex];
      
      try {
        const existingSession = this.itinerarySession.getCurrentSession();
        const canPreserveCurrentSession =
          preserveSessionProgress &&
          existingSession?.isActive &&
          existingSession.selectedItineraryIndex === this.selectedItineraryIndex;

        // Start a new session unless we are explicitly resuming the same itinerary.
        if (!canPreserveCurrentSession) {
          this.itinerarySession.startSession(this.selectedItineraryIndex, selectedItinerary);
        }
        
        // Clear any existing routes when itinerary changes
        this.emergencyDirectionsMode = false;
        this.mapManagement.clearAllRouteLines();
        this.mapManagement.clearAllMarkers();
        this.currentRouteInfo = null;
        
        // Show markers immediately when itinerary is selected
        this.mapManagement.showItinerarySpots(selectedItinerary, this.mapUI);
        
        // Start geofencing for the selected itinerary
        await this.geofencingService.startMonitoring(selectedItinerary.days);
        
        // Generate route information for the selected itinerary
        await this.generateRouteForItinerary(selectedItinerary);
        this.refreshResumableSessionState();
      } catch (error) {
        console.error('Error loading itinerary routes:', error);
        this.showToast('Error loading itinerary routes');
        // Clear the failed session
        this.itinerarySession.endSession();
        this.selectedItineraryIndex = -1;
        this.currentSegmentIndex = 0;
        this.updateMapDisplay();
        this.refreshResumableSessionState();
      }
    } else {
      this.currentRouteInfo = null;
      this.refreshResumableSessionState();
    }
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

  /**
   * Apply emergency map focus / directions after the map exists and after `updateMapDisplay`
   * so a new route is not immediately cleared by the initial paint.
   */
  ionViewDidEnter(): void {
    setTimeout(() => {
      void this.loadAvailableItineraries();
      void this.updateMapDisplay();
      this.applyPendingEmergencyMapFocus();
    }, 550);
  }

  async ngAfterViewInit(): Promise<void> {
    try {
      this.mapManagement.initMap();
      
      // Subscribe to location updates to display user marker
      this.locationSubscription = this.locationTracking.locationUpdates.subscribe(
        (location: UserLocation) => {
          this.ngZone.run(() => {
            this.updateUserMarker(location);
            this.handleLakawLocationUpdate(location);
          });
        }
      );

      this.loadLakawAutoAdvanceSetting();

      await this.locationTracking.startLocationTracking();
      
      await this.loadTouristSpots();
      
      // Check for existing itinerary session
      await this.checkForExistingSession();

      // Persist session progress whenever geofence visits are updated.
      this.geofenceVisitsSubscription = this.geofencingService.visitedSpots$.subscribe(() => {
        if (this.selectedItineraryIndex >= 0 && this.currentRouteInfo) {
          this.persistSessionSnapshot('geofence_update');
        }
      });
      
      // Subscribe to modal communication service
      this.modalCommunication.itinerarySelection$.subscribe((index: number | null) => {
        // Ignore first replayed BehaviorSubject value.
        if (!this.hasInitializedItinerarySelectionSubscription) {
          this.hasInitializedItinerarySelectionSubscription = true;
          return;
        }

        if (index !== null) {
          console.log('Received itinerary selection from service:', index);
          this.emergencyDirectionsMode = false;
          this.selectedItineraryIndex = index;
          this.loadItineraryRoutes();
        }
      });
      
      // Listen for app state changes (pause/background)
      this.appStateSubscription = App.addListener('appStateChange', (state) => {
        console.log('App state changed. isActive:', state.isActive);
        
        if (!state.isActive) {
          this.handleAppPause();
        } else {
          this.handleAppResume();
        }
      });
      
      // Wait a bit for map to be fully initialized (emergency focus is applied in `ionViewDidEnter`)
      setTimeout(() => {
        this.updateMapDisplay();
      }, 500);
      
      this.setupGlobalFunctions();
      
      window.addEventListener('online', () => this.onNetworkStatusChange(true));
      window.addEventListener('offline', () => this.onNetworkStatusChange(false));
      
      // Listen for browser close/refresh (for web version)
      window.addEventListener('beforeunload', () => {
        this.handleAppPause();
      });
      
    } catch (error) {
      await this.showToast('Error initializing map');
    }
  }


  // /////////////////////////////////////SESSION MANAGEMENT///////////////////////////////////////////////////

  async checkForExistingSession(): Promise<void> {
    if (this.availableItineraries.length === 0) {
      await this.loadAvailableItineraries();
    }
    this.refreshResumableSessionState();
    this.maybePromptForResumableTrip();
  }

  //////////////////////////////////////// contnue seesoipb when app is quited 
  async continueSavedItinerary(): Promise<void> {
    if (this.availableItineraries.length === 0) {
      await this.loadAvailableItineraries();
      await this.loadJeepneyRoutes();
    }

    const currentSession = this.userMapResume.getValidResumableSession(
      this.itinerarySession.getCurrentSession(),
      this.availableItineraries
    );
    if (!currentSession) {
      this.clearInvalidSessionForResume();
      await this.showToast('Saved trip no longer available.');
      return;
    }

    const targetSegmentIndex = currentSession.currentSegmentIndex || 0;
    const wasSameItinerarySelected = this.selectedItineraryIndex === currentSession.selectedItineraryIndex;
    this.selectedItineraryIndex = currentSession.selectedItineraryIndex;
    this.currentSegmentIndex = targetSegmentIndex;

    // /////////////////////// for continuing a session when app is quited
    const restoredFromSnapshot = this.restoreRouteSnapshotForSession(currentSession);
    const hasLoadedRouteForCurrentItinerary =
      wasSameItinerarySelected &&
      !!this.currentRouteInfo?.segments?.length;

    if (!restoredFromSnapshot && !hasLoadedRouteForCurrentItinerary) {
      await this.loadItineraryRoutes({ preserveSessionProgress: true });
    } else {
      // loadItineraryRoutes was skipped — restore map markers to itinerary-only view manually.
      const itinerary = this.availableItineraries[this.selectedItineraryIndex];
      if (itinerary) {
        this.mapManagement.clearAllMarkers();
        this.mapManagement.showItinerarySpots(itinerary, this.mapUI);
      }
    }

    const selectedItinerary = this.availableItineraries[this.selectedItineraryIndex];
    if (selectedItinerary?.days) {
      await this.geofencingService.startMonitoring(selectedItinerary.days);
    }

    if (!this.locationTracking.isTrackingActive()) {
      await this.locationTracking.startLocationTracking();
    }

    if (this.currentRouteInfo?.segments?.length) {
      const maxIndex = this.currentRouteInfo.segments.length - 1;
      this.currentSegmentIndex = Math.max(0, Math.min(targetSegmentIndex, maxIndex));
      this.displayCurrentSegment();
      this.itinerarySession.updateCurrentSegment(this.currentSegmentIndex);
    }

    this.centerMapForResumedSegment();
    this.refreshResumableSessionState();
    await this.showToast(`Resumed at Stage ${this.currentSegmentIndex + 1}`);
  }

  private refreshResumableSessionState(): void {
    const currentSession = this.itinerarySession.getCurrentSession();
    const { shouldEndStaleSession, hasResumableSession, meta } = this.userMapResume.computeResumeBannerState(
      currentSession,
      this.availableItineraries,
      this.selectedItineraryIndex
    );

    if (shouldEndStaleSession) {
      this.itinerarySession.endSession();
    }

    this.hasResumableSession = hasResumableSession;
    this.resumableSessionMeta = meta;
  }

  private clearInvalidSessionForResume(): void {
    this.itinerarySession.endSession();
    this.selectedItineraryIndex = -1;
    this.currentSegmentIndex = 0;
    this.clearResumeSnapshots();
    this.refreshResumableSessionState();
  }

  private centerMapForResumedSegment(): void {
    const userLocation = this.locationTracking.getUserLocation();
    if (userLocation) {
      this.mapManagement.centerOnLocation(userLocation.lat, userLocation.lng, 15);
      return;
    }

    const segment = this.currentRouteInfo?.segments?.[this.currentSegmentIndex];
    const startPoint = segment?.from || segment?.coordinates?.[0];
    if (startPoint?.lat && startPoint?.lng) {
      this.mapManagement.centerOnLocation(startPoint.lat, startPoint.lng, 15);
    }
  }

  private persistSessionSnapshot(reason: string = 'lifecycle_pause'): void {
    if (this.selectedItineraryIndex >= 0 && this.currentRouteInfo) {
      this.itinerarySession.updateCurrentSegment(this.currentSegmentIndex);
      this.itineraryMapSnapshot.saveProgressAndRoute({
        reason,
        selectedItineraryIndex: this.selectedItineraryIndex,
        currentSegmentIndex: this.currentSegmentIndex,
        userLocation: this.locationTracking.getUserLocation(),
        routeInfo: this.currentRouteInfo,
      });
      this.refreshResumableSessionState();
    }
  }

  private restoreRouteSnapshotForSession(session: ItinerarySession): boolean {
    const routeInfo = this.itineraryMapSnapshot.tryRestoreRouteSnapshot(session);
    if (!routeInfo) {
      return false;
    }
    this.currentRouteInfo = routeInfo;
    return true;
  }

  private clearResumeSnapshots(): void {
    this.itineraryMapSnapshot.clear();
  }

  private handleAppPause(): void {
    // Pause lifecycle should preserve progress; do not call stopItinerary() here.
    this.persistSessionSnapshot('app_paused');
  }

  private handleAppResume(): void {
    // On resume, simply refresh whether Continue Trip should be shown.
    this.refreshResumableSessionState();
    this.maybePromptForResumableTrip();
  }

  private maybePromptForResumableTrip(): void {
    if (!this.hasResumableSession || this.hasShownResumePromptThisLaunch) {
      return;
    }

    this.hasShownResumePromptThisLaunch = true;
    void this.showToast('Trip in progress found. Tap Continue Trip to resume.');
  }

  /////////////////////////////////////////////TEMPLATE METHODS ///////////////////////////////////

  async showItineraryControlsModal(): Promise<void> {
    // Always refresh before opening modal so list includes newly created itineraries.
    console.log('Refreshing itineraries...');
    await this.loadAvailableItineraries();
    await this.loadJeepneyRoutes();
    
    console.log('Available itineraries:', this.availableItineraries.length);
    
    const modal = await this.modalCtrl.create({
      component: ItineraryControlsModalComponent,
      componentProps: {
        availableItineraries: this.availableItineraries,
        selectedItineraryIndex: this.selectedItineraryIndex,
        selectedItinerary: this.selectedItineraryIndex >= 0 ? this.availableItineraries[this.selectedItineraryIndex] : null,
        expensePlanDraft:
          this.selectedItineraryIndex === this.savedExpensePlanItineraryIndex ? this.savedExpensePlan : null,
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
          void this.stopItinerary({
            persistExpenses: true,
            showToast: true,
            expensePlan: result.data.expensePlan
          });
        } else if (result.data.action === 'saveExpensePlan') {
          this.savedExpensePlan = result.data.expensePlan || null;
          this.savedExpensePlanItineraryIndex = this.selectedItineraryIndex;
          const activeItinerary =
            this.selectedItineraryIndex >= 0 && this.selectedItineraryIndex < this.availableItineraries.length
              ? this.availableItineraries[this.selectedItineraryIndex]
              : null;

          if (activeItinerary && this.savedExpensePlan) {
            void this.itineraryExpenseSync
              .persistItineraryExpenses(
                activeItinerary,
                this.savedExpensePlan,
                this.currentRouteInfo?.segments
              )
              .then(() => this.showToast('Expense plan saved'))
              .catch((error: unknown) => {
                console.error('Error saving expense plan:', error);
                void this.showToast('Expense plan draft saved (sync failed)');
              });
          } else {
            this.showToast('Expense plan saved');
          }
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
    return this.routeLabels.getSegmentTitle(segment);
  }

  getCurrentStageDescription(): string {
    return this.routeLabels.getCurrentStageDescription(this.currentRouteInfo, this.currentSegmentIndex);
  }

  isCurrentSegmentVisitStop(): boolean {
    const segment = this.currentRouteInfo?.segments?.[this.currentSegmentIndex];
    return segment?.type === 'visit_stop';
  }

  isCurrentWalkSegment(): boolean {
    const segment = this.currentRouteInfo?.segments?.[this.currentSegmentIndex];
    return segment?.type === 'walk';
  }

  onLakawAutoAdvanceChange(): void {
    this.walkGuidance.saveAutoAdvanceToStorage(!!this.lakawAutoAdvanceEnabled);
  }

  private loadLakawAutoAdvanceSetting(): void {
    this.lakawAutoAdvanceEnabled = this.walkGuidance.loadAutoAdvanceFromStorage();
  }

  /**
   * Resets walk-segment UI when leaving a walking polyline; keeps segment index guards in sync.
   */
  private syncLakawWithSegment(): void {
    this.applyWalkGuidanceUi(
      this.walkGuidance.syncAfterSegmentPaint(
        this.isCurrentWalkSegment(),
        this.currentSegmentIndex,
        this.walkGuidanceUi()
      )
    );
  }

  private clearLakawState(): void {
    this.lakawWalkRemainingM = null;
    this.lakawAutoAdvancedForSegmentIndex = null;
    this.lakawWalkPolylineSyncSegmentIndex = null;
    this.lastLakawRemainMUi = null;
    this.lastLakawRemainUiMs = 0;
  }

  private handleLakawLocationUpdate(location: UserLocation): void {
    const effect = this.walkGuidance.processWalkLocationUpdate(
      location,
      this.currentRouteInfo,
      this.currentSegmentIndex,
      this.lakawAutoAdvanceEnabled,
      this.walkGuidanceUi()
    );
    this.applyWalkGuidanceUi(effect.ui);

    if (effect.panTo) {
      const map = this.mapManagement.getMap();
      if (map) {
        map.panTo([effect.panTo.lat, effect.panTo.lng], {
          animate: effect.panTo.animate,
          duration: effect.panTo.duration,
        });
      }
    }

    if (effect.toastAlmostThere) {
      void this.showToast('Almost there — opening next stage.');
    }
    if (effect.shouldAutoNextSegment) {
      this.nextSegment(true);
    }
  }

  getCurrentVisitSpotName(): string {
    const segment = this.currentRouteInfo?.segments?.[this.currentSegmentIndex];
    return segment?.spotName || segment?.toName || 'this destination';
  }


  /**
   * Green check on map: show completion summary, then optionally end session via stopItinerary().
   */
  async openItineraryCompletionModal(): Promise<void> {
    if (!this.currentRouteInfo?.segments?.length) {
      return;
    }

    const activeItinerary =
      this.selectedItineraryIndex >= 0 && this.selectedItineraryIndex < this.availableItineraries.length
        ? this.availableItineraries[this.selectedItineraryIndex]
        : null;

    let routeSnapshot: any = null;
    if (this.currentRouteInfo) {
      try {
        routeSnapshot = JSON.parse(JSON.stringify(this.currentRouteInfo));
      } catch {
        routeSnapshot = this.currentRouteInfo;
      }
    }

    const modal = await this.modalCtrl.create({
      component: ItineraryCompletionModalComponent,
      componentProps: {
        itineraryTitle: this.routeLabels.getItineraryCompletionHeading(activeItinerary),
        routeInfo: routeSnapshot
      },
      cssClass: 'itinerary-completion-modal',
      backdropDismiss: true
    });

    modal.onDidDismiss().then((result) => {
      if (result.data?.endTrip) {
        void this.stopItinerary();
      }
    });

    await modal.present();
  }

  async stopItinerary(options: StopItineraryOptions = {}): Promise<void> {
    const persistExpenses = options.persistExpenses ?? true;
    const showToast = options.showToast ?? true;
    const savedPlanForCurrentItinerary =
      this.selectedItineraryIndex === this.savedExpensePlanItineraryIndex ? this.savedExpensePlan : null;
    const expensePlan = options.expensePlan ?? savedPlanForCurrentItinerary ?? undefined;

    console.log('Stopping itinerary...');

    const activeItinerary =
      this.selectedItineraryIndex >= 0 && this.selectedItineraryIndex < this.availableItineraries.length
        ? this.availableItineraries[this.selectedItineraryIndex]
        : null;

    if (persistExpenses && activeItinerary) {
      try {
        await this.itineraryExpenseSync.persistItineraryExpenses(
          activeItinerary,
          expensePlan,
          this.currentRouteInfo?.segments
        );
      } catch (error) {
        console.error('Error persisting itinerary expenses:', error);
      }
    }

    // Clear route visualization
    this.mapManagement.clearAllRouteLines();
    this.mapManagement.clearRouteMarkers();

    // Reset route state
    this.emergencyDirectionsMode = false;
    this.currentRouteInfo = null;
    this.warnedLongWalkSegments.clear();
    this.visitStageAdminEvent = null;
    this.selectedItineraryIndex = -1;
    this.currentSegmentIndex = 0;
    this.clearLakawState();

    // Reset notification visibility
    this.showStageNotification = true;

    // End session
    this.itinerarySession.endSession();
    this.clearResumeSnapshots();
    this.savedExpensePlan = null;
    this.savedExpensePlanItineraryIndex = -1;
    this.refreshResumableSessionState();

    // Clear modal communication
    this.modalCommunication.clearSelection();

    // Update map to show all tourist spots
    await this.updateMapDisplay();

    if (showToast) {
      await this.showToast('Itinerary stopped');
    }

    console.log('Itinerary stopped successfully');
  }

  cancelRouteGeneration(): void {
    console.log('Cancelling route generation...');

    // Reset loading states
    this.isLoadingJeepneyRoutes = false;
    this.isGeneratingRoute = false;

    this.clearLakawState();

    // Reset route state
    this.emergencyDirectionsMode = false;
    this.currentRouteInfo = null;
    this.warnedLongWalkSegments.clear();
    this.visitStageAdminEvent = null;
    this.selectedItineraryIndex = -1;
    this.currentSegmentIndex = 0;
    
    // Reset notification visibility
    this.showStageNotification = true;
    
    // End session
    this.itinerarySession.endSession();
    this.clearResumeSnapshots();
    
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
    if (!segment) {
      return;
    }

    const selectedItinerary =
      this.selectedItineraryIndex >= 0 && this.selectedItineraryIndex < this.availableItineraries.length
        ? this.availableItineraries[this.selectedItineraryIndex]
        : null;

    const coords = this.segmentCoordinate.resolveSegmentLatLng(segment, {
      touristSpots: this.touristSpots,
      selectedItinerary,
    });

    if (coords) {
      const map = this.mapManagement.getMap();
      if (map) {
        map.setView([coords.lat, coords.lng], 16, {
          animate: true,
          duration: 1,
        });
      }
    } else {
      void this.showToast(`Could not find coordinates for Segment ${segmentIndex + 1}`);
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
      this.persistSessionSnapshot('stage_route_option_changed');
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
      this.persistSessionSnapshot('suggested_route_changed');
    }
  }

  toggleMapType(): void {
    this.selectedTile = this.selectedTile === 'osm' ? 'satellite' : 'osm';
    this.mapManagement.changeTileLayer(this.selectedTile);
  }

  toggleFullscreen(): void {
    this.isFullscreen = !this.isFullscreen;
  }

  nextSegment(fromAutoAdvance = false): void {
    if (!this.currentRouteInfo || !this.currentRouteInfo.segments) {
      return;
    }

    if (!fromAutoAdvance) {
      this.lakawAutoAdvancedForSegmentIndex = null;
    }

    // Stop at the last segment instead of wrapping back to Stage 1.
    if (this.currentSegmentIndex >= this.currentRouteInfo.segments.length - 1) {
      void this.openItineraryCompletionModal();
      return;
    }
    this.currentSegmentIndex = this.currentSegmentIndex + 1;

    // Persist session with new current segment.
    this.persistSessionSnapshot('segment_advanced');

    // Display only the current segment
    this.displayCurrentSegment();

    if (fromAutoAdvance) {
      this.lakawAutoAdvancedForSegmentIndex = null;
    }
  }

  previousSegment(): void {
    if (!this.currentRouteInfo || !this.currentRouteInfo.segments) {
      return;
    }

    this.lakawAutoAdvancedForSegmentIndex = null;

    // Move to previous segment (loop to last when at the beginning)
    this.currentSegmentIndex = this.currentSegmentIndex > 0 
      ? this.currentSegmentIndex - 1 
      : this.currentRouteInfo.segments.length - 1;
    
    // Persist session with new current segment.
    this.persistSessionSnapshot('segment_rewind');
    
    // Display only the current segment
    this.displayCurrentSegment();
    
    // Stage info is now shown in the yellow banner at the top
  }

  displayCurrentSegment(): void {
    if (!this.currentRouteInfo || !this.currentRouteInfo.segments) {
      this.visitStageAdminEvent = null;
      return;
    }
    
    try {
      // Clear all existing route lines
      this.mapManagement.clearAllRouteLines();
      this.mapManagement.clearRouteMarkers();
      
      // Get the current segment
      const segment = this.currentRouteInfo.segments[this.currentSegmentIndex];
      
      if (!segment) {
        this.visitStageAdminEvent = null;
        return;
      }
      
      this.routeSegmentRenderer.renderSegment(segment);
      
      // Center map on the segment
      this.navigateToSegment(this.currentSegmentIndex);

      void this.refreshOverlapEventForVisitStage();
      this.syncLakawWithSegment();
      void this.warnIfWalkTooLong(segment, this.currentSegmentIndex);
    } catch (error) {
      // Silently handle display errors
    }
  }

  private async warnIfWalkTooLong(segment: any, segmentIndex: number): Promise<void> {
    if (!segment || segment.type !== 'walk') {
      return;
    }

    const distanceMeters = Number(segment.distance) || 0;
    if (distanceMeters <= this.longWalkThresholdMeters) {
      return;
    }

    if (this.warnedLongWalkSegments.has(segmentIndex)) {
      return;
    }
    this.warnedLongWalkSegments.add(segmentIndex);

    const distanceKm = (distanceMeters / 1000).toFixed(2);
    const alert = await this.alertCtrl.create({
      header: 'Long walk ahead',
      message: `This walk is about ${distanceKm} km. Consider taking a bus or taxi instead.`,
      buttons: ['OK']
    });

    await alert.present();
  }

  private async refreshOverlapEventForVisitStage(): Promise<void> {
    this.visitStageAdminEvent = null;
    const segment = this.currentRouteInfo?.segments?.[this.currentSegmentIndex];
    const ev = await this.visitStageCalendar.fetchAdminOverlapForVisitStop({
      segment,
      selectedItineraryIndex: this.selectedItineraryIndex,
      availableItineraries: this.availableItineraries,
      session: this.itinerarySession.getCurrentSession(),
    });
    this.ngZone.run(() => {
      this.visitStageAdminEvent = ev;
    });
  }

  async openVisitStageEventModal(): Promise<void> {
    if (!this.visitStageAdminEvent) {
      return;
    }
    try {
      const modal = await this.modalCtrl.create({
        component: EventDetailModalComponent,
        cssClass: 'event-detail-modal',
        componentProps: {
          event: this.visitStageAdminEvent,
        },
        backdropDismiss: true,
      });
      await modal.present();
    } catch (error) {
      console.error('openVisitStageEventModal:', error);
      await this.showToast('Could not open event details.');
    }
  }

  async openLocalTipsModal(): Promise<void> {
    const segment = this.currentRouteInfo?.segments?.[this.currentSegmentIndex];
    if (!segment || segment.type !== 'visit_stop' || !segment.spotId) {
      await this.showToast('Local tips are only available during a visit stage.');
      return;
    }

    let tips: any[] = [];
    try {
      tips = (await firstValueFrom(this.localTipsService.getApprovedTipsForSpot(segment.spotId))) || [];
    } catch {
      tips = [];
    }

    const modal = await this.modalCtrl.create({
      component: LocalTipsModalComponent,
      componentProps: {
        spotName: segment.spotName || segment.toName || 'This destination',
        spotId: segment.spotId,
        tips
      },
      cssClass: 'local-tips-modal',
      breakpoints: [0, 0.55, 0.9],
      initialBreakpoint: 0.55,
      backdropDismiss: true
    });

    await modal.present();
  }




  async generateRouteForItinerary(itinerary: any): Promise<void> {
    try {
      this.isGeneratingRoute = true;
      
      await this.showRouteLoadingModal();

      const userLocation = await this.locationTracking.getLocationWithFallback();

      this.currentRouteInfo = await this.routePlanning.generateRouteInfo(
        itinerary,
        userLocation
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
    }
  }

  displayRouteOnMap(routeInfo: any): void {
    if (!routeInfo || !routeInfo.segments) {
      return;
    }
    
    try {
      this.lakawWalkPolylineSyncSegmentIndex = null;
      this.warnedLongWalkSegments.clear();
      // Reset to first segment when displaying a new route
      this.currentSegmentIndex = 0;
      this.persistSessionSnapshot('route_display_reset');
      
      // Display only the first segment
      this.displayCurrentSegment();
      
    } catch (error) {
      // Silently handle display errors
    }
  }

  async loadTouristSpots(): Promise<void> {
    try {
      const fromCache = this.touristSpotsStream.readCachedSpotsWhenEmpty(this.touristSpots.length);
      if (fromCache) {
        this.touristSpots = fromCache;
      }

      if (this.spotsSubscription) {
        this.spotsSubscription.unsubscribe();
      }

      this.spotsSubscription = this.touristSpotsStream.watchSpots(this.firestore).subscribe({
        next: (spots) => {
          this.ngZone.run(() => {
            this.touristSpots = (spots || []) as any[];
            this.touristSpotsStream.persistCache(this.touristSpots);

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
          const savedList = this.touristSpotsStream.readCachedSpotsOrEmpty();
          if (savedList.length) {
            this.touristSpots = savedList;
            if (this.selectedItineraryIndex < 0) {
              this.updateMapDisplay();
            }
          }
          await this.showToast('Error syncing spots; showing cached data');
        },
      });
    } catch (error) {
      const fallback = this.touristSpotsStream.readCachedSpotsOrEmpty();
      if (fallback.length) {
        this.touristSpots = fallback;
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
    
    // Center map on the spot without opening details
    this.mapManagement.centerOnLocation(spot.location.lat, spot.location.lng, 16);
    
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

    (window as any).openItinerarySpotDetails = (spotName: string) => {
      const spot = this.findSpotByName(spotName);
      if (spot) {
        this.openSpotSheet(spot);
      } else {
        this.showToast('Spot details not available');
      }
    };

    (window as any).getWalkingDirections = (spotName: string) => {
      const spot = this.findSpotByName(spotName);
      if (!spot?.location?.lat || !spot?.location?.lng) {
        this.showToast('Unable to get directions for this spot');
        return;
      }
      this.mapManagement.centerOnLocation(spot.location.lat, spot.location.lng, 16);
    };
  }

  private findSpotByName(spotName: string): any | null {
    const fromTouristSpots = this.touristSpots.find(s => s?.name === spotName);
    if (fromTouristSpots) {
      return fromTouristSpots;
    }

    if (
      this.selectedItineraryIndex >= 0 &&
      this.selectedItineraryIndex < this.availableItineraries.length
    ) {
      const selectedItinerary = this.availableItineraries[this.selectedItineraryIndex];
      const itinerarySpots =
        selectedItinerary?.days?.flatMap((day: any) =>
          Array.isArray(day?.spots) ? day.spots : Object.values(day?.spots || {})
        ) || [];
      const fromItinerary = itinerarySpots.find((s: any) => s?.name === spotName);
      if (fromItinerary) {
        return fromItinerary;
      }
    }

    return null;
  }

  /** One Ionic loading overlay with fixed copy for itinerary / emergency route generation. */
  private async showRouteLoadingModal(): Promise<void> {
    if (this.loadingModal) {
      return;
    }
    this.loadingModal = await this.loadingCtrl.create({
      message: this.routeLoadingMessage,
      spinner: 'crescent',
      translucent: true,
      cssClass: 'route-loading-modal'
    });
    await this.loadingModal.present();
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
      this.touristSpotsStream.clearDiskCache();
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
      location.isReal,
      {
        headingDeg: location.headingDeg,
        useWalkOrientation: this.isCurrentWalkSegment()
      }
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

  /**
   * If Emergency Information set a focus payload, center the map and optionally load directions.
   */
  private applyPendingEmergencyMapFocus(): void {
    const payload = this.mapFocusIntent.consumeEmergencyPlaceFocus();
    if (!payload) {
      return;
    }
    if (payload.requestDirections) {
      void this.loadEmergencyDirectionsFromIntent(payload);
      return;
    }

    const map = this.mapManagement.getMap();
    if (!map) {
      return;
    }

    this.clearEmergencyFocusMarker();

    const { lat, lng, name, address } = payload;
    map.setView([lat, lng], 16, {
      animate: true,
      duration: 0.75,
    } as L.ZoomPanOptions);

    this.emergencyFocusMarker = this.emergencyMapDirections.createEmergencyFocusMarker(map, {
      lat,
      lng,
      name,
      address,
    });

    void this.showToast(`Showing ${name} on the map`);
  }

  private async loadEmergencyDirectionsFromIntent(payload: EmergencyMapFocusPayload): Promise<void> {
    const ready = await this.emergencyMapDirections.waitForMapReady(() => this.mapManagement.getMap());
    if (!ready) {
      await this.showToast('Map is not ready. Open the Map tab and try again.');
      return;
    }

    this.emergencyDirectionsMode = true;
    this.clearEmergencyFocusMarker();

    try {
      await this.showRouteLoadingModal();
      const result = await this.emergencyMapDirections.loadEmergencyRouteInfo(payload);
      await this.dismissLoadingModal();

      if ('error' in result) {
        this.emergencyDirectionsMode = false;
        await this.showToast(
          result.error === 'no_segments'
            ? 'No directions found. Try again or move closer to Cebu.'
            : 'Could not load directions. Please try again.'
        );
        return;
      }

      this.currentRouteInfo = result.routeInfo;
      this.displayRouteOnMap(result.routeInfo);
      await this.showToast(`Directions to ${payload.name}`);
    } catch {
      await this.dismissLoadingModal();
      this.emergencyDirectionsMode = false;
      await this.showToast('Could not load directions. Please try again.');
    }
  }

  async clearEmergencyDirectionsPanel(): Promise<void> {
    this.emergencyDirectionsMode = false;
    this.currentRouteInfo = null;
    this.warnedLongWalkSegments.clear();
    this.mapManagement.clearAllRouteLines();
    this.mapManagement.clearRouteMarkers();
    this.clearEmergencyFocusMarker();
    this.clearLakawState();
    await this.updateMapDisplay();
  }

  private clearEmergencyFocusMarker(): void {
    const map = this.mapManagement.getMap();
    if (this.emergencyFocusMarker && map) {
      map.removeLayer(this.emergencyFocusMarker);
    }
    this.emergencyFocusMarker = undefined;
  }

  ngOnDestroy(): void {
    this.clearEmergencyFocusMarker();
    this.persistSessionSnapshot();
    
    // Unsubscribe from location updates
    if (this.locationSubscription) {
      this.locationSubscription.unsubscribe();
    }
    
    if (this.spotsSubscription) {
      this.spotsSubscription.unsubscribe();
    }

    if (this.geofenceVisitsSubscription) {
      this.geofenceVisitsSubscription.unsubscribe();
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
