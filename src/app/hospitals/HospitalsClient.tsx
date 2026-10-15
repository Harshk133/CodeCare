"use client";

import React, { useState, useEffect, useCallback } from "react";
import { AppShell } from "@/components/shared/AppShell";
import dynamic from "next/dynamic";
import { Coordinates } from "@/types";
import { Compass, LocateFixed, Loader2 } from "lucide-react";
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
      setGpsError("Location is off, so we're showing hospitals around central Pune. Allow location access and tap Use my location.");
      setUserLocation(PUNE_FALLBACK);
      fetchHospitals(PUNE_FALLBACK);
    }
  }, [fetchHospitals, requestLocation]);

  useEffect(() => {
    geolocate();
  }, [geolocate]);

  return (
    <AppShell>
      <header className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-4xl font-bold leading-tight sm:text-5xl">{t("hospital_title")}</h1>
          <p className="mt-2 max-w-[60ch] text-lg leading-relaxed text-muted-foreground">
            {t("hospital_desc")}
            {dataSource === "google_places" && <> {t("hospital_live")}</>}
          </p>
        </div>
        <button
          onClick={geolocate}
          disabled={isLocating || isFetchingHospitals}
          className="inline-flex h-11 shrink-0 items-center justify-center gap-2 self-start rounded-lg border-2 border-primary/30 bg-card px-4 text-[15px] font-semibold text-foreground transition-colors hover:border-primary disabled:opacity-60 sm:self-auto"
        >
          {isLocating ? (
            <><Compass className="h-4 w-4 animate-spin" aria-hidden="true" />{t("hospital_geolocating")}</>
          ) : isFetchingHospitals ? (
            <><Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />{t("hospital_loading")}</>
          ) : (
            <><LocateFixed className="h-4 w-4 text-primary" aria-hidden="true" />{t("hospital_recenter")}</>
          )}
        </button>
      </header>

      {gpsError && (
        <p role="status" className="mt-6 flex items-start gap-2 rounded-lg border border-caution/40 bg-caution/10 px-4 py-3 text-[15px] leading-snug">
          <Compass className="mt-0.5 h-4 w-4 shrink-0 text-caution" aria-hidden="true" />
          {gpsError}
        </p>
      )}

      <div className="mt-8">
        {userLocation && hospitals.length > 0 && (
          <HospitalMap userLocation={userLocation} hospitals={hospitals} layout="split" />
        )}

        {isFetchingHospitals && hospitals.length === 0 && (
          <div className="flex items-center gap-3 py-16 text-muted-foreground" role="status">
            <Loader2 className="h-5 w-5 animate-spin text-primary" aria-hidden="true" />
            <span className="text-[15px]">{t("hospital_searching")}</span>
          </div>
        )}

        {!isFetchingHospitals && hospitals.length === 0 && dataSource === "error" && (
          <p role="alert" className="py-16 text-[15px] text-muted-foreground">{t("hospital_error")}</p>
        )}
      </div>
    </AppShell>
  );
}
