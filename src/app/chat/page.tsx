import React from "react";
import { AppShell } from "@/components/shared/AppShell";
import { MessageSquare, ShieldCheck } from "lucide-react";

export default function ChatPage() {
  return (
    <AppShell>
      <div className="flex flex-col items-center justify-center min-h-[50vh] text-center p-6 rounded-3xl border border-dashed bg-card/50">
        <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-teal-500/10 text-primary mb-4">
          <MessageSquare className="h-8 w-8" />
        </div>
        <h1 className="font-heading text-2xl font-bold tracking-tight">AI Health Assistant</h1>
        <p className="text-sm text-muted-foreground mt-2 max-w-md">
          This feature will analyze symptoms, detect medical emergencies, and provide triage advice.
        </p>
        <div className="mt-6 inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 px-3.5 py-1 text-xs font-semibold text-emerald-600 dark:text-emerald-400">
          <ShieldCheck className="h-3.5 w-3.5" />
          HIPAA & Privacy Safeguarded
        </div>
      </div>
    </AppShell>
  );
}
