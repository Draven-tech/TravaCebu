# TravaCebu Admin — Code study guide

This document walks through the **Angular + Firebase** codebase so you can prepare for discussions, interviews, or maintenance. It follows the **actual source files** under `src/` (line numbers refer to the version at the time this guide was written; if lines shift after edits, search by symbol name).

**Security note:** `src/environments/environment.ts` holds your Firebase and API keys. **Do not paste real keys** into study notes or public repos. This guide only describes **what each field means**, using placeholders like `YOUR_API_KEY`.

---

## 1. How to read this project (big picture)

| Idea | Meaning |
|------|---------|
| **SPA (single-page application)** | One `index.html` loads Angular; URLs like `/admin/dashboard` are handled by the **router** in JavaScript, not separate `.html` files. |
| **Standalone components** | Components import their own dependencies (`imports: [...]`) instead of declaring everything in one `NgModule`. |
| **`inject()`** | Angular function that asks the DI (dependency injection) container for a service (e.g. `inject(Router)`). |
| **Firebase modular SDK** | Imports like `getAuth`, `doc`, `getDoc` are **tree-shakeable** functions, not the old global `firebase.*` compat API. |
| **`CanActivateFn` route guard** | A **function** that runs **before** a route opens; it can block navigation (e.g. if the user is not an admin). |

Data flow for a protected page:

1. User hits `/admin/dashboard`.
2. **`adminGuard`** runs → **`AdminAuthService.ensureAdmin()`** checks Firestore `admins/{uid}`.
3. If OK, **`DashboardComponent`** loads and reads/writes Firestore/Storage as needed.

---

## 2. `src/main.ts` — application entry

| Line(s) | Code snippet (summary) | Word-by-word / line-by-line |
|--------|-------------------------|-----------------------------|
| 1 | `import { bootstrapApplication } from '@angular/platform-browser'` | **Import** the function that **starts** an Angular app in the **browser**. |
| 2 | `import { appConfig } from './app/app.config'` | **Import** the object that lists **global providers** (router, zone config). |
| 3 | `import { AppComponent } from './app/app.component'` | **Import** the **root** component (`<app-root>`). |
| 4 | `import { fixLeafletDefaultIcons } from './app/leaflet-defaults'` | **Import** a helper that fixes **Leaflet** default marker image URLs (bundlers do not copy those images automatically). |
| 5 | *(blank)* | Separator. |
| 6 | `fixLeafletDefaultIcons();` | **Call** that helper **before** the app bootstraps so any map uses correct icons. |
| 7–9 | `bootstrapApplication(AppComponent, appConfig).catch(...)` | **Start** the Angular app with root component `AppComponent` and config `appConfig`. **`.catch`** logs failures instead of silent rejections. |

---

## 3. `src/app/app.config.ts` — global Angular configuration

| Line(s) | Code | Explanation |
|--------|------|-------------|
| 1 | `ApplicationConfig, provideZoneChangeDetection` | **ApplicationConfig** = type for the config object. **provideZoneChangeDetection** wires Angular’s **Zone.js** change detection; `eventCoalescing: true` **batches** events for performance. |
| 2 | `provideRouter` | Registers the **router** using your `routes` table. |
| 4 | `import { routes } from './app.routes'` | The route table lives in **`app.routes.ts`**. |
| 6–8 | `export const appConfig: ApplicationConfig = { providers: [...] }` | **Export** a constant **`appConfig`** typed as **`ApplicationConfig`**. **`providers`** is an array of **factory/providers** Angular uses app-wide. |

---

## 4. `src/app/app.routes.ts` — URL → screen mapping

| Line(s) | Code | Explanation |
|--------|------|-------------|
| 1 | `import { Routes } from '@angular/router'` | **Routes** is the TypeScript type for the routing table. |
| 2 | `adminGuard` | Functional guard imported from **`admin.guard.ts`**. |
| 3–10 | Component imports | Each route **lazy-loads** by component class reference (still eager imports at file top — all are loaded in the main bundle unless you switch to `loadComponent`). |
| 12 | `path: '', redirectTo: 'admin/login', pathMatch: 'full'` | Empty path **`''`** only (**`pathMatch: 'full'`**) redirects to **`admin/login`**. |
| 13 | `admin/login` + `LoginComponent` | **Public** login route — **no** `canActivate`. |
| 14–33 | Various `admin/...` paths | Each lists **`canActivate: [adminGuard]`** so only verified admins enter. |
| 34 | `path: '**', redirectTo: 'admin/login'` | **Catch-all** unknown paths → login. |

**Study tip:** Memorize which routes are **guarded** vs **public** (only `admin/login` and the redirects).

