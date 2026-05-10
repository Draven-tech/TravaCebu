# TravaCebu Admin — Complete transfer specification (Ionic → static web admin)

**Purpose:** Single source of truth to rebuild **`travacebu-admin`** with **behavioral parity** to the Ionic admin. This is not runnable code; it documents every collection, field, validation, API, algorithm, file, and edge case traced from the TravaCebu repo.

**Ionic source root:** `src/app/admin/` (+ `src/app/services/`, `src/app/guards/`, `src/app/utils/`, `src/app/constants/`, `src/environments/`).

**Host routing:** `app-routing.module.ts` loads `path: 'admin'` → `AdminModule` (lazy). All admin URLs are prefixed with **`/admin`**.

---

## Table of contents

1. [Complete file inventory](#1-complete-file-inventory)
2. [Routes and guards](#2-routes-and-guards)
3. [Authentication (full)](#3-authentication-full)
4. [Firestore (full)](#4-firestore-full)
5. [Firebase Storage](#5-firebase-storage)
6. [External HTTP / proxies](#6-external-http--proxies)
7. [Algorithms and business logic (port verbatim)](#7-algorithms-and-business-logic-port-verbatim)
8. [Screen-by-screen behavior](#8-screen-by-screen-behavior)
9. [Services reference (non-admin paths)](#9-services-reference-non-admin-paths)
10. [Environment configuration](#10-environment-configuration)
11. [Local proxy server (`proxy-server.js`)](#11-local-proxy-server-proxy-serverjs)
12. [Static assets](#12-static-assets)
13. [Firestore indexes and security rules](#13-firestore-indexes-and-security-rules)
14. [Known quirks / bugs in Ionic (parity decisions)](#14-known-quirks--bugs-in-ionic-parity-decisions)
15. [Transfer checklist for web admin](#15-transfer-checklist-for-web-admin)

---

## 1. Complete file inventory

### 1.1 Core admin shell

| File | Role |
|------|------|
| `admin.module.ts` | Declares Login, Dashboard, RouteEditorMap, RouteList, RouteDetail; imports `PlacesService`, `HttpClient`. |
| `admin-routing.module.ts` | All `/admin/*` child routes + `AdminGuard` (except login). |

### 1.2 Guards

| File | Role |
|------|------|
| `guards/admin.guard.ts` | `canActivate`: if URL includes `/login` → true; else `authService.isAdmin()` or redirect to `/admin/login?returnUrl=...`. |

### 1.3 Pages (implemented)

| Area | `.ts` | `.html` | `.scss` | Routing module |
|------|-------|---------|---------|----------------|
| Login | `login/login.page.ts` | `login.page.html` | `login.page.scss` | `login-routing.module.ts`, `login.module.ts` |
| Dashboard | `dashboard/dashboard.page.ts` | `dashboard.page.html` | `dashboard.page.scss` | `dashboard-routing.module.ts`, `dashboard.module.ts` |
| Route list | `route-list/route-list.page.ts` | `route-list.page.html` | `route-list.page.scss` | `route-list-routing.module.ts`, `route-list.module.ts` |
| Route detail | `route-detail/route-detail.page.ts` | `route-detail.page.html` | `route-detail.page.scss` | `route-detail-routing.module.ts`, `route-detail.module.ts` |
| Route editor map | `route-editor-map/route-editor-map.page.ts` | `route-editor-map.page.html` | `route-editor-map.page.scss` | `route-editor-map-routing.module.ts`, `route-editor-map.module.ts` |
| Tourist spot editor | `tourist-spot-editor/tourist-spot-editor.page.ts` | `tourist-spot-editor.page.html` | `.scss` | `tourist-spot-editor-routing.module.ts`, `tourist-spot-editor.module.ts` |
| Tourist spot list | `tourist-spot-list/tourist-spot-list.page.ts` | `tourist-spot-list.page.html` | `.scss` | `tourist-spot-list-routing.module.ts`, `tourist-spot-list.module.ts` |
| Tourist spot detail | `tourist-spot-detail/tourist-spot-detail.page.ts` | `tourist-spot-detail.page.html` | `.scss` | `tourist-spot-detail-routing.module.ts`, `tourist-spot-detail.module.ts` |
| Event list | `event-list/event-list.page.ts` | `event-list.page.html` | `.scss` | `event-list-routing.module.ts`, `event-list.module.ts` |
| Event editor | `event-editor/event-editor.page.ts` | `event-editor.page.html` | `.scss` | `event-editor-routing.module.ts`, `event-editor.module.ts` |
| Pending spots | `pending-spots/pending-spots.page.ts` | `pending-spots.page.html` | `.scss` | `pending-spots-routing.module.ts`, `pending-spots.module.ts` |
| Pending local tips | `pending-local-tips/pending-local-tips.page.ts` | `pending-local-tips.page.html` | `.scss` | `pending-local-tips-routing.module.ts`, `pending-local-tips.module.ts` |

### 1.4 Stubs / placeholders (no logic to port)

| File | Notes |
|------|--------|
| `route-admin-service.service.ts` | Empty class. |
| `import-export-panel/*` | Placeholder text only. |
| `coordinate-table/*` | Placeholder text only. |

### 1.5 Tests (optional for web port)

All `*.spec.ts` under `admin/` mirror pages/components; port not required.

---

## 2. Routes and guards

### 2.1 `admin-routing.module.ts` (exact paths)

| Path | Component / loadChildren | Guard |
|------|---------------------------|-------|
| `''` | redirect → `login` | — |
| `login` | `LoginPage` | — |
| `dashboard` | `DashboardPage` | `AdminGuard` |
| `route-list` | `RouteListPage` | `AdminGuard` |
| `route-editor` | `RouteEditorMapPage` | `AdminGuard` |
| `route-editor/:id` | `RouteEditorMapPage` | `AdminGuard` |
| `tourist-spot-editor` | lazy `TouristSpotEditorPageModule` | `AdminGuard` |
| `tourist-spot-list` | lazy `TouristSpotListPageModule` | `AdminGuard` |
| `tourist-spot-detail` | lazy `TouristSpotDetailPageModule` | `AdminGuard` |
| `event-list` | lazy `EventListPageModule` | `AdminGuard` |
| `event-editor` | lazy `EventEditorPageModule` | `AdminGuard` |
| `pending-spots` | lazy `PendingSpotsPageModule` | `AdminGuard` |
| `pending-local-tips` | lazy `PendingLocalTipsPageModule` | `AdminGuard` |

**Note:** `route-editor/:id` is declared but the editor **primarily** receives the route to edit via **`window.history.state.routeToEdit`** (see §8).

---

## 3. Authentication (full)

### 3.1 `auth.service.ts` — admin methods

**`adminLogin(email, password)`**

1. `signInWithEmailAndPassword(email, password)`.
2. `firestore.collection('admins').doc(user.uid).get()`.
3. If **!exists** → `signOut()`, throw `Error` with message **`AuthErrorCodes.adminAccessDenied`** (`'ADMIN_ACCESS_DENIED'`).
4. `setPersistence('local')` (best-effort, logged).
5. `router.navigate(['/admin/dashboard'])`.

**`isAdmin()`**

- `currentUser` must exist.
- `firestore.doc('admins/' + uid).get()` → return `exists === true`.

**`logout()`**

- `signOut()` → `navigate(['/admin/login'])`.

### 3.2 `constants/auth-ui-messages.ts` — admin strings

- **`AuthUiMessages.admin.alertTitle`:** `Administrator sign-in unsuccessful`
- **`loading`:** `Signing in…`
- **`insufficientPrivilege`:** `This account is not authorized for administrative access...`
- **`invalidCredentials`:** `The email address or password entered is incorrect...`
- **`generic`:** `Administrator sign-in could not be completed...`
- **`network`:** network error copy
- **`rateLimited`:** too many attempts copy
- **`serviceUnavailable`:** auth service unavailable copy
- **`invalidEmailFormat`:** invalid email copy
- **`weakPassword`:** weak password copy

**Internal code:** `AuthErrorCodes.adminAccessDenied === 'ADMIN_ACCESS_DENIED'`.

### 3.3 `login.page.ts` — error mapping (after failed `adminLogin`)

Priority order (simplified):

1. Thrown message === `ADMIN_ACCESS_DENIED` → `insufficientPrivilege`.
2. Firebase `code`:
   - `auth/invalid-email` → `invalidEmailFormat`
   - `auth/weak-password` → `weakPassword`
   - `auth/user-not-found` | `auth/wrong-password` | `auth/invalid-credential` → `invalidCredentials`
   - `auth/too-many-requests` → `rateLimited`
   - `auth/network-request-failed` → `network`
   - `code` starts with `auth/requests-from-referer` (`isReferrerBlockedAuth`) → `serviceUnavailable`
3. Else if thrown message matches `/network|fetch|offline/i` → `network`.
4. Else → `generic`.

Presentation: `AlertController`; fallback `ToastController`; fallback `alert()`.

**Form validation:** email: `required`, `email`; password: `required`, `minLength(6)`.

**Back:** `goBack()` sets `window.location.href = '/welcome'`.

### 3.4 Static web admin (this repo)

- Use **Firebase Auth** (email/password) and **Firestore** in the browser; after sign-in, require **`admins/{uid}`** exists (same as Ionic).
- Replicate user-facing strings and error mapping from §3.2–3.3 for parity.

---

## 4. Firestore (full)

### 4.1 `admins`

- **Path:** `admins/{uid}`  
- **Semantics:** Document exists ⇒ user is admin. No schema enforced in app.

### 4.2 `jeepney_routes`

| Field | Type | Notes |
|-------|------|--------|
| `code` | string | Uppercased trim on save |
| `color` | string | Hex |
| `points` | array of `{ lat: number, lng: number }` | Marker waypoints |
| `snapToRoads` | boolean | Polyline uses OSRM/ORS if true |
| `createdAt` | Timestamp | **See §14 — update() overwrites in Ionic** |
| `updatedAt` | Timestamp | |

**List:** `collection('jeepney_routes', ref => ref.orderBy('createdAt', 'desc'))`.

**Delete:** `doc(id).delete()`.

### 4.3 `tourist_spots`

| Field | Type | Notes |
|-------|------|--------|
| `name` | string | Required on save |
| `description` | string | |
| `category` | string | See category mapping §7.2 |
| `img` | string | URL |
| `location` | `{ lat, lng }` | Required on save |
| `googlePlaceId` | string | Optional |
| `rating` | number | Optional |
| `userRatingsTotal` | number | Optional |
| `googlePlaceTypes` | string[] | From Places |
| `exposure` | `'indoor' \| 'mixed' \| 'outdoor'` | §7.1 |
| `createdAt` | Timestamp | New docs only in editor |
| `updatedAt` | Timestamp | |

**List:** `orderBy('createdAt', 'desc')`.

**Delete:** remove doc; if `img` is Storage URL, `deleteFileByURL`.

### 4.4 `events` (global events)

**Types** (`calendar.service.ts` — `GlobalEvent`):

| Field | Type |
|-------|------|
| `id` | string (doc id) |
| `name` | string |
| `description` | string |
| `date` | string `YYYY-MM-DD` |
| `time` | string `HH:mm` |
| `endTime` | string `HH:mm` (same day) |
| `location` | string |
| `spotId` | string (ref `tourist_spots`) |
| `imageUrl` | string |
| `createdBy` | string (uid) |
| `createdByType` | `'admin' \| 'user'` |
| `eventType` | `'admin_event' \| 'user_itinerary' \| 'tourist_spot' \| 'restaurant' \| 'hotel'` |
| `status` | `'active' \| 'completed'` |
| `createdAt` | Timestamp |
| `updatedAt` | Timestamp (optional) |

**saveGlobalEvent** — adds doc with `createdBy` = current uid, `createdAt` = now, `status: 'active'`.

**updateGlobalEvent(id, partial)** — merges `updatedAt: new Date()`.

**deleteGlobalEvent(id)** — delete doc.

**loadAdminEvents** — loads **all** documents in `events`, then **filters client-side:**  
`createdByType === 'admin' && createdBy === currentUser.uid`.

*(You may query with `where('createdBy','==',uid).where('createdByType','==','admin')` if indexes allow — behavior should match the in-memory filter.)*

### 4.5 `pending_tourist_spots`

See `PendingTouristSpot` in `pending-tourist-spot.service.ts`:

| Field | Type |
|-------|------|
| `name`, `description`, `category` | string |
| `location` | `{ lat, lng }` |
| `img` | string |
| `googlePlaceId?` | string |
| `rating?`, `userRatingsTotal?` | number |
| `submittedBy` | uid |
| `submittedByEmail?` | string |
| `status` | `'pending' \| 'approved' \| 'rejected'` |
| `submittedAt` | Timestamp |
| `reviewedAt?`, `reviewedBy?`, `reviewNotes?` | |

**Queries:** `where('status','==', ...)`.

**approveSpot(id, notes?)**  
- Update pending: `status: 'approved'`, `reviewedAt`, `reviewedBy`, `reviewNotes`.  
- **Add** to `tourist_spots`:

```text
name, description, category, location, img, googlePlaceId,
rating (default 0), userRatingsTotal (default 0),
createdAt: submittedAt, updatedAt: now,
approvedFrom: pendingDocId, approvedBy: uid, approvedAt: now
```

**rejectSpot(id, reviewNotes)** — update pending with `rejected` + reviewed fields.

**deletePendingSpot(id)** — delete doc only.

### 4.6 `pending_local_tips`

| Field | Type |
|-------|------|
| `spotId`, `spotName` | string |
| `tipText`, `normalizedTip` | string |
| `submittedBy` | uid |
| `submittedAt` | Timestamp |
| `status` | `'pending' \| 'approved' \| 'rejected'` |
| `reviewNotes?`, `reviewedAt?`, `reviewedBy?` | |

**approveTip(tipId, reviewNotes?)**  
1. Read pending doc; must be `status === 'pending'`.  
2. **Add** to `tourist_spots/{spotId}/local_tips`:

```text
tipText, submittedBy, submittedAt, approvedAt, approvedBy, sourcePendingTipId
```

3. Update pending: `status: 'approved'`, `reviewNotes`, `reviewedAt`, `reviewedBy`.

**rejectTip(tipId, reviewNotes)** — reason required (non-empty trim); update pending to `rejected`.

**User submission rules** (for parity when implementing public API): tip length 20–300 chars, daily pending limit 3, duplicate check on `(submittedBy, spotId, normalizedTip)` — see `local-tips.service.ts`.

### 4.7 `api_usage` (Dashboard widget)

**Path:** `api_usage/{userId}/calls/{autoId}`

**Document fields (`logApiCall`):**

| Field | Type |
|-------|------|
| `api` | string (e.g. `'places'`) |
| `endpoint` | string |
| `params` | any (optional) |
| `success` | boolean (always true in logger) |
| `timestamp` | Timestamp |
| `date` | string `YYYY-MM-DD` |
| `userId` | string |

**getApiUsageStats:**  
- If **`admins/{uid}` exists** → `collectionGroup('calls')` full scan, aggregate `total`, `today`, `byApi[api].total|.today`.  
- Else → only `api_usage/{uid}/calls`.

**canCallApiToday(api, limit=100)** — count docs for user where `api` and `date` = today.

---

## 5. Firebase Storage

### 5.1 Upload (client SDK)

- **Tourist spot:** path `tourist_spots/{Date.now()}_{originalFileName}`
- **Event:** path `events/{Date.now()}_{originalFileName}`

Returns **download URL** stored in Firestore `img` / `imageUrl`.

### 5.2 Delete by URL (`storage.service.ts`)

1. `new URL(fileURL)`
2. Regex on `pathname`: `/\/o\/(.+?)\?/`
3. `decodeURIComponent` captured group → Firebase Storage object path
4. `deleteObject(ref(storage, filePath))`

**Implementation:** Parse the same URL pattern (or store the object path in Firestore) to delete reliably.

---

## 6. External HTTP / proxies

### 6.1 Route snapping (admin map)

**OSRM (default in UI):**

- GET `https://router.project-osrm.org/route/v1/driving/{lng1},{lat1};{lng2},{lat2};...?overview=full&geometries=geojson`
- Response `routes[0].geometry.coordinates` — **GeoJSON order `[lng, lat]`** — map to LatLng as `latLng(coord[1], coord[0])`.

**Health check:** small GET to same host with Cebu coords; sets UI status online/offline.

**OpenRouteService (alternate):**

- POST `https://api.openrouteservice.org/v2/directions/driving-car/geojson`
- Headers: `Authorization: {environment.openRouteServiceApiKey}`, `Content-Type: application/json`
- Body: `{ coordinates: [ [lng, lat], ... ] }`
- Response `features[0].geometry.coordinates` — same `[lng,lat]` mapping.

### 6.2 Map tiles

- Esri: `https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}`
- OSM: `https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png`

### 6.3 Google Places (as wired in `places.service.ts`)

**API key:** `environment.googleMapsApiKey` (query param `key`).

**Hosted proxy (hardcoded in Ionic):**

| Method | URL |
|--------|-----|
| Nearby-style (used in service for generic nearby) | `GET https://google-places-proxy-ftxx.onrender.com/api/places` |
| Text search | `GET https://google-places-proxy-ftxx.onrender.com/api/place/textsearch` |
| Place details / photos | `GET https://google-places-proxy-ftxx.onrender.com/api/place/details` |

**Parameters:**

- **textsearch:** `query` = `{name} Cebu Philippines`, `location` = `10.3157,123.8854`, `radius` = `30000`, `key`
- **details:** `place_id`, `fields` (see below), `key`
- **details for photos:** same URL, `fields=photos` (or combined in editor flow)

**Details fields used:**  
`name,formatted_address,geometry,photos,types,rating,user_ratings_total,opening_hours`

**Client-side filter** on text search results: `formatted_address` must mention one of (lowercase):  
`cebu`, `philippines`, `cebu city`, `mandaue`, `lapu-lapu`, `talisay`.

**Photo URL builder:**

`https://maps.googleapis.com/maps/api/place/photo?maxwidth={400}&maxheight={300}&photo_reference={ref}&key={apiKey}`

**Admin tourist spot editor flow:** `searchPlaceByName` → pick result → `getPlaceDetails(place_id)` → `getPlacePhotos(place_id)` optional → `getPhotoUrl(first.photo_reference)`.

**Places calls also invoke** `apiTracker.logApiCall('places', endpoint, params)` (best-effort).

---

## 7. Algorithms and business logic (port verbatim)

### 7.1 `exposureFromGooglePlaceTypes`

Copy implementation exactly from `src/app/utils/spot-exposure.util.ts` (included in repo).  
Returns `'indoor' | 'mixed' | 'outdoor'`. Empty/null types ⇒ `'mixed'`.

### 7.2 Category from Google `types` (`tourist-spot-editor.page.ts`)

Map first matching key in order:

| Google type | category |
|-------------|----------|
| `shopping_mall` | `mall` |
| `amusement_park` | `attraction` |
| `aquarium` | `attraction` |
| `art_gallery` | `museum` |
| `museum` | `museum` |
| `park` | `park` |
| `natural_feature` | `attraction` |
| `tourist_attraction` | `attraction` |
| `point_of_interest` | `attraction` |
| `establishment` | `attraction` |
| `restaurant` | `restaurant` |
| `lodging` | `hotel` |
| `church` | `church` |
| `beach` | `beach` |

Default: `attraction`.

Source for types: `placeDetails.result.types` or `googlePlace.types`.

### 7.3 `PlacesImageService.getFirestoreUpdatePayload(enhancedSpot)`

Build object (omit if empty):

- If `googleImages.length > 0` → `img` = first image URL
- If `googlePlaceTypes.length` → `googlePlaceTypes`
- `exposure` = `enhancedSpot.exposure ?? exposureFromGooglePlaceTypes(googlePlaceTypes)`
- If `googlePlaceId` → `googlePlaceId`

If no keys, return null (no Firestore write).

### 7.4 Places image matching (summary)

- **findBestMatch:** normalize names (lowercase, strip non-alphanumeric from comparison), similarity = (# words common to both) / max(word counts); pick highest.
- **retryFetchImages:** clear in-memory cache for spot id, run `enhanceTouristSpot` again.
- **enhance flow:** use existing `googlePlaceId` or text search by spot name + location; then details; fallback searches vary name (full, no punctuation, first word, first two words).

### 7.5 Tourist spot list — TEMP bulk sync (`runTempBulkPlacesSync`)

For each doc in `tourist_spots`:

- Skip if no `name` or invalid `location.lat/lng`
- Skip if `googlePlaceTypes` (or legacy `google_place_types`) is non-empty array
- Else `placesImageService.retryFetchImages(spot)` → `getFirestoreUpdatePayload` → `doc.update(patch + { updatedAt })`
- Sleep **400ms** between docs
- Clear Places image cache at start

Show counts: updated, skipped already synced, skipped invalid, no payload, failed.

---

## 8. Screen-by-screen behavior

### 8.1 Login

- Fields: email, password; submit disabled if invalid.
- Submit → loading “Signing in…” → `adminLogin`.
- Back → `/welcome`.

### 8.2 Dashboard

- Cards navigate: route-editor, route-list, tourist-spot-editor, tourist-spot-list, event-editor, event-list, pending-spots, pending-local-tips.
- Logout → `authService.logout()`.
- API card: `loadApiUsageStats()` → total, today, per-api breakdown; loading spinner.

### 8.3 Route list

- Load `jeepney_routes` desc; search filters `code` (case-insensitive).
- Tap row → modal **Route detail** with `route` input.
- Slide **edit** → `navigateForward /admin/route-editor` with **`state: { routeToEdit: route }`**.
- Slide **delete** → confirm → Firestore delete.
- FAB → `/admin/route-editor` (new).
- Top: back dashboard, refresh reload subscription.
- **Debug:** template shows `route | json` in list (parity optional).

### 8.4 Route detail (modal)

- Leaflet map id `route-detail-map`, height 300px; Esri tiles.
- Line: `snapToRoads !== false` → OSRM path else straight segments.
- FAB: edit (closes modal, navigates route-editor with `routeToEdit`), delete forever (Firestore delete, close).

### 8.5 Route editor map

- Init: center Cebu `10.3157`, `123.8854`, zoom 15; or restore from `history.state.routeToEdit` (markers + fields).
- Click map → add draggable marker; drag → refresh line.
- Tile select: Esri vs OSM.
- Snapping service select: `osrm` | `ors`.
- OSRM status indicator + refresh test request.
- FAB menu: clear, remove last pin, save.
- **Save validation:** non-empty `routeCode`; at least 2 markers.
- **Persist:**  
  - New: `add`  
  - Edit: `update` with same payload shape  
  **Ionic sets `createdAt` on every save in payload — see §14.**

### 8.6 Tourist spot editor

- **Edit detection:** `history.state.spotToEdit` (NOT `spot` — see §14).
- Map click → single marker (replace previous).
- Tile Esri/OSM.
- Google: alert modal search → textsearch → alert radio pick → details + photos; fills name, description, types→category, place id, ratings, optional photo URL.
- Image: file input → preview; or Google photo URL; manual upload wins on save.
- **Save validation:** name non-empty, marker exists.
- **Image logic:** file → upload Storage; else if `googlePlacesImageUrl` use it; else empty if cleared.
- **Firestore:** merge `googlePlaceTypes` + `exposure` when types present; `createdAt` only if !editing.
- Navigate back: edit → tourist-spot-list; create → dashboard.

### 8.7 Tourist spot list

- `orderBy createdAt desc`; search name + description substring.
- Tap → modal **Tourist spot detail** with `spot`.
- Slide edit → **`state: { spot }` only** (broken for editor — §14).
- Slide delete → confirm → fetch doc, delete storage if `img`, delete doc.
- FAB → new editor.
- TEMP bulk button + progress bar.

### 8.8 Tourist spot detail (modal)

- Image, map `spot-detail-map`, fields, FAB edit (`spotToEdit`), delete (storage + doc).

### 8.9 Event editor

- Guard: `isAdmin` else back to login.
- Load all `tourist_spots` once; sort name; modal picker with search filter (name, category, description).
- Fields: name*, description, date*, start time*, end time*, location via spot picker* (`spotId`, `eventLocation` = spot name).
- Image file → `events/...` upload; on replace delete old URL.
- **Validation:** name, date, start, end, `end > start` (string compare HH:mm), `selectedSpotId` required.
- **Persist:** `saveGlobalEvent` or `updateGlobalEvent` with `createdByType: 'admin'`, `eventType: 'admin_event'`, `status: 'active'`.
- Navigate back: edit → event-list; create → dashboard.

### 8.10 Event list

- **Tabs:** `event-list` | `calendar`.
- **Load:** `loadAdminEvents` (all events filtered to this admin).
- **List tab:** search; “PREVIOUS EVENTS” modal; **upcoming** list sorted future-first then past; pagination 6/page; slide delete; tap → detail modal (edit/delete).
- **Calendar tab:** month nav; `viewMode` grid vs agenda; grid 42 cells; click day with events → date events modal → event modal; agenda grouped by week.
- FAB → event-editor.

### 8.11 Pending spots

- `checkAdminAccess` on init.
- Three subscriptions: pending, approved, rejected (`getPendingSpots` / `getSpotsByStatus`).
- Segments; approve/reject alerts with optional notes; reject requires notes (toast if empty on reject path in handler).
- Delete, view details alert HTML.

### 8.12 Pending local tips

- Admin check → else toast + login.
- Same three statuses via `getTipsByStatus`.
- Approve/reject flows as in §4.6.

---

## 9. Services reference (non-admin paths)

| Service | File | Admin usage |
|---------|------|-------------|
| `AuthService` | `services/auth.service.ts` | Login, isAdmin, logout |
| `PlacesService` | `services/places.service.ts` | Text search, details, photos, photo URL |
| `PlacesImageService` | `services/places-image.service.ts` | Bulk sync, enhance payload |
| `StorageService` | `services/storage.service.ts` | Upload, delete by URL |
| `CalendarService` | `services/calendar.service.ts` | Global events CRUD, loadAdminEvents |
| `PendingTouristSpotService` | `services/pending-tourist-spot.service.ts` | Pending queue + approve/reject |
| `LocalTipsService` | `services/local-tips.service.ts` | Pending tips + approve/reject |
| `ApiTrackerService` | `services/api-tracker.service.ts` | Log calls, dashboard stats |

---

## 10. Environment configuration

`environment.example.ts` keys:

| Key | Purpose |
|-----|---------|
| `production` | boolean |
| `firebase.*` | Standard Firebase web config |
| `googleMapsApiKey` | Places + photo URLs |
| `openRouteServiceApiKey` | ORS header when snapping = ORS |
| `mapsProxyBase` | Optional; documented for proxy-server (Places service uses hardcoded Render host) |

---

## 11. Local proxy server (`proxy-server.js`)

Express on `PORT || 3001`. Maps:

| Route | Upstream |
|-------|----------|
| `GET /api/places` | Google Nearby Search JSON |
| `GET /api/place/textsearch` | Google Text Search JSON |
| `GET /api/place/details` | Google Place Details JSON |
| `GET /api/directions` | Google Directions JSON |
| `POST /api/routes` | Routes API v2 |
| `GET /api/osrm` | OSRM |
| `GET /api/osrm/nearest/:coordinates` | OSRM nearest |
| `GET /api/weather/hourly` | Google Weather hourly |

**Proxy:** replicate or deploy the same proxy; **never** ship an unrestricted Google key to the browser for production if avoidable.

---

## 12. Static assets

- Leaflet default marker: `assets/leaflet/marker-icon.png`, `marker-shadow.png` (paths referenced in TS).
- Dashboard avatar: `assets/img/car.png`
- Login logo: `assets/img/crowd.png`

---

## 13. Firestore indexes and security rules

- Repo does not include `firestore.indexes.json` in search; **any composite query** you add (e.g. `where + orderBy` on new fields) needs an index in Firebase console.
- **Security rules** are not duplicated here; this admin is a **client** of Firestore (rules apply). Lock down any **custom backend** you add separately. Client apps rely on rules; ensure `admins`, `pending_*`, `events`, writes remain consistent.

---

## 14. Known quirks / bugs in Ionic (parity decisions)

1. **Tourist spot edit from list:** `tourist-spot-list.page.ts` passes **`state: { spot }`** but **`tourist-spot-editor.page.ts`** reads **`nav.spotToEdit`**. Detail modal uses **`spotToEdit`** correctly. **→ Use explicit `?id={docId}` or a consistent state key; recommend fixing to `spotToEdit` in Ionic or support both.**

2. **Route update overwrites `createdAt`:** `route-editor-map.page.ts` includes `createdAt: new Date()` in `routeData` for **both** `add` and `update`. **→ Parity = same overwrite; better fix = omit `createdAt` on update.**

3. **`route-editor/:id`** route param is **not** read in `route-editor-map.page.ts`; editing relies on **navigation state**.

4. **Event list** loads **all events** then filters in memory — O(n) all docs; you can optimize with a narrower query if indexes allow.

5. **Places proxy URLs** are **hardcoded** to Render in `PlacesService`, not `environment.mapsProxyBase`.

---

## 15. Transfer checklist for web admin

- [ ] Auth + `admins/{uid}` gate on every protected route/API
- [ ] CRUD `jeepney_routes` + map/snap UI or API
- [ ] CRUD `tourist_spots` + Storage + Places integration (or server proxy)
- [ ] CRUD `events` with `GlobalEvent` rules + spot picker
- [ ] `pending_tourist_spots` moderation + promotion payload
- [ ] `pending_local_tips` moderation + subcollection write
- [ ] Optional: `api_usage` collectionGroup stats for dashboard
- [ ] Port `exposureFromGooglePlaceTypes` + category map + `getFirestoreUpdatePayload` rules
- [ ] Replicate or replace proxy for Google APIs
- [ ] OSRM/ORS + tile URLs for maps
- [ ] Document parity fixes (spotToEdit, createdAt on route update) if intentionally improving

---

*End of complete transfer specification. Maintain this document when the Ionic admin changes.*
