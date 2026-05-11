/** Port: spot-exposure + category helpers (legacy `assets/js/utils.js`). */

import type { Timestamp } from 'firebase/firestore';

export type Exposure = 'indoor' | 'mixed' | 'outdoor';

export function tsMillis(ts: Timestamp | { seconds?: number } | null | undefined): number {
  if (ts == null) return 0;
  if (typeof (ts as Timestamp).toMillis === 'function') return (ts as Timestamp).toMillis();
  if (typeof (ts as { seconds?: number }).seconds === 'number')
    return (ts as { seconds: number }).seconds * 1000;
  return 0;
}

export function exposureFromGooglePlaceTypes(types: string[] | null | undefined): Exposure {
  if (!types?.length) return 'mixed';
  const t = new Set(types.map((x) => String(x).toLowerCase()));

  const outdoorFirst = [
    'park',
    'natural_feature',
    'campground',
    'rv_park',
    'national_park',
    'stadium',
    'marina',
    'beach',
  ];
  const indoorFirst = [
    'shopping_mall',
    'museum',
    'art_gallery',
    'movie_theater',
    'bowling_alley',
    'amusement_center',
    'night_club',
    'casino',
    'spa',
    'library',
    'meal_takeaway',
    'bakery',
  ];

  for (const key of outdoorFirst) {
    if (t.has(key)) return 'outdoor';
  }
  for (const key of indoorFirst) {
    if (t.has(key)) return 'indoor';
  }
  if (t.has('aquarium') || (t.has('restaurant') && !t.has('meal_delivery'))) return 'indoor';
  if (t.has('cafe') || t.has('bar') || t.has('food') || t.has('lodging')) return 'indoor';
  if (t.has('church') || t.has('hindu_temple') || t.has('mosque') || t.has('synagogue'))
    return 'indoor';
  if (t.has('amusement_park') || t.has('zoo')) return 'mixed';
  if (t.has('tourist_attraction') || t.has('point_of_interest') || t.has('establishment'))
    return 'mixed';
  return 'mixed';
}

export function categoryFromGoogleTypes(types: string[] | null | undefined): string {
  if (!types?.length) return 'attraction';
  const set = new Set(types.map((x) => String(x).toLowerCase()));
  const order: [string, string][] = [
    ['shopping_mall', 'mall'],
    ['amusement_park', 'attraction'],
    ['aquarium', 'attraction'],
    ['art_gallery', 'museum'],
    ['museum', 'museum'],
    ['park', 'park'],
    ['natural_feature', 'attraction'],
    ['tourist_attraction', 'attraction'],
    ['point_of_interest', 'attraction'],
    ['establishment', 'attraction'],
    ['restaurant', 'restaurant'],
    ['lodging', 'hotel'],
    ['church', 'church'],
    ['beach', 'beach'],
  ];
  for (const [g, c] of order) {
    if (set.has(g)) return c;
  }
  return 'attraction';
}

export function addressLooksLikeCebu(addr: string): boolean {
  const a = String(addr).toLowerCase();
  return ['cebu', 'philippines', 'cebu city', 'mandaue', 'lapu-lapu', 'talisay'].some((n) =>
    a.includes(n),
  );
}