---

## 5. `src/app/admin.guard.ts` — protecting admin routes

```typescript
export const adminGuard: CanActivateFn = async (_route, state) => { ... }
```

| Line | Code fragment | Explanation |
|-----|---------------|-------------|
| 4 | `CanActivateFn` | Type of a **functional guard**: `(route, state) => boolean \| UrlTree \| Observable \| Promise`. |
| 4 | `_route` | First parameter is the **activated route**; **`_`** prefix = intentionally unused here. |
| 4 | `state` | **`RouterStateSnapshot`**: includes **`state.url`** (where the user wanted to go). |
| 5–6 | `inject(AdminAuthService)`, `inject(Router)` | Resolve singleton **auth service** and **router** inside the guard (functional guards don’t use `constructor`). |
| 8 | `await authSvc.auth.authStateReady()` | **Wait** until Firebase Auth finished restoring session from persistence. |
| 9 | `const ok = await authSvc.ensureAdmin()` | **`true`** only if user signed in **and** `admins/{uid}` exists (see service section). |
| 10 | `if (ok) return true` | **Allow** navigation. |
| 12–15 | `sessionStorage.setItem('tc_return', ...)` | If user was blocked **and** not already on login, save intended URL so login can return them. |
| 16 | `navigate(['/admin/login'], { queryParams: { returnUrl: state.url } })` | Send user to login **with** `?returnUrl=...` (optional; login also reads `tc_return`). |
| 17 | `return false` | **Block** the original navigation. |

---

## 6. `src/environments/environment.ts` — config object (no real secrets here)

This file exports **`environment`**, a plain object.

| Field | Meaning |
|-------|---------|
| `production` | `false` in dev builds; you can use file replacement for prod builds to flip this. |
| `firebase` | Object passed to **`initializeApp(...)`**: `apiKey`, `authDomain`, `projectId`, `storageBucket`, `messagingSenderId`, `appId`. Replace with **your** Firebase Web app values from the console. |
| `keys.googleMapsApiKey` | Used for **Place Photo** URLs and optional `key=` on the Places proxy. |
| `keys.openRouteServiceApiKey` | Reserved for route/snapping features; not required for current screens. |

**Study tip:** Know **why** secrets live here (one place for build-time config) vs old `window.__TRAVACEBU_*` globals.

---

## 7. `src/app/leaflet-defaults.ts` — map marker images

| Line | Code | Explanation |
|-----|------|-------------|
| 1 | `import * as L from 'leaflet'` | Import entire Leaflet namespace as **`L`**. |
| 4 | `export function fixLeafletDefaultIcons(): void` | Named **export**; returns **nothing** (`void`). |
| 5 | `delete (...)._getIconUrl` | Removes Leaflet’s default method that assumes images live on disk next to scripts; bundlers break that. |
| 6–9 | `L.Icon.Default.mergeOptions({ iconUrl: ... })` | Sets **absolute URLs** (here, **unpkg** CDN) for marker + retina + shadow images. |

---

## 8. `src/app/app.component.ts` — root shell + body CSS classes

| Line | Code | Explanation |
|-----|------|-------------|
| 5–9 | `@Component({ selector: 'app-root', template: '<router-outlet />', ... })` | Root tag **`<app-root>`** only renders **`<router-outlet />`** — where routed components appear. |
| 12 | `inject(Router)` | Gets the **Router** service. |
| 15–17 | `this.router.events.pipe(filter(...)).subscribe(...)` | **Stream** of router events; **`filter`** keeps only **`NavigationEnd`** (completed navigations). |
| 18 | `e.urlAfterRedirects.startsWith('/admin/login')` | Detect if final URL is **login** (after redirects). |
| 19 | `document.body.classList.add('tc-admin')` | Always add base admin **theme** class on `<body>`. |
| 20 | `classList.toggle('tc-admin-login', login)` | Add **login-specific** layout class **only** on login route. |

---

## 9. `src/app/lib/tc-utils.ts` — pure helpers (no Firebase)

### `tsMillis` (lines 7–13)

- **Purpose:** Turn Firestore **`Timestamp`** or plain `{ seconds }` into **milliseconds** for sorting.
- **Line 8:** `if (ts == null) return 0` — missing date sorts as oldest.
- **Line 9:** If `.toMillis` is a **function**, it’s a Firestore **`Timestamp`** → call it.
- **Lines 10–11:** Else if **`seconds`** is a number, multiply by **1000** (seconds → ms).
- **Line 12:** Fallback **0**.

### `exposureFromGooglePlaceTypes` (lines 15–58)

