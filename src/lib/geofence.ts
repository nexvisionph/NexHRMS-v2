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
 * Calculates the distance between two GPS coordinates in meters.
 */
export function getDistanceMeters(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  return calculateDistanceInMeters(
    { latitude: lat1, longitude: lon1 },
    { latitude: lat2, longitude: lon2 }
  );
}

/**
 * Checks if a given coordinate is within the allowed radius of a target location.
 * Supports both Coordinates object signature (returns boolean) and flat numbers signature (returns object).
 */
export function isWithinGeofence(
  current: Coordinates,
  target: Coordinates,
  allowedRadiusMeters: number
): boolean;

export function isWithinGeofence(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
  allowedRadiusMeters: number
): { within: boolean; distanceMeters: number };

export function isWithinGeofence(
  arg1: Coordinates | number,
  arg2: Coordinates | number,
  arg3: number,
  arg4?: number,
  arg5?: number
): boolean | { within: boolean; distanceMeters: number } {
  if (typeof arg1 === "object" && typeof arg2 === "object" && typeof arg3 === "number") {
    const distance = calculateDistanceInMeters(arg1, arg2);
    return distance <= arg3;
  }
  
  if (
    typeof arg1 === "number" &&
    typeof arg2 === "number" &&
    typeof arg3 === "number" &&
    typeof arg4 === "number" &&
    typeof arg5 === "number"
  ) {
    const distance = getDistanceMeters(arg1, arg2, arg3, arg4);
    return {
      within: distance <= arg5,
      distanceMeters: distance,
    };
  }

  throw new Error("Invalid arguments passed to isWithinGeofence");
}
