"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { useHealthStore, VoiceName } from "@/store/useHealthStore";

const VOICES: { name: VoiceName; tagline: string }[] = [
  { name: "Suresh", tagline: "Deep, steady" },
  { name: "Priya",  tagline: "Warm, clear" },
  { name: "Arjun",  tagline: "Calm, reassuring" },
];

export function VoiceSelector() {
  const { preferredVoice, setPreferredVoice } = useHealthStore();

  return (
    <fieldset className="mb-2.5">
      <legend className="sr-only">Hindi voice</legend>
      <div className="flex flex-wrap items-center gap-x-1 gap-y-1 text-sm">
        <span className="mr-1 text-muted-foreground" aria-hidden="true">Hindi voice:</span>
        {VOICES.map((v) => {
          const isActive = preferredVoice === v.name;
          return (
            <button
              key={v.name}
              type="button"
              aria-pressed={isActive}
              onClick={() => setPreferredVoice(v.name)}
              title={v.tagline}
              className={cn(
                "rounded-md border px-2.5 py-1 transition-colors",
                isActive
                  ? "border-primary bg-primary/10 font-semibold text-foreground"
                  : "border-transparent text-muted-foreground hover:text-foreground"
              )}
            >
              {v.name}
              <span className="ml-1.5 hidden text-xs font-normal text-muted-foreground sm:inline">{v.tagline}</span>
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}