- **Purpose:** Map Google Places **`types[]`** → **`'indoor' | 'mixed' | 'outdoor'`** for the app’s UX/rules.
- **Line 16:** No types → **`'mixed'`** (safe default).
- **Line 17:** Build a **Set** of **lowercase** type strings for fast **`has`** checks.
- **Lines 19–42:** Two preference lists — **outdoor-first** types (e.g. park, beach), **indoor-first** (museum, mall). First match wins.
- **Lines 50–56:** Extra **compound** rules (e.g. restaurant without meal_delivery → indoor); attractions / POI → **mixed**.
- **Line 57:** Default **mixed**.

### `categoryFromGoogleTypes` (lines 60–83)

- **Purpose:** Pick an **app category** (string) from Google types using a **priority list** `order` (array of pairs **`[googleType, appCategory]`**).
- **Line 61:** No types → **`'attraction'`**.
- **Lines 63–78:** Ordered list — earlier rows **win** (e.g. `shopping_mall` → `mall` before generic `establishment`).

### `addressLooksLikeCebu` (lines 85–90)

- **Purpose:** Rough filter so bulk Places sync prefers addresses mentioning **Cebu** area keywords.
- **Line 86:** Lowercase the address string.
- **Lines 87–89:** **`.some`** returns **true** if **any** keyword substring appears.

---

## 10. `src/app/services/admin-auth.service.ts` — Firebase + admin checks

### Imports (lines 1–20)

- **Angular:** `Injectable`, `inject`, `Router`.
- **Firebase app:** `initializeApp`, `FirebaseApp`.
- **Auth:** `getAuth`, `signInWithEmailAndPassword`, `signOut` (aliased **`firebaseSignOut`** to avoid name clash with your method), `setPersistence`, `browserLocalPersistence`.
- **Firestore:** `getFirestore`, `doc`, `getDoc`, `collection`, `addDoc`, `serverTimestamp`.
- **Storage:** `getStorage`, `ref`, `deleteObject`.
- **environment:** Your Firebase config.

### `ADMIN_ACCESS_DENIED` (line 22)

- **String constant** used when email **signs in** but **no** `admins/{uid}` doc — same message identity as older app versions.

### Class setup (lines 24–45)

- **`@Injectable({ providedIn: 'root' })`:** One **singleton** for the whole app.
- **`constructor`:** **`initializeApp(environment.firebase)`** once; **`getAuth`**, **`setPersistence(..., browserLocalPersistence)`** so refresh keeps login.
- **Getters `auth` / `db` / `storage`:** Always return **current** service instances tied to **`this.app`**.

### `adminSignIn(email, password)` (lines 47–61)

| Line | What happens |
|------|----------------|
| 49 | `signInWithEmailAndPassword` → Firebase verifies password. |
| 51 | Read Firestore **`doc(db, 'admins', uid)`**. |
| 52–55 | If **missing** → **sign out** immediately and throw **`ADMIN_ACCESS_DENIED`**. |
| 56–59 | If Firestore errors: rethrow **denied**; otherwise sign out and **rethrow** original error (e.g. permission denied). |
| 61 | Return **`User`** on success. |

### `ensureAdmin()` (lines 65–81)

| Line | What happens |
|------|----------------|
| 66 | Wait for auth restoration. |
| 67–68 | No user → **`false`** (guard sends to login). |
| 70 | Read **`admins/{uid}`**. |
| 71–75 | Missing doc → **sign out**, **alert** user, **`false`**. |
| 76 | **`true`** = OK. |
| 77–79 | On Firestore read **exception** → log + **`false`**. |

### `logout()` (lines 83–95)

- Fires **`tc-before-logout`** custom event (other code, e.g. Firestore listeners, can react).
- **`firebaseSignOut`**, then **`router.navigateByUrl('/admin/login')`**.

### `logApiCall` (lines 97–114)

- Path: **`api_usage/{uid}/calls`** subcollection.
- Stores **api** name, **endpoint**, **params**, **success: true**, **`serverTimestamp()`**, **`date`** (UTC `YYYY-MM-DD`), **`userId`**.
- Wrapped in **try/catch** — logging must not crash the UI.

### `deleteFileByURL` (lines 116–127)

- Only runs for URLs containing **`firebasestorage.googleapis.com`**.
- **Regex** `/\/o\/([^?]+)/` captures the **object path** segment in a download URL; **`decodeURIComponent`**, then **`ref(storage, path)`** + **`deleteObject`**.
- Errors **logged**, not thrown — UI can continue.

---

## 11. `src/app/services/places.service.ts` — Google Places via proxy

