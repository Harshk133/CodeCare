"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { GoogleMap, useJsApiLoader, DirectionsRenderer } from "@react-google-maps/api";

// Define TypeScript interfaces for coordinates
interface Coordinates {
  lat: number;
  lng: number;
}

// Define map container styles
const containerStyle = {
  width: "100%",
  height: "500px",
};

// Fallback center if geolocation fails (e.g., New York City)
const defaultCenter = {
  lat: 40.7128,
  lng: -74.0060,
};

// Explicit destination coordinates (Replace with your particular location)
const DESTINATION: Coordinates = {
  lat: 34.0522, // Example: Los Angeles
  lng: -118.2437,
};

export default function MapRoute() {
  const { isLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY || "",
  });

  const [currentLocation, setCurrentLocation] = useState<Coordinates | null>(null);
  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  
  // Use a ref to prevent unnecessary route calculations during re-renders
  const hasFetchedRoute = useRef(false);

  // 1. Get user's current location using the browser Geolocation API
  useEffect(() => {
    if (!navigator.geolocation) {
      setGeoError("Geolocation is not supported by your browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setCurrentLocation({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (error) => {
        setGeoError("Permission to access location was denied.");
        console.error(error);
      }
    );
  }, []);

  // 2. Fetch driving directions from current location to destination
  const calculateRoute = useCallback(async (origin: Coordinates) => {
    if (hasFetchedRoute.current) return;
    hasFetchedRoute.current = true;

    const directionsService = new window.google.maps.DirectionsService();
    
    try {
      const result = await directionsService.route({
        origin: new window.google.maps.LatLng(origin.lat, origin.lng),
        destination: new window.google.maps.LatLng(DESTINATION.lat, DESTINATION.lng),
        travelMode: window.google.maps.TravelMode.DRIVING,
      });
      
      setDirections(result);
    } catch (error) {
      console.error("Directions request failed:", error);
    }
  }, []);

  // Trigger route calculation once current location is available
  useEffect(() => {
    if (currentLocation) {
      calculateRoute(currentLocation);
    }
  }, [currentLocation, calculateRoute]);

  if (!isLoaded) return <div className="p-4 text-center">Loading Maps...</div>;

  return (
    <div className="w-full flex flex-col gap-4">
      {geoError && (
        <div className="p-2 text-sm bg-red-100 text-red-700 rounded">
          {geoError} - Showing fallback route.
        </div>
      )}
      
      <GoogleMap
        mapContainerStyle={containerStyle}
        center={currentLocation || defaultCenter}
        zoom={12}
      >
        {/* DirectionsRenderer auto-draws the path line and markers on the map */}
        {directions && <DirectionsRenderer directions={directions} />}
      </GoogleMap>
    </div>
  );
}
