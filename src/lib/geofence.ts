/**
 * Geofencing Utilities
 * 
 * Includes distance calculation using the Haversine formula.
 */

export interface Coordinates {
  latitude: number;
  longitude: number;
}

/**
 * Calculates the distance between two GPS coordinates in meters using the Haversine formula.
 */
export function calculateDistanceInMeters(coord1: Coordinates, coord2: Coordinates): number {
  const R = 6371e3; // Earth radius in meters
  const lat1 = (coord1.latitude * Math.PI) / 180;
  const lat2 = (coord2.latitude * Math.PI) / 180;
  const deltaLat = ((coord2.latitude - coord1.latitude) * Math.PI) / 180;
  const deltaLon = ((coord2.longitude - coord1.longitude) * Math.PI) / 180;

  const a =
    Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) * Math.sin(deltaLon / 2);
  
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return Math.round(R * c); // Distance in meters, rounded to nearest whole number
}

/**
 * Checks if a given coordinate is within the allowed radius of a target location.
 */
export function isWithinGeofence(
  current: Coordinates,
  target: Coordinates,
  allowedRadiusMeters: number
): boolean {
  const distance = calculateDistanceInMeters(current, target);
  return distance <= allowedRadiusMeters;
}
