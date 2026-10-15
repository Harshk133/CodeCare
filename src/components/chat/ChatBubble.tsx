"use client";

import React, { useState } from "react";
import { Message, TriageResult } from "@/types";
import {
  Volume2,
  VolumeX,
  PhoneCall,
  AlertOctagon,
  Navigation,
  MapPin,
  Timer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";
import { Logo } from "@/components/shared/AppShell";

const HospitalMap = dynamic(() => import("./HospitalMap"), {
  ssr: false,
});

interface ChatBubbleProps {
  message: Message;
  onSpeak?: (text: string) => void;
  isCurrentlySpeaking?: boolean;
  onStopSpeaking?: () => void;
}

export function ChatBubble({
  message,
  onSpeak,
  isCurrentlySpeaking = false,
  onStopSpeaking,
}: ChatBubbleProps) {
  const isUser = message.role === "user";

  // State to track if metadata parsing succeeded
  let triageData: TriageResult | null = null;
  let emergencyData: { symptom: string; immediateActions: string[] } | null = null;
  let hospitalsData: {
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
  } | null = null;

  let directionsData: {
    hospitalName: string;
    distance: string;
    duration: string;
    origin: { latitude: number; longitude: number };
    destination: { latitude: number; longitude: number };
  } | null = null;

  // Regex to extract triage, emergency, and hospital JSON tags
  try {
    const triageMatch = message.content.match(/<triage>([\s\S]*?)<\/triage>/);
    if (triageMatch && triageMatch[1]) {
      triageData = JSON.parse(triageMatch[1].trim());
    }

    const emergencyMatch = message.content.match(/<emergency>([\s\S]*?)<\/emergency>/);
    if (emergencyMatch && emergencyMatch[1]) {
      emergencyData = JSON.parse(emergencyMatch[1].trim());
    }

    const hospitalsMatch = message.content.match(/<hospitals>([\s\S]*?)<\/hospitals>/);
    if (hospitalsMatch && hospitalsMatch[1]) {
      hospitalsData = JSON.parse(hospitalsMatch[1].trim());
    }

    const directionsMatch = message.content.match(/<directions>([\s\S]*?)<\/directions>/);
    if (directionsMatch && directionsMatch[1]) {
      directionsData = JSON.parse(directionsMatch[1].trim());
    }
  } catch (err) {
    console.warn("⚠️ Failed to parse embedded structured metadata in stream:", err);
  }

  // Clean the markdown text by removing the XML-JSON metadata tags
  const cleanContent = message.content
    .replace(/<triage>[\s\S]*?<\/triage>/gi, "")
    .replace(/<emergency>[\s\S]*?<\/emergency>/gi, "")
    .replace(/<hospitals>[\s\S]*?<\/hospitals>/gi, "")
    .replace(/<directions>[\s\S]*?<\/directions>/gi, "")
    .trim();

  if (message.role === "system") {
    return (
      <div role="alert" className="flex items-start gap-2 rounded-lg border border-destructive/30 bg-destructive/5 px-4 py-3 text-[15px] text-foreground">
        <AlertOctagon className="mt-0.5 h-4 w-4 shrink-0 text-destructive" aria-hidden="true" />
        <span>{message.content}</span>
      </div>
    );
  }

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-2xl rounded-br-md bg-primary px-4 py-2.5 text-[15px] leading-relaxed text-primary-foreground md:max-w-[70%]">
          {message.content}
        </div>
      </div>
    );
  }

  const isWaiting = !message.content.trim();

  return (
    <article className="flex gap-3">
      <Logo className="mt-0.5 h-7 w-7 shrink-0" />
      <div className="min-w-0 flex-1 space-y-4">
        <div className="flex h-7 items-center gap-2">
          <span className="font-heading text-[15px] font-semibold">SwasthyaAI</span>
          {onSpeak && !isWaiting && (
            <button
              onClick={() => (isCurrentlySpeaking ? onStopSpeaking?.() : onSpeak(cleanContent))}
              className="flex h-7 items-center gap-1 rounded-md px-1.5 text-sm text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              aria-label={isCurrentlySpeaking ? "Stop reading aloud" : "Read aloud"}
            >
              {isCurrentlySpeaking ? <VolumeX className="h-4 w-4 text-primary" /> : <Volume2 className="h-4 w-4" />}
            </button>
          )}
        </div>

        {isWaiting && (
          <div className="flex h-6 items-center gap-1.5" aria-label="SwasthyaAI is typing">
            {[0, 150, 300].map((d) => (
              <span
                key={d}
                className="h-2 w-2 animate-bounce rounded-full bg-muted-foreground/50"
                style={{ animationDelay: `${d}ms` }}
              />
            ))}
          </div>
        )}

        {emergencyData && (
          <section className="rounded-xl bg-destructive p-5 text-destructive-foreground" aria-label="Emergency">
            <h3 className="flex items-center gap-2 text-xl font-bold leading-tight">
              <AlertOctagon className="h-6 w-6 shrink-0" aria-hidden="true" />
              Get emergency help now
            </h3>
            <p className="mt-1 text-[15px] opacity-90">{emergencyData.symptom}</p>
            <ol className="mt-4 list-decimal space-y-1.5 pl-5 text-[15px] leading-snug marker:font-semibold">
              {emergencyData.immediateActions.map((act, idx) => (
                <li key={idx}>{act}</li>
              ))}
            </ol>
            <a
              href="tel:108"
              className="mt-5 inline-flex h-12 items-center gap-2 rounded-lg bg-white px-5 text-base font-bold text-destructive"
            >
              <PhoneCall className="h-5 w-5" aria-hidden="true" />
              Call 108 ambulance
            </a>
          </section>
        )}

        {triageData && <TriageCard triage={triageData} />}

        {hospitalsData && (
          <HospitalMap userLocation={hospitalsData.userLocation} hospitals={hospitalsData.hospitals} />
        )}

        {directionsData && (
          <section className="rounded-xl border bg-card p-4">
            <h3 className="flex items-center gap-2 text-base font-semibold">
              <Navigation className="h-4 w-4 text-primary" aria-hidden="true" />
              Route to {directionsData.hospitalName}
            </h3>
            <dl className="mt-3 flex gap-8 text-sm">
              <div>
                <dt className="flex items-center gap-1 text-muted-foreground">
                  <MapPin className="h-3.5 w-3.5" aria-hidden="true" /> Distance
                </dt>
                <dd className="font-heading text-lg font-semibold">{directionsData.distance}</dd>
              </div>
              <div>
                <dt className="flex items-center gap-1 text-muted-foreground">
                  <Timer className="h-3.5 w-3.5" aria-hidden="true" /> Travel time
                </dt>
                <dd className="font-heading text-lg font-semibold">{directionsData.duration}</dd>
              </div>
            </dl>
            <a
              href={`https://www.google.com/maps/dir/${directionsData.origin.latitude},${directionsData.origin.longitude}/${directionsData.destination.latitude},${directionsData.destination.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-4 inline-flex h-10 items-center gap-2 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground"
            >
              <Navigation className="h-4 w-4" aria-hidden="true" />
              Open in Google Maps
            </a>
          </section>
        )}

        {cleanContent && (
          <div className="max-w-[68ch] whitespace-pre-wrap text-[15px] leading-relaxed text-foreground">
            {cleanContent}
          </div>
        )}
      </div>
    </article>
  );
}

const RISK_STEPS: { level: TriageResult["riskLevel"]; label: string; fill: string; text: string }[] = [
  { level: "low", label: "Low", fill: "bg-safe", text: "text-safe" },
  { level: "medium", label: "Medium", fill: "bg-caution", text: "text-caution" },
  { level: "high", label: "High", fill: "bg-warning", text: "text-warning" },
  { level: "emergency", label: "Emergency", fill: "bg-destructive", text: "text-destructive" },
];

function TriageCard({ triage }: { triage: TriageResult }) {
  const activeIdx = Math.max(0, RISK_STEPS.findIndex((s) => s.level === triage.riskLevel));
  const active = RISK_STEPS[activeIdx];

  return (
    <section className="rounded-xl border bg-card p-4 sm:p-5" aria-label="Urgency assessment">
      <div className="flex items-baseline justify-between gap-4">
        <h3 className="text-base font-semibold text-muted-foreground">How urgent this looks</h3>
        <span className={cn("font-heading text-xl font-bold", active.text)}>{active.label}</span>
      </div>

      {/* Four-step scale: where this case sits between "manage at home" and "emergency" */}
      <div className="mt-3 grid grid-cols-4 gap-1" role="img" aria-label={`Urgency ${active.label}, ${activeIdx + 1} of 4`}>
        {RISK_STEPS.map((s, i) => (
          <div key={s.level}>
            <div className={cn("h-2 rounded-full", i <= activeIdx ? s.fill : "bg-muted")} />
            <span
              className={cn(
                "mt-1.5 block text-xs",
                i === activeIdx ? "font-semibold text-foreground" : "text-muted-foreground"
              )}
            >
              {s.label}
            </span>
          </div>
        ))}
      </div>

      <div className="mt-5 grid gap-5 sm:grid-cols-2">
        <div>
          <h4 className="text-[15px] font-semibold">What it could be</h4>
          <ul className="mt-1.5 space-y-1 text-[15px] leading-snug">
            {triage.concerns.map((c, i) => (
              <li key={i} className="flex gap-2">
                <span aria-hidden="true" className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-muted-foreground/60" />
                {c}
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h4 className="text-[15px] font-semibold">What to do next</h4>
          <ol className="mt-1.5 list-decimal space-y-1 pl-5 text-[15px] leading-snug marker:text-muted-foreground">
            {triage.actions.map((a, i) => (
              <li key={i}>{a}</li>
            ))}
          </ol>
        </div>
      </div>

      {triage.reasoning && (
        <p className="mt-5 border-t pt-4 text-sm leading-relaxed text-muted-foreground">
          <span className="font-semibold text-foreground">Why: </span>
          {triage.reasoning}
        </p>
      )}
    </section>
  );
}
