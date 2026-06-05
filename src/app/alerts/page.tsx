import React from "react";
import { AppShell } from "@/components/shared/AppShell";
import { AlertTriangle, BellRing } from "lucide-react";

export default function AlertsPage() {
  return (
    <AppShell>
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6 rounded-3xl border border-dashed bg-card/50">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 mb-4">
          <AlertTriangle className="h-8 w-8" />
        </div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">Outbreak Alerts Feed</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-md">
          Access local health warnings, government bulletins, and live alerts concerning viral outbreaks or seasonal hazards.
        </p>
        <div className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 px-3.5 py-1 text-xs font-semibold text-amber-600 dark:text-amber-400">
          <BellRing className="h-3.5 w-3.5" />
          Live Outbreak Feed Offline
        </div>
      </div>
    </AppShell>
  );
}
