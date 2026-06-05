"use client";

import React, { useState, useEffect } from "react";
import { AppShell } from "@/components/shared/AppShell";
import dynamic from "next/dynamic";

const HospitalMap = dynamic(() => import("@/components/chat/HospitalMap"), {
  ssr: false,
});
import { Coordinates } from "@/types";
import { Compass, MapPin, Sparkles } from "lucide-react";

const ALL_MOCK_HOSPITALS = [
  {
    name: "Sanjeevan Specialty Hospital",
    address: "Deccan Gymkhana, Pune, Maharashtra 411004",
    phone: "+91 20 2567 8000",
    hasEmergency24_7: true,
    coordinates: { latitude: 18.5144, longitude: 73.8412 },
    specialties: ["dengue", "malaria", "fever", "infectious diseases"],
  },
  {
    name: "Kamla Nehru Municipal Hospital",
    address: "Mangalwar Peth, Pune, Maharashtra 411011",
    phone: "+91 20 2447 3012",
    hasEmergency24_7: true,
    coordinates: { latitude: 18.5282, longitude: 73.8631 },
    specialties: ["dengue", "malaria", "tuberculosis", "general medicine"],
  },
  {
    name: "Ruby Hall Clinic (Emergency Care)",
    address: "Sassoon Road, Pune, Maharashtra 411001",
    phone: "+91 20 6645 5100",
    hasEmergency24_7: true,
    coordinates: { latitude: 18.5325, longitude: 73.8788 },
    specialties: ["cardiology", "stroke", "emergency", "intensive care", "breathing distress"],
  },
  {
    name: "Primary Health Centre (PHC) Mulshi",
    address: "Mulshi Road, Maharashtra 411042",
    phone: "+91 20 2292 2011",
    hasEmergency24_7: false,
    coordinates: { latitude: 18.5085, longitude: 73.6195 },
    specialties: ["fever", "malaria", "general medicine", "vaccination"],
  },
];

export default function HospitalsClient() {
  const [userLocation, setUserLocation] = useState<Coordinates | null>({
    latitude: 18.5204,
    longitude: 73.8567,
  });
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);

  const geolocate = () => {
    if (typeof window === "undefined" || !navigator.geolocation) {
      setGpsError("Geolocation is not supported by this device.");
      return;
    }

    setIsLocating(true);
    console.log("🌐 [Hospitals Page] Requesting device GPS coordinates...");
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const coords = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
        };
        setUserLocation(coords);
        setIsLocating(false);
        setGpsError(null);
        console.log(`✅ [Hospitals Page] GPS coords retrieved: [${coords.latitude}, ${coords.longitude}]`);
      },
      (error) => {
        console.warn("⚠️ [Hospitals Page] Geolocation failed:", error.message);
        setGpsError("GPS denied. Using Pune Deccan Gymkhana as center.");
        setUserLocation({ latitude: 18.5204, longitude: 73.8567 }); // Deccan Center fallback
        setIsLocating(false);
      },
      { timeout: 6000 }
    );
  };

  // Geolocate automatically on load
  useEffect(() => {
    geolocate();
  }, []);

  // Calculate distance on the fly for the list
  const getHospitalsData = () => {
    const baseLat = userLocation?.latitude || 18.5204;
    const baseLng = userLocation?.longitude || 73.8567;

    return ALL_MOCK_HOSPITALS.map((h) => {
      const dist = Math.sqrt(
        Math.pow(h.coordinates.latitude - baseLat, 2) +
        Math.pow(h.coordinates.longitude - baseLng, 2)
      ) * 111;
      return {
        ...h,
        distance: parseFloat(dist.toFixed(1)),
      };
    }).sort((a, b) => a.distance - b.distance);
  };

  const hospitalsList = getHospitalsData();

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl mx-auto pb-8">
        {/* Banner Section */}
        <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-r from-teal-500/10 via-cyan-500/5 to-transparent p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-teal-500/15 px-2.5 py-0.5 text-[10px] font-bold text-teal-600 dark:text-teal-400 mb-2">
                <Sparkles className="h-3 w-3" />
                <span>Specialized Medical Directory</span>
              </div>
              <h1 className="font-heading text-2xl font-bold tracking-tight">Specialized Hospital Finder</h1>
              <p className="text-xs text-muted-foreground max-w-md">
                Locate clinics, primary health centers (PHCs), and emergency rooms prioritizing specialized infection wards.
              </p>
            </div>
            
            <button
              onClick={geolocate}
              disabled={isLocating}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:bg-teal-600/50 text-white px-4 py-2.5 text-xs font-bold transition-all shadow-md shadow-teal-500/10 active:scale-95"
            >
              {isLocating ? (
                <>
                  <Compass className="h-4 w-4 animate-spin shrink-0" />
                  <span>Geolocating...</span>
                </>
              ) : (
                <>
                  <MapPin className="h-4 w-4 shrink-0" />
                  <span>Recenter Location</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* GPS Status / Error Banners */}
        {gpsError && (
          <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 px-4 py-2.5 text-xs text-amber-600 dark:text-amber-500 font-semibold border border-amber-500/20">
            <Compass className="h-4 w-4 animate-spin-slow shrink-0" />
            <span>{gpsError}</span>
          </div>
        )}

        {/* Dynamic Map component */}
        {userLocation && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5 px-1">
              <MapPin className="h-4 w-4 text-teal-600" />
              <span>Interactive Care Map & Routes</span>
            </h3>
            <HospitalMap
              userLocation={userLocation}
              hospitals={hospitalsList}
            />
          </div>
        )}
      </div>
    </AppShell>
  );
}