| Line(s) | Symbol | Explanation |
|---------|--------|-------------|
| 5 | `TC_PLACES_PROXY` | Base URL of backend **proxy** (avoids CORS / API restrictions from browser). |
| 8 | `PlacesService` | Injectable service. |
| 9 | `inject(AdminAuthService)` | Needs **logApiCall**. |
| 11–14 | `optionalKeyQs` | If **googleMapsApiKey** set, append **`&key=...`** URL-encoded. |
| 16–25 | `placesJson` | **`fetch`**, read **text**, **`JSON.parse`**; on failure return a small **error object** instead of throwing. |
| 27–36 | `textSearch` | Builds **textsearch** query (`name + Cebu Philippines`), fixed **lat,lng** bias, **radius**; logs API usage; returns parsed JSON. |
| 38–51 | `details` | **place/details** with **`place_id`** + **fields** list; logs usage. |
| 53–56 | `photoUrlFromReference` | Builds **Google Place Photo** URL with **`maxwidth`**, **`maxheight`**, **`photo_reference`**, **`key`**. Returns **`''`** if no key/ref. |

---

## 12. Page components (TypeScript) — patterns

Below, **patterns repeat**: `inject` services, `ngOnInit` loads data, templates bind with `[]` / `()` / `{{ }}`.

### `login.component.ts`

| Method / block | Role |
|----------------|------|
| `goWelcome()` | Full page jump to **`/welcome`** (outside Angular). |
| `ngOnInit` | Strip **email/password** from query string (security); validate **environment** not placeholder; maybe **auto-redirect** if already admin. |
| `stripCredentialsFromUrl` | If URL has `?email=` or `?password=`, **replaceState** to drop them (prevents leaking creds in history). |
| `redirectIfAlreadyAdmin` | If Firebase user exists **and** `admins/{uid}` exists → **`followReturn`**. |
| `togglePw` | Swap input type **password** ↔ **text**. |
| `submit` | **`adminSignIn`**, then **`followReturn`**; map errors via **`loginFailMessage`**. |
| `followReturn` | Prefer **`returnUrl`** query, else **`tc_return`** in **sessionStorage**, else **dashboard**; same-origin check for full URLs. |
| `firebaseErrorCode` | Normalize Firebase / auth error shapes to a **string** code. |
| `loginFailMessage` | User-friendly strings per **`auth/...`** codes + generic fallback. |

### `dashboard.component.ts`

| Method | Role |
|--------|------|
| `ngOnInit` | Show **who** is signed in; **`loadApiUsage`**. |
| `loadApiUsage` | **`collectionGroup(db, 'calls')`** → count all **`api_usage/*/calls`** docs; group counts by **`api`** field; split **today** using **`date`** string vs **UTC** `YYYY-MM-DD`. |

**Firestore concept:** **`collectionGroup`** queries **all** subcollections named **`calls`** regardless of parent **`api_usage/{uid}`** doc.

### `tourist-spots-list.component.ts` (large file)

| Section | Role |
|---------|------|
| `TouristSpot` interface | Shape used in templates. |
| `ngOnInit` | Refresh ID token, tiny delays (Firestore auth timing), **`startSpotsListener`**, listen **`pageshow`** (back-forward cache). |
| `ngOnDestroy` | Remove listeners, **unsubscribe** snapshot, destroy mini map. |
| `beforeLogout` | Stops listener when **`logout`** fires **`tc-before-logout`**. |
| `filteredSpots` | Client-side filter by **name** / **description** substring. |
| `openDetail` / `initMiniMap` | Modal map: support **GeoPoint** with **`.latitude()`** methods **or** plain **`lat/lng`** fields. |
| `startSpotsListener` | Prefer **`orderBy('createdAt','desc')` + `onSnapshot`**; on index/error → **unordered** snapshot + **client sort** by **`tsMillis`**. |
| `load` | One-shot **getDocs** with same orderBy fallback — used by **Refresh**. |
| `bulkSync` | Cap **25** docs per run; skip invalid or already **googlePlaceTypes**-filled; **textSearch** → pick Cebu-like address → **details** → **`setDoc` merge** patch (+ optional **photo** URL). **`sleep(400)`** throttles API. |

### `tourist-spot-editor.component.ts`

| Section | Role |
|---------|------|
| `ngOnInit` | Load by **`?id=`** or **`sessionStorage spotToEdit`**; set **`setTimeout`** so DOM `#map` exists before Leaflet. |
| `ensureMap` / `setMarker` | Init **L.map**, **click** sets marker, **draggable** marker. |
| `onTileChange` | Swap **Esri** imagery vs **OSM**. |
| `searchPlaces` | **prompt** UX → **textSearch** → **prompt** pick → **details** → fill form + marker + optional **photo** URL. |
| `save` | Optional **Storage** upload → **`GeoPoint`** + **`setDoc`/`addDoc`**; navigate **spots list** vs **dashboard** for new vs edit. |

