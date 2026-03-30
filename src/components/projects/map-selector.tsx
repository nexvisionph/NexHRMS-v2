"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { MapContainer, TileLayer, Circle, Marker, useMapEvents, useMap } from "react-leaflet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Slider } from "@/components/ui/slider";
import { MapPin, Navigation, Loader2, Search, X } from "lucide-react";
import { toast } from "sonner";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Custom SVG pin icon — no external image dependency
const mapPinIcon = typeof window !== "undefined"
  ? L.divIcon({
      className: "",
      html: `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 32" width="28" height="36">
        <path d="M12 0C7.16 0 3.25 3.91 3.25 8.75c0 7.44 8.75 18.25 8.75 18.25S20.75 16.19 20.75 8.75C20.75 3.91 16.84 0 12 0zm0 12a3.25 3.25 0 1 1 0-6.5A3.25 3.25 0 0 1 12 12z" fill="#10b981"/>
        <path d="M12 0C7.16 0 3.25 3.91 3.25 8.75c0 7.44 8.75 18.25 8.75 18.25S20.75 16.19 20.75 8.75C20.75 3.91 16.84 0 12 0zm0 12a3.25 3.25 0 1 1 0-6.5A3.25 3.25 0 0 1 12 12z" fill="none" stroke="rgba(255,255,255,0.6)" stroke-width="0.5"/>
      </svg>`,
      iconSize: [28, 36],
      iconAnchor: [14, 36],
      popupAnchor: [0, -38],
    })
  : null;

interface MapSelectorProps {
  lat: string;
  lng: string;
  radius: string;
  onLatChange: (lat: string) => void;
  onLngChange: (lng: string) => void;
  onRadiusChange: (radius: string) => void;
  onAddressChange?: (address: string) => void;
}

interface SearchResult {
  display_name: string;
  lat: string;
  lon: string;
  place_id: number;
}

