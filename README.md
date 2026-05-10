# TravaCebu Admin (static HTML)

Plain **static** admin UI for the same Firebase project as the TravaCebu app. Uses the **Firebase Web SDK** (Auth, Firestore, Storage) in the browser. Collections, fields, and behavior follow **`docs/TRAVACEBU-ADMIN-WEB-REFERENCE.md`**.

There is **no PHP or Composer**: only `admin/*.html`, `assets/`, and `docs/`.

## Setup

1. Copy **`assets/js/firebase-config.example.js`** → **`assets/js/firebase-config.js`** (gitignored).
2. Set **`window.__TRAVACEBU_FIREBASE_CONFIG__`** to your Firebase **Web app** config (Project settings → Your apps).
3. Set **`window.__TRAVACEBU_KEYS__`** (see the example file):
   - **`googleMapsApiKey`** — optional but recommended if you want **Place photo** URLs; also appended as **`key`** on Requests to the Ionic Render Places proxy (`assets/js/places.js`) when the proxy expects it.
   - **`openRouteServiceApiKey`** — optional; only needed if you choose **ORS** snapping in the route editor (**OSRM** needs no key).
4. Ensure each operator has **`admins/{uid}`** in Firestore (`uid` = Firebase Auth UID).
5. **Firestore rules** must allow these signed-in admins to read/write the collections used by the screens (same model as Ionic admin — see **`docs/firestore.rules.reference`** as a baseline).

## Run locally

Do not rely on **`file://`**. Serve the repo root over HTTP:

```bash
cd travacebu-admin
python -m http.server 8080
```

Open **`http://localhost:8080/admin/login.html`** (root **`/`** redirects there). **Relative links** assume the site is served from the repo root (`/assets/`, `/admin/…`).

## Firestore indexes

If the console shows **`failed-precondition`** with an index URL:

- **`collectionGroup('calls')`** on **`api_usage/{uid}/calls`** (dashboard widget) — usually needs the **composite index** Firebase suggests in the error link.
- **`orderBy('createdAt','desc')`** on **`jeepney_routes`** and **`tourist_spots`** — single-field **`createdAt`** indexes are created automatically when the query first runs successfully; legacy data without **`createdAt`** may need a backfill or a looser query you add yourself.

## Layout

| Path | Purpose |
|------|---------|
| `admin/login.html` | Email/password; checks **`admins/{uid}`** |
| `admin/dashboard.html` | Shortcuts + optional API usage (collectionGroup) |
| `admin/routes/` | Routes list + Leaflet editor |
| `admin/tourist-spots/` | Spots list, Places bulk helper, editor + Storage |
| `admin/events/` | Events list / calendar + editor |
| `admin/moderation/` | Pending spots & pending local tips |

## Script load order

All **`admin/**/*.html`** pages load **`firebase-*-compat`** first, then **`assets/js/firebase-config.js`** (defines config + keys), **`utils.js`**, optional **`places.js`**, then **`core.js`** (initializes **`firebase`** and **`TC`**). Do not reorder.

## Docs

- **`docs/TRAVACEBU-ADMIN-WEB-REFERENCE.md`** — full behavioral spec.
