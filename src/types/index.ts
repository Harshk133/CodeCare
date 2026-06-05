// Global TypeScript declarations for SwasthyaAI

export type LanguageCode = "en" | "hi" | "mr" | "ta" | "te" | "bn" | "gu";

export interface Coordinates {
  latitude: number;
  longitude: number;
}

export type RiskLevel = "low" | "medium" | "high" | "emergency";

export interface TriageResult {
  riskLevel: RiskLevel;
  concerns: string[];
  actions: string[];
  reasoning: string;
}

export interface Message {
  id: string;
  role: "user" | "assistant" | "system";
  content: string;
  timestamp: number;
  language?: LanguageCode;
  triage?: TriageResult;
}

export interface OutbreakAlert {
  id: string;
  disease: string;
  location: string;
  severity: "low" | "medium" | "high";
  casesReported?: number;
  advisory: string;
  date: string;
}

export interface Hospital {
  id: string;
  name: string;
  distance: number; // in kilometers
  address: string;
  phone?: string;
  hasEmergency24_7: boolean;
  coordinates: Coordinates;
}
