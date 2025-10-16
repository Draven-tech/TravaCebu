# Controls Button - Detailed Background Process Flow

This document explains step-by-step what happens in the background when the "Controls" button is pressed and an itinerary is selected in the TravaCebu app.

---

## 📱 User Action: Taps the "Controls" Button

**Location**: Floating button at the bottom-right of the map (yellow circular button with settings icon)

**HTML**: `src/app/user-map/user-map.page.html` (Lines ~160-170)
```html
<div (click)="showItineraryControlsModal()">
  <ion-icon name="settings"></ion-icon>
</div>
```

---

## 🔄 Step-by-Step Background Process

### **1. Modal Opening (`showItineraryControlsModal()`)**

**File**: `src/app/user-map/user-map.page.ts` (Lines ~341-390)

#### 1.1 Load Itineraries (if not already loaded)
```typescript
if (this.availableItineraries.length === 0) {
  await this.loadAvailableItineraries();
  await this.loadJeepneyRoutes();
}
```

**What happens:**
- Calls `loadAvailableItineraries()` which:
  - Fetches all calendar events from Firestore via `CalendarService`
  - Groups events into itineraries using `MapUtilitiesService.groupEventsIntoItineraries()`
  - Stores result in `this.availableItineraries[]`

- Calls `loadJeepneyRoutes()` which:
  - Fetches all jeepney route data from Firestore collection `'jeepney_routes'`
  - Processes and stores routes in `JeepneyRoutingService`

#### 1.2 Create and Present Modal
```typescript
const modal = await this.modalCtrl.create({
  component: ItineraryControlsModalComponent,
  componentProps: {
    availableItineraries: this.availableItineraries,
    selectedItineraryIndex: this.selectedItineraryIndex,
    currentRouteInfo: this.currentRouteInfo,
    // ... other props
  }
});
await modal.present();
```

**What happens:**
- Creates an Ionic modal instance
- Passes current state as `@Input()` props to the modal component
- Presents modal to user with a slide-up animation
- Modal displays:
  - List of available itineraries
  - Current route information (if any)
  - Location tracking status
  - Navigation controls

---

### **2. Modal Initialization (`ItineraryControlsModalComponent.ngOnInit()`)**

**File**: `src/app/modals/itinerary-controls-modal/itinerary-controls-modal.component.ts` (Lines ~29-35)

```typescript
ngOnInit(): void {
  console.log('🔍 Modal initialized with:', {
    availableItineraries: this.availableItineraries,
    availableItinerariesLength: this.availableItineraries?.length,
    selectedItineraryIndex: this.selectedItineraryIndex
  });
}
```

**What happens:**
- Component receives all `@Input()` props from parent
- Logs current state for debugging
- Renders UI with:
  - Itinerary dropdown selector
  - Warning message if no itineraries found
  - Current route details (if any)
  - Navigation buttons

---

### **3. User Selects an Itinerary**

**User Action**: Taps on the itinerary dropdown and selects an option

**HTML**: `src/app/modals/itinerary-controls-modal/itinerary-controls-modal.component.html` (Lines ~37-49)
```html
<ion-select 
  [(ngModel)]="selectedItineraryIndex" 
  (ionChange)="onItineraryChange($event)">
  <ion-select-option *ngFor="let itinerary of availableItineraries; let i = index" 
                     [value]="i">
    {{ formatItineraryTitle(itinerary) }}
  </ion-select-option>
</ion-select>
```

---

### **4. Itinerary Selection Handler (`onItineraryChange()`)**

**File**: `src/app/modals/itinerary-controls-modal/itinerary-controls-modal.component.ts` (Lines ~37-51)

```typescript
onItineraryChange(event: any): void {
  const index = parseInt(event.detail.value);
  // Use service to communicate with parent component
  this.modalCommunication.selectItinerary(index);
}
```

**What happens:**
1. Extracts selected index from event
2. Calls `ModalCommunicationService.selectItinerary(index)`
3. **Modal does NOT dismiss** - stays open for continued interaction

---

### **5. Service Communication (`ModalCommunicationService`)**

**File**: `src/app/services/modal-communication.service.ts` (Lines ~7-15)

```typescript
private itinerarySelectionSubject = new BehaviorSubject<number | null>(null);
public itinerarySelection$ = this.itinerarySelectionSubject.asObservable();

selectItinerary(index: number): void {
  console.log('ModalCommunicationService: Itinerary selected:', index);
  this.itinerarySelectionSubject.next(index);
}
```

**What happens:**
- BehaviorSubject emits new value (selected index)
- All subscribers receive the update
- Service acts as a bridge between modal and parent component

---

### **6. Parent Component Receives Selection**

