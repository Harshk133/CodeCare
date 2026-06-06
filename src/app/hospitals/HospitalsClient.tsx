"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/shared/AppShell";
import dynamic from "next/dynamic";
import { Coordinates } from "@/types";
import { Compass, MapPin, Sparkles, Loader2 } from "lucide-react";
import { getApiUrl } from "@/lib/getApiUrl";
import { useNativeGeolocation } from "@/hooks/useNativeBridge";
import { useTranslation } from "@/hooks/useTranslation";

const HospitalMap = dynamic(() => import("@/components/chat/HospitalMap"), { ssr: false });

interface HospitalEntry {
  id: string;
  name: string;
  address: string;
  phone: string;
  hasEmergency24_7: boolean;
  coordinates: { latitude: number; longitude: number };
  specialties: string[];
  distance: number;
  matchesSpecialty: boolean;
  rating?: number | null;
}

const PUNE_FALLBACK: Coordinates = { latitude: 18.5204, longitude: 73.8567 };

export default function HospitalsClient() {
  const [userLocation, setUserLocation] = useState<Coordinates | null>(PUNE_FALLBACK);
  const [hospitals, setHospitals] = useState<HospitalEntry[]>([]);
  const [gpsError, setGpsError] = useState<string | null>(null);
  const [isLocating, setIsLocating] = useState(false);
  const [isFetchingHospitals, setIsFetchingHospitals] = useState(false);
  const [dataSource, setDataSource] = useState<string>("loading");

  const { t } = useTranslation();

  const fetchHospitals = useCallback(async (coords: Coordinates) => {
    setIsFetchingHospitals(true);
    console.log(`🏥 [HospitalsClient] Fetching hospitals near [${coords.latitude}, ${coords.longitude}]`);

    try {
      const res = await fetch(getApiUrl("/api/hospitals"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ latitude: coords.latitude, longitude: coords.longitude, radius: 5000 }),
      });

      if (!res.ok) throw new Error(`API error: ${res.status}`);

      const data = await res.json();
      console.log(`✅ [HospitalsClient] ${data.hospitals.length} hospitals loaded (source: ${data.source})`);
      setHospitals(data.hospitals);
      setDataSource(data.source);
    } catch (err) {
      console.error("❌ [HospitalsClient] Failed to fetch hospitals:", err);
      setDataSource("error");
    } finally {
      setIsFetchingHospitals(false);
    }
  }, []);

  const { requestLocation } = useNativeGeolocation();

  const geolocate = useCallback(async () => {
    setIsLocating(true);
    const coords = await requestLocation();
    setIsLocating(false);
    if (coords) {
      setUserLocation(coords);
      setGpsError(null);
      fetchHospitals(coords);
    } else {
      setGpsError("GPS denied. Using Pune Deccan Gymkhana as center.");
      setUserLocation(PUNE_FALLBACK);
      fetchHospitals(PUNE_FALLBACK);
    }
  }, [fetchHospitals, requestLocation]);

  useEffect(() => {
    geolocate();
  }, [geolocate]);

  return (
    <AppShell>
      <div className="space-y-6 max-w-4xl mx-auto pb-8">
        {/* Banner */}
        <div className="relative overflow-hidden rounded-3xl border bg-gradient-to-r from-teal-500/10 via-cyan-500/5 to-transparent p-6 shadow-sm">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 relative z-10">
            <div className="space-y-1">
              <div className="inline-flex items-center gap-1.5 rounded-full bg-teal-500/15 px-2.5 py-0.5 text-[10px] font-bold text-teal-600 dark:text-teal-400 mb-2">
                <Sparkles className="h-3 w-3" />
                <span>{t("hospital_badge")}</span>
              </div>
              <h1 className="font-heading text-2xl font-bold tracking-tight">{t("hospital_title")}</h1>
              <p className="text-xs text-muted-foreground max-w-md">
                {t("hospital_desc")}
                {dataSource === "google_places" && (
                  <span className="ml-1 text-teal-600 dark:text-teal-400 font-semibold">{t("hospital_live")}</span>
                )}
              </p>
            </div>
            <button
              onClick={geolocate}
              disabled={isLocating || isFetchingHospitals}
              className="inline-flex items-center justify-center gap-2 rounded-xl bg-teal-600 hover:bg-teal-500 disabled:bg-teal-600/50 text-white px-4 py-2.5 text-xs font-bold transition-all shadow-md shadow-teal-500/10 active:scale-95"
            >
              {isLocating ? (
                <><Compass className="h-4 w-4 animate-spin shrink-0" /><span>{t("hospital_geolocating")}</span></>
              ) : isFetchingHospitals ? (
                <><Loader2 className="h-4 w-4 animate-spin shrink-0" /><span>{t("hospital_loading")}</span></>
              ) : (
                <><MapPin className="h-4 w-4 shrink-0" /><span>{t("hospital_recenter")}</span></>
              )}
            </button>
          </div>
        </div>

        {gpsError && (
          <div className="flex items-center gap-2 rounded-xl bg-amber-500/10 px-4 py-2.5 text-xs text-amber-600 dark:text-amber-500 font-semibold border border-amber-500/20">
            <Compass className="h-4 w-4 animate-spin-slow shrink-0" />
            <span>{gpsError}</span>
          </div>
        )}

        {/* Map */}
        {userLocation && hospitals.length > 0 && (
          <div className="space-y-4">
            <h3 className="text-sm font-bold text-foreground flex items-center gap-1.5 px-1">
              <MapPin className="h-4 w-4 text-teal-600" />
              <span>{t("hospital_map_title")}</span>
            </h3>
            <HospitalMap userLocation={userLocation} hospitals={hospitals} />
          </div>
        )}

        {/* Loading skeleton */}
        {isFetchingHospitals && (
          <div className="flex flex-col items-center justify-center py-12 gap-3 text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <span className="text-sm font-medium">{t("hospital_searching")}</span>
          </div>
        )}

        {/* Empty state */}
        {!isFetchingHospitals && hospitals.length === 0 && dataSource === "error" && (
          <div className="flex flex-col items-center justify-center py-12 gap-2 text-muted-foreground">
            <span className="text-sm">{t("hospital_error")}</span>
          </div>
        )}
      </div>
    </AppShell>
  );
}
