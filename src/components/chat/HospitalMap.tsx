"use client";

import React, { useState, useEffect, useRef } from "react";
import { Phone, Hospital, Navigation, CheckCircle2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { GoogleMap, useJsApiLoader, DirectionsRenderer } from "@react-google-maps/api";


interface HospitalMapProps {
  userLocation: { latitude: number; longitude: number };
  hospitals: Array<{
    name: string;
    distance: number;
    address: string;
    phone: string;
    coordinates: { latitude: number; longitude: number };
    specialties: string[];
    hasEmergency24_7: boolean;
    matchesSpecialty?: boolean;
  }>;
}

declare global {
  interface Window {
    L: any;
  }
}

export default function HospitalMap({ userLocation, hospitals }: HospitalMapProps) {
  const googleMapsApiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  // Activate Google Maps if key is configured and is not the placeholder template
  const hasGoogleMaps = 
    !!googleMapsApiKey && 
    googleMapsApiKey !== "" && 
    !googleMapsApiKey.includes("your_google_maps_key") &&
    !googleMapsApiKey.includes("AIzaSy...your");

  const [leafletLoaded, setLeafletLoaded] = useState(false);
  const [selectedIdx, setSelectedIdx] = useState<number>(0);
  const mapRef = useRef<HTMLDivElement | null>(null);
  const mapInstanceRef = useRef<any>(null);

  // 1. Google Maps JS API loader
  const { isLoaded: isGoogleMapsLoaded } = useJsApiLoader({
    id: "google-map-script",
    googleMapsApiKey: googleMapsApiKey || "",
  });

  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);

  // 2. Fetch routing directions using Google Maps DirectionsService
  useEffect(() => {
    if (!hasGoogleMaps || !isGoogleMapsLoaded || typeof window === "undefined" || !window.google) return;

    const selectedHospital = hospitals[selectedIdx] || hospitals[0];
    if (!selectedHospital) return;

    const directionsService = new window.google.maps.DirectionsService();

    directionsService.route(
      {
        origin: new window.google.maps.LatLng(userLocation.latitude, userLocation.longitude),
        destination: new window.google.maps.LatLng(selectedHospital.coordinates.latitude, selectedHospital.coordinates.longitude),
        travelMode: window.google.maps.TravelMode.DRIVING,
      },
      (result, status) => {
        if (status === window.google.maps.DirectionsStatus.OK) {
          setDirections(result);
        } else {
          console.error("Google Maps Directions request failed:", status);
        }
      }
    );
  }, [hasGoogleMaps, isGoogleMapsLoaded, selectedIdx, userLocation, hospitals]);

  // 3. Load Leaflet from CDN dynamically ONLY if Google Maps is disabled
  useEffect(() => {
    if (hasGoogleMaps || typeof window === "undefined") return;

    if (window.L) {
      setLeafletLoaded(true);
      return;
    }

    // Load Leaflet CSS
    const cssId = "leaflet-cdn-css";
    if (!document.getElementById(cssId)) {
      const link = document.createElement("link");
      link.id = cssId;
      link.rel = "stylesheet";
      link.href = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.css";
      document.head.appendChild(link);
    }

    // Load Leaflet JS
    const jsId = "leaflet-cdn-js";
    if (!document.getElementById(jsId)) {
      const script = document.createElement("script");
      script.id = jsId;
      script.src = "https://unpkg.com/leaflet@1.9.4/dist/leaflet.js";
      script.async = true;
      script.onload = () => {
        setLeafletLoaded(true);
      };
      document.body.appendChild(script);
    } else {
      const interval = setInterval(() => {
        if (window.L) {
          setLeafletLoaded(true);
          clearInterval(interval);
        }
      }, 100);
      return () => clearInterval(interval);
    }
  }, [hasGoogleMaps]);

  // 4. Initialize Leaflet Map ONLY if Google Maps is disabled
  useEffect(() => {
    if (hasGoogleMaps || !leafletLoaded || !mapRef.current || !window.L) return;

    // Destroy prior map instance
    if (mapInstanceRef.current) {
      mapInstanceRef.current.remove();
    }

    const L = window.L;

    // Center map around user location initially
    const map = L.map(mapRef.current, {
      zoomControl: false,
    }).setView([userLocation.latitude, userLocation.longitude], 13);
    mapInstanceRef.current = map;

    // Add tiles
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      attribution: '&copy; <a href="https://osm.org/copyright">OpenStreetMap</a>',
    }).addTo(map);

    // Zoom control at bottom right
    L.control.zoom({ position: "bottomright" }).addTo(map);

    // Custom Icon for User (pulsing teal dot)
    const userIcon = L.divIcon({
      className: "custom-user-marker",
      html: `
        <div class="relative flex h-5 w-5 items-center justify-center">
          <span class="animate-ping absolute inline-flex h-full w-full rounded-full bg-teal-400 opacity-75"></span>
          <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-teal-500 border-2 border-white shadow"></span>
        </div>
      `,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    // Custom Icon for Hospital (rose cross pin)
    const hospitalIcon = (isSpecialized: boolean) => L.divIcon({
      className: "custom-hospital-marker",
      html: `
        <div class="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white shadow-lg transition-transform hover:scale-110 duration-200 cursor-pointer ${
          isSpecialized ? "bg-teal-600 text-white" : "bg-rose-500 text-white"
        }">
          <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round">
            <path d="M19 10.5V20a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2v-9.5"/>
            <path d="M12 2v4"/>
            <path d="M16 4H8"/>
            <path d="M12 9v4"/>
            <path d="M10 11h4"/>
          </svg>
        </div>
      `,
      iconSize: [28, 28],
      iconAnchor: [14, 14],
    });

    // Add User location pin
    L.marker([userLocation.latitude, userLocation.longitude], { icon: userIcon })
      .addTo(map)
      .bindPopup("<div class='text-xs font-semibold font-sans'>Your Location</div>");

    const bounds = L.latLngBounds([userLocation.latitude, userLocation.longitude]);

    // Add Hospital Pins and routing paths
    hospitals.forEach((h) => {
      const latlng = [h.coordinates.latitude, h.coordinates.longitude];
      bounds.extend(latlng);

      const marker = L.marker(latlng, { icon: hospitalIcon(!!h.matchesSpecialty) })
        .addTo(map);

      const popupContent = `
        <div class="p-1 min-w-[140px] text-foreground font-sans">
          <div class="font-bold text-xs leading-tight text-slate-800">${h.name}</div>
          <div class="text-[10px] text-slate-500 mt-0.5 leading-tight">${h.address}</div>
          <div class="flex items-center justify-between mt-2 pt-1 border-t border-slate-100 text-[10px]">
            <span class="font-bold text-teal-600">${h.distance} km away</span>
            ${h.hasEmergency24_7 ? `<span class="bg-red-500/10 text-red-500 text-[8px] font-bold px-1 rounded">24/7 ER</span>` : ""}
          </div>
        </div>
      `;
      marker.bindPopup(popupContent);

      const routePoints = [
        [userLocation.latitude, userLocation.longitude],
        [h.coordinates.latitude, h.coordinates.longitude]
      ];

      L.polyline(routePoints, {
        color: h.matchesSpecialty ? "#0d9488" : "#f43f5e",
        weight: h.matchesSpecialty ? 3.5 : 2,
        opacity: h.matchesSpecialty ? 0.85 : 0.6,
        dashArray: "6, 8",
        lineCap: "round"
      }).addTo(map);
    });

    map.fitBounds(bounds, { padding: [40, 40] });

    const resizeTimer = setTimeout(() => {
      map.invalidateSize();
    }, 150);

    return () => {
      clearTimeout(resizeTimer);
      if (mapInstanceRef.current) {
        mapInstanceRef.current.remove();
        mapInstanceRef.current = null;
      }
    };
  }, [leafletLoaded, userLocation, hospitals, hasGoogleMaps]);

  const selectedHospital = hospitals[selectedIdx] || hospitals[0];

  return (
    <div className="w-full space-y-4 my-2">
      {/* Global Leaflet CSS Styling Fixes */}
      {!hasGoogleMaps && (
        <style dangerouslySetInnerHTML={{ __html: `
          .leaflet-popup-content-wrapper {
            background: rgba(255, 255, 255, 0.95) !important;
            backdrop-filter: blur(8px) !important;
            border: 1px solid rgba(228, 228, 231, 0.8) !important;
            border-radius: 12px !important;
            box-shadow: 0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1) !important;
          }
          .dark .leaflet-popup-content-wrapper {
            background: rgba(24, 24, 27, 0.95) !important;
            border-color: rgba(63, 63, 70, 0.8) !important;
            color: #f4f4f5 !important;
          }
          .leaflet-popup-content {
            margin: 8px 12px !important;
            font-family: inherit !important;
          }
          .leaflet-popup-tip {
            background: rgba(255, 255, 255, 0.95) !important;
          }
          .dark .leaflet-popup-tip {
            background: rgba(24, 24, 27, 0.95) !important;
          }
        `}} />
      )}

      {/* Map Canvas / Google Maps Component Container */}
      <div className="relative rounded-2xl overflow-hidden border bg-card/60 shadow-md">
        {hasGoogleMaps ? (
          !isGoogleMapsLoaded ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100 dark:bg-zinc-900/50 backdrop-blur z-10 space-y-2 h-[260px]">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
              <span className="text-xs text-muted-foreground font-medium animate-pulse">Loading Google Maps...</span>
            </div>
          ) : (
            <GoogleMap
              mapContainerStyle={{ width: "100%", height: "260px" }}
              center={{ lat: userLocation.latitude, lng: userLocation.longitude }}
              zoom={13}
              options={{
                zoomControl: true,
                streetViewControl: false,
                mapTypeControl: false,
                fullscreenControl: false,
              }}
            >
              {directions && <DirectionsRenderer directions={directions} />}
            </GoogleMap>
          )
        ) : (
          <>
            {!leafletLoaded && (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-100 dark:bg-zinc-900/50 backdrop-blur z-10 space-y-2 h-[260px]">
                <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                <span className="text-xs text-muted-foreground font-medium animate-pulse">Initializing Route Map...</span>
              </div>
            )}
            <div ref={mapRef} className="w-full h-[260px] z-0" />
          </>
        )}
      </div>

      {/* Hospital List Display */}
      <div className="grid gap-2.5">
        {hospitals.map((h, idx) => (
          <div
            key={idx}
            className={cn(
              "p-3 rounded-xl border transition-all duration-300 relative overflow-hidden group hover:shadow-sm cursor-pointer",
              h.matchesSpecialty 
                ? "bg-teal-500/5 border-teal-500/30 dark:bg-teal-950/10 dark:border-teal-900/30" 
                : "bg-card/40 border-border",
              selectedIdx === idx && "ring-2 ring-primary bg-primary/5 dark:bg-primary/5 border-primary/45"
            )}
            onClick={() => setSelectedIdx(idx)}
          >
            {/* Header Area */}
            <div className="flex items-start justify-between gap-2">
              <div className="flex gap-2 items-start">
                <Hospital className={cn("h-4.5 w-4.5 shrink-0 mt-0.5", h.matchesSpecialty ? "text-teal-600 dark:text-teal-400" : "text-muted-foreground")} />
                <div>
                  <h4 className="text-xs font-bold text-foreground leading-tight">{h.name}</h4>
                  <p className="text-[10px] text-muted-foreground leading-tight mt-1">{h.address}</p>
                </div>
              </div>
              <div className="text-right shrink-0">
                <span className="text-xs font-bold text-teal-600 dark:text-teal-400 block">{h.distance} km</span>
                <span className="text-[9px] text-muted-foreground">distance</span>
              </div>
            </div>

            {/* Specialties Badges & Action info */}
            <div className="flex flex-wrap items-center justify-between gap-2 mt-3 pt-2.5 border-t border-dashed border-border/80">
              <div className="flex flex-wrap gap-1">
                {h.specialties.map((s, sIdx) => (
                  <span
                    key={sIdx}
                    className={cn(
                      "text-[8px] font-bold px-1.5 py-0.5 rounded capitalize",
                      s.toLowerCase() === "dengue" || s.toLowerCase() === "malaria" || s.toLowerCase() === "tuberculosis" || s.toLowerCase() === "stroke" || s.toLowerCase() === "emergency"
                        ? "bg-red-500/10 text-red-500 dark:bg-red-950/20"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {s}
                  </span>
                ))}
              </div>

              {/* Specialization Badge Alert */}
              {h.matchesSpecialty && (
                <div className="flex items-center gap-1 text-[8px] font-extrabold text-teal-600 dark:text-teal-400">
                  <CheckCircle2 className="h-3 w-3" />
                  <span>SPECIALIZED CENTER</span>
                </div>
              )}
            </div>

            {/* Interactive Call & Direction buttons */}
        
            <div className="flex gap-2 mt-3" onClick={(e) => e.stopPropagation()}>
              <a
                href={`tel:${h.phone}`}
                className="flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg border glass text-[10px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground transition-all duration-200"
              >
                <Phone className="h-3 w-3" />
                <span>Call Center</span>
              </a>
              <button
                onClick={() => {
                  setSelectedIdx(idx);
                  if (!hasGoogleMaps && mapInstanceRef.current) {
                    mapInstanceRef.current.setView([h.coordinates.latitude, h.coordinates.longitude], 15);
                  }
                }}
                className="flex items-center justify-center gap-1 py-1.5 px-3.5 rounded-lg bg-teal-600 hover:bg-teal-500 text-white text-[10px] font-semibold transition-all duration-200"
              >
                <Navigation className="h-3 w-3" />
                <span>Locate</span>
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
