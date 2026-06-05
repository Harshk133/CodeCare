"use client";

import React from "react";
import { cn } from "@/lib/utils";
import { useHealthStore, VoiceName } from "@/store/useHealthStore";

const VOICES: { name: VoiceName; gender: "male" | "female"; tagline: string }[] = [
  { name: "Suresh", gender: "male",   tagline: "Deep & authoritative" },
  { name: "Priya",  gender: "female", tagline: "Warm & clear" },
  { name: "Arjun",  gender: "male",   tagline: "Calm & reassuring" },
];

export function VoiceSelector() {
  const { preferredVoice, setPreferredVoice } = useHealthStore();

  return (
    <div className="flex flex-col gap-1.5 px-1 mt-2">
      <span className="text-[10px] font-semibold text-muted-foreground uppercase tracking-wider">
        Hindi Voice
      </span>
      <div className="flex gap-2">
        {VOICES.map((v) => {
          const isActive = preferredVoice === v.name;
          return (
            <button
              key={v.name}
              type="button"
              onClick={() => setPreferredVoice(v.name)}
              className={cn(
                "flex-1 flex flex-col items-center gap-0.5 rounded-xl border py-2 px-1.5 transition-all duration-200 text-center",
                isActive
                  ? "bg-primary/10 border-primary text-primary shadow-sm"
                  : "bg-card border-border text-muted-foreground hover:bg-muted hover:text-foreground"
              )}
            >
              {/* Gender avatar */}
              <span className="text-base leading-none" aria-hidden="true">
                {v.gender === "female" ? "👩" : "👨"}
              </span>
              <span className={cn("text-[11px] font-bold leading-tight", isActive && "text-primary")}>
                {v.name}
              </span>
              <span className="text-[9px] leading-tight opacity-70">{v.tagline}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
