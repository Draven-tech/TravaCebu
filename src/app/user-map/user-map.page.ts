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
  

  

  
  // User location (will be set dynamically)
  userLocation: any = null;
  
  // Location tracking
  private locationWatcher?: string;
  private isLocationTracking: boolean = false;
  private locationUpdateInterval: number = 10000; // Update every 10 seconds
  
  // Jeepney routes loaded from Firebase
  jeepneyRoutes: any[] = [];
  isLoadingJeepneyRoutes: boolean = false;
  isGeneratingRoute: boolean = false;
  
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
    private budgetService: BudgetService
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
    this.routeMarkers = [];
    this.routeLines = [];
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
      // Load only active (non-completed) itineraries for the dropdown
      const events = await this.calendarService.loadItineraryEvents();
      
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
        // No local jeepney routes - using Google Maps API only
        this.jeepneyRoutes = [];
      }
    } catch (error) {
      console.error('Error loading jeepney routes:', error);
      // No fallback routes - using Google Maps API only
      this.jeepneyRoutes = [];
    } finally {
      this.isLoadingJeepneyRoutes = false;
    }
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
              
              // Determine the type of event (tourist spot, restaurant, or hotel)
              const eventType = event.extendedProps?.type || 'tourist_spot';
              let category = event.extendedProps?.category || 'GENERAL';
              let img = event.extendedProps?.img || 'assets/img/default.png';
              
              // Set appropriate category and image based on event type
              if (eventType === 'restaurant') {
                category = 'Restaurant';
                img = 'assets/img/restaurant-icon.png'; // You can add this icon or use default
              } else if (eventType === 'hotel') {
                category = 'Hotel';
                img = 'assets/img/hotel-icon.png'; // You can add this icon or use default
              }
              
              return {
                id: event.extendedProps?.spotId || event.id || '',
                name: event.title || 'Unknown Spot',
                description: event.extendedProps?.description || '',
                category: category,
                timeSlot: event.start?.split('T')[1]?.substring(0, 5) || '09:00',
                estimatedDuration: event.extendedProps?.duration || '2 hours',
                durationMinutes: event.extendedProps?.durationMinutes || 120,
                location: location,
                img: img,
                mealType: event.extendedProps?.mealType || null,
                eventType: eventType, // Add event type for marker styling
                // Add restaurant/hotel specific properties
                restaurant: event.extendedProps?.restaurant || null,
                hotel: event.extendedProps?.hotel || null,
                rating: event.extendedProps?.rating || null,
                vicinity: event.extendedProps?.vicinity || null
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





  async loadItineraryRoutes() {
    if (this.selectedItineraryIndex < 0 || this.selectedItineraryIndex >= this.availableItineraries.length) {
      // Clear any existing route data when no itinerary is selected
      this.currentRouteInfo = null;
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
      
      // Show markers immediately when itinerary is selected
      await this.showItineraryMarkersOnly(selectedItinerary);
      
      // Generate route information for the selected itinerary
      const routeInfo = await this.generateRouteInfo(selectedItinerary);
      if (routeInfo) {
        this.currentRouteInfo = routeInfo;
        
      // Display the route on the map
      // Always display the route on the map using the full routeInfo object
      // which contains all processed segments (walking and jeepney).
      this.displayRouteOnMap(routeInfo);
      } else {
        console.log('⚠️ No route info generated');
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
    
    if (itinerary.name && itinerary.name !== `Day ${1} Itinerary`) {
      return `${itinerary.name} (${dayCount} day${dayCount > 1 ? 's' : ''}, ${spotCount} spots)`;
    }
    
    return `Day ${1} Itinerary - ${spotCount} spots`;
  }

  private async showItineraryMarkersOnly(itinerary: any): Promise<void> {
    if (!itinerary || !itinerary.days) {
      return;
    }

    // Use real user location
    const userLocation = this.userLocation;

    // Clear existing markers
    this.routeMarkers.forEach(marker => {
      if (this.map.hasLayer(marker)) {
        this.map.removeLayer(marker);
      }
    });
    this.routeMarkers = [];

    // Add user location marker only if userLocation has valid coordinates
    if (userLocation && userLocation.lat && userLocation.lng) {
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

      this.routeMarkers.push(userMarker);
    } else {
      console.warn('⚠️ User location not available for route display');
    }

    // Create a map to track unique locations and prevent duplicates
    const locationMap = new Map<string, any>();
    let spotIndex = 1;

    // Add markers for each spot
    for (const day of itinerary.days) {
      if (day.spots) {
        const daySpotsArray = Array.isArray(day.spots) ? day.spots : Object.values(day.spots);
        for (const spot of daySpotsArray) {
          if (spot && spot.location && spot.location.lat && spot.location.lng) {
            // Create a unique key for this location (rounded to 4 decimal places to handle slight variations)
            const locationKey = `${spot.location.lat.toFixed(4)},${spot.location.lng.toFixed(4)}`;
            
            // Check if we already have a marker at this location
            if (locationMap.has(locationKey)) {
              continue; // Skip creating duplicate marker
            }
            
            // Add to location map to prevent duplicates
            locationMap.set(locationKey, spot);
            
            const spotMarker = L.marker([spot.location.lat, spot.location.lng], {
              icon: this.getRouteMarkerIcon(spot, spotIndex)
            }).addTo(this.map);

            // Add popup for spot marker
            const popupContent = await this.createDirectionSpotPopup(spot, spotIndex);
            spotMarker.bindPopup(popupContent);
            this.routeMarkers.push(spotMarker);
            spotIndex++;
          }
        }
      }
    }

    // Fit map to show all markers
    if (this.routeMarkers.length > 0) {
      const group = L.featureGroup(this.routeMarkers);
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

  /**
   * Show alternative route options for a specific stage
   */
  showStageRouteOptions(stageIndex: number): void {
    if (this.stageRouteOptions[stageIndex] && this.stageRouteOptions[stageIndex].length > 1) {
      this.selectedStageForOptions = stageIndex;
      console.log(`Showing ${this.stageRouteOptions[stageIndex].length} route options for stage ${stageIndex + 1}`);
    }
  }

  /**
   * Select a specific route option for a stage
   */
  selectStageRoute(stageIndex: number, routeIndex: number): void {
    if (this.stageRouteOptions[stageIndex] && this.stageRouteOptions[stageIndex][routeIndex]) {
      const selectedRoute = this.stageRouteOptions[stageIndex][routeIndex];
      console.log(`Selected route option ${routeIndex + 1} for stage ${stageIndex + 1}:`, selectedRoute);
      
      // Update the current route info with the selected route
      if (this.currentRouteInfo && this.currentRouteInfo.segments) {
        // Find and replace the segments for this stage
        const stageSegments = this.currentRouteInfo.segments.filter((s: any) => s.stage === stageIndex + 1);
        const otherSegments = this.currentRouteInfo.segments.filter((s: any) => s.stage !== stageIndex + 1);
        
        // Convert the selected route segments to the format expected by the UI
        const newStageSegments = selectedRoute.segments.map((segment: any) => ({
          type: segment.type,
          from: segment.from,
          to: segment.to,
          fromName: stageIndex === 0 ? 'Your Location' : 'Previous Location',
          toName: 'Destination',
          estimatedTime: this.formatDuration(segment.duration || 0),
          description: segment.description,
          jeepneyCode: segment.jeepneyCode || null,
          mealType: null,
          distance: segment.distance || 0,
          duration: segment.duration || 0,
          stage: stageIndex + 1,
          polyline: segment.polyline
        }));
        
        // Rebuild the segments array
        this.currentRouteInfo.segments = [...otherSegments, ...newStageSegments].sort((a, b) => a.stage - b.stage);
        
        // Recalculate totals
        let totalDuration = 0;
        let totalDistance = 0;
        this.currentRouteInfo.segments.forEach((segment: any) => {
          if (segment.distance) {
            totalDistance += segment.distance / 1000; // Convert to km
          }
          if (segment.duration) {
            totalDuration += segment.duration / 60; // Convert to minutes
          }
        });
        
        this.currentRouteInfo.totalDuration = this.formatDuration(totalDuration * 60);
        this.currentRouteInfo.totalDistance = `${totalDistance.toFixed(1)} km`;
        
        // Redraw the route on the map
        this.displayRouteOnMap(this.currentRouteInfo);
        
        // Hide the options panel
        this.selectedStageForOptions = -1;
        
        this.showToast(`✅ Updated Stage ${stageIndex + 1} route`);
      }
    }
  }

  async generateRouteInfo(itinerary: any): Promise<any> {
    // Generate route information from itinerary using stage-based Google Maps API routing
    if (!itinerary || !itinerary.days) {
      return null;
    }

    // Set loading state
    this.isGeneratingRoute = true;
    
    // Show loading modal for mobile users
    await this.showLoadingModal('🚀 Starting route generation...');

    try {
    const segments: any[] = [];
    let totalDuration = 0;
    let totalDistance = 0;
    let allSpots: any[] = []; // Collect all spots from all days

    for (const day of itinerary.days) {
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
      
      // Add spots from this day to the collection
      allSpots = allSpots.concat(spots);
      
      // Create stages for consecutive spots
      for (let spotIndex = 0; spotIndex < spots.length; spotIndex++) {
        const spot = spots[spotIndex];
        if (!spot || !spot.name) continue;
        
        // Determine the starting point for this stage
        let fromPoint;
        if (spotIndex === 0) {
          // First spot: start from user location
          fromPoint = this.userLocation;
        } else {
          // Subsequent spots: start from previous spot
          fromPoint = spots[spotIndex - 1];
        }
        
        // Validate fromPoint has coordinates (handle both user location and spot objects)
        const fromLat = fromPoint?.lat || fromPoint?.location?.lat;
        const fromLng = fromPoint?.lng || fromPoint?.location?.lng;
        if (!fromPoint || !fromLat || !fromLng) {
          console.warn(`⚠️ Stage ${spotIndex + 1}: Invalid fromPoint coordinates:`, fromPoint);
          continue;
        }
        
        // Validate spot has coordinates
        if (!spot.location || !spot.location.lat || !spot.location.lng) {
          console.warn(`⚠️ Stage ${spotIndex + 1}: Invalid spot coordinates:`, spot);
          continue;
        }
        
        // Update loading progress
        await this.updateLoadingProgress(`🔍 Finding routes for Stage ${spotIndex + 1}: ${spot.name}`);
        
        // Get all available transit routes (jeepney and bus) for this stage using Google Maps API
        const allRoutes = await this.findAllJeepneyRoutes(fromPoint, spot);
        
        if (allRoutes && allRoutes.length > 0) {
          // Sort routes by duration to ensure consistency
          allRoutes.sort((a: any, b: any) => a.totalDuration - b.totalDuration);
          
          
          // Use the first (best) route for the main segments display
          const bestRoute = allRoutes[0];
          // Add segments from the best route
          bestRoute.segments.forEach((segment: any) => {
            const segmentToAdd = {
              type: segment.type,
              from: segment.from, // Keep original coordinate object
              to: segment.to, // Keep original coordinate object
              fromName: spotIndex === 0 ? 'Your Location' : spots[spotIndex - 1]?.name || 'Previous Location',
              toName: spot.name,
              estimatedTime: this.formatDuration(segment.duration || 0),
              description: segment.description,
              jeepneyCode: segment.jeepneyCode || null,
              mealType: null,
              distance: segment.distance || 0,
              duration: segment.duration || 0,
              stage: spotIndex + 1,
              polyline: segment.polyline // Preserve polyline for accurate map drawing
            };
            segments.push(segmentToAdd);
            
            // Add to totals
            if (segment.distance) {
              totalDistance += segment.distance / 1000; // Convert to km
            }
            if (segment.duration) {
              totalDuration += segment.duration / 60; // Convert to minutes
            }
          });
          
          // Store all route options for this stage
          this.stageRouteOptions[spotIndex] = allRoutes;
        } else {
          // No transit route found - add fallback message instead of creating walking segment
          console.log(`⚠️ Stage ${spotIndex + 1}: No transit route found, no transportation data available`);
          
          // Create a "no transport" segment to indicate lack of transportation data
          const fromCoords = spotIndex === 0 ? fromPoint : spots[spotIndex - 1];
          const toCoords = spot;
          
          segments.push({
            type: 'no_transport',
            from: fromCoords,
            to: toCoords,
            fromName: spotIndex === 0 ? 'Your Location' : spots[spotIndex - 1]?.name || 'Previous Location',
            toName: spot.name,
            estimatedTime: 'N/A',
            description: `Sorry, we could not calculate and fetch transit directions from "${spotIndex === 0 ? 'your location' : spots[spotIndex - 1]?.name || 'previous location'}" to "${spot.name}"`,
            jeepneyCode: '⚠️ No transit data',
            mealType: null,
            distance: 0,
            duration: 0,
            stage: spotIndex + 1
          });
          
          // Don't add to totals since no transport is available
          // Skip alternative search to prevent spam when no transport data exists
          console.log(`⚠️ Skipping alternative route search for Stage ${spotIndex + 1} to prevent spam`);
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
            mealType: spot.mealType,
            stage: spotIndex + 1
          });
          totalDuration += 60;
        }
      }
    }

    const result = {
      segments,
      totalDuration: `${Math.round(totalDuration)} min`,
      totalDistance: `${totalDistance.toFixed(1)} km`,
      suggestedRoutes: await this.generateSuggestedRoutes(segments, allSpots, this.userLocation),
      source: 'google_maps_stages'
    };
    
      // Reset loading state and dismiss modal
      this.isGeneratingRoute = false;
      await this.dismissLoadingModal();
      
      // Show success message
      this.showToast('✅ Route generation completed!');
      
      return result;
    } catch (error) {
      console.error('❌ Error generating route info:', error);
      this.isGeneratingRoute = false;
      await this.dismissLoadingModal();
      this.showToast('❌ Error generating routes. Please try again.');
      return null;
    }
  }

  /**
   * Format duration from seconds to readable format
   */
  formatDuration(seconds: number): string {
    const minutes = Math.round(seconds / 60);
    if (minutes < 60) {
      return `${minutes} min`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}min` : `${hours}h`;
    }
  }

  /**
   * Check if route has jeepney segments
   */
  hasJeepneySegments(route: any): boolean {
    return route.segments && route.segments.some((s: any) => s.type === 'jeepney');
  }

  /**
   * Generate walking alternatives using OSRM for when no transport data is available
   */
  private async generateWalkingAlternatives(spots: any[], fromPoint: any): Promise<any> {
    try {
      const walkingSegments = [];
      let totalDistance = 0;
      let totalDuration = 0;
      
      for (let spotIndex = 0; spotIndex < spots.length; spotIndex++) {
        const spot = spots[spotIndex];
        const fromCoords = spotIndex === 0 ? fromPoint : spots[spotIndex - 1];
        
        // Update progress for walking route generation
        await this.updateLoadingProgress(`🚶 Creating walking route to ${spot.name}...`);
        
        // Create OSRM walking route for this segment
        const walkingRoute = await this.createWalkingRouteWithOSRM(fromCoords, spot);
        
        if (walkingRoute && walkingRoute.segments && walkingRoute.segments[0]) {
          const segment = walkingRoute.segments[0];
          
          // Add additional info for display
          const walkingSegment = {
            ...segment,
            fromName: spotIndex === 0 ? 'Your Location' : spots[spotIndex - 1]?.name || 'Previous Location',
            toName: spot.name,
            estimatedTime: this.formatDuration(segment.duration),
            stage: spotIndex + 1,
            jeepneyCode: null,
            mealType: null
          };
          
          walkingSegments.push(walkingSegment);
          totalDistance += segment.distance || 0;
          totalDuration += segment.duration || 0;
        } else {
          // Fallback to straight line if OSRM fails
          console.log(`⚠️ OSRM failed for stage ${spotIndex + 1}, using straight line`);
          const straightLineDistance = this.calculateDistance(
            fromCoords.lat, fromCoords.lng, 
            spot.lat, spot.lng
          ) * 1000; // Convert to meters
          
          walkingSegments.push({
            type: 'walk',
            from: fromCoords,
            to: spot,
            fromName: spotIndex === 0 ? 'Your Location' : spots[spotIndex - 1]?.name || 'Previous Location',
            toName: spot.name,
            estimatedTime: this.formatDuration(straightLineDistance / 1.1), // ~1.1 m/s walking speed
            description: `Walk ${(straightLineDistance / 1000).toFixed(2)}km (straight line - no route data)`,
            jeepneyCode: null,
            mealType: null,
            distance: straightLineDistance,
            duration: straightLineDistance / 1.1,
            stage: spotIndex + 1,
            polyline: null // No polyline for straight line
          });
          
          totalDistance += straightLineDistance;
          totalDuration += straightLineDistance / 1.1;
        }
      }
      
      return {
        segments: walkingSegments,
        totalDistance,
        totalDuration,
        type: 'walking'
      };
      
    } catch (error) {
      console.error('❌ Error generating walking alternatives:', error);
      return null;
    }
  }

  /**
   * Generate suggested routes from segments
   */
  private async generateSuggestedRoutes(segments: any[], spots?: any[], fromPoint?: any): Promise<any[]> {
    const routes = [];
    const jeepneySegments = segments.filter(seg => seg.type === 'jeepney');
    
    if (jeepneySegments.length > 0) {
      routes.push({
        id: 'jeepney_route',
        name: 'Jeepney Route',
        description: 'Public transportation route using jeepneys',
        segments: jeepneySegments,
        type: 'jeepney'
      });
    }
    
    const walkSegments = segments.filter(seg => seg.type === 'walk');
    if (walkSegments.length > 0) {
      routes.push({
        id: 'walking_route',
        name: 'Walking Route',
        description: 'Walking route to destinations',
        segments: walkSegments,
        type: 'walking'
      });
    }
    
      // Check for no_transport segments and offer walking as alternative
    const noTransportSegments = segments.filter(seg => seg.type === 'no_transport');
    if (noTransportSegments.length > 0 && jeepneySegments.length === 0 && spots && fromPoint) {
      // Generate walking routes using OSRM for segments with no transport data
      console.log('🚶 Generating walking alternatives for segments with no transport data...');
      await this.updateLoadingProgress('🚶 Generating walking alternatives...');
      const walkingAlternatives = await this.generateWalkingAlternatives(spots, fromPoint);
      
      if (walkingAlternatives && walkingAlternatives.segments.length > 0) {
        routes.push({
          id: 'walking_alternative',
          name: 'Walking Route',
          description: 'Walking route following streets (no public transport available)',
          segments: walkingAlternatives.segments,
          type: 'walking',
          isAlternative: true
        });
      }
    }
    
    return routes;
  }

  ngAfterViewInit(): void {
    // Ensure DOM is fully ready before initializing map
    setTimeout(() => {
      try {
        this.initMap();
        console.log('✅ Map initialized successfully');
        
        
        // Wait for map to be fully rendered before invalidating size
        setTimeout(() => {
          if (this.map) {
            this.map.invalidateSize();
            console.log('✅ Map size invalidated');
          }
        }, 500);
      } catch (error) {
        console.error('❌ Error initializing map:', error);
      }
    }, 500); // Increased delay to ensure DOM is ready
    
    this.loadItinerary();
    this.loadAvailableItineraries();
    this.loadJeepneyRoutes();
    
    // Automatically get user location on startup
    setTimeout(() => {
      this.getUserLocation();
    }, 1000); // Delay user location to ensure map is ready
    
    // Start continuous location tracking
    setTimeout(() => {
      this.startLocationTracking();
    }, 1500);
    
    // Add global function for popup buttons
    (window as any).openSpotDetails = (spotName: string) => {
      const spot = this.touristSpots.find(s => s.name === spotName);
      if (spot) {
        this.openSpotSheet(spot);
      }
    };

    // Add global function for walking directions
    (window as any).getWalkingDirections = async (spotName: string) => {
      const spot = this.touristSpots.find(s => s.name === spotName);
      if (spot && this.userLocation) {
        try {
          await this.showLoadingModal('🚶 Generating walking route...');
          
          // Create OSRM walking route
          const walkingRoute = await this.createWalkingRouteWithOSRM(this.userLocation, spot);
          
          await this.dismissLoadingModal();
          
          if (walkingRoute && walkingRoute.segments && walkingRoute.segments[0]) {
            // Display the walking route on the map
            this.displayWalkingRoute(walkingRoute.segments[0]);
            this.showToast(`🚶 Walking route to ${spot.name} generated!`);
          } else {
            // Fallback to straight line if OSRM fails
            this.displayStraightLineRoute(this.userLocation, spot);
            this.showToast(`🚶 Showing direct walking path to ${spot.name}`);
          }
        } catch (error) {
          await this.dismissLoadingModal();
          this.showToast('❌ Could not generate walking route. Please try again.');
          console.error('Error generating walking route:', error);
        }
      } else {
        this.showToast('⚠️ Please enable location services to get walking directions.');
      }
    };

    // Add global function for itinerary spot details
    (window as any).openItinerarySpotDetails = (spotName: string) => {
      const spot = this.touristSpots.find(s => s.name === spotName);
      if (spot) {
        this.openSpotSheet(spot);
      }
    };

    // Add global function for marking itinerary as complete
    (window as any).markItineraryComplete = async (itineraryId: string) => {
      try {
        await this.markItineraryAsComplete(itineraryId);
      } catch (error) {
        console.error('Error marking itinerary complete:', error);
        this.showToast('❌ Failed to mark itinerary as complete');
      }
    };

    // Add global function for walking directions from route segments
    (window as any).getWalkingDirectionsForSegment = async (destinationName: string) => {
      if (!this.userLocation) {
        this.showToast('⚠️ Please enable location services to get walking directions.');
        return;
      }

      // Find the destination spot
      let destination = this.touristSpots.find(s => s.name === destinationName);
      
      // If not found in tourist spots, try to find in current route segments
      if (!destination && this.currentRouteInfo && this.currentRouteInfo.segments) {
        const segment = this.currentRouteInfo.segments.find((s: any) => 
          s.toName === destinationName || s.to?.name === destinationName
        );
        
        if (segment && segment.to) {
          destination = {
            name: destinationName,
            location: {
              lat: segment.to.lat || segment.to.location?.lat,
              lng: segment.to.lng || segment.to.location?.lng
            }
          };
        }
      }

      if (!destination || !destination.location) {
        this.showToast('❌ Could not find destination location.');
        return;
      }

      try {
        await this.showLoadingModal('🚶 Generating walking route...');
        
        // Create OSRM walking route
        const walkingRoute = await this.createWalkingRouteWithOSRM(this.userLocation, destination);
        
        await this.dismissLoadingModal();
        
        if (walkingRoute && walkingRoute.segments && walkingRoute.segments[0]) {
          // Display the walking route on the map
          this.displayWalkingRoute(walkingRoute.segments[0]);
          this.showToast(`🚶 Walking route to ${destinationName} generated!`);
        } else {
          // Fallback to straight line if OSRM fails
          this.displayStraightLineRoute(this.userLocation, destination);
          this.showToast(`🚶 Showing direct walking path to ${destinationName}`);
        }
      } catch (error) {
        await this.dismissLoadingModal();
        this.showToast('❌ Could not generate walking route. Please try again.');
        console.error('Error generating walking route for segment:', error);
      }
    };
    
    // Show appropriate markers based on initial tab
    setTimeout(() => {
      if (this.selectedTab === 'directions') {
        this.showDirectionsAndRoutes();
      } else {
        this.showTouristSpots();
      }
    }, 2000); // Increased delay to ensure everything is loaded
    
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
    return this.userLocation?.isReal || false;
  }

  // Getter to get user location status text
  get locationStatusText(): string {
    if (this.isLocationTracking) {
      return this.userLocation?.isReal ? 'GPS Tracking' : 'Default Location';
    }
    return this.userLocation?.isReal ? 'GPS Location' : 'Default Location';
  }

  // Getter to check if location tracking is active
  get isLocationTrackingActive(): boolean {
    return this.isLocationTracking;
  }

  private initMap(): void {
    try {
      if (this.map) {
        this.map.remove();
      }
      
      const mapElement = document.getElementById('map');
      if (!mapElement) {
        console.error('❌ Map element not found in DOM');
        return;
      }
      
      console.log('🗺️ Initializing map...');
      
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
      
      console.log('🗺️ Map created, adding OpenStreetMap tile layer...');
      
      // Add OpenStreetMap tile layer
      const osmLayer = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '© OpenStreetMap contributors',
        maxZoom: 18,
      });
      
      // Add OSM layer
      osmLayer.addTo(this.map);
      
      console.log('🗺️ Tile layer added, loading tourist spots...');
      
      this.loadTouristSpots();
      
      // Ensure map is properly sized
      setTimeout(() => {
        if (this.map) {
          this.map.invalidateSize();
          console.log('✅ Map initialization complete');
        }
      }, 300);
      
    } catch (error) {
      console.error('❌ Error in initMap:', error);
      throw error;
    }
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

    // Only add user marker if userLocation has valid coordinates
    if (userLocation && userLocation.lat && userLocation.lng) {
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
    } else {
      console.warn('⚠️ User location not available for directions display');
    }

    const itinerarySpots: any[] = [];
    
    // Collect all spots from the selected itinerary
    for (const day of selectedItinerary.days) {
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
      
      for (let spotIndex = 0; spotIndex < spots.length; spotIndex++) {
        const spot = spots[spotIndex];
        // Check if spot has valid location coordinates
        let hasValidLocation = false;
        let location = null;
        
        if (spot && spot.location && spot.location.lat && spot.location.lng) {
          // Direct location property
          hasValidLocation = true;
          location = spot.location;
        } else if (spot && spot.extendedProps && spot.extendedProps.location && 
                   spot.extendedProps.location.lat && spot.extendedProps.location.lng) {
          // Location stored in extendedProps (for restaurants/hotels)
          hasValidLocation = true;
          location = spot.extendedProps.location;
        }
        
        if (hasValidLocation) {
          itinerarySpots.push({
            ...spot,
            location: location, // Use the found location
            day: day.day,
            timeSlot: spot.timeSlot,
            order: spotIndex
          });
        } else {
          // For spots without location, try to find matching tourist spot
          if (spot.extendedProps?.type === 'tourist_spot') {
            const matchingSpot = this.touristSpots.find(ts => 
              ts.name === spot.title || ts.id === spot.extendedProps?.spotId
            );
            if (matchingSpot && matchingSpot.location) {
              itinerarySpots.push({
                ...spot,
                location: matchingSpot.location,
                day: day.day,
                timeSlot: spot.timeSlot,
                order: spotIndex
              });
            }
          }
        }
      }
    }


    
    // Create a map to track unique locations and prevent duplicates
    const locationMap = new Map<string, any>();
    let spotIndex = 1;

    // Create markers for each itinerary spot
    for (const spot of itinerarySpots) {
      // Create a unique key for this location (rounded to 4 decimal places to handle slight variations)
      const locationKey = `${spot.location.lat.toFixed(4)},${spot.location.lng.toFixed(4)}`;
      
      // Check if we already have a marker at this location
      if (locationMap.has(locationKey)) {
        continue; // Skip creating duplicate marker
      }
      
      // Add to location map to prevent duplicates
      locationMap.set(locationKey, spot);
      
      const markerIcon = this.getMarkerIconForSpot(spot);
      
      const marker = L.marker([spot.location.lat, spot.location.lng], {
        icon: markerIcon
      }).addTo(this.map);

      // Create popup content with direction info
      const popupContent = await this.createDirectionSpotPopup(spot, spotIndex);
      marker.bindPopup(popupContent);

      marker.on('click', () => {
        this.ngZone.run(() => {
          this.openItinerarySpotSheet(spot);
        });
      });

      this.markers.push(marker);
      spotIndex++;
    }

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

    // Clear route markers
    this.routeMarkers.forEach(marker => {
      if (this.map.hasLayer(marker)) {
        this.map.removeLayer(marker);
      }
    });
    this.routeMarkers = [];
  }

  private clearRouteMarkers(): void {
    // Clear only route markers
    this.routeMarkers.forEach(marker => {
      if (this.map.hasLayer(marker)) {
        this.map.removeLayer(marker);
      }
    });
    this.routeMarkers = [];
  }

  private clearAllRouteLines(): void {
    // Clear all route lines
    this.routeLines.forEach(layer => {
      if (this.map.hasLayer(layer)) {
        this.map.removeLayer(layer);
      }
    });
    this.routeLines = [];

    // Clear route lines
    this.routeLines.forEach(layer => {
      if (this.map.hasLayer(layer)) {
        this.map.removeLayer(layer);
      }
    });
    this.routeLines = [];
  }

  private getMarkerIconForSpot(spot: any): L.DivIcon {
    let iconColor = '#3388ff'; // Default blue for tourist spots
    let iconName = 'location';
    let markerStyle = 'default';

    // Use the new eventType property for better categorization
    if (spot.eventType === 'restaurant') {
      iconColor = '#ff6b35'; // Vibrant orange for restaurants
      iconName = 'restaurant';
      markerStyle = 'restaurant';
    } else if (spot.eventType === 'hotel') {
      iconColor = '#1976d2'; // Blue for hotels
      iconName = 'bed';
      markerStyle = 'hotel';
    } else if (spot.category === 'HOTEL' || spot.name.toLowerCase().includes('hotel')) {
      iconColor = '#1976d2'; // Blue for hotels
      iconName = 'bed';
      markerStyle = 'hotel';
    } else if (spot.category === 'RESTAURANT' || spot.name.toLowerCase().includes('restaurant')) {
      iconColor = '#ff6b35'; // Vibrant orange for restaurants
      iconName = 'restaurant';
      markerStyle = 'restaurant';
    } else {
      // This is a tourist spot (default case)
      iconColor = '#4caf50'; // Green for tourist spots
      iconName = 'location';
      markerStyle = 'default';
    }

    return L.divIcon({
      className: 'custom-marker',
      html: this.createCustomMarkerHTML(iconColor, iconName, markerStyle),
      iconSize: [36, 36],
      iconAnchor: [18, 18],
      popupAnchor: [0, -18]
    } as L.DivIconOptions);
  }

  private createCustomMarkerHTML(iconColor: string, iconName: string, markerStyle: string): string {
    const iconSymbol = this.getIconSymbol(iconName);
    
    switch (markerStyle) {
      case 'restaurant':
        return `
          <div data-type="restaurant" style="
            position: relative;
            width: 36px;
            height: 36px;
            background: linear-gradient(135deg, ${iconColor}, #e65100);
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            border: 3px solid white;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            animation: pulse 2s infinite;
          ">
            <div style="
              transform: rotate(45deg);
              color: white;
              font-size: 18px;
              font-weight: bold;
              text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
            ">${iconSymbol}</div>
            <div style="
              position: absolute;
              top: -8px;
              right: -8px;
              width: 16px;
              height: 16px;
              background: #ffeb3b;
              border-radius: 50%;
              border: 2px solid white;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 10px;
              color: #333;
              font-weight: bold;
            ">🍽️</div>
          </div>
          <style>
            @keyframes pulse {
              0% { transform: rotate(-45deg) scale(1); }
              50% { transform: rotate(-45deg) scale(1.1); }
              100% { transform: rotate(-45deg) scale(1); }
            }
          </style>
        `;
        
      case 'hotel':
        return `
          <div data-type="hotel" style="
            position: relative;
            width: 36px;
            height: 36px;
            background: linear-gradient(135deg, ${iconColor}, #1565c0);
            border-radius: 8px;
            border: 3px solid white;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            animation: float 3s ease-in-out infinite;
          ">
            <div style="
              color: white;
              font-size: 18px;
              font-weight: bold;
              text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
            ">${iconSymbol}</div>
            <div style="
              position: absolute;
              top: -6px;
              right: -6px;
              width: 14px;
              height: 14px;
              background: #4caf50;
              border-radius: 50%;
              border: 2px solid white;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 8px;
              color: white;
              font-weight: bold;
            ">⭐</div>
            <div style="
              position: absolute;
              bottom: -4px;
              left: 50%;
              transform: translateX(-50%);
              width: 0;
              height: 0;
              border-left: 8px solid transparent;
              border-right: 8px solid transparent;
              border-top: 8px solid ${iconColor};
            "></div>
          </div>
          <style>
            @keyframes float {
              0%, 100% { transform: translateY(0px); }
              50% { transform: translateY(-5px); }
            }
          </style>
        `;
        
      default:
        return `
          <div data-type="default" style="
            position: relative;
            width: 36px;
            height: 36px;
            background: linear-gradient(135deg, ${iconColor}, #388e3c);
            border-radius: 50% 50% 50% 0;
            transform: rotate(45deg);
            border: 3px solid white;
            box-shadow: 0 4px 12px rgba(0,0,0,0.3);
            display: flex;
            align-items: center;
            justify-content: center;
            animation: touristBounce 2.5s ease-in-out infinite;
          ">
            <div style="
              transform: rotate(-45deg);
              color: white;
              font-size: 18px;
              font-weight: bold;
              text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
            ">${iconSymbol}</div>
            <div style="
              position: absolute;
              top: -6px;
              right: -6px;
              width: 16px;
              height: 16px;
              background: #ffeb3b;
              border-radius: 50%;
              border: 2px solid white;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 10px;
              color: #333;
              font-weight: bold;
              box-shadow: 0 2px 6px rgba(0,0,0,0.3);
            ">🎯</div>
          </div>
          <style>
            @keyframes touristBounce {
              0%, 100% { transform: rotate(45deg) scale(1); }
              50% { transform: rotate(45deg) scale(1.08); }
            }
          </style>
        `;
    }
  }

  private getIconSymbol(iconName: string): string {
    switch (iconName) {
      case 'restaurant': return '🍽️';
      case 'bed': return '🛏️';
      case 'location': return '📍';
      default: return '📍';
    }
  }



  private getRouteMarkerIcon(spot: any, order: number): L.DivIcon {
    // Determine marker style based on spot type
    let markerStyle = 'default';
    let iconColor = '#007bff';
    let iconSymbol = '🗺️';
    
    if (spot.eventType === 'restaurant') {
      markerStyle = 'restaurant';
      iconColor = '#ff6b35';
      iconSymbol = '🍽️';
    } else if (spot.eventType === 'hotel' || spot.category === 'HOTEL' || spot.name.toLowerCase().includes('hotel')) {
      markerStyle = 'hotel';
      iconColor = '#1976d2';
      iconSymbol = '🛏️';
    } else {
      // This is a tourist spot (default case)
      markerStyle = 'default';
      iconColor = '#4caf50';
      iconSymbol = '📍';
    }
    
    return L.divIcon({
      html: this.createRouteMarkerHTML(iconColor, iconSymbol, markerStyle, order),
      className: 'route-marker',
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });
  }

  private createRouteMarkerHTML(iconColor: string, iconSymbol: string, markerStyle: string, order: number): string {
    switch (markerStyle) {
      case 'restaurant':
        return `
          <div data-type="restaurant" style="
            position: relative;
            width: 40px;
            height: 40px;
            background: linear-gradient(135deg, ${iconColor}, #e65100);
            border-radius: 50% 50% 50% 0;
            transform: rotate(-45deg);
            border: 3px solid white;
            box-shadow: 0 4px 15px rgba(0,0,0,0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            animation: routePulse 2s infinite;
          ">
            <div style="
              transform: rotate(45deg);
              color: white;
              font-size: 20px;
              font-weight: bold;
              text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
            ">${iconSymbol}</div>
            <div style="
              position: absolute;
              top: -10px;
              right: -10px;
              width: 22px;
              height: 22px;
              background: #ffeb3b;
              border-radius: 50%;
              border: 2px solid white;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 12px;
              color: #333;
              font-weight: bold;
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            ">${order}</div>
          </div>
          <style>
            @keyframes routePulse {
              0% { transform: rotate(-45deg) scale(1); }
              50% { transform: rotate(-45deg) scale(1.05); }
              100% { transform: rotate(-45deg) scale(1); }
            }
          </style>
        `;
        
      case 'hotel':
        return `
          <div data-type="hotel" style="
            position: relative;
            width: 40px;
            height: 40px;
            background: linear-gradient(135deg, ${iconColor}, #1565c0);
            border-radius: 10px;
            border: 3px solid white;
            box-shadow: 0 4px 15px rgba(0,0,0,0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            animation: routeFloat 3s ease-in-out infinite;
          ">
            <div style="
              color: white;
              font-size: 20px;
              font-weight: bold;
              text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
            ">${iconSymbol}</div>
            <div style="
              position: absolute;
              top: -8px;
              right: -8px;
              width: 22px;
              height: 22px;
              background: #4caf50;
              border-radius: 50%;
              border: 2px solid white;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 12px;
              color: white;
              font-weight: bold;
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            ">${order}</div>
            <div style="
              position: absolute;
              bottom: -6px;
              left: 50%;
              transform: translateX(-50%);
              width: 0;
              height: 0;
              border-left: 10px solid transparent;
              border-right: 10px solid transparent;
              border-top: 10px solid ${iconColor};
            "></div>
          </div>
          <style>
            @keyframes routeFloat {
              0%, 100% { transform: translateY(0px); }
              50% { transform: translateY(-3px); }
            }
          </style>
        `;
        
      default:
        return `
          <div data-type="default" style="
            position: relative;
            width: 40px;
            height: 40px;
            background: linear-gradient(135deg, ${iconColor}, #388e3c);
            border-radius: 50% 50% 50% 0;
            transform: rotate(45deg);
            border: 3px solid white;
            box-shadow: 0 4px 15px rgba(0,0,0,0.4);
            display: flex;
            align-items: center;
            justify-content: center;
            animation: routeTouristBounce 2.5s ease-in-out infinite;
          ">
            <div style="
              transform: rotate(-45deg);
              color: white;
              font-size: 20px;
              font-weight: bold;
              text-shadow: 1px 1px 2px rgba(0,0,0,0.5);
            ">${iconSymbol}</div>
            <div style="
              position: absolute;
              top: -8px;
              right: -8px;
              width: 22px;
              height: 22px;
              background: #ffeb3b;
              border-radius: 50%;
              border: 2px solid white;
              display: flex;
              align-items: center;
              justify-content: center;
              font-size: 12px;
              color: #333;
              font-weight: bold;
              box-shadow: 0 2px 8px rgba(0,0,0,0.3);
            ">🎯</div>
            <div style="
              position: absolute;
              bottom: -6px;
              left: 50%;
              transform: translateX(-50%);
              width: 0;
              height: 0;
              border-left: 10px solid transparent;
              border-right: 10px solid transparent;
              border-top: 10px solid ${iconColor};
            "></div>
          </div>
          <style>
            @keyframes routeTouristBounce {
              0%, 100% { transform: rotate(45deg) scale(1); }
              50% { transform: rotate(45deg) scale(1.05); }
            }
          </style>
        `;
    }
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

  private async createDirectionSpotPopup(spot: any, order: number): Promise<string> {
    const jeepneyCode = await this.getJeepneyCodeForSpot(spot, order);
    
    // Add restaurant-specific information
    let restaurantInfo = '';
    if (spot.eventType === 'restaurant' && spot.restaurant) {
      restaurantInfo = `
        <p style="margin: 4px 0; color: #ff9800;"><strong>🍽️ Restaurant:</strong> ${spot.restaurant}</p>
        ${spot.rating ? `<p style="margin: 4px 0; color: #ff9800;"><strong>⭐ Rating:</strong> ${spot.rating}★</p>` : ''}
        ${spot.vicinity ? `<p style="margin: 4px 0; color: #ff9800;"><strong>📍 Location:</strong> ${spot.vicinity}</p>` : ''}
      `;
    }
    
    // Add hotel-specific information
    let hotelInfo = '';
    if (spot.eventType === 'hotel' && spot.hotel) {
      const isLastHotel = this.isLastHotelInItinerary(spot);
      
      hotelInfo = `
        <p style="margin: 4px 0; color: #1976d2;"><strong>🏨 Hotel:</strong> ${spot.hotel}</p>
        ${spot.rating ? `<p style="margin: 4px 0; color: #1976d2;"><strong>⭐ Rating:</strong> ${spot.rating}★</p>` : ''}
        ${spot.vicinity ? `<p style="margin: 4px 0; color: #1976d2;"><strong>📍 Location:</strong> ${spot.vicinity}</p>` : ''}
        ${isLastHotel ? `
          <div style="margin: 12px 0; padding: 12px; background: rgba(76, 175, 80, 0.1); border-radius: 8px; border-left: 4px solid #4caf50;">
            <button onclick="window.markItineraryComplete('${this.getItineraryIdFromRoute()}')" 
                    style="background: #4caf50; color: white; border: none; padding: 10px 20px; border-radius: 8px; cursor: pointer; font-weight: bold; font-size: 14px; width: 100%;">
              ✅ Mark Itinerary as Complete
            </button>
          </div>
        ` : ''}
      `;
    }
    
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
        ${restaurantInfo}
        ${hotelInfo}
        ${jeepneyCode ? 
          jeepneyCode.includes('⚠️ No transit data') ? 
            `<div style="margin: 8px 0; padding: 12px; background: rgba(255, 152, 0, 0.1); border-radius: 8px; border-left: 4px solid #ff9800;">
              <p style="margin: 0 0 8px 0; color: #ff9800; font-weight: bold;">Sorry, we could not calculate and fetch transit directions to this location.</p>
              <button onclick="window.getWalkingDirections('${spot.name}')" 
                      style="background: #4caf50; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px;">
                🚶 Get Walking Directions
              </button>
            </div>` :
          jeepneyCode.includes('🚶') ? 
            `<p style="margin: 4px 0; color: #ff6b35; font-weight: bold;"><strong>🚶 Transport:</strong> Walking route available</p>` :
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
          message: 'Sorry, we could not calculate directions for this route.',
          duration: 3000,
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
    try {
      // Request real geolocation permission and get current position
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 300000 // 5 minutes
      });

      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      
      // Snap location to nearest road using OSRM
      const snappedLocation = await this.snapLocationToRoad(lat, lng);
      
      this.userLocation = {
        lat: snappedLocation.lat,
        lng: snappedLocation.lng,
        name: 'Current Location',
        isReal: true
      };
      
      console.log('📍 Real GPS location obtained:', this.userLocation);
      
      // Add or update user marker on map
      if (this.userMarker) {
        this.map.removeLayer(this.userMarker);
      }

      this.userMarker = L.marker([this.userLocation.lat, this.userLocation.lng], {
        icon: L.divIcon({
          html: `<div style="
            background: #4CAF50;
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
      
      console.log('✅ Real GPS location set:', this.userLocation);
      
    } catch (error) {
      console.error('❌ Error getting real location:', error);
      this.showToast('Could not get your location. Please enable location services.');
      
      // Fallback to Cebu City center if geolocation fails
      const cebuCenter = { lat: 10.3157, lng: 123.8854 };
      this.userLocation = {
        lat: cebuCenter.lat,
        lng: cebuCenter.lng,
        name: 'Cebu City Center (Fallback)',
        isReal: false
      };
      
      // Add fallback marker
      if (this.userMarker) {
        this.map.removeLayer(this.userMarker);
      }

      this.userMarker = L.marker([cebuCenter.lat, cebuCenter.lng], {
        icon: L.divIcon({
          html: `<div style="
            background: #ff9800;
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
      
      this.map.setView([cebuCenter.lat, cebuCenter.lng], 13);
    }
  }

  // Start continuous location tracking with real GPS
  async startLocationTracking(): Promise<void> {
    if (this.isLocationTracking) {
      console.log('📍 Location tracking already active');
      return;
    }

    try {
      // Start watching real GPS position
      this.locationWatcher = await Geolocation.watchPosition({
        enableHighAccuracy: true,
        timeout: 30000,
        maximumAge: 60000 // 1 minute
      }, (position) => {
        if (position) {
          this.updateUserLocationFromPosition(position);
        }
      });

      this.isLocationTracking = true;
      console.log('📍 Real GPS location tracking started');
      this.showToast('Location tracking activated');
      
      // Get initial position
      await this.getUserLocation();
      
    } catch (error) {
      console.error('❌ Error starting location tracking:', error);
      this.showToast('Could not start location tracking. Please enable location services.');
    }
  }

  // Stop continuous location tracking
  async stopLocationTracking(): Promise<void> {
    if (!this.isLocationTracking) {
      return;
    }

    // Stop watching GPS position
    if (this.locationWatcher) {
      await Geolocation.clearWatch({ id: this.locationWatcher });
      this.locationWatcher = undefined;
    }
    
    this.isLocationTracking = false;
    console.log('📍 GPS location tracking stopped');
    this.showToast('Location tracking deactivated');
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
      // Get real GPS location
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 300000 // 5 minutes
      });

      const lat = position.coords.latitude;
      const lng = position.coords.longitude;
      
      console.log('📍 Using real GPS location for showUserLocation:', { lat, lng });
      
      // Snap location to nearest road using OSRM
      const snappedLocation = await this.snapLocationToRoad(lat, lng);
      
      if (this.userMarker) {
        this.map.removeLayer(this.userMarker);
      }
      
      // Add new user marker with snapped location
      this.userMarker = L.marker([snappedLocation.lat, snappedLocation.lng], {
        icon: L.divIcon({
          html: `<div style="
            background: #4CAF50;
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
      console.error('Error getting real GPS location:', error);
      this.showToast('Could not get your location. Please enable location services.');
      
      // Return current user location if available, otherwise return Cebu center
      if (this.userLocation) {
        return this.userLocation;
      } else {
        const cebuCenter = { lat: 10.3157, lng: 123.8854 };
        this.userLocation = {
          lat: cebuCenter.lat,
          lng: cebuCenter.lng,
          name: 'Cebu City Center (Fallback)',
          isReal: false
        };
        return cebuCenter;
      }
    }
  }

  private async snapLocationToRoad(lat: number, lng: number): Promise<{lat: number, lng: number}> {
    try {
      // Use OSRM to snap location to nearest road
      const response = await this.http.get(`https://google-places-proxy-ftxx.onrender.com/api/osrm/nearest/${lng},${lat}?profile=driving`).toPromise() as any;
      
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

  /**
   * Create a walking route using OSRM to follow streets instead of straight lines
   */
  private async createWalkingRouteWithOSRM(from: any, to: any): Promise<any> {
    try {
      // Handle different coordinate structures
      const fromLat = from.lat || from.location?.lat;
      const fromLng = from.lng || from.location?.lng;
      const toLat = to.lat || to.location?.lat;
      const toLng = to.lng || to.location?.lng;
      
      // Validate coordinates
      if (!fromLat || !fromLng || !toLat || !toLng) {
        console.error('❌ Invalid coordinates for walking route:', { from, to });
        return null;
      }

      
      // Use OSRM through the directions service for walking route
      const coordinates = `${fromLng},${fromLat};${toLng},${toLat}`;
      const response: any = await this.directionsService.getOsrmRoute(coordinates, 'foot').toPromise();
      
      if (response && response.routes && response.routes[0]) {
        const route = response.routes[0];
        const leg = route.legs[0];
        
        // Handle OSRM geometry (can be GeoJSON or encoded polyline)
        let routePath: L.LatLng[] = [];
        if (route.geometry) {
          if (typeof route.geometry === 'string') {
            // Encoded polyline5 format
            routePath = this.decodeOSRMPolyline(route.geometry);
          } else if (route.geometry.type === 'LineString' && route.geometry.coordinates) {
            // GeoJSON format
            routePath = route.geometry.coordinates.map((coord: number[]) => 
              L.latLng(coord[1], coord[0]) // GeoJSON is [lng, lat], Leaflet expects [lat, lng]
            );
          }
        }
        
        // Create walking segment with OSRM data
        const walkingSegment = {
          type: 'walk',
          from: { lat: fromLat, lng: fromLng },
          to: { lat: toLat, lng: toLng },
          description: `Walk ${(route.distance / 1000).toFixed(2)}km (${Math.round(route.duration / 60)} min)`,
          duration: route.duration, // in seconds
          distance: route.distance, // in meters
          polyline: routePath, // OSRM route path that follows streets
          jeepneyCode: null
        };
        
        
        return {
          segments: [walkingSegment],
          totalDuration: route.duration,
          totalDistance: route.distance,
          type: 'walking'
        };
      } else {
        return null;
      }
      
    } catch (error) {
      console.error('❌ Error creating OSRM walking route:', error);
      return null;
    }
  }

  /**
   * Decode polyline5 geometry from OSRM
   */
  private decodeOSRMPolyline(encoded: string): L.LatLng[] {
    const points: L.LatLng[] = [];
    let index = 0;
    let lat = 0;
    let lng = 0;
    
    while (index < encoded.length) {
      let shift = 0;
      let result = 0;
      let byte: number;
      
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      
      const deltaLat = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
      lat += deltaLat;
      
      shift = 0;
      result = 0;
      
      do {
        byte = encoded.charCodeAt(index++) - 63;
        result |= (byte & 0x1f) << shift;
        shift += 5;
      } while (byte >= 0x20);
      
      const deltaLng = ((result & 1) !== 0 ? ~(result >> 1) : (result >> 1));
      lng += deltaLng;
      
      points.push(L.latLng(lat / 1e5, lng / 1e5));
    }
    
    return points;
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



  private async getJeepneyCodeForSpot(spot: any, order: number): Promise<string> {
    // Find the best jeepney route for this spot
          const bestRoute = await this.findBestJeepneyRoute(this.userLocation, spot);
    
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

  private async findBestJeepneyRoute(from: any, to: any): Promise<any> {
    // Use Google Maps API for stage-based jeepney routing
    return await this.findJeepneyRouteWithGoogleMaps(from, to);
  }

  /**
   * Find all available jeepney routes using Google Maps API
   * Returns multiple route options like Google Maps does
   */
  private async findAllJeepneyRoutes(from: any, to: any): Promise<any[]> {
    try {
      // Handle different coordinate structures
      const fromLat = from.lat || from.location?.lat;
      const fromLng = from.lng || from.location?.lng;
      const toLat = to.lat || to.location?.lat;
      const toLng = to.lng || to.location?.lng;
      
      // Validate coordinates
      if (!fromLat || !fromLng || !toLat || !toLng) {
        console.error('❌ Invalid coordinates:', { from, to });
        return [];
      }
      
      // Check if coordinates are within Cebu bounds
      if (!this.isWithinCebu(fromLat, fromLng) || !this.isWithinCebu(toLat, toLng)) {
        console.log(`⚠️ Coordinates outside Cebu bounds, skipping`);
        return [];
      }
      
      const origin = `${fromLat},${fromLng}`;
      const destination = `${toLat},${toLng}`;
      
      // Use Google Maps Directions API with transit mode to get jeepney routes
      const response: any = await this.directionsService.getTransitRoute(origin, destination).toPromise();
      
      if (response && response.routes && response.routes.length > 0) {
        
        const allRoutes = [];
        
        // Process all routes from Google Maps
        for (let i = 0; i < response.routes.length; i++) {
          const route = response.routes[i];
          
          // Check if this route has any transit steps (jeepney routes)
          const hasTransitSteps = this.hasTransitSteps(route);
          
          if (hasTransitSteps) {
            // Process the route to check if it actually contains transit segments (jeepney or bus)
            const processedRoute = this.processGoogleMapsTransitRoute(route, from, to);
            const hasTransitSegments = processedRoute.segments.some((segment: any) => 
              segment.type === 'jeepney' || segment.type === 'bus'
            );
            
            if (hasTransitSegments) {
              allRoutes.push(processedRoute);
            }
          } else {
            const processedRoute = this.processGoogleMapsTransitRoute(route, from, to);
            allRoutes.push(processedRoute);
          }
        }
        
        return allRoutes;
      }
      
      
      // If we get ZERO_RESULTS, it means there's no public transport available
      // Don't try alternative search to prevent spam logging
      if (response?.status === 'ZERO_RESULTS') {
        console.log(`⚠️ ZERO_RESULTS detected - no public transport available, skipping alternative search to prevent spam`);
        return []; // Return empty array instead of triggering alternative search
      }
      
      return [];
      
    } catch (error) {
      console.error('❌ Error fetching Cebu jeepney routes from Google Maps:', error);
      return [];
    }
  }

  /**
   * Find jeepney route using Google Maps API for point-to-point routing
   * This replaces the local jeepney route data system
   */
  private async findJeepneyRouteWithGoogleMaps(from: any, to: any): Promise<any> {
    try {
      // Handle different coordinate structures
      const fromLat = from.lat || from.location?.lat;
      const fromLng = from.lng || from.location?.lng;
      const toLat = to.lat || to.location?.lat;
      const toLng = to.lng || to.location?.lng;
      
      // Validate coordinates
      if (!fromLat || !fromLng || !toLat || !toLng) {
        console.error('❌ Invalid coordinates:', { from, to });
        return null;
      }
      
      // Check if coordinates are within Cebu bounds
      if (!this.isWithinCebu(fromLat, fromLng) || !this.isWithinCebu(toLat, toLng)) {
        console.log(`⚠️ Coordinates outside Cebu bounds, skipping`);
        return null;
      }
      
      const origin = `${fromLat},${fromLng}`;
      const destination = `${toLat},${toLng}`;
      
      // Use Google Maps Directions API with transit mode to get jeepney routes
      const response: any = await this.directionsService.getTransitRoute(origin, destination).toPromise();
      
      if (response && response.routes && response.routes.length > 0) {
        // Process all routes and find the best one with jeepney codes
        let bestRoute = null;
        let bestJeepneyRoute = null;
        
        for (let i = 0; i < response.routes.length; i++) {
          const route = response.routes[i];
          // Check if this route has any transit steps (jeepney routes)
          const hasTransitSteps = this.hasTransitSteps(route);
          
          if (hasTransitSteps) {
            // Process the route to check if it actually contains transit segments (jeepney or bus)
            const processedRoute = this.processGoogleMapsTransitRoute(route, from, to);
            const hasTransitSegments = processedRoute.segments.some((segment: any) => 
              segment.type === 'jeepney' || segment.type === 'bus'
            );
            
            if (hasTransitSegments) {
              if (!bestJeepneyRoute) {
                bestJeepneyRoute = processedRoute;
              }
            } else {
              if (!bestRoute) {
                bestRoute = processedRoute;
              }
            }
          } else {
            if (!bestRoute) {
              bestRoute = this.processGoogleMapsTransitRoute(route, from, to);
            }
          }
        }
        
        // Prefer jeepney route over walking route
        const finalResult = bestJeepneyRoute || bestRoute;
        if (finalResult && finalResult.segments) {
        }
        return finalResult;
      }
      
      console.log(`⚠️ No routes found from Google Maps`);
      return null; // No fallback to walking
      
    } catch (error) {
      console.error('❌ Error fetching Cebu jeepney route from Google Maps:', error);
      return null; // No fallback to walking
    }
  }

  /**
   * Try alternative routing when Google Maps returns ZERO_RESULTS
   * This happens when the origin is too far from transit routes
   */
  private async tryAlternativeRouteForZeroResults(from: any, to: any): Promise<any[]> {
    console.log(`🔄 Trying alternative routing approach...`);
    
    // Use radius-based search to find nearby jeepney routes
    console.log(`🚶 Looking for nearby jeepney routes within walking distance...`);
    return await this.createWalkingToTransitHubRoute(from, to);
  }

  /**
   * Create a walking route to nearby jeepney stops when no direct transit is available
   */
  private async createWalkingToTransitHubRoute(from: any, to: any): Promise<any[]> {
    console.log(`🚶 Looking for nearby jeepney routes within walking distance...`);
    
    const fromLat = from.lat || from.location?.lat;
    const fromLng = from.lng || from.location?.lng;
    
    // Define search radius in kilometers (reduced to prevent spam)
    const searchRadii = [1.0, 2.0]; // 1km, 2km only - reduced from 5 levels to prevent excessive searching
    
    for (const radius of searchRadii) {
      
      // Try to find transit routes from points around the user's location
      const nearbyPoints = this.generateNearbyPoints(fromLat, fromLng, radius);
      
      // Test fewer points to reduce spam (reduced from 10 to 5)
      const maxPointsToTest = 5;
      const pointsToTest = nearbyPoints.slice(0, maxPointsToTest);
      
      
      for (let pointIndex = 0; pointIndex < pointsToTest.length; pointIndex++) {
        const point = pointsToTest[pointIndex];
        try {
          
          // Use direct API call instead of findAllJeepneyRoutes to avoid recursion
          const nearbyRoutes = await this.testDirectTransitRoute(point, to);
          
          if (nearbyRoutes && nearbyRoutes.length > 0) {
            
            // Calculate walking distance to this nearby point
            const walkingDistance = this.calculateDistance(fromLat, fromLng, point.lat, point.lng);
            
            if (walkingDistance <= radius) {
              
              // Create walking segment to the nearby point
              const walkingSegment = {
                type: 'walk',
                description: `Walk to jeepney route (${walkingDistance.toFixed(2)}km)`,
                duration: Math.round(walkingDistance * 1000 / 1.1), // ~1.1 m/s walking speed
                distance: walkingDistance * 1000, // Convert to meters
                from: {
                  lat: fromLat,
                  lng: fromLng
                },
                to: {
                  lat: point.lat,
                  lng: point.lng
                },
                jeepneyCode: null,
                polyline: null
              };
              
              // Combine walking segment with transit routes
              const combinedRoutes = nearbyRoutes.map(route => ({
                ...route,
                segments: [walkingSegment, ...route.segments],
                totalDuration: walkingSegment.duration + route.totalDuration,
                totalDistance: walkingSegment.distance + route.totalDistance
              }));
              
              return combinedRoutes;
            }
          } else {
            // Reduced logging to prevent spam
          }
        } catch (error) {
          console.log(`❌ Error testing point:`, error);
        }
      }
    }
    
    // If no nearby routes found, return empty array (no routes available)
    console.log(`⚠️ No nearby jeepney routes found within walking distance - stopping search to prevent spam`);
    return [];
  }

  /**
   * Test direct transit route without triggering recursive loops
   */
  private async testDirectTransitRoute(from: any, to: any): Promise<any[]> {
    try {
      const fromLat = from.lat || from.location?.lat;
      const fromLng = from.lng || from.location?.lng;
      const toLat = to.lat || to.location?.lat;
      const toLng = to.lng || to.location?.lng;
      
      // Validate coordinates
      if (!fromLat || !fromLng || !toLat || !toLng) {
        return [];
      }
      
      // Check if coordinates are within Cebu bounds
      if (!this.isWithinCebu(fromLat, fromLng) || !this.isWithinCebu(toLat, toLng)) {
        return [];
      }
      
      const origin = `${fromLat},${fromLng}`;
      const destination = `${toLat},${toLng}`;
      
      // Use Google Maps Directions API with transit mode to get jeepney routes
      const response: any = await this.directionsService.getTransitRoute(origin, destination).toPromise();
      
      if (response && response.routes && response.routes.length > 0) {
        const allRoutes = [];
        
        // Process all routes from Google Maps
        for (let i = 0; i < response.routes.length; i++) {
          const route = response.routes[i];
          // Check if this route has any transit steps (jeepney routes)
          const hasTransitSteps = this.hasTransitSteps(route);
          
          if (hasTransitSteps) {
            // Process the route to check if it actually contains transit segments (jeepney or bus)
            const processedRoute = this.processGoogleMapsTransitRoute(route, from, to);
            const hasTransitSegments = processedRoute.segments.some((segment: any) => 
              segment.type === 'jeepney' || segment.type === 'bus'
            );
            
            if (hasTransitSegments) {
              allRoutes.push(processedRoute);
            }
          }
        }
        
        return allRoutes;
      }
      
      return [];
      
    } catch (error) {
      return [];
    }
  }

  /**
   * Generate nearby points around a location for testing
   */
  private generateNearbyPoints(lat: number, lng: number, radiusKm: number): any[] {
    const points = [];
    const radiusDegrees = radiusKm / 111; // Approximate conversion from km to degrees
    
    // Generate points in a grid pattern around the location (reduced to avoid spam)
    const steps = 4; // Reduced from 8 to 4 to generate fewer points
    const stepSize = radiusDegrees / steps;
    
    for (let i = -steps; i <= steps; i++) {
      for (let j = -steps; j <= steps; j++) {
        const newLat = lat + (i * stepSize);
        const newLng = lng + (j * stepSize);
        
        // Check if point is within the radius
        const distance = this.calculateDistance(lat, lng, newLat, newLng);
        if (distance <= radiusKm) {
          points.push({ lat: newLat, lng: newLng });
        }
      }
    }
    
    return points;
  }


  /**
   * Calculate distance between two coordinates using Haversine formula
   */
  private calculateDistance(lat1: number, lng1: number, lat2: number, lng2: number): number {
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.deg2rad(lat2 - lat1);
    const dLng = this.deg2rad(lng2 - lng1);
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(this.deg2rad(lat1)) * Math.cos(this.deg2rad(lat2)) * 
      Math.sin(dLng/2) * Math.sin(dLng/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    const distance = R * c; // Distance in kilometers
    return distance;
  }

  /**
   * Convert degrees to radians
   */
  private deg2rad(deg: number): number {
    return deg * (Math.PI/180);
  }

  /**
   * Display a walking route on the map
   */
  private displayWalkingRoute(walkingSegment: any): void {
    // Clear existing route lines
    if (this.routeLine) {
      this.map.removeLayer(this.routeLine);
    }
    
    if (walkingSegment.polyline && walkingSegment.polyline.length > 0) {
      // Use OSRM polyline data
      this.routeLine = L.polyline(walkingSegment.polyline, {
        color: '#4caf50',
        weight: 4,
        opacity: 0.8,
        dashArray: '10, 5' // Dashed line for walking
      }).addTo(this.map);
      
      // Fit map to route bounds
      this.map.fitBounds(this.routeLine.getBounds(), { padding: [20, 20] });
    } else {
      // Fallback to straight line
      this.displayStraightLineRoute(walkingSegment.from, walkingSegment.to);
    }
  }

  /**
   * Display a straight line route on the map (fallback)
   */
  private displayStraightLineRoute(from: any, to: any): void {
    // Clear existing route lines
    if (this.routeLine) {
      this.map.removeLayer(this.routeLine);
    }
    
    const fromLat = from.lat || from.location?.lat;
    const fromLng = from.lng || from.location?.lng;
    const toLat = to.lat || to.location?.lat;
    const toLng = to.lng || to.location?.lng;
    
    if (fromLat && fromLng && toLat && toLng) {
      this.routeLine = L.polyline([
        [fromLat, fromLng],
        [toLat, toLng]
      ], {
        color: '#ff9800',
        weight: 3,
        opacity: 0.7,
        dashArray: '15, 10' // Different dash pattern for straight line
      }).addTo(this.map);
      
      // Fit map to route bounds
      this.map.fitBounds(this.routeLine.getBounds(), { padding: [50, 50] });
    }
  }

  /**
   * Check if coordinates are within Cebu bounds
   */
  private isWithinCebu(lat: number, lng: number): boolean {
    // Cebu Province bounds (expanded to include more areas)
    const cebuBounds = {
      north: 11.50,  // Northern boundary (includes Bantayan, Daanbantayan)
      south: 9.50,   // Southern boundary (includes Oslob, Santander)
      east: 124.50,  // Eastern boundary (includes Camotes, Bantayan)
      west: 123.20   // Western boundary (includes Toledo, Balamban)
    };
    
    const isWithin = lat >= cebuBounds.south && lat <= cebuBounds.north &&
                     lng >= cebuBounds.west && lng <= cebuBounds.east;
    
    if (!isWithin) {
    }
    
    return isWithin;
  }

  /**
   * Check if a route has transit steps (jeepney routes)
   */
  private hasTransitSteps(route: any): boolean {
    if (route.legs && route.legs.length > 0) {
      const leg = route.legs[0];
      if (leg.steps) {
        
        // Look for transit steps that might be jeepney routes (Google Directions API format)
        const transitSteps = leg.steps.filter((step: any) => 
          step.travel_mode === 'TRANSIT' && 
          step.transit_details && 
          step.transit_details.line &&
          step.transit_details.line.vehicle?.type === 'BUS' // Focus on bus/jeepney routes
        );
        
        if (transitSteps.length > 0) {
          return true;
        }
        
        // Check if ALL steps are walking (no transit at all)
        const allWalkingSteps = leg.steps.every((step: any) => step.travel_mode === 'WALKING');
        if (allWalkingSteps) {
          return false; // This is a walking-only route, not a transit route
        }
      }
    }
    
    return false;
  }

  /**
   * Process Google Maps transit route response into our internal format
   */
  private processGoogleMapsTransitRoute(route: any, from: any, to: any): any {
    const segments: any[] = [];
    let totalDuration = 0;
    let totalDistance = 0;
    let hasJeepneySegment = false;

    if (route.legs && route.legs.length > 0) {
      const leg = route.legs[0];
      
      if (leg.steps) {
        leg.steps.forEach((step: any, index: number) => {
          const segment = this.processTransitStep(step);
          if (segment) {
            segments.push(segment);
            totalDuration += segment.duration || 0;
            totalDistance += segment.distance || 0;
            
            // Check if this is a transit segment (jeepney or bus)
            if (segment.type === 'jeepney' || segment.type === 'bus') {
              hasJeepneySegment = true;
            }
          }
        });
      }
    }

    const result = {
      segments,
      totalDuration,
      totalDistance,
      from,
      to,
      source: 'google_maps'
    };
    
    return result;
  }

  /**
   * Process individual transit step from Google Maps
   */
  private processTransitStep(step: any): any {
    const travelMode = step.travel_mode; // Google Directions API uses snake_case
    
    if (travelMode === 'WALKING') {
      const segment = {
        type: 'walk',
        description: step.html_instructions || 'Walk to jeepney stop',
        duration: step.duration?.value || 0,
        distance: step.distance?.value || 0,
        from: {
          lat: step.start_location.lat,
          lng: step.start_location.lng
        },
        to: {
          lat: step.end_location.lat,
          lng: step.end_location.lng
        },
        jeepneyCode: null,
        polyline: step.polyline // Preserve polyline data for accurate route visualization
      };
      return segment;
    } else if (travelMode === 'TRANSIT') {
      const transit = step.transit_details; // Google Directions API uses snake_case
      
      if (transit && transit.line) {
        // Extract jeepney code from line information
        const jeepneyCode = this.extractCebuJeepneyCode(transit.line);
        
        // Check if this is a bus/jeepney (not train or other transit)
        const isJeepney = transit.line.vehicle?.type === 'BUS' || 
                         transit.line.name?.toLowerCase().includes('jeepney') ||
                         jeepneyCode; // If we found a jeepney code, it's likely a jeepney
        
        
        if (isJeepney) {
          // Determine if this is a bus or jeepney based on additional criteria
          const isActualBus = this.isActualBus(transit.line);
          const segmentType = isActualBus ? 'bus' : 'jeepney';
          const vehicleName = isActualBus ? 'bus' : 'jeepney';
          
          const segment = {
          type: segmentType,
            description: `Take ${vehicleName} ${jeepneyCode || transit.line.short_name || transit.line.name}`,
          duration: step.duration?.value || 0,
          distance: step.distance?.value || 0,
            jeepneyCode: jeepneyCode || transit.line.short_name,
            from: {
              lat: step.start_location.lat,
              lng: step.start_location.lng
            },
            to: {
              lat: step.end_location.lat,
              lng: step.end_location.lng
            },
          departureStop: transit.departure_stop?.name,
            arrivalStop: transit.arrival_stop?.name,
            lineName: transit.line.name,
            lineShortName: transit.line.short_name,
            polyline: step.polyline // Preserve polyline data for accurate route visualization
        };
          return segment;
        }
      }
    }
    
    return null;
  }

  /**
   * Extract Cebu jeepney code from Google Routes API transit line data
   */
  private extractCebuJeepneyCodeFromRoutesAPI(transitLine: any): string {
    // Try to extract jeepney code from various line properties
    let jeepneyCode = 'Unknown';
    
    if (transitLine.shortName) {
      jeepneyCode = transitLine.shortName;
    } else if (transitLine.name) {
      // Try to extract code from name (e.g., "Route 12A" -> "12A")
      const match = transitLine.name.match(/(\d+[A-Z]?)/);
      if (match) {
        jeepneyCode = match[1];
      } else {
        jeepneyCode = transitLine.name;
      }
    }
    
    return jeepneyCode;
  }

  /**
   * Determine if a transit line is an actual bus (vs jeepney)
   */
  private isActualBus(line: any): boolean {
    const lineName = line.name?.toLowerCase() || '';
    const agencyName = line.agencies?.[0]?.name?.toLowerCase() || '';
    
    // Check for known bus operators/agencies in Cebu
    const busIndicators = [
      'mybus', 'brt', 'bus rapid transit', 'cebu bus', 'city bus',
      'public bus', 'transit bus', 'municipal bus'
    ];
    
    // Check for bus-specific naming patterns
    const hasBusIndicator = busIndicators.some(indicator => 
      lineName.includes(indicator) || agencyName.includes(indicator)
    );
    
    // If it has a jeepney code pattern (like 09G, 12D), it's likely a jeepney
    const hasJeepneyCode = /^[0-9]{1,2}[A-Z]$/.test(line.short_name || '');
    
    return hasBusIndicator && !hasJeepneyCode;
  }

  /**
   * Extract Cebu jeepney code from Google Maps transit line data (legacy)
   */
  private extractCebuJeepneyCode(line: any): string {
    // Try to extract jeepney code from various line properties
    let jeepneyCode = 'Unknown';
    
    if (line.short_name) {
      jeepneyCode = line.short_name;
    } else if (line.name) {
      // Try to extract code from name (e.g., "Jeepney 04L" -> "04L")
      const codeMatch = line.name.match(/(\d+[A-Z]?)/);
      if (codeMatch) {
        jeepneyCode = codeMatch[1];
      } else {
        jeepneyCode = line.name;
      }
    }
    
    return jeepneyCode;
  }


  // Legacy method for backward compatibility - now uses Google Maps
  private async findBestJeepneyRouteLegacy(from: any, to: any): Promise<any> {
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
      this.routeLines.push(walkToStart);

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
      
      this.routeLines.push(walkToLabelMarker);

      // Walking from last waypoint to destination
      const walkToEnd = L.polyline([routePath[routePath.length - 2], routePath[routePath.length - 1]], {
        color: '#28a745',
        weight: 3,
        opacity: 0.8,
        dashArray: '10, 5'
      }).addTo(this.map);
      this.routeLines.push(walkToEnd);
      
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
      
      this.routeLines.push(walkFromLabelMarker);
      
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
        this.routeLines.push(jeepneyLine);
        
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
          
          this.routeLines.push(jeepneyLabelMarker);
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
        this.routeLines.push(jeepneyMarker);
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
    
    this.routeLines.push(jeepneyLine, jeepneyMarker, jeepneyLabelMarker);
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
      this.routeLines.push(walkToStart);
      
      // Walking from last waypoint to destination
      const walkToEnd = L.polyline([routePath[routePath.length - 2], routePath[routePath.length - 1]], {
        color: '#9e9e9e',
        weight: 3,
        opacity: 0.5,
        dashArray: '5, 5'
      }).addTo(this.map);
      this.routeLines.push(walkToEnd);
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
        this.routeLines.push(jeepneyLine);
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
        
        this.routeLines.push(jeepneyMarker);
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
        
        this.routeLines.push(jeepneyLine);
    
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
    
    this.routeLines.push(jeepneyMarker);
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
    
    // Start with user location only if it has valid coordinates
    if (userLocation && userLocation.lat && userLocation.lng) {
      routeCoordinates.push(L.latLng(userLocation.lat, userLocation.lng));
    } else {
      console.warn('⚠️ User location not available for route drawing');
      return;
    }
    
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
        const jeepneyRoute = await this.findBestJeepneyRoute(userLocation, spots[0]);
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
          const jeepneyRoute = await this.findBestJeepneyRoute(currentSpot, nextSpot);
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






  private formatDistance(meters: number): string {
    const km = meters / 1000;
    return km >= 1 ? `${km.toFixed(1)} km` : `${meters}m`;
  }

  private formatFare(cents: number): string {
    const pesos = cents / 100; // Convert cents to pesos
    return `₱${pesos.toFixed(2)}`;
  }





  ////////////////// Method to display jeepney routes on map for reference
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

  ///////////// Enhanced route finding with walking directions to nearest jeepney stop

  private async findRouteWithWalkingDirections(from: any, to: any): Promise<any> {
    const nearestJeepney = this.getNearestJeepneyStop(from);
    const bestRoute = await this.findBestJeepneyRoute(from, to);
    
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

  ///////////////////////// Route Suggestions using Proxy Server

  /**
   * Fetch route suggestions from the proxy server using Google Routes API
   */
  private async fetchRouteSuggestions(origin: any, destination: any, waypoints?: any[]): Promise<any[]> {
    try {
      if (!origin || !destination || !origin.location || !destination.location) {
        console.warn('Invalid origin or destination for route suggestions');
        return [];
      }

      const requestBody: any = {
        origin: {
          location: {
            latLng: {
              latitude: origin.location.lat,
              longitude: origin.location.lng
            }
          }
        },
        destination: {
          location: {
            latLng: {
              latitude: destination.location.lat,
              longitude: destination.location.lng
            }
          }
        },
        travelMode: 'TRANSIT',
        routingPreference: 'TRAFFIC_AWARE',
        computeAlternativeRoutes: true,
        routeModifiers: {
          avoidTolls: false,
          avoidHighways: false
        },
        departureTime: new Date().toISOString(),
        polylineEncoding: 'ENCODED_POLYLINE'
      };

      // Add waypoints if provided
      if (waypoints && waypoints.length > 0) {
        requestBody.waypoints = waypoints.map(waypoint => ({
          location: {
            latLng: {
              latitude: waypoint.location.lat,
              longitude: waypoint.location.lng
            }
          }
        }));
      }

      console.log('🚗 Fetching route suggestions from proxy server...');
      const response: any = await this.directionsService.computeRoutes(requestBody).toPromise();
      
      if (response && response.routes && response.routes.length > 0) {
        console.log(`✅ Found ${response.routes.length} route suggestions`);
        return this.processRouteSuggestions(response.routes, origin, destination);
      } else {
        console.log('⚠️ No route suggestions found');
        return [];
      }
    } catch (error) {
      console.error('❌ Error fetching route suggestions:', error);
      // Fallback to basic route calculation
      return this.generateFallbackRoutes(origin, destination);
    }
  }

  /**
   * Process route suggestions from Google Routes API response
   */
  private processRouteSuggestions(routes: any[], origin: any, destination: any): any[] {
    return routes.map((route, index) => {
      const routeInfo = {
        id: `route_${index}`,
        title: `Route ${index + 1}`,
        summary: this.generateRouteSummary(route),
        totalDuration: this.formatDuration(route.duration),
        totalDistance: this.formatDistance(route.distanceMeters),
        totalFare: this.estimateFare(route),
        segments: this.extractRouteSegments(route),
        polyline: route.polyline?.encodedPolyline,
        routeIndex: index,
        isRecommended: index === 0 // First route is usually the best
      };

      console.log(`🛣️ Processed route ${index + 1}:`, routeInfo.summary);
      return routeInfo;
    });
  }

  /**
   * Generate a human-readable summary of the route
   */
  private generateRouteSummary(route: any): string {
    if (!route.legs || route.legs.length === 0) {
      return 'Direct route';
    }

    const modes = new Set<string>();
    route.legs.forEach((leg: any) => {
      if (leg.steps) {
        leg.steps.forEach((step: any) => {
          if (step.travelMode) {
            modes.add(step.travelMode.toLowerCase());
          }
        });
      }
    });

    const modeList = Array.from(modes);
    if (modeList.length === 1) {
      return `${modeList[0].charAt(0).toUpperCase() + modeList[0].slice(1)} only`;
    } else if (modeList.length === 2) {
      return `${modeList[0].charAt(0).toUpperCase() + modeList[0].slice(1)} + ${modeList[1]}`;
    } else {
      return 'Mixed transport';
    }
  }

  /**
   * Extract route segments from Google Routes API response
   */
  private extractRouteSegments(route: any): any[] {
    if (!route.legs || route.legs.length === 0) {
      return [];
    }

    return route.legs.map((leg: any, index: number) => {
      const segment = {
        from: leg.startLocation?.latLng ? 
          `${leg.startLocation.latLng.latitude.toFixed(4)}, ${leg.startLocation.latLng.longitude.toFixed(4)}` : 
          'Unknown',
        to: leg.endLocation?.latLng ? 
          `${leg.endLocation.latLng.latitude.toFixed(4)}, ${leg.endLocation.latLng.longitude.toFixed(4)}` : 
          'Unknown',
        duration: this.formatDuration(leg.staticDuration || leg.duration),
        distance: this.formatDistance(leg.distanceMeters),
        mode: this.determineTransportMode(leg),
        instructions: this.generateSegmentInstructions(leg),
        polyline: leg.polyline?.encodedPolyline,
        transitDetails: this.extractTransitDetails(leg)
      };

      return segment;
    });
  }

  /**
   * Determine the primary transport mode for a route leg
   */
  private determineTransportMode(leg: any): string {
    if (!leg.steps || leg.steps.length === 0) {
      return 'unknown';
    }

    // Count different transport modes
    const modeCounts: { [key: string]: number } = {};
    leg.steps.forEach((step: any) => {
      const mode = step.travelMode?.toLowerCase() || 'unknown';
      modeCounts[mode] = (modeCounts[mode] || 0) + 1;
    });

    // Return the most common mode
    return Object.keys(modeCounts).reduce((a, b) => 
      modeCounts[a] > modeCounts[b] ? a : b
    );
  }

  /**
   * Generate human-readable instructions for a route segment
   */
  private generateSegmentInstructions(leg: any): string {
    if (!leg.steps || leg.steps.length === 0) {
      return 'Follow the route';
    }

    const instructions = leg.steps.map((step: any) => {
      if (step.travelMode === 'WALKING') {
        return `Walk ${step.staticDuration ? this.formatDuration(step.staticDuration) : ''}`;
      } else if (step.travelMode === 'TRANSIT') {
        return `Take transit ${step.staticDuration ? this.formatDuration(step.staticDuration) : ''}`;
      } else if (step.travelMode === 'DRIVING') {
        return `Drive ${step.staticDuration ? this.formatDuration(step.staticDuration) : ''}`;
      }
      return 'Continue';
    });

    return instructions.join(', ');
  }

  /**
   * Extract transit details from route leg
   */
  private extractTransitDetails(leg: any): any {
    if (!leg.steps) return null;

    const transitSteps = leg.steps.filter((step: any) => step.travelMode === 'TRANSIT');
    if (transitSteps.length === 0) return null;

    // Return details of the first transit step
    const transitStep = transitSteps[0];
    return {
      line: transitStep.transitDetails?.line?.name || 'Transit',
      vehicle: transitStep.transitDetails?.line?.vehicle?.type || 'Bus',
      headsign: transitStep.transitDetails?.headsign || 'Unknown destination'
    };
  }



  /**
   * Estimate fare for the route (basic estimation)
   */
  private estimateFare(route: any): string {
    if (!route.legs) return 'Unknown';
    
    let totalFare = 0;
    route.legs.forEach((leg: any) => {
      if (leg.steps) {
        leg.steps.forEach((step: any) => {
          if (step.travelMode === 'TRANSIT') {
            // Basic fare estimation for Cebu
            totalFare += 15; // ₱15 per transit segment
          }
        });
      }
    });
    
    return totalFare > 0 ? `₱${totalFare}` : 'Free';
  }

  /**
   * Generate fallback routes when API fails
   */
  private generateFallbackRoutes(origin: any, destination: any): any[] {
    const distance = this.getDistance(origin, destination);
    const estimatedTime = Math.round(distance / 0.0011); // Walking speed
    
    return [{
      id: 'fallback_route',
      title: 'Fallback Route',
      summary: 'Walking route (API unavailable)',
      totalDuration: `${estimatedTime} min`,
      totalDistance: `${(distance / 1000).toFixed(1)}km`,
      totalFare: 'Free',
      segments: [{
        from: origin.name || 'Origin',
        to: destination.name || 'Destination',
        duration: `${estimatedTime} min`,
        distance: `${(distance / 1000).toFixed(1)}km`,
        mode: 'walking',
        instructions: `Walk from ${origin.name || 'origin'} to ${destination.name || 'destination'}`,
        polyline: null,
        transitDetails: null
      }],
      polyline: null,
      routeIndex: 0,
      isRecommended: true
    }];
  }

  /**
   * Load and display route suggestions for the selected itinerary
   */
  async loadRouteSuggestions(): Promise<void> {
    if (this.selectedItineraryIndex < 0 || !this.availableItineraries[this.selectedItineraryIndex]) {
      await this.showToast('Please select an itinerary first');
      return;
    }

    const selectedItinerary = this.availableItineraries[this.selectedItineraryIndex];
    if (!selectedItinerary.days || selectedItinerary.days.length === 0) {
      await this.showToast('Selected itinerary has no spots');
      return;
    }

    // Get user location
    const userLocation = this.userLocation || { 
      location: { lat: 10.3157, lng: 123.8854 }, 
      name: 'Cebu City Center' 
    };

    // Get first and last spots from itinerary
    const firstDay = selectedItinerary.days[0];
    const lastDay = selectedItinerary.days[selectedItinerary.days.length - 1];
    
    let firstSpot = null;
    let lastSpot = null;

    if (firstDay && firstDay.spots) {
      const spots = Array.isArray(firstDay.spots) ? firstDay.spots : Object.values(firstDay.spots);
      firstSpot = spots[0];
    }

    if (lastDay && lastDay.spots) {
      const spots = Array.isArray(lastDay.spots) ? lastDay.spots : Object.values(lastDay.spots);
      lastSpot = spots[spots.length - 1];
    }

    if (!firstSpot || !lastSpot) {
      await this.showToast('Could not determine route start and end points');
      return;
    }

    // Fetch route suggestions
    const routeSuggestions = await this.fetchRouteSuggestions(userLocation, lastSpot, [firstSpot]);
    
    if (routeSuggestions.length > 0) {
      // Update current route info with suggestions
      this.currentRouteInfo = {
        totalDuration: routeSuggestions[0].totalDuration,
        totalDistance: routeSuggestions[0].totalDistance,
        totalFare: routeSuggestions[0].totalFare,
        segments: routeSuggestions[0].segments,
        suggestedRoutes: routeSuggestions,
        selectedRouteIndex: 0
      };

      // Display route on map
      this.displayRouteOnMap(routeSuggestions[0]);
      
      await this.showToast(`Found ${routeSuggestions.length} route suggestions`);
    } else {
      await this.showToast('Sorry, we could not calculate transit directions for this route.');
    }
  }

  /**
   * Select a specific route from the suggestions
   */
  selectRoute(routeIndex: number): void {
    if (!this.currentRouteInfo || !this.currentRouteInfo.suggestedRoutes) {
      return;
    }

    const selectedRoute = this.currentRouteInfo.suggestedRoutes[routeIndex];
    if (selectedRoute) {
      this.currentRouteInfo.selectedRouteIndex = routeIndex;
      
      // Update the main route info
      this.currentRouteInfo.totalDuration = selectedRoute.totalDuration;
      this.currentRouteInfo.totalDistance = selectedRoute.totalDistance;
      this.currentRouteInfo.totalFare = selectedRoute.totalFare;
      this.currentRouteInfo.segments = selectedRoute.segments;

      // Display the selected route on the map
      this.displayRouteOnMap(selectedRoute);
      
      console.log(`🛣️ Selected route ${routeIndex + 1}:`, selectedRoute.title);
    }
  }

  /**
   * Display the selected route on the map
   */
  private displayRouteOnMap(route: any): void {
    // Clear existing route lines
    this.clearAllRouteLines();

    // Display route segments with proper jeepney codes and polylines
    if (route.segments && route.segments.length > 0) {
      let allBounds: L.LatLng[] = [];
      
      route.segments.forEach((segment: any, index: number) => {
        // Draw segment based on type
        if ((segment.type === 'jeepney' || segment.type === 'bus') && segment.jeepneyCode) {
          // Draw jeepney/bus route with code
          this.drawJeepneySegment(segment, index);
        } else if (segment.type === 'walk') {
          // Draw walking segment
          this.drawWalkingSegment(segment, index);
        }
        
        // Collect bounds for map fitting
        if (segment.from && segment.to) {
          const fromLat = segment.from.lat || segment.from.location?.lat;
          const fromLng = segment.from.lng || segment.from.location?.lng;
          const toLat = segment.to.lat || segment.to.location?.lat;
          const toLng = segment.to.lng || segment.to.location?.lng;
          
          if (fromLat && fromLng && toLat && toLng) {
            allBounds.push(L.latLng(fromLat, fromLng));
            allBounds.push(L.latLng(toLat, toLng));
          }
        }
      });
      
      // Fit map to show all segments
      if (allBounds.length > 0) {
        const bounds = L.latLngBounds(allBounds);
        this.map.fitBounds(bounds, { padding: [50, 50] });
      }
    } else if (route.polyline) {
      // Fallback to main polyline if no segments
      try {
        const decodedPoints = this.decodePolyline(route.polyline);
        const decodedPolyline = decodedPoints.map(point => L.latLng(point[0], point[1]));
        if (decodedPolyline.length > 1) {
          const routeLine = L.polyline(decodedPolyline, {
            color: '#ff6b35',
            weight: 6,
            opacity: 0.8
          }).addTo(this.map);

          this.routeLines.push(routeLine);
          
          const bounds = L.latLngBounds(decodedPolyline);
          this.map.fitBounds(bounds, { padding: [50, 50] });
        }
      } catch (error) {
        console.error('Error displaying route on map:', error);
      }
    }

    // Display route segments as markers
    if (route.segments && route.segments.length > 0) {
      route.segments.forEach((segment: any, index: number) => {
        // Add start marker
        if (segment.from && (segment.from.lat || segment.from.location?.lat)) {
          const lat = segment.from.lat || segment.from.location?.lat;
          const lng = segment.from.lng || segment.from.location?.lng;
          if (lat && lng) {
            // Offset the route segment marker slightly to avoid overlapping with tourist spot pins
            const offsetLat = lat + 0.0005; // Small offset to the north
            const offsetLng = lng + 0.0005; // Small offset to the east
            
            const marker = L.marker([offsetLat, offsetLng], {
              icon: L.divIcon({
                html: `<div style="
                  background: #ff6b35;
                  color: white;
                  border-radius: 50%;
                  width: 20px;
                  height: 20px;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  font-size: 12px;
                  font-weight: bold;
                ">${index + 1}</div>`,
                className: 'route-segment-marker',
                iconSize: [20, 20],
                iconAnchor: [10, 10]
              })
            }).addTo(this.map);

            // Create popup content based on segment type
            let popupContent = `
              <div style="min-width: 200px;">
                <h4 style="margin: 0 0 8px 0; color: #333;">Route Segment ${index + 1}</h4>
                <p style="margin: 4px 0; color: #666;">${segment.description || 'Route segment'}</p>
            `;
            
            if (segment.type === 'no_transport') {
              // Add walking directions button for no transport segments
              popupContent += `
                <div style="margin: 8px 0; padding: 12px; background: rgba(255, 152, 0, 0.1); border-radius: 8px; border-left: 4px solid #ff9800;">
                  <button onclick="window.getWalkingDirectionsForSegment('${segment.toName || segment.to?.name || 'destination'}')" 
                          style="background: #4caf50; color: white; border: none; padding: 8px 16px; border-radius: 6px; cursor: pointer; font-weight: bold; font-size: 14px; width: 100%;">
                    🚶 Get Walking Directions
                  </button>
                </div>
              `;
            } else {
              // Show duration and distance for normal segments
              popupContent += `
                <p style="margin: 4px 0; color: #666;">Duration: ${segment.duration || segment.estimatedTime || 'Unknown'}</p>
                <p style="margin: 4px 0; color: #666;">Distance: ${segment.distance || 'Unknown'}</p>
              `;
            }
            
            popupContent += `</div>`;
            
            marker.bindPopup(popupContent);

            this.routeLines.push(marker);
          }
        }
      });
    }
  }

  /**
   * Decode Google Maps encoded polyline
   */
  private decodePolyline(encoded: string): [number, number][] {
    const poly = [];
    let index = 0;
    const len = encoded.length;
    let lat = 0;
    let lng = 0;

    while (index < len) {
      let b, shift = 0, result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlat = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lat += dlat;

      shift = 0;
      result = 0;
      do {
        b = encoded.charCodeAt(index++) - 63;
        result |= (b & 0x1f) << shift;
        shift += 5;
      } while (b >= 0x20);
      const dlng = ((result & 1) ? ~(result >> 1) : (result >> 1));
      lng += dlng;

      poly.push([lat / 1e5, lng / 1e5] as [number, number]);
    }
    return poly;
  }

  /**
   * Draw a jeepney segment on the map with route code
   */
  private drawJeepneySegment(segment: any, index: number): void {
    if (!segment.from || !segment.to) {
      return;
    }
    
    // Extract coordinates from different possible formats
    const fromLat = segment.from.lat || segment.from.location?.lat;
    const fromLng = segment.from.lng || segment.from.location?.lng;
    const toLat = segment.to.lat || segment.to.location?.lat;
    const toLng = segment.to.lng || segment.to.location?.lng;
    
    if (!fromLat || !fromLng || !toLat || !toLng) {
      return;
    }
    
    // Check if we have polyline data from Google Maps
    let polylinePoints: [number, number][];
    
    if (segment.polyline && segment.polyline.points) {
      // Use Google Maps encoded polyline for accurate route path
      try {
        polylinePoints = this.decodePolyline(segment.polyline.points);
      } catch (error) {
        // Fallback to straight line
        polylinePoints = [[fromLat, fromLng], [toLat, toLng]] as [number, number][];
      }
    } else {
      // Fallback to straight line if no polyline data
      polylinePoints = [[fromLat, fromLng], [toLat, toLng]] as [number, number][];
    }
    
    // Draw jeepney route line
    const jeepneyLine = L.polyline(polylinePoints, {
      color: '#FF5722', // Orange color for jeepney routes
      weight: 6,
      opacity: 0.8,
      dashArray: '0' // Solid line for jeepney routes
    }).addTo(this.map);
    
    this.routeLines.push(jeepneyLine);
    
    // Add jeepney code marker at the midpoint of the polyline
    const midIndex = Math.floor(polylinePoints.length / 2);
    const midPoint = polylinePoints[midIndex];
    const midLat = midPoint[0];
    const midLng = midPoint[1];
    
    const jeepneyMarker = L.marker([midLat, midLng], {
      icon: L.divIcon({
        html: `<div style="
          background: #FF5722;
          color: white;
          border: 2px solid white;
          border-radius: 8px;
          padding: 4px 8px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 14px;
          font-weight: bold;
          box-shadow: 0 2px 6px rgba(0,0,0,0.4);
          min-width: 40px;
          text-align: center;
        ">${segment.jeepneyCode || '🚌'}</div>`,
        className: 'jeepney-route-marker',
        iconSize: [50, 30],
        iconAnchor: [25, 15]
      })
    }).addTo(this.map);
    
    // Add popup with jeepney code and details
    jeepneyMarker.bindPopup(`
      <div style="text-align: center;">
        <strong>🚌 Jeepney ${segment.jeepneyCode}</strong><br>
        <small>${segment.description || 'Jeepney Route'}</small><br>
        <small>Distance: ${this.formatDistance(segment.distance || 0)}</small><br>
        <small>Duration: ${this.formatDuration(segment.duration || 0)}</small>
      </div>
    `);
    
    this.routeLines.push(jeepneyMarker);
  }
  
  /**
   * Draw a walking segment on the map
   */
  private drawWalkingSegment(segment: any, index: number): void {
      if (!segment.from || !segment.to) {
        return;
      }
      
      // Extract coordinates from different possible formats
      const fromLat = segment.from.lat || segment.from.location?.lat;
      const fromLng = segment.from.lng || segment.from.location?.lng;
      const toLat = segment.to.lat || segment.to.location?.lat;
      const toLng = segment.to.lng || segment.to.location?.lng;
      
      if (!fromLat || !fromLng || !toLat || !toLng) {
        return;
      }
    
    // Check if we have polyline data from Google Maps
    let polylinePoints: [number, number][];
    
    if (segment.polyline && segment.polyline.points) {
      // Use Google Maps encoded polyline for accurate route path
      try {
        polylinePoints = this.decodePolyline(segment.polyline.points);
      } catch (error) {
        // Fallback to straight line
        polylinePoints = [[fromLat, fromLng], [toLat, toLng]] as [number, number][];
      }
    } else {
      // Fallback to straight line if no polyline data
      polylinePoints = [[fromLat, fromLng], [toLat, toLng]] as [number, number][];
    }
    
    // Draw walking route line
    const walkLine = L.polyline(polylinePoints, {
      color: '#4CAF50', // Green color for walking
      weight: 5,
      opacity: 0.8,
      dashArray: '15, 10' // Dashed line for walking
    }).addTo(this.map);
    
    this.routeLines.push(walkLine);
    
    // Add walking marker at the midpoint of the polyline
    const midIndex = Math.floor(polylinePoints.length / 2);
    const midPoint = polylinePoints[midIndex];
    const midLat = midPoint[0];
    const midLng = midPoint[1];
    
    const walkMarker = L.marker([midLat, midLng], {
      icon: L.divIcon({
        html: `<div style="
          background: #4CAF50;
          color: white;
          border: 1px solid white;
          border-radius: 4px;
          padding: 2px 4px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 8px;
          font-weight: bold;
          box-shadow: 0 1px 2px rgba(0,0,0,0.2);
          min-width: 25px;
          text-align: center;
        ">🚶</div>`,
        className: 'walking-route-marker',
        iconSize: [35, 15],
        iconAnchor: [17, 7]
      })
    }).addTo(this.map);
    
    // Add popup with walking details
    walkMarker.bindPopup(`
      <div style="text-align: center;">
        <strong>🚶 Walking</strong><br>
        <small>${segment.description || 'Walk to destination'}</small><br>
        <small>Distance: ${this.formatDistance(segment.distance || 0)}</small><br>
        <small>Duration: ${this.formatDuration(segment.duration || 0)}</small>
      </div>
    `);
    
    this.routeLines.push(walkMarker);
  }






  private async showToast(message: string): Promise<void> {
    const toast = await this.toastCtrl.create({
      message: message,
      duration: 3000,
      position: 'bottom',
      color: 'warning'
    });
    toast.present();
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
      title: this.formatItineraryTitle(this.availableItineraries[this.selectedItineraryIndex]),
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
    componentRef.instance.itineraryId = this.getItineraryIdFromRoute();
    componentRef.instance.currentItinerary = this.getCurrentItinerary();
    

    // Attach to the view container
    this.viewContainerRef.insert(componentRef.hostView);
  }

  private getItineraryIdFromRoute(): string {
    // Generate itinerary ID based on selected itinerary
    if (this.selectedItineraryIndex >= 0 && this.availableItineraries.length > 0) {
      const selectedItinerary = this.availableItineraries[this.selectedItineraryIndex];
      if (selectedItinerary && selectedItinerary.days && selectedItinerary.days.length > 0) {
        const spotNames = selectedItinerary.days
          .map((day: any) => day.spots?.map((spot: any) => spot.name) || [])
          .reduce((acc: any[], spots: any[]) => acc.concat(spots), [])
          .join('_');
        return `itinerary_${spotNames.substring(0, 50).replace(/\s+/g, '_')}`;
      }
    }
    return `itinerary_${Date.now()}`;
  }

  private getCurrentItinerary(): any {
    // Return the currently selected itinerary
    if (this.selectedItineraryIndex >= 0 && this.availableItineraries.length > 0) {
      return this.availableItineraries[this.selectedItineraryIndex];
    }
    return null;
  }

  // Helper method to check if this is the last hotel in the itinerary
  private isLastHotelInItinerary(currentHotelSpot: any): boolean {
    if (!this.availableItineraries || this.selectedItineraryIndex < 0) {
      return false;
    }

    const currentItinerary = this.availableItineraries[this.selectedItineraryIndex];
    if (!currentItinerary || !currentItinerary.days) {
      return false;
    }

    // Find all hotel spots in the itinerary
    const allHotels: any[] = [];
    currentItinerary.days.forEach((day: any) => {
      day.spots?.forEach((spot: any) => {
        if (spot.eventType === 'hotel') {
          allHotels.push(spot);
        }
      });
    });

    // If no hotels or only one hotel, this is the last one
    if (allHotels.length <= 1) {
      return true;
    }

    // Check if this is the last hotel chronologically
    allHotels.sort((a, b) => {
      const timeA = new Date(a.timeSlot || '18:00').getTime();
      const timeB = new Date(b.timeSlot || '18:00').getTime();
      return timeA - timeB;
    });

    const lastHotel = allHotels[allHotels.length - 1];
    return lastHotel.name === currentHotelSpot.name;
  }

  // Mark itinerary as complete
  private async markItineraryAsComplete(itineraryId: string): Promise<void> {
    const alert = await this.alertCtrl.create({
      header: 'Complete Itinerary',
      message: 'Are you sure you want to mark this itinerary as completed? This will move it to your completed itineraries list.',
      buttons: [
        {
          text: 'Cancel',
          role: 'cancel'
        },
        {
          text: 'Mark Complete',
          handler: async () => {
            try {
              // Update all events in this itinerary to completed status
              const allEvents = await this.calendarService.loadAllItineraryEvents();
              console.log('All events for completion check:', allEvents.length);
              console.log('Looking for itineraryId:', itineraryId);
              console.log('Current selected itinerary:', this.availableItineraries[this.selectedItineraryIndex]);
              
              // Get the current itinerary to match against
              const currentItinerary = this.availableItineraries[this.selectedItineraryIndex];
              if (!currentItinerary) {
                console.error('No current itinerary selected');
                return;
              }

              // Collect all spot names from the current itinerary
              const itinerarySpotNames = new Set<string>();
              currentItinerary.days?.forEach((day: any) => {
                day.spots?.forEach((spot: any) => {
                  if (spot.name) itinerarySpotNames.add(spot.name);
                  if (spot.restaurant) itinerarySpotNames.add(spot.restaurant);
                  if (spot.hotel) itinerarySpotNames.add(spot.hotel);
                });
              });

              console.log('Itinerary spot names to match:', Array.from(itinerarySpotNames));

              const itineraryEvents = allEvents.filter(event => {
                // Match events by checking if the event title matches any spot in the current itinerary
                const eventTitle = event.title || '';
                const matches = Array.from(itinerarySpotNames).some(spotName => 
                  eventTitle.includes(spotName) || spotName.includes(eventTitle)
                );
                
                if (matches) {
                  // Event matches current itinerary
                }
                return matches;
              });

              // Update each event's status to completed
              for (const event of itineraryEvents) {
                await this.calendarService.updateEventStatus(event.id!, 'completed');
              }

              // Auto-save transportation estimates if no transport expenses logged
              const autoSavedTransport = await this.autoSaveTransportEstimates(currentItinerary);

              if (autoSavedTransport) {
                this.showToast('🎉 Itinerary completed! Transportation costs auto-saved.');
              } else {
                this.showToast('🎉 Itinerary marked as completed!');
              }
              
              // Refresh the available itineraries to remove completed ones
              await this.loadAvailableItineraries();
              
              // Reset selection if current itinerary was completed
              if (this.availableItineraries.length === 0) {
                this.selectedItineraryIndex = -1;
              } else if (this.selectedItineraryIndex >= this.availableItineraries.length) {
                this.selectedItineraryIndex = 0;
              }
              
            } catch (error) {
              console.error('Error marking itinerary complete:', error);
              this.showToast('❌ Failed to mark itinerary as complete');
            }
          }
        }
      ]
    });

    await alert.present();
  }

  /**
   * Auto-save transportation cost estimates when marking itinerary complete
   * if no transportation expenses have been logged by the user
   * @returns true if transportation estimates were auto-saved, false otherwise
   */
  private async autoSaveTransportEstimates(itinerary: any): Promise<boolean> {
    try {
      // Check if there are any existing transportation expenses for this itinerary
      const existingExpenses = await this.budgetService.getExpenses();
      const transportExpenses = existingExpenses.filter((expense: any) => 
        expense.category === 'transportation' && 
        this.isExpenseForItinerary(expense, itinerary)
      );

      if (transportExpenses.length > 0) {
        return false; // User has already logged transport expenses
      }

      // Get transportation estimates from current route info
      if (!this.currentRouteInfo || !this.currentRouteInfo.segments) {
        return false;
      }

      let totalEstimatedCost = 0;
      const transportSegments: any[] = [];

      // Collect all transportation segments with costs
      for (const segment of this.currentRouteInfo.segments) {
        if (segment.type === 'jeepney' || segment.type === 'bus') {
          const cost = segment.cost || 13; // Use average fare (₱12-15 range)
          totalEstimatedCost += cost;
          transportSegments.push({
            type: segment.type,
            route: segment.jeepneyCode || `${segment.fromName} → ${segment.toName}`,
            cost: cost
          });
        }
      }

      if (totalEstimatedCost > 0) {
        // Create a consolidated transportation expense entry
        const description = transportSegments.length > 1 
          ? `Multiple routes: ${transportSegments.map(s => s.route).join(', ')}`
          : `${transportSegments[0].type.toUpperCase()}: ${transportSegments[0].route}`;

        // Generate consistent itinerary ID for expense tracking
        const itineraryDate = itinerary.date || new Date().toISOString().split('T')[0];
        const expenseItineraryId = `completed_itinerary_${itineraryDate}`;

        await this.budgetService.addTransportationExpense(
          totalEstimatedCost,
          `Auto-saved estimate - ${description}`,
          transportSegments[0].route, // jeepneyCode
          expenseItineraryId, // itineraryId
          undefined // dayNumber
        );

        return true; // Successfully auto-saved transportation estimates
      }

      return false; // No transportation costs to auto-save

    } catch (error) {
      console.error('Error auto-saving transportation estimates:', error);
      // Don't throw error - this is a nice-to-have feature
      return false;
    }
  }

  /**
   * Check if an expense belongs to the given itinerary
   */
  private isExpenseForItinerary(expense: any, itinerary: any): boolean {
    // Check if expense matches itinerary by spot names or date
    if (expense.itineraryId && expense.itineraryId.includes(itinerary.id)) {
      return true;
    }

    // Check by spot names
    const itinerarySpotNames = new Set<string>();
    itinerary.days?.forEach((day: any) => {
      day.spots?.forEach((spot: any) => {
        if (spot.name) itinerarySpotNames.add(spot.name);
        if (spot.restaurant) itinerarySpotNames.add(spot.restaurant);
        if (spot.hotel) itinerarySpotNames.add(spot.hotel);
      });
    });

    return Array.from(itinerarySpotNames).some(spotName => 
      expense.spotName?.includes(spotName) || 
      expense.description?.includes(spotName) ||
      spotName.includes(expense.spotName || '') ||
      spotName.includes(expense.description || '')
    );
  }

  // Route Segment Navigation Methods
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

    console.log(`🔍 Segment ${segmentIndex + 1} data:`, segment);

    // Try multiple ways to get segment coordinates
    let lat, lng;
    
    // Special handling for meal and accommodation segments
    if (segment.type === 'meal' || segment.type === 'accommodation') {
      // For meal/accommodation segments, try to find the restaurant/hotel location
      const placeName = segment.from || segment.to || segment.placeName;
      
      // Try to find the place in tourist spots or itinerary
      if (placeName && typeof placeName === 'string') {
        // Remove emoji and extra text to get clean name
        const cleanName = placeName.replace(/🍽️|🏨|🛏️/g, '').trim();
        
        // Search in tourist spots
        const foundSpot = this.touristSpots.find(spot => 
          spot.name.toLowerCase().includes(cleanName.toLowerCase()) ||
          cleanName.toLowerCase().includes(spot.name.toLowerCase())
        );
        
        if (foundSpot && foundSpot.location) {
          lat = foundSpot.location.lat;
          lng = foundSpot.location.lng;
          console.log(`🍽️ Found meal/accommodation location in tourist spots:`, { lat, lng });
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
                  console.log(`🍽️ Found meal/accommodation location in itinerary:`, { lat, lng });
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
      else if (segment.polyline && segment.polyline.points) {
        try {
          const decodedPoints = this.decodePolyline(segment.polyline.points);
          if (decodedPoints.length > 0) {
            lat = decodedPoints[0][0];
            lng = decodedPoints[0][1];
          }
        } catch (error) {
          console.error('Error decoding polyline:', error);
        }
      }
    }

    console.log(`📍 Found coordinates for segment ${segmentIndex + 1}:`, { lat, lng });

    if (lat && lng && lat !== 0 && lng !== 0) {
      // Pan to the segment location with zoom
      this.map.setView([lat, lng], 16, {
        animate: true,
        duration: 1
      });

      // Show toast with segment info
      this.showToast(`📍 Navigated to Segment ${segmentIndex + 1}: ${this.getSegmentTitle(segment)}`);
    } else {
      console.error(`❌ No valid coordinates found for segment ${segmentIndex + 1}:`, segment);
      this.showToast(`⚠️ Could not find coordinates for Segment ${segmentIndex + 1}`);
    }
  }
}