**File**: `src/app/user-map/user-map.page.ts` (Lines ~294-301)

Subscription was set up in `ngAfterViewInit()`:
```typescript
this.modalCommunication.itinerarySelection$.subscribe((index: number | null) => {
  if (index !== null) {
    console.log('Received itinerary selection from service:', index);
    this.selectedItineraryIndex = index;
    this.loadItineraryRoutes();
  }
});
```

**What happens:**
1. Parent receives selected index
2. Updates `this.selectedItineraryIndex`
3. Calls `loadItineraryRoutes()` to generate the route

---

### **7. Route Generation (`loadItineraryRoutes()`)**

**File**: `src/app/user-map/user-map.page.ts` (Lines ~192-237)

This is the **main routing engine** that processes the itinerary:

#### 7.1 Validation
```typescript
if (this.selectedItineraryIndex < 0 || 
    this.selectedItineraryIndex >= this.availableItineraries.length) {
  return;
}
```

#### 7.2 Get Selected Itinerary
```typescript
const selectedItinerary = this.availableItineraries[this.selectedItineraryIndex];
```

#### 7.3 Start Session
```typescript
this.itinerarySession.startSession(this.selectedItineraryIndex, selectedItinerary);
```

**Session Service** (`src/app/services/itinerary-session.service.ts`):
- Creates a new session object with:
  - Unique session ID
  - Selected itinerary data
  - Current segment index (starts at 0)
  - Start timestamp
  - Active status
- Saves session to `localStorage` for persistence
- Allows resuming if app is closed/reopened

#### 7.4 Generate Route Using Route Planning Service
```typescript
const routeInfo = await this.routePlanning.generateRoute(selectedItinerary);
```

**Route Planning Service** (`src/app/services/route-planning.service.ts`):

This is where the **magic happens**! The service:

1. **Extracts spots from itinerary**:
   ```typescript
   const spots = selectedItinerary.days[0].spots; // First day spots
   ```

2. **Gets user's current location**:
   ```typescript
   const userLocation = await this.locationTracking.getLocationWithFallback();
   ```

3. **Creates ordered waypoints**:
   - Starts from user's location
   - Adds each tourist spot in order
   - Creates array: `[userLocation, spot1, spot2, spot3, ...]`

4. **Generates route segments**:
   For each pair of waypoints (A → B):
   
   a. **Calculate distance**:
   ```typescript
   const distance = this.calculateDistance(fromCoords, toCoords);
   ```
   
   b. **Determine transport mode**:
   ```typescript
   if (distance < 0.5) {
     // Walking distance (< 500m)
     mode = 'walk';
   } else {
     // Find jeepney route
     const jeepneyRoute = await this.jeepneyRouting.findRoute(fromCoords, toCoords);
     if (jeepneyRoute) {
       mode = 'jeepney';
     } else {
       mode = 'walk'; // Fallback
     }
   }
   ```
   
   c. **Create segment object**:
   ```typescript
   {
     type: 'walk' | 'jeepney' | 'meal' | 'accommodation',
     from: [lat, lng],
     to: [lat, lng],
     fromName: 'Starting Point',
     toName: 'Destination Name',
     jeepneyCode: '04L', // if jeepney
     coordinates: [...], // route polyline
     distance: 1234, // meters
     duration: 900, // seconds
     fare: 12 // pesos (if jeepney)
   }
   ```

5. **Adds special segments**:
   - **Meal breaks**: If spot type is 'restaurant'
   - **Accommodation**: If spot type is 'hotel'

6. **Calculates totals**:
   ```typescript
   {
     totalDistance: sum of all segments,
     totalDuration: sum of all durations,
     totalFare: sum of all fares,
     segments: [segment1, segment2, ...]
   }
   ```

#### 7.5 Store Route Info
```typescript
this.currentRouteInfo = routeInfo;
```

#### 7.6 Display First Segment
```typescript
this.currentSegmentIndex = 0;
this.displayCurrentSegment();
```

---

### **8. Display Route on Map (`displayCurrentSegment()`)**

**File**: `src/app/user-map/user-map.page.ts` (Lines ~251-273)

```typescript
displayCurrentSegment(): void {
  // Clear existing route lines
  this.mapManagement.clearAllRouteLines();
  
  const segment = this.currentRouteInfo.segments[this.currentSegmentIndex];
  
  if (segment.type === 'jeepney') {
    this.drawJeepneySegment(segment);
  } else if (segment.type === 'walk') {
    this.drawWalkingSegment(segment);
  }
  
  this.navigateToSegment(this.currentSegmentIndex);
}
```

**What happens:**

#### 8.1 Clear Map
- Removes all existing route polylines from map

#### 8.2 Draw Segment on Map

