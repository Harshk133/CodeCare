import React from "react";
import { AppShell } from "@/components/shared/AppShell";
import { MapPin, Navigation } from "lucide-react";

export default function HospitalsPage() {
  return (
    <AppShell>
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6 rounded-3xl border border-dashed bg-card/50">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-cyan-500/10 text-cyan-600 dark:text-cyan-400 mb-4">
          <MapPin className="h-8 w-8" />
        </div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">Hospital Finder</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-md">
          Locate nearby hospital facilities, clinics, and government Primary Health Centers (PHCs) with distance calculations.
        </p>
        <button className="mt-6 inline-flex items-center gap-2 rounded-xl bg-cyan-600 px-4 py-2 text-xs font-semibold text-white transition-all hover:bg-cyan-500">
          <Navigation className="h-3.5 w-3.5" />
          Enable Geolocation
        </button>
      </div>
    </AppShell>
  );
}
