/**
 * Detects whether a Google Places search hit is already represented in `tourist_spots`:
 * 1) same googlePlaceId, or
 * 2) very close on the map and the display name looks like the same venue (e.g. two SM Seaside POIs).
 */

const NEARBY_DUPLICATE_METERS = 200;

const WEAK_NAME_WORDS = new Set([
  'the',
  'a',
  'an',
  'and',
  'or',
  'of',
  'in',
  'at',
  'to',
  'for',
]);

function normalizePlaceTitle(name: string): string {
  return name
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function distanceMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLng = ((lng2 - lng1) * Math.PI) / 180;
  const r1 = (lat1 * Math.PI) / 180;
  const r2 = (lat2 * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(r1) * Math.cos(r2) * Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function tokenSet(norm: string): Set<string> {
  return new Set(
    norm
      .split(/\s+/)
      .filter((t) => t.length >= 2 && !WEAK_NAME_WORDS.has(t))
  );
}

function sharedSignificantTokenCount(a: string, b: string): number {
  const sa = tokenSet(normalizePlaceTitle(a));
  const sb = tokenSet(normalizePlaceTitle(b));
  let n = 0;
  for (const t of sa) {
    if (sb.has(t)) n++;
  }
  return n;
}

/** Same venue label: identical normalized name, meaningful substring, or strong token overlap. */
export function namesLikelySameVenue(nameA: string, nameB: string): boolean {
  const na = normalizePlaceTitle(nameA);
  const nb = normalizePlaceTitle(nameB);
  if (!na || !nb) return false;
  if (na === nb) return true;
  const [shorter, longer] = na.length <= nb.length ? [na, nb] : [nb, na];
  if (shorter.length >= 10 && longer.includes(shorter)) return true;
  const shared = sharedSignificantTokenCount(na, nb);
  const minTok = Math.min(tokenSet(na).size, tokenSet(nb).size);
  return shared >= 2 && shared >= Math.min(2, minTok);
}

export function isExistingOrNearbyDuplicatePlace(
  place: {
    place_id?: string;
    name?: string;
    geometry?: { location?: { lat?: number; lng?: number } };
  },
  existingSpots: Array<{
    googlePlaceId?: string;
    name?: string;
    location?: { lat?: number; lng?: number };
  }>
): boolean {
  if (!existingSpots?.length) return false;

  const placeId = place?.place_id?.trim();
  if (placeId) {
    const idHit = existingSpots.some((s) => s.googlePlaceId?.trim() === placeId);
    if (idHit) return true;
  }

  const plat = place.geometry?.location?.lat;
  const plng = place.geometry?.location?.lng;
  const pname = place.name?.trim();
  if (plat == null || plng == null || !pname) return false;

  for (const spot of existingSpots) {
    const slat = spot.location?.lat;
    const slng = spot.location?.lng;
    const sname = spot.name?.trim();
    if (slat == null || slng == null || !sname) continue;
    if (distanceMeters(plat, plng, slat, slng) > NEARBY_DUPLICATE_METERS) continue;
    if (namesLikelySameVenue(pname, sname)) return true;
  }

  return false;
}
