/**
 * Geofence Utilities — Unit Test Suite
 *
 * Tests Haversine distance calculation and geofence boundary logic
 * from src/lib/geofence.ts.
 *
 * Uses known geographic coordinates with verified distances.
 */

import { getDistanceMeters, isWithinGeofence } from "@/lib/geofence";

// ─── Known reference points ─────────────────────────────────────────────────

// Manila City Hall: 14.5895, 120.9842
// Quezon City Hall: 14.6488, 121.0509
// Haversine distance ≈ 9,300m (verified via multiple online calculators)

const MANILA = { lat: 14.5895, lng: 120.9842 };
const QUEZON = { lat: 14.6488, lng: 121.0509 };

// ═════════════════════════════════════════════════════════════════════════════
// getDistanceMeters
// ═════════════════════════════════════════════════════════════════════════════

describe("getDistanceMeters", () => {
    it("same point → distance = 0", () => {
        const d = getDistanceMeters(MANILA.lat, MANILA.lng, MANILA.lat, MANILA.lng);
        expect(d).toBe(0);
    });

    it("Manila → Quezon City ≈ 9.3 km (within 500m tolerance)", () => {
        const d = getDistanceMeters(MANILA.lat, MANILA.lng, QUEZON.lat, QUEZON.lng);
        expect(d).toBeGreaterThan(8800);
        expect(d).toBeLessThan(9800);
    });

    it("is symmetric — A→B equals B→A", () => {
        const ab = getDistanceMeters(MANILA.lat, MANILA.lng, QUEZON.lat, QUEZON.lng);
        const ba = getDistanceMeters(QUEZON.lat, QUEZON.lng, MANILA.lat, MANILA.lng);
        expect(ab).toBeCloseTo(ba, 6);
    });

    it("equator: 1 degree longitude ≈ 111 km", () => {
        const d = getDistanceMeters(0, 0, 0, 1);
        expect(d).toBeGreaterThan(110_000);
        expect(d).toBeLessThan(112_000);
    });

    it("equator: 1 degree latitude ≈ 111 km", () => {
        const d = getDistanceMeters(0, 0, 1, 0);
        expect(d).toBeGreaterThan(110_000);
        expect(d).toBeLessThan(112_000);
    });

    it("very small distance (same building) < 50m", () => {
        // ~0.0003 degrees ≈ ~33 meters
        const d = getDistanceMeters(14.5895, 120.9842, 14.5898, 120.9842);
        expect(d).toBeGreaterThan(20);
        expect(d).toBeLessThan(50);
    });

    it("antipodal points ≈ half Earth circumference (~20,000 km)", () => {
        const d = getDistanceMeters(0, 0, 0, 180);
        expect(d).toBeGreaterThan(19_900_000);
        expect(d).toBeLessThan(20_100_000);
    });

    it("negative coordinates (Southern/Western hemisphere)", () => {
        // São Paulo: -23.5505, -46.6333
        // Buenos Aires: -34.6037, -58.3816
        const d = getDistanceMeters(-23.5505, -46.6333, -34.6037, -58.3816);
        // Known ≈ 1,680 km
        expect(d).toBeGreaterThan(1_600_000);
        expect(d).toBeLessThan(1_750_000);
    });
});

// ═════════════════════════════════════════════════════════════════════════════
// isWithinGeofence
// ═════════════════════════════════════════════════════════════════════════════

describe("isWithinGeofence", () => {
    // Office at Manila City Hall, 5km radius
    const FENCE = { lat: MANILA.lat, lng: MANILA.lng, radius: 5000 };

    it("user at fence center → within, distance 0", () => {
        const result = isWithinGeofence(FENCE.lat, FENCE.lng, FENCE.lat, FENCE.lng, FENCE.radius);
        expect(result.within).toBe(true);
        expect(result.distanceMeters).toBe(0);
    });

    it("user 1km away → within 5km fence", () => {
        // ~0.009 degrees ≈ ~1km
        const result = isWithinGeofence(FENCE.lat + 0.009, FENCE.lng, FENCE.lat, FENCE.lng, FENCE.radius);
        expect(result.within).toBe(true);
        expect(result.distanceMeters).toBeGreaterThan(900);
        expect(result.distanceMeters).toBeLessThan(1100);
    });

    it("user in Quezon City (~9.3km) → outside 5km fence", () => {
        const result = isWithinGeofence(QUEZON.lat, QUEZON.lng, FENCE.lat, FENCE.lng, FENCE.radius);
        expect(result.within).toBe(false);
        expect(result.distanceMeters).toBeGreaterThan(8800);
    });

    it("returns rounded integer for distanceMeters", () => {
        const result = isWithinGeofence(FENCE.lat + 0.001, FENCE.lng, FENCE.lat, FENCE.lng, FENCE.radius);
        expect(Number.isInteger(result.distanceMeters)).toBe(true);
    });

    it("zero radius → only exact center is within", () => {
        const atCenter = isWithinGeofence(FENCE.lat, FENCE.lng, FENCE.lat, FENCE.lng, 0);
        expect(atCenter.within).toBe(true);

        const nearby = isWithinGeofence(FENCE.lat + 0.0001, FENCE.lng, FENCE.lat, FENCE.lng, 0);
        expect(nearby.within).toBe(false);
    });

    it("boundary: user at exactly the radius → within (<=)", () => {
        // getDistanceMeters from Manila → ~1000m point
        const d = getDistanceMeters(FENCE.lat, FENCE.lng, FENCE.lat + 0.009, FENCE.lng);
        const radius = Math.round(d); // set radius = exact distance
        const result = isWithinGeofence(FENCE.lat + 0.009, FENCE.lng, FENCE.lat, FENCE.lng, radius);
        expect(result.within).toBe(true);
    });

    it("return type has both within (boolean) and distanceMeters (number)", () => {
        const result = isWithinGeofence(0, 0, 0, 0, 100);
        expect(typeof result.within).toBe("boolean");
        expect(typeof result.distanceMeters).toBe("number");
    });
});