**For Jeepney Routes** (`drawJeepneySegment()`):
- Draws polyline in **blue** color
- Uses actual jeepney route coordinates
- Adds markers for boarding and alighting points
- Shows jeepney code label

**For Walking Routes** (`drawWalkingSegment()`):
- Draws polyline in **green** color
- Uses direct path coordinates
- Adds start and end markers

#### 8.3 Navigate to Segment
```typescript
navigateToSegment(index: number): void {
  const segment = this.currentRouteInfo.segments[index];
  const bounds = L.latLngBounds([segment.from, segment.to]);
  this.mapManagement.getMap().fitBounds(bounds, { padding: [50, 50] });
}
```

- Zooms map to fit the current segment
- Animates smooth transition
- Centers on the route

---

### **9. Update UI with Route Information**

The modal automatically updates to show:

**Route Summary** (if available):
```html
<ion-card *ngIf="currentRouteInfo">
  <ion-card-content>
    <p><strong>Total Distance:</strong> {{ currentRouteInfo.totalDistance }}m</p>
    <p><strong>Total Duration:</strong> {{ formatDuration(currentRouteInfo.totalDuration) }}</p>
    <p><strong>Total Fare:</strong> ₱{{ currentRouteInfo.totalFare }}</p>
    <p><strong>Current Stage:</strong> {{ currentSegmentIndex + 1 }} / {{ currentRouteInfo.segments.length }}</p>
  </ion-card-content>
</ion-card>
```

---

### **10. Stage Navigation (Next Button)**

**User Action**: Taps "Next" button (yellow floating button above fullscreen toggle)

```typescript
nextSegment(): void {
  this.currentSegmentIndex = (this.currentSegmentIndex + 1) % this.currentRouteInfo.segments.length;
  this.itinerarySession.updateCurrentSegment(this.currentSegmentIndex);
  this.displayCurrentSegment();
  
  const segment = this.currentRouteInfo.segments[this.currentSegmentIndex];
  const segmentTitle = this.getSegmentTitle(segment);
  this.showToast(`Stage ${this.currentSegmentIndex + 1}/${this.currentRouteInfo.segments.length}: ${segmentTitle}`);
}
```

**What happens:**
1. Increments segment index (loops back to 0 at end)
2. Updates session with new progress
3. Clears map and displays new segment
4. Shows toast notification with segment details

---

## 🛑 Stopping an Itinerary

### **Manual Stop**

**User Action**: Taps "Stop Itinerary" button in the controls modal (red button, only visible when an itinerary is active)

**File**: `src/app/user-map/user-map.page.ts` (Lines ~442-464)

```typescript
stopItinerary(): void {
  // Clear route visualization
  this.mapManagement.clearAllRouteLines();
  this.mapManagement.clearRouteMarkers();
  
  // Reset route state
  this.currentRouteInfo = null;
  this.selectedItineraryIndex = -1;
  this.currentSegmentIndex = 0;
  
  // End session
  this.itinerarySession.endSession();
  
  // Clear modal communication
  this.modalCommunication.clearSelection();
  
  // Show confirmation
  this.showToast('🛑 Itinerary stopped');
}
```

**What happens:**
1. **Clears map** - Removes all route polylines and markers
2. **Resets state** - Clears route info and resets indices
3. **Ends session** - Removes session from localStorage
4. **Clears selection** - Resets modal communication service
5. **Shows toast** - Confirms to user that itinerary stopped

---

### **Automatic Stop on App Close**

The app automatically stops active itineraries when:
- App goes to background (mobile)
- App is closed (mobile)
- Browser tab is closed/refreshed (web)
- Component is destroyed

#### **Mobile App State Listener**

**File**: `src/app/user-map/user-map.page.ts` (Lines ~305-316)

```typescript
this.appStateSubscription = App.addListener('appStateChange', (state) => {
  if (!state.isActive) {
    // App is going to background or being closed
    if (this.selectedItineraryIndex >= 0 && this.currentRouteInfo) {
      this.stopItinerary();
    }
  }
});
```

**When triggered:**
- User presses home button
- User switches to another app
- User closes the app
- Device goes to sleep

#### **Browser Close/Refresh Listener (Web)**

**File**: `src/app/user-map/user-map.page.ts` (Lines ~329-335)

```typescript
window.addEventListener('beforeunload', () => {
  if (this.selectedItineraryIndex >= 0 && this.currentRouteInfo) {
    this.stopItinerary();
  }
});
```

**When triggered:**
- Browser tab is closed
- Browser is closed
- Page is refreshed
- User navigates away

#### **Component Destruction**

**File**: `src/app/user-map/user-map.page.ts` (Lines ~1138-1170)

