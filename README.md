# TravaCebu Admin (Angular)

Admin UI for the same Firebase project as the TravaCebu app: **Auth**, **Firestore**, and **Storage** in the browser. Routes live under **`/admin/*`**. Behavior matches **`docs/TRAVACEBU-ADMIN-WEB-REFERENCE.md`** (ported from the original Ionic admin).

## Prerequisites

- Node.js 18+ (LTS recommended) and npm

## Setup

1. Install dependencies: `npm install`
2. Edit **`src/environments/environment.ts`**:
   - Set **`firebase`** to your Firebase Web app config (Firebase console → Project settings → Your apps → Web).
   - Optionally set **`keys.googleMapsApiKey`** for Place photo URLs and the Places proxy; **`openRouteServiceApiKey`** is reserved for future route tooling parity.
3. Ensure each operator has **`admins/{uid}`** in Firestore (uid = Firebase Auth UID).
4. Align **Firestore rules** with the app (see **`docs/firestore.rules.reference`**).

## Run locally

```bash
npm start
```

Open **`http://localhost:4200/admin/login`**. The CLI serves the SPA with deep-link support for Angular routes.

## Production build

```bash
npm run build
```

Output: **`dist/travacebu-admin/browser/`**. Host that folder on any static host (Firebase Hosting, nginx, etc.). Configure the server so **all paths** fall back to **`index.html`** (SPA rewrite), e.g. Firebase **`rewrites`**: `**` → `/index.html`.

## Layout

| Route | Purpose |
|-------|--------|
| `/admin/login` | Email/password; checks **`admins/{uid}`** |
| `/admin/dashboard` | Shortcuts + API usage (collectionGroup `calls`) |
| `/admin/tourist-spots` | Spots list, bulk Places helper, detail modal |
| `/admin/tourist-spots/editor` | Editor + map (query `id` for edit) |
| `/admin/events` | Events list + calendar |
| `/admin/events/editor` | Event editor (query `id` for edit) |
| `/admin/moderation/pending-spots` | Pending / approved / rejected spots |
| `/admin/moderation/pending-tips` | Pending local tips |

## Docs

- **`docs/TRAVACEBU-ADMIN-WEB-REFERENCE.md`** — behavioral spec (collections, fields, parity notes).
