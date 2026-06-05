"use client";

import React, { useState } from "react";
import { Message, TriageResult } from "@/types";
import {
  Volume2,
  VolumeX,
  PhoneCall,
  Activity,
  AlertOctagon,
  Clock,
  Navigation,
  MapPin,
  Timer,
} from "lucide-react";
import { cn } from "@/lib/utils";
import dynamic from "next/dynamic";

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

  // Determine Triage color styles
  const getTriageStyles = (risk: string) => {
    switch (risk) {
      case "emergency":
        return "border-rose-500 bg-rose-500/10 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400";
      case "high":
        return "border-orange-500 bg-orange-500/10 dark:bg-orange-950/20 text-orange-700 dark:text-orange-400";
      case "medium":
        return "border-amber-500 bg-amber-500/10 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400";
      case "low":
      default:
        return "border-emerald-500 bg-emerald-500/10 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-400";
    }
  };

  return (
    <div
      className={cn(
        "flex w-full flex-col gap-2.5 px-1 py-2 transition-all duration-300",
        isUser ? "items-end" : "items-start"
      )}
    >
      <div className="flex items-center gap-2">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">
          {isUser ? "You" : "SwasthyaAI Health Assistant"}
        </span>
        {!isUser && onSpeak && (
          <button
            onClick={() => (isCurrentlySpeaking ? onStopSpeaking?.() : onSpeak(cleanContent))}
            className="flex h-5 w-5 items-center justify-center rounded bg-secondary hover:bg-muted text-muted-foreground transition-colors"
            title="Read aloud"
          >
            {isCurrentlySpeaking ? (
              <VolumeX className="h-3 w-3 text-primary" />
            ) : (
              <Volume2 className="h-3 w-3" />
            )}
          </button>
        )}
      </div>

      <div
        className={cn(
          "max-w-[85%] rounded-2xl px-4 py-3 text-sm shadow-sm md:max-w-[75%] leading-relaxed",
          isUser
            ? "bg-primary text-white rounded-tr-none font-medium"
            : "bg-card border rounded-tl-none text-foreground"
        )}
      >
        {/* Renders Emergency Alert Card if detected */}
        {emergencyData && (
          <div className="mb-4 rounded-xl border border-red-500/30 bg-red-500/10 dark:bg-red-950/20 p-4 text-red-900 dark:text-red-300 animate-pulse-alert">
            <div className="flex items-center gap-2 text-red-700 dark:text-red-400 font-bold mb-3">
              <AlertOctagon className="h-5.5 w-5.5" />
              <span>🚨 EMERGENCY ADVISORY: ACTION REQUIRED</span>
            </div>
            <p className="text-xs font-semibold mb-2">
              Symptom: {emergencyData.symptom}
            </p>
            <div className="text-xs space-y-1.5 pl-1.5 border-l-2 border-red-500/50">
              {emergencyData.immediateActions.map((act, idx) => (
                <div key={idx} className="flex gap-1.5">
                  <span className="font-bold">{idx + 1}.</span>
                  <span>{act}</span>
                </div>
              ))}
            </div>
            <div className="mt-4 flex gap-2.5">
              <a
                href="tel:108"
                className="flex items-center gap-1.5 rounded-lg bg-red-600 hover:bg-red-500 text-white px-3.5 py-2 text-xs font-bold transition-all hover:scale-105"
              >
                <PhoneCall className="h-3.5 w-3.5" />
                Call Ambulance (108)
              </a>
            </div>
          </div>
        )}

        {/* Renders Triage Diagnostic Card if detected */}
        {triageData && (
          <div
            className={cn(
              "mb-4 rounded-xl border p-4",
              getTriageStyles(triageData.riskLevel)
            )}
          >
            <div className="flex items-center justify-between font-bold border-b pb-2 mb-2">
              <div className="flex items-center gap-1.5">
                <Activity className="h-4 w-4" />
                <span className="capitalize">Risk: {triageData.riskLevel}</span>
              </div>
              <span className="text-[10px] uppercase tracking-wide px-2 py-0.5 rounded bg-background border font-semibold">
                Clinical Triage
              </span>
            </div>

            <div className="space-y-3 text-xs text-foreground/90">
              <div>
                <span className="font-bold block text-muted-foreground mb-0.5">Concerns:</span>
                <ul className="list-disc pl-4 space-y-0.5">
                  {triageData.concerns.map((c, i) => (
                    <li key={i}>{c}</li>
                  ))}
                </ul>
              </div>

              <div>
                <span className="font-bold block text-muted-foreground mb-0.5">Recommended Actions:</span>
                <ul className="list-decimal pl-4 space-y-0.5">
                  {triageData.actions.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>

              <div className="pt-2 border-t border-muted/50 text-[11px] leading-relaxed italic text-muted-foreground flex gap-1.5">
                <Clock className="h-3.5 w-3.5 shrink-0 mt-0.5" />
                <span>
                  <strong>Reasoning:</strong> {triageData.reasoning}
                </span>
              </div>
            </div>
          </div>
        )}

        {/* Renders Hospital Route Map Card if detected */}
        {hospitalsData && (
          <div className="mb-4">
            <HospitalMap
              userLocation={hospitalsData.userLocation}
              hospitals={hospitalsData.hospitals}
            />
          </div>
        )}

        {/* Renders Directions Summary Card if detected */}
        {directionsData && (
          <div className="mb-4 rounded-xl border border-blue-500/30 bg-blue-500/5 dark:bg-blue-950/10 p-4">
            <div className="flex items-center gap-2 text-blue-700 dark:text-blue-400 font-bold text-xs mb-3">
              <Navigation className="h-4 w-4" />
              <span>Route to {directionsData.hospitalName}</span>
            </div>
            <div className="flex gap-4 mb-3">
              <div className="flex items-center gap-1.5 text-xs">
                <MapPin className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">Distance:</span>
                <span className="font-bold text-foreground">{directionsData.distance}</span>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <Timer className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                <span className="text-muted-foreground">ETA:</span>
                <span className="font-bold text-foreground">{directionsData.duration}</span>
              </div>
            </div>
            <a
              href={`https://www.google.com/maps/dir/${directionsData.origin.latitude},${directionsData.origin.longitude}/${directionsData.destination.latitude},${directionsData.destination.longitude}`}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white px-3.5 py-1.5 text-[11px] font-bold transition-all hover:scale-105 active:scale-95"
            >
              <Navigation className="h-3.5 w-3.5" />
              Open in Google Maps
            </a>
          </div>
        )}

        {/* Plain Text Message Content */}
        <div className="prose prose-sm dark:prose-invert max-w-none whitespace-pre-wrap">
          {cleanContent}
        </div>
      </div>
    </div>
  );
}