```typescript
ngOnDestroy(): void {
  // Stop itinerary if active
  if (this.selectedItineraryIndex >= 0 && this.currentRouteInfo) {
    this.stopItinerary();
  }
  
  // Cleanup listeners
  if (this.appStateSubscription) {
    this.appStateSubscription.remove();
  }
  // ... other cleanup
}
```

**When triggered:**
- User navigates to another page
- Component is unmounted
- App lifecycle cleanup

---

## 🔄 Session Persistence & Resumption

**File**: `src/app/services/itinerary-session.service.ts`

### Session Storage
All session data is saved to `localStorage` under key `'itinerary_active_session'`:

```typescript
{
  sessionId: "session_1697456789012",
  selectedItineraryIndex: 0,
  selectedItinerary: { /* full itinerary data */ },
  currentSegmentIndex: 2,
  startTime: 1697456789012,
  isActive: true
}
```

### Auto-Resume on App Launch
When the map loads (`ngAfterViewInit`):

```typescript
checkForExistingSession(): void {
  const currentSession = this.itinerarySession.getCurrentSession();
  if (currentSession && currentSession.isActive) {
    this.selectedItineraryIndex = currentSession.selectedItineraryIndex;
    this.currentSegmentIndex = currentSession.currentSegmentIndex;
    this.loadItineraryRoutes();
    this.showToast(`🔄 Resumed session`);
  }
}
```

---

## 📊 Data Flow Summary

### **Starting an Itinerary**

```
User Taps Controls Button
    ↓
showItineraryControlsModal()
    ↓
Load Itineraries from Firestore (if needed)
    ↓
Create & Present Modal
    ↓
User Selects Itinerary
    ↓
onItineraryChange() → ModalCommunicationService
    ↓
Parent Receives Selection
    ↓
loadItineraryRoutes()
    ├─ Start Session (ItinerarySessionService)
    ├─ Generate Route (RoutePlanningService)
    │   ├─ Extract spots from itinerary
    │   ├─ Get user location
    │   ├─ Create waypoints
    │   ├─ For each segment:
    │   │   ├─ Calculate distance
    │   │   ├─ Determine transport mode
    │   │   ├─ Find jeepney route (if needed)
    │   │   └─ Create segment object
    │   └─ Calculate totals
    ├─ Store route info
    └─ Display first segment on map
        ├─ Clear existing routes
        ├─ Draw polyline (blue for jeepney, green for walk)
        ├─ Add markers
        └─ Zoom to fit
```

### **Stopping an Itinerary**

```
User Taps Stop Itinerary Button (or app closes)
    ↓
stopItinerary()
    ├─ Clear route visualization
    │   ├─ Remove all polylines
    │   └─ Remove all route markers
    ├─ Reset state variables
    │   ├─ currentRouteInfo = null
    │   ├─ selectedItineraryIndex = -1
    │   └─ currentSegmentIndex = 0
    ├─ End session
    │   └─ Remove from localStorage
    ├─ Clear modal communication
    │   └─ Reset selection service
    └─ Show confirmation toast
```

### **Auto-Stop Triggers**

```
App State Changes
├─ Mobile: App.addListener('appStateChange')
│   └─ state.isActive = false → stopItinerary()
├─ Web: window.addEventListener('beforeunload')
│   └─ Tab closing → stopItinerary()
└─ Component: ngOnDestroy()
    └─ Component unmounting → stopItinerary()
```

---

## 🎯 Key Components Involved

1. **UserMapPage** - Main controller
2. **ItineraryControlsModalComponent** - UI for controls
3. **ModalCommunicationService** - Bridge for modal ↔ parent communication
4. **ItinerarySessionService** - Session management & persistence
5. **RoutePlanningService** - Core routing logic
6. **JeepneyRoutingService** - Jeepney route finding
7. **MapManagementService** - Map visualization
8. **LocationTrackingService** - User location
9. **CalendarService** - Itinerary data fetching
10. **MapUtilitiesService** - Helper functions

---

## 🚀 Performance Optimizations

- **Lazy Loading**: Itineraries only loaded when modal opens
- **Caching**: Jeepney routes cached after first load
- **Session Persistence**: Avoids re-routing on app resume
- **Segment-by-Segment**: Only displays one route at a time
- **Debouncing**: Prevents multiple rapid selections

---

## 🐛 Debugging

All major steps include console logging:
- 🔄 Loading states
- 📋 Data availability
- 🎯 User actions
- ✅ Completion status

Check browser console for detailed flow tracking!

---

## 📝 Notes

- Modal stays open during route generation
- User can switch itineraries without closing modal
- Session persists across app restarts
- Routes auto-calculate based on user's current location
- Jeepney routes used for longer distances (> 500m)
- Walking routes used for short distances or when no jeepney available

