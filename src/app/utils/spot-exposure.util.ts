/**
 * Maps Google Places `types[]` to coarse exposure for weather / UX.
 * https://developers.google.com/maps/documentation/places/web-service/supported_types
 */
export type SpotExposure = 'indoor' | 'mixed' | 'outdoor';

export function exposureFromGooglePlaceTypes(types: string[] | undefined | null): SpotExposure {
  if (!types?.length) {
    return 'mixed';
  }
  const t = new Set(types.map((x) => x.toLowerCase()));

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
    if (t.has(key)) {
      return 'outdoor';
    }
  }
  for (const key of indoorFirst) {
    if (t.has(key)) {
      return 'indoor';
    }
  }

  if (t.has('aquarium') || (t.has('restaurant') && !t.has('meal_delivery'))) {
    return 'indoor';
  }
  if (t.has('cafe') || t.has('bar') || t.has('food') || t.has('lodging')) {
    return 'indoor';
  }
  if (t.has('church') || t.has('hindu_temple') || t.has('mosque') || t.has('synagogue')) {
    return 'indoor';
  }
  if (t.has('amusement_park') || t.has('zoo')) {
    return 'mixed';
  }
  if (t.has('tourist_attraction') || t.has('point_of_interest') || t.has('establishment')) {
    return 'mixed';
  }

  return 'mixed';
}