// Component to handle map clicks
function MapClickHandler({
  onLocationSelect,
}: {
  onLocationSelect: (lat: number, lng: number) => void;
}) {
  useMapEvents({
    click: (e) => {
      onLocationSelect(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

// Component to recenter map when location changes
// Skips setView on initial mount (MapContainer center prop handles that);
// only pans on subsequent user-triggered changes so Leaflet panes are ready.
function MapRecenter({ center }: { center: [number, number] }) {
  const map = useMap();
  const isFirstRender = useRef(true);
  useEffect(() => {
    if (isFirstRender.current) {
      isFirstRender.current = false;
      return;
    }
    try {
      map.setView(center, 16, { animate: true });
    } catch {
      // Map panes not ready yet — MapContainer center prop already set the position
    }
  }, [center, map]);
  return null;
}

export function MapSelector({
  lat,
  lng,
  radius,
  onLatChange,
  onLngChange,
  onRadiusChange,
  onAddressChange,
}: MapSelectorProps) {
  const [mapReady, setMapReady] = useState(false);
  const [loadingLocation, setLoadingLocation] = useState(false);
  const [locationAddress, setLocationAddress] = useState("");
  const [geocoding, setGeocoding] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  
  // Default to Manila, Philippines if no location set
  const mapLat = parseFloat(lat) || 14.5995;
  const mapLng = parseFloat(lng) || 120.9842;
  const mapRadius = parseFloat(radius) || 100;

  useEffect(() => {
    setMapReady(true);
  }, []);

  const fetchAddress = useCallback(async (latitude: number, longitude: number) => {
    setGeocoding(true);
    setLocationAddress("");
    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
      );
      const data = await response.json();
      if (data.display_name) {
        setLocationAddress(data.display_name);
        onAddressChange?.(data.display_name);
      }
    } catch (error) {
      console.error("Error fetching address:", error);
    } finally {
      setGeocoding(false);
    }
  }, [onAddressChange]);

  // Reverse geocode to get address when location changes
  useEffect(() => {
    if (lat && lng) {
      fetchAddress(parseFloat(lat), parseFloat(lng));
    }
  }, [lat, lng, fetchAddress]);

  const handleLocationSelect = (newLat: number, newLng: number) => {
    onLatChange(newLat.toFixed(6));
    onLngChange(newLng.toFixed(6));
    toast.success("Location updated on map");
  };

  const handleUseCurrentLocation = () => {
    if (!navigator.geolocation) {
      toast.error("Geolocation is not supported by your browser");
      return;
    }

    setLoadingLocation(true);
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        onLatChange(latitude.toFixed(6));
        onLngChange(longitude.toFixed(6));
        setLoadingLocation(false);
        toast.success("Current location detected!");
      },
      (error) => {
        setLoadingLocation(false);
        let message = "Unable to retrieve your location";
        if (error.code === error.PERMISSION_DENIED) {
          message = "Location permission denied. Please enable location access.";
        } else if (error.code === error.POSITION_UNAVAILABLE) {
          message = "Location information unavailable";
        } else if (error.code === error.TIMEOUT) {
          message = "Location request timed out";
        }
        toast.error(message);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const handleSearch = async (query: string) => {
    if (!query || query.length < 3) {
      setSearchResults([]);
      setShowResults(false);
      return;
    }

    setSearching(true);
    try {
      // Bias search to Philippines
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(
          query + ", Philippines"
        )}&limit=5&addressdetails=1`
      );
      const data = await response.json();
      setSearchResults(data);
      setShowResults(true);
    } catch (error) {
      console.error("Error searching location:", error);
      toast.error("Failed to search location");
    } finally {
      setSearching(false);
    }
  };

  const handleSearchInputChange = (value: string) => {
    setSearchQuery(value);
    // Debounce search
    const timeoutId = setTimeout(() => {
      handleSearch(value);
    }, 500);
    return () => clearTimeout(timeoutId);
  };

  const selectSearchResult = (result: SearchResult) => {
    onLatChange(result.lat);
    onLngChange(result.lon);
    setSearchQuery(result.display_name);
    setShowResults(false);
    toast.success("Location selected from search");
  };

  const clearSearch = () => {
    setSearchQuery("");
    setSearchResults([]);
    setShowResults(false);
  };

  return (
    <div className="space-y-4">
      {/* Search Bar */}
      <div className="relative">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            type="text"
            placeholder="Search location (e.g., Makati, BGC, Manila City Hall...)"
            value={searchQuery}
            onChange={(e) => handleSearchInputChange(e.target.value)}
            className="pl-10 pr-10"
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </button>
          )}
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 animate-spin text-muted-foreground" />
          )}
        </div>

        {/* Search Results Dropdown */}
        {showResults && searchResults.length > 0 && (
          <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg max-h-[200px] overflow-y-auto">
            {searchResults.map((result) => (
              <button
                key={result.place_id}
                onClick={() => selectSearchResult(result)}
                className="w-full text-left px-3 py-2.5 hover:bg-muted transition-colors border-b border-border/50 last:border-0"
              >
                <div className="flex items-start gap-2">
                  <MapPin className="h-4 w-4 text-emerald-500 mt-0.5 flex-shrink-0" />
                  <span className="text-sm text-foreground line-clamp-2">
                    {result.display_name}
                  </span>
                </div>
              </button>
            ))}
          </div>
        )}

        {showResults && searchResults.length === 0 && !searching && (
          <div className="absolute z-50 w-full mt-1 bg-popover border border-border rounded-lg shadow-lg p-3 text-sm text-muted-foreground text-center">
            No locations found. Try a different search.
          </div>
        )}
      </div>

      {/* Current Location Button */}
      <div className="flex items-center gap-2">
        <Button
          type="button"
          variant="outline"
          className="flex-1 gap-2"
          onClick={handleUseCurrentLocation}
          disabled={loadingLocation}
        >
          {loadingLocation ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Detecting...
            </>
          ) : (
            <>
              <Navigation className="h-4 w-4" />
              Use Current Location
            </>
          )}
        </Button>
        <div className="text-xs text-muted-foreground flex items-center gap-1">
          <MapPin className="h-3 w-3" />
          Click map to pin
        </div>
      </div>

      {/* Map Container */}
      {mapReady && (
        <div className="border border-border rounded-lg overflow-hidden shadow-sm">
          <MapContainer
            center={[mapLat, mapLng]}
            zoom={16}
            style={{ height: "400px", width: "100%" }}
            scrollWheelZoom={true}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
              url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
            />
            <MapClickHandler onLocationSelect={handleLocationSelect} />
            <MapRecenter center={[mapLat, mapLng]} />
            
            {/* Marker for selected location */}
            {lat && lng && mapPinIcon && (
              <>
                <Marker position={[mapLat, mapLng]} icon={mapPinIcon} />
                <Circle
                  center={[mapLat, mapLng]}
                  radius={mapRadius}
                  pathOptions={{
                    color: "#10b981",
                    fillColor: "#10b981",
                    fillOpacity: 0.15,
                    weight: 2,
                  }}
                />
              </>
            )}
          </MapContainer>
        </div>
      )}

      {/* Radius Slider */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <label className="text-sm font-medium">
            Geofence Radius
          </label>
          <span className="text-sm font-mono bg-muted px-2.5 py-1 rounded border border-border">
            {mapRadius}m
          </span>
        </div>
        <Slider
          value={[mapRadius]}
          onValueChange={(value) => onRadiusChange(String(value[0]))}
          min={10}
          max={1000}
          step={10}
          className="w-full"
        />
        <div className="flex justify-between text-[10px] text-muted-foreground mt-1.5">
          <span>10m</span>
          <span>500m</span>
          <span>1000m</span>
        </div>
      </div>

      {/* Location Summary */}
      {lat && lng && (
        <div className="bg-emerald-50 dark:bg-emerald-950/20 border border-emerald-200 dark:border-emerald-800 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <div className="bg-emerald-100 dark:bg-emerald-900/50 p-2 rounded-full flex-shrink-0">
              <MapPin className="h-5 w-5 text-emerald-600 dark:text-emerald-400" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1">
                <p className="text-sm font-semibold text-emerald-900 dark:text-emerald-100">
                  Pinned Location
                </p>
                {geocoding && (
                  <Loader2 className="h-3.5 w-3.5 animate-spin text-emerald-500" />
                )}
              </div>
              {geocoding ? (
                <p className="text-xs text-emerald-600/70 dark:text-emerald-400/70 italic">Fetching address…</p>
              ) : locationAddress ? (
                <p className="text-sm text-emerald-700 dark:text-emerald-300 leading-relaxed break-words">
                  {locationAddress}
                </p>
              ) : null}
              <p className="text-xs text-emerald-600/60 dark:text-emerald-400/60 font-mono mt-1">
                {parseFloat(lat).toFixed(6)}, {parseFloat(lng).toFixed(6)}
              </p>
              <div className="mt-2 pt-2 border-t border-emerald-200 dark:border-emerald-800">
                <p className="text-xs text-emerald-700 dark:text-emerald-400">
                  Employees must check in within{" "}
                  <span className="font-bold">{mapRadius}m</span> of this location
                </p>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
