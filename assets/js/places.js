/**
 * Ionic parity: hardcoded Render proxy (TRAVACEBU-ADMIN-WEB-REFERENCE.md §6.3).
 * Optional `window.__TRAVACEBU_KEYS__.googleMapsApiKey` is appended as `key=` when set
 * so proxies or fallbacks that expect a Google key still work.
 */
const TC_PLACES_PROXY = 'https://google-places-proxy-ftxx.onrender.com';

function tcOptionalPlacesKeyQs() {
  const key =
    typeof window.__TRAVACEBU_KEYS__ === 'object' && window.__TRAVACEBU_KEYS__.googleMapsApiKey
      ? String(window.__TRAVACEBU_KEYS__.googleMapsApiKey).trim()
      : '';
  return key ? `&key=${encodeURIComponent(key)}` : '';
}

async function tcPlacesJson(url) {
  const r = await fetch(url);
  const text = await r.text();
  try {
    return JSON.parse(text);
  } catch (e) {
    console.warn('places JSON parse failed', url, text.slice(0, 160));
    return { status: 'PARSE_ERROR', error: text.slice(0, 200), httpStatus: r.status };
  }
}

async function placesTextSearch(name) {
  const q = encodeURIComponent(`${name} Cebu Philippines`);
  let u =
    `${TC_PLACES_PROXY}/api/place/textsearch?query=${q}` +
    `&location=${encodeURIComponent('10.3157,123.8854')}&radius=30000`;
  u += tcOptionalPlacesKeyQs();
  const j = await tcPlacesJson(u);
  if (window.TC && window.TC.logApiCall) TC.logApiCall('places', 'textsearch', { query: name });
  return j;
}

async function placesDetails(placeId, fields) {
  const f = encodeURIComponent(
    fields || 'name,formatted_address,geometry,photos,types,rating,user_ratings_total,opening_hours',
  );
  let u =
    `${TC_PLACES_PROXY}/api/place/details?place_id=${encodeURIComponent(placeId)}&fields=${f}`;
  u += tcOptionalPlacesKeyQs();
  const j = await tcPlacesJson(u);
  if (window.TC && window.TC.logApiCall) TC.logApiCall('places', 'details', { place_id: placeId });
  return j;
}

function photoUrlFromReference(photoRef, maxW, maxH) {
  const key = (window.__TRAVACEBU_KEYS__ && window.__TRAVACEBU_KEYS__.googleMapsApiKey) || '';
  if (!key || !photoRef) return '';
  return `https://maps.googleapis.com/maps/api/place/photo?maxwidth=${maxW || 400}&maxheight=${maxH || 300}&photo_reference=${encodeURIComponent(photoRef)}&key=${encodeURIComponent(key)}`;
}

window.TCPlaces = {
  placesTextSearch,
  placesDetails,
  photoUrlFromReference,
};