### `events-list.component.ts`

| Symbol | Role |
|--------|------|
| `Ev` interface | Typed event row. |
| `sortEv` | Split **future** vs **past** by parsing **`date` + `time` + 'Z'**; sort each group. |
| `listSlice` / pagination | **`perPage`** 6; **`page`** index. |
| `calGrid` | Build month grid with **leading blanks** for weekday offset; count events per **ISO date**. |
| `load` | Only events where **`createdBy === uid`** and **`createdByType === 'admin'`**. |

### `event-editor.component.ts`

| Symbol | Role |
|--------|------|
| `ngOnInit` | Load **`?id=`** event into form. |
| `openPick` / `filteredSpots` | Modal to pick **`tourist_spots`** doc. |
| `normTime` | Force **`HH:MM`** from time inputs. |
| `save` | Validates **end > start**; upload new image; **update** removes old **imageUrl** from Storage if replaced; **add** sets **createdBy**, **eventType**, **status**. |

### `pending-spots.component.ts`

| Symbol | Role |
|--------|------|
| `geoFromPending` | Normalize `{lat,lng}` / `{latitude,longitude}` → **`GeoPoint`**. |
| `load` | **`where('status','==', ...)`** on **`pending_tourist_spots`**. |
| `approve` | **`addDoc`** to **`tourist_spots`**, **`updateDoc`** pending doc to **approved** + **`approvedSpotId`**. |
| `reject` | **`updateDoc`** **rejected** + notes. |
| `removeRow` | **`deleteDoc`** pending doc. |

### `pending-tips.component.ts`

| Symbol | Role |
|--------|------|
| `approve` | **`addDoc`** under **`tourist_spots/{spotId}/local_tips`** with provenance fields; **`updateDoc`** pending tip. |
| `reject` | **`updateDoc`** with **rejected** + **reviewNotes**. |

---

## 13. HTML templates — syntax cheat sheet

You do not need to memorize every line of HTML; understand **Angular template grammar**:

| Syntax | Reads as |
|--------|-----------|
| `{{ expr }}` | **Interpolation** — insert text (HTML-escaped). |
| `[property]="expr"` | **Property binding** — bind DOM/component **input**. |
| `(event)="handler($event)"` | **Event binding** — call method on event. |
| `[(ngModel)]="field"` | **Two-way binding** (needs **`FormsModule`**) — input ↔ component field. |
| `@if (cond) { ... }` | **Control flow** (Angular 17+) — conditional block. |
| `@for (x of list(); track x.id) { ... }` | **Repeat** block; **`track`** helps DOM reuse / performance. |
| `routerLink="/path"` | Directive: navigate on click **without** full page load. |
| `[queryParams]="{ id: modalEv.id }"` | Adds **`?id=`** when using **`routerLink`**. |
| `[class.on]="booleanExpr"` | Toggle CSS class **`on`**. |

**Modal pattern:** outer `div.modal-back` toggles **`[class.on]="..."`**; inner `(click)="$event.stopPropagation()"` prevents backdrop click from closing when clicking inside.

---

## 14. Study checklist (what to be able to explain aloud)

1. **Why** `adminGuard` uses **`authStateReady`** then **`ensureAdmin`**.
2. Difference between **`adminSignIn`** and **`ensureAdmin`** (when each runs; who signs the user out).
3. **Why** tourist spots use **`onSnapshot`** plus **`orderBy`** fallback.
4. How **`collectionGroup('calls')`** differs from **`collection(db, 'events')`**.
5. **Why** `deleteFileByURL` parses the path from the download URL instead of `refFromURL`.
6. **Why** `fixLeafletDefaultIcons` exists (bundler vs default Leaflet asset paths).
7. **Security:** never log passwords; strip them from URLs; rules still enforce **`admins/{uid}`** server-side.

---

## 15. Suggested study order

1. `main.ts` → `app.config.ts` → `app.routes.ts` → `admin.guard.ts`  
2. `admin-auth.service.ts` → `places.service.ts` → `tc-utils.ts`  
3. `login.component.ts` → `dashboard.component.ts`  
4. `tourist-spots-list` + `tourist-spot-editor`  
5. `events-list` + `event-editor`  
6. `pending-spots` + `pending-tips`

Good luck — if you want this guide split into **flashcard Q&A** or **interview “explain in 60 seconds”** versions, say which format you prefer.
