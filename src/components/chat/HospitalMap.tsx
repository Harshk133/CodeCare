"use client";

import React, { useState, useEffect, useRef } from "react";
import { Phone, Navigation, CheckCircle2 } from "lucide-react";
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
  /** "stacked" (default): map above list, compact — used inside chat replies.
   *  "split": list beside a taller sticky map on wide screens — used on /hospitals. */
  layout?: "stacked" | "split";
}

declare global {
  interface Window {
    L: any;
  }
}

export default function HospitalMap({ userLocation, hospitals, layout = "stacked" }: HospitalMapProps) {
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

    // Custom Icon for User (pulsing haldi halo around an indigo dot)
    const userIcon = L.divIcon({
      className: "custom-user-marker",
      html: `
        <div class="relative flex h-5 w-5 items-center justify-center">
          <span class="motion-safe:animate-ping absolute inline-flex h-full w-full rounded-full bg-[#F2B705] opacity-60"></span>
          <span class="relative inline-flex rounded-full h-3.5 w-3.5 bg-[#2B3A99] border-2 border-white shadow"></span>
        </div>
      `,
      iconSize: [20, 20],
      iconAnchor: [10, 10],
    });

    // Custom Icon for Hospital (indigo pin; darker when it matches the symptoms)
    const hospitalIcon = (isSpecialized: boolean) => L.divIcon({
      className: "custom-hospital-marker",
      html: `
        <div class="flex h-7 w-7 items-center justify-center rounded-full border-2 border-white shadow-lg transition-transform hover:scale-110 duration-200 cursor-pointer ${
          isSpecialized ? "bg-[#2B3A99] text-white" : "bg-[#5A6386] text-white"
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
          <div class="font-semibold text-sm leading-tight text-foreground">${h.name}</div>
          <div class="text-xs text-muted-foreground mt-0.5 leading-tight">${h.address}</div>
          <div class="flex items-center justify-between mt-2 pt-1 border-t text-xs">
            <span class="font-semibold text-primary">${h.distance} km away</span>
            ${h.hasEmergency24_7 ? `<span class="text-destructive font-semibold">24/7 emergency</span>` : ""}
          </div>
        </div>
      `;
      marker.bindPopup(popupContent);

      const routePoints = [
        [userLocation.latitude, userLocation.longitude],
        [h.coordinates.latitude, h.coordinates.longitude]
      ];

      L.polyline(routePoints, {
        color: h.matchesSpecialty ? "#2B3A99" : "#8A93B8",
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

  const isSplit = layout === "split";
  const mapHeight = isSplit ? 520 : 260;

  const list = (
    <ol className="divide-y border-y">
      {hospitals.map((h, idx) => {
        const selected = selectedIdx === idx;
        return (
          <li
            key={idx}
            className={cn(
              "relative py-4 pl-4 pr-1 transition-colors",
              selected ? "bg-primary/[0.04]" : "hover:bg-muted/50"
            )}
          >
            {selected && <span aria-hidden="true" className="absolute inset-y-0 left-0 w-[3px] bg-primary" />}
            <button
              type="button"
              onClick={() => {
                setSelectedIdx(idx);
                if (!hasGoogleMaps && mapInstanceRef.current) {
                  mapInstanceRef.current.setView([h.coordinates.latitude, h.coordinates.longitude], 15);
                }
              }}
              aria-pressed={selected}
              className="flex w-full items-start justify-between gap-4 text-left"
            >
              <span className="min-w-0">
                <span className="block font-heading text-[17px] font-semibold leading-snug">{h.name}</span>
                <span className="mt-0.5 block text-sm leading-snug text-muted-foreground">{h.address}</span>
              </span>
              <span className="shrink-0 text-right">
                <span className="block font-heading text-xl font-bold tabular-nums leading-none">{h.distance}</span>
                <span className="text-xs text-muted-foreground">km</span>
              </span>
            </button>

            <div className="mt-2.5 flex flex-wrap gap-1.5 text-xs">
              {h.hasEmergency24_7 && (
                <span className="rounded-md bg-destructive/10 px-2 py-0.5 font-semibold text-destructive">24/7 emergency</span>
              )}
              {h.matchesSpecialty && (
                <span className="inline-flex items-center gap-1 rounded-md bg-safe/10 px-2 py-0.5 font-semibold text-safe">
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" /> Treats your symptoms
                </span>
              )}
              {h.specialties.map((s) => (
                <span key={s} className="rounded-md bg-muted px-2 py-0.5 capitalize text-muted-foreground">{s}</span>
              ))}
            </div>

            <div className="mt-3 flex gap-2">
              {h.phone && (
                <a
                  href={`tel:${h.phone}`}
                  className="inline-flex h-9 items-center gap-1.5 rounded-md border bg-card px-3 text-sm font-medium transition-colors hover:border-primary/50"
                >
                  <Phone className="h-3.5 w-3.5" aria-hidden="true" /> Call
                </a>
              )}
              <a
                href={`https://www.google.com/maps/dir/?api=1&destination=${h.coordinates.latitude},${h.coordinates.longitude}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex h-9 items-center gap-1.5 rounded-md bg-primary px-3 text-sm font-semibold text-primary-foreground"
              >
                <Navigation className="h-3.5 w-3.5" aria-hidden="true" /> Directions
              </a>
            </div>
          </li>
        );
      })}
    </ol>
  );

  return (
    <div className={cn("w-full", isSplit ? "grid gap-6 lg:grid-cols-[minmax(0,5fr)_minmax(0,6fr)] lg:items-start" : "space-y-4")}>
      {/* Global Leaflet CSS Styling Fixes */}
      {!hasGoogleMaps && (
        <style dangerouslySetInnerHTML={{ __html: `
          .leaflet-popup-content-wrapper {
            background: hsl(var(--card)) !important;
            color: hsl(var(--card-foreground)) !important;
            border: 1px solid hsl(var(--border)) !important;
            border-radius: 10px !important;
            box-shadow: 0 8px 24px -12px hsl(var(--foreground) / 0.35) !important;
          }
          .leaflet-popup-content {
            margin: 10px 12px !important;
            font-family: inherit !important;
          }
          .leaflet-popup-tip {
            background: hsl(var(--card)) !important;
          }
        `}} />
      )}

      {/* In split layout the list leads; the map stays in view beside it. */}
      {isSplit && list}

      <div
        className={cn(
          "relative overflow-hidden rounded-xl border bg-muted",
          isSplit && "lg:sticky lg:top-20"
        )}
        style={{ height: mapHeight }}
      >
        {hasGoogleMaps ? (
          !isGoogleMapsLoaded ? (
            <MapLoading label="Loading map…" />
          ) : (
            <GoogleMap
              mapContainerStyle={{ width: "100%", height: `${mapHeight}px` }}
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
            {!leafletLoaded && <MapLoading label="Loading map…" />}
            <div ref={mapRef} className="z-0 h-full w-full" />
          </>
        )}
      </div>

      {!isSplit && list}
    </div>
  );
}

function MapLoading({ label }: { label: string }) {
  return (
    <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-muted">
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      <span className="text-sm text-muted-foreground">{label}</span>
    </div>
  );
}
